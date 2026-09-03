import React, { useMemo } from "react";
import { useApp } from "../../lib/context/AppContext";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import {
  Briefcase,
  CalendarDays,
  Wallet,
  Banknote,
  Clock,
  Palmtree,
  Building2,
} from "lucide-react";

const currency = (value: number) =>
  `${Number(value || 0).toLocaleString("ar-SA", { maximumFractionDigits: 2 })} ر.س`;

const attendanceStatusLabel: Record<string, string> = {
  present: "حاضر",
  late: "متأخر",
  absent: "غائب",
  leave: "إجازة",
  remote: "عن بُعد",
  holiday: "عطلة",
  rest_day: "راحة",
};

/**
 * Employee 360: a single screen that separates the employee's job data,
 * hire date, salary, loans, leaves and attendance.
 */
export const Employee360Summary: React.FC<{ employeeId: string }> = ({ employeeId }) => {
  const { employees, orgUnits, attendanceRecords, leaveBalances, loans, payrollDetails } = useApp();

  const employee = employees.find((e) => e.id === employeeId);

  const unit = useMemo(
    () => orgUnits.find((u: any) => u.id === employee?.departmentId),
    [orgUnits, employee?.departmentId],
  );

  const myAttendance = useMemo(
    () =>
      attendanceRecords
        .filter((r) => r.employeeId === employeeId)
        .sort((a, b) => b.workDate.localeCompare(a.workDate)),
    [attendanceRecords, employeeId],
  );

  const attendanceSummary = useMemo(() => {
    const sum = { present: 0, late: 0, absent: 0, leave: 0, overtimeHours: 0, lateMinutes: 0 };
    for (const record of myAttendance) {
      if (record.status === "present" || record.status === "remote") sum.present += 1;
      if (record.status === "late") sum.late += 1;
      if (record.status === "absent") sum.absent += 1;
      if (record.status === "leave") sum.leave += 1;
      sum.overtimeHours += record.overtimeHours ?? 0;
      sum.lateMinutes += record.lateMinutes ?? 0;
    }
    return sum;
  }, [myAttendance]);

  const myLoans = useMemo(() => loans.filter((l) => l.employeeId === employeeId), [loans, employeeId]);
  const myBalances = useMemo(
    () => leaveBalances.filter((b) => !b.employeeId || b.employeeId === employeeId),
    [leaveBalances, employeeId],
  );
  const lastPayslip = useMemo(
    () => payrollDetails.filter((d) => d.employeeId === employeeId).slice(-1)[0],
    [payrollDetails, employeeId],
  );

  if (!employee) {
    return <p className="p-6 text-sm text-muted-foreground">لا توجد بيانات لهذا الموظف</p>;
  }

  const serviceYears = employee.hireDate
    ? ((Date.now() - new Date(employee.hireDate).getTime()) / (1000 * 60 * 60 * 24 * 365.25)).toFixed(1)
    : "0";

  return (
    <div className="space-y-4">
      {/* Job & hire date */}
      <div className="grid gap-3 md:grid-cols-4">
        <Card className="rounded-2xl border-border/60">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-bold">
              <Briefcase className="h-3.5 w-3.5" /> الوظيفة
            </div>
            <div className="text-sm font-black">{employee.jobTitleAr}</div>
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Building2 className="h-3 w-3" />
              {unit?.nameAr ?? employee.departmentName ?? "—"}
              {unit?.level != null && (
                <Badge variant="secondary" className="rounded-full text-[10px]">
                  المستوى {unit.level}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/60">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-bold">
              <CalendarDays className="h-3.5 w-3.5" /> تاريخ التعيين
            </div>
            <div className="text-sm font-black" dir="ltr">
              {employee.hireDate || "—"}
            </div>
            <div className="text-[11px] text-muted-foreground">مدة الخدمة {serviceYears} سنة</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/60">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-bold">
              <Wallet className="h-3.5 w-3.5" /> الراتب
            </div>
            <div className="text-sm font-black">{currency(employee.totalSalary)}</div>
            <div className="text-[11px] text-muted-foreground">
              الأساسي {currency(employee.basicSalary)}
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/60">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-bold">
              <Banknote className="h-3.5 w-3.5" /> آخر صافي مستحق
            </div>
            <div className="text-sm font-black">
              {lastPayslip ? currency(lastPayslip.netSalary) : "لم يُحتسب بعد"}
            </div>
            {lastPayslip && (
              <div className="text-[11px] text-muted-foreground">
                خصومات {currency(lastPayslip.totalDeductions)}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Loans */}
        <Card className="rounded-2xl border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold">السلف والقروض</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {myLoans.length === 0 && (
              <p className="text-xs text-muted-foreground">لا توجد سلف مسجلة على الموظف</p>
            )}
            {myLoans.map((loan) => (
              <div
                key={loan.id}
                className="flex items-center justify-between rounded-xl border border-border/50 p-2.5"
              >
                <div>
                  <div className="text-xs font-bold">
                    {loan.loanType === "housing_advance"
                      ? "سلفة سكن"
                      : loan.loanType === "emergency"
                        ? "سلفة طارئة"
                        : "سلفة شخصية"}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    قسط شهري {currency(loan.monthlyInstallment)} — سُدد{" "}
                    {loan.paidInstallments}/{loan.totalInstallments}
                  </div>
                </div>
                <div className="text-left">
                  <div className="text-xs font-black">{currency(loan.remainingBalance)}</div>
                  <Badge variant="secondary" className="rounded-full text-[10px]">
                    {loan.status === "active" ? "جارية" : "منتهية"}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Leaves */}
        <Card className="rounded-2xl border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1.5 text-sm font-bold">
              <Palmtree className="h-4 w-4 text-emerald-600" /> أرصدة الإجازات
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {myBalances.length === 0 && (
              <p className="text-xs text-muted-foreground">لا توجد أرصدة إجازات</p>
            )}
            {myBalances.map((balance) => (
              <div
                key={balance.leaveTypeId}
                className="flex items-center justify-between rounded-xl border border-border/50 p-2.5"
              >
                <div className="text-xs font-bold">{balance.leaveTypeNameAr}</div>
                <div className="text-[11px] text-muted-foreground">
                  مستخدم {balance.usedDays} — محجوز {balance.reservedDays}
                </div>
                <Badge className="rounded-full bg-emerald-500/15 text-emerald-700 text-[11px]">
                  متاح {balance.availableBalance} يوم
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Attendance */}
      <Card className="rounded-2xl border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-1.5 text-sm font-bold">
            <Clock className="h-4 w-4 text-primary" /> سجل الحضور المرتبط بالراتب
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
            {[
              ["أيام الحضور", attendanceSummary.present],
              ["أيام التأخير", attendanceSummary.late],
              ["أيام الغياب", attendanceSummary.absent],
              ["أيام الإجازة", attendanceSummary.leave],
              ["ساعات إضافية", Number(attendanceSummary.overtimeHours.toFixed(1))],
            ].map(([label, value]) => (
              <div key={label as string} className="rounded-xl bg-muted/40 p-2.5 text-center">
                <div className="text-lg font-black">{value as number}</div>
                <div className="text-[11px] text-muted-foreground">{label as string}</div>
              </div>
            ))}
          </div>
          <div className="max-h-64 overflow-auto rounded-xl border border-border/50">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted/60 text-muted-foreground">
                <tr>
                  <th className="p-2 text-right font-bold">التاريخ</th>
                  <th className="p-2 text-right font-bold">دخول</th>
                  <th className="p-2 text-right font-bold">خروج</th>
                  <th className="p-2 text-right font-bold">الحالة</th>
                  <th className="p-2 text-right font-bold">تأخير (د)</th>
                  <th className="p-2 text-right font-bold">إضافي (س)</th>
                </tr>
              </thead>
              <tbody>
                {myAttendance.slice(0, 40).map((record) => (
                  <tr key={record.id} className="border-t border-border/50">
                    <td className="p-2" dir="ltr">
                      {record.workDate}
                    </td>
                    <td className="p-2" dir="ltr">
                      {record.actualIn ?? "—"}
                    </td>
                    <td className="p-2" dir="ltr">
                      {record.actualOut ?? "—"}
                    </td>
                    <td className="p-2">
                      {attendanceStatusLabel[record.status] ?? record.status}
                    </td>
                    <td className="p-2">{record.lateMinutes ?? 0}</td>
                    <td className="p-2">{record.overtimeHours ?? 0}</td>
                  </tr>
                ))}
                {myAttendance.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-muted-foreground">
                      لا توجد سجلات حضور لهذا الموظف
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
