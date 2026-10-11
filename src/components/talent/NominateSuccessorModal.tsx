// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PROMPT 30: NOMINATE SUCCESSOR MODAL
// src/components/talent/NominateSuccessorModal.tsx
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
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { toast } from "sonner";
import { Award, AlertCircle } from "lucide-react";
import { nominateSuccessionCandidate } from "../../lib/data/talent-repository";
import type { SuccessionReadinessTimeline } from "../../lib/domains/talent";

interface NominateSuccessorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  companyId: string;
  planId: string;
  roleTitle: string;
  employees: Array<{ id: string; name: string; employeeNo: string }>;
}

export const NominateSuccessorModal: React.FC<NominateSuccessorModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  companyId,
  planId,
  roleTitle,
  employees,
}) => {
  const [loading, setLoading] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [readiness, setReadiness] = useState<SuccessionReadinessTimeline>("ready_1_year");
  const [ranking, setRanking] = useState<number>(1);
  const [reason, setReason] = useState("");
  const [isEmergency, setIsEmergency] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId) {
      toast.error("يرجى اختيار الموظف المرشح للتعاقب");
      return;
    }

    try {
      setLoading(true);
      const res = await nominateSuccessionCandidate({
        companyId,
        planId,
        employeeId,
        readiness,
        ranking,
        reason: reason || undefined,
        isEmergency,
      });

      if (!res.success) {
        toast.error(res.error || "فشل ترشيح الموظف لخطة التعاقب");
        return;
      }

      toast.success("تم ترشيح الموظف لخطة التعاقب بنجاح");
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
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Award className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">ترشيح خليفة لخطة التعاقب</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                الوظيفة المستهدفة: {roleTitle}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div>
            <Label className="text-xs font-semibold">الموظف المرشح (Candidate) *</Label>
            <select
              className="w-full mt-1 flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              required
            >
              <option value="">-- اختر الموظف --</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} ({emp.employeeNo})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold">أفق الجاهزية (Readiness) *</Label>
              <select
                className="w-full mt-1 flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
                value={readiness}
                onChange={(e) => setReadiness(e.target.value as SuccessionReadinessTimeline)}
              >
                <option value="ready_now">جاهز فوراً (Ready Now)</option>
                <option value="ready_1_year">جاهز خلال سنة (1 Year)</option>
                <option value="ready_2_years">جاهز خلال سنتين (2 Years)</option>
                <option value="ready_2_plus_years">جاهز بعد أكثر من سنتين</option>
                <option value="not_ready">غير جاهز حالياً</option>
              </select>
            </div>

            <div>
              <Label className="text-xs font-semibold">الترتيب في الخطة (Rank) *</Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={ranking}
                onChange={(e) => setRanking(Number(e.target.value))}
                className="mt-1"
                required
              />
            </div>
          </div>

          <div>
            <Label className="text-xs font-semibold">مبررات الترشيح ونقاط القوة</Label>
            <Textarea
              placeholder="الأسباب التي تدعم أهلية الموظف لهذا المنصب القيادي/الحرج..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1 min-h-[60px]"
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-muted/20 border rounded-lg">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-500" />
              <div>
                <Label htmlFor="chk-emergency" className="text-xs font-bold cursor-pointer">
                  خليفة طوارئ فوري (Emergency Successor)
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  يكلف بتسيير الأعمال في حال الشغور المفاجئ
                </p>
              </div>
            </div>
            <input
              id="chk-emergency"
              type="checkbox"
              checked={isEmergency}
              onChange={(e) => setIsEmergency(e.target.checked)}
              className="h-4 w-4 rounded-sm border-gray-300 text-primary"
            />
          </div>

          <DialogFooter className="mt-4 gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              إلغاء
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "جاري الترشيح..." : "تأكيد الترشيح"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
