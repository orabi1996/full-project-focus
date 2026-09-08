import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { calculateEOSB, type SeparationType } from "../utils/eosb-calculator";
import { availableLeaveDays, calculateSettlementNet } from "../utils/settlement-calculator";
import { assertRole, round2 } from "./guards";
import type { FinalSettlementRecord } from "../../types";

interface SettlementInput {
  employeeId: string;
  terminationDate: string;
  separationType: SeparationType;
  unpaidLeaveDays?: number;
  pendingSalaryAmount?: number;
  noticePeriodServed?: boolean;
  assetClearanceComplete?: boolean;
  eosbNotes?: string;
}

const SETTLEMENT_ROLES = [
  "super_admin",
  "org_admin",
  "hr_manager",
  "payroll_officer",
  "finance_officer",
] as const;

function nonNegativeMoney(value: unknown, label: string) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount) || amount < 0) throw new Error(`${label} غير صالح`);
  return round2(amount);
}

function otherAllowancesTotal(value: unknown) {
  if (Array.isArray(value)) {
    return value.reduce((sum, item) => {
      if (typeof item === "number") return sum + item;
      if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;
        return sum + Number(record.amount ?? record.value ?? 0);
      }
      return sum;
    }, 0);
  }
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).reduce<number>(
      (sum, item) => sum + Number(item ?? 0),
      0,
    );
  }
  return Number(value ?? 0);
}

/**
 * Computes end-of-service benefit plus unused-leave payout from live records
 * and persists the settlement. Role-checked server-side.
 */
export const createSettlementServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: SettlementInput) => {
    if (!input.employeeId) throw new Error("الموظف مطلوب");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.terminationDate)) throw new Error("تاريخ غير صالح");
    return input;
  })
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    await assertRole(supabase, context.userId, [...SETTLEMENT_ROLES]);

    const pendingSalaryAmount = nonNegativeMoney(data.pendingSalaryAmount, "مبلغ الراتب المتبقي");
    const unpaidLeaveDays = nonNegativeMoney(data.unpaidLeaveDays, "أيام الإجازة غير المدفوعة");

    const { data: employee, error } = await supabase
      .from("employees")
      .select("id, full_name, hire_date, basic_salary, total_salary, status")
      .eq("id", data.employeeId)
      .maybeSingle();
    if (error) throw new Error(`تعذر قراءة بيانات الموظف: ${error.message}`);
    if (!employee) throw new Error("الموظف غير موجود");
    if (!employee.hire_date) throw new Error("تاريخ مباشرة الموظف غير مسجل");

    const { data: existing, error: existingError } = await supabase
      .from("settlements")
      .select("id, status")
      .eq("employee_id", data.employeeId)
      .eq("termination_date", data.terminationDate)
      .in("status", ["draft", "pending_approval", "approved"])
      .limit(1)
      .maybeSingle();
    if (existingError) throw new Error(`تعذر التحقق من المخالصات السابقة: ${existingError.message}`);
    if (existing) throw new Error("توجد مخالصة غير منتهية لهذا الموظف في نفس التاريخ");

    const { data: profile } = await supabase
      .from("salary_profiles")
      .select("basic_salary, housing_allowance, transport_allowance, other_allowances")
      .eq("employee_id", data.employeeId)
      .lte("effective_from", data.terminationDate)
      .order("effective_from", { ascending: false })
      .limit(1)
      .maybeSingle();

    const totalMonthlyWage = profile
      ? Number(profile.basic_salary ?? 0) +
        Number(profile.housing_allowance ?? 0) +
        Number(profile.transport_allowance ?? 0) +
        otherAllowancesTotal(profile.other_allowances)
      : Number(employee.total_salary ?? employee.basic_salary ?? 0);

    const eosb = calculateEOSB({
      totalMonthlyWage: nonNegativeMoney(totalMonthlyWage, "الأجر الشهري"),
      startDate: String(employee.hire_date).slice(0, 10),
      endDate: data.terminationDate,
      separationType: data.separationType,
      unpaidLeaveDays,
    });

    const { data: balances } = await supabase
      .from("leave_balances")
      .select("accrued_days, used_days, reserved_days, carried_over_days")
      .eq("employee_id", data.employeeId);

    const unusedDays = (balances ?? []).reduce(
      (sum: number, b: Parameters<typeof availableLeaveDays>[0]) => sum + availableLeaveDays(b),
      0,
    );
    const leavePayoutDays = round2(unusedDays);
    const dailyRate = totalMonthlyWage / 30;
    const leavePayout = round2(leavePayoutDays * dailyRate);

    const { data: openLoans } = await supabase
      .from("loans")
      .select("outstanding_amount, remaining_balance")
      .eq("employee_id", data.employeeId)
      .eq("status", "active");
    const loanBalance = round2((openLoans ?? []).reduce(
      (sum: number, l: any) => sum + Number(l.outstanding_amount ?? l.remaining_balance ?? 0),
      0,
    ));

    const net = round2(
      calculateSettlementNet({
        eosbAmount: eosb.finalEOSBAmount,
        leavePayoutAmount: leavePayout,
        pendingSalaryAmount,
        loanDeductionAmount: loanBalance,
      }),
    );

    const { data: inserted, error: insertError } = await supabase
      .from("settlements")
      .insert({
        employee_id: data.employeeId,
        termination_date: data.terminationDate,
        service_years: eosb.serviceYears,
        service_months: eosb.serviceMonths,
        eosb_amount: eosb.finalEOSBAmount,
        notice_period_served: data.noticePeriodServed ?? false,
        leave_payout_days: leavePayoutDays,
        leave_payout_amount: leavePayout,
        pending_salary_amount: pendingSalaryAmount,
        loan_deduction_amount: loanBalance,
        asset_clearance_complete: data.assetClearanceComplete ?? false,
        eosb_notes: data.eosbNotes?.trim() || null,
        net_settlement_amount: net,
        status: "draft",
      })
      .select("id")
      .single();
    if (insertError) throw new Error(`تعذر حفظ التسوية: ${insertError.message}`);

    return {
      settlementId: inserted.id,
      eosbAmount: eosb.finalEOSBAmount,
      leavePayout,
      leavePayoutDays,
      pendingSalaryAmount,
      loanBalance,
      netSettlement: net,
      serviceYears: eosb.serviceYears,
      serviceMonths: eosb.serviceMonths,
      status: "draft" as const,
    };
  });

/** Moves a settlement through the controlled draft/approval/payment lifecycle. */
export const updateSettlementStatusServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      settlementId: string;
      status: FinalSettlementRecord["status"];
      paymentReference?: string;
      assetClearanceComplete?: boolean;
    }) => {
      if (!input?.settlementId) throw new Error("معرّف المخالصة مطلوب");
      if (!["draft", "pending_approval", "approved", "paid"].includes(input.status)) {
        throw new Error("حالة المخالصة غير صالحة");
      }
      if (input.paymentReference && input.paymentReference.trim().length > 120) {
        throw new Error("مرجع الصرف طويل جدًا");
      }
      return {
        ...input,
        paymentReference: input.paymentReference?.trim() || null,
      };
    },
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    await assertRole(supabase, context.userId, [...SETTLEMENT_ROLES]);
    const { data: result, error } = await supabase.rpc("set_settlement_status_atomic", {
      p_settlement_id: data.settlementId,
      p_status: data.status,
      p_payment_reference: data.paymentReference,
      p_asset_clearance_complete: data.assetClearanceComplete ?? null,
    });
    if (error) throw new Error(`تعذر تحديث حالة المخالصة: ${error.message}`);
    return result;
  });
