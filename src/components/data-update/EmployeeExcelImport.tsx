import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Upload, Download, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card";
import { importEmployeesFromExcel } from "../../lib/business/employee-import.functions";
import { IMPORT_COLUMNS, normalizeRowKeys, validateImportRows, type ImportRowInput } from "../../lib/business/employee-import-rules";

export function EmployeeExcelImport() {
  const importFn = useServerFn(importEmployeesFromExcel);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ImportRowInput[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ inserted: number; failed: number; errors: { row: number; message: string }[] } | null>(null);
  const [parseError, setParseError] = useState("");

  const preview = validateImportRows(rows);

  async function downloadTemplate() {
    const XLSX = await import("xlsx");
    const headers = IMPORT_COLUMNS.map((c) => (c.required ? `${c.ar} *` : c.ar));
    const sample = ["MX-900001", "محمد أحمد العتيبي", "محاسب", "المالية", "m.otaibi@example.com", "0551234567", "1012345678", "سعودي", "ذكر", "1990-05-14", "2026-01-01", "غير محدد", 8000, 10800, "SA0380000000608010167519", "مصرف الراجحي"];
    const ws = XLSX.utils.aoa_to_sheet([headers, sample]);
    ws["!cols"] = headers.map(() => ({ wch: 20 }));
    const wb = XLSX.utils.book_new();
    wb.Workbook = { Views: [{ RTL: true }] } as any;
    XLSX.utils.book_append_sheet(wb, ws, "الموظفين");
    XLSX.writeFile(wb, "نموذج_استيراد_الموظفين.xlsx");
  }

  async function onFile(file: File) {
    setResult(null);
    setParseError("");
    setFileName(file.name);
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      const mapped = json.map(normalizeRowKeys).filter((r) => Object.values(r).some((v) => String(v).trim() !== ""));
      if (!mapped.length) setParseError("لم يتم العثور على بيانات. استخدم النموذج الجاهز.");
      setRows(mapped);
    } catch {
      setParseError("تعذر قراءة الملف. تأكد أنه ملف إكسل (xlsx أو xls أو csv).");
      setRows([]);
    }
  }

  async function submit() {
    setBusy(true);
    try {
      setResult(await importFn({ data: { rows } }));
    } catch (e: any) {
      setResult({ inserted: 0, failed: rows.length, errors: [{ row: 0, message: e?.message ?? "تعذر الاستيراد" }] });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-black text-foreground">تحديث البيانات</h1>
        <p className="text-sm text-muted-foreground mt-1">إضافة موظفين دفعة واحدة من ملف إكسل.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>1. حمّل النموذج</CardTitle>
          <CardDescription>الأعمدة المعلّمة بـ * مطلوبة. يتم ربط القسم بالاسم إن وُجد في النظام.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={downloadTemplate} className="gap-2">
            <Download className="h-4 w-4" /> تحميل نموذج الإكسل
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. ارفع الملف</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-xl p-8 cursor-pointer hover:bg-muted/50">
            <Upload className="h-8 w-8 text-primary" />
            <span className="text-sm font-bold">{fileName || "اختر ملف إكسل"}</span>
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" aria-label="ملف الإكسل"
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          </label>
          {parseError && <p className="text-sm text-destructive">{parseError}</p>}

          {rows.length > 0 && (
            <>
              <div className="flex gap-4 text-sm">
                <span>إجمالي الصفوف: <b>{rows.length}</b></span>
                <span className="text-primary">صالحة: <b>{preview.valid.length}</b></span>
                <span className="text-destructive">بها أخطاء: <b>{preview.errors.length}</b></span>
              </div>
              {preview.errors.length > 0 && (
                <div className="max-h-48 overflow-auto rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs space-y-1">
                  {preview.errors.slice(0, 100).map((e) => (
                    <div key={e.row}>صف {e.row}: {e.message}</div>
                  ))}
                </div>
              )}
              <div className="overflow-auto max-h-72 border border-border rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-muted sticky top-0">
                    <tr>{["الرقم الوظيفي", "الاسم", "المسمى", "القسم", "تاريخ التعيين", "الراتب الأساسي"].map((h) => <th key={h} className="p-2 text-start">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {preview.valid.slice(0, 50).map((r) => (
                      <tr key={r.row} className="border-t border-border">
                        <td className="p-2">{String(r.record.employee_no)}</td>
                        <td className="p-2">{String(r.record.full_name)}</td>
                        <td className="p-2">{String(r.record.job_title)}</td>
                        <td className="p-2">{r.department || "—"}</td>
                        <td className="p-2">{String(r.record.hire_date)}</td>
                        <td className="p-2">{Number(r.record.basic_salary).toLocaleString("ar-SA")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button onClick={submit} disabled={busy || preview.valid.length === 0} className="gap-2">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                استيراد {preview.valid.length} موظف
              </Button>
            </>
          )}

          {result && (
            <div className="rounded-lg border border-border p-4 space-y-2">
              <div className="flex items-center gap-2 font-bold">
                {result.inserted > 0 ? <CheckCircle2 className="h-5 w-5 text-primary" /> : <AlertTriangle className="h-5 w-5 text-destructive" />}
                تمت إضافة {result.inserted} موظف، ولم يُضف {result.failed}.
              </div>
              {result.errors.slice(0, 50).map((e, i) => (
                <div key={i} className="text-xs text-destructive">{e.row ? `صف ${e.row}: ` : ""}{e.message}</div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
