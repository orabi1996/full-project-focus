import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertRole } from "./guards";
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

/** Each company accrual is committed atomically by the database RPC. */
export async function executeAutomatedMonthlyLeaveAccrual(
  supabase: any,
  options?: { companyId?: string; year?: number; month?: number; actorUserId?: string | null },
): Promise<CronAccrualResult[]> {
  if (options?.year !== undefined && (!Number.isInteger(options.year) || options.year < 1 || options.year > 9999)) {
    throw new Error("سنة غير صالحة");
  }
  if (options?.month !== undefined && (!Number.isInteger(options.month) || options.month < 1 || options.month > 12)) {
    throw new Error("شهر غير صالح");
  }
  let query = supabase.from("companies").select("id");
  if (options?.companyId) query = query.eq("id", options.companyId);
  const { data: companies, error } = await query;
  if (error) throw new Error(`تعذر استرجاع المنشآت: ${error.message}`);
  if (options?.companyId && !companies?.length) throw new Error("المنشأة غير موجودة أو غير متاحة");
  const results: CronAccrualResult[] = [];
  for (const company of companies ?? []) {
    // Null dates are resolved using the company's configured timezone, never the worker's clock.
    // Attribution comes from auth.uid() inside the RPC, not a caller-provided actor ID.
    const { data, error: rpcError } = await supabase.rpc("run_leave_accrual", {
      p_company_id: company.id,
      p_year: options?.year ?? null,
      p_period_month: options?.month ?? null,
    });
    if (rpcError) throw new Error(`تعذر تنفيذ الاستحقاق: ${rpcError.message}`);
    if (data?.success !== true || !Number.isInteger(data.total_processed) || data.total_processed < 0 ||
        typeof data.total_days_credited !== "number" || !Number.isFinite(data.total_days_credited) || data.total_days_credited < 0 ||
        !Number.isInteger(data.year) || data.year < 1 || data.year > 9999 ||
        !Number.isInteger(data.period_month) || data.period_month < 1 || data.period_month > 12 ||
        typeof data.already_processed !== "boolean") {
      throw new Error("تعذر تأكيد نتيجة الاستحقاق من قاعدة البيانات");
    }
    results.push({ ok: true, companyId: company.id, year: data.year, month: data.period_month,
      alreadyProcessed: data.already_processed, employeesProcessed: data.total_processed,
      totalDaysAccrued: data.total_days_credited });
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
    ok: errorsCount === 0,
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
  if (error) throw new Error(`تعذر استرجاع المهام: ${error.message}`);
  if (!jobs?.length) {
    return { ok: true, jobsProcessed: 0, completedCount: 0, failedCount: 0, deadLetterCount: 0 };
  }

  let completedCount = 0;
  let failedCount = 0;
  let deadLetterCount = 0;

  let jobsProcessed = 0;
  for (const job of jobs) {
    const { data: claimed, error: claimError } = await supabase
      .from("background_jobs")
      .update({
        status: "running",
        started_at: new Date().toISOString(),
        attempts: Number(job.attempts || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id)
      .eq("status", "queued")
      .eq("attempts", job.attempts)
      .select("id")
      .maybeSingle();
    if (claimError) throw new Error(`تعذر حجز المهمة: ${claimError.message}`);
    if (!claimed) continue;
    jobsProcessed += 1;

    try {
      if (job.job_type === "monthly_leave_accrual") {
        await executeAutomatedMonthlyLeaveAccrual(supabase, {
          companyId: job.company_id,
          year: job.payload?.year,
          month: job.payload?.month,
        });
      } else if (job.job_type === "attendance_rollup") {
        const attendance = await executeAutomatedDailyAttendanceRollup(supabase, {
          companyId: job.company_id,
          date: job.payload?.date,
        });
        if (!attendance.ok) throw new Error("تعذر إكمال ترحيل حضور بعض الموظفين");
      } else if (job.job_type === "evaluate_task_slas") {
        const { error: slaError } = await supabase.rpc("evaluate_task_slas", { p_company_id: job.company_id });
        if (slaError) throw new Error(slaError.message);
      } else {
        throw new Error(`Unsupported background job type: ${job.job_type}`);
      }

      const { data: completed, error: completeError } = await supabase
        .from("background_jobs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id)
        .eq("status", "running")
        .select("id")
        .single();
      if (completeError || !completed) throw new Error(completeError?.message || "تعذر تأكيد اكتمال المهمة");

      completedCount += 1;
    } catch (err: any) {
      const errorMessage = err?.message || String(err);
      const attempts = Number(job.attempts || 0) + 1;
      const maxAttempts = Number(job.max_attempts || 5);

      if (attempts >= maxAttempts) {
        const { error: failureError } = await supabase
          .from("background_jobs")
          .update({
            status: "dead_letter",
            last_error: errorMessage,
            error_log: `${job.error_log || ""}\n[Final Failure]: ${errorMessage}`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.id)
          .eq("status", "running")
          .select("id")
          .single();

        if (failureError) throw new Error(`تعذر تسجيل فشل المهمة: ${failureError.message}`);
        const { error: deadLetterError } = await supabase.from("dead_letter_jobs").insert({
          job_id: job.id,
          company_id: job.company_id,
          job_type: job.job_type,
          payload: job.payload,
          failure_reason: errorMessage,
          attempts_made: attempts,
        });

        if (deadLetterError) throw new Error(`تعذر تسجيل المهمة المتعذرة: ${deadLetterError.message}`);
        deadLetterCount += 1;
      } else {
        const { error: failureError } = await supabase
          .from("background_jobs")
          .update({
            status: "failed",
            last_error: errorMessage,
            next_retry_at: new Date(Date.now() + 60000 * Math.pow(2, attempts)).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.id)
          .eq("status", "running")
          .select("id")
          .single();

        if (failureError) throw new Error(`تعذر تسجيل فشل المهمة: ${failureError.message}`);
        failedCount += 1;
      }
    }
  }

  return {
    ok: failedCount === 0 && deadLetterCount === 0,
    jobsProcessed,
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
      ok: (report.leaveAccrual?.every((result) => result.ok) ?? true) &&
        (report.attendanceRollup?.ok ?? true) && (report.queueWorker?.ok ?? true),
      executedAt: new Date().toISOString(),
      report,
    };
  });
