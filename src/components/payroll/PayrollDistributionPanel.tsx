import React, { useMemo, useState } from "react";
import { Building2, Download, Layers, PieChart, Users } from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { exportToCSV } from "../../lib/utils/export-helpers";
import type { Employee, EmployeePayrollDetail, OrgUnit } from "../../types";

const UNIT_LEVEL_LABEL: Record<string, string> = {
  division: "قطاع تنفيذي",
  department: "إدارة عامة",
  section: "قسم",
  unit: "وحدة",
};

const LEVEL_ORDER: Record<string, number> = {
  division: 0,
  department: 1,
  section: 2,
  unit: 3,
};

// نسبة اشتراك صاحب العمل مقابل اشتراك الموظف في التأمينات (9.75% مقابل 11.75%)
const EMPLOYER_TO_EMPLOYEE_GOSI = 11.75 / 9.75;

export interface UnitPayrollRow {
  unitId: string;
  code: string;
  nameAr: string;
  level: string;
  levelLabel: string;
  parentName: string;
  headcount: number;
  basic: number;
  allowances: number;
  overtime: number;
  gross: number;
  gosiEmployee: number;
  gosiEmployer: number;
  deductions: number;
  net: number;
  employerCost: number;
  avgNet: number;
}

interface Props {
  orgUnits: OrgUnit[];
  employees: Employee[];
  details: EmployeePayrollDetail[];
  periodLabel: string;
  isEstimate: boolean;
}

const money = (value: number) =>
  `${Math.round(value).toLocaleString("ar-EG")} ر.س`;

