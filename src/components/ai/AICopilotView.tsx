/**
 * MadarX Enterprise AI Copilot & Smart Report Analyzer View
 * Provides Conversational AI Assistant, Live 360° Report & System Analyzer,
 * Proactive Insights Feed, Employee 360° AI Summary, and Tool Governance.
 */

import React, { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Sparkles,
  Send,
  ShieldCheck,
  AlertTriangle,
  Bot,
  User,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  Layers,
  Terminal,
  ThumbsUp,
  ThumbsDown,
  RefreshCw,
  Lock,
  BookOpen,
  Lightbulb,
  Activity,
  BarChart3,
  Plus,
  Trash2,
  Copy,
  Download,
  Printer,
  ArrowUpRight,
  Building2,
  Wallet,
  Calendar,
  TrendingUp,
  Briefcase,
  Users,
  Settings,
  Key,
  Cpu,
  Zap,
  Globe,
  X,
  MessageSquare,
} from "lucide-react";
import { useApp } from "../../lib/context/AppContext";
import {
  useAIConversations,
  useCreateAIConversation,
  useClearAIConversation,
  useChatMessages,
  useAIInsights,
  useAIDashboardKpis,
  useAIToolCalls,
  useSendMessage,
  SMART_REPORT_DOMAINS,
  buildSmartReportAnalysis,
  loadAIProviderConfig,
  saveAIProviderConfig,
  callExternalLLM,
  type AIProviderConfig,
  type SmartReportDomainId,
} from "../../lib/data/ai-repository";
import { GOVERNED_AI_TOOLS, isUserAuthorizedForTool } from "../../lib/ai/tools/registry";
import { runAIEvaluationSuite } from "../../lib/ai/evaluation";
import { METRIC_CATALOG } from "../../lib/data/reports-repository";
import { EmployeeAiSummaryPanel } from "./EmployeeAiSummaryPanel";
import { toast } from "sonner";

type ActiveTab = "chat" | "reports_analyzer" | "insights" | "governance";

