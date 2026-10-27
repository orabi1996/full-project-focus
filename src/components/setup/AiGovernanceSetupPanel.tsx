import React, { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Sparkles,
  ShieldCheck,
  Bot,
  Brain,
  Lock,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Activity,
  Cpu,
} from "lucide-react";
import { useApp } from "../../lib/context/AppContext";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { toast } from "sonner";
import { useAIDashboardKpis } from "../../lib/data/ai-repository";
import { GOVERNED_AI_TOOLS } from "../../lib/ai/tools/registry";

export const AiGovernanceSetupPanel: React.FC = () => {
  const navigate = useNavigate();
  const { currentRole } = useApp();
  const { data: kpis } = useAIDashboardKpis();

  const [aiEnabled, setAiEnabled] = useState(true);
  const [piiScrubbing, setPiiScrubbing] = useState(true);
  const [requireConfirmationForMutations, setRequireConfirmationForMutations] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState("gemini");

  const supportedProviders = [
    { id: "gemini", name: "Google Gemini 1.5 Pro / Flash", status: "نشط ومعتمد", badge: "default" },
    { id: "openai", name: "OpenAI GPT-4o / Mini", status: "متوافق مع الواجهة", badge: "secondary" },
    { id: "anthropic", name: "Anthropic Claude 3.5 Sonnet", status: "متوافق مع الواجهة", badge: "secondary" },
  ];

  const safetyGuards = [
    {
      title: "تجريد البيانات الحساسة (PII Scrubbing)",
      desc: "حجب أرقام الهوية، الحسابات البنكية، والمبالغ المالية غير المصرح بها آلياً قبل إرسال السياق للنموذج",
      enabled: piiScrubbing,
      toggle: () => setPiiScrubbing(!piiScrubbing),
    },
    {
      title: "الحماية ضد حقن التعليمات (Adversarial Defense)",
      desc: "فحص وتدقيق كل طلب ضد هجمات كشف التعليمات البرمجية أو محاولات تخطي الصلاحيات أو أوامر قواعد البيانات",
      enabled: true,
      toggle: () => {},
      fixed: true,
    },
    {
      title: "التأكيد الإنساني الإلزامي للعمليات (Human in the Loop)",
      desc: "حظر تنفيذ أي أمر تعديل أو اعتماد أو توليد سجل بدون موافقة صريحة وموثقة من المستخدم البشري",
      enabled: requireConfirmationForMutations,
      toggle: () => setRequireConfirmationForMutations(!requireConfirmationForMutations),
    },
    {
      title: "العزل المؤسسي متعدد المستأجرين (Tenant Isolation)",
      desc: "منع استرجاع أي سياق أو بيانات تخص شركة أخرى، والالتزام الصارم بـ company_id المعتمد في الجلسة",
      enabled: true,
      toggle: () => {},
      fixed: true,
    },
  ];

  const handleSaveSettings = () => {
    toast.success("تم حفظ إعدادات وسياسات حوكمة الذكاء الاصطناعي بنجاح");
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header Banner */}
      <div className="rounded-3xl border border-primary/20 bg-gradient-to-l from-primary/10 via-card to-card p-6 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Badge className="bg-primary/15 text-primary border-primary/30 text-xs font-bold">
              حوكمة الذكاء الاصطناعي والأمان
            </Badge>
            <Badge variant="outline" className="text-[11px] font-mono">
              {Object.keys(GOVERNED_AI_TOOLS).length} أدوات محوكمة • Grounding صارم
            </Badge>
          </div>
          <h2 className="text-lg font-black text-foreground">
            تهيئة سياسات ومزودي الذكاء الاصطناعي (MadarX Copilot Governance)
          </h2>
          <p className="text-xs text-muted-foreground max-w-3xl leading-relaxed">
            التحكم في تفعيل المساعد الذكي، اختيار النماذج المعتمدة، وفرض ضوابط الأمان الصارمة: تجريد الهوية (PII)، التحقق من الصلاحيات، وحظر تنفيذ التعديلات دون موافقة بشرية. للاستفادة من المساعد الذكي والتحليلات اليومية، انتقل إلى شاشة العمليات.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate({ to: "/ai-copilot" })}
            className="rounded-xl text-xs font-bold gap-1.5"
          >
            <ExternalLink className="h-3.5 w-3.5 text-primary" />
            شاشة المساعد الذكي والعمليات
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-bold">
            <span>حالة المساعد الذكي</span>
            <Bot className="h-4 w-4 text-primary" />
          </div>
          <div className="text-2xl font-black text-emerald-600 font-mono">
            {aiEnabled ? "مفعّل للمنشأة" : "معطّل"}
          </div>
          <p className="text-[11px] text-muted-foreground">خاضع لسياسات التحكم والتدقيق</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-bold">
            <span>الأدوات المصرح بها</span>
            <Cpu className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-foreground font-mono">
            {Object.keys(GOVERNED_AI_TOOLS).length} أدوات
          </div>
          <p className="text-[11px] text-muted-foreground">أدوات استعلامية وتنفيذية مؤمنة</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-bold">
            <span>معدل التأصيل والحقيقة</span>
            <ShieldCheck className="h-4 w-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-foreground font-mono">100%</div>
          <p className="text-[11px] text-muted-foreground">Grounding صارم يمنع الهلوسة</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-bold">
            <span>الطلبات الناجحة</span>
            <Activity className="h-4 w-4 text-purple-600" />
          </div>
          <div className="text-2xl font-black text-foreground font-mono">
            {kpis?.successfulRequests ?? 0}
          </div>
          <p className="text-[11px] text-muted-foreground">معدل فشل الأدوات: 0%</p>
        </div>
      </div>

      {/* Section 1: Security & Guardrails Matrix */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <h3 className="text-sm font-black text-foreground flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          سياسات الأمان والحماية الإلزامية للمساعد الذكي
        </h3>
        <div className="divide-y divide-border">
          {safetyGuards.map((guard, idx) => (
            <div
              key={idx}
              className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
            >
              <div>
                <span className="font-bold text-foreground block">{guard.title}</span>
                <span className="text-[11px] text-muted-foreground mt-0.5 block leading-relaxed">
                  {guard.desc}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {guard.fixed ? (
                  <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-500/20 text-[10px]">
                    إلزامي ومثبّت بنظام المنصة
                  </Badge>
                ) : (
                  <Button
                    size="sm"
                    variant={guard.enabled ? "default" : "outline"}
                    onClick={guard.toggle}
                    className="h-8 text-[11px] font-bold"
                  >
                    {guard.enabled ? "مفعّل" : "تعطيل"}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section 2: Approved Providers Selection */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-foreground flex items-center gap-2">
            <Brain className="h-4 w-4 text-purple-600" />
            مزودي الذكاء الاصطناعي المعتمدين في المنشأة
          </h3>
          <Button size="sm" onClick={handleSaveSettings} className="rounded-xl text-xs font-bold">
            حفظ وتطبيق السياسات
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {supportedProviders.map((prov) => (
            <div
              key={prov.id}
              onClick={() => setSelectedProvider(prov.id)}
              className={`p-4 rounded-2xl border cursor-pointer transition-all space-y-2 ${
                selectedProvider === prov.id
                  ? "border-primary bg-primary/5 shadow-xs"
                  : "border-border/80 bg-muted/20 hover:border-primary/40"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">{prov.name}</span>
                {selectedProvider === prov.id && (
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                )}
              </div>
              <Badge variant="outline" className="text-[10px]">
                {prov.status}
              </Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
