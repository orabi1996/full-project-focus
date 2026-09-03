import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertRole, round2 } from "./guards";

const REPORT_ROLES = [
  "super_admin",
  "org_admin",
  "hr_manager",
  "payroll_officer",
  "finance_officer",
] as const;

/** One-shot monthly pack: payroll settlement, loans, attendance and payroll by department. */
export const getMonthlyReportServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { year: number; month: number }) => {
    if (!input?.year || !input?.month) throw new Error("حدّد الشهر والسنة");
    return input;
  })
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    await assertRole(supabase, context.userId, [...REPORT_ROLES]);

    const from = `${data.year}-${String(data.month).padStart(2, "0")}-01`;
    const toDate = new Date(Date.UTC(data.year, data.month, 0));
    const to = toDate.toISOString().slice(0, 10);

    const { data: run } = await supabase
      .from("payroll_runs")
      .select(
        "id, status, total_employees, total_basic_salary, total_allowances, total_deductions, total_net_salary, total_employer_gosi, paid_at, locked_at",
      )
      .eq("period_year", data.year)
      .eq("period_month", data.month)
      .maybeSingle();

    const [detailsRes, employeesRes, departmentsRes, attendanceRes, loansRes, paymentsRes] =
      await Promise.all([
        run
          ? supabase
              .from("payroll_details")
              .select(
                "employee_id, basic_salary, housing_allowance, transport_allowance, other_allowances, gosi_employee_deduction, gosi_employee, loan_deduction, loan_deductions, total_deductions, net_salary, working_days, absent_days",
              )
              .eq("payroll_run_id", run.id)
          : Promise.resolve({ data: [] }),
        supabase.from("employees").select("id, full_name, employee_no, department_id, status"),
        supabase.from("departments").select("id, name, code"),
        supabase
          .from("attendance_records")
          .select("employee_id, status, worked_hours, late_minutes, overtime_minutes, work_date")
          .gte("work_date", from)
          .lte("work_date", to),
        supabase
          .from("loans")
          .select(
            "employee_id, status, principal_amount, approved_amount, installment_amount, monthly_installment, outstanding_amount, remaining_balance",
          ),
        run
          ? supabase
              .from("payroll_payments")
              .select("net_amount, status, batch_no")
              .eq("payroll_run_id", run.id)
          : Promise.resolve({ data: [] }),
      ]);

    const details = detailsRes.data ?? [];
    const employees = employeesRes.data ?? [];
    const departments = departmentsRes.data ?? [];
    const attendance = attendanceRes.data ?? [];
    const loans = loansRes.data ?? [];
    const payments = paymentsRes.data ?? [];

    const employeeById = new Map(employees.map((e: any) => [e.id, e]));
    const departmentById = new Map(departments.map((d: any) => [d.id, d]));

    // Payroll grouped by department
    const byDept = new Map<string, any>();
    for (const detail of details) {
      const employee: any = employeeById.get(detail.employee_id);
      const deptId = employee?.department_id ?? "none";
      const dept: any = departmentById.get(deptId);
      const bucket = byDept.get(deptId) ?? {
        departmentId: deptId,
        departmentName: dept?.name ?? "بدون إدارة",
        employees: 0,
        basic: 0,
        allowances: 0,
        gosi: 0,
        loans: 0,
        deductions: 0,
        net: 0,
      };
      bucket.employees += 1;
      bucket.basic += Number(detail.basic_salary ?? 0);
      bucket.allowances +=
        Number(detail.housing_allowance ?? 0) +
        Number(detail.transport_allowance ?? 0) +
        Number(detail.other_allowances ?? 0);
      bucket.gosi += Number(detail.gosi_employee_deduction ?? detail.gosi_employee ?? 0);
      bucket.loans += Number(detail.loan_deduction ?? detail.loan_deductions ?? 0);
      bucket.deductions += Number(detail.total_deductions ?? 0);
      bucket.net += Number(detail.net_salary ?? 0);
      byDept.set(deptId, bucket);
    }

    // Attendance grouped by department
    const attendanceByDept = new Map<string, any>();
    for (const record of attendance) {
      const employee: any = employeeById.get(record.employee_id);
      const deptId = employee?.department_id ?? "none";
      const dept: any = departmentById.get(deptId);
      const bucket = attendanceByDept.get(deptId) ?? {
        departmentName: dept?.name ?? "بدون إدارة",
        present: 0,
        late: 0,
        absent: 0,
        leave: 0,
        hours: 0,
        overtimeHours: 0,
      };
      if (record.status === "absent") bucket.absent += 1;
      else if (record.status === "late") bucket.late += 1;
      else if (record.status === "leave") bucket.leave += 1;
      else bucket.present += 1;
      bucket.hours += Number(record.worked_hours ?? 0);
      bucket.overtimeHours += Number(record.overtime_minutes ?? 0) / 60;
      attendanceByDept.set(deptId, bucket);
    }

    const activeLoans = loans.filter((l: any) => l.status === "active");
    const approvedLoans = loans.filter((l: any) => l.status === "approved");
    const recoveredThisMonth = round2(
      details.reduce(
        (sum: number, d: any) => sum + Number(d.loan_deduction ?? d.loan_deductions ?? 0),
        0,
      ),
    );

    return {
      period: `${String(data.month).padStart(2, "0")}/${data.year}`,
      payroll: run
        ? {
            status: run.status,
            employees: run.total_employees,
            basic: round2(Number(run.total_basic_salary ?? 0)),
            allowances: round2(Number(run.total_allowances ?? 0)),
            deductions: round2(Number(run.total_deductions ?? 0)),
            net: round2(Number(run.total_net_salary ?? 0)),
            employerGosi: round2(Number(run.total_employer_gosi ?? 0)),
            paidAt: run.paid_at,
            lockedAt: run.locked_at,
            paidOut: round2(
              payments
                .filter((p: any) => p.status === "paid")
                .reduce((sum: number, p: any) => sum + Number(p.net_amount ?? 0), 0),
            ),
            pendingOut: round2(
              payments
                .filter((p: any) => p.status !== "paid")
                .reduce((sum: number, p: any) => sum + Number(p.net_amount ?? 0), 0),
            ),
            batchNo: payments.find((p: any) => p.batch_no)?.batch_no ?? null,
          }
        : null,
      byDepartment: [...byDept.values()]
        .map((row: any) => ({
          ...row,
          basic: round2(row.basic),
          allowances: round2(row.allowances),
          gosi: round2(row.gosi),
          loans: round2(row.loans),
          deductions: round2(row.deductions),
          net: round2(row.net),
        }))
        .sort((a: any, b: any) => b.net - a.net),
      attendanceByDepartment: [...attendanceByDept.values()].map((row: any) => ({
        ...row,
        hours: round2(row.hours),
        overtimeHours: round2(row.overtimeHours),
      })),
      attendanceTotals: {
        records: attendance.length,
        present: attendance.filter((r: any) => !["absent", "late", "leave"].includes(r.status))
          .length,
        late: attendance.filter((r: any) => r.status === "late").length,
        absent: attendance.filter((r: any) => r.status === "absent").length,
        leave: attendance.filter((r: any) => r.status === "leave").length,
        hours: round2(attendance.reduce((s: number, r: any) => s + Number(r.worked_hours ?? 0), 0)),
      },
      loans: {
        pendingCount: approvedLoans.length,
        pendingAmount: round2(
          approvedLoans.reduce(
            (s: number, l: any) => s + Number(l.approved_amount ?? l.principal_amount ?? 0),
            0,
          ),
        ),
        activeCount: activeLoans.length,
        outstanding: round2(
          activeLoans.reduce(
            (s: number, l: any) => s + Number(l.outstanding_amount ?? l.remaining_balance ?? 0),
            0,
          ),
        ),
        monthlyRecovery: round2(
          activeLoans.reduce(
            (s: number, l: any) => s + Number(l.installment_amount ?? l.monthly_installment ?? 0),
            0,
          ),
        ),
        recoveredThisMonth,
        rows: loans.map((l: any) => {
          const employee: any = employeeById.get(l.employee_id);
          return {
            employeeName: employee?.full_name ?? "—",
            employeeNo: employee?.employee_no ?? "—",
            status: l.status,
            amount: round2(Number(l.approved_amount ?? l.principal_amount ?? 0)),
            installment: round2(Number(l.installment_amount ?? l.monthly_installment ?? 0)),
            outstanding: round2(Number(l.outstanding_amount ?? l.remaining_balance ?? 0)),
          };
        }),
      },
    };
  });
