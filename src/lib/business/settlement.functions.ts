import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { calculateEOSB, type SeparationType } from "../utils/eosb-calculator";
import { assertRole, round2 } from "./guards";

interface SettlementInput {
  employeeId: string;
  terminationDate: string;
  separationType: SeparationType;
  unpaidLeaveDays?: number;
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
    await assertRole(supabase, context.userId, [
      "super_admin",
      "org_admin",
      "hr_manager",
      "payroll_officer",
      "finance_officer",
    ]);

    const { data: employee, error } = await supabase
      .from("employees")
      .select("id, hire_date, basic_salary, total_salary")
      .eq("id", data.employeeId)
      .maybeSingle();
    if (error) throw new Error(`تعذر قراءة بيانات الموظف: ${error.message}`);
    if (!employee) throw new Error("الموظف غير موجود");

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
        Number(profile.other_allowances ?? 0)
      : Number(employee.total_salary ?? employee.basic_salary ?? 0);

    const eosb = calculateEOSB({
      totalMonthlyWage,
      startDate: String(employee.hire_date).slice(0, 10),
      endDate: data.terminationDate,
      separationType: data.separationType,
      unpaidLeaveDays: data.unpaidLeaveDays ?? 0,
    });

    const { data: balances } = await supabase
      .from("leave_balances")
      .select("accrued_days, used_days, reserved_days, carried_over_days")
      .eq("employee_id", data.employeeId);

    const unusedDays = (balances ?? []).reduce(
      (sum: number, b: any) =>
        sum +
        Math.max(
          0,
          Number(b.accrued_days ?? 0) +
            Number(b.carried_over_days ?? 0) -
            Number(b.used_days ?? 0) -
            Number(b.reserved_days ?? 0),
        ),
      0,
    );
    const dailyRate = totalMonthlyWage / 30;
    const leavePayout = round2(unusedDays * dailyRate);

    const { data: openLoans } = await supabase
      .from("loans")
      .select("outstanding_amount, remaining_balance")
      .eq("employee_id", data.employeeId)
      .eq("status", "active");
    const loanBalance = (openLoans ?? []).reduce(
      (sum: number, l: any) => sum + Number(l.outstanding_amount ?? l.remaining_balance ?? 0),
      0,
    );

    const net = round2(Math.max(0, eosb.finalEOSBAmount + leavePayout - loanBalance));

    const { data: inserted, error: insertError } = await supabase
      .from("settlements")
      .insert({
        employee_id: data.employeeId,
        termination_date: data.terminationDate,
        service_years: eosb.serviceYears,
        service_months: eosb.serviceMonths,
        eosb_amount: eosb.finalEOSBAmount,
        leave_payout_amount: leavePayout,
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
      loanBalance: round2(loanBalance),
      netSettlement: net,
      serviceYears: eosb.serviceYears,
      serviceMonths: eosb.serviceMonths,
    };
  });
