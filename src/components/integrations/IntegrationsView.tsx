import React, { useState } from "react";
import { useApp } from "../../lib/context/AppContext";
import { canManageModule } from "../../lib/auth/permissions";
import { IconSymbol } from "../ui/IconSymbol";
import {
  Network,
  BookOpen,
  Key,
  Webhook,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Plus,
  RotateCw,
  Send,
  Sliders,
  Sparkles,
} from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import { toast } from "sonner";

export const IntegrationsView: React.FC = () => {
  const { accountingJournals, currentRole, language, t } = useApp();
  const canManage = canManageModule(currentRole, "integrations");
  const [activeTab, setActiveTab] = useState("journals");

  // Modals state
  const [isAddWebhookOpen, setIsAddWebhookOpen] = useState(false);
  const [isSyncJournalOpen, setIsSyncJournalOpen] = useState(false);

  // Webhook Form State
  const [webhookUrl, setWebhookUrl] = useState("https://api.my-erp.com/hrms/events");
  const [webhookEvent, setWebhookEvent] = useState("payroll.confirmed");

  const saudiGovIntegrations = [
    {
      id: "qiwa",
      name: "منصة قوى (Qiwa MHRSD)",
      status: "connected",
      desc: "توثيق العقود الوظيفية الموحدة ومطابقة نسب التوطين نطاقات",
    },
    {
      id: "muqeem",
      name: "منصة مقيم (Muqeem / Elm)",
      status: "connected",
      desc: "مزامنة بيانات الإقامات وتأشيرات الخروج والعودة وتجديد الجوازات",
    },
    {
      id: "gosi",
      name: "التأمينات الاجتماعية (GOSI)",
      status: "connected",
      desc: "المزامنة اللحظية لبيانات الأجر الخاضع للاشتراك وحساب نسب الاستقطاع",
    },
    {
      id: "mudad",
      name: "منصة مدد (Mudad Compliance)",
      status: "connected",
      desc: "التحقق المباشر من مطابقة ملف حماية الأجور WPS والالتزام بنسبة 100%",
    },
  ];

  const erpPlatforms = [
    {
      id: "odoo",
      name: "Odoo ERP v17",
      status: "connected",
      desc: "مزامنة قيود الرواتب والمصروفات ومراكز التكلفة",
    },
    { id: "sap", name: "SAP S/4HANA", status: "ready", desc: "تكامل محاسبي مباشر عبر REST API" },
    { id: "zoho", name: "Zoho Books", status: "ready", desc: "توليد قيود اليومية التلقائية" },
    {
      id: "oracle",
      name: "Oracle Fusion Cloud",
      status: "ready",
      desc: "تصدير قيود الأستاذ العام GL",
    },
  ];

  const handleCreateWebhook = () => {
    if (!webhookUrl) {
      toast.error("يرجى كتابة رابط الـ Webhook");
      return;
    }
    toast.success(`تم إنشاء وتفعيل نقطة الـ Webhook بنجاح للحدث: (${webhookEvent})!`);
    setIsAddWebhookOpen(false);
  };

  const handleSyncJournals = () => {
    toast.success(
      "تم إرسال قيود الرواتب والمصروفات إلى نظام Odoo بنجاح! كود الاستجابة: 200 OK (Batch ID: JRN-9823)",
    );
    setIsSyncJournalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header (Google M3 Style) */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/70 pb-5">
        <div>
          <h1 className="text-xl font-black text-foreground flex items-center gap-2.5">
            <IconSymbol name="hub" source="material" filled size={24} className="text-primary" />
            {t.system.integrations} والربط الحكومي والمحاسبي (M18)
          </h1>
          <p className="text-xs text-muted-foreground font-medium mt-1">
            ربط منصات قوى، مقيم، التأمينات (GOSI)، مدد، وتوليد قيود اليومية التلقائية لأنظمة ERP
          </p>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2.5">
            <Button
              onClick={() => setIsSyncJournalOpen(true)}
              size="sm"
              className="rounded-full font-bold text-xs gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs h-10 px-4"
            >
              <RotateCw className="h-4 w-4" />
              ترحيل القيود إلى ERP الآن
            </Button>
            <Button
              onClick={() => setIsAddWebhookOpen(true)}
              variant="outline"
              size="sm"
              className="rounded-full font-bold text-xs gap-1.5 border-border/80 hover:bg-secondary h-10 px-4 shadow-xs"
            >
              <Plus className="h-4 w-4 text-primary" />
              إضافة Webhook جديد
            </Button>
          </div>
        )}
      </div>

      {/* Saudi Government Integrations Radar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {saudiGovIntegrations.map((gov) => (
          <div key={gov.id} className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-2.5 hover:border-primary/40 transition-all">
            <div className="flex items-center justify-between">
              <span className="font-black text-xs text-foreground">{gov.name}</span>
              <Badge variant="outline" className="text-emerald-700 bg-emerald-50 text-[9px] rounded-full px-2 font-bold border-emerald-200">
                مربوط ونشط
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground font-medium leading-relaxed">{gov.desc}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-3 max-w-md bg-muted/60 p-1 rounded-full border border-border/60">
          <TabsTrigger value="journals" className="rounded-full text-xs font-bold py-2 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-xs">
            القيود المحاسبية ({accountingJournals.length})
          </TabsTrigger>
          <TabsTrigger value="erp" className="rounded-full text-xs font-bold py-2 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-xs">
            أنظمة ERP
          </TabsTrigger>
          <TabsTrigger value="webhooks" className="rounded-full text-xs font-bold py-2 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-xs">
            Webhooks & API
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Accounting Journals */}
        <TabsContent value="journals" className="space-y-4 pt-4">
          <div className="rounded-3xl border border-border/80 bg-card overflow-hidden shadow-xs space-y-4 p-6">
            <div className="flex justify-between items-center border-b border-border/60 pb-3">
              <h3 className="text-sm font-black text-foreground">
                قيود اليومية الآلية (Automated Journal Entries)
              </h3>
              <Badge variant="outline" className="text-emerald-700 bg-emerald-50 text-[10px] rounded-full px-2.5 font-bold border-emerald-200">
                مرحلة ومطابقة (100% Balanced)
              </Badge>
            </div>

            <div className="space-y-3">
              {accountingJournals.map((j) => (
                <div
                  key={j.id}
                  className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-xs space-y-2.5 font-mono hover:bg-card transition-all"
                >
                  <div className="flex items-center justify-between font-black">
                    <span className="text-primary text-sm">{j.journalNo}</span>
                    <span className="text-muted-foreground">{j.date}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-muted-foreground border-t border-border/60 pt-2.5 font-sans text-xs">
                    <div>
                      المصدر:{" "}
                      <span className="font-bold text-foreground">
                        {j.sourceReference} (مسير رواتب)
                      </span>
                    </div>
                    <div>
                      الحالة:{" "}
                      <span className="font-bold text-emerald-600">مرحل لنظام Odoo ERP</span>
                    </div>
                    <div className="font-mono">
                      إجمالي المدين (Debit):{" "}
                      <span className="font-black text-foreground">
                        {j.totalDebit.toLocaleString()} ر.س
                      </span>
                    </div>
                    <div className="font-mono">
                      إجمالي الدائن (Credit):{" "}
                      <span className="font-black text-foreground">
                        {j.totalCredit.toLocaleString()} ر.س
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: ERP Systems */}
        <TabsContent value="erp" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {erpPlatforms.map((erp) => (
              <div key={erp.id} className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-3 hover:border-primary/40 transition-all">
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-sm text-foreground">{erp.name}</h3>
                  <Badge
                    variant="outline"
                    className={`text-[10px] rounded-full px-2.5 font-bold ${
                      erp.status === "connected"
                        ? "bg-emerald-500/10 text-emerald-700 border-emerald-200"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {erp.status === "connected" ? "متصل ونشط" : "جاهز للربط"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground font-medium leading-relaxed">{erp.desc}</p>
                <div className="border-t border-border/60 pt-3 flex justify-between items-center">
                  <Button size="sm" variant="outline" className="rounded-full text-xs font-bold text-primary border-border/80 hover:bg-secondary px-3.5">
                    إعدادات الربط ومراكز التكلفة
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Tab 3: Webhooks */}
        <TabsContent value="webhooks" className="space-y-4 pt-4">
          <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-3.5">
            <h3 className="font-black text-xs text-foreground">اشتراكات الـ Webhook الفورية</h3>
            <p className="text-xs text-muted-foreground font-medium">
              استقبال إشعارات فورية عند اعتماد الإجازات، قفل مسير الرواتب، أو تعيين مرشح جديد.
            </p>
            <div className="rounded-2xl border border-border/60 bg-muted/30 p-3.5 text-xs font-mono text-muted-foreground">
              POST https://api.your-company.com/webhooks/hrms-events
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Sync Journal Modal */}
      <Dialog open={isSyncJournalOpen} onOpenChange={setIsSyncJournalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <RotateCw className="h-5 w-5 text-primary" />
              ترحيل قيود الرواتب والمصروفات لـ ERP
            </DialogTitle>
            <DialogDescription className="text-xs font-medium">
              سيتم إرسال قيود الدائن والمدين ومراكز التكلفة تلقائياً
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs py-2 font-mono">
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 space-y-1.5 font-sans">
              <p className="font-black text-foreground">ملخص القيد المحاسبي الموجه لـ Odoo:</p>
              <p className="text-muted-foreground font-mono">
                المدين (Debit): 448,500 ر.س (مصروفات رواتب وبدلات)
              </p>
              <p className="text-muted-foreground font-mono">
                الدائن (Credit): 448,500 ر.س (مستحقات بنك + تأمينات + سلف)
              </p>
              <span className="text-emerald-600 font-bold block pt-1">
                ✓ القيد متوازن ومطابق (Balanced)
              </span>
            </div>
          </div>

          <DialogFooter className="mt-3">
            <Button size="sm" onClick={handleSyncJournals} className="rounded-full text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-5 h-9">
              تأكيد الترحيل المالي
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Webhook Modal */}
      <Dialog open={isAddWebhookOpen} onOpenChange={setIsAddWebhookOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Webhook className="h-5 w-5 text-primary" />
              إضافة اشتراك Webhook جديد
            </DialogTitle>
            <DialogDescription className="text-xs font-medium">
              إرسال حمولة JSON فور وقوع الحدث في النظام
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs py-2">
            <div className="space-y-1.5">
              <label className="font-bold">رابط الاستقبال (Target Endpoint URL) *</label>
              <input
                type="text"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div className="space-y-1.5">
              <label className="font-bold">الحدث المستهدف (Trigger Event) *</label>
              <select
                value={webhookEvent}
                onChange={(e) => setWebhookEvent(e.target.value)}
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-bold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="payroll.confirmed">
                  اعتماد وقفل مسير الرواتب (payroll.confirmed)
                </option>
                <option value="leave.approved">اعتماد طلب إجازة (leave.approved)</option>
                <option value="employee.created">تعيين موظف جديد (employee.created)</option>
              </select>
            </div>
          </div>

          <DialogFooter className="mt-3">
            <Button
              size="sm"
              onClick={handleCreateWebhook}
              className="rounded-full text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-5 h-9"
            >
              حفظ وتفعيل Webhook
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
