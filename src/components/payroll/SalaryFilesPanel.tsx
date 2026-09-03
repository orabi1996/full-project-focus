import React, { useCallback, useEffect, useRef, useState } from "react";
import { Upload, FileSpreadsheet, RefreshCw, Download, BadgeCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { exportToCSV } from "../../lib/utils/export-helpers";
import {
  listSalaryProfilesServer,
  upsertSalaryProfilesServer,
  type SalaryProfileRowInput,
} from "../../lib/business/salary.functions";

interface SalaryRow {
  employeeId: string;
  employeeName: string;
  employeeNo: string;
  effectiveFrom: string;
  basicSalary: number;
  housingAllowance: number;
  transportAllowance: number;
  otherAllowances: number;
  gosiRegistered: boolean;
}

const money = (value: number) => `${Math.round(value).toLocaleString("ar-EG")} ر.س`;

/** Parses an uploaded salary CSV (header row required). */
function parseCsv(text: string): SalaryProfileRowInput[] {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);
  if (lines.length < 2) throw new Error("الملف لا يحتوي على بيانات");

  const header = lines[0]!.split(",").map((h) => h.trim().toLowerCase());
  const index = (...names: string[]) => header.findIndex((h) => names.includes(h));

  const cEmp = index("employee_no", "الرقم الوظيفي", "employee");
  const cDate = index("effective_from", "تاريخ السريان", "date");
  const cBasic = index("basic_salary", "الاساسي", "الأساسي", "basic");
  const cHousing = index("housing_allowance", "السكن", "housing");
  const cTransport = index("transport_allowance", "النقل", "transport");
  const cOther = index("other_allowances", "بدلات اخرى", "بدلات أخرى", "other");
  const cGosi = index("gosi_registered", "التأمينات", "gosi");

  if (cEmp < 0 || cBasic < 0) {
    throw new Error("الملف يجب أن يحتوي على عمودي employee_no و basic_salary");
  }

  const num = (value?: string) => {
    const parsed = Number(String(value ?? "").replace(/[^\d.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  };

  return lines.slice(1).map((line) => {
    const cells = line.split(",").map((cell) => cell.trim());
    return {
      employeeRef: cells[cEmp] ?? "",
      effectiveFrom:
        cDate >= 0 && /^\d{4}-\d{2}-\d{2}$/.test(cells[cDate] ?? "")
          ? cells[cDate]!
          : new Date().toISOString().slice(0, 8) + "01",
      basicSalary: num(cells[cBasic]),
      housingAllowance: cHousing >= 0 ? num(cells[cHousing]) : 0,
      transportAllowance: cTransport >= 0 ? num(cells[cTransport]) : 0,
      otherAllowances: cOther >= 0 ? num(cells[cOther]) : 0,
      gosiRegistered: cGosi >= 0 ? !/^(0|no|false|لا)$/i.test(cells[cGosi] ?? "") : true,
    };
  });
}

export const SalaryFilesPanel: React.FC = () => {
  const [rows, setRows] = useState<SalaryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listSalaryProfilesServer();
      setRows(data as SalaryRow[]);
    } catch (error: any) {
      toast.error(error?.message ?? "تعذر قراءة ملفات الرواتب");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleFile = async (file: File) => {
    setBusy(true);
    try {
      const parsed = parseCsv(await file.text());
      const result: any = await upsertSalaryProfilesServer({ data: { rows: parsed } });
      toast.success(
        `تم رفع ${result.imported} ملف راتب${result.skipped?.length ? ` (تم تجاهل ${result.skipped.length} صف بدون مطابقة)` : ""}`,
      );
      await load();
    } catch (error: any) {
      toast.error(error?.message ?? "تعذر رفع الملف");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const totals = rows.reduce(
    (sum, row) => ({
      basic: sum.basic + row.basicSalary,
      allowances:
        sum.allowances + row.housingAllowance + row.transportAllowance + row.otherAllowances,
    }),
    { basic: 0, allowances: 0 },
  );

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            <div>
              <h3 className="font-bold text-sm">ملفات رواتب الموظفين الفعلية</h3>
              <p className="text-xs text-muted-foreground">
                يعتمد المسيّر وتقرير التوزيع على هذه الملفات بدل الأجر الافتراضي.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
              }}
            />
            <Button
              size="sm"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
              className="rounded-xl font-bold gap-1.5"
            >
              <Upload className="h-4 w-4" /> رفع ملف رواتب (CSV)
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="rounded-xl gap-1.5"
              onClick={() =>
                exportToCSV("salary-file-template", [
                  {
                    employee_no: "EMP-0142",
                    effective_from: new Date().toISOString().slice(0, 8) + "01",
                    basic_salary: 18500,
                    housing_allowance: 4625,
                    transport_allowance: 1850,
                    other_allowances: 0,
                    gosi_registered: 1,
                  },
                ])
              }
            >
              <Download className="h-4 w-4" /> نموذج الملف
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Stat label="عدد ملفات الرواتب" value={String(rows.length)} />
          <Stat label="إجمالي الأساسي" value={money(totals.basic)} />
          <Stat label="إجمالي البدلات" value={money(totals.allowances)} />
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th className="p-3 text-start">الموظف</th>
              <th className="p-3 text-start">تاريخ السريان</th>
              <th className="p-3 text-start">الأساسي</th>
              <th className="p-3 text-start">السكن</th>
              <th className="p-3 text-start">النقل</th>
              <th className="p-3 text-start">بدلات أخرى</th>
              <th className="p-3 text-start">الإجمالي</th>
              <th className="p-3 text-start">التأمينات</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.employeeId} className="border-t border-border/40">
                <td className="p-3 font-bold">
                  {row.employeeName}
                  <span className="block text-[10px] text-muted-foreground">{row.employeeNo}</span>
                </td>
                <td className="p-3">{row.effectiveFrom}</td>
                <td className="p-3">{money(row.basicSalary)}</td>
                <td className="p-3">{money(row.housingAllowance)}</td>
                <td className="p-3">{money(row.transportAllowance)}</td>
                <td className="p-3">{money(row.otherAllowances)}</td>
                <td className="p-3 font-bold">
                  {money(
                    row.basicSalary +
                      row.housingAllowance +
                      row.transportAllowance +
                      row.otherAllowances,
                  )}
                </td>
                <td className="p-3">
                  {row.gosiRegistered ? (
                    <Badge className="text-[10px] gap-1">
                      <BadgeCheck className="h-3 w-3" /> مسجّل
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px]">
                      غير مسجّل
                    </Badge>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="p-6 text-center text-muted-foreground">
                  لا توجد ملفات رواتب مرفوعة بعد
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
    <p className="text-[10px] text-muted-foreground font-bold">{label}</p>
    <p className="text-sm font-bold mt-1">{value}</p>
  </div>
);
