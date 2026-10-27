import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertRole, round2 } from "./guards";
import { recomputeDay } from "./attendance.functions";

export interface CronAccrualResult {
  ok: boolean;
  companyId: string;
  year: number;
  month: number;
  alreadyProcessed: boolean;
  employeesProcessed: number;
  totalDaysAccrued: number;
}

export interface CronAttendanceRollupResult {
  ok: boolean;
  date: string;
  employeesProcessed: number;
  errorsCount: number;
}

export interface CronWorkerBatchResult {
  ok: boolean;
  jobsProcessed: number;
  completedCount: number;
  failedCount: number;
  deadLetterCount: number;
}

export interface CronRunReport {
  leaveAccrual?: CronAccrualResult[];
  attendanceRollup?: CronAttendanceRollupResult;
  queueWorker?: CronWorkerBatchResult;
}

/**
 * Executes automated monthly leave accrual for a given company or all companies.
 * Idempotent: checks leave_accrual_runs to ensure no double-accrual in the same period.
 */
export async function executeAutomatedMonthlyLeaveAccrual(
  supabase: any,
  options?: {
    companyId?: string;
    year?: number;
    month?: number;
    actorUserId?: string | null;
  },
): Promise<CronAccrualResult[]> {
  const now = new Date();
  const year = options?.year ?? now.getFullYear();
  const month = options?.month ?? (now.getMonth() + 1); // 1-12

  // 1. Resolve companies
  let companiesQuery = supabase.from("companies").select("id, name_ar");
  if (options?.companyId) {
    companiesQuery = companiesQuery.eq("id", options.companyId);
  }
  const { data: companies, error: compErr } = await companiesQuery;
  if (compErr) throw new Error(`تعذر استرجاع المنشآت: ${compErr.message}`);

  const results: CronAccrualResult[] = [];

  for (const company of companies ?? []) {
    // 2. Resolve eligible leave types (accrual_method = 'monthly_accrual' or active annual leaves)
    const { data: leaveTypes, error: ltErr } = await supabase
      .from("leave_types")
      .select("id, code, name_ar, annual_days, accrual_method")
      .eq("company_id", company.id)
      .eq("status", "active");

    if (ltErr || !leaveTypes?.length) {
      results.push({
        ok: true,
        companyId: company.id,
        year,
        month,
        alreadyProcessed: false,
        employeesProcessed: 0,
        totalDaysAccrued: 0,
      });
      continue;
    }

    const eligibleTypes = leaveTypes.filter(
      (lt: any) => lt.accrual_method === "monthly_accrual" || lt.code === "annual" || lt.code === "ANNUAL",
    );

    let companyEmployeesProcessed = 0;
    let companyDaysAccrued = 0;

    for (const lt of eligibleTypes) {
      // 3. Idempotency Check in leave_accrual_runs
      const { data: existingRun } = await supabase
        .from("leave_accrual_runs")
        .select("id, employees_processed, total_days_accrued")
        .eq("company_id", company.id)
        .eq("leave_type_id", lt.id)
        .eq("period_year", year)
        .eq("period_month", month)
        .maybeSingle();

      if (existingRun) {
        results.push({
          ok: true,
          companyId: company.id,
          year,
          month,
          alreadyProcessed: true,
          employeesProcessed: existingRun.employees_processed,
          totalDaysAccrued: Number(existingRun.total_days_accrued),
        });
        continue;
      }

      // 4. Query active employees for this company
      const { data: employees } = await supabase
        .from("employees")
        .select("id, user_id, status")
        .eq("company_id", company.id)
        .eq("status", "active");

      let runProcessed = 0;
      let runDaysAccrued = 0;

      for (const emp of employees ?? []) {
        const { data: balance } = await supabase
          .from("leave_balances")
          .select("id, annual_entitlement, accrued_days, used_days, reserved_days, carried_over_days")
          .eq("employee_id", emp.id)
          .eq("leave_type_id", lt.id)
          .maybeSingle();

        if (!balance) continue;

        const entitlement = Number(balance.annual_entitlement || lt.annual_days || 30);
        if (entitlement <= 0) continue;

        const carried = Number(balance.carried_over_days ?? 0);
        const monthlyAccrual = round2(entitlement / 12);
        const currentAccrued = Number(balance.accrued_days ?? 0);
        const maxAccrued = entitlement + carried;
        const newAccrued = Math.min(maxAccrued, round2(currentAccrued + monthlyAccrual));
        const effectiveAdded = round2(newAccrued - currentAccrued);

        if (effectiveAdded > 0) {
          const used = Number(balance.used_days ?? 0);
          const reserved = Number(balance.reserved_days ?? 0);
          const available = Math.max(0, round2(newAccrued - used - reserved));

          await supabase
            .from("leave_balances")
            .update({
              accrued_days: newAccrued,
              balance: available,
              updated_at: new Date().toISOString(),
            })
            .eq("id", balance.id);

          // Immutable ledger transaction
          await supabase.from("leave_balance_transactions").insert({
            company_id: company.id,
            employee_id: emp.id,
            leave_type_id: lt.id,
            year,
            transaction_type: "accrual",
            days: effectiveAdded,
            reason: `الاستحقاق الشهري الآلي لشهر ${month}/${year}`,
            created_by: options?.actorUserId || null,
          });

          runDaysAccrued += effectiveAdded;
        }

        runProcessed += 1;
      }

      // 5. Record run in leave_accrual_runs
      await supabase.from("leave_accrual_runs").insert({
        company_id: company.id,
        leave_type_id: lt.id,
        period_year: year,
        period_month: month,
        employees_processed: runProcessed,
        total_days_accrued: round2(runDaysAccrued),
        executed_by: options?.actorUserId || null,
        executed_at: new Date().toISOString(),
      });

      companyEmployeesProcessed += runProcessed;
      companyDaysAccrued += runDaysAccrued;

      results.push({
        ok: true,
        companyId: company.id,
        year,
        month,
        alreadyProcessed: false,
        employeesProcessed: runProcessed,
        totalDaysAccrued: round2(runDaysAccrued),
      });
    }

    // 6. Log Enterprise Audit Event
    try {
      await supabase.rpc("log_enterprise_audit_event", {
        p_company_id: company.id,
        p_actor_id: options?.actorUserId || "00000000-0000-0000-0000-000000000000",
        p_actor_name: "النظام الآلي (Cron Engine)",
        p_actor_role: "system_cron",
        p_action: "execute_monthly_leave_accrual",
        p_entity_type: "leave_accrual_run",
        p_entity_id: company.id,
        p_entity_name: `استحقاق شهر ${month}/${year}`,
        p_severity: "info",
        p_changes_summary: `تم معالجة الاستحقاق لـ ${companyEmployeesProcessed} موظفاً بإجمالي ${companyDaysAccrued} يوماً`,
      });
    } catch {
      // Non-blocking audit failure
    }
  }

  return results;
}

