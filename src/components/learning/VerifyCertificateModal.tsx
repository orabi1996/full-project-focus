// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PROMPT 29: VERIFY CERTIFICATE MODAL
// src/components/learning/VerifyCertificateModal.tsx
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
import { ShieldCheck, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { verifyEmployeeCertification } from "../../lib/data/learning-repository";
import type { EmployeeCertification } from "../../lib/domains/learning";

interface VerifyCertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  companyId: string;
  cert: EmployeeCertification | null;
  currentUserId: string;
}

export const VerifyCertificateModal: React.FC<VerifyCertificateModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  companyId,
  cert,
  currentUserId,
}) => {
  const [loading, setLoading] = useState(false);
  const [decision, setDecision] = useState<"verified" | "rejected" | "revoked">("verified");
  const [notes, setNotes] = useState("");

  if (!cert) return null;

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await verifyEmployeeCertification({
        companyId,
        certificationId: cert.id,
        verificationStatus: decision,
        verifiedBy: currentUserId,
        notes: notes.trim() || undefined,
      });

      if (!res.success) {
        toast.error(res.error || "فشل تدقيق الشهادة المهنية");
        return;
      }

      toast.success(
        decision === "verified"
          ? "تم التحقق من صحة الشهادة واعتمادها رسمياً"
          : decision === "rejected"
          ? "تم رفض الشهادة وإشعار الموظف"
          : "تم إلغاء صلاحية الشهادة"
      );
      onSuccess();
      onClose();
    } catch {
      toast.error("حدث خطأ أثناء تنفيذ الإجراء");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">تدقيق واعتماد الشهادة المهنية</DialogTitle>
              <DialogDescription>
                الموظف: <span className="font-bold text-foreground">{cert.employeeName}</span> — {cert.certificationNameAr}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleVerify} className="space-y-4 py-2">
          <div className="p-3 rounded-xl bg-secondary/40 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground font-semibold">رقم الشهادة:</span>
              <span className="font-mono font-bold">{cert.certificateNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground font-semibold">الجهة المانحة:</span>
              <span className="font-bold">{cert.issuer}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground font-semibold">تاريخ الانتهاء:</span>
              <span className="font-mono">{cert.expiryDate || "غير محدد / دائمة"}</span>
            </div>
          </div>

          <div>
            <Label className="text-xs font-bold text-muted-foreground">القرار التدقيقي *</Label>
            <div className="grid grid-cols-3 gap-2 mt-1">
              <button
                type="button"
                onClick={() => setDecision("verified")}
                className={`py-2 px-3 rounded-lg border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                  decision === "verified"
                    ? "bg-emerald-500/10 border-emerald-500 text-emerald-600 shadow-xs"
                    : "border-input hover:bg-secondary/50"
                }`}
              >
                <CheckCircle2 className="h-4 w-4" />
                اعتماد (Verify)
              </button>
              <button
                type="button"
                onClick={() => setDecision("rejected")}
                className={`py-2 px-3 rounded-lg border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                  decision === "rejected"
                    ? "bg-rose-500/10 border-rose-500 text-rose-600 shadow-xs"
                    : "border-input hover:bg-secondary/50"
                }`}
              >
                <XCircle className="h-4 w-4" />
                رفض (Reject)
              </button>
              <button
                type="button"
                onClick={() => setDecision("revoked")}
                className={`py-2 px-3 rounded-lg border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                  decision === "revoked"
                    ? "bg-amber-500/10 border-amber-500 text-amber-600 shadow-xs"
                    : "border-input hover:bg-secondary/50"
                }`}
              >
                <AlertTriangle className="h-4 w-4" />
                سحب (Revoke)
              </button>
            </div>
          </div>

          <div>
            <Label className="text-xs font-bold text-muted-foreground">ملاحظات التدقيق وأسباب القرار</Label>
            <Textarea
              rows={3}
              placeholder="تدوين ملاحظات التدقيق أو أسباب الرفض/السحب..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 resize-none"
            />
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              إلغاء
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className={`gap-2 ${
                decision === "rejected" ? "bg-rose-600 hover:bg-rose-700 text-white" : ""
              }`}
            >
              <ShieldCheck className="h-4 w-4" />
              {loading ? "جاري الحفظ..." : "تأكيد القرار التدقيقي"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
