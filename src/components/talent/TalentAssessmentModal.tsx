// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PROMPT 30: TALENT ASSESSMENT & 9-BOX CALIBRATION MODAL
// src/components/talent/TalentAssessmentModal.tsx
// ============================================================================

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { toast } from "sonner";
import { Grid, Sparkles, AlertTriangle } from "lucide-react";
import { assessAndCalibrateTalent } from "../../lib/data/talent-repository";
import {
  mapPerformancePotentialToNineBox,
  getNineBoxCellInfo,
  type PerformanceRatingLevel,
  type PotentialRatingLevel,
  type RetentionRiskLevel,
  type PromotionReadinessLevel,
  type TalentReviewCycle,
} from "../../lib/domains/talent";

interface TalentAssessmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  companyId: string;
  cycles: TalentReviewCycle[];
  employeeId: string;
  employeeName: string;
  initialPerformance?: PerformanceRatingLevel;
  initialPotential?: PotentialRatingLevel;
  isCalibration?: boolean;
}

export const TalentAssessmentModal: React.FC<TalentAssessmentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  companyId,
  cycles,
  employeeId,
  employeeName,
  initialPerformance = "medium",
  initialPotential = "medium",
  isCalibration = false,
}) => {
  const [loading, setLoading] = useState(false);
  const [cycleId, setCycleId] = useState(cycles[0]?.id || "");
  const [performance, setPerformance] = useState<PerformanceRatingLevel>(initialPerformance);
  const [potential, setPotential] = useState<PotentialRatingLevel>(initialPotential);
  const [retentionRisk, setRetentionRisk] = useState<RetentionRiskLevel>("low");
  const [readiness, setReadiness] = useState<PromotionReadinessLevel>("ready_1_year");
  const [notes, setNotes] = useState("");

  const cellCode = mapPerformancePotentialToNineBox(performance, potential);
  const cellInfo = getNineBoxCellInfo(cellCode);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cycleId) {
      toast.error("يرجى اختيار دورة مراجعة المواهب");
      return;
    }

    try {
      setLoading(true);
      const res = await assessAndCalibrateTalent({
        companyId,
        cycleId,
        employeeId,
        performanceRating: performance,
        potentialRating: potential,
        isCalibration,
        notes: notes || undefined,
        retentionRisk,
        readiness,
      });

      if (!res.success) {
        toast.error(res.error || "فشل تقييم الموهبة");
        return;
      }

      toast.success(
        isCalibration
          ? "تمت معايرة وتقييم الموهبة وتحديث خلية 9-Box بنجاح"
          : "تم حفظ تقييم الموهبة وتحديد موضع 9-Box بنجاح"
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ أثناء معالجة التقييم");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Grid className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">
                {isCalibration ? "معايرة مصفوفة المواهب (Calibration 9-Box)" : "تقييم الإمكانيات ومصفوفة 9-Box"}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                الموظف: {employeeName}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div>
            <Label className="text-xs font-semibold">دورة مراجعة المواهب (Review Cycle) *</Label>
            <select
              className="w-full mt-1 flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
              value={cycleId}
              onChange={(e) => setCycleId(e.target.value)}
              required
            >
              {cycles.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.titleAr} ({c.year}) - {c.status}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold">مستوى الأداء الفعلي (Performance) *</Label>
              <select
                className="w-full mt-1 flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
                value={performance}
                onChange={(e) => setPerformance(e.target.value as PerformanceRatingLevel)}
              >
                <option value="high">مرتفع (High) - يفوق التوقعات</option>
                <option value="medium">متوسط (Medium) - يلبي التوقعات</option>
                <option value="low">منخفض (Low) - دون التوقعات</option>
              </select>
            </div>

            <div>
              <Label className="text-xs font-semibold">مستوى الإمكانيات والنمو (Potential) *</Label>
              <select
                className="w-full mt-1 flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
                value={potential}
                onChange={(e) => setPotential(e.target.value as PotentialRatingLevel)}
              >
                <option value="high">مرتفع (High) - قدرات قيادية ونمو استثنائي</option>
                <option value="medium">متوسط (Medium) - نمو مطرد ومستقر</option>
                <option value="low">منخفض (Low) - محدود بالدور الحالي</option>
              </select>
            </div>
          </div>

          {/* 9-Box Calculated Position */}
          <div className="p-3.5 rounded-lg border bg-card flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary mt-0.5">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="space-y-1 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground">موضع الخلية المحسوب:</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-mono font-bold ${cellInfo.colorClass}`}>
                  الخلية {cellInfo.code}: {cellInfo.titleAr}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{cellInfo.descriptionAr}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold">مخاطر فقدان الموظف (Retention Risk)</Label>
              <select
                className="w-full mt-1 flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
                value={retentionRisk}
                onChange={(e) => setRetentionRisk(e.target.value as RetentionRiskLevel)}
              >
                <option value="low">منخفضة (Low)</option>
                <option value="medium">متوسطة (Medium)</option>
                <option value="high">مرتفعة (High)</option>
                <option value="critical">حرجة جداً (Critical)</option>
              </select>
            </div>

            <div>
              <Label className="text-xs font-semibold">الجاهزية للترقية (Readiness)</Label>
              <select
                className="w-full mt-1 flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
                value={readiness}
                onChange={(e) => setReadiness(e.target.value as PromotionReadinessLevel)}
              >
                <option value="ready_now">جاهز فوراً (Ready Now)</option>
                <option value="ready_1_year">جاهز خلال سنة (1 Year)</option>
                <option value="ready_2_years">جاهز خلال سنتين (2 Years)</option>
                <option value="not_ready">يحتاج تطوير أطول (Not Ready)</option>
              </select>
            </div>
          </div>

          <div>
            <Label className="text-xs font-semibold">
              {isCalibration ? "مبررات المعايرة وملاحظات لجنة المواهب" : "ملاحظات التقييم والتوصيات التطويرية"}
            </Label>
            <Textarea
              placeholder="شرح وتوثيق أسباب التصنيف، قرارات لجنة المراجعة..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 min-h-[60px]"
            />
          </div>

          {isCalibration && (
            <div className="p-2.5 rounded-md bg-amber-500/10 border border-amber-500/30 flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                سيتم حفظ التقييم الأصلي في سجل التدقيق وتحديث التقييم المعتمد مع توثيق هوية المحكم وتاريخ المعايرة.
              </span>
            </div>
          )}

          <DialogFooter className="mt-4 gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              إلغاء
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "جاري الحفظ..." : isCalibration ? "تأكيد المعايرة" : "حفظ التقييم"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