export const PayrollDistributionPanel: React.FC<Props> = ({
  orgUnits,
  employees,
  details,
  periodLabel,
  isEstimate,
}) => {
  const [rollUp, setRollUp] = useState(true);

  const rows = useMemo<UnitPayrollRow[]>(() => {
    const unitById = new Map(orgUnits.map((unit) => [unit.id, unit]));
    const unitByName = new Map(orgUnits.map((unit) => [unit.nameAr, unit]));
    const employeeById = new Map(employees.map((employee) => [employee.id, employee]));

    const blank = (unit: OrgUnit): UnitPayrollRow => ({
      unitId: unit.id,
      code: unit.code,
      nameAr: unit.nameAr,
      level: unit.type,
      levelLabel: UNIT_LEVEL_LABEL[unit.type] ?? unit.type,
      parentName: unit.parentId ? (unitById.get(unit.parentId)?.nameAr ?? "—") : "المنشأة",
      headcount: 0,
      basic: 0,
      allowances: 0,
      overtime: 0,
      gross: 0,
      gosiEmployee: 0,
      gosiEmployer: 0,
      deductions: 0,
      net: 0,
      employerCost: 0,
      avgNet: 0,
    });

    const acc = new Map<string, UnitPayrollRow>();
    for (const unit of orgUnits) acc.set(unit.id, blank(unit));

    const add = (unitId: string | null | undefined, values: Partial<UnitPayrollRow>) => {
      if (!unitId) return;
      const row = acc.get(unitId);
      if (!row) return;
      row.headcount += values.headcount ?? 0;
      row.basic += values.basic ?? 0;
      row.allowances += values.allowances ?? 0;
      row.overtime += values.overtime ?? 0;
      row.gross += values.gross ?? 0;
      row.gosiEmployee += values.gosiEmployee ?? 0;
      row.gosiEmployer += values.gosiEmployer ?? 0;
      row.deductions += values.deductions ?? 0;
      row.net += values.net ?? 0;
    };

    const contribute = (unitId: string | null | undefined, values: Partial<UnitPayrollRow>) => {
      add(unitId, values);
      if (!rollUp) return;
      const seen = new Set<string>();
      let parentId = unitId ? unitById.get(unitId)?.parentId : null;
      while (parentId && !seen.has(parentId)) {
        seen.add(parentId);
        add(parentId, values);
        parentId = unitById.get(parentId)?.parentId ?? null;
      }
    };

    if (details.length > 0) {
      for (const detail of details) {
        const employee = employeeById.get(detail.employeeId);
        const unitId =
          (employee?.departmentId && unitById.has(employee.departmentId)
            ? employee.departmentId
            : unitByName.get(detail.departmentName)?.id) ?? null;
        const gosiEmployer = detail.gosiEmployeeDeduction * EMPLOYER_TO_EMPLOYEE_GOSI;
        contribute(unitId, {
          headcount: 1,
          basic: detail.basicSalary,
          allowances:
            detail.housingAllowance + detail.transportAllowance + detail.otherAllowances,
          overtime: detail.overtimeAmount,
          gross: detail.grossSalary,
          gosiEmployee: detail.gosiEmployeeDeduction,
          gosiEmployer,
          deductions: detail.totalDeductions,
          net: detail.netSalary,
        });
      }
    } else {
      for (const employee of employees) {
        if (employee.status === "terminated") continue;
        const basic = employee.basicSalary || 0;
        const total = employee.totalSalary || basic;
        const housing = Math.max(total - basic, 0);
        const gosiBase = Math.min(basic + housing, 45000);
        const gosiEmployee = gosiBase * 0.0975;
        const gosiEmployer = gosiBase * 0.1175;
        contribute(employee.departmentId, {
          headcount: 1,
          basic,
          allowances: housing,
          overtime: 0,
          gross: total,
          gosiEmployee,
          gosiEmployer,
          deductions: gosiEmployee,
          net: total - gosiEmployee,
        });
      }
    }

    return Array.from(acc.values())
      .map((row) => ({
        ...row,
        employerCost: row.gross + row.gosiEmployer,
        avgNet: row.headcount > 0 ? row.net / row.headcount : 0,
      }))
      .filter((row) => row.headcount > 0)
      .sort(
        (a, b) =>
          (LEVEL_ORDER[a.level] ?? 9) - (LEVEL_ORDER[b.level] ?? 9) || b.net - a.net,
      );
  }, [orgUnits, employees, details, rollUp]);

  const totals = useMemo(() => {
    const leaves = rows.filter((row) => row.level !== "division" || !rollUp);
    const base = rollUp
      ? rows.filter(
          (row) =>
            !orgUnits.find((unit) => unit.id === row.unitId)?.parentId ||
            !rows.some(
              (other) =>
                other.unitId === orgUnits.find((unit) => unit.id === row.unitId)?.parentId,
            ),
        )
      : leaves;
    return base.reduce(
      (sum, row) => ({
        headcount: sum.headcount + row.headcount,
        net: sum.net + row.net,
        gosiEmployer: sum.gosiEmployer + row.gosiEmployer,
        employerCost: sum.employerCost + row.employerCost,
      }),
      { headcount: 0, net: 0, gosiEmployer: 0, employerCost: 0 },
    );
  }, [rows, rollUp, orgUnits]);

  const maxNet = Math.max(...rows.map((row) => row.net), 1);

  const handleExport = () => {
    exportToCSV(
      `payroll-distribution-${periodLabel}`,
      rows.map((row) => ({
        "الكود": row.code,
        "الوحدة": row.nameAr,
        "المستوى": row.levelLabel,
        "الوحدة الأعلى": row.parentName,
        "عدد الموظفين": row.headcount,
        "الأساسي": Math.round(row.basic),
        "البدلات": Math.round(row.allowances),
        "الإضافي": Math.round(row.overtime),
        "الإجمالي": Math.round(row.gross),
        "تأمينات الموظف": Math.round(row.gosiEmployee),
        "تأمينات صاحب العمل": Math.round(row.gosiEmployer),
        "إجمالي الاستقطاعات": Math.round(row.deductions),
        "الصافي": Math.round(row.net),
        "تكلفة المنشأة": Math.round(row.employerCost),
      })),
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-black text-foreground flex items-center gap-2">
            <PieChart className="h-4 w-4 text-primary" />
            توزيع الرواتب والتأمينات حسب الهيكل التنظيمي
          </h3>
          <p className="text-xs text-muted-foreground font-medium mt-1">
            {isEstimate
              ? "تقدير مبني على رواتب الموظفين الحالية (لا يوجد مسير معتمد لهذه الفترة)"
              : `مبني على مسير ${periodLabel}`}
            {rollUp ? " • الأرقام مجمّعة تصاعديًا على الوحدات الأعلى" : " • أرقام كل وحدة على حدة"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-full text-xs font-bold h-9 px-4"
            onClick={() => setRollUp((value) => !value)}
          >
            <Layers className="h-4 w-4 text-primary" />
            {rollUp ? "عرض مباشر لكل وحدة" : "تجميع على الوحدات الأعلى"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full text-xs font-bold h-9 px-4"
            onClick={handleExport}
          >
            <Download className="h-4 w-4 text-primary" />
            تصدير CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "عدد الموظفين", value: `${totals.headcount}`, icon: Users },
          { label: "إجمالي الصافي", value: money(totals.net), icon: PieChart },
          { label: "تأمينات صاحب العمل", value: money(totals.gosiEmployer), icon: Building2 },
          { label: "التكلفة الكلية", value: money(totals.employerCost), icon: Layers },
        ].map((card) => (
          <div key={card.label} className="rounded-2xl border border-border/70 bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-[11px] font-bold">
              <card.icon className="h-3.5 w-3.5 text-primary" />
              {card.label}
            </div>
            <div className="text-sm font-black text-foreground mt-1.5">{card.value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-3xl border border-border/80 bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="text-right p-3 font-bold">الوحدة التنظيمية</th>
                <th className="text-right p-3 font-bold">المستوى</th>
                <th className="text-right p-3 font-bold">الموظفون</th>
                <th className="text-right p-3 font-bold">الأساسي</th>
                <th className="text-right p-3 font-bold">البدلات</th>
                <th className="text-right p-3 font-bold">تأمينات الموظف</th>
                <th className="text-right p-3 font-bold">تأمينات المنشأة</th>
                <th className="text-right p-3 font-bold">الصافي</th>
                <th className="text-right p-3 font-bold">الحصة</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.unitId} className="border-t border-border/60 hover:bg-muted/30">
                  <td className="p-3">
                    <div className="font-bold text-foreground">{row.nameAr}</div>
                    <div className="text-[10px] text-muted-foreground font-medium">
                      {row.code} • تتبع {row.parentName}
                    </div>
                  </td>
                  <td className="p-3">
                    <Badge variant="outline" className="rounded-full text-[10px] font-bold">
                      {row.levelLabel}
                    </Badge>
                  </td>
                  <td className="p-3 font-bold">{row.headcount}</td>
                  <td className="p-3">{money(row.basic)}</td>
                  <td className="p-3">{money(row.allowances)}</td>
                  <td className="p-3">{money(row.gosiEmployee)}</td>
                  <td className="p-3">{money(row.gosiEmployer)}</td>
                  <td className="p-3 font-black text-primary">{money(row.net)}</td>
                  <td className="p-3 w-40">
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.max((row.net / maxNet) * 100, 2)}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-muted-foreground font-medium mt-1">
                      متوسط الصافي {money(row.avgNet)}
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-muted-foreground font-medium">
                    لا توجد بيانات رواتب مرتبطة بوحدات الهيكل التنظيمي بعد
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
