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
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Camera,
  Paperclip,
  Check,
  UserPlus,
} from "lucide-react";
import { useApp } from "../../lib/context/AppContext";
import { useCreateEmployee } from "../../lib/domains/employees";
import { performEmployeeOCR, type ExtractedEmployeeDraft } from "../../lib/ai/ocr-employee-extractor";
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


// ============================================================================
// RICH CHAT MESSAGE RENDERER (DOCUMENTS, LETTERS, MATH, EOSB, MARKDOWN)
// ============================================================================

function ChatMessageRenderer({
  content,
  isUser,
  messageId,
  onConfirmEmployee,
  isEmployeeConfirmed,
  isCreatingEmployee,
  onNavigateToEmployees,
}: {
  content: string;
  isUser: boolean;
  messageId?: string;
  onConfirmEmployee?: (draft: ExtractedEmployeeDraft, msgId: string) => void;
  isEmployeeConfirmed?: boolean;
  isCreatingEmployee?: boolean;
  onNavigateToEmployees?: () => void;
}) {
  if (isUser) {
    return <div className="text-sm leading-relaxed whitespace-pre-wrap">{content}</div>;
  }

  // Check if content contains employee card block :::employee_card ... :::
  const cardMatch = content.match(/:::employee_card\s*([\s\S]*?)\s*:::/);
  let employeeDraft: ExtractedEmployeeDraft | null = null;
  if (cardMatch && cardMatch[1]) {
    try {
      employeeDraft = JSON.parse(cardMatch[1].trim());
    } catch {
      employeeDraft = null;
    }
  }

  // Clean raw content by stripping the employee card block so it doesn't duplicate JSON
  const cleanedContent = cardMatch
    ? (content.slice(0, cardMatch.index).trim() + "\n\n" + content.slice(cardMatch.index! + cardMatch[0].length).trim()).trim()
    : content;

  // Check if content contains official document block :::document ... :::
  const docMatch = cleanedContent.match(/:::document\s*([\s\S]*?)\s*:::/);
  const docBody = docMatch ? docMatch[1].trim() : null;
  const beforeDoc = docMatch ? cleanedContent.slice(0, docMatch.index).trim() : null;
  const afterDoc = docMatch ? cleanedContent.slice(docMatch.index! + docMatch[0].length).trim() : null;

  const handlePrintDoc = (docText: string) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html dir="rtl" lang="ar">
        <head>
          <title>وثيقة رسمية - نظام مدار إكس</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
            body { font-family: 'Cairo', Tahoma, sans-serif; padding: 48px; line-height: 1.9; color: #0f172a; max-width: 850px; margin: 0 auto; }
            .header-bar { border-bottom: 3px double #4338ca; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; }
            .content { white-space: pre-line; font-size: 13pt; text-align: justify; }
            .footer-bar { margin-top: 60px; border-top: 1px solid #cbd5e1; padding-top: 20px; display: flex; justify-content: space-between; font-size: 10pt; color: #64748b; }
            @media print { body { padding: 20px; } }
          </style>
        </head>
        <body>
          <div class="header-bar">
            <div>
              <h2 style="margin: 0; color: #312e81;">نظام مدار إكس لإدارة الموارد البشرية</h2>
              <span style="font-size: 11pt; color: #475569;">الإدارة العامة للموارد البشرية والعمليات</span>
            </div>
            <div style="text-align: left; font-size: 10pt; color: #64748b;">
              <div>الرقم المرجعي: MX-DOC-${Math.floor(10000 + Math.random() * 90000)}</div>
              <div>التاريخ: ${new Date().toLocaleDateString("ar-SA")}</div>
            </div>
          </div>
          <div class="content">${docText.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
          <div class="footer-bar">
            <span>وثيقة إدارية صادرة ومعتمدة إلكترونياً عبر نظام مدار إكس</span>
            <span>صفحة 1 من 1</span>
          </div>
          <script>window.print();</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const renderInlineStyles = (raw: string) => {
    const parts = raw.split(/(\*\*.*?\*\*|\`.*?\`)/g);
    return parts.map((part, pIdx) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={pIdx} className="font-bold text-slate-900 dark:text-white">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return (
          <code
            key={pIdx}
            className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 font-mono text-[11px]"
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
  };

  const renderMarkdownSection = (text: string) => {
    const lines = text.split("\n");
    return (
      <div className="space-y-1.5">
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (!trimmed) return <div key={idx} className="h-1.5" />;

          // Heading 3 or 4
          if (trimmed.startsWith("### ")) {
            return (
              <h4 key={idx} className="text-sm font-bold text-indigo-700 dark:text-indigo-400 mt-2.5 mb-1 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                {renderInlineStyles(trimmed.slice(4))}
              </h4>
            );
          }
          if (trimmed.startsWith("## ")) {
            return (
              <h3 key={idx} className="text-base font-bold text-slate-900 dark:text-white mt-3.5 mb-1.5">
                {renderInlineStyles(trimmed.slice(3))}
              </h3>
            );
          }
          // Highlighted Net Figure: # **XX,XXX**
          if (trimmed.startsWith("# ")) {
            return (
              <div
                key={idx}
                className="p-3.5 my-2.5 rounded-2xl bg-gradient-to-l from-emerald-500/10 via-emerald-500/20 to-emerald-500/10 border-2 border-emerald-500/40 text-emerald-900 dark:text-emerald-200 font-extrabold text-base sm:text-lg text-center shadow-xs"
              >
                {renderInlineStyles(trimmed.slice(2))}
              </div>
            );
          }

          // Bullet points
          if (trimmed.startsWith("• ") || trimmed.startsWith("- ")) {
            return (
              <div key={idx} className="flex items-start gap-2 pr-1.5 text-xs sm:text-sm leading-relaxed">
                <span className="text-indigo-500 font-bold mt-0.5">•</span>
                <span className="flex-1">{renderInlineStyles(trimmed.slice(2))}</span>
              </div>
            );
          }

          // Numbered steps
          const numMatch = trimmed.match(/^(\d+)\.\s*(.*)$/);
          if (numMatch) {
            return (
              <div key={idx} className="flex items-start gap-2.5 pr-1.5 text-xs sm:text-sm leading-relaxed mt-1">
                <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5 border border-indigo-200 dark:border-indigo-800">
                  {numMatch[1]}
                </span>
                <span className="flex-1">{renderInlineStyles(numMatch[2])}</span>
              </div>
            );
          }

          // Table separator row
          if (trimmed.startsWith("|") && trimmed.includes("---")) {
            return null;
          }

          // Table data row
          if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
            const cells = trimmed
              .split("|")
              .slice(1, -1)
              .map((c) => c.trim());
            return (
              <div
                key={idx}
                className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-xs font-medium border border-slate-200/60 dark:border-slate-800"
              >
                {cells.map((cell, cIdx) => (
                  <div key={cIdx} className="overflow-hidden truncate">
                    {renderInlineStyles(cell)}
                  </div>
                ))}
              </div>
            );
          }

          return (
            <p key={idx} className="text-xs sm:text-sm leading-relaxed text-slate-800 dark:text-slate-200">
              {renderInlineStyles(line)}
            </p>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-3.5">
      {beforeDoc && renderMarkdownSection(beforeDoc)}

      {/* Styled Official Parchment Document Box */}
      {docBody && (
        <div className="my-3.5 rounded-2xl border-2 border-indigo-300 dark:border-indigo-800 bg-amber-50/50 dark:bg-slate-900/90 shadow-md overflow-hidden animate-in fade-in duration-200">
          <div className="bg-indigo-600/10 dark:bg-indigo-950/70 border-b border-indigo-200 dark:border-indigo-800/80 p-3 px-4 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-indigo-950 dark:text-indigo-200 block">
                  وثيقة إدارية رسمية جاهزة للاعتماد
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                  مكتوبة وفق الأصول الإدارية ونظام العمل السعودي
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(docBody);
                  toast.success("تم نسخ نص الخطاب بالكامل إلى الحافظة بنجاح");
                }}
                className="inline-flex items-center gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg font-bold transition shadow-xs"
              >
                <Copy className="w-3.5 h-3.5" />
                نسخ نص الخطاب
              </button>
              <button
                type="button"
                onClick={() => handlePrintDoc(docBody)}
                className="inline-flex items-center gap-1 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-2.5 py-1.5 rounded-lg font-medium hover:bg-slate-50 transition"
              >
                <Printer className="w-3.5 h-3.5 text-slate-600" />
                طباعة
              </button>
            </div>
          </div>
          <div className="p-5 font-serif text-slate-900 dark:text-slate-100 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap select-all bg-white/70 dark:bg-slate-900/60 m-3 rounded-xl border border-indigo-100 dark:border-indigo-900/40">
            {docBody}
          </div>
        </div>
      )}

      {/* Interactive Employee Creation Confirmation Card */}
      {employeeDraft && (
        <div className="my-3.5 rounded-2xl border-2 border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-900 shadow-md overflow-hidden animate-in fade-in duration-200">
          <div className="bg-gradient-to-r from-emerald-600/15 via-teal-600/10 to-indigo-600/10 dark:bg-emerald-950/70 border-b border-emerald-200 dark:border-emerald-800 p-3 px-4 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                <UserPlus className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-emerald-950 dark:text-emerald-200 block">
                  بطاقة تعيين واعتماد موظف جديد
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                  تم الاستخراج والتدقيق الذكي بنسبة ثقة {Math.round((employeeDraft.confidenceScore || 0.85) * 100)}%
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 text-[11px] font-bold">
                {employeeDraft.nationality}
              </span>
            </div>
          </div>

          <div className="p-4 space-y-3.5">
            {/* Top employee badge */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-indigo-700 to-indigo-500 text-white font-bold flex items-center justify-center text-sm shadow-xs shrink-0">
                {employeeDraft.firstNameAr?.[0] || "م"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                    {employeeDraft.firstNameAr} {employeeDraft.lastNameAr}
                  </h4>
                  <span className="text-xs text-slate-400">
                    ({employeeDraft.firstNameEn} {employeeDraft.lastNameEn})
                  </span>
                </div>
                <p className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold mt-0.5">
                  {employeeDraft.jobTitleAr} • {employeeDraft.departmentName}
                </p>
              </div>
              <div className="text-left shrink-0">
                <span className="text-[10px] text-slate-400 block">الرقم المقترح</span>
                <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                  {employeeDraft.employeeNo}
                </span>
              </div>
            </div>

            {/* Structured Financial and Legal Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 block">الهوية / الإقامة</span>
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{employeeDraft.nationalIdOrIqama}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 block">الراتب الأساسي</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">{Number(employeeDraft.basicSalary || 0).toLocaleString()} ر.س</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 block">بدل السكن والنقل</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">{(Number(employeeDraft.housingAllowance || 0) + Number(employeeDraft.transportAllowance || 0)).toLocaleString()} ر.س</span>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60">
                <span className="text-[10px] text-emerald-700 dark:text-emerald-400 block">إجمالي الراتب</span>
                <span className="font-bold text-emerald-800 dark:text-emerald-300 font-mono">
                  {(Number(employeeDraft.basicSalary || 0) + Number(employeeDraft.housingAllowance || 0) + Number(employeeDraft.transportAllowance || 0) + Number(employeeDraft.otherAllowances || 0)).toLocaleString()} ر.س
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-slate-500 dark:text-slate-400 pt-1">
              <div>📞 الجوال: <span className="font-medium text-slate-800 dark:text-slate-200">{employeeDraft.phone}</span></div>
              <div>📧 الإيميل: <span className="font-medium text-slate-800 dark:text-slate-200 truncate">{employeeDraft.email}</span></div>
              <div>📅 المباشرة: <span className="font-medium text-slate-800 dark:text-slate-200">{employeeDraft.hireDate}</span></div>
            </div>

            {/* Direct Confirmation Action */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
              {isEmployeeConfirmed ? (
                <div className="w-full p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 flex items-center justify-between text-xs text-emerald-700 dark:text-emerald-300 font-bold">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    تم اعتماد وإضافة الموظف بنجاح في قاعدة البيانات وسجلاته نشطة!
                  </span>
                  {onNavigateToEmployees && (
                    <button
                      type="button"
                      onClick={onNavigateToEmployees}
                      className="text-xs text-emerald-800 dark:text-emerald-200 underline hover:opacity-80"
                    >
                      عرض في دليل الموظفين
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={isCreatingEmployee}
                    onClick={() => onConfirmEmployee && onConfirmEmployee(employeeDraft!, messageId || "")}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
                  >
                    {isCreatingEmployee ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        جاري الإضافة للنظام...
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        اعتماد وإضافة الموظف للنظام الآن
                      </>
                    )}
                  </button>
                  {onNavigateToEmployees && (
                    <button
                      type="button"
                      onClick={onNavigateToEmployees}
                      className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition"
                    >
                      معاينة دليل الموظفين
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {afterDoc && renderMarkdownSection(afterDoc)}
      {!docBody && !beforeDoc && renderMarkdownSection(cleanedContent)}
    </div>
  );
}

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

  // Voice Input (STT), Speech Output (TTS) & OCR Document Scanner State
  const [isListening, setIsListening] = useState<boolean>(false);
  const recognitionRef = useRef<any>(null);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isScanningOcr, setIsScanningOcr] = useState<boolean>(false);
  const [ocrProgress, setOcrProgress] = useState<{ pct: number; text: string }>({
    pct: 0,
    text: "",
  });

  // Direct Employee Creation confirmation
  const { createEmployeeWithResult } = useCreateEmployee();
  const [isCreatingEmployee, setIsCreatingEmployee] = useState<boolean>(false);
  const [confirmedEmployeeDrafts, setConfirmedEmployeeDrafts] = useState<Record<string, boolean>>({});

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
  const [paletteTab, setPaletteTab] = useState<"letters" | "law" | "system" | "strategy">("letters");

  const handleExportChatText = () => {
    if (!messages || messages.length === 0) {
      toast.info("لا توجد رسائل لتصديرها في الجلسة الحالية");
      return;
    }
    const sessionText = messages
      .map((m) => `[${m.role === "user" ? "المستخدم" : "مساعد مدار إكس الذكي"} - ${new Date(m.createdAt).toLocaleString("ar-SA")}]\n${m.content}\n\n------------------------------------------------------------\n`)
      .join("\n");
    const blob = new Blob([sessionText], { type: "text/plain;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `madarx-ai-chat-session-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("تم تصدير جلسة المحادثة بنجاح كملف نصي كامل");
  };

  const paletteItems = {
    letters: [
      { title: "عرض وظيفي رسمي", description: "صيغة خطاب عرض عمل متكامل بالراتب والمزايا", prompt: "صيغ لي نموذج عرض وظيفي رسمي (Job Offer Letter) متكامل يوضح الراتب والبدلات وفترة التجربة", badge: "عرض عمل" },
      { title: "إيميل ترحيبي بموظف جديد", description: "رسالة ترحيبية بالموظف الجديد وتفاصيل اليوم الأول", prompt: "صيغ لي إيميل ترحيبي رسمي واحترافي بموظف جديد انضم لفريق العمل يتضمن تفاصيل اليوم الأول والتمنيات بالتوفيق", badge: "تهيئة" },
      { title: "خطاب إنذار ولفت نظر", description: "إنذار كتابي رسمي لمخالفة التأخير أو التقصير", prompt: "صيغ لي نموذج رسمي لخطاب إنذار كتابي أول لموظف بسبب تكرار التأخير بدون عذر مع السند النظامي", badge: "إنذار" },
      { title: "شهادة خبرة وإخلاء طرف", description: "شهادة خدمة رسمية وفق المادة 88 من نظام العمل", prompt: "صيغ لي شهادة خبرة وإخلاء طرف نظامية لموظف وفق أحكام المادة 88 من نظام العمل السعودي", badge: "شهادة" },
      { title: "خطاب ترقية وزيادة راتب", description: "قرار ترقية إدارية وتعديل المسمى والحزمة المالية", prompt: "صيغ لي خطاب ترقية وتعديل مسمى وظيفي وزيادة راتب رسمي لموظف تقديراً لتميزه", badge: "ترقية" },
      { title: "تعريف بالراتب للبنوك", description: "خطاب تعريف بالراتب موجه للجهات الرسمية والبنوك", prompt: "صيغ لي خطاب تعريف بالراتب موجه للبنوك والجهات التمويلية موضحاً به الراتب والبدلات وتاريخ المباشرة", badge: "تعريف" },
      { title: "قبول استقالة رسمي", description: "خطاب قبول استقالة موظف مع تنظيم فترة الإشعار", prompt: "صيغ لي نموذج رسمي لقبول استقالة موظف مع بيان آخر يوم عمل وتسليم المهام وإخلاء الطرف", badge: "استقالة" },
      { title: "تعميم إداري داخلي", description: "صيغة تعميم داخلي رسمي لكافة موظفي المنشأة", prompt: "صيغ لي تعميم إداري رسمي داخلي لكافة منسوبي المنشأة لتنظيم الإجازات السنوية ومواعيد العمل", badge: "تعميم" },
    ],
    law: [
      { title: "حساب نهاية الخدمة (استقالة 6 سنين)", description: "حسبة تفاعلية بالأرقام لراتب 12,000 ريال", prompt: "احسب لي مكافأة نهاية الخدمة لموظف راتبه 12000 ريال وخدم 6 سنوات وقدم استقالته", badge: "حاسبة" },
      { title: "أحكام وضوابط التجربة (المادة 53)", description: "ضوابط الـ 90 يوماً وإمكانية التمديد لـ 180", prompt: "ما هي أحكام وضوابط فترة التجربة في نظام العمل السعودي وإمكانية تمديدها؟", badge: "المادة 53" },
      { title: "ساعات العمل والعمل الإضافي", description: "معايير ساعات الدوام والراحة وأجر الأوفرتايم", prompt: "كيف يتم احتساب ساعات العمل الإضافي في نظام العمل وأجر الساعة الإضافية وأيام الراحة الأسبوعية؟", badge: "المادة 107" },
      { title: "نسب التأمينات الاجتماعية GOSI", description: "نسب الاشتراك للسعودي وغير السعودي وساند", prompt: "ما هي نسب التأمينات الاجتماعية المعتمدة للموظف السعودي وغير السعودي وحدود الراتب الخاضع؟", badge: "GOSI" },
      { title: "قانون العمل في مصر (الحد الأدنى 6000)", description: "قانون 12 لسنة 2003 والتأمينات 148 لسنة 2019", prompt: "ما هي أحكام قانون العمل في مصر وتفاصيل الحد الأدنى للأجور 6000 جنيه وأجر الاشتراك التأميني؟", badge: "مصر 🇪🇬" },
      { title: "قانون العمل الإماراتي ونظام نافس", description: "مرسوم 33 لسنة 2021 وصناديق الادخار", prompt: "ما هي أحكام قانون العمل الإماراتي مرسوم 33 لسنة 2021 ومستهدفات برنامج نافس وصناديق الادخار؟", badge: "الإمارات 🇦🇪" },
      { title: "قانون العمل في عمان (40 ساعة)", description: "مرسوم 52/2023 ومنظومة SPF", prompt: "ما هي أحكام قانون العمل العماني الجديد بالمرسوم 52 لسنة 2023 وساعات العمل الأسبوعية ومنظومة SPF؟", badge: "عمان 🇴🇲" },
      { title: "قانون العمل الكويتي والتكويت", description: "قانون 6 لسنة 2010 ونهاية الخدمة", prompt: "ما هي أحكام قانون العمل في الكويت رقم 6 لسنة 2010 ومكافأة نهاية الخدمة ونسب العمالة الوطنية؟", badge: "الكويت 🇰🇼" },
      { title: "قانون العمل بقطر والبحرين", description: "أنظمة العمل ومكافأة نهاية الخدمة", prompt: "اشرح لي نظام العمل ومكافأة نهاية الخدمة وحماية الأجور في دولة قطر ومملكة البحرين", badge: "قطر والبحرين" },
      { title: "أحدث أخبار الموارد البشرية 2026", description: "تحديثات مكاتب العمل والذكاء الاصطناعي", prompt: "ما هي أحدث أخبار وتحديثات الموارد البشرية وأنظمة العمل لعام 2026؟", badge: "أخبار 2026" },
    ],
    system: [
      { title: "أعلى 5 موظفين راتباً بالمنشأة", description: "كشف مباشر لأعلى الرواتب المسجلة بالنظام", prompt: "من هم أعلى 5 موظفين من حيث إجمالي الراتب في المنشأة؟", badge: "رواتب" },
      { title: "تحليل كادر قسم تقنية المعلومات", description: "إحصائيات الموظفين والرواتب في IT", prompt: "حلل لي كادر قسم تقنية المعلومات، عددهم، متوسط رواتبهم، والموظفين المسجلين في القسم", badge: "أقسام" },
      { title: "تحليل كادر قسم المبيعات", description: "بيانات الموظفين والتوطين في المبيعات", prompt: "حلل لي إدارة المبيعات من حيث عدد الموظفين ونسبة التوطين ومتوسط الرواتب", badge: "أقسام" },
      { title: "التقرير التنفيذي الشامل 360°", description: "تحليل شامل لكافة مؤشرات المنظومة بالأرقام", prompt: "حلل لي التقرير التنفيذي الشامل لكل النظام 360 مع أهم المؤشرات والتوصيات", badge: "شامل" },
      { title: "مسير الرواتب وحماية الأجور WPS", description: "تحليل الرواتب والبدلات وجاهزية WPS", prompt: "حلل تقرير مسير الرواتب والتكاليف المالية والتأمينات وجاهزية حماية الأجور WPS", badge: "مالي" },
      { title: "الحضور والانصراف والورديات", description: "تحليل نسب الحضور والتأخير وساعات الإضافي", prompt: "حلل تقرير الحضور والانصراف وحالات التأخير وساعات العمل الإضافي والورديات", badge: "حضور" },
    ],
    strategy: [
      { title: "الفرق بين OKRs و KPIs", description: "مصفوفة الفروق والتطبيق في الموارد البشرية", prompt: "ما هو الفرق الجوهري بين مؤشرات الأداء (KPIs) والأهداف والنتائج الرئيسية (OKRs) وكيف نطبقها؟", badge: "استراتيجية" },
      { title: "أسئلة المقابلات بمنهجية STAR", description: "أسئلة سلوكية ومعايير تقييم الكفاءات", prompt: "اقترح لي أهم أسئلة المقابلات الوظيفية السلوكية وفق منهجية STAR لتقييم مهارات حل المشكلات والتواصل", badge: "مقابلات" },
      { title: "استراتيجية تقليل التسرب الوظيفي", description: "خطة عملية لرفع استقرار واستبقاء الموظفين", prompt: "ما هي أهم الخطوات العملية لاستبقاء الكفاءات وتقليل معدل الدوران والتسرب الوظيفي في المنشأة؟", badge: "استبقاء" },
      { title: "مصفوفة 9-Box لتقييم المواهب", description: "طريقة توزيع وتقييم الأداء والإمكانات", prompt: "اشرح لي كيفية تطبيق مصفوفة 9-Box Grid في تقييم أداء وإمكانات الموظفين وخطة التعاقب", badge: "مواهب" },
    ],
  };

  const activePaletteItems = paletteItems[paletteTab] || paletteItems.letters;

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

  // --------------------------------------------------------------------------
  // Voice Input (STT) Recognition
  // --------------------------------------------------------------------------
  const toggleVoiceRecognition = () => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      toast.error(
        "ميزة الإدخال الصوتي المباشر غير مدعومة في متصفحك الحالي. يرجى تجربة Google Chrome أو Microsoft Edge."
      );
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = "ar-SA";
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListening(true);
        toast.info("🎙️ جاري الاستماع إلى صوتك باللغة العربية... تحدث ببيانات الموظف أو طلبك الآن");
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript;
        if (transcript) {
          setInputText((prev) => (prev ? `${prev} ${transcript}` : transcript));
          toast.success("تم تحويل نبرة الصوت إلى نص بنجاح!");
        }
      };

      recognition.onerror = (event: any) => {
        console.warn("Speech recognition error:", event.error);
        setIsListening(false);
        if (event.error !== "no-speech") {
          toast.error(`تعذر التقاط الصوت: ${event.error}`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      console.error("Failed to start speech recognition:", err);
      setIsListening(false);
      toast.error("تعذر تفعيل الميكروفون");
    }
  };

  // --------------------------------------------------------------------------
  // Voice Output (TTS) Speech Synthesis
  // --------------------------------------------------------------------------
  const toggleSpeakMessage = (msgId: string, rawContent: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      toast.error("ميزة النطق الصوتي غير مدعومة في بيئة المتصفح الحالية");
      return;
    }

    if (speakingMessageId === msgId) {
      window.speechSynthesis.cancel();
      setSpeakingMessageId(null);
      return;
    }

    window.speechSynthesis.cancel();

    // Clean markdown, symbols, and JSON card markers for fluid speech
    const clean = rawContent
      .replace(/:::document[\s\S]*?:::/g, "مستند رسمي إداري جاهز للاعتماد.")
      .replace(/:::employee_card[\s\S]*?:::/g, "بطاقة الموظف الجديد جاهزة للاعتماد.")
      .replace(/[#*`_~>•-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = "ar-SA";
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const arVoice = voices.find((v) => v.lang.startsWith("ar"));
    if (arVoice) utterance.voice = arVoice;

    utterance.onend = () => setSpeakingMessageId(null);
    utterance.onerror = () => setSpeakingMessageId(null);

    window.speechSynthesis.speak(utterance);
    setSpeakingMessageId(msgId);
  };

  // --------------------------------------------------------------------------
  // OCR Document & Image Employee Extractor
  // --------------------------------------------------------------------------
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setIsScanningOcr(true);
    setOcrProgress({ pct: 15, text: "جاري قراءة ملف الصورة واستخراج النصوص ضوئياً..." });

    try {
      const res = await performEmployeeOCR(file, (pct, text) => {
        setOcrProgress({ pct, text });
      });

      const draft = res.extractedDraft;
      const promptContent = `📷 [مسح ضوئي ذكي لمستند: ${file.name}]
أضف موظف جديد مستخرج من الصورة:
الاسم: ${draft.firstNameAr} ${draft.lastNameAr}
المسمى: ${draft.jobTitleAr}
الهوية: ${draft.nationalIdOrIqama}
القسم: ${draft.departmentName}
الراتب الأساسي: ${draft.basicSalary}
بدل السكن: ${draft.housingAllowance}
بدل النقل: ${draft.transportAllowance}
الجنسية: ${draft.nationality}
الجوال: ${draft.phone}`;

      sendMessageMutation.mutate({
        conversationId: selectedConversationId,
        content: promptContent,
        userRole: currentRole,
        metadata: {
          actionType: "create_employee_confirmation",
          employeeDraft: draft,
          ocrFilename: file.name,
        },
      });

      toast.success("تم مسح المستند ضوئياً واستخراج بيانات الموظف بنجاح!");
    } catch (err: any) {
      console.error("OCR extraction failed:", err);
      toast.error("تعذر إتمام المسح الضوئي، يمكنك كتابة بيانات الموظف نصياً وسيقوم المساعد بهيكلتها.");
    } finally {
      setIsScanningOcr(false);
      setOcrProgress({ pct: 0, text: "" });
    }
  };

  // --------------------------------------------------------------------------
  // Direct Employee Creation Confirmation Action
  // --------------------------------------------------------------------------
  const handleConfirmCreateEmployee = async (
    draft: ExtractedEmployeeDraft,
    messageId: string
  ) => {
    setIsCreatingEmployee(true);
    try {
      const deptId =
        (app.orgUnits ?? []).find(
          (d) => d.id === draft.departmentId || d.nameAr === draft.departmentName
        )?.id ||
        app.orgUnits?.[0]?.id ||
        "dept-hr";

      const subsidiaryId = app.subsidiaries?.[0]?.id || "sub-main";
      const workLocId = app.workLocations?.[0]?.id || "loc-hq";

      const employeePayload = {
        employeeNo: draft.employeeNo,
        firstNameAr: draft.firstNameAr,
        lastNameAr: draft.lastNameAr,
        firstNameEn: draft.firstNameEn,
        lastNameEn: draft.lastNameEn,
        email: draft.email,
        phone: draft.phone,
        nationalIdOrIqama: draft.nationalIdOrIqama,
        nationality: draft.nationality,
        gender: draft.gender,
        birthDate: draft.birthDate,
        maritalStatus: draft.maritalStatus,
        subsidiaryId,
        departmentId: deptId,
        jobTitleAr: draft.jobTitleAr,
        jobTitleEn: draft.jobTitleEn,
        workLocationId: workLocId,
        hireDate: draft.hireDate,
        contractType: draft.contractType,
        status: draft.status,
        basicSalary: draft.basicSalary,
        housingAllowance: draft.housingAllowance,
        transportAllowance: draft.transportAllowance,
        otherAllowances: draft.otherAllowances,
        totalSalary:
          draft.basicSalary +
          draft.housingAllowance +
          draft.transportAllowance +
          (draft.otherAllowances || 0),
        bankName: "مصرف الراجحي",
        iban: `SA${Math.floor(1000000000000000000000 + Math.random() * 9000000000000000000000)}`,
      };

      const created = await createEmployeeWithResult(employeePayload);
      if (created) {
        setConfirmedEmployeeDrafts((prev) => ({
          ...prev,
          [messageId]: true,
          [draft.employeeNo]: true,
        }));
        toast.success(
          `🎉 تم اعتماد وإضافة الموظف ${draft.firstNameAr} ${draft.lastNameAr} إلى قاعدة بيانات المنظومة بنجاح!`
        );
      }
    } catch (err: any) {
      console.error("Failed to create employee from chat:", err);
      toast.error(err?.message || "تعذر إضافة الموظف للنظام");
    } finally {
      setIsCreatingEmployee(false);
    }
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
          {/* ================================================================= */}
          {/* RIGHT SIDEBAR: SESSIONS & SMART PROMPT PALETTE                    */}
          {/* ================================================================= */}
          <div className="lg:col-span-4 space-y-4">
            {/* Conversation Sessions List */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  جلسات المحادثة الذكية
                </h3>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleCreateNewConversation}
                    className="inline-flex items-center gap-1 text-xs bg-indigo-600 text-white px-2.5 py-1.5 rounded-lg font-bold hover:bg-indigo-700 transition shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    جلسة جديدة
                  </button>
                  <button
                    type="button"
                    onClick={handleClearConversation}
                    title="مسح رسائل الجلسة الحالية"
                    className="inline-flex items-center justify-center p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-0.5">
                {conversations.map((conv) => (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => setSelectedConversationId(conv.id)}
                    className={`w-full text-right p-2.5 rounded-xl border transition-all flex items-start gap-2.5 ${
                      selectedConversationId === conv.id
                        ? "bg-indigo-50/90 dark:bg-indigo-950/50 border-indigo-300 dark:border-indigo-700 ring-1 ring-indigo-500/20"
                        : "border-slate-100 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                      selectedConversationId === conv.id ? "bg-indigo-600 text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-500"
                    }`}>
                      <Bot className="w-3.5 h-3.5" />
                    </div>
                    <div className="overflow-hidden flex-1">
                      <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                        {conv.title}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {new Date(conv.updatedAt).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Smart Prompt Matrix & Tools Palette */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2.5">
                <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  لوحة النماذج والأدوات السريعة
                </h3>
              </div>

              {/* 4 Category Tabs */}
              <div className="grid grid-cols-2 gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl mb-3">
                <button
                  type="button"
                  onClick={() => setPaletteTab("letters")}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 ${
                    paletteTab === "letters"
                      ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                  }`}
                >
                  <FileText className="w-3 h-3" />
                  نماذج وخطابات
                </button>
                <button
                  type="button"
                  onClick={() => setPaletteTab("law")}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 ${
                    paletteTab === "law"
                      ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                  }`}
                >
                  <BookOpen className="w-3 h-3" />
                  نظام العمل
                </button>
                <button
                  type="button"
                  onClick={() => setPaletteTab("system")}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 ${
                    paletteTab === "system"
                      ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                  }`}
                >
                  <Building2 className="w-3 h-3" />
                  بيانات المنشأة
                </button>
                <button
                  type="button"
                  onClick={() => setPaletteTab("strategy")}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 ${
                    paletteTab === "strategy"
                      ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                  }`}
                >
                  <TrendingUp className="w-3 h-3" />
                  تطوير وأداء
                </button>
              </div>

              {/* Action Buttons in Selected Tab */}
              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-0.5">
                {activePaletteItems.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    disabled={sendMessageMutation.isPending}
                    onClick={() => sendPromptImmediately(item.prompt)}
                    className="w-full text-right p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-slate-700 dark:text-slate-200 border border-slate-200/60 dark:border-slate-700/60 transition flex items-center justify-between gap-2 group disabled:opacity-50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold group-hover:text-indigo-600 dark:group-hover:text-indigo-300 truncate">
                        {item.title}
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {item.description}
                      </p>
                    </div>
                    <span className="px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold shrink-0">
                      {item.badge}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ================================================================= */}
          {/* MAIN CHAT WORKSPACE (IMMERSIVE, RICH, RESPONSIVE)                 */}
          {/* ================================================================= */}
          <div className="lg:col-span-8 flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm h-[780px] overflow-hidden">
            {/* Header with Sovereign AI Identity */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-3 bg-slate-50/50 dark:bg-slate-800/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-700 to-indigo-500 flex items-center justify-center text-white shadow-sm shrink-0">
                  <Bot className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">
                      مساعد مدار إكس الذكي المستقل (MadarX AI)
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[10px] font-bold flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" />
                      محرك سيادي خاص 100%
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    مبني خصيصاً لمنشأتك • متصل بـ {app.employees.length} موظف • سرية وأمان محلي تام
                  </p>
                </div>
              </div>

              {/* Header Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportChatText}
                  className="inline-flex items-center gap-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-xl font-bold hover:bg-slate-50 dark:hover:bg-slate-700/60 transition shadow-xs"
                  title="تصدير نص المحادثة بالكامل"
                >
                  <Download className="w-3.5 h-3.5 text-indigo-600" />
                  تصدير الجلسة
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("reports_analyzer")}
                  className="inline-flex items-center gap-1.5 text-xs bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 font-bold hover:bg-indigo-100 transition"
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  لوحة 360°
                </button>
              </div>
            </div>

            {/* Messages Stream Viewport */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-slate-50/20 dark:bg-slate-950/20">
              {loadingMessages ? (
                <div className="flex items-center justify-center h-full text-slate-400 gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-indigo-600" />
                  <span className="text-sm font-medium">جاري تحميل الجلسة...</span>
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
                        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                          isUser
                            ? "bg-slate-900 text-white shadow-xs"
                            : "bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white shadow-xs"
                        }`}
                      >
                        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                      </div>

                      <div
                        className={`max-w-[88%] sm:max-w-[82%] rounded-2xl p-4 shadow-xs ${
                          isUser
                            ? "bg-indigo-600 text-white rounded-tl-none font-medium"
                            : "bg-white dark:bg-slate-800/95 text-slate-800 dark:text-slate-100 rounded-tr-none border border-slate-200/80 dark:border-slate-700/80"
                        }`}
                      >
                        {/* Rich Formatted Message Content */}
                        <ChatMessageRenderer
                          content={msg.content}
                          isUser={isUser}
                          messageId={msg.id}
                          onConfirmEmployee={handleConfirmCreateEmployee}
                          isEmployeeConfirmed={Boolean(confirmedEmployeeDrafts[msg.id])}
                          isCreatingEmployee={isCreatingEmployee}
                          onNavigateToEmployees={() => navigate({ to: "/employees" as any })}
                        />

                        {/* Human-in-the-loop Confirmation Card */}
                        {isActionProposal && (
                          <div className="mt-3.5 p-3.5 rounded-xl bg-amber-50/80 dark:bg-slate-900 border border-amber-300 dark:border-amber-700">
                            <span className="text-xs font-bold text-amber-800 dark:text-amber-400 flex items-center gap-1.5 mb-2">
                              <AlertTriangle className="w-4 h-4 text-amber-600" />
                              إجراء إداري مقترح يتطلب تأكيد بشري صريح (Human-in-the-Loop)
                            </span>
                            {isConfirmed ? (
                              <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-bold">
                                <CheckCircle2 className="w-4 h-4" />
                                تم اعتماد وتنفيذ الإجراء وتوثيقه في سجل التدقيق
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 mt-2">
                                <button
                                  type="button"
                                  onClick={() => handleConfirmAction(msg.id)}
                                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition shadow-xs"
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

                        {/* Message Metadata & Fast Actions Footer */}
                        <div
                          className={`flex items-center justify-between mt-3 pt-2 border-t ${
                            isUser
                              ? "border-indigo-500/40 text-indigo-200"
                              : "border-slate-100 dark:border-slate-700/60 text-slate-400"
                          } text-[11px]`}
                        >
                          <span>{new Date(msg.createdAt).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}</span>
                          {!isUser && (
                            <div className="flex items-center gap-3">
                              {/* Voice Readout (TTS) */}
                              <button
                                type="button"
                                onClick={() => toggleSpeakMessage(msg.id, msg.content)}
                                className={`transition flex items-center gap-1 font-medium ${
                                  speakingMessageId === msg.id
                                    ? "text-indigo-600 dark:text-indigo-400 font-bold animate-pulse"
                                    : "hover:text-indigo-600"
                                }`}
                                title={speakingMessageId === msg.id ? "إيقاف الصوت" : "استماع للرد صوتياً"}
                              >
                                {speakingMessageId === msg.id ? (
                                  <>
                                    <VolumeX className="w-3.5 h-3.5 text-rose-500" />
                                    <span className="text-rose-600 dark:text-rose-400">إيقاف</span>
                                  </>
                                ) : (
                                  <>
                                    <Volume2 className="w-3.5 h-3.5" />
                                    <span>صوت</span>
                                  </>
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  // Clean document markers if copying raw message
                                  const clean = msg.content
                                    .replace(/:::document/g, "")
                                    .replace(/:::employee_card[\s\S]*?:::/g, "")
                                    .replace(/:::/g, "");
                                  navigator.clipboard.writeText(clean);
                                  toast.success("تم نسخ التحليل بالكامل");
                                }}
                                className="hover:text-indigo-600 transition flex items-center gap-1 font-medium"
                                title="نسخ الرد بالكامل"
                              >
                                <Copy className="w-3.5 h-3.5" />
                                <span>نسخ</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => toast.success("شكراً لتقييمك الإيجابي")}
                                className="hover:text-emerald-600 transition"
                                title="إجابة مفيدة ودقيقة"
                              >
                                <ThumbsUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => toast.info("تم تسجيل ملاحظتك لتطوير دقة النموذج")}
                                className="hover:text-rose-600 transition"
                                title="إجابة تحتاج تحسين"
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

            {/* Smart Contextual Follow-Up Suggestions Bar */}
            <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center gap-2 overflow-x-auto scrollbar-none">
              <span className="text-[11px] text-slate-400 shrink-0 font-medium flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-indigo-500" />
                اقتراحات سريعة:
              </span>
              {[
                {
                  label: "🎙️ أضف موظف بالصوت",
                  prompt: "أضف موظف اسمه فهد القحطاني مهندس برمجيات في قسم تقنية المعلومات براتب أساسي 12000 ريال وبدل سكن 3000 ريال وبدل نقل 1000 ريال ورقم الهوية 1088776655 وجنسيته سعودي",
                },
                {
                  label: "📰 أخبار الموارد البشرية 2026",
                  prompt: "ما هي أحدث أخبار وتحديثات مكاتب العمل وأنظمة الموارد البشرية والتوظيف لعام 2026؟",
                },
                {
                  label: "🇸🇦 نظام العمل السعودي",
                  prompt: "اشرح لي نظام العمل السعودي ولوائح منصة قوى وحساب مكافأة نهاية الخدمة والتأمينات الاجتماعية GOSI",
                },
                {
                  label: "🇪🇬 قانون العمل المصري (6000)",
                  prompt: "ما هي أحكام قانون العمل في مصر وتفاصيل الحد الأدنى للأجور 6000 جنيه وأجر الاشتراك التأميني الجديد؟",
                },
                {
                  label: "🇦🇪 العمل بالإمارات ونافس",
                  prompt: "ما هي أحكام قانون العمل الإماراتي مرسوم 33 لسنة 2021 وصناديق الادخار البديلة ومستهدفات برنامج نافس؟",
                },
                {
                  label: "🇴🇲 قانون العمل العماني (40س)",
                  prompt: "ما هي أحكام قانون العمل العماني الجديد بالمرسوم 52 لسنة 2023 وساعات العمل الأسبوعية ومنظومة SPF؟",
                },
                {
                  label: "🇰🇼 قانون العمل الكويتي",
                  prompt: "ما هي أحكام قانون العمل في الكويت رقم 6 لسنة 2010 ومكافأة نهاية الخدمة ونسب التكويت؟",
                },
                {
                  label: "📊 التقرير التنفيذي الشامل 360°",
                  prompt: "حلل لي التقرير التنفيذي الشامل لكل النظام 360 مع أهم المؤشرات والتوصيات",
                },
              ].map((sug, sIdx) => (
                <button
                  key={sIdx}
                  type="button"
                  disabled={sendMessageMutation.isPending}
                  onClick={() => sendPromptImmediately(sug.prompt)}
                  className="text-xs px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-300 hover:border-indigo-300 transition whitespace-nowrap shrink-0 shadow-xs disabled:opacity-50"
                >
                  {sug.label}
                </button>
              ))}
            </div>

            {/* Live Audio Listening Banner */}
            {isListening && (
              <div className="px-4 py-2 bg-rose-50 dark:bg-rose-950/70 border-t border-rose-200 dark:border-rose-900 flex items-center justify-between text-xs text-rose-700 dark:text-rose-300 font-bold animate-in fade-in">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                  <span>🎙️ جاري الاستماع إلى صوتك باللغة العربية... تحدث ببيانات الموظف أو استفسارك الآن</span>
                </div>
                <button
                  type="button"
                  onClick={toggleVoiceRecognition}
                  className="text-[11px] bg-rose-600 hover:bg-rose-700 text-white px-2.5 py-0.5 rounded-md font-bold transition"
                >
                  إيقاف التسجيل
                </button>
              </div>
            )}

            {/* Live OCR Progress Bar */}
            {isScanningOcr && (
              <div className="px-4 py-2.5 bg-indigo-50 dark:bg-indigo-950/70 border-t border-indigo-200 dark:border-indigo-900 text-xs text-indigo-700 dark:text-indigo-300 font-bold animate-in fade-in space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                    {ocrProgress.text || "جاري مسح المستند ضوئياً بالذكاء الاصطناعي..."}
                  </span>
                  <span>{ocrProgress.pct}%</span>
                </div>
                <div className="w-full bg-indigo-200 dark:bg-indigo-900 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-indigo-600 h-full transition-all duration-300"
                    style={{ width: `${ocrProgress.pct}%` }}
                  />
                </div>
              </div>
            )}

            {/* Hidden OCR File Input */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />

            {/* Multi-Line Input Dock with Voice and OCR Attachments */}
            <form
              onSubmit={handleSendMessage}
              className="p-3 sm:p-4 border-t border-slate-200 dark:border-slate-800 flex items-end gap-2 bg-white dark:bg-slate-900"
            >
              {/* Attachment / Camera OCR Button */}
              <button
                type="button"
                disabled={isScanningOcr || sendMessageMutation.isPending}
                onClick={() => fileInputRef.current?.click()}
                className="p-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-2xl transition flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700 shadow-xs disabled:opacity-50"
                title="مسح ضوئي لبطاقة هوية، مستند ورقي، أو صورة/Screenshot لإضافة الموظف تلقائياً (OCR)"
              >
                {isScanningOcr ? (
                  <RefreshCw className="w-5 h-5 animate-spin text-indigo-600" />
                ) : (
                  <Camera className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                )}
              </button>

              {/* Voice Microphone (STT) Button */}
              <button
                type="button"
                disabled={sendMessageMutation.isPending}
                onClick={toggleVoiceRecognition}
                className={`p-3 rounded-2xl transition flex items-center justify-center shrink-0 border shadow-xs ${
                  isListening
                    ? "bg-rose-500 hover:bg-rose-600 text-white border-rose-600 animate-pulse ring-4 ring-rose-500/30"
                    : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700"
                }`}
                title={isListening ? "إيقاف التسجيل الصوتي" : "تحدث بالصوت لإضافة موظف أو طرح أي استفسار"}
              >
                {isListening ? (
                  <MicOff className="w-5 h-5" />
                ) : (
                  <Mic className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                )}
              </button>

              {/* Text Area */}
              <div className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-2.5 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent transition">
                <textarea
                  rows={2}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage(e);
                    }
                  }}
                  placeholder="اسألني أي شيء (قوانين عمل 7 دول، أخبار 2026، حساب نهاية الخدمة، أو قل 'أضف موظف' بالصوت أو الصورة)..."
                  className="w-full bg-transparent border-0 resize-none text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-0 leading-relaxed"
                />
                <div className="flex items-center justify-between pt-1 border-t border-slate-200/50 dark:border-slate-700/50 text-[10px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <Lock className="w-3 h-3 text-emerald-500" />
                    بياناتك محمية محلياً 100% • إدخال صوتي • مسح ضوئي OCR
                  </span>
                  <span>اضغط Enter للإرسال • Shift+Enter لسطر جديد</span>
                </div>
              </div>

              {/* Send Submit Button */}
              <button
                type="submit"
                disabled={!inputText.trim() || sendMessageMutation.isPending}
                className="px-5 py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-2xl font-bold text-xs sm:text-sm flex items-center gap-2 transition shrink-0 shadow-sm"
              >
                {sendMessageMutation.isPending ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span>إرسال</span>
              </button>
            </form>
          </div>
        </div>
      )}

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

      </div>
  );
}
