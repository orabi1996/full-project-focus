// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PROMPT 31: NOMINATE CAMPAIGN CANDIDATE MODAL
// src/components/engagement/NominateCampaignModal.tsx
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
import { Award, Sparkles } from "lucide-react";
import { nominateCampaignCandidate } from "../../lib/data/engagement-repository";
import type { RecognitionCampaign } from "../../lib/domains/engagement";

interface NominateCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  companyId: string;
  nominatorId: string;
  campaigns: RecognitionCampaign[];
  employees: Array<{ id: string; name: string; employeeNo?: string }>;
  defaultCampaignId?: string;
}

export const NominateCampaignModal: React.FC<NominateCampaignModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  companyId,
  nominatorId,
  campaigns,
  employees,
  defaultCampaignId,
}) => {
  const [loading, setLoading] = useState(false);
  const [campaignId, setCampaignId] = useState(defaultCampaignId || campaigns[0]?.id || "");
  const [nomineeId, setNomineeId] = useState("");
  const [reason, setReason] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaignId) {
      toast.error("يرجى اختيار الحملة التكريمية");
      return;
    }
    if (!nomineeId) {
      toast.error("يرجى اختيار الموظف المرشح للجائزة");
      return;
    }
    if (nomineeId === nominatorId) {
      toast.error("لا يمكن ترشيح نفسك للجائزة");
      return;
    }
    if (!reason.trim()) {
      toast.error("يرجى تقديم مبررات وأسباب الترشيح");
      return;
    }

    try {
      setLoading(true);
      await nominateCampaignCandidate(
        companyId,
        campaignId,
        nomineeId,
        nominatorId,
        reason,
        evidenceUrl || undefined
      );

      toast.success("تم إرسال ملف الترشيح بنجاح للجنة التقييم");
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ أثناء إرسال الترشيح");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary">
            <Award className="h-5 w-5 text-amber-500" />
            <DialogTitle>ترشيح زميل لجائزة التميز والتكريم</DialogTitle>
          </div>
          <DialogDescription>
            تقديم ملف ترشيح موثق لإحدى جوائز التميز المؤسسي أو موظف الشهر.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>الحملة التكريمية المستهدفة *</Label>
            <select
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
              required
            >
              <option value="">-- حدد الحملة --</option>
              {campaigns
                .filter((c) => c.status === "active" || c.status === "voting")
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.titleAr} ({c.startDate} إلى {c.endDate})
                  </option>
                ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label>الموظف المرشح *</Label>
            <select
              value={nomineeId}
              onChange={(e) => setNomineeId(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
              required
            >
              <option value="">-- حدد الموظف --</option>
              {employees
                .filter((e) => e.id !== nominatorId)
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} {e.employeeNo ? `(${e.employeeNo})` : ""}
                  </option>
                ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label>مبررات وإنجازات الترشيح *</Label>
            <Textarea
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="صف الإنجازات الاستثنائية، السلوكيات القيادية، أو الأثر الملموس الذي حققه المرشح..."
              required
              className="resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <Label>رابط الأدلة أو الوثائق الداعمة (اختياري)</Label>
            <Input
              value={evidenceUrl}
              onChange={(e) => setEvidenceUrl(e.target.value)}
              placeholder="https://... أو رابط التقرير / المشروع"
            />
          </div>

          <DialogFooter className="pt-3">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              إلغاء
            </Button>
            <Button type="submit" disabled={loading} className="gap-2">
              <Sparkles className="h-4 w-4" />
              {loading ? "جاري الإرسال..." : "إرسال الترشيح"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
