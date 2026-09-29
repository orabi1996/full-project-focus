import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { calculateEOSB, type SeparationType } from "../utils/eosb-calculator";
import { assertRole, round2 } from "./guards";

export type { SeparationType };

export interface SettlementInput {
  employeeId: string;
  terminationDate: string;
  separationType: SeparationType;
  unpaidLeaveDays?: number;
  notes?: string;
  noticePeriodServed?: boolean;
  assetClearanceComplete?: boolean;
}

export interface SettlementCalculationPreview {
  ok: boolean;
  employeeId: string;
  employeeNo: string;
  employeeName: string;
  hireDate: string;
  terminationDate: string;
  separationType: SeparationType;
  serviceYears: number;
  serviceMonths: number;
  serviceDays: number;
  totalServiceYearsDecimal: number;
  totalMonthlyWage: number;
  dailyRate: number;
  calculationBasis: string;
  grossEosb: number;
  resignationMultiplier: number;
  eosbAmount: number;
  leaveBalancePayoutDays: number;
  leavePayoutAmount: number;
  pendingSalaryAmount: number;
  loanDeductionAmount: number;
  netSettlementAmount: number;
  calculationSnapshot: Record<string, string | number | boolean | null>;
}

/**
 * Authoritative Server-Side Settlement Preview Calculation.
 * The browser never calculates money amounts; this server function provides the explainable preview.
 */
export const calculateSettlementServer = createServerFn({ method: "POST" })
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

    // Try authoritative RPC first
    const rpcRes = await supabase.rpc("calculate_final_settlement_atomic", {
      p_employee_id: data.employeeId,
      p_termination_date: data.terminationDate,
      p_separation_type: data.separationType,
      p_unpaid_leave_days: data.unpaidLeaveDays ?? 0,
    });

    if (!rpcRes.error && rpcRes.data?.ok) {
      const res = rpcRes.data;
      return {
        ok: true,
        employeeId: res.employee_id,
        employeeNo: res.employee_no,
        employeeName: res.employee_name,
        hireDate: res.hire_date,
        terminationDate: res.termination_date,
        separationType: res.separation_type,
        serviceYears: res.service_years,
        serviceMonths: res.service_months,
        serviceDays: res.service_days,
        totalServiceYearsDecimal: Number(res.total_service_years_decimal),
        totalMonthlyWage: Number(res.total_monthly_wage),
        dailyRate: Number(res.daily_rate),
        calculationBasis: res.calculation_basis,
        grossEosb: Number(res.gross_eosb),
        resignationMultiplier: Number(res.resignation_multiplier),
        eosbAmount: Number(res.eosb_amount),
        leaveBalancePayoutDays: Number(res.leave_balance_payout_days),
        leavePayoutAmount: Number(res.leave_payout_amount),
        pendingSalaryAmount: Number(res.pending_salary_amount || 0),
        loanDeductionAmount: Number(res.loan_deduction_amount),
        netSettlementAmount: Number(res.net_settlement_amount),
        calculationSnapshot: res.calculation_snapshot || {},
      };
    }

    // Fallback: Authoritative Server Computation with Database Date & Policy Semantics
    const { data: employee, error: empErr } = await supabase
      .from("employees")
      .select("id, company_id, employee_no, first_name_ar, last_name_ar, full_name, hire_date, basic_salary, housing_allowance, transport_allowance, total_salary")
      .eq("id", data.employeeId)
      .maybeSingle();
    if (empErr || !employee) throw new Error("تعذر قراءة بيانات الموظف المعتمدة من النظام");

    // Fetch effective compensation version
    const { data: compVersion } = await supabase
      .from("employee_compensation_versions")
      .select("*")
      .eq("employee_id", data.employeeId)
      .eq("status", "approved")
      .lte("effective_from", data.terminationDate)
      .order("effective_from", { ascending: false })
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    const basic = compVersion ? Number(compVersion.basic_salary) : Number(employee.basic_salary || 0);
    const housing = compVersion ? Number(compVersion.housing_allowance) : Number(employee.housing_allowance || 0);
    const transport = compVersion ? Number(compVersion.transport_allowance) : Number(employee.transport_allowance || 0);
    const totalWage = basic + housing + transport || Number(employee.total_salary || 0);

    if (totalWage <= 0) {
      throw new Error("تعذر احتساب مكافأة نهاية الخدمة: لا توجد حزمة راتب معتمدة للموظف");
    }

    // Read company payroll config for calculation basis
    const { data: config } = await supabase
      .from("company_payroll_configs")
      .select("calculation_basis, currency")
      .eq("company_id", employee.company_id)
      .maybeSingle();

    const calcBasis = config?.calculation_basis || "fixed_30_days";
    let dailyRate = totalWage / 30.0;
    if (calcBasis === "actual_days") {
      const parts = data.terminationDate.split("-");
      const daysInMonth = new Date(Number(parts[0]), Number(parts[1]), 0).getDate();
      dailyRate = totalWage / daysInMonth;
    } else if (calcBasis === "working_days_22") {
      dailyRate = totalWage / 22.0;
    }

    // Leave balance (Blocking exception if missing)
    const { data: balances, error: balErr } = await supabase
      .from("leave_balances")
      .select("accrued_days, used_days, reserved_days, carried_over_days")
      .eq("employee_id", data.employeeId);

    if (balErr || !balances || balances.length === 0) {
      throw new Error("تعذر احتساب مخالصة نهاية الخدمة: سجل رصيد الإجازات غير متوفر في النظام للموظف (Blocking Exception)");
    }

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
    const leavePayout = round2(unusedDays * dailyRate);

    // Active loans
    const { data: openLoans } = await supabase
      .from("loans")
      .select("outstanding_amount, remaining_balance")
      .eq("employee_id", data.employeeId)
      .eq("status", "active");

    const loanBalance = (openLoans ?? []).reduce(
      (sum: number, l: any) => sum + Number(l.remaining_balance ?? l.outstanding_amount ?? 0),
      0,
    );

    const eosb = calculateEOSB({
      totalMonthlyWage: totalWage,
      startDate: String(employee.hire_date).slice(0, 10),
      endDate: data.terminationDate,
      separationType: data.separationType,
      unpaidLeaveDays: data.unpaidLeaveDays ?? 0,
    });

    const net = round2(Math.max(0, eosb.finalEOSBAmount + leavePayout - loanBalance));

    const snapshot = {
      employee_id: employee.id,
      employee_no: employee.employee_no,
      hire_date: employee.hire_date,
      termination_date: data.terminationDate,
      separation_type: data.separationType,
      service_years: eosb.serviceYears,
      service_months: eosb.serviceMonths,
      total_service_years_decimal: eosb.totalServiceYearsDecimal,
      total_monthly_wage: totalWage,
      daily_rate: round2(dailyRate),
      calculation_basis: calcBasis,
      eosb_amount: eosb.finalEOSBAmount,
      unused_leave_days: unusedDays,
      leave_payout_amount: leavePayout,
      loan_deduction_amount: round2(loanBalance),
      net_settlement_amount: net,
      policy_version: "SA_LABOR_LAW_ARTICLES_84_85",
      calculated_at: new Date().toISOString(),
      calculated_by: context.userId,
    };

    return {
      ok: true,
      employeeId: employee.id,
      employeeNo: employee.employee_no || "",
      employeeName: `${employee.first_name_ar || ''} ${employee.last_name_ar || ''}`.trim() || employee.full_name,
      hireDate: employee.hire_date,
      terminationDate: data.terminationDate,
      separationType: data.separationType,
      serviceYears: eosb.serviceYears,
      serviceMonths: eosb.serviceMonths,
      serviceDays: 0,
      totalServiceYearsDecimal: eosb.totalServiceYearsDecimal,
      totalMonthlyWage: totalWage,
      dailyRate: round2(dailyRate),
      calculationBasis: calcBasis,
      grossEosb: eosb.finalEOSBAmount,
      resignationMultiplier: eosb.resignationMultiplier,
      eosbAmount: eosb.finalEOSBAmount,
      leaveBalancePayoutDays: unusedDays,
      leavePayoutAmount: leavePayout,
      pendingSalaryAmount: 0,
      loanDeductionAmount: round2(loanBalance),
      netSettlementAmount: net,
      calculationSnapshot: snapshot,
    };
  });

