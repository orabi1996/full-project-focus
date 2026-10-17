/**
 * Employee AI Summary Panel
 * HR-only: pick an employee and generate an AI-powered operational summary.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileText, Sparkles, UserSearch, Loader2, ShieldCheck } from "lucide-react";
import {
  generateEmployeeAiSummary,
  listEmployeesForSummary,
} from "../../lib/business/employee-ai-summary.functions";
import { toast } from "sonner";

interface SummaryResult {
  summary: string;
  employeeName: string;
  employeeNo: string;
  model: string;
  generatedAt: string;
}

export function EmployeeAiSummaryPanel() {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [result, setResult] = useState<SummaryResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const listFn = useServerFn(listEmployeesForSummary);
  const generateFn = useServerFn(generateEmployeeAiSummary);

  const { data: employees, isLoading, isError } = useQuery({
    queryKey: ["employee-ai-summary", "employees"],
    queryFn: () => listFn(),
    staleTime: 60000,
  });

  const handleGenerate = async () => {
    if (!selectedEmployeeId) {
      toast.error("يرجى اختيار الموظف أولاً");
      return;
    }
    setIsGenerating(true);
    setResult(null);
    try {
      const res = await generateFn({ data: { employeeId: selectedEmployeeId } });
      setResult(res as SummaryResult);
      toast.success("تم إنشاء الملخص الذكي بنجاح");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذر إنشاء الملخص الذكي");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="bg-card rounded-2xl border shadow-xs p-6 space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-foreground">ملخص الموظف الذكي</h2>
            <p className="text-xs text-muted-foreground">
              ملخص عملي فوري لأهم بيانات الموظف عبر نموذج الذكاء الاصطناعي — متاح لمسؤولي الموارد البشرية
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary">
          <ShieldCheck className="h-3.5 w-3.5" />
          بيانات رسمية من سجلات النظام فقط
        </span>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <UserSearch className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <select
            value={selectedEmployeeId}
            onChange={(e) => setSelectedEmployeeId(e.target.value)}
            disabled={isLoading || isError}
            className="w-full h-11 ps-9 pe-3 rounded-xl border bg-background text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
          >
            <option value="">
              {isLoading
                ? "جاري تحميل قائمة الموظفين..."
                : isError
                  ? "تعذر تحميل القائمة — تحقق من صلاحياتك"
                  : "اختر ملف الموظف..."}
            </option>
            {(employees ?? []).map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.full_name} — {emp.employee_no} ({emp.job_title})
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={handleGenerate}
          disabled={!selectedEmployeeId || isGenerating}
          className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isGenerating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {isGenerating ? "جاري إنشاء الملخص..." : "إنشاء الملخص الذكي"}
        </button>
      </div>

      {result && (
        <div className="rounded-xl border bg-secondary/40 p-5 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="text-sm font-black text-foreground">
              الملخص العملي: {result.employeeName} ({result.employeeNo})
            </h3>
            <span className="text-[10px] text-muted-foreground font-medium">
              {new Date(result.generatedAt).toLocaleString("ar-SA")}
            </span>
          </div>
          <div className="text-sm leading-7 text-foreground whitespace-pre-wrap">
            {result.summary}
          </div>
        </div>
      )}
    </div>
  );
}
