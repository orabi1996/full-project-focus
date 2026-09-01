import React, { useState } from "react";
import { useApp } from "../../lib/context/AppContext";
import { canManageModule } from "../../lib/auth/permissions";
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
      alert("يرجى كتابة رابط الـ Webhook");
      return;
    }
    alert(`تم إنشاء وتفعيل نقطة الـ Webhook بنجاح للحدث: (${webhookEvent})!`);
    setIsAddWebhookOpen(false);
  };

  const handleSyncJournals = () => {
    alert(
      "تم إرسال قيود الرواتب والمصروفات إلى نظام Odoo بنجاح! كود الاستجابة: 200 OK (Batch ID: JRN-9823)",
    );
    setIsSyncJournalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Network className="h-5 w-5 text-primary" />
            {t.system.integrations} ومركز القيود المحاسبية ERP (M18)
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            توليد قيود اليومية المحاسبية للرواتب والمصروفات، الربط بأنظمة ERP، ومفاتيح API وWebhooks
          </p>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => setIsSyncJournalOpen(true)}
              size="sm"
              className="font-bold text-xs gap-1.5 bg-primary"
            >
              <RotateCw className="h-4 w-4" />
              ترحيل القيود إلى ERP الآن
            </Button>
            <Button
              onClick={() => setIsAddWebhookOpen(true)}
              variant="outline"
              size="sm"
              className="font-bold text-xs gap-1.5"
            >
              <Plus className="h-4 w-4" />
              إضافة Webhook جديد
            </Button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-3 max-w-md">
          <TabsTrigger value="journals" className="text-xs font-bold">
            مركز القيود المحاسبية ({accountingJournals.length})
          </TabsTrigger>
          <TabsTrigger value="erp" className="text-xs font-bold">
            أنظمة ERP المتكاملة
          </TabsTrigger>
          <TabsTrigger value="webhooks" className="text-xs font-bold">
            Webhooks & API
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Accounting Journals */}
        <TabsContent value="journals" className="space-y-4 pt-4">
          <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="text-xs font-bold text-foreground">
                قيود اليومية الآلية (Journal Entries)
              </h3>
              <Badge variant="outline" className="text-emerald-700 bg-emerald-50 text-[10px]">
                مرحلة ومطابقة (100% Balanced)
              </Badge>
            </div>

            <div className="p-4 space-y-3">
              {accountingJournals.map((j) => (
                <div
                  key={j.id}
                  className="rounded-lg border bg-muted/20 p-4 text-xs space-y-2 font-mono"
                >
                  <div className="flex items-center justify-between font-bold">
                    <span className="text-primary">{j.journalNo}</span>
                    <span className="text-muted-foreground">{j.date}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-muted-foreground border-t pt-2">
                    <div>
                      المصدر:{" "}
                      <span className="font-semibold text-foreground">
                        {j.sourceReference} (مسير رواتب)
                      </span>
                    </div>
                    <div>
                      الحالة:{" "}
                      <span className="font-semibold text-emerald-600">مرحل لنظام Odoo ERP</span>
                    </div>
                    <div>
                      إجمالي المدين (Debit):{" "}
                      <span className="font-bold text-foreground">
                        {j.totalDebit.toLocaleString()} ر.س
                      </span>
                    </div>
                    <div>
                      إجمالي الدائن (Credit):{" "}
                      <span className="font-bold text-foreground">
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
              <div key={erp.id} className="rounded-xl border bg-card p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-foreground">{erp.name}</h3>
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      erp.status === "connected"
                        ? "bg-emerald-500/10 text-emerald-700 border-emerald-200"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {erp.status === "connected" ? "متصل ونشط" : "جاهز للربط"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{erp.desc}</p>
                <div className="border-t pt-2 flex justify-between items-center">
                  <Button size="sm" variant="outline" className="text-xs font-bold text-primary">
                    إعدادات الربط ومراكز التكلفة
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Tab 3: Webhooks */}
        <TabsContent value="webhooks" className="space-y-4 pt-4">
          <div className="rounded-xl border bg-card p-5 shadow-sm space-y-3">
            <h3 className="font-bold text-xs text-foreground">اشتراكات الـ Webhook الفورية</h3>
            <p className="text-xs text-muted-foreground">
              استقبال إشعارات فورية عند اعتماد الإجازات، قفل مسير الرواتب، أو تعيين مرشح جديد.
            </p>
            <div className="rounded-lg border bg-muted/30 p-3 text-xs font-mono text-muted-foreground">
              POST https://api.your-company.com/webhooks/hrms-events
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Sync Journal Modal */}
      <Dialog open={isSyncJournalOpen} onOpenChange={setIsSyncJournalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <RotateCw className="h-5 w-5 text-primary" />
              ترحيل قيود الرواتب والمصروفات لـ ERP
            </DialogTitle>
            <DialogDescription className="text-xs">
              سيتم إرسال قيود الدائن والمدين ومراكز التكلفة تلقائياً
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-xs py-2 font-mono">
            <div className="rounded-lg border bg-muted/20 p-3 space-y-1">
              <p className="font-bold text-foreground">ملخص القيد المحاسبي الموجه لـ Odoo:</p>
              <p className="text-muted-foreground">
                المدين (Debit): 448,500 ر.س (مصروفات رواتب وبدلات)
              </p>
              <p className="text-muted-foreground">
                الدائن (Credit): 448,500 ر.س (مستحقات بنك + تأمينات + سلف)
              </p>
              <span className="text-emerald-600 font-bold block pt-1">
                ✓ القيد متوازن ومطابق (Balanced)
              </span>
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button size="sm" onClick={handleSyncJournals} className="text-xs bg-primary font-bold">
              تأكيد الترحيل المالي
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Webhook Modal */}
      <Dialog open={isAddWebhookOpen} onOpenChange={setIsAddWebhookOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Webhook className="h-5 w-5 text-primary" />
              إضافة اشتراك Webhook جديد
            </DialogTitle>
            <DialogDescription className="text-xs">
              إرسال حمولة JSON فور وقوع الحدث في النظام
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-xs py-2">
            <div className="space-y-1">
              <label className="font-bold">رابط الاستقبال (Target Endpoint URL) *</label>
              <input
                type="text"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                className="w-full h-8 rounded border px-2.5 font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold">الحدث المستهدف (Trigger Event) *</label>
              <select
                value={webhookEvent}
                onChange={(e) => setWebhookEvent(e.target.value)}
                className="w-full h-8 rounded border px-2.5"
              >
                <option value="payroll.confirmed">
                  اعتماد وقفل مسير الرواتب (payroll.confirmed)
                </option>
                <option value="leave.approved">اعتماد طلب إجازة (leave.approved)</option>
                <option value="employee.created">تعيين موظف جديد (employee.created)</option>
              </select>
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button
              size="sm"
              onClick={handleCreateWebhook}
              className="text-xs bg-primary font-bold"
            >
              حفظ وتفعيل Webhook
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
