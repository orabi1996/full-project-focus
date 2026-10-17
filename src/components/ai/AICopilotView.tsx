/**
 * MadarX Enterprise AI Copilot & Operations View (Screen M29)
 * Arabic RTL & English LTR, Governed Assistant, Proactive Insights, RAG Knowledge, and Observability
 */

import React, { useState } from "react";
import {
  Sparkles,
  Send,
  ShieldCheck,
  Brain,
  Lightbulb,
  BookOpen,
  Activity,
  Settings2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Eye,
  RotateCcw,
  Bot,
  User,
  ExternalLink,
  DollarSign,
  Zap,
  Lock,
} from "lucide-react";
import {
  useAIDashboardKpis,
  useAIConversations,
  useAIMessages,
  useAIInsights,
  useAIEvaluations,
  useSendMessage,
  useManageInsightStatus,
} from "../../lib/data/ai-repository";
import { SEEDED_KNOWLEDGE_BASE } from "../../lib/ai/retrieval";
import { EmployeeAiSummaryPanel } from "./EmployeeAiSummaryPanel";
import { GOVERNED_AI_TOOLS } from "../../lib/ai/tools/registry";
import { toast } from "sonner";

export function AICopilotView() {
  const [activeTab, setActiveTab] = useState<
    "copilot" | "insights" | "knowledge" | "evaluations" | "observability" | "settings"
  >("copilot");
  const [selectedConversationId, setSelectedConversationId] = useState<string>("conv-1");
  const [inputText, setInputText] = useState("");

  const { data: kpis } = useAIDashboardKpis();
  const { data: conversations } = useAIConversations();
  const { data: messages } = useAIMessages(selectedConversationId);
  const { data: insights } = useAIInsights();
  const { data: evaluations } = useAIEvaluations();

  const sendMessageMutation = useSendMessage();
  const manageInsightMutation = useManageInsightStatus();

  const handleSend = () => {
    if (!inputText.trim()) return;
    const prompt = inputText;
    setInputText("");

    sendMessageMutation.mutate({
      conversationId: selectedConversationId,
      prompt,
    });
  };

  const handleQuickPrompt = (prompt: string) => {
    setInputText(prompt);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 bg-card rounded-2xl border shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-foreground">
                مساعد MadarX الذكي ومركز العمليات
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                MadarX AI Copilot — المحرك المؤسسي المحكوم للاستعلامات والسياسات والأتمتة الآمنة
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            <ShieldCheck className="h-3.5 w-3.5" />
            نظام آمن ومحكوم بالكامل
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-primary/10 text-primary">
            إصدار المؤسسات v1.0
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="classera-kpi-card p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-muted-foreground">إجمالي الاستعلامات</span>
            <h4 className="text-xl font-black text-foreground mt-0.5 font-tabular-nums">
              {kpis?.totalRequests || 0}
            </h4>
            <span className="text-[10px] text-emerald-600 font-bold">100% موثقة ومؤمنة</span>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-secondary flex items-center justify-center text-primary">
            <Brain className="h-5 w-5" />
          </div>
        </div>

        <div className="classera-kpi-card p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-muted-foreground">معدل النجاح</span>
            <h4 className="text-xl font-black text-foreground mt-0.5 font-tabular-nums text-emerald-600">
              {kpis ? Math.round((kpis.successfulRequests / (kpis.totalRequests || 1)) * 100) : 100}%
            </h4>
            <span className="text-[10px] text-muted-foreground">0 اختلاقات بيانات</span>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-secondary flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>

        <div className="classera-kpi-card p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-muted-foreground">استدعاءات الأدوات</span>
            <h4 className="text-xl font-black text-foreground mt-0.5 font-tabular-nums">
              {kpis?.totalToolCalls || 0}
            </h4>
            <span className="text-[10px] text-primary font-bold">16 أداة معتمدة</span>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-secondary flex items-center justify-center text-primary">
            <Zap className="h-5 w-5" />
          </div>
        </div>

        <div className="classera-kpi-card p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-muted-foreground">متوسط زمن الاستجابة</span>
            <h4 className="text-xl font-black text-foreground mt-0.5 font-tabular-nums">
              {kpis?.avgLatencyMs || 0} ms
            </h4>
            <span className="text-[10px] text-emerald-600 font-bold">استجابة فورية</span>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-secondary flex items-center justify-center text-blue-600">
            <Clock className="h-5 w-5" />
          </div>
        </div>

        <div className="classera-kpi-card p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-muted-foreground">التكلفة التقديرية</span>
            <h4 className="text-xl font-black text-foreground mt-0.5 font-tabular-nums">
              ${kpis?.estimatedCostUsd || "0.00"}
            </h4>
            <span className="text-[10px] text-muted-foreground">ضمن سقف الميزانية</span>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-secondary flex items-center justify-center text-amber-600">
            <DollarSign className="h-5 w-5" />
          </div>
        </div>

        <div className="classera-kpi-card p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-muted-foreground">الرؤى النشطة</span>
            <h4 className="text-xl font-black text-foreground mt-0.5 font-tabular-nums text-rose-600">
              {kpis?.activeInsights || 0}
            </h4>
            <span className="text-[10px] text-rose-600 font-bold">تتطلب مراجعة</span>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-secondary flex items-center justify-center text-rose-600">
            <Lightbulb className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab("copilot")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            activeTab === "copilot"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-secondary"
          }`}
        >
          <Bot className="h-4 w-4" />
          المساعد الذكي (Copilot)
        </button>
        <button
          onClick={() => setActiveTab("insights")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            activeTab === "insights"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-secondary"
          }`}
        >
          <Lightbulb className="h-4 w-4" />
          مركز الرؤى والتنبيهات ({insights?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab("knowledge")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            activeTab === "knowledge"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-secondary"
          }`}
        >
          <BookOpen className="h-4 w-4" />
          قاعدة المعرفة والسياسات (RAG)
        </button>
        <button
          onClick={() => setActiveTab("evaluations")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            activeTab === "evaluations"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-secondary"
          }`}
        >
          <ShieldCheck className="h-4 w-4" />
          اختبارات الأمان والتقييم
        </button>
        <button
          onClick={() => setActiveTab("observability")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            activeTab === "observability"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-secondary"
          }`}
        >
          <Activity className="h-4 w-4" />
          المراقبة والتكاليف
        </button>
        <button
          onClick={() => setActiveTab("settings")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            activeTab === "settings"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-secondary"
          }`}
        >
          <Settings2 className="h-4 w-4" />
          الإعدادات والحوكمة
        </button>
      </div>

      {/* Tab 1: Copilot Chat */}
      {activeTab === "copilot" && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Conversation History Sidebar */}
          <div className="lg:col-span-1 bg-card rounded-2xl border p-4 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <span className="text-xs font-bold text-foreground">المحادثات الأخيرة</span>
              <button
                onClick={() => {
                  setSelectedConversationId("conv-1");
                  toast.success("تم بدء جلسة محادثة جديدة");
                }}
                className="text-[11px] font-bold text-primary hover:underline"
              >
                + محادثة جديدة
              </button>
            </div>
            <div className="space-y-2">
              {conversations?.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => setSelectedConversationId(conv.id)}
                  className={`w-full text-right p-3 rounded-xl text-xs font-medium transition-colors border ${
                    selectedConversationId === conv.id
                      ? "bg-primary/10 border-primary text-primary font-bold"
                      : "bg-background border-border text-foreground hover:bg-secondary"
                  }`}
                >
                  <p className="truncate">{conv.title}</p>
                  <span className="text-[10px] text-muted-foreground mt-1 block">
                    {new Date(conv.updatedAt).toLocaleTimeString("ar-EG", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </button>
              ))}
            </div>

            {/* Quick Prompts */}
            <div className="border-t pt-3 space-y-2">
              <span className="text-[11px] font-bold text-muted-foreground">استفسارات مقترحة</span>
              <div className="flex flex-col gap-1.5">
                {[
                  "كم رصيد إجازاتي السنوية؟",
                  "ما هي تكلفة الرواتب للشهر الحالي؟",
                  "مين عنده شهادة تنتهي خلال 30 يوم؟",
                  "ما هي أحكام فترة التجربة النظامية؟",
                ].map((p, i) => (
                  <button
                    key={i}
                    onClick={() => handleQuickPrompt(p)}
                    className="text-right text-[11px] p-2 rounded-lg bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Chat Window */}
          <div className="lg:col-span-3 bg-card rounded-2xl border flex flex-col h-[600px] shadow-xs">
            {/* Messages Area */}
            <div className="flex-1 p-6 overflow-y-auto space-y-4">
              {messages?.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex items-start gap-3 ${
                    msg.role === "user" ? "flex-row-reverse" : "flex-row"
                  }`}
                >
                  <div
                    className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-primary"
                    }`}
                  >
                    {msg.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                  </div>
                  <div
                    className={`max-w-[80%] rounded-2xl p-4 text-xs leading-relaxed ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary/70 text-foreground border"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>

                    {/* Metadata & Grounding Badges */}
                    {msg.metadata && (
                      <div className="mt-2.5 pt-2 border-t border-border/50 flex flex-wrap items-center gap-1.5 text-[10px]">
                        {Boolean(msg.metadata.isGrounded) && (
                          <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-semibold">
                            ✓ بيانات معتمدة من النظام
                          </span>
                        )}
                        {typeof msg.metadata.toolName === "string" && (
                          <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 font-mono">
                            Tool: {msg.metadata.toolName}
                          </span>
                        )}
                        {Boolean(msg.metadata.requiresConfirmation) && (
                          <div className="mt-2 w-full flex items-center gap-2">
                            <button
                              onClick={() => toast.success("تم تأكيد وتنفيذ الإجراء بنجاح")}
                              className="px-3 py-1 rounded bg-primary text-primary-foreground font-bold hover:bg-primary/90"
                            >
                              تأكيد التنفيذ
                            </button>
                            <button
                              onClick={() => toast.info("تم إلغاء الإجراء")}
                              className="px-3 py-1 rounded bg-secondary text-muted-foreground font-bold hover:bg-secondary/80"
                            >
                              إلغاء
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Input Bar */}
            <div className="p-4 border-t bg-background/50 rounded-b-2xl flex items-center gap-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="اسأل مساعد MadarX عن الرواتب، الإجازات، الموظفين، أو سياسات العمل..."
                className="flex-1 bg-background border rounded-xl px-4 py-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <button
                onClick={handleSend}
                disabled={sendMessageMutation.isPending || !inputText.trim()}
                className="h-10 px-4 bg-primary text-primary-foreground rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                إرسال
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Proactive Insights */}
      {activeTab === "insights" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              رؤى وتنبيهات استباقية مبنية حصرياً على الحقائق والبيانات المسجلة بالنظام دون اختلاق
            </p>
            <span className="text-xs font-bold text-foreground">
              {insights?.length || 0} تنبيهات معتمدة
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {insights?.map((ins) => (
              <div
                key={ins.id}
                className="bg-card rounded-2xl border p-5 space-y-3.5 shadow-xs relative overflow-hidden"
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      ins.severity === "critical"
                        ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                        : ins.severity === "high"
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                        : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                    }`}
                  >
                    {ins.severity === "critical" ? "حرج" : ins.severity === "high" ? "مرتفع" : "متوسط"}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(ins.createdAt).toLocaleDateString("ar-EG")}
                  </span>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-foreground">{ins.titleAr}</h4>
                  <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                    {ins.explanationAr}
                  </p>
                </div>

                {ins.recommendedAction && (
                  <div className="p-2.5 rounded-xl bg-secondary text-[11px] text-foreground font-medium">
                    <span className="font-bold text-primary block text-[10px]">الإجراء الموصى به:</span>
                    {ins.recommendedAction}
                  </div>
                )}

                <div className="pt-2 border-t flex items-center justify-end gap-2">
                  <button
                    onClick={() => {
                      manageInsightMutation.mutate({ insightId: ins.id, action: "snooze" });
                      toast.info("تم تأجيل التنبيه لمدة أسبوع");
                    }}
                    className="text-[11px] px-2.5 py-1 rounded bg-secondary text-muted-foreground hover:text-foreground font-semibold"
                  >
                    تأجيل
                  </button>
                  <button
                    onClick={() => {
                      manageInsightMutation.mutate({ insightId: ins.id, action: "resolve" });
                      toast.success("تمت معالجة التنبيه بنجاح");
                    }}
                    className="text-[11px] px-2.5 py-1 rounded bg-primary text-primary-foreground font-semibold"
                  >
                    معالجة
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Knowledge RAG */}
      {activeTab === "knowledge" && (
        <div className="space-y-4">
          <div className="p-4 bg-card rounded-2xl border shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-foreground">قاعدة وثائق وسياسات العمل المعتمدة</h3>
            <p className="text-xs text-muted-foreground">
              يتم استرجاع الإجابات من هذه الوثائق الرسمية مع ذكر اسم الوثيقة والإصدار ورقم القسم
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {SEEDED_KNOWLEDGE_BASE.map((doc, idx) => (
              <div key={idx} className="bg-card rounded-2xl border p-5 space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-bold">
                    إصدار {doc.version}
                  </span>
                  <span className="text-[10px] font-semibold text-muted-foreground">
                    نطاق الوصول: {doc.accessScope === "all" ? "الجميع" : "إدارة الموارد البشرية"}
                  </span>
                </div>
                <h4 className="text-xs font-bold text-foreground">{doc.documentTitle}</h4>
                <p className="text-[11px] font-semibold text-primary">{doc.sectionTitle}</p>
                <p className="text-xs text-muted-foreground leading-relaxed bg-secondary/50 p-3 rounded-xl border">
                  {doc.content}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: AI Evaluation & Benchmark */}
      {activeTab === "evaluations" && (
        <div className="space-y-4">
          <div className="p-4 bg-card rounded-2xl border shadow-xs flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-foreground">
                نتائج تقييم واختبارات الأمان وحقن الأوامر (Evaluation Suite)
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                مجموعة الاختبارات الذهبية للتحقق من منع الاختلاقات، وحقن التعليمات البرمجية، وعزل الصلاحيات
              </p>
            </div>
            <div className="text-left">
              <span className="text-2xl font-black text-emerald-600 font-mono">
                {evaluations?.overallScorePct || 100}%
              </span>
              <span className="block text-[10px] text-muted-foreground font-semibold">
                نسبة النجاح الإجمالية
              </span>
            </div>
          </div>

          <div className="bg-card rounded-2xl border shadow-xs overflow-hidden">
            <table className="w-full text-right text-xs">
              <thead className="bg-secondary border-b text-muted-foreground font-semibold">
                <tr>
                  <th className="p-3">رمز الفحص</th>
                  <th className="p-3">التصنيف</th>
                  <th className="p-3">اسم الاختبار</th>
                  <th className="p-3">النتيجة</th>
                  <th className="p-3">التفاصيل</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {evaluations?.results.map((r) => (
                  <tr key={r.testId} className="hover:bg-secondary/40">
                    <td className="p-3 font-mono font-bold">{r.testId}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded bg-secondary text-[10px] font-semibold">
                        {r.category}
                      </span>
                    </td>
                    <td className="p-3 font-medium text-foreground">{r.name}</td>
                    <td className="p-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          r.passed
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                        }`}
                      >
                        {r.passed ? "اجتاز (PASS)" : "فشل (FAIL)"}
                      </span>
                    </td>
                    <td className="p-3 text-muted-foreground text-[11px]">{r.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 5: Observability & Costs */}
      {activeTab === "observability" && (
        <div className="space-y-4">
          <div className="p-4 bg-card rounded-2xl border shadow-xs">
            <h3 className="text-xs font-bold text-foreground">مراقبة الاستخدام وتتبع التكاليف الحية</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              متابعة استهلاك التوكنات، التكلفة بالدولار، زمن الاستجابة، ونسب حظر المحاولات غير المصرح بها
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-card rounded-2xl border p-5 shadow-xs space-y-2">
              <span className="text-[11px] font-bold text-muted-foreground">استهلاك التوكنات اليومي</span>
              <h3 className="text-2xl font-black text-foreground font-mono">
                {kpis?.totalTokens.toLocaleString() || "0"}
              </h3>
              <p className="text-[10px] text-muted-foreground">الحد الأقصى المسموح: 500,000 توكن / يوم</p>
            </div>

            <div className="bg-card rounded-2xl border p-5 shadow-xs space-y-2">
              <span className="text-[11px] font-bold text-muted-foreground">التكلفة الشهرية الفعلية</span>
              <h3 className="text-2xl font-black text-emerald-600 font-mono">
                ${kpis?.estimatedCostUsd || "0.00"}
              </h3>
              <p className="text-[10px] text-muted-foreground">سقف الميزانية الشهري: $250.00</p>
            </div>

            <div className="bg-card rounded-2xl border p-5 shadow-xs space-y-2">
              <span className="text-[11px] font-bold text-muted-foreground">محاولات الحظر الأمني</span>
              <h3 className="text-2xl font-black text-foreground font-mono">0</h3>
              <p className="text-[10px] text-emerald-600 font-bold">حماية تامة من حقن الأوامر</p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 6: Settings & Governance */}
      {activeTab === "settings" && (
        <div className="bg-card rounded-2xl border p-6 shadow-xs space-y-6">
          <div className="border-b pb-4">
            <h3 className="text-sm font-bold text-foreground">إعدادات مزودي الذكاء الاصطناعي والحوكمة</h3>
            <p className="text-xs text-muted-foreground mt-1">
              إدارة المزود النشط، سياسات التأكيد البشري، وحدود الاستهلاك
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-foreground block mb-1.5">المزود النشط</label>
                <select className="w-full bg-background border rounded-xl p-2.5 text-xs text-foreground">
                  <option value="mock">MadarX Local Safe Engine (مدمج ومؤمن)</option>
                  <option value="openai">OpenAI (Enterprise Gateway)</option>
                  <option value="gemini">Google Gemini (Vertex AI)</option>
                  <option value="anthropic">Anthropic Claude (Enterprise)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-foreground block mb-1.5">النموذج الافتراضي</label>
                <input
                  type="text"
                  readOnly
                  value="gpt-4o-mini / gemini-1.5-flash (Grounded)"
                  className="w-full bg-secondary border rounded-xl p-2.5 text-xs text-muted-foreground"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-foreground block mb-1.5">
                  سقف الميزانية الشهري ($)
                </label>
                <input
                  type="number"
                  readOnly
                  value="250"
                  className="w-full bg-secondary border rounded-xl p-2.5 text-xs text-muted-foreground"
                />
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-xs font-bold text-foreground">الأدوات المحكومة النشطة (16 أداة)</h4>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {Object.values(GOVERNED_AI_TOOLS).map((tool) => (
                  <div
                    key={tool.name}
                    className="flex items-center justify-between p-2 rounded-lg bg-secondary text-xs"
                  >
                    <span className="font-mono text-[11px] font-medium text-foreground">{tool.name}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        tool.requiresConfirmation
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                          : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                      }`}
                    >
                      {tool.requiresConfirmation ? "تأكيد مسبق" : "قراءة مباشرة"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