/**
 * Executes automated daily attendance rollup for a given date.
 * Recomputes punches, calculates worked minutes, late minutes, and overtime.
 */
export async function executeAutomatedDailyAttendanceRollup(
  supabase: any,
  options?: {
    date?: string;
    companyId?: string;
    actorUserId?: string | null;
  },
): Promise<CronAttendanceRollupResult> {
  const targetDate =
    options?.date ??
    new Date(Date.now() - 86400000).toISOString().slice(0, 10); // Default to yesterday

  let empQuery = supabase.from("employees").select("id, company_id, status").eq("status", "active");
  if (options?.companyId) {
    empQuery = empQuery.eq("company_id", options.companyId);
  }

  const { data: employees, error: empErr } = await empQuery;
  if (empErr) throw new Error(`تعذر استرجاع الموظفين لمعالجة الحضور: ${empErr.message}`);

  let processedCount = 0;
  let errorsCount = 0;

  for (const emp of employees ?? []) {
    try {
      await recomputeDay(supabase, emp.id, targetDate);
      processedCount += 1;
    } catch (err) {
      console.error(`[CronAttendance] Failed recomputing day ${targetDate} for emp ${emp.id}:`, err);
      errorsCount += 1;
    }
  }

  // Log Enterprise Audit Event if companyId provided
  if (options?.companyId) {
    try {
      await supabase.rpc("log_enterprise_audit_event", {
        p_company_id: options.companyId,
        p_actor_id: options?.actorUserId || "00000000-0000-0000-0000-000000000000",
        p_actor_name: "النظام الآلي (Cron Engine)",
        p_actor_role: "system_cron",
        p_action: "execute_daily_attendance_rollup",
        p_entity_type: "attendance_record",
        p_entity_id: targetDate,
        p_entity_name: `ترحيل حضور تاريخ ${targetDate}`,
        p_severity: errorsCount > 0 ? "warning" : "info",
        p_changes_summary: `تم ترحيل سجلات ${processedCount} موظفاً (أخطاء: ${errorsCount})`,
      });
    } catch {
      // Non-blocking audit failure
    }
  }

  return {
    ok: true,
    date: targetDate,
    employeesProcessed: processedCount,
    errorsCount,
  };
}

