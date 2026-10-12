// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PROMPT 31: SEND EMPLOYEE RECOGNITION & APPRECIATION MODAL
// src/components/engagement/SendRecognitionModal.tsx
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
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { toast } from "sonner";
import { Heart, Sparkles, Award } from "lucide-react";
import {
  fetchRecognitionCategories,
  fetchRecognitionBadges,
  sendEmployeeRecognition,
} from "../../lib/data/engagement-repository";
import type { RecognitionCategory, RecognitionBadge } from "../../lib/domains/engagement";

interface SendRecognitionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  companyId: string;
  senderId: string;
  employees: Array<{ id: string; name: string; employeeNo?: string }>;
}

export const SendRecognitionModal: React.FC<SendRecognitionModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  companyId,
  senderId,
  employees,
}) => {
  const [loading, setLoading] = useState(false);
  const [recipientId, setRecipientId] = useState("");
  const [categories, setCategories] = useState<RecognitionCategory[]>([]);
  const [badges, setBadges] = useState<RecognitionBadge[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedBadge, setSelectedBadge] = useState<string>("");
  const [message, setMessage] = useState("");
  const [visibility, setVisibility] = useState<string>("company");

  useEffect(() => {
    if (isOpen && companyId) {
      loadData();
    }
  }, [isOpen, companyId]);

  const loadData = async () => {
    try {
      const [cats, bdgs] = await Promise.all([
        fetchRecognitionCategories(companyId),
        fetchRecognitionBadges(companyId),
      ]);
      setCategories(cats);
      setBadges(bdgs);
      if (cats.length > 0) setSelectedCategory(cats[0].id);
      if (bdgs.length > 0) setSelectedBadge(bdgs[0].id);
    } catch (err: any) {
      console.warn("Error loading recognition categories/badges:", err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientId) {
      toast.error("يرجى اختيار الزميل المراد تكريمه");
      return;
    }
    if (recipientId === senderId) {
      toast.error("لا يمكن إرسال شكر وتقدير لنفسك");
      return;
    }
    if (!message.trim()) {
      toast.error("يرجى كتابة رسالة الشكر والتقدير");
      return;
    }

    try {
      setLoading(true);
      await sendEmployeeRecognition(
        companyId,
        senderId,
        recipientId,
        selectedCategory || null,
        selectedBadge || null,
        message,
        visibility
      );

      toast.success("تم إرسال بطاقة الشكر والتقدير بنجاح ونشرها في حائط التقدير");
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ أثناء إرسال التقدير");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2 text-amber-600">
            <Heart className="h-5 w-5 fill-amber-500" />
            <DialogTitle>إرسال بطاقة شكر وتقدير لزميل</DialogTitle>
          </div>
          <DialogDescription>
            شارك زملاءك مشاعر الامتنان وعزز ثقافة التقدير والإيجابية داخل المنشأة.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>اختر الزميل المكرم *</Label>
            <select
              value={recipientId}
              onChange={(e) => setRecipientId(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
              required
            >
              <option value="">-- حدد الزميل --</option>
              {employees
                .filter((e) => e.id !== senderId)
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} {e.employeeNo ? `(${e.employeeNo})` : ""}
                  </option>
                ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>فئة التقدير</Label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nameAr}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label>الشارة الرمزية (Badge)</Label>
              <select
                value={selectedBadge}
                onChange={(e) => setSelectedBadge(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
              >
                {badges.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nameAr}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>رسالة التقدير والامتنان *</Label>
            <Textarea
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="صف الموقف أو الإنجاز الذي ساهم به زميلك..."
              required
              className="resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <Label>نطاق الظهور</Label>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value)}
              className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
            >
              <option value="company">عام على مستوى المنشأة (Company Wall)</option>
              <option value="team">فريق العمل فقط (Team Only)</option>
              <option value="private">خاص ومباشر للزميل (Private)</option>
            </select>
          </div>

          <DialogFooter className="pt-3">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              إلغاء
            </Button>
            <Button type="submit" disabled={loading} className="gap-2 bg-amber-600 hover:bg-amber-700 text-white">
              <Sparkles className="h-4 w-4" />
              {loading ? "جاري الإرسال..." : "إرسال التقدير الآن"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
