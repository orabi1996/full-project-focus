// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PROMPT 29: ADD EMPLOYEE CERTIFICATION MODAL
// src/components/learning/EmployeeCertificationModal.tsx
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
import { toast } from "sonner";
import { ShieldCheck, CheckCircle2 } from "lucide-react";
import { createEmployeeCertification } from "../../lib/data/learning-repository";
import type { Certification } from "../../lib/domains/learning";

interface EmployeeCertificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  companyId: string;
  certificationsCatalog: Certification[];
  employees: Array<{ id: string; name: string; employeeNo?: string }>;
}

export const EmployeeCertificationModal: React.FC<EmployeeCertificationModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  companyId,
  certificationsCatalog,
  employees,
}) => {
  const [loading, setLoading] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [certificationId, setCertificationId] = useState("");
  const [certificateNumber, setCertificateNumber] = useState("");
  const [issuer, setIssuer] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId || !certificationId || !certificateNumber.trim() || !issuer.trim() || !issueDate) {
      toast.error("يرجى ملء جميع الحقول الإلزامية");
      return;
    }

    setLoading(true);
    try {
      const res = await createEmployeeCertification({
        companyId,
        employeeId,
        certificationId,
        certificateNumber: certificateNumber.trim(),
        issuer: issuer.trim(),
        issueDate,
        expiryDate: expiryDate || undefined,
      });

      if (!res.success) {
        toast.error(res.error || "فشل تسجيل الشهادة المهنية");
        return;
      }

      toast.success("تم تسجيل الشهادة المهنية بنجاح وهي قيد الاعتماد من الموارد البشرية");
      onSuccess();
      onClose();
    } catch {
      toast.error("حدث خطأ أثناء حفظ الشهادة");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">إضافة شهادة مهنية / رخصة لموظف</DialogTitle>
              <DialogDescription>
                تسجيل شهادة احترافية لتدقيقها وربطها بملف كفاءة الموظف
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div>
            <Label className="text-xs font-bold text-muted-foreground">الموظف *</Label>
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              required
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs"
            >
              <option value="">-- اختر الموظف --</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} {emp.employeeNo ? `(${emp.employeeNo})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label className="text-xs font-bold text-muted-foreground">الشهادة المهنية المعيارية *</Label>
            <select
              value={certificationId}
              onChange={(e) => {
                setCertificationId(e.target.value);
                const found = certificationsCatalog.find((c) => c.id === e.target.value);
                if (found && !issuer) {
                  setIssuer(found.issuer);
                }
              }}
              required
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs"
            >
              <option value="">-- اختر الشهادة من الدليل --</option>
              {certificationsCatalog.map((c) => (
                <option key={c.id} value={c.id}>
                  [{c.code}] {c.nameAr} — {c.issuer}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-bold text-muted-foreground">رقم الشهادة / الرخصة *</Label>
              <Input
                placeholder="PMP-1234567"
                value={certificateNumber}
                onChange={(e) => setCertificateNumber(e.target.value)}
                required
                className="mt-1 font-mono uppercase"
              />
            </div>
            <div>
              <Label className="text-xs font-bold text-muted-foreground">الجهة المانحة *</Label>
              <Input
                placeholder="مثال: PMI / SOCPA"
                value={issuer}
                onChange={(e) => setIssuer(e.target.value)}
                required
                className="mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-bold text-muted-foreground">تاريخ الإصدار *</Label>
              <Input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                required
                className="mt-1 font-mono"
              />
            </div>
            <div>
              <Label className="text-xs font-bold text-muted-foreground">تاريخ الانتهاء (إن وجد)</Label>
              <Input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="mt-1 font-mono"
              />
            </div>
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              إلغاء
            </Button>
            <Button type="submit" disabled={loading} className="gap-2">
              <CheckCircle2 className="h-4 w-4" />
              {loading ? "جاري الحفظ..." : "تسجيل الشهادة"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