/**
 * Worker to process queued background jobs from background_jobs table.
 */
export async function processQueuedBackgroundJobs(
  supabase: any,
  options?: {
    batchSize?: number;
    companyId?: string;
  },
): Promise<CronWorkerBatchResult> {
  const batchSize = options?.batchSize ?? 10;

  let query = supabase
    .from("background_jobs")
    .select("*")
    .eq("status", "queued")
    .lte("scheduled_for", new Date().toISOString())
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(batchSize);

  if (options?.companyId) {
    query = query.eq("company_id", options.companyId);
  }

  const { data: jobs, error } = await query;
  if (error || !jobs?.length) {
    return { ok: true, jobsProcessed: 0, completedCount: 0, failedCount: 0, deadLetterCount: 0 };
  }

  let completedCount = 0;
  let failedCount = 0;
  let deadLetterCount = 0;

  for (const job of jobs) {
    await supabase
      .from("background_jobs")
      .update({
        status: "running",
        started_at: new Date().toISOString(),
        attempts: Number(job.attempts || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    try {
      if (job.job_type === "monthly_leave_accrual") {
        await executeAutomatedMonthlyLeaveAccrual(supabase, {
          companyId: job.company_id,
          year: job.payload?.year,
          month: job.payload?.month,
        });
      } else if (job.job_type === "attendance_rollup") {
        await executeAutomatedDailyAttendanceRollup(supabase, {
          companyId: job.company_id,
          date: job.payload?.date,
        });
      } else if (job.job_type === "evaluate_task_slas") {
        await supabase.rpc("evaluate_task_slas", { p_company_id: job.company_id });
      }

      await supabase
        .from("background_jobs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      completedCount += 1;
    } catch (err: any) {
      const errorMessage = err?.message || String(err);
      const attempts = Number(job.attempts || 0) + 1;
      const maxAttempts = Number(job.max_attempts || 5);

      if (attempts >= maxAttempts) {
        await supabase
          .from("background_jobs")
          .update({
            status: "dead_letter",
            last_error: errorMessage,
            error_log: `${job.error_log || ""}\n[Final Failure]: ${errorMessage}`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.id);

        await supabase.from("dead_letter_jobs").insert({
          job_id: job.id,
          company_id: job.company_id,
          job_type: job.job_type,
          payload: job.payload,
          failure_reason: errorMessage,
          attempts_made: attempts,
        });

        deadLetterCount += 1;
      } else {
        await supabase
          .from("background_jobs")
          .update({
            status: "failed",
            last_error: errorMessage,
            next_retry_at: new Date(Date.now() + 60000 * Math.pow(2, attempts)).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.id);

        failedCount += 1;
      }
    }
  }

  return {
    ok: true,
    jobsProcessed: jobs.length,
    completedCount,
    failedCount,
    deadLetterCount,
  };
}

/**
 * Server Function: Trigger cron jobs from UI or internal trigger.
 */
export const runScheduledCronTasksServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    task?: "attendance_rollup" | "leave_accrual" | "queue_worker" | "all";
    date?: string;
    year?: number;
    month?: number;
    companyId?: string;
  }) => input)
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    await assertRole(supabase, context.userId, ["super_admin", "org_admin", "hr_manager"]);

    const task = data.task || "all";
    const report: CronRunReport = {};

    if (task === "leave_accrual" || task === "all") {
      report.leaveAccrual = await executeAutomatedMonthlyLeaveAccrual(supabase, {
        companyId: data.companyId,
        year: data.year,
        month: data.month,
        actorUserId: context.userId,
      });
    }

    if (task === "attendance_rollup" || task === "all") {
      report.attendanceRollup = await executeAutomatedDailyAttendanceRollup(supabase, {
        companyId: data.companyId,
        date: data.date,
        actorUserId: context.userId,
      });
    }

    if (task === "queue_worker" || task === "all") {
      report.queueWorker = await processQueuedBackgroundJobs(supabase, {
        companyId: data.companyId,
      });
    }

    return {
      ok: true,
      executedAt: new Date().toISOString(),
      report,
    };
  });