/**
 * Computes end-of-service benefit plus unused-leave payout from live records
 * and persists the settlement. Role-checked server-side.
 * The client cannot submit arbitrary monetary amounts.
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

    // Try authoritative RPC first
    const rpcRes = await supabase.rpc("create_final_settlement_atomic", {
      p_params: {
        employee_id: data.employeeId,
        termination_date: data.terminationDate,
        separation_type: data.separationType,
        notes: data.notes || null,
        notice_period_served: data.noticePeriodServed ?? true,
        asset_clearance_complete: data.assetClearanceComplete ?? false,
      },
    });

    if (!rpcRes.error && rpcRes.data?.ok) {
      return {
        settlementId: rpcRes.data.settlement_id,
        netSettlement: Number(rpcRes.data.net_settlement_amount),
        status: rpcRes.data.status,
      };
    }

    // Fallback: Perform server calculation and insert
    const calc = await (calculateSettlementServer as any)({ data, context });

    const { data: inserted, error: insertError } = await supabase
      .from("settlements")
      .insert({
        employee_id: data.employeeId,
        termination_date: data.terminationDate,
        separation_type: data.separationType,
        service_years: calc.serviceYears,
        service_months: calc.serviceMonths,
        eosb_amount: calc.eosbAmount,
        leave_balance_payout_days: calc.leaveBalancePayoutDays,
        leave_payout_amount: calc.leavePayoutAmount,
        loan_deduction_amount: calc.loanDeductionAmount,
        net_settlement_amount: calc.netSettlementAmount,
        notice_period_served: data.noticePeriodServed ?? true,
        asset_clearance_complete: data.assetClearanceComplete ?? false,
        calculation_snapshot: calc.calculationSnapshot,
        notes: data.notes || null,
        status: "draft",
      })
      .select("id")
      .single();

    if (insertError) throw new Error(`تعذر حفظ التسوية: ${insertError.message}`);

    return {
      settlementId: inserted.id,
      eosbAmount: calc.eosbAmount,
      leavePayout: calc.leavePayoutAmount,
      loanBalance: calc.loanDeductionAmount,
      netSettlement: calc.netSettlementAmount,
      serviceYears: calc.serviceYears,
      serviceMonths: calc.serviceMonths,
    };
  });
