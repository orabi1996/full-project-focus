// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PROMPT 30: CREATE TALENT POOL MODAL
// src/components/talent/CreateTalentPoolModal.tsx
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
import { Layers, ShieldCheck } from "lucide-react";
import { createTalentPool } from "../../lib/data/talent-repository";
import type { TalentPoolType } from "../../lib/domains/talent";

interface CreateTalentPoolModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  companyId: string;
}

export const CreateTalentPoolModal: React.FC<CreateTalentPoolModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  companyId,
}) => {
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [poolType, setPoolType] = useState<TalentPoolType>("high_potential");
  const [descriptionAr, setDescriptionAr] = useState("");
  const [descriptionEn, setDescriptionEn] = useState("");
  const [isConfidential, setIsConfidential] = useState(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !nameAr.trim() || !nameEn.trim()) {
      toast.error("يرجى إدخال رمز المجمع واسمه باللغتين العربية والإنجليزية");
      return;
    }

    try {
      setLoading(true);
      const res = await createTalentPool({
        companyId,
        code,
        nameAr,
        nameEn,
        poolType,
        descriptionAr: descriptionAr || undefined,
        descriptionEn: descriptionEn || undefined,
        isConfidential,
      });

      if (!res.success) {
        toast.error(res.error || "فشل إنشاء مجمع المواهب");
        return;
      }

      toast.success("تم إنشاء مجمع المواهب المؤسسي بنجاح");
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
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">إنشاء مجمع مواهب استراتيجي</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                تجميع الكفاءات والكوادر لإعدادهم للأدوار المستقبلية
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold">رمز المجمع (Code) *</Label>
              <Input
                placeholder="مثال: POOL-HIPO-26"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="mt-1 font-mono uppercase"
                required
              />
            </div>

            <div>
              <Label className="text-xs font-semibold">نوع المجمع *</Label>
              <select
                className="w-full mt-1 flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
                value={poolType}
                onChange={(e) => setPoolType(e.target.value as TalentPoolType)}
              >
                <option value="high_potential">مواهب واعدة (HiPo)</option>
                <option value="leadership">القيادات المستقبلية (Leadership)</option>
                <option value="future_managers">مدراء المستقبل (Future Managers)</option>
                <option value="technical">خبراء تقنيون وفنيون (Technical)</option>
                <option value="critical_operations">عمليات حرجة (Critical Ops)</option>
              </select>
            </div>
          </div>

          <div>
            <Label className="text-xs font-semibold">اسم المجمع (بالعربية) *</Label>
            <Input
              placeholder="مثال: مجمع القيادات الشابة والواعدة"
              value={nameAr}
              onChange={(e) => setNameAr(e.target.value)}
              className="mt-1"
              required
            />
          </div>

          <div>
            <Label className="text-xs font-semibold">اسم المجمع (بالإنجليزية) *</Label>
            <Input
              placeholder="e.g. Emerging Young Leaders Talent Pool"
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              className="mt-1"
              required
            />
          </div>

          <div>
            <Label className="text-xs font-semibold">الوصف ومعايير الانضمام</Label>
            <Textarea
              placeholder="شروط ومعايير اختيار أعضاء هذا المجمع..."
              value={descriptionAr}
              onChange={(e) => setDescriptionAr(e.target.value)}
              className="mt-1 min-h-[60px]"
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-muted/20 border rounded-lg">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <div>
                <Label htmlFor="chk-pool-conf" className="text-xs font-bold cursor-pointer">
                  مجمع سري ومحمي
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  رؤية الأعضاء محصورة بالموارد البشرية والإدارة التنفيذية
                </p>
              </div>
            </div>
            <input
              id="chk-pool-conf"
              type="checkbox"
              checked={isConfidential}
              onChange={(e) => setIsConfidential(e.target.checked)}
              className="h-4 w-4 rounded-sm border-gray-300 text-primary"
            />
          </div>

          <DialogFooter className="mt-4 gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              إلغاء
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "جاري الحفظ..." : "حفظ المجمع"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
