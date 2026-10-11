// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PROMPT 30: CAREER ASPIRATIONS & PREFERENCES MODAL (ESS/MSS PERMITTED)
// src/components/talent/CareerAspirationsModal.tsx
// ============================================================================

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { toast } from "sonner";
import { Compass, ShieldCheck } from "lucide-react";
import {
  fetchEmployeeCareerPreferences,
  upsertEmployeeCareerPreferences,
} from "../../lib/data/talent-repository";

interface CareerAspirationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  companyId: string;
  employeeId: string;
  employeeName: string;
}

export const CareerAspirationsModal: React.FC<CareerAspirationsModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  companyId,
  employeeId,
  employeeName,
}) => {
  const [loading, setLoading] = useState(false);
  const [targetJobFamily, setTargetJobFamily] = useState("");
  const [careerInterests, setCareerInterests] = useState("");
  const [developmentInterests, setDevelopmentInterests] = useState("");
  const [preferredLocation, setPreferredLocation] = useState("");
  const [willingToRelocate, setWillingToRelocate] = useState(false);
  const [internationalMobility, setInternationalMobility] = useState(false);
  const [isConfidentialFromManager, setIsConfidentialFromManager] = useState(false);

  useEffect(() => {
    if (isOpen && employeeId) {
      loadPreferences();
    }
  }, [isOpen, employeeId]);

  const loadPreferences = async () => {
    try {
      setLoading(true);
      const pref = await fetchEmployeeCareerPreferences(companyId, employeeId);
      if (pref) {
        setTargetJobFamily(pref.targetJobFamily || "");
        setCareerInterests(pref.careerInterests || "");
        setDevelopmentInterests(pref.developmentInterests || "");
        setPreferredLocation(pref.preferredLocation || "");
        setWillingToRelocate(pref.willingToRelocate || false);
        setInternationalMobility(pref.internationalMobility || false);
        setIsConfidentialFromManager(pref.isConfidentialFromManager || false);
      } else {
        setTargetJobFamily("");
        setCareerInterests("");
        setDevelopmentInterests("");
        setPreferredLocation("");
        setWillingToRelocate(false);
        setInternationalMobility(false);
        setIsConfidentialFromManager(false);
      }
    } catch {
      // Fallback to empty state
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await upsertEmployeeCareerPreferences({
        companyId,
        employeeId,
        targetJobFamily: targetJobFamily || null,
        careerInterests: careerInterests || null,
        developmentInterests: developmentInterests || null,
        preferredLocation: preferredLocation || null,
        willingToRelocate,
        internationalMobility,
        isConfidentialFromManager,
      });

      if (!res.success) {
        toast.error(res.error || "فشل حفظ التفضيلات المهنية");
        return;
      }

      toast.success("تم تحديث الطموحات والتفضيلات المهنية بنجاح");
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ غير متوقع");
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
              <Compass className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">الطموحات المهنية والتنقل الوظيفي</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                الموظف: {employeeName}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div>
            <Label className="text-xs font-semibold">المجال / العائلة الوظيفية المستهدفة</Label>
            <Input
              placeholder="مثال: القيادة التشغيلية، التحول الرقمي، الموارد البشرية"
              value={targetJobFamily}
              onChange={(e) => setTargetJobFamily(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label className="text-xs font-semibold">الاهتمامات المهنية والمناصب المنشودة</Label>
            <Textarea
              placeholder="وصف التطلعات الوظيفية، الأدوار التي يطمح الموظف للمساهمة فيها..."
              value={careerInterests}
              onChange={(e) => setCareerInterests(e.target.value)}
              className="mt-1 min-h-[70px]"
            />
          </div>

          <div>
            <Label className="text-xs font-semibold">اهتمامات التطوير واكتساب المهارات</Label>
            <Textarea
              placeholder="المهارات أو المعارف أو الشهادات التي يرغب الموظف في تنميتها..."
              value={developmentInterests}
              onChange={(e) => setDevelopmentInterests(e.target.value)}
              className="mt-1 min-h-[60px]"
            />
          </div>

          <div>
            <Label className="text-xs font-semibold">مقر العمل المفضل</Label>
            <Input
              placeholder="مثال: الرياض - المقر الرئيسي، جدة، العمل عن بعد"
              value={preferredLocation}
              onChange={(e) => setPreferredLocation(e.target.value)}
              className="mt-1"
            />
          </div>

          <div className="p-3 bg-muted/20 border rounded-lg space-y-2">
            <span className="text-xs font-bold block mb-1">الجاهزية للتنقل (Mobility Preferences)</span>

            <div className="flex items-center justify-between">
              <Label className="text-xs cursor-pointer" htmlFor="chk-relocate">
                الاستعداد للانتقال الجغرافي داخل المملكة
              </Label>
              <input
                id="chk-relocate"
                type="checkbox"
                checked={willingToRelocate}
                onChange={(e) => setWillingToRelocate(e.target.checked)}
                className="h-4 w-4 rounded-sm border-gray-300 text-primary"
              />
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-xs cursor-pointer" htmlFor="chk-intl">
                الاستعداد للتنقل والمهام الخارجية / الدولية
              </Label>
              <input
                id="chk-intl"
                type="checkbox"
                checked={internationalMobility}
                onChange={(e) => setInternationalMobility(e.target.checked)}
                className="h-4 w-4 rounded-sm border-gray-300 text-primary"
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="h-4 w-4 text-amber-500" />
                <Label className="text-xs cursor-pointer" htmlFor="chk-confidential">
                  إخفاء الطموحات عن المدير المباشر (حصري لإدارة المواهب)
                </Label>
              </div>
              <input
                id="chk-confidential"
                type="checkbox"
                checked={isConfidentialFromManager}
                onChange={(e) => setIsConfidentialFromManager(e.target.checked)}
                className="h-4 w-4 rounded-sm border-gray-300 text-primary"
              />
            </div>
          </div>

          <DialogFooter className="mt-4 gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              إلغاء
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "جاري الحفظ..." : "حفظ التفضيلات"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
