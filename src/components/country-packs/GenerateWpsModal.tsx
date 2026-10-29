// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PROMPT 34: GENERATE WPS BATCH MODAL
// src/components/country-packs/GenerateWpsModal.tsx
// ============================================================================

import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog";
import { Button } from "../ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { useGenerateWpsBatch } from "../../lib/data/country-packs-repository";
import { toast } from "sonner";
import { ShieldCheck, FileSpreadsheet, AlertTriangle } from "lucide-react";
import type { CountryCode } from "../../lib/domains/country-packs";

interface GenerateWpsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  payrollRuns: Array<{ id: string; period_start?: string; period_end?: string; status?: string }>;
}

export function GenerateWpsModal({
  open,
  onOpenChange,
  companyId,
  payrollRuns,
}: GenerateWpsModalProps) {
  const [selectedRunId, setSelectedRunId] = useState<string>(payrollRuns[0]?.id || "");
  const [countryCode, setCountryCode] = useState<CountryCode>("SA");
  const [fileFormat, setFileFormat] = useState<string>("txt");

  const generateMutation = useGenerateWpsBatch();

  const handleGenerate = async () => {
    if (!selectedRunId) {
      toast.error("يرجى اختيار مسير الرواتب المستهدف");
      return;
    }

    try {
      const res = await generateMutation.mutateAsync({
        companyId,
        payrollRunId: selectedRunId,
        countryCode,
        fileFormat,
      });

      if (res.validation_passed) {
        toast.success(`تم إنشاء دفعة حماية الأجور بنجاح برقم: ${res.batch_reference}`);
      } else {
        toast.warning(
          `تم إنشاء الدفعة برقم ${res.batch_reference} مع وجود ${res.validation_errors_count} تنبيهات/أخطاء يلزم تصحيحها قبل الإرسال البنكي.`
        );
      }
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "فشل إنشاء دفعة حماية الأجور");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            توليد دفعة حماية الأجور المعتمدة (WPS)
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-3">
          <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800 border border-amber-200 flex gap-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
            <div>
              <strong>تنبيه الامتثال البنكي:</strong> يقوم المحرك بفحص أرقام الآيبان وأرقام الهويات الوطنية والإقامات للموظفين قبل الاعتماد لضمان عدم رفض الملف من البنك المركزي أو منصة حماية الأجور.
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">
              الدولة المستهدفة
            </label>
            <Select value={countryCode} onValueChange={(val: any) => setCountryCode(val)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SA">🇸🇦 المملكة العربية السعودية (مدد / SAMA)</SelectItem>
                <SelectItem value="EG">🇪🇬 جمهورية مصر العربية (بطاقات الرواتب / CBE)</SelectItem>
                <SelectItem value="QA">🇶🇦 دولة قطر (مصرف قطر المركزي SIF)</SelectItem>
                <SelectItem value="OM">🇴🇲 سلطنة عمان (البنك المركزي العماني CBO)</SelectItem>
                <SelectItem value="BH">🇧🇭 مملكة البحرين (هيئة سوق العمل LMRA / CBB)</SelectItem>
                <SelectItem value="AE">🇦🇪 دولة الإمارات العربية المتحدة (مصرف الإمارات المركزي CBUAE)</SelectItem>
                <SelectItem value="KW">🇰🇼 دولة الكويت (بنك الكويت المركزي CBK)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">
              مسير الرواتب المعني
            </label>
            <Select value={selectedRunId} onValueChange={setSelectedRunId}>
              <SelectTrigger>
                <SelectValue placeholder="اختر مسير الرواتب" />
              </SelectTrigger>
              <SelectContent>
                {payrollRuns.length === 0 ? (
                  <SelectItem value="none" disabled>
                    لا توجد مسيرات رواتب متاحة
                  </SelectItem>
                ) : (
                  payrollRuns.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      مسير الفترة: {r.period_start || "---"} إلى {r.period_end || "---"} ({r.status || "مكتمل"})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">
              صيغة وتنسيق الملف
            </label>
            <Select value={fileFormat} onValueChange={setFileFormat}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="txt">ملف نصي بنكي موحد (.txt / SAMA)</SelectItem>
                <SelectItem value="sif">تنسيق معلومات الرواتب القياسي (.sif / Qatar)</SelectItem>
                <SelectItem value="csv">جدول بيانات مصرفي معتمد (.csv)</SelectItem>
                <SelectItem value="cbe_card">ملف كروت الرواتب المصرفية (.txt / Egypt)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={generateMutation.isPending || !selectedRunId || selectedRunId === "none"}
            className="gap-2"
          >
            <ShieldCheck className="h-4 w-4" />
            {generateMutation.isPending ? "جاري الفحص والتوليد..." : "فحص وتوليد الدفعة"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