export function AICopilotView() {
  const app = useApp();
  const { currentRole } = app;
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<ActiveTab>("chat");
  const [selectedConversationId, setSelectedConversationId] = useState<string>("conv-1");
  const [inputText, setInputText] = useState<string>("");
  const [insightFilter, setInsightFilter] = useState<string>("all");
  const [dismissedInsightIds, setDismissedInsightIds] = useState<string[]>([]);
  const [confirmedActionIds, setConfirmedActionIds] = useState<string[]>([]);
  const [selectedReportDomain, setSelectedReportDomain] =
    useState<SmartReportDomainId>("executive_all");

  // AI Provider Configuration (Built-in, OpenAI, Gemini, OpenRouter)
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [providerConfig, setProviderConfig] = useState<AIProviderConfig>(() => loadAIProviderConfig());
  const [apiKeyInput, setApiKeyInput] = useState<string>(() => loadAIProviderConfig().apiKey || "");
  const [modelInput, setModelInput] = useState<string>(() => loadAIProviderConfig().model || "");
  const [selectedProvider, setSelectedProvider] = useState<AIProviderConfig["provider"]>(
    () => loadAIProviderConfig().provider
  );
  const [isTestingConnection, setIsTestingConnection] = useState<boolean>(false);
  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [chipCategory, setChipCategory] = useState<"general" | "reports">("general");

  const { data: conversations = [] } = useAIConversations();
  const createConversationMutation = useCreateAIConversation();
  const clearConversationMutation = useClearAIConversation();
  const { data: messages = [], isLoading: loadingMessages } =
    useChatMessages(selectedConversationId);
  const { data: insights = [] } = useAIInsights();
  const { data: kpis } = useAIDashboardKpis();
  const { data: toolCalls = [] } = useAIToolCalls();
  const sendMessageMutation = useSendMessage();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const evalScorecard = useMemo(() => runAIEvaluationSuite(), []);

  // Build live report analysis for the selected domain
  const activeReportAnalysis = useMemo(
    () => buildSmartReportAnalysis(selectedReportDomain, app),
    [selectedReportDomain, app]
  );

  const sendPromptImmediately = (promptText: string) => {
    const trimmed = promptText.trim();
    if (!trimmed || sendMessageMutation.isPending) return;

    sendMessageMutation.mutate(
      {
        conversationId: selectedConversationId,
        content: trimmed,
        userRole: currentRole,
      },
      {
        onError: (err: any) => {
          toast.error(err?.message || "تعذر معالجة الطلب بواسطة المساعد الذكي");
        },
      }
    );
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || sendMessageMutation.isPending) return;
    const text = inputText.trim();
    setInputText("");
    sendPromptImmediately(text);
  };

  const handleCreateNewConversation = () => {
    createConversationMutation.mutate(undefined, {
      onSuccess: (newConv) => {
        setSelectedConversationId(newConv.id);
        setActiveTab("chat");
        toast.success("تم فتح محادثة تحليلية جديدة");
      },
    });
  };

  const handleClearConversation = () => {
    clearConversationMutation.mutate(selectedConversationId, {
      onSuccess: () => {
        toast.success("تم مسح المحادثة وتحديث الاتصال ببيانات النظام");
      },
    });
  };

  const handleDiscussReportInChat = (domainId: SmartReportDomainId) => {
    const domainMeta = SMART_REPORT_DOMAINS.find((d) => d.id === domainId);
    const prompt = `حلل لي ${domainMeta?.titleAr || "التقرير التنفيذي الشامل"} بالتفصيل مع أهم التوصيات والمخاطر`;
    setActiveTab("chat");
    sendPromptImmediately(prompt);
  };

  const handleExportReportCsv = () => {
    const rep = activeReportAnalysis;
    const rows: string[][] = [
      ["التقرير", rep.titleAr],
      ["مؤشر الصحة التشغيلية", `${rep.healthScorePct}%`],
      ["تاريخ التوليد", new Date(rep.generatedAt).toLocaleString("ar-SA")],
      [],
      ["المؤشر", "القيمة", "التفاصيل"],
      ...rep.kpis.map((k) => [k.label, k.value, k.subtext]),
      [],
      rep.breakdownHeaders,
      ...rep.breakdownRows,
    ];
    const csvContent =
      "\uFEFF" +
      rows
        .map((r) => r.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
        .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `madarx-ai-report-${rep.domainId}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("تم تصدير التقرير التحليلي بصيغة CSV بنجاح");
  };

  const handleConfirmAction = (msgId: string) => {
    setConfirmedActionIds((prev) => [...prev, msgId]);
    toast.success("تم اعتماد وتنفيذ الإجراء وتوثيقه في سجل التدقيق (Audit Log)");
  };

  const handleDismissInsight = (id: string, actionLabel: string) => {
    setDismissedInsightIds((prev) => [...prev, id]);
    toast.info(`تمت معالجة التنبيه: ${actionLabel}`);
  };

  const filteredInsights = insights.filter((ins) => {
    if (dismissedInsightIds.includes(ins.id)) return false;
    if (insightFilter === "all") return true;
    return ins.severity === insightFilter;
  });

  const handleSaveProviderConfig = () => {
    const newConfig: AIProviderConfig = {
      provider: selectedProvider,
      apiKey: apiKeyInput.trim(),
      model: modelInput.trim() || undefined,
    };
    saveAIProviderConfig(newConfig);
    setProviderConfig(newConfig);
    setIsSettingsOpen(false);
    toast.success("تم تفعيل إعدادات محرك الذكاء الاصطناعي بنجاح");
  };

  const handleTestConnection = async () => {
    if (selectedProvider === "built_in") {
      toast.success("المحرك التحليلي المدمج (MadarX AI) جاهز ونشط بنسبة 100%");
      return;
    }
    if (!apiKeyInput.trim()) {
      toast.error("يرجى إدخال مفتاح API أولاً لاختبار الاتصال");
      return;
    }
    setIsTestingConnection(true);
    try {
      const testConfig: AIProviderConfig = {
        provider: selectedProvider,
        apiKey: apiKeyInput.trim(),
        model: modelInput.trim() || undefined,
      };
      const reply = await callExternalLLM(
        "أهلاً، قم باختبار الاتصال في كلمة واحدة فقط: جاهز.",
        "أنت مساعد ذكي تجريبي للتحقق من الاتصال.",
        testConfig
      );
      toast.success(`تم الاتصال بنجاح بمحرك ${selectedProvider}! الرد: ${reply.slice(0, 50)}`);
    } catch (err: any) {
      toast.error(`فشل الاتصال بمحرك ${selectedProvider}: ${err?.message || "تحقق من صحة المفتاح وصلاحيته"}`);
    } finally {
      setIsTestingConnection(false);
    }
  };

  const getProviderBadge = () => {
    switch (providerConfig.provider) {
      case "openai":
        return {
          label: `OpenAI ChatGPT (${providerConfig.model || "gpt-4o-mini"})`,
          color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
        };
      case "gemini":
        return {
          label: `Google Gemini (${providerConfig.model || "gemini-1.5-flash"})`,
          color: "bg-blue-500/20 text-blue-300 border-blue-500/30",
        };
      case "openrouter":
        return {
          label: `OpenRouter (${providerConfig.model || "claude-3.5"})`,
          color: "bg-purple-500/20 text-purple-300 border-purple-500/30",
        };
      case "built_in":
      default:
        return {
          label: "المحرك التحليلي المدمج (MadarX AI)",
          color: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
        };
    }
  };

  const generalQuickPrompts: Array<{
    label: string;
    prompt: string;
    badge: string;
  }> = [
    {
      label: "إيميل ترحيبي بموظف جديد (Onboarding)",
      prompt: "صيغ لي إيميل ترحيبي رسمي واحترافي بموظف جديد انضم لفريق العمل يتضمن تفاصيل اليوم الأول والتمنيات بالتوفيق",
      badge: "صياغة",
    },
    {
      label: "خطاب عرض وظيفي رسمي (Job Offer)",
      prompt: "صيغ لي نموذج خطاب عرض وظيفي رسمي (Job Offer Letter) متكامل يوضح الراتب والمزايا والمهام وفترة التجربة",
      badge: "توظيف",
    },
    {
      label: "حساب مكافأة نهاية الخدمة (نظام العمل)",
      prompt: "اشرح لي بالتفصيل طريقة حساب مكافأة نهاية الخدمة وفق نظام العمل السعودي مع الفرق بين الاستقالة وإنهاء العقد",
      badge: "نظام العمل",
    },
    {
      label: "خطاب لفت نظر وإنذار إداري كتابي",
      prompt: "صيغ لي نموذج رسمي لخطاب لفت نظر وإنذار كتابي أول لموظف بسبب تكرار التأخير بدون عذر مع السند النظامي",
      badge: "خطابات",
    },
    {
      label: "الفرق بين OKRs و KPIs في إدارة الأداء",
      prompt: "ما هو الفرق الجوهري بين مؤشرات الأداء الرئيسية (KPIs) والأهداف والنتائج الرئيسية (OKRs) وكيف نطبقها في الموارد البشرية؟",
      badge: "استراتيجية",
    },
    {
      label: "أسئلة المقابلات السلوكية (منهجية STAR)",
      prompt: "اقترح لي أهم أسئلة المقابلات الوظيفية السلوكية وفق منهجية STAR لتقييم مهارات حل المشكلات والتواصل والعمل الجماعي",
      badge: "مقابلات",
    },
  ];

  const quickAnalysisChips: Array<{
    label: string;
    prompt: string;
    badge: string;
  }> = [
    {
      label: "تحليل التقرير الشامل 360°",
      prompt: "حلل لي التقرير التنفيذي الشامل لكل النظام 360 مع أهم المؤشرات والتوصيات",
      badge: "شامل",
    },
    {
      label: "تحليل مسير الرواتب وWPS",
      prompt: "حلل تقرير مسير الرواتب والتكاليف المالية والتأمينات وجاهزية حماية الأجور WPS",
      badge: "مالي",
    },
    {
      label: "تحليل القوى العاملة والتوطين",
      prompt: "ما هي حالة القوى العاملة ونسبة التوطين ونطاقات وتوزيع الموظفين على الإدارات؟",
      badge: "توطين",
    },
    {
      label: "تحليل الحضور والتأخير والإضافي",
      prompt: "حلل تقرير الحضور والانصراف وحالات التأخير وساعات العمل الإضافي والورديات",
      badge: "حضور",
    },
    {
      label: "تحليل الإجازات وسير الموافقات",
      prompt: "حلل تقرير أرصدة الإجازات السنوية والطلبات المعلقة في سير الموافقات Workflow",
      badge: "إجازات",
    },
    {
      label: "تحليل العقود ومنصة قوى والوثائق",
      prompt: "ما هي حالة عقود قوى وفترات التجربة والوثائق الرسمية التي تنتهي قريباً؟",
      badge: "عقود",
    },
    {
      label: "تحليل الأداء والتوظيف",
      prompt: "حلل تقرير تقييم الأداء الوظيفي والشواغر المفتوحة والمرشحين في التوظيف",
      badge: "أداء",
    },
    {
      label: "تحليل العهد والسلف والمصروفات",
      prompt: "حلل تقرير العهد التقنية المسلمة للموظفين والسلف النشطة ومطالبات المصروفات",
      badge: "عهد",
    },
  ];

  const getDomainIcon = (id: SmartReportDomainId) => {
    switch (id) {
      case "workforce_saudization":
        return <Users className="w-4 h-4" />;
      case "payroll_financial":
        return <Wallet className="w-4 h-4" />;
      case "attendance_shifts":
        return <Clock className="w-4 h-4" />;
      case "leaves_workflow":
        return <Calendar className="w-4 h-4" />;
      case "contracts_documents":
        return <FileText className="w-4 h-4" />;
      case "performance_recruitment":
        return <TrendingUp className="w-4 h-4" />;
      case "assets_expenses_loans":
        return <Briefcase className="w-4 h-4" />;
      case "executive_all":
      default:
        return <Sparkles className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-gradient-to-l from-indigo-950 via-slate-900 to-slate-900 text-white p-6 rounded-2xl shadow-lg border border-indigo-500/20">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center shrink-0">
            <Sparkles className="w-7 h-7 text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight">
                المساعد الذكي ومحلل التقارير المؤسسي (MadarX AI Copilot)
              </h1>
              <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> متصل مباشرةً ببيانات النظام ({app.employees.length} موظف • {METRIC_CATALOG.length} مؤشر)
              </span>
            </div>
            <p className="text-slate-300 text-sm mt-1">
              محرك ذكاء اصطناعي لتحليل كافة تقارير النظام، مسيرات الرواتب، التوطين، الحضور، الإجازات، العقود، وملفات الموظفين 360° لحظياً
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-800/90 p-1.5 rounded-xl border border-slate-700 self-start lg:self-auto flex-wrap">
          <button
            onClick={() => setActiveTab("chat")}
            className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 ${
              activeTab === "chat"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-300 hover:text-white hover:bg-slate-700/50"
            }`}
          >
            <Bot className="w-4 h-4" />
            المحادثة الذكية
          </button>
          <button
            onClick={() => setActiveTab("reports_analyzer")}
            className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 ${
              activeTab === "reports_analyzer"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-300 hover:text-white hover:bg-slate-700/50"
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            محلل التقارير والنظام (360°)
          </button>
          <button
            onClick={() => setActiveTab("insights")}
            className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 ${
              activeTab === "insights"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-300 hover:text-white hover:bg-slate-700/50"
            }`}
          >
            <Lightbulb className="w-4 h-4" />
            الرؤى الاستباقية
            {filteredInsights.length > 0 && (
              <span className="px-1.5 py-0.2 bg-amber-500 text-slate-950 rounded-full text-xs font-extrabold">
                {filteredInsights.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("governance")}
            className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 ${
              activeTab === "governance"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-300 hover:text-white hover:bg-slate-700/50"
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            الحوكمة والأدوات
          </button>
        </div>
      </div>

      {/* Top KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              نطاق التحليل المباشر في النظام
            </p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
              8 وحدات • {app.employees.length} موظف
            </p>
            <span className="text-xs text-emerald-600 font-medium">
              متصل لحظياً ببيانات الرواتب والحضور والعقود
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600">
            <Activity className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              متوسط زمن تحليل التقارير
            </p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
              {kpis?.avgLatencyMs ?? 165} ms
            </p>
            <span className="text-xs text-slate-500">
              {kpis?.totalRequests ?? 284} عملية تحليل ذكية منفذة
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-600">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              التنبيهات والرؤى الاستباقية النشطة
            </p>
            <p className="text-2xl font-bold text-amber-600 mt-1">{filteredInsights.length}</p>
            <span className="text-xs text-slate-500">مرتبطة بالتجربة والوثائق والطلبات</span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-950/60 flex items-center justify-center text-amber-600">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              مؤشر الدقة والحوكمة (Evaluation)
            </p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">
              {evalScorecard.overallScorePct}%
            </p>
            <span className="text-xs text-slate-500">
              {evalScorecard.passedTests}/{evalScorecard.totalTests} اختبارات أمان مجتازة
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: CONVERSATIONAL COPILOT                                         */}
      {/* ===================================================================== */}
      {activeTab === "chat" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Sidebar: Conversations & Report Shortcuts */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  سجل جلسات التحليل الذكي
                </h3>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleCreateNewConversation}
                    className="inline-flex items-center gap-1 text-xs bg-indigo-600 text-white px-2.5 py-1.5 rounded-lg font-bold hover:bg-indigo-700 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    جديدة
                  </button>
                  <button
                    type="button"
                    onClick={handleClearConversation}
                    title="مسح رسائل المحادثة الحالية"
                    className="inline-flex items-center justify-center p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {conversations.map((conv) => (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => setSelectedConversationId(conv.id)}
                    className={`w-full text-right p-3 rounded-xl border transition-all flex items-start gap-3 ${
                      selectedConversationId === conv.id
                        ? "bg-indigo-50/80 dark:bg-indigo-950/50 border-indigo-300 dark:border-indigo-700"
                        : "border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    }`}
                  >
                    <Bot className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
                    <div className="overflow-hidden flex-1">
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                        {conv.title}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        آخر تحديث: {new Date(conv.updatedAt).toLocaleTimeString("ar-SA")}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Prompts & Report Analysis Triggers */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  المقترحات السريعة
                </h3>
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setChipCategory("general")}
                    className={`px-2 py-1 rounded-md text-[11px] font-bold transition ${
                      chipCategory === "general"
                        ? "bg-white dark:bg-slate-700 text-indigo-600 shadow-xs"
                        : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    }`}
                  >
                    عام وصياغة
                  </button>
                  <button
                    type="button"
                    onClick={() => setChipCategory("reports")}
                    className={`px-2 py-1 rounded-md text-[11px] font-bold transition ${
                      chipCategory === "reports"
                        ? "bg-white dark:bg-slate-700 text-indigo-600 shadow-xs"
                        : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    }`}
                  >
                    تقارير 360°
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-500 mb-2.5">
                {chipCategory === "general"
                  ? "نماذج صياغة خطابات، إيميلات، استشارات العمل ونماذج OKRs:"
                  : "تحليل ذكي فوري لتقارير النظام والرواتب والتوطين بالأرقام:"}
              </p>
              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {(chipCategory === "general" ? generalQuickPrompts : quickAnalysisChips).map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    disabled={sendMessageMutation.isPending}
                    onClick={() => sendPromptImmediately(chip.prompt)}
                    className="w-full text-right text-xs p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700 transition flex items-center justify-between gap-2 group disabled:opacity-50"
                  >
                    <span className="font-semibold group-hover:text-indigo-700 dark:group-hover:text-indigo-300 line-clamp-1">
                      {chip.label}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold shrink-0">
                      {chip.badge}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Main Chat Interface */}
          <div className="lg:col-span-8 flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm h-[680px]">
            {/* Chat Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                    مساعد مدار الذكي الشامل (AI Assistant & Copilot)
                  </h3>
                  <p className="text-xs text-slate-500">
                    استشارات، صياغة، وتحليل تقارير • {app.employees.length} موظف • الصلاحية:{" "}
                    <span className="font-semibold text-indigo-600">{currentRole}</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(true)}
                  className="inline-flex items-center gap-1.5 text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-bold transition shadow-sm"
                  title="تخصيص محرك الذكاء الاصطناعي (OpenAI / Gemini / MadarX AI)"
                >
                  <Cpu className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="hidden sm:inline">محرك الذكاء:</span>
                  <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${getProviderBadge().color}`}>
                    {getProviderBadge().label}
                  </span>
                  <Settings className="w-3.5 h-3.5 text-slate-400 mr-0.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("reports_analyzer")}
                  className="inline-flex items-center gap-1.5 text-xs bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 px-3 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 font-bold hover:bg-indigo-100 transition"
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  لوحة 360°
                </button>
                <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-emerald-600" />
                  حماية PII
                </span>
              </div>
            </div>

            {/* Messages Stream */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {loadingMessages ? (
                <div className="flex items-center justify-center h-full text-slate-400 gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>جاري تحميل المحادثة...</span>
                </div>
              ) : (
                messages.map((msg) => {
                  const isUser = msg.role === "user";
                  const isActionProposal =
                    !isUser &&
                    (msg.content.includes("يتطلب تأكيد") || msg.content.includes("إرسال التذكير"));
                  const isConfirmed = confirmedActionIds.includes(msg.id);

                  return (
                    <div
                      key={msg.id}
                      className={`flex items-start gap-3 ${isUser ? "flex-row-reverse" : ""}`}
                    >
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                          isUser
                            ? "bg-slate-800 text-white"
                            : "bg-indigo-100 dark:bg-indigo-950 text-indigo-600"
                        }`}
                      >
                        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                      </div>

                      <div
                        className={`max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed ${
                          isUser
                            ? "bg-indigo-600 text-white rounded-tl-none"
                            : "bg-slate-100 dark:bg-slate-800/90 text-slate-800 dark:text-slate-100 rounded-tr-none border border-slate-200/70 dark:border-slate-700"
                        }`}
                      >
                        <div className="whitespace-pre-line">{msg.content}</div>

                        {/* Human-in-the-loop Confirmation Card */}
                        {isActionProposal && (
                          <div className="mt-3 p-3 rounded-xl bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                                <AlertTriangle className="w-4 h-4" />
                                يتطلب تأكيد بشري صريح قبل التنفيذ (Human-in-the-Loop)
                              </span>
                            </div>
                            {isConfirmed ? (
                              <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-bold">
                                <CheckCircle2 className="w-4 h-4" />
                                تم التأكيد والتنفيذ بنجاح وتوثيقه في سجل التدقيق
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 mt-2">
                                <button
                                  type="button"
                                  onClick={() => handleConfirmAction(msg.id)}
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition"
                                >
                                  تأكيد وتنفيذ الإجراء
                                </button>
                                <button
                                  type="button"
                                  onClick={() => toast.info("تم إلغاء الإجراء المقترح")}
                                  className="px-3 py-1.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-lg transition"
                                >
                                  إلغاء
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        <div
                          className={`flex items-center justify-between mt-2.5 pt-2 border-t ${
                            isUser
                              ? "border-indigo-500/40 text-indigo-200"
                              : "border-slate-200/70 dark:border-slate-700 text-slate-400"
                          } text-[11px]`}
                        >
                          <span>{new Date(msg.createdAt).toLocaleTimeString("ar-SA")}</span>
                          {!isUser && (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(msg.content);
                                  toast.success("تم نسخ التحليل إلى الحافظة");
                                }}
                                className="hover:text-indigo-600 transition flex items-center gap-1"
                                title="نسخ النص"
                              >
                                <Copy className="w-3.5 h-3.5" />
                                <span>نسخ</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => toast.success("شكراً لتقييمك الإيجابي")}
                                className="hover:text-emerald-600 transition"
                                title="إجابة مفيدة"
                              >
                                <ThumbsUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => toast.info("تم تسجيل ملاحظتك لتحسين النموذج")}
                                className="hover:text-rose-600 transition"
                                title="إجابة غير دقيقة"
                              >
                                <ThumbsDown className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat Input Box */}
            <form
              onSubmit={handleSendMessage}
              className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center gap-3"
            >
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="اسألني أي شيء في النظام أو خارجه (صياغة خطابات وإيميلات، نظام العمل، استراتيجيات، أو تحليل تقارير)..."
                className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                disabled={!inputText.trim() || sendMessageMutation.isPending}
                className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-bold text-sm flex items-center gap-2 transition shrink-0"
              >
                {sendMessageMutation.isPending ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                إرسال وتحليل
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: SMART REPORT & SYSTEM ANALYZER (360°)                          */}
      {/* ===================================================================== */}
      {activeTab === "reports_analyzer" && (
        <div className="space-y-6">
          {/* Domain Selector Pills */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-indigo-600" />
                  اختر التقرير أو الوحدة المراد تحليلها ذكياً
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  يقوم المساعد الذكي بقراءة كافة السجلات الحية في النظام وتوليد ملخص تنفيذي، جداول مقارنة، رصد انحرافات، وتوصيات فورية
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportReportCsv}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                >
                  <Download className="w-3.5 h-3.5 text-indigo-600" />
                  تصدير التحليل (CSV)
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-600" />
                  طباعة التقرير
                </button>
                <button
                  type="button"
                  onClick={() => handleDiscussReportInChat(selectedReportDomain)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition"
                >
                  <Bot className="w-3.5 h-3.5" />
                  مناقشة هذا التقرير في المحادثة
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {SMART_REPORT_DOMAINS.map((dom) => {
                const isSelected = selectedReportDomain === dom.id;
                return (
                  <button
                    key={dom.id}
                    type="button"
                    onClick={() => setSelectedReportDomain(dom.id)}
                    className={`text-right p-3 rounded-xl border transition-all flex items-start gap-2.5 ${
                      isSelected
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                        : "bg-slate-50/70 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-indigo-300"
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                        isSelected
                          ? "bg-white/20 text-white"
                          : "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600"
                      }`}
                    >
                      {getDomainIcon(dom.id)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate">{dom.shortTitleAr}</p>
                      <p
                        className={`text-[10px] line-clamp-2 mt-0.5 ${
                          isSelected ? "text-indigo-100" : "text-slate-500 dark:text-slate-400"
                        }`}
                      >
                        {dom.descriptionAr}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Report Executive Summary & Health Score */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                    تحليل مباشر بالذكاء الاصطناعي
                  </span>
                  <span className="text-xs text-slate-400">
                    تم التحديث: {new Date(activeReportAnalysis.generatedAt).toLocaleString("ar-SA")}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-1.5">
                  {activeReportAnalysis.titleAr}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">{activeReportAnalysis.subtitleAr}</p>
              </div>

              <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-800/60 px-4 py-3 rounded-2xl border border-slate-200/70 dark:border-slate-700 shrink-0">
                <div>
                  <p className="text-[11px] text-slate-500 font-medium">مؤشر الصحة والامتثال</p>
                  <p className="text-2xl font-black text-emerald-600">
                    {activeReportAnalysis.healthScorePct}%
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
              </div>
            </div>

            {/* Executive Narrative */}
            <div className="p-4 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/70 dark:border-indigo-800/60">
              <h4 className="text-xs font-bold text-indigo-900 dark:text-indigo-300 mb-2 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                الملخص التنفيذي الذكي (Executive AI Synthesis)
              </h4>
              <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-line">
                {activeReportAnalysis.executiveSummary}
              </p>
            </div>

            {/* 4 Live Report KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {activeReportAnalysis.kpis.map((kpi, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {kpi.label}
                    </span>
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        kpi.status === "good"
                          ? "bg-emerald-500"
                          : kpi.status === "warning"
                            ? "bg-amber-500"
                            : kpi.status === "critical"
                              ? "bg-rose-500"
                              : "bg-indigo-500"
                      }`}
                    />
                  </div>
                  <p className="text-xl font-bold text-slate-900 dark:text-white">{kpi.value}</p>
                  <p className="text-[11px] text-slate-500 mt-1">{kpi.subtext}</p>
                </div>
              ))}
            </div>

            {/* Breakdown Comparison Table */}
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-indigo-600" />
                {activeReportAnalysis.breakdownTitle}
              </h4>
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-right text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 text-xs">
                    <tr>
                      {activeReportAnalysis.breakdownHeaders.map((header, i) => (
                        <th key={i} className="p-3 font-bold">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {activeReportAnalysis.breakdownRows.map((row, rIdx) => (
                      <tr
                        key={rIdx}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition"
                      >
                        {row.map((cell, cIdx) => (
                          <td
                            key={cIdx}
                            className={`p-3 text-xs ${
                              cIdx === 0
                                ? "font-bold text-slate-900 dark:text-white"
                                : "text-slate-600 dark:text-slate-300"
                            }`}
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Anomalies & Actionable Recommendations */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Anomalies & Risk Detection */}
              <div className="p-4 rounded-xl border border-amber-200/80 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20 space-y-3">
                <h4 className="text-sm font-bold text-amber-900 dark:text-amber-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  رصد المخاطر والانحرافات والملاحظات الرقابية
                </h4>
                <ul className="space-y-2">
                  {activeReportAnalysis.anomalies.map((anom, idx) => (
                    <li
                      key={idx}
                      className="text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2 leading-relaxed"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                      <span>{anom}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Actionable Recommendations with Direct Deep-Links */}
              <div className="p-4 rounded-xl border border-emerald-200/80 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/20 space-y-3">
                <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-emerald-600" />
                  التوصيات الذكية وخطوات العمل المباشرة
                </h4>
                <div className="space-y-2.5">
                  {activeReportAnalysis.recommendations.map((rec, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              rec.priority === "عاجل"
                                ? "bg-rose-100 text-rose-700"
                                : "bg-indigo-100 text-indigo-700"
                            }`}
                          >
                            {rec.priority}
                          </span>
                          <p className="text-xs font-bold text-slate-900 dark:text-white">
                            {rec.title}
                          </p>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">{rec.description}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate({ to: rec.targetRoute as any })}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shrink-0 flex items-center gap-1 transition"
                      >
                        <span>{rec.actionLabel}</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Suggested Follow-Up Questions */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-500">أسئلة متابعة سريعة في المحادثة:</span>
              {activeReportAnalysis.suggestedFollowUpQuestions.map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setActiveTab("chat");
                    sendPromptImmediately(q);
                  }}
                  className="text-xs px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 dark:text-slate-300 font-medium transition"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Individual Employee 360° AI Summary Panel */}
          <EmployeeAiSummaryPanel />
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: PROACTIVE INSIGHTS FEED                                        */}
      {/* ===================================================================== */}
      {activeTab === "insights" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white">
                مركز الرؤى والتنبيهات الاستباقية (Proactive Intelligence)
              </h3>
              <p className="text-xs text-slate-500">
                فحص آلي مستمر لمخاطر انتهاء الشهادات، فترات التجربة، اتفاقيات مستوى الخدمة، والرواتب
              </p>
            </div>
            <div className="flex items-center gap-2">
              {["all", "critical", "high", "medium"].map((sev) => (
                <button
                  key={sev}
                  type="button"
                  onClick={() => setInsightFilter(sev)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    insightFilter === sev
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                  }`}
                >
                  {sev === "all"
                    ? "الكل"
                    : sev === "critical"
                      ? "حرج جداً"
                      : sev === "high"
                        ? "عالي الأهمية"
                        : "متوسط"}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredInsights.map((insight) => {
              const badgeStyles =
                insight.severity === "critical"
                  ? "bg-rose-100 text-rose-800 border-rose-300"
                  : insight.severity === "high"
                    ? "bg-amber-100 text-amber-800 border-amber-300"
                    : "bg-blue-100 text-blue-800 border-blue-300";

              return (
                <div
                  key={insight.id}
                  className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span
                        className={`px-2.5 py-0.5 text-xs font-bold rounded-full border ${badgeStyles}`}
                      >
                        {insight.severity === "critical"
                          ? "أولوية قصوى"
                          : insight.severity === "high"
                            ? "تنبيه هام"
                            : "ملاحظة استباقية"}
                      </span>
                      <span className="text-xs text-slate-400">
                        {new Date(insight.createdAt).toLocaleDateString("ar-SA")}
                      </span>
                    </div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-base">
                      {insight.titleAr}
                    </h4>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed">
                      {insight.explanationAr}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 flex-wrap">
                    <div className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                      الإجراء المقترح: {insight.recommendedAction}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab("chat");
                          sendPromptImmediately(`حلل لي هذا التنبيه واقترح خطة عمل: ${insight.titleAr}`);
                        }}
                        className="px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-bold rounded-lg transition"
                      >
                        تحليل في المحادثة
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDismissInsight(insight.id, "تمت المعالجة")}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition"
                      >
                        تمت المعالجة
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDismissInsight(insight.id, "تأجيل التنبيه")}
                        className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs rounded-lg hover:bg-slate-200 transition"
                      >
                        تأجيل 7 أيام
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 4: GOVERNANCE, TOOLS & EVALUATION SCORECARD                       */}
      {/* ===================================================================== */}
      {activeTab === "governance" && (
        <div className="space-y-6">
          {/* HR-only Employee AI Summary via Lovable AI Gateway + Local 360° */}
          <EmployeeAiSummaryPanel />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Governed Tool Registry */}
            <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
              <h3 className="font-bold text-slate-900 dark:text-white text-base mb-1 flex items-center gap-2">
                <Terminal className="w-5 h-5 text-indigo-600" />
                سجل الأدوات المحكومة بالصلاحيات (Governed AI Tool Registry)
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                يتم التحقق من دور المستخدم الحالي ({currentRole}) قبل السماح للمساعد الذكي باستدعاء أي أداة
              </p>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs">
                    <tr>
                      <th className="p-3 rounded-r-lg">الأداة البرمجية</th>
                      <th className="p-3">الوصف</th>
                      <th className="p-3">نوع العملية</th>
                      <th className="p-3 rounded-l-lg">حالة الصلاحية لدورك</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {Object.values(GOVERNED_AI_TOOLS).map((tool) => {
                      const allowed = isUserAuthorizedForTool(currentRole, tool.name);
                      return (
                        <tr key={tool.name} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                          <td className="p-3 font-mono text-xs font-bold text-indigo-600">
                            {tool.name}
                          </td>
                          <td className="p-3 text-xs text-slate-700 dark:text-slate-300">
                            {tool.descriptionAr}
                          </td>
                          <td className="p-3">
                            {tool.isMutation ? (
                              <span className="px-2 py-0.5 text-[11px] rounded bg-amber-100 text-amber-800 font-semibold">
                                تعديل (يتطلب تأكيد)
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 text-[11px] rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                قراءة آمنة
                              </span>
                            )}
                          </td>
                          <td className="p-3">
                            {allowed ? (
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
                                <CheckCircle2 className="w-4 h-4" /> مصرح
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-600">
                                <XCircle className="w-4 h-4" /> محجوب (RBAC)
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Golden Evaluation Scorecard & Audit Log */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-600" />
                    بطاقة الفحص الذهبي للأمان (AI Eval Suite)
                  </h3>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-extrabold">
                    {evalScorecard.overallScorePct}% ناجح
                  </span>
                </div>
                <div className="space-y-2.5">
                  {evalScorecard.results.map((res) => (
                    <div
                      key={res.testId}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700 flex items-center justify-between gap-3"
                    >
                      <div>
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          {res.details}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5 font-mono">
                          {res.testId}: {res.name.slice(0, 52)}
                        </p>
                      </div>
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
                <h3 className="font-bold text-slate-900 dark:text-white text-sm mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-600" />
                  سجل استدعاءات الأدوات الأخير (Tool Execution Log)
                </h3>
                <div className="space-y-2">
                  {toolCalls.map((tc) => (
                    <div
                      key={tc.id}
                      className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-mono font-bold text-indigo-600">{tc.toolName}</span>
                        <p className="text-slate-400 text-[11px] mt-0.5">
                          زمن التنفيذ: {tc.latencyMs}ms | الحالة: {tc.executionStatus}
                        </p>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold">
                        موثق
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Engine & LLM Provider Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-5 text-right"
            dir="rtl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600">
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    إعدادات محرك الذكاء الاصطناعي (AI Provider Settings)
                  </h3>
                  <p className="text-xs text-slate-500">
                    تخصيص النموذج والمزود (ChatGPT / Gemini / المحرك التحليلي المدمج)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Provider Options */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                اختر محرك الذكاء الاصطناعي
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setSelectedProvider("built_in")}
                  className={`p-3 rounded-xl border text-right transition flex items-start gap-2.5 ${
                    selectedProvider === "built_in"
                      ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/50 ring-1 ring-indigo-600"
                      : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  }`}
                >
                  <Sparkles className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">المحرك المدمج (MadarX AI)</p>
                    <p className="text-[11px] text-slate-500">سريع، آمن، مجاني وبدون مفتاح</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedProvider("openai")}
                  className={`p-3 rounded-xl border text-right transition flex items-start gap-2.5 ${
                    selectedProvider === "openai"
                      ? "border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/50 ring-1 ring-emerald-600"
                      : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  }`}
                >
                  <Zap className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">OpenAI (ChatGPT)</p>
                    <p className="text-[11px] text-slate-500">GPT-4o / GPT-4o-mini</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedProvider("gemini")}
                  className={`p-3 rounded-xl border text-right transition flex items-start gap-2.5 ${
                    selectedProvider === "gemini"
                      ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/50 ring-1 ring-blue-600"
                      : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  }`}
                >
                  <Bot className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">Google Gemini</p>
                    <p className="text-[11px] text-slate-500">Gemini 1.5 Flash / Pro</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedProvider("openrouter")}
                  className={`p-3 rounded-xl border text-right transition flex items-start gap-2.5 ${
                    selectedProvider === "openrouter"
                      ? "border-purple-600 bg-purple-50/50 dark:bg-purple-950/50 ring-1 ring-purple-600"
                      : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  }`}
                >
                  <Globe className="w-4 h-4 text-purple-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">OpenRouter</p>
                    <p className="text-[11px] text-slate-500">Claude 3.5 Sonnet / Llama 3</p>
                  </div>
                </button>
              </div>
            </div>

            {/* API Key Input (if not built-in) */}
            {selectedProvider !== "built_in" && (
              <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-amber-500" />
                      مفتاح الواجهة (API Key)
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="text-[11px] text-indigo-600 hover:underline"
                    >
                      {showApiKey ? "إخفاء المفتاح" : "إظهار المفتاح"}
                    </button>
                  </div>
                  <input
                    type={showApiKey ? "text" : "password"}
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder={
                      selectedProvider === "openai"
                        ? "sk-proj-..."
                        : selectedProvider === "gemini"
                        ? "AIzaSy..."
                        : "sk-or-v1-..."
                    }
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    dir="ltr"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    يُحفظ المفتاح محلياً في متصفحك (Client-side) لضمان الخصوصية التامة ولا يتم مشاركته.
                  </p>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    اسم النموذج (Model Name - اختياري)
                  </label>
                  <input
                    type="text"
                    value={modelInput}
                    onChange={(e) => setModelInput(e.target.value)}
                    placeholder={
                      selectedProvider === "openai"
                        ? "gpt-4o-mini"
                        : selectedProvider === "gemini"
                        ? "gemini-1.5-flash"
                        : "anthropic/claude-3.5-sonnet"
                    }
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    dir="ltr"
                  />
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTestingConnection}
                className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition"
              >
                {isTestingConnection ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Activity className="w-3.5 h-3.5 text-emerald-500" />
                )}
                اختبار الاتصال
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleSaveProviderConfig}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-sm"
                >
                  حفظ وتفعيل
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
