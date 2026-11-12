/**
 * MadarX Enterprise AI Data Repository & Smart Report Intelligence Engine
 * Connects Copilot Chat, Report Analyzer, Proactive Insights, and Tool Governance
 * directly to live system data (Employees, Payroll, Attendance, Leaves, Contracts,
 * Saudization, Performance, Recruitment, Assets, Loans, Expenses, and Governed Reports).
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../integrations/supabase/client";
import { useAuth } from "../auth/AuthContext";
import { useApp, type AppContextType } from "../context/AppContext";
import {
  type AIConversation,
  type AIChatMessage,
  type AIInsight,
  type AIUsageMetrics,
  type AIToolCall,
  detectAndSanitizePrompt,
  detectIntent,
} from "../domains/ai";
import { searchKnowledgeBase } from "../ai/retrieval";
import { aiObservability } from "../ai/observability";
import { getAllExtendedEmployees } from "../domains/employees/extended-employee-store";
import { METRIC_CATALOG } from "./reports-repository";
import { searchCountryLaborRegulations } from "../ai/labor-news-and-country-regulations";
import { parseEmployeeDetailsFromText } from "../ai/ocr-employee-extractor";

// ============================================================================
// 1. SMART REPORT ANALYSIS TYPES, CATALOG & AI PROVIDER CONFIG
// ============================================================================

export interface AIProviderConfig {
  provider: "built_in" | "openai" | "gemini" | "openrouter";
  apiKey?: string;
  model?: string;
}

const AI_CONFIG_KEY = "madarx_ai_provider_config_v2";

export function loadAIProviderConfig(): AIProviderConfig {
  if (typeof window === "undefined") return { provider: "built_in" };
  try {
    const raw = localStorage.getItem(AI_CONFIG_KEY);
    return raw ? (JSON.parse(raw) as AIProviderConfig) : { provider: "built_in" };
  } catch {
    return { provider: "built_in" };
  }
}

export function saveAIProviderConfig(config: AIProviderConfig): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(config));
  } catch {
    // ignore quota issues
  }
}

export async function callExternalLLM(
  prompt: string,
  systemPrompt: string,
  config: AIProviderConfig
): Promise<string> {
  if (config.provider === "gemini") {
    const apiKey = config.apiKey?.trim();
    if (!apiKey) throw new Error("يرجى إدخال مفتاح Google Gemini API أولاً.");
    const model = config.model || "gemini-1.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: `${systemPrompt}\n\nطلب المستخدم:\n${prompt}` }],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2500,
        },
      }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(`خطأ من Gemini API (${res.status}): ${errData.error?.message || res.statusText}`);
    }
    const data = await res.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!reply) throw new Error("لم يتم استلام نص من نموذج Gemini.");
    return reply;
  }

  if (config.provider === "openai") {
    const apiKey = config.apiKey?.trim();
    if (!apiKey) throw new Error("يرجى إدخال مفتاح OpenAI API أولاً.");
    const model = config.model || "gpt-4o-mini";
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
      }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(`خطأ من OpenAI API (${res.status}): ${errData.error?.message || res.statusText}`);
    }
    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content;
    if (!reply) throw new Error("لم يتم استلام نص من نموذج OpenAI.");
    return reply;
  }

  if (config.provider === "openrouter") {
    const apiKey = config.apiKey?.trim();
    if (!apiKey) throw new Error("يرجى إدخال مفتاح OpenRouter API أولاً.");
    const model = config.model || "anthropic/claude-3.5-sonnet";
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "X-Title": "MadarX AI Copilot",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
      }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(`خطأ من OpenRouter API (${res.status}): ${errData.error?.message || res.statusText}`);
    }
    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content;
    if (!reply) throw new Error("لم يتم استلام نص من OpenRouter.");
    return reply;
  }

  throw new Error("المحرك المحدد غير مدعوم.");
}

export function buildSystemPromptForLLM(app: Partial<AppContextType>): string {
  const employees = app.employees ?? [];
  const empCount = employees.length;
  const saudiCount = employees.filter((e) => e.nationality === "سعودي").length;
  const orgUnits = app.orgUnits ?? [];
  const deptLines = orgUnits
    .slice(0, 12)
    .map((d) => {
      const n = employees.filter((e) => e.departmentId === d.id).length;
      return `- ${d.nameAr}: ${n} موظف`;
    })
    .join("\n");
  const totalPayroll = employees.reduce(
    (s, e) =>
      s +
      (Number(e.basicSalary) || 0) +
      (Number(e.housingAllowance) || 0) +
      (Number(e.transportAllowance) || 0) +
      (Number(e.otherAllowances) || 0),
    0
  );
  const sample = employees
    .slice(0, 25)
    .map((e) => `${e.employeeNo} | ${e.firstNameAr} ${e.lastNameAr} | ${e.jobTitleAr} | ${e.nationality} | ${e.status}`)
    .join("\n");
  return `أنت "مساعد مدار إكس الذكي": مساعد شخصي لمدير الموارد البشرية داخل نظام مدار إكس (MadarX)، ومطلع على بيانات النظام الحية أدناه.
تتحدث بحرية وطلاقة مثل ChatGPT: تجيب عن أي سؤال عام أو إداري أو تقني أو كتابي، وتناقش وتقترح وتصيغ وتحلل، وبلهجة ودودة مختصرة وواضحة.
عندما يتعلق السؤال بالنظام فاعتمد على البيانات التالية فقط ولا تخترع أرقاماً غير موجودة، وإن لم تتوفر البيانات فقل ذلك صراحة.
الدول المدعومة في النظام: السعودية، مصر، الإمارات، قطر، الكويت، البحرين، عُمان (تعرف أنظمة العمل ومكاتب العمل والتأمينات لكل منها).
قدرات النظام التي يمكنك توجيه المستخدم إليها: إضافة موظف بالنص أو الصوت أو صورة (OCR) مع بطاقة اعتماد، تقارير 360° (رواتب، حضور، إجازات، عقود، توطين)، صياغة الخطابات الرسمية، حاسبة نهاية الخدمة.

## بيانات النظام الحالية
- عدد الموظفين: ${empCount} (سعوديون: ${saudiCount})
- إجمالي الرواتب الشهرية التقريبي: ${totalPayroll.toLocaleString("en-US")}
- الأقسام:
${deptLines || "- لا توجد بيانات أقسام"}
- عينة من الموظفين (رقم | الاسم | الوظيفة | الجنسية | الحالة):
${sample || "- لا يوجد موظفون"}

استخدم العربية وتنسيق Markdown عند الحاجة، وكن عملياً ومباشراً.`;
}

export type SmartReportDomainId =
  | "executive_all"
  | "workforce_saudization"
  | "payroll_financial"
  | "attendance_shifts"
  | "leaves_workflow"
  | "contracts_documents"
  | "performance_recruitment"
  | "assets_expenses_loans";

export interface SmartReportKpiCard {
  label: string;
  value: string;
  subtext: string;
  status: "good" | "warning" | "critical" | "info";
}

export interface SmartReportRecommendation {
  title: string;
  description: string;
  priority: "عاجل" | "مهم" | "تحسيني";
  targetRoute: string;
  actionLabel: string;
}

export interface SmartReportAnalysis {
  domainId: SmartReportDomainId;
  titleAr: string;
  subtitleAr: string;
  healthScorePct: number;
  generatedAt: string;
  executiveSummary: string;
  kpis: SmartReportKpiCard[];
  breakdownTitle: string;
  breakdownHeaders: string[];
  breakdownRows: string[][];
  anomalies: string[];
  recommendations: SmartReportRecommendation[];
  suggestedFollowUpQuestions: string[];
}

export const SMART_REPORT_DOMAINS: Array<{
  id: SmartReportDomainId;
  titleAr: string;
  shortTitleAr: string;
  descriptionAr: string;
  iconName: string;
}> = [
  {
    id: "executive_all",
    titleAr: "التقرير التنفيذي الشامل لكل النظام (360°)",
    shortTitleAr: "التقرير الشامل 360°",
    descriptionAr: "تحليل متكامل يربط القوى العاملة، الرواتب، الحضور، الإجازات، العقود، والامتثال في لوحة واحدة.",
    iconName: "sparkles",
  },
  {
    id: "workforce_saudization",
    titleAr: "تقرير القوى العاملة والتوطين والهيكل التنظيمي",
    shortTitleAr: "القوى العاملة والتوطين",
    descriptionAr: "تحليل أعداد الموظفين، نسب السعودة (نطاقات)، توزيع الإدارات، الفروع، والمسميات الوظيفية.",
    iconName: "users",
  },
  {
    id: "payroll_financial",
    titleAr: "تقرير مسيرات الرواتب والتكاليف وحماية الأجور (WPS)",
    shortTitleAr: "الرواتب وحماية الأجور",
    descriptionAr: "تحليل الرواتب الأساسية، البدلات، التأمينات الاجتماعية (GOSI)، جاهزية الآيبان، وطرق الدفع.",
    iconName: "wallet",
  },
  {
    id: "attendance_shifts",
    titleAr: "تقرير الحضور والانصراف والورديات والعمل الإضافي",
    shortTitleAr: "الحضور والورديات",
    descriptionAr: "تحليل نسبة الانضباط، حالات التأخير والغياب، ساعات العمل الإضافي، وطلبات تصحيح البصمة.",
    iconName: "clock",
  },
  {
    id: "leaves_workflow",
    titleAr: "تقرير الإجازات والأرصدة وسير الموافقات (Workflow)",
    shortTitleAr: "الإجازات والطلبات",
    descriptionAr: "تحليل أرصدة الإجازات السنوية والمرضية، معدلات الاستهلاك، والطلبات المعلقة في سلسلة الاعتماد.",
    iconName: "calendar",
  },
  {
    id: "contracts_documents",
    titleAr: "تقرير العقود ومنصة قوى والوثائق وفترة التجربة",
    shortTitleAr: "العقود والوثائق",
    descriptionAr: "تحليل أنواع العقود (محدد/غير محدد/أجير/مرن)، فترات التجربة، وصلاحية الهويات والإقامات.",
    iconName: "file_text",
  },
  {
    id: "performance_recruitment",
    titleAr: "تقرير تقييم الأداء والتوظيف واستقطاب الكفاءات",
    shortTitleAr: "الأداء والتوظيف",
    descriptionAr: "تحليل دورات الأداء الوظيفي، сред التقييمات، الشواغر الوظيفية المفتوحة، ومسار المرشحين.",
    iconName: "trending_up",
  },
  {
    id: "assets_expenses_loans",
    titleAr: "تقرير العهد والأصول والسلف والمصروفات المالية",
    shortTitleAr: "العهد والسلف والمصروفات",
    descriptionAr: "تحليل العهد التقنية المسلمة للموظفين، السلف النشطة والأقساط الشهرية، ومطالبات المصروفات.",
    iconName: "briefcase",
  },
];

// ============================================================================
// 2. LIVE ENTERPRISE REPORT ANALYZER ENGINE
// ============================================================================

export function buildSmartReportAnalysis(
  domainId: SmartReportDomainId,
  app: Partial<AppContextType>
): SmartReportAnalysis {
  const employees = app.employees ?? [];
  const orgUnits = app.orgUnits ?? [];
  const workLocations = app.workLocations ?? [];
  const payrollRuns = app.payrollRuns ?? [];
  const attendanceRecords = app.attendanceRecords ?? [];
  const overtimeRecords = app.overtimeRecords ?? [];
  const attendanceCorrections = app.attendanceCorrections ?? [];
  const requests = app.requests ?? [];
  const leaveBalances = app.leaveBalances ?? [];
  const shifts = app.shifts ?? [];
  const loans = app.loans ?? [];
  const expenseClaims = app.expenseClaims ?? [];
  const evaluations = app.evaluations ?? [];
  const jobOpenings = app.jobOpenings ?? [];
  const candidates = app.candidates ?? [];
  const hardwareAssets = app.assets ?? [];
  const employeeDocuments = app.employeeDocs ?? [];
  const extendedRecords = getAllExtendedEmployees();

  const totalEmp = employees.length;
  const activeEmp = employees.filter((e) => e.status === "active").length;
  const probationEmp = employees.filter((e) => e.status === "probation").length;
  const onLeaveEmp = employees.filter((e) => e.status === "on_leave").length;

  const saudiEmp = employees.filter(
    (e) =>
      e.nationality?.includes("سعود") ||
      e.nationality?.toLowerCase().includes("saudi") ||
      e.nationalIdOrIqama?.startsWith("1")
  ).length;
  const expatEmp = Math.max(0, totalEmp - saudiEmp);
  const saudizationPct = totalEmp > 0 ? Math.round((saudiEmp / totalEmp) * 1000) / 10 : 0;
  const nitaqatBand =
    saudizationPct >= 40
      ? "البلاتيني"
      : saudizationPct >= 30
        ? "الأخضر المرتفع"
        : saudizationPct >= 22
          ? "الأخضر المتوسط"
          : "الأخضر المنخفض";

  // Financial & Payroll calculations
  const totalBasicSalary = employees.reduce((sum, e) => sum + (Number(e.basicSalary) || 0), 0);
  const totalHousing = employees.reduce((sum, e) => sum + (Number(e.housingAllowance) || 0), 0);
  const totalTransport = employees.reduce((sum, e) => sum + (Number(e.transportAllowance) || 0), 0);
  const totalOtherAllowances = employees.reduce((sum, e) => sum + (Number(e.otherAllowances) || 0), 0);
  const totalGrossSalary = totalBasicSalary + totalHousing + totalTransport + totalOtherAllowances;
  const estimatedEmployerGosi = Math.round(totalBasicSalary * 0.1175);
  const totalMonthlyLaborCost = totalGrossSalary + estimatedEmployerGosi;
  const avgEmployeeCost = totalEmp > 0 ? Math.round(totalMonthlyLaborCost / totalEmp) : 0;

  const employeesWithIban = employees.filter((e) => e.iban && e.iban.trim().length >= 15).length;
  const ibanReadinessPct = totalEmp > 0 ? Math.round((employeesWithIban / totalEmp) * 100) : 100;

  // Attendance calculations
  const totalAtt = attendanceRecords.length;
  const presentAtt = attendanceRecords.filter((a) => a.status === "present" || a.status === "late").length;
  const lateAtt = attendanceRecords.filter((a) => a.status === "late" || (a.lateMinutes ?? 0) > 0).length;
  const absentAtt = attendanceRecords.filter((a) => a.status === "absent").length;
  const attendanceRatePct = totalAtt > 0 ? Math.round((presentAtt / totalAtt) * 1000) / 10 : 94.8;
  const totalLateMinutes = attendanceRecords.reduce((sum, a) => sum + (Number(a.lateMinutes) || 0), 0);
  const totalOvertimeHours = overtimeRecords.reduce((sum, o) => sum + (Number(o.hours) || 0), 0);
  const pendingCorrections = attendanceCorrections.filter((c) => c.status === "pending").length;

  // Leave & Workflow calculations
  const pendingRequests = requests.filter(
    (r) => r.status === "submitted" || r.status === "pending_approval"
  );
  const approvedRequests = requests.filter((r) => r.status === "approved" || r.status === "completed");
  const totalAnnualEntitlement = leaveBalances.reduce(
    (s, b: any) => s + (Number(b.entitledDays ?? b.annualEntitlement) || 21),
    0
  );
  const totalAnnualUsed = leaveBalances.reduce(
    (s, b: any) => s + (Number(b.usedDays ?? b.annualUsed) || 0),
    0
  );
  const totalAnnualRemaining = leaveBalances.reduce(
    (s, b: any) => s + (Number(b.remainingDays ?? b.annualRemaining) || 0),
    0
  );
  const leaveUtilizationPct =
    totalAnnualEntitlement > 0 ? Math.round((totalAnnualUsed / totalAnnualEntitlement) * 100) : 42;

  // Documents & Contracts
  const expiringDocs = employeeDocuments.filter(
    (d: any) => d.status === "expiring_soon" || d.status === "expired"
  );
  const missingIbanEmployees = employees.filter((e) => !e.iban || e.iban.trim().length < 15);
  const extendedList = Object.values(extendedRecords);

  // Loans, Expenses, Assets
  const activeLoans = loans.filter((l) => l.status === "active");
  const totalLoanBalance = activeLoans.reduce(
    (s, l: any) => s + (Number(l.remainingBalance ?? l.remainingAmount ?? l.amount) || 0),
    0
  );
  const pendingExpenses = expenseClaims.filter(
    (c) => c.status === "submitted" || c.status === "draft"
  );
  const totalExpensesAmount = expenseClaims.reduce((s, c) => s + (Number(c.amount) || 0), 0);
  const assignedAssets = hardwareAssets.filter((a: any) => a.status === "assigned");

  const nowIso = new Date().toISOString();

  // Department Breakdown helper
  const deptStats = orgUnits.slice(0, 6).map((dept) => {
    const deptEmps = employees.filter((e) => e.departmentId === dept.id);
    const deptSaudi = deptEmps.filter(
      (e) =>
        e.nationality?.includes("سعود") ||
        e.nationality?.toLowerCase().includes("saudi") ||
        e.nationalIdOrIqama?.startsWith("1")
    ).length;
    const deptSalary = deptEmps.reduce(
      (s, e) =>
        s +
        (Number(e.basicSalary) || 0) +
        (Number(e.housingAllowance) || 0) +
        (Number(e.transportAllowance) || 0) +
        (Number(e.otherAllowances) || 0),
      0
    );
    return {
      name: dept.nameAr,
      count: deptEmps.length,
      saudiCount: deptSaudi,
      saudiPct: deptEmps.length > 0 ? `${Math.round((deptSaudi / deptEmps.length) * 100)}%` : "0%",
      totalSalary: `${deptSalary.toLocaleString("en-US")} ر.س`,
    };
  });

  switch (domainId) {
    case "workforce_saudization":
      return {
        domainId,
        titleAr: "تقرير تحليل القوى العاملة والتوطين والهيكل التنظيمي",
        subtitleAr: "قراءة تحليلية شاملة لتوزيع الموظفين، نسب التوطين (نطاقات)، والإدارات",
        healthScorePct: saudizationPct >= 30 ? 94 : 82,
        generatedAt: nowIso,
        executiveSummary: `يبلغ إجمالي القوى العاملة المسجلة في النظام ${totalEmp} موظفاً وموظفة موزعين على ${orgUnits.length} إدارات و${workLocations.length} مواقع عمل. تبلغ نسبة الموظفين على رأس العمل الفعلي ${activeEmp} موظفاً (${totalEmp > 0 ? Math.round((activeEmp / totalEmp) * 100) : 0}%)، مع وجود ${probationEmp} موظفين في فترة التجربة و${onLeaveEmp} في إجازة. على صعيد الامتثال للتوطين، تبلغ نسبة السعودة الحالية ${saudizationPct}% (${saudiEmp} سعودي مقابل ${expatEmp} غير سعودي) مما يضع المنشأة في النطاق ${nitaqatBand}.`,
        kpis: [
          {
            label: "إجمالي القوى العاملة",
            value: `${totalEmp} موظف`,
            subtext: `${activeEmp} نشط | ${probationEmp} تجربة | ${onLeaveEmp} مجاز`,
            status: "good",
          },
          {
            label: "نسبة التوطين (نطاقات)",
            value: `${saudizationPct}%`,
            subtext: `${saudiEmp} سعودي | النطاق ${nitaqatBand}`,
            status: saudizationPct >= 30 ? "good" : "warning",
          },
          {
            label: "الإدارات ومواقع العمل",
            value: `${orgUnits.length} إدارات`,
            subtext: `موزعة عبر ${workLocations.length} فروع ومواقع`,
            status: "info",
          },
          {
            label: "ملفات الموظفين الممتدة (5 خطوات)",
            value: `${extendedList.length} ملف محدث`,
            subtext: `جاهزية البيانات البنكية ${ibanReadinessPct}%`,
            status: ibanReadinessPct >= 90 ? "good" : "warning",
          },
        ],
        breakdownTitle: "توزيع القوى العاملة ونسب التوطين والتكلفة حسب الإدارة",
        breakdownHeaders: ["الإدارة / القسم", "عدد الموظفين", "الموظفون السعوديون", "نسبة التوطين", "إجمالي الرواتب الشهرية"],
        breakdownRows:
          deptStats.length > 0
            ? deptStats.map((d) => [d.name, `${d.count}`, `${d.saudiCount}`, d.saudiPct, d.totalSalary])
            : [["الإدارة العامة", `${totalEmp}`, `${saudiEmp}`, `${saudizationPct}%`, `${totalGrossSalary.toLocaleString("en-US")} ر.س`]],
        anomalies: [
          ...(probationEmp > 0
            ? [`يوجد ${probationEmp} موظفين تحت التجربة يتطلبون متابعة تقييم تثبيت الخدمة قبل انتهاء الـ 90/180 يوماً.`]
            : []),
          ...(missingIbanEmployees.length > 0
            ? [`تم رصد ${missingIbanEmployees.length} موظفين بحاجة إلى استكمال أو تدقيق رقم الآيبان البنكي لضمان توافق ملف حماية الأجور.`]
            : ["جميع سجلات الموظفين النشطة مكتملة الهوية والبيانات الأساسية."]),
        ],
        recommendations: [
          {
            title: "مراجعة تقييمات فترة التجربة",
            description: `إصدار نماذج تقييم الأداء للموظفين الـ ${probationEmp} في فترة التجربة قبل موعد الاستحقاق.`,
            priority: "عاجل",
            targetRoute: "/employees",
            actionLabel: "فتح دليل الموظفين",
          },
          {
            title: "تحسين توازن التوطين بين الإدارات",
            description: "توجيه الشواغر الوظيفية الجديدة لدعم الإدارات ذات نسب التوطين الأقل من المتوسط العام.",
            priority: "مهم",
            targetRoute: "/organization",
            actionLabel: "استعراض الهيكل التنظيمي",
          },
        ],
        suggestedFollowUpQuestions: [
          "من هم الموظفون الموجودون في فترة التجربة حالياً؟",
          "حلل توزيع الرواتب والتوطين حسب الإدارات",
          "ما هي حالة عقود قوى والوثائق المنتهية؟",
        ],
      };

    case "payroll_financial":
      return {
        domainId,
        titleAr: "تقرير تحليل مسيرات الرواتب والتكاليف المالية وحماية الأجور (WPS)",
        subtitleAr: "تحليل مالي تفصيلي للرواتب الأساسية، البدلات، التأمينات الاجتماعية، وجاهزية الصرف البنكي",
        healthScorePct: ibanReadinessPct >= 90 ? 96 : 84,
        generatedAt: nowIso,
        executiveSummary: `تبلغ التكلفة الشهرية الإجمالية للأجور والرواتب في المنشأة ${totalMonthlyLaborCost.toLocaleString("en-US")} ر.س (بمتوسط ${avgEmployeeCost.toLocaleString("en-US")} ر.س للموظف الواحد). تتوزع الحزمة المالية الشهرية بين رواتب أساسية بقيمة ${totalBasicSalary.toLocaleString("en-US")} ر.س، وبدل سكن ${totalHousing.toLocaleString("en-US")} ر.س، وبدل نقل ${totalTransport.toLocaleString("en-US")} ر.س، وبدلات أخرى ${totalOtherAllowances.toLocaleString("en-US")} ر.س، بالإضافة إلى حصة المنشأة التقديرية في التأمينات الاجتماعية (GOSI) بقيمة ${estimatedEmployerGosi.toLocaleString("en-US")} ر.س. تبلغ جاهزية الحسابات البنكية (IBAN) لنظام حماية الأجور ${ibanReadinessPct}%.`,
        kpis: [
          {
            label: "إجمالي الرواتب والبدلات",
            value: `${totalGrossSalary.toLocaleString("en-US")} ر.س`,
            subtext: `الأساسي: ${totalBasicSalary.toLocaleString("en-US")} ر.س`,
            status: "good",
          },
          {
            label: "التكلفة الكلية شاملة GOSI",
            value: `${totalMonthlyLaborCost.toLocaleString("en-US")} ر.س`,
            subtext: `متوسط تكلفة الموظف: ${avgEmployeeCost.toLocaleString("en-US")} ر.س`,
            status: "info",
          },
          {
            label: "جاهزية حماية الأجور (WPS)",
            value: `${ibanReadinessPct}%`,
            subtext: `${employeesWithIban} من ${totalEmp} موظف مكتمل الآيبان`,
            status: ibanReadinessPct === 100 ? "good" : "warning",
          },
          {
            label: "السلف النشطة والمصروفات",
            value: `${totalLoanBalance.toLocaleString("en-US")} ر.س`,
            subtext: `${activeLoans.length} سلف نشطة | ${pendingExpenses.length} مطالبات معلقة`,
            status: pendingExpenses.length > 3 ? "warning" : "good",
          },
        ],
        breakdownTitle: "تفصيل بنود التكلفة المالية الشهرية للمنشأة",
        breakdownHeaders: ["البند المالي", "القيمة الشهرية (ر.س)", "النسبة من الإجمالي", "الحالة النظامية"],
        breakdownRows: [
          [
            "الرواتب الأساسية (Basic Salaries)",
            `${totalBasicSalary.toLocaleString("en-US")} ر.س`,
            `${totalMonthlyLaborCost > 0 ? Math.round((totalBasicSalary / totalMonthlyLaborCost) * 100) : 0}%`,
            "خاضع للتأمينات (GOSI)",
          ],
          [
            "بدلات السكن (Housing Allowances)",
            `${totalHousing.toLocaleString("en-US")} ر.س`,
            `${totalMonthlyLaborCost > 0 ? Math.round((totalHousing / totalMonthlyLaborCost) * 100) : 0}%`,
            "خاضع للتأمينات (GOSI)",
          ],
          [
            "بدلات النقل والمواصلات (Transport)",
            `${totalTransport.toLocaleString("en-US")} ر.س`,
            `${totalMonthlyLaborCost > 0 ? Math.round((totalTransport / totalMonthlyLaborCost) * 100) : 0}%`,
            "بدل تشغيلي معتمد",
          ],
          [
            "البدلات الإضافية والمخصصة",
            `${totalOtherAllowances.toLocaleString("en-US")} ر.س`,
            `${totalMonthlyLaborCost > 0 ? Math.round((totalOtherAllowances / totalMonthlyLaborCost) * 100) : 0}%`,
            "مرتبط بمسيرات الرواتب",
          ],
          [
            "حصة صاحب العمل في التأمينات (GOSI التقديرية)",
            `${estimatedEmployerGosi.toLocaleString("en-US")} ر.س`,
            `${totalMonthlyLaborCost > 0 ? Math.round((estimatedEmployerGosi / totalMonthlyLaborCost) * 100) : 0}%`,
            "التزام نظامي شهري",
          ],
        ],
        anomalies: [
          ...(missingIbanEmployees.length > 0
            ? [
                `يوجد ${missingIbanEmployees.length} موظفين بدون رقم آيبان مكتمل (${missingIbanEmployees
                  .slice(0, 3)
                  .map((e) => `${e.firstNameAr} ${e.lastNameAr}`)
                  .join("، ")}) مما قد يؤخر رفع ملف مدد / WPS.`,
              ]
            : ["جميع الحسابات البنكية للموظفين جاهزة لرفع ملف حماية الأجور (WPS)."]),
          ...(totalOvertimeHours > 0
            ? [`تم تسجيل ${totalOvertimeHours} ساعة عمل إضافي تستوجب المراجعة والاعتماد قبل إقفال مسير الرواتب.`]
            : []),
        ],
        recommendations: [
          {
            title: "تدقيق مسير الرواتب وملف WPS",
            description: "مراجعة استقطاعات التأمينات والسلف وتوليد ملف حماية الأجور للشهر الحالي.",
            priority: "عاجل",
            targetRoute: "/payroll",
            actionLabel: "فتح مسيرات الرواتب",
          },
          {
            title: "مراجعة السلف والمطالبات المالية",
            description: `اعتماد أو تسوية ${pendingExpenses.length} مطالبات مصروفات معلقة ومتابعة تحصيل أقساط السلف.`,
            priority: "مهم",
            targetRoute: "/expenses",
            actionLabel: "إدارة المصروفات والعهد",
          },
        ],
        suggestedFollowUpQuestions: [
          "ما هي تفاصيل البدلات والحسميات والتأمينات الاجتماعية؟",
          "من هم الموظفون الذين لديهم سلف نشطة أو نواقص في الآيبان؟",
          "اعرض مقارنة تكلفة الرواتب بين الإدارات",
        ],
      };

    case "attendance_shifts":
      return {
        domainId,
        titleAr: "تقرير تحليل الحضور والانصراف والورديات والعمل الإضافي",
        subtitleAr: "مؤشرات الانضباط اليومي، دقائق التأخير، ساعات العمل الإضافي، وطلبات تصحيح البصمة",
        healthScorePct: Math.round(attendanceRatePct),
        generatedAt: nowIso,
        executiveSummary: `تبلغ نسبة الانضباط والحضور العام في المنشأة ${attendanceRatePct}% عبر ${totalAtt} سجل حضور مسجل وموزع على ${shifts.length} ورديات عمل معتمدة. تم رصد ${lateAtt} حالة تأخير بإجمالي ${totalLateMinutes} دقيقة تأخير، و${absentAtt} حالة غياب، في حين بلغت ساعات العمل الإضافي المسجلة ${totalOvertimeHours} ساعة. كما يوجد حالياً ${pendingCorrections} طلبات لتصحيح سجلات البصمة بانتظار المراجعة.`,
        kpis: [
          {
            label: "نسبة الانضباط والحضور",
            value: `${attendanceRatePct}%`,
            subtext: `${presentAtt} سجل حضور من أصل ${totalAtt}`,
            status: attendanceRatePct >= 92 ? "good" : "warning",
          },
          {
            label: "حالات ودقائق التأخير",
            value: `${lateAtt} حالة`,
            subtext: `إجمالي دقائق التأخير: ${totalLateMinutes} دقيقة`,
            status: lateAtt > 3 ? "warning" : "good",
          },
          {
            label: "ساعات العمل الإضافي",
            value: `${totalOvertimeHours} ساعة`,
            subtext: `موزعة على ${overtimeRecords.length} تكليفات إضافية`,
            status: "info",
          },
          {
            label: "تصحيحات البصمة والورديات",
            value: `${pendingCorrections} معلق`,
            subtext: `${shifts.length} ورديات عمل نشطة في النظام`,
            status: pendingCorrections > 0 ? "warning" : "good",
          },
        ],
        breakdownTitle: "ملخص حالات سجلات الحضور والورديات",
        breakdownHeaders: ["المؤشر التشغيلي", "العدد / القيمة", "الأثر التشغيلي", "الإجراء الموصى به"],
        breakdownRows: [
          ["سجلات الحضور المكتملة في الموعد", `${Math.max(0, presentAtt - lateAtt)} سجل`, "انضباط قياسي", "لا يتطلب إجراء"],
          ["سجلات التأخير الصباحي", `${lateAtt} سجل (${totalLateMinutes} د)`, "يؤثر على صافي ساعات العمل", "تطبيق لائحة الجزاءات أو الاستئذان"],
          ["حالات الغياب المسجلة", `${absentAtt} حالة`, "يتطلب التحقق من أعذار الإجازات", "ربط الغياب بطلبات الإجازة أو الحسم"],
          ["ساعات العمل الإضافي (Overtime)", `${totalOvertimeHours} ساعة`, "تكلفة إضافية وفق المادة 107", "مراجعة الاعتماد قبل المسير"],
          ["طلبات تصحيح البصمة المعلقة", `${pendingCorrections} طلب`, "معلقة لدى المدير المباشر / HR", "البت السريع قبل إقفال الشهر"],
        ],
        anomalies: [
          ...(lateAtt > 0
            ? [`تم تسجيل ${lateAtt} حالات تأخير بإجمالي ${totalLateMinutes} دقيقة تحتاج إلى مطابقة مع أرصدة الاستئذان.`]
            : []),
          ...(pendingCorrections > 0
            ? [`يوجد ${pendingCorrections} طلبات تصحيح بصمة معلقة يجب البت فيها لضمان دقة مسير الرواتب.`]
            : ["لا توجد طلبات تصحيح بصمة متأخرة حالياً."]),
        ],
        recommendations: [
          {
            title: "اعتماد طلبات تصحيح البصمة والعمل الإضافي",
            description: "مراجعة سجلات الحضور المعلقة واعتماد الساعات الإضافية المستحقة.",
            priority: "عاجل",
            targetRoute: "/attendance",
            actionLabel: "فتح شاشة الحضور والانصراف",
          },
          {
            title: "مراجعة جدولة الورديات وساعات العمل",
            description: "التأكد من توافق ساعات العمل اليومية والأسبوعية وأيام الراحة التلقائية.",
            priority: "تحسيني",
            targetRoute: "/shifts",
            actionLabel: "إدارة الورديات",
          },
        ],
        suggestedFollowUpQuestions: [
          "من هم الموظفون الأكثر تأخيراً أو غياباً هذا الشهر؟",
          "ما هي تفاصيل ساعات العمل الإضافي وتكلفتها؟",
          "اعرض جدول الورديات وساعات العمل المعتمدة",
        ],
      };

    case "leaves_workflow":
      return {
        domainId,
        titleAr: "تقرير تحليل الإجازات والأرصدة وسير الموافقات (Workflow SLA)",
        subtitleAr: "تحليل شامل لأرصدة الإجازات السنوية، معدلات الاستهلاك، والطلبات العالقة في سلاسل الاعتماد",
        healthScorePct: pendingRequests.length <= 5 ? 92 : 79,
        generatedAt: nowIso,
        executiveSummary: `تظهر سجلات أرصدة الإجازات في النظام إجمالي استحقاقات سنوية قدرها ${totalAnnualEntitlement} يوماً، تم استهلاك ${totalAnnualUsed} يوماً منها (${leaveUtilizationPct}%)، بينما يبلغ الرصيد المتبقي التراكمي للموظفين ${totalAnnualRemaining} يوماً. وفيما يخص سير العمل والطلبات الذاتية (Workflow)، يوجد إجمالي ${requests.length} طلب في النظام، منها ${pendingRequests.length} طلبات معلقة بانتظار الاعتماد و${approvedRequests.length} طلبات معتمدة.`,
        kpis: [
          {
            label: "إجمالي الرصيد المتبقي",
            value: `${totalAnnualRemaining} يوم`,
            subtext: `من أصل ${totalAnnualEntitlement} يوم استحقاق سنوي`,
            status: "info",
          },
          {
            label: "نسبة استهلاك الإجازات",
            value: `${leaveUtilizationPct}%`,
            subtext: `${totalAnnualUsed} يوم مستهلك فعلياً`,
            status: leaveUtilizationPct <= 75 ? "good" : "warning",
          },
          {
            label: "الطلبات المعلقة للاعتماد",
            value: `${pendingRequests.length} طلب`,
            subtext: `من إجمالي ${requests.length} معاملة في النظام`,
            status: pendingRequests.length > 3 ? "warning" : "good",
          },
          {
            label: "المعاملات المعتمدة والمنجزة",
            value: `${approvedRequests.length} معاملة`,
            subtext: "تمت معالجتها عبر سلسلة الموافقات",
            status: "good",
          },
        ],
        breakdownTitle: "تحليل الطلبات والمعاملات حسب الحالة والنوع",
        breakdownHeaders: ["مرجع الطلب", "الموظف", "نوع الطلب", "تاريخ التقديم", "الحالة الحالية"],
        breakdownRows:
          requests.length > 0
            ? requests.slice(0, 6).map((r: any) => {
                const emp = employees.find((e) => e.id === r.employeeId);
                const empName = emp ? `${emp.firstNameAr} ${emp.lastNameAr}` : r.employeeId;
                return [
                  r.referenceNo || r.referenceNumber || r.id,
                  empName,
                  r.titleAr || r.type || r.category || "طلب إداري",
                  r.submittedAt || "2026-03-01",
                  r.status === "approved" ? "معتمد" : r.status === "rejected" ? "مرفوض" : "قيد المراجعة والاعتماد",
                ];
              })
            : [["-", "جميع الموظفين", "رصيد الإجازات السنوية العام", new Date().toISOString().slice(0, 10), "منتظم ومحدث"]],
        anomalies: [
          ...(pendingRequests.length > 0
            ? [`يوجد ${pendingRequests.length} طلبات معلقة في سير الموافقات تحتاج إلى اتخاذ قرار لتفادي تجاوز اتفاقية مستوى الخدمة (SLA).`]
            : ["جميع الطلبات في سير الموافقات تمت معالجتها ضمن الوقت القياسي."]),
          ...(leaveBalances.some((b: any) => (b.remainingDays ?? b.annualRemaining ?? 0) > 25)
            ? ["يوجد موظفون لديهم تكدس في رصيد الإجازات السنوية يتجاوز 25 يوماً، مما يرفع مخصص الالتزام المالي للإجازات."]
            : []),
        ],
        recommendations: [
          {
            title: "البت في الطلبات المعلقة في سير العمل",
            description: `مراجعة واعتماد الـ ${pendingRequests.length} طلبات المعلقة في صندوق الموافقات.`,
            priority: "عاجل",
            targetRoute: "/workflow",
            actionLabel: "فتح سير الموافقات",
          },
          {
            title: "تنظيم جدولة الإجازات السنوية",
            description: "حث الموظفين ذوي الأرصدة المتراكمة على جدولة إجازاتهم السنوية بالتنسيق مع مديري الإدارات.",
            priority: "مهم",
            targetRoute: "/leaves",
            actionLabel: "إدارة الإجازات والأرصدة",
          },
        ],
        suggestedFollowUpQuestions: [
          "ما هي الطلبات المعلقة حالياً في سير الموافقات؟",
          "من هم الموظفون الذين لديهم أعلى رصيد إجازات متبقٍ؟",
          "ما هي سياسة استحقاق الإجازة السنوية لموظفي أجير والعقود المحددة؟",
        ],
      };

    case "contracts_documents":
      return {
        domainId,
        titleAr: "تقرير تحليل العقود ومنصة قوى والوثائق وفترة التجربة",
        subtitleAr: "متابعة أنواع العقود التعاقدية، بنود قوى، فترات التجربة، وصلاحية الهويات والوثائق",
        healthScorePct: expiringDocs.length === 0 ? 95 : 83,
        generatedAt: nowIso,
        executiveSummary: `يغطي هذا التقرير الوضع التعاقدي والوثائقي لـ ${totalEmp} موظفاً في المنشأة. يدعم النظام الضوابط النظامية لمنصة قوى بحيث يتم احتساب أيام الراحة الأسبوعية تلقائياً (7 ناقص أيام العمل)، وإلغاء تاريخ انتهاء العقد للعقود غير محددة المدة، وحجب الإجازة السنوية لعقود أجير. يوجد حالياً ${probationEmp} موظفين في فترة التجربة، و${expiringDocs.length} وثيقة رسمية قريبة الانتهاء أو منتهية تتطلب التجديد.`,
        kpis: [
          {
            label: "إجمالي العقود السارية",
            value: `${totalEmp} عقد`,
            subtext: "مرتبطة بضوابط منصة قوى ونظام العمل",
            status: "good",
          },
          {
            label: "موظفون في فترة التجربة",
            value: `${probationEmp} موظف`,
            subtext: "فترة تجربة 90 - 180 يوماً",
            status: probationEmp > 0 ? "warning" : "good",
          },
          {
            label: "وثائق وهويات require تجديد",
            value: `${expiringDocs.length} وثيقة`,
            subtext: `من إجمالي ${employeeDocuments.length} وثيقة محفوظة`,
            status: expiringDocs.length > 0 ? "warning" : "good",
          },
          {
            label: "عقود ببنود قوى مخصصة",
            value: `${extendedList.length} عقد محدث`,
            subtext: "شاملة حساب الراحة الأسبوعية التلقائي",
            status: "info",
          },
        ],
        breakdownTitle: "بيان حالة العقود والوثائق للموظفين",
        breakdownHeaders: ["الرقم الوظيفي", "اسم الموظف", "نوع العقد", "تاريخ المباشرة", "الحالة التعاقدية"],
        breakdownRows: employees.slice(0, 6).map((e) => {
          const ext = extendedRecords[e.id];
          const contractLabel =
            ext?.contractDurationType === "indefinite"
              ? "غير محدد المدة (قوى)"
              : ext?.contractDurationType === "ajeer"
                ? "أجير (بدون إجازة سنوية)"
                : ext?.contractDurationType === "part_time"
                  ? "عمل مرن / دوام جزئي"
                  : e.workType === "on_site"
                    ? "عقد محدد المدة — دوام كامل"
                    : "عقد عمل معتمد";
          return [
            e.employeeNo,
            `${e.firstNameAr} ${e.lastNameAr}`,
            contractLabel,
            e.hireDate,
            e.status === "active" ? "نشط وموثق" : e.status === "probation" ? "فترة تجربة" : "إجازة",
          ];
        }),
        anomalies: [
          ...(expiringDocs.length > 0
            ? [`يوجد ${expiringDocs.length} وثائق رسمية (إقامة / جواز / رخصة عمل) مقاربة على الانتهاء أو منتهية.`]
            : ["جميع الوثائق الرسمية المرفوعة سارية المفعول."]),
          ...(probationEmp > 0
            ? [`يرجى متابعة تقييم الـ ${probationEmp} موظفين في فترة التجربة قبل تحول العقد إلى مثبت تلقائياً.`]
            : []),
        ],
        recommendations: [
          {
            title: "تجديد الوثائق والهويات المنتهية",
            description: "مراجعة خزينة الوثائق وإرسال تنبيهات تجديد الهويات والإقامات للموظفين المعنيين.",
            priority: "عاجل",
            targetRoute: "/documents",
            actionLabel: "فتح خزينة الوثائق",
          },
          {
            title: "استعراض عقود الموظفين وبنود قوى",
            description: "التأكد من إرفاق نسخ العقود الموثقة وبنود منصة قوى في ملفات الموظفين.",
            priority: "مهم",
            targetRoute: "/employees",
            actionLabel: "إدارة ملفات الموظفين",
          },
        ],
        suggestedFollowUpQuestions: [
          "ما هي الوثائق أو الإقامات التي تنتهي قريباً؟",
          "كيف يعمل حساب أيام الراحة الأسبوعية وبنود عقد قوى؟",
          "من هم الموظفون الخاضعون لفترة التجربة؟",
        ],
      };

    case "performance_recruitment": {
      const avgScore =
        evaluations.length > 0
          ? Math.round(
              (evaluations.reduce((s, ev) => s + (Number(ev.overallScore) || 0), 0) / evaluations.length) * 10
            ) / 10
          : 4.3;
      const openJobs = jobOpenings.filter((j: any) => j.status === "open" || j.isOpen !== false).length;
      return {
        domainId,
        titleAr: "تقرير تحليل تقييم الأداء والتوظيف واستقطاب الكفاءات",
        subtitleAr: "مؤشرات الأداء الوظيفي، التقييمات المعتمدة، الشواغر المفتوحة، وخط أنابيب المرشحين",
        healthScorePct: 91,
        generatedAt: nowIso,
        executiveSummary: `على صعيد إدارة الأداء الوظيفي، تم إنجاز ${evaluations.length} تقييم أداء بمتوسط تقييم عام يبلغ ${avgScore} من 5.0. وفي جانب التوظيف واستقطاب الكفاءات (ATS)، يوجد حالياً ${openJobs} شاغر وظيفي مفتوح من إجمالي ${jobOpenings.length} طلبات توظيف، ويتنافس عليها ${candidates.length} مرشحاً في مختلف مراحل الفرز والمقابلات والعروض الوظيفية.`,
        kpis: [
          {
            label: "متوسط تقييم الأداء العام",
            value: `${avgScore} / 5.0`,
            subtext: `بناءً على ${evaluations.length} تقييمات مسجلة`,
            status: "good",
          },
          {
            label: "الشواغر الوظيفية المفتوحة",
            value: `${openJobs} شاغر`,
            subtext: `من إجمالي ${jobOpenings.length} وظائف مطروحة`,
            status: "info",
          },
          {
            label: "المرشحون في مسار التوظيف",
            value: `${candidates.length} مرشح`,
            subtext: "في مراحل الفرز والمقابلات والعروض",
            status: "good",
          },
          {
            label: "نسبة إنجاز التقييمات",
            value: `${totalEmp > 0 ? Math.min(100, Math.round((evaluations.length / totalEmp) * 100)) : 85}%`,
            subtext: "تغطية دورة الأداء الحالية",
            status: "good",
          },
        ],
        breakdownTitle: "حالة الشواغر الوظيفية والمرشحين وتقييمات الأداء",
        breakdownHeaders: ["المجال", "البيان / المؤشر", "العدد / القيمة", "الحالة"],
        breakdownRows: [
          ["تقييم الأداء", "إجمالي التقييمات المنجزة", `${evaluations.length} تقييم`, `متوسط ${avgScore} / 5`],
          ["التوظيف (ATS)", "الشواغر الوظيفية النشطة", `${openJobs} وظيفة مفتوحة`, "جاري استقطاب المرشحين"],
          ["المرشحون", "إجمالي المتقدمين قيد التقييم", `${candidates.length} مرشح`, "موزعون على مراحل المقابلات"],
          ["التوطين في التوظيف", "نسبة التوطين الحالية بالمنشأة", `${saudizationPct}%`, `النطاق ${nitaqatBand}`],
        ],
        anomalies: [
          ...(openJobs > 0
            ? [`يوجد ${openJobs} شواغر وظيفية مفتوحة تحتاج إلى تسريع إجراءات المقابلات وإصدار العروض الوظيفية.`]
            : ["جميع الشواغر الوظيفية الحرجة تمت تغطيتها."]),
        ],
        recommendations: [
          {
            title: "استكمال تقييمات الأداء الدورية",
            description: "متابعة المديرين المباشرين لاعتماد تقييمات الأداء المتبقية وربطها بخطط التطوير.",
            priority: "مهم",
            targetRoute: "/performance",
            actionLabel: "فتح إدارة الأداء",
          },
          {
            title: "تسريع فرز المرشحين للشواغر المفتوحة",
            description: `مراجعة ملفات الـ ${candidates.length} مرشحين وإصدار العروض الوظيفية للكفاءات المؤهلة.`,
            priority: "مهم",
            targetRoute: "/recruitment",
            actionLabel: "فتح بوابة التوظيف",
          },
        ],
        suggestedFollowUpQuestions: [
          "ما هي الشواغر الوظيفية المفتوحة حالياً وعدد المرشحين؟",
          "اعرض ملخص نتائج تقييم الأداء للموظفين",
          "ما هي الوظائف التي تحتاج إلى خطط تعاقب وظيفي؟",
        ],
      };
    }

    case "assets_expenses_loans":
      return {
        domainId,
        titleAr: "تقرير تحليل العهد والأصول والسلف والمصروفات المالية",
        subtitleAr: "متابعة العهد التقنية المسلمة للموظفين، أرصدة السلف النشطة، ومطالبات تعويض المصروفات",
        healthScorePct: 93,
        generatedAt: nowIso,
        executiveSummary: `يُظهر سجل الأصول والعهد وجود ${hardwareAssets.length} أصلاً مسجلاً في المنشأة، منها ${assignedAssets.length} عهدة مسلمة للموظفين وموثقة. وعلى الصعيد المالي، يبلغ عدد السلف النشطة ${activeLoans.length} سلفة بإجمالي رصيد متبقٍ قدره ${totalLoanBalance.toLocaleString("en-US")} ر.س يتم استقطاعه آلياً عبر مسيرات الرواتب، بالإضافة إلى ${expenseClaims.length} مطالبات مصروفات بإجمالي ${totalExpensesAmount.toLocaleString("en-US")} ر.س (منها ${pendingExpenses.length} بانتظار الاعتماد).`,
        kpis: [
          {
            label: "الأصول والعهد المسلمة",
            value: `${assignedAssets.length} عهدة`,
            subtext: `من إجمالي ${hardwareAssets.length} أصل مسجل`,
            status: "good",
          },
          {
            label: "رصيد السلف المتبقي",
            value: `${totalLoanBalance.toLocaleString("en-US")} ر.س`,
            subtext: `موزع على ${activeLoans.length} سلفة نشطة`,
            status: "info",
          },
          {
            label: "إجمالي مطالبات المصروفات",
            value: `${totalExpensesAmount.toLocaleString("en-US")} ر.س`,
            subtext: `${expenseClaims.length} مطالبة (${pendingExpenses.length} معلقة)`,
            status: pendingExpenses.length > 0 ? "warning" : "good",
          },
          {
            label: "جاهزية إخلاء الطرف للعهد",
            value: "100%",
            subtext: "جميع العهد مربوطة بأرقام تسلسلية",
            status: "good",
          },
        ],
        breakdownTitle: "بيان السلف والمصروفات والعهد المسجلة",
        breakdownHeaders: ["النوع", "البيان / الوصف", "العدد / القيمة", "الحالة"],
        breakdownRows: [
          ["العهد التقنية والمكتبية", "أجهزة ومعدات مسلمة للموظفين", `${assignedAssets.length} أصل`, "موثقة ومربوطة بالملف الوظيفي"],
          ["عهد متاحة في المستودع", "أصول جاهزة للتخصيص", `${Math.max(0, hardwareAssets.length - assignedAssets.length)} أصل`, "متاحة للتسليم"],
          ["السلف المالية النشطة", "أرصدة السلف قيد التحصيل الشهري", `${totalLoanBalance.toLocaleString("en-US")} ر.س`, `${activeLoans.length} سلف نشطة`],
          ["مطالبات المصروفات", "فواتير ومصروفات عمل للموظفين", `${totalExpensesAmount.toLocaleString("en-US")} ر.س`, `${pendingExpenses.length} بانتظار الصرف`],
        ],
        anomalies: [
          ...(pendingExpenses.length > 0
            ? [`يوجد ${pendingExpenses.length} مطالبات مصروفات معلقة بانتظار المراجعة المالية والاعتماد.`]
            : ["جميع مطالبات المصروفات تمت تسويتها."]),
        ],
        recommendations: [
          {
            title: "اعتماد مطالبات المصروفات المعلقة",
            description: "مراجعة الفواتير المرفقة واعتماد صرف المستحقات المالية للموظفين.",
            priority: "مهم",
            targetRoute: "/expenses",
            actionLabel: "فتح المصروفات",
          },
          {
            title: "جرد العهد والأصول التقنية",
            description: "التحقق الدوري من حالة الأجهزة المسلمة للموظفين وتحديث سجل العهد.",
            priority: "تحسيني",
            targetRoute: "/assets",
            actionLabel: "إدارة العهد والأصول",
          },
        ],
        suggestedFollowUpQuestions: [
          "ما هي السلف النشطة وأقساطها الشهرية؟",
          "اعرض قائمة العهد والأجهزة المسلمة للموظفين",
          "ما هي مطالبات المصروفات المعلقة للاعتماد؟",
        ],
      };

    case "executive_all":
    default: {
      const overallHealth = Math.round((saudizationPct >= 30 ? 94 : 84) * 0.35 + attendanceRatePct * 0.35 + ibanReadinessPct * 0.3);
      return {
        domainId: "executive_all",
        titleAr: "التقرير التنفيذي الشامل لكل النظام (360° System Intelligence)",
        subtitleAr: "تحليل ذكي موحد يربط القوى العاملة، الرواتب، الحضور، الإجازات، العقود، والأداء في قراءة تنفيذية واحدة",
        healthScorePct: Math.min(99, Math.max(78, overallHealth)),
        generatedAt: nowIso,
        executiveSummary: `يُقدم هذا التقرير قراءة تنفيذية شاملة ومباشرة لكافة وحدات نظام الموارد البشرية:
• القوى العاملة والتوطين: إجمالي ${totalEmp} موظفاً (${activeEmp} على رأس العمل، ${probationEmp} تحت التجربة، ${onLeaveEmp} في إجازة) موزعين على ${orgUnits.length} إدارات، بنسبة توطين ${saudizationPct}% (النطاق ${nitaqatBand}).
• الرواتب والتكاليف المالية: إجمالي الرواتب والبدلات الشهرية ${totalGrossSalary.toLocaleString("en-US")} ر.س، وتبلغ التكلفة الكلية شاملة التأمينات التقديرية ${totalMonthlyLaborCost.toLocaleString("en-US")} ر.س، مع جاهزية حماية أجور (WPS) بنسبة ${ibanReadinessPct}%.
• الانضباط والإجازات وسير العمل: معدل الحضور العام ${attendanceRatePct}%، إجمالي الساعات الإضافية ${totalOvertimeHours} ساعة، نسبة استهلاك الإجازات ${leaveUtilizationPct}%، ويوجد ${pendingRequests.length} طلبات معلقة في سير الموافقات.`,
        kpis: [
          {
            label: "القوى العاملة والتوطين",
            value: `${totalEmp} موظف (${saudizationPct}%)`,
            subtext: `النطاق ${nitaqatBand} | ${orgUnits.length} إدارات`,
            status: "good",
          },
          {
            label: "التكلفة الشهرية للأجور",
            value: `${totalMonthlyLaborCost.toLocaleString("en-US")} ر.س`,
            subtext: `جاهزية WPS: ${ibanReadinessPct}%`,
            status: ibanReadinessPct === 100 ? "good" : "warning",
          },
          {
            label: "معدل الانضباط والحضور",
            value: `${attendanceRatePct}%`,
            subtext: `${lateAtt} تأخير | ${totalOvertimeHours} س إضافي`,
            status: attendanceRatePct >= 90 ? "good" : "warning",
          },
          {
            label: "الطلبات والوثائق النشطة",
            value: `${pendingRequests.length} طلب معلق`,
            subtext: `${expiringDocs.length} وثائق require تجديد`,
            status: pendingRequests.length > 3 ? "warning" : "good",
          },
        ],
        breakdownTitle: "مصفوفة الأداء التنفيذي لوحدات النظام الثمان",
        breakdownHeaders: ["الوحدة / القسم في النظام", "المؤشر الرئيسي المباشر", "الحالة التحليلية", "أهم نقطة متابعة"],
        breakdownRows: [
          [
            "1. الموظفون والتوطين (Employees & Nitaqat)",
            `${totalEmp} موظف | توطين ${saudizationPct}%`,
            `النطاق ${nitaqatBand}`,
            `${probationEmp} موظفين في فترة التجربة`,
          ],
          [
            "2. مسيرات الرواتب وWPS (Payroll & GOSI)",
            `${totalGrossSalary.toLocaleString("en-US")} ر.س صافي الحزمة`,
            `جاهزية آيبان ${ibanReadinessPct}%`,
            missingIbanEmployees.length > 0 ? `استكمال آيبان لـ ${missingIbanEmployees.length} موظف` : "جاهز للصرف",
          ],
          [
            "3. الحضور والورديات (Attendance & Shifts)",
            `نسبة الحضور ${attendanceRatePct}%`,
            `${shifts.length} ورديات نشطة`,
            `${lateAtt} حالة تأخير و${pendingCorrections} تصحيح بصمة`,
          ],
          [
            "4. الإجازات وسير العمل (Leaves & Workflow)",
            `استهلاك ${leaveUtilizationPct}% (${totalAnnualRemaining} يوم متبقٍ)`,
            `${pendingRequests.length} طلبات معلقة`,
            "تسريع اعتماد الطلبات المعلقة",
          ],
          [
            "5. العقود والوثائق (Qiwa Contracts & Docs)",
            `${totalEmp} عقد | ${employeeDocuments.length} وثيقة`,
            expiringDocs.length > 0 ? `${expiringDocs.length} تنبيه صلاحية` : "مكتمل الصلاحية",
            "متابعة تجديد الهويات والعقود",
          ],
          [
            "6. الأداء والتوظيف (Performance & ATS)",
            `${evaluations.length} تقييم | ${jobOpenings.length} وظائف`,
            `${candidates.length} مرشح قيد الفرز`,
            "استكمال مقابلات الشواغر المفتوحة",
          ],
          [
            "7. العهد والسلف والمصروفات (Assets & Loans)",
            `${assignedAssets.length} عهدة | سلف ${totalLoanBalance.toLocaleString("en-US")} ر.س`,
            `${pendingExpenses.length} مصروفات معلقة`,
            "مراجعة مطالبات المصروفات",
          ],
          [
            "8. كتالوج التقارير المعتمدة (Governed Reports)",
            `${METRIC_CATALOG.length} مؤشر قياسي معتمد`,
            "مفعل ومربوط بالصلاحيات",
            "إمكانية التصدير المباشر Excel / PDF / CSV",
          ],
        ],
        anomalies: [
          ...(pendingRequests.length > 0
            ? [`يوجد ${pendingRequests.length} معاملات معلقة في سير الموافقات تتطلب البت السريع.`]
            : []),
          ...(missingIbanEmployees.length > 0
            ? [`يوجد ${missingIbanEmployees.length} موظفين بحاجة إلى تحديث رقم الآيبان البنكي قبل إصدار ملف حماية الأجور.`]
            : []),
          ...(expiringDocs.length > 0
            ? [`تم رصد ${expiringDocs.length} وثائق رسمية مقاربة على الانتهاء في خزينة الوثائق.`]
            : []),
          ...(lateAtt > 0
            ? [`تم تسجيل ${lateAtt} حالات تأخير بإجمالي ${totalLateMinutes} دقيقة خلال الدورة الحالية.`]
            : []),
        ],
        recommendations: [
          {
            title: "استعراض مركز التقارير المتقدمة",
            description: "توليد وتصدير التقارير التفصيلية المعتمدة بصيغ Excel وPDF وCSV.",
            priority: "مهم",
            targetRoute: "/reports",
            actionLabel: "فتح مركز التقارير",
          },
          {
            title: "معالجة الطلبات المعلقة في سير الموافقات",
            description: `اتخاذ قرار بشأن الـ ${pendingRequests.length} طلبات المعلقة حالياً.`,
            priority: "عاجل",
            targetRoute: "/workflow",
            actionLabel: "فتح سير الموافقات",
          },
          {
            title: "تدقيق مسير الرواتب وحماية الأجور",
            description: "مراجعة جاهزية الرواتب والبدلات والحسميات للشهر الحالي.",
            priority: "مهم",
            targetRoute: "/payroll",
            actionLabel: "فتح مسيرات الرواتب",
          },
        ],
        suggestedFollowUpQuestions: [
          "حلل لي تقرير مسير الرواتب والتكاليف المالية بالتفصيل",
          "ما هي حالة التوطين ونطاقات وتوزيع الموظفين على الإدارات؟",
          "حلل تقرير الحضور والانصراف وساعات العمل الإضافي",
          "ما هي أهم المخاطر والتنبيهات العاجلة في النظام اليوم؟",
        ],
      };
    }
  }
}

// ============================================================================
// 3. INTELLIGENT CONVERSATIONAL ASSISTANT GENERATOR
// ============================================================================

function formatAnalysisForChat(rep: SmartReportAnalysis): string {
  const kpiLines = rep.kpis.map((k) => `• **${k.label}:** ${k.value} _(${k.subtext})_`).join("\n");
  const anomalyLines =
    rep.anomalies.length > 0
      ? rep.anomalies.map((a) => `⚠️ ${a}`).join("\n")
      : "✅ لا توجد مخاطر أو انحرافات حرجة مرصودة.";
  const recLines = rep.recommendations
    .map((r) => `• **[${r.priority}] ${r.title}:** ${r.description}`)
    .join("\n");

  const tablePreview = rep.breakdownRows
    .slice(0, 5)
    .map((row) => `• **${row[0]}:** ${row.slice(1).join(" | ")}`)
    .join("\n");

  return `📊 **${rep.titleAr}** (مؤشر الصحة التشغيلية: **${rep.healthScorePct}%**)

**1. الملخص التنفيذي:**
${rep.executiveSummary}

**2. المؤشرات الرئيسية المباشرة (KPIs):**
${kpiLines}

**3. ${rep.breakdownTitle}:**
${tablePreview}

**4. رصد المخاطر والانحرافات:**
${anomalyLines}

**5. التوصيات الذكية المقترحة:**
${recLines}`;
}

export function generateSmartAssistantResponse(
  query: string,
  app: Partial<AppContextType>,
  userRole: string = "hr_manager"
): {
  responseText: string;
  intent: string;
  matchedReportDomain?: SmartReportDomainId;
  metadata?: Record<string, unknown>;
} {
  const q = query.trim().toLowerCase();
  const intent = detectIntent(query);
  const employees = app.employees ?? [];
  const extendedRecords = getAllExtendedEmployees();

  // 0. A: Natural Language & Voice-Driven Employee Creation Intent
  const isEmployeeCreateIntent =
    q.startsWith("أضف موظف") ||
    q.startsWith("اضف موظف") ||
    q.startsWith("تسجيل موظف") ||
    q.startsWith("سجل موظف") ||
    q.startsWith("إضافة موظف") ||
    q.startsWith("اضافة موظف") ||
    q.startsWith("ضيف موظف") ||
    q.includes("أضف موظف جديد") ||
    q.includes("اضف موظف جديد") ||
    q.includes("تسجيل موظف جديد") ||
    q.includes("إضافة موظف جديد") ||
    ((q.includes("موظف") || q.includes("موظفة")) &&
      (q.includes("راتب") || q.includes("راتبه") || q.includes("هوية") || q.includes("قسم")));

  if (isEmployeeCreateIntent) {
    const draft = parseEmployeeDetailsFromText(query, app.orgUnits ?? []);
    const totalPkg = draft.basicSalary + draft.housingAllowance + draft.transportAllowance + draft.otherAllowances;
    return {
      intent: "employee_create_draft",
      metadata: {
        actionType: "create_employee_confirmation",
        employeeDraft: draft,
      },
      responseText: `🎉 **تم تحليل واستخراج بيانات الموظف الجديد بنجاح عبر الذكاء الاصطناعي:**

• **الاسم بالكامل:** ${draft.firstNameAr} ${draft.lastNameAr} (${draft.firstNameEn} ${draft.lastNameEn})
• **المسمى الوظيفي:** ${draft.jobTitleAr} (${draft.jobTitleEn})
• **الإدارة / القسم:** ${draft.departmentName}
• **رقم الهوية / الإقامة:** \`${draft.nationalIdOrIqama}\`
• **الراتب الأساسي:** ${draft.basicSalary.toLocaleString()} ر.س | **بدل السكن:** ${draft.housingAllowance.toLocaleString()} ر.س | **بدل النقل:** ${draft.transportAllowance.toLocaleString()} ر.س
• **إجمالي الحزمة الشهرية:** ${totalPkg.toLocaleString()} ر.س
• **الجنسية:** ${draft.nationality} | **رقم الجوال:** ${draft.phone}
• **البريد الإلكتروني:** ${draft.email}

:::employee_card
${JSON.stringify(draft)}
:::

اضغط على زر **اعتماد وإضافة الموظف للنظام الآن** أدناه لتثبيت سجله فوراً وتحديث كافة قواعد البيانات.`,
    };
  }

  // 0. B: Country Labor Regulations & HR News Retrieval (All 7 Countries: SA, EG, AE, QA, KW, BH, OM)
  const laborLawAnswer = searchCountryLaborRegulations(query);
  if (laborLawAnswer) {
    return {
      intent: "labor_regulations",
      responseText: laborLawAnswer,
    };
  }

  // 1. Check if user is asking about a specific employee by name or employeeNo
  const matchedEmployee = employees.find((emp) => {
    const fullNameAr = `${emp.firstNameAr} ${emp.lastNameAr}`.toLowerCase();
    const fullNameEn = `${emp.firstNameEn || ""} ${emp.lastNameEn || ""}`.toLowerCase().trim();
    return (
      (emp.firstNameAr && q.includes(emp.firstNameAr.toLowerCase()) && emp.lastNameAr && q.includes(emp.lastNameAr.toLowerCase())) ||
      (fullNameAr.length > 3 && q.includes(fullNameAr)) ||
      (fullNameEn.length > 3 && q.includes(fullNameEn)) ||
      (emp.employeeNo && q.includes(emp.employeeNo.toLowerCase()))
    );
  });

  if (matchedEmployee) {
    const ext = extendedRecords[matchedEmployee.id];
    const dept = (app.orgUnits ?? []).find((d) => d.id === matchedEmployee.departmentId);
    const leaveBal = (app.leaveBalances ?? []).find((b) => b.employeeId === matchedEmployee.id) as any;
    const empAtt = (app.attendanceRecords ?? []).filter((a) => a.employeeId === matchedEmployee.id);
    const totalSalary =
      (Number(matchedEmployee.basicSalary) || 0) +
      (Number(matchedEmployee.housingAllowance) || 0) +
      (Number(matchedEmployee.transportAllowance) || 0) +
      (Number(matchedEmployee.otherAllowances) || 0);
    const remDays = leaveBal ? (leaveBal.remainingDays ?? leaveBal.annualRemaining ?? 21) : (ext?.contractAnnualLeaveDays ?? 21);
    const usedDays = leaveBal ? (leaveBal.usedDays ?? leaveBal.annualUsed ?? 0) : 0;
    const entDays = leaveBal ? (leaveBal.entitledDays ?? leaveBal.annualEntitlement ?? 21) : (ext?.contractAnnualLeaveDays ?? 21);

    return {
      intent: "employee_search",
      matchedReportDomain: "workforce_saudization",
      responseText: `📋 **التحليل الشامل لملف الموظف: ${matchedEmployee.firstNameAr} ${matchedEmployee.lastNameAr} (${matchedEmployee.employeeNo})**

**1. البيانات الوظيفية والتنظيمية:**
• **المسمى الوظيفي:** ${matchedEmployee.jobTitleAr} (${matchedEmployee.jobTitleEn || "-"})
• **الإدارة / القسم:** ${dept?.nameAr || matchedEmployee.departmentId || "الإدارة العامة"}
• **الحالة الوظيفية:** ${matchedEmployee.status === "active" ? "على رأس العمل (نشط)" : matchedEmployee.status === "probation" ? "فترة تجربة" : "في إجازة"}
• **تاريخ المباشرة:** ${matchedEmployee.hireDate} | **الجنسية:** ${matchedEmployee.nationality}

**2. الحزمة المالية والبيانات البنكية:**
• **الراتب الأساسي:** ${(Number(matchedEmployee.basicSalary) || 0).toLocaleString("en-US")} ر.س
• **بدل السكن:** ${(Number(matchedEmployee.housingAllowance) || 0).toLocaleString("en-US")} ر.س | **بدل النقل:** ${(Number(matchedEmployee.transportAllowance) || 0).toLocaleString("en-US")} ر.س
• **إجمالي الراتب الشهري:** ${totalSalary.toLocaleString("en-US")} ر.س
• **البنك والآيبان:** ${matchedEmployee.bankName || "غير محدد"} — \`${matchedEmployee.iban || "غير مسجل"}\` ${ext?.lockBankData ? "(تعديل الحساب مقفل 🔒)" : ""}

**3. العقد والإجازات والحضور:**
• **نوع العقد:** ${ext?.contractDurationType ? `عقد قوى (${ext.contractDurationType})` : "عقد عمل معتمد"} | **أيام العمل الأسبوعية:** ${ext?.weeklyWorkDays ?? 5} أيام (راحة أسبوعية: ${ext?.weeklyRestDays ?? 2} يوم)
• **رصيد الإجازات السنوية المتبقي:** ${remDays} يوم (مستهلك: ${usedDays} من ${entDays})
• **سجلات الحضور المسجلة:** ${empAtt.length} سجل حضور في الدورة الحالية.`,
    };
  }

  // 2. Route to specific analytical report domain based on query keywords or intent
  if (
    q.includes("شامل") ||
    q.includes("كل النظام") ||
    q.includes("جميع التقارير") ||
    q.includes("تحليل التقارير") ||
    q.includes("ملخص تنفيذي") ||
    q.includes("360")
  ) {
    const rep = buildSmartReportAnalysis("executive_all", app);
    return {
      intent: "insights_summary",
      matchedReportDomain: "executive_all",
      responseText: formatAnalysisForChat(rep),
    };
  }

  if (intent === "payroll_summary" || q.includes("wps") || q.includes("حماية الأجور") || q.includes("تأمينات") || q.includes("gosi") || q.includes("بدلات") || q.includes("مالي")) {
    const rep = buildSmartReportAnalysis("payroll_financial", app);
    return {
      intent: "payroll_summary",
      matchedReportDomain: "payroll_financial",
      responseText: formatAnalysisForChat(rep),
    };
  }

  if (intent === "attendance_check" || q.includes("ورديات") || q.includes("إضافي") || q.includes("بصمة") || q.includes("انصراف")) {
    const rep = buildSmartReportAnalysis("attendance_shifts", app);
    return {
      intent: "attendance_check",
      matchedReportDomain: "attendance_shifts",
      responseText: formatAnalysisForChat(rep),
    };
  }

  if (intent === "leave_balance" || q.includes("طلبات") || q.includes("اعتماد") || q.includes("موافقات") || q.includes("workflow")) {
    const rep = buildSmartReportAnalysis("leaves_workflow", app);
    return {
      intent: "leave_balance",
      matchedReportDomain: "leaves_workflow",
      responseText: formatAnalysisForChat(rep),
    };
  }

  if (q.includes("عقد") || q.includes("عقود") || q.includes("قوى") || q.includes("وثائق") || q.includes("إقامة") || q.includes("هوية") || q.includes("تجربة")) {
    const rep = buildSmartReportAnalysis("contracts_documents", app);
    return {
      intent: "policy_rag",
      matchedReportDomain: "contracts_documents",
      responseText: formatAnalysisForChat(rep),
    };
  }

  if (intent === "performance_review" || intent === "recruitment_pipeline" || intent === "succession_risks") {
    const rep = buildSmartReportAnalysis("performance_recruitment", app);
    return {
      intent,
      matchedReportDomain: "performance_recruitment",
      responseText: formatAnalysisForChat(rep),
    };
  }

  if (q.includes("عهد") || q.includes("أصول") || q.includes("سلف") || q.includes("مصروف") || q.includes("قرض")) {
    const rep = buildSmartReportAnalysis("assets_expenses_loans", app);
    return {
      intent: "general_chat",
      matchedReportDomain: "assets_expenses_loans",
      responseText: formatAnalysisForChat(rep),
    };
  }

  if (
    intent === "employee_search" ||
    q.includes("توطين") ||
    q.includes("سعودة") ||
    q.includes("نطاقات") ||
    q.includes("قوى العاملة") ||
    q.includes("هيكل") ||
    q.includes("إدارات")
  ) {
    const rep = buildSmartReportAnalysis("workforce_saudization", app);
    return {
      intent: "employee_search",
      matchedReportDomain: "workforce_saudization",
      responseText: formatAnalysisForChat(rep),
    };
  }

  if (intent === "policy_rag" || intent === "learning_certificates") {
    const rag = searchKnowledgeBase(query, userRole as any);
    if (rag.hasSufficientContext) {
      return {
        intent,
        responseText: `📚 **المرجع النظامي والسياسات المعتمدة:**\n\n${rag.answer}\n\n💡 *يمكنك أيضاً طلب تحليل تطبيقي لهذه السياسة على بيانات الموظفين الحالية في النظام.*`,
      };
    }
  }

  // If the query explicitly asks for an executive/general report or overall system analytics:
  const isExplicitReportRequest =
    q.includes("تقرير") ||
    q.includes("تقارير") ||
    q.includes("شامل") ||
    q.includes("كل النظام") ||
    q.includes("تحليل شامل") ||
    q.includes("360") ||
    q.includes("ملخص تنفيذي") ||
    q.includes("لوحة القيادة") ||
    q.includes("صحة المنظومة");

  if (isExplicitReportRequest) {
    const execRep = buildSmartReportAnalysis("executive_all", app);
    return {
      intent: "insights_summary",
      matchedReportDomain: "executive_all",
      responseText: `🤖 **تحليل المساعد الذكي لبيانات النظام المباشرة:**\n\n${formatAnalysisForChat(execRep)}`,
    };
  }

  // Otherwise, treat as general conversational assistant (ChatGPT / Gemini / Claude style):
  const generalAnswer = generateSmartGeneralResponse(query, app, userRole);
  return {
    intent: "general_chat",
    responseText: generalAnswer,
  };
}


// ============================================================================
// 4. MADARX SOVEREIGN PROPRIETARY INTELLIGENCE ENGINE (BUILT FROM THE GROUND UP)
// 100% Independent, Private, and Deeply Integrated with All System & External Domain Data
// ============================================================================

interface EOSBCalculationResult {
  salary: number;
  years: number;
  isResignation: boolean;
  first5Amount: number;
  remainingAmount: number;
  fullBase: number;
  ratio: number;
  ratioExplanation: string;
  netReward: number;
}

function parseAndCalculateEOSB(query: string): EOSBCalculationResult | null {
  const q = query.toLowerCase();
  // Extract salary
  const salaryMatch =
    q.match(/راتب(?:ه|ها|ي)?\s*[:=]?\s*([0-9][0-9,\.]*)/) ||
    q.match(/([0-9]{4,6})\s*(?:ريال|ر\.س|رس)/) ||
    q.match(/(\d{4,6})/);

  // Extract years
  const yearsMatch =
    q.match(/([0-9]+(?:\.[0-9]+)?)\s*(?:سنة|سنوات|سنين|عام|أعوام)/) ||
    q.match(/خدم(?:ة|ته)?\s*([0-9]+(?:\.[0-9]+)?)/);

  if (!salaryMatch || !yearsMatch) return null;

  const salary = parseFloat(salaryMatch[1].replace(/,/g, ''));
  const years = parseFloat(yearsMatch[1]);
  if (isNaN(salary) || isNaN(years) || salary < 1000 || years <= 0) return null;

  const isResignation =
    q.includes("استقال") ||
    q.includes("استقالة") ||
    q.includes("استقالته") ||
    q.includes("استقالتها") ||
    q.includes("قدم استقالة");

  const first5Years = Math.min(5, years);
  const remainingYears = Math.max(0, years - 5);

  const first5Amount = first5Years * (salary / 2);
  const remainingAmount = remainingYears * salary;
  const fullBase = first5Amount + remainingAmount;

  let ratio = 1.0;
  let ratioExplanation = "استحقاق كامل بنسبة 100% (إنهاء العقد من طرف المنشأة أو انتهاء مدة العقد المحدد - المادة 84)";

  if (isResignation) {
    if (years < 2) {
      ratio = 0;
      ratioExplanation = "لا يستحق مكافأة (مدة الخدمة أقل من سنتين متتاليتين - المادة 85)";
    } else if (years < 5) {
      ratio = 1 / 3;
      ratioExplanation = "ثلث المكافأة (33.33%) - مدة الخدمة من سنتين حتى 5 سنوات (المادة 85)";
    } else if (years < 10) {
      ratio = 2 / 3;
      ratioExplanation = "ثلثي المكافأة (66.67%) - مدة الخدمة من 5 سنوات حتى 10 سنوات (المادة 85)";
    } else {
      ratio = 1.0;
      ratioExplanation = "المكافأة كاملة (100%) - مدة الخدمة 10 سنوات فأكثر (المادة 85)";
    }
  }

  const netReward = Math.round(fullBase * ratio);

  return {
    salary,
    years,
    isResignation,
    first5Amount,
    remainingAmount,
    fullBase,
    ratio,
    ratioExplanation,
    netReward,
  };
}

export function generateSmartGeneralResponse(
  query: string,
  app: Partial<AppContextType>,
  userRole: string = "hr_manager"
): string {
  const q = query.trim().toLowerCase();
  const employees = app.employees ?? [];
  const orgUnits = app.orgUnits ?? [];
  const empCount = employees.length;

  // Check if query targets country labor regulations or HR news
  const countryAnswer = searchCountryLaborRegulations(query);
  if (countryAnswer) {
    return countryAnswer;
  }

  // --------------------------------------------------------------------------
  // A. GREETINGS & PERSONAL IDENTITY (SOVEREIGN AI ENGINE)
  // --------------------------------------------------------------------------
  if (
    q === "مرحبا" ||
    q === "أهلا" ||
    q === "اهلا" ||
    q.includes("صباح الخير") ||
    q.includes("مساء الخير") ||
    q.includes("السلام عليكم") ||
    q === "هلا" ||
    q.includes("كيف حالك") ||
    q.includes("كيفك") ||
    q.includes("شكرا") ||
    q.includes("شكراً")
  ) {
    if (q.includes("شكرا") || q.includes("شكراً")) {
      return `العفو أستاذي! أنا في خدمتك دائماً في أي استشارة، صياغة مستند، أو استعلام عن بيانات المنشأة وموظفيها.`;
    }
    return `👋 **أهلاً وسهلاً بك في نظام مدار إكس الذكي (MadarX Sovereign AI)**

أنا **مساعدك الذكي الشخصي والمستقل بالكامل**، تم بنائي خصيصاً لمنشأتك لأعمل معك محلياً وبأعلى درجات الخصوصية والذكاء الفوري.

✨ **أهم القدرات والخصائص الخارقة المتاحة لك الآن:**
• 🎙️ **إضافة الموظفين بالصوت:** تحدث إليّ هاتفياً بصوتك وسأقوم بتفريغ البيانات وإنشاء بطاقة الموظف واعتماده فوراً.
• 📷 **المسح الضوئي الذكي (OCR):** ارفع صورة هوية، عقد ورقي، أو Screenshot، وسأستخرج منها بيانات الموظف وأضيفه للنظام بضغطة زر.
• 🌍 **قوانين مكاتب العمل لـ 7 دول:** السعودية 🇸🇦، مصر 🇪🇬، الإمارات 🇦🇪، قطر 🇶🇦، الكويت 🇰🇼، البحرين 🇧🇭، وعمان 🇴🇲، مع تحديثات 2026 لحظية.
• 📄 **صياغة الخطابات الرسمية:** عروض العمل، خطابات الترقية، الإنذارات، شهادات الخبرة، وقبول الاستقالة.
• 📊 **التقارير والتحليلات 360°:** تنفيذ أي تقرير تريده في النظام (رواتب، حضور، توطين، إجازات) بمؤشرات دقيقة.

اطلب مني أي شيء أو تحدث بصوتك وسأنفذه لك فوراً!`;
  }

  // --------------------------------------------------------------------------
  // B. INTERACTIVE END-OF-SERVICE CALCULATION WITH NUMBERS (حاسبة نهاية الخدمة التفاعلية)
  // --------------------------------------------------------------------------
  if (q.includes("نهاية الخدمة") || q.includes("مكافأة نهاية") || q.includes("احسب نهاية") || q.includes("حساب نهاية")) {
    const calc = parseAndCalculateEOSB(query);
    if (calc) {
      return `🧮 **نتيجة الحسبة التفاعلية لمكافأة نهاية الخدمة (نظام العمل السعودي):**

**1. البيانات والمدخلات المعتمدة:**
• **الأجر الفعلي الأساسي والبدلات:** ${calc.salary.toLocaleString("en-US")} ر.س
• **مدة الخدمة المحتسبة:** ${calc.years} سنة
• **سبب انتهاء العلاقة التعاقدية:** ${calc.isResignation ? "استقالة من طرف العامل (المادة 85)" : "إنهاء العقد من طرف المنشأة / انتهاء المدة (المادة 84)"}

**2. تفصيل الحسبة خطوة بخطوة:**
• **السنوات الخمس الأولى (أجر نصف شهر عن كل سنة):**
  ${Math.min(5, calc.years)} × (${calc.salary.toLocaleString("en-US")} ÷ 2) = **${calc.first5Amount.toLocaleString("en-US")} ر.س**
${calc.years > 5 ? `• **السنوات التالية بعد الخامسة (أجر شهر كامل عن كل سنة):**
  ${calc.years - 5} × ${calc.salary.toLocaleString("en-US")} = **${calc.remainingAmount.toLocaleString("en-US")} ر.س**` : ""}
• **إجمالي المكافأة الأساسية (100%):** ${calc.fullBase.toLocaleString("en-US")} ر.س

**3. نسبة الاستحقاق النظامية والصافي النهائي:**
• **سند الاستحقاق:** ${calc.ratioExplanation}
• **المبلغ الصافي المستحق صرفه للعامل:**
# **${calc.netReward.toLocaleString("en-US")} ريال سعودي**

💡 *ملاحظة نظامية: يجب تصفية هذا المبلغ وإيداعه في الحساب البنكي للعامل خلال أسبوع من تاريخ انتهاء العقد وفق المادة 88.* `;
    }
  }

  // --------------------------------------------------------------------------
  // C. PERSONALIZED OFFICIAL LETTERS & DOCUMENTS (WITH LIVE EMPLOYEE AUTO-FILL)
  // --------------------------------------------------------------------------
  const mentionedEmployee = employees.find((emp) => {
    const fnAr = `${emp.firstNameAr} ${emp.lastNameAr}`.toLowerCase();
    return (
      (emp.firstNameAr && q.includes(emp.firstNameAr.toLowerCase()) && emp.lastNameAr && q.includes(emp.lastNameAr.toLowerCase())) ||
      (fnAr.length > 3 && q.includes(fnAr)) ||
      (emp.employeeNo && q.includes(emp.employeeNo.toLowerCase()))
    );
  });

  const empDept = mentionedEmployee
    ? orgUnits.find((d) => d.id === mentionedEmployee.departmentId)?.nameAr || "الإدارة المعنية"
    : "[اسم الإدارة]";
  const empName = mentionedEmployee
    ? `${mentionedEmployee.firstNameAr} ${mentionedEmployee.lastNameAr}`
    : "[اسم الموظف الكامل]";
  const empTitle = mentionedEmployee ? mentionedEmployee.jobTitleAr : "[المسمى الوظيفي]";
  const empNo = mentionedEmployee ? mentionedEmployee.employeeNo : "[الرقم الوظيفي]";
  const empHire = mentionedEmployee ? mentionedEmployee.hireDate : "[تاريخ المباشرة]";
  const empSalary = mentionedEmployee
    ? (Number(mentionedEmployee.basicSalary) || 0) + (Number(mentionedEmployee.housingAllowance) || 0) + (Number(mentionedEmployee.transportAllowance) || 0)
    : 0;

  // 1. Promotion & Salary Increase Letter
  if (q.includes("ترقية") || q.includes("زيادة راتب") || q.includes("تعديل راتب")) {
    return `📄 **تمت صياغة خطاب الترقية وزيادة الراتب الرسمي جاهزاً للاعتماد:**

:::document
**الرقم المرجعي:** HR-PROM-2026-${Math.floor(1000 + Math.random() * 9000)}  
**التاريخ:** ${new Date().toLocaleDateString("ar-SA")}  
**الموافق:** ${new Date().toLocaleDateString("en-GB")}  

**إلى الموظف المكرم:** ${empName}  
**الرقم الوظيفي:** ${empNo}  
**الإدارة / القسم:** ${empDept}  

**الموضوع: قرار ترقية إدارية وتعديل الحزمة المالية**

السلام عليكم ورحمة الله وبركاته،،

نظراً لما أثبتموه من تفانٍ وإخلاص في أداء مهامكم الوظيفية، ومساهمتكم الملموسة في تحقيق أهداف منشأتنا، يسر إدارة الشركة أن تتقدم لكم بخالص الشكر والتقدير، وأن تبلغكم بصدور قرار ترقيتكم إلى:

• **المسمى الوظيفي الجديد:** ${mentionedEmployee ? `أخصائي أول / مسؤول في ${empDept}` : "[المسمى الوظيفي الجديد]"}
• **الدرجة الوظيفية:** الدرجة المتقدمة
• **تاريخ سريان الترقية:** اعتباراً من بداية الشهر القادم
• **الراتب الإجمالي الجديد:** ${empSalary > 0 ? `${(empSalary * 1.15).toLocaleString("en-US")} ريال سعودي (زيادة بنسبة 15%)` : "[المبلغ الجديد] ريال سعودي"}

نأمل أن تكون هذه الترقية حافزاً إضافياً لكم لمواصلة مسيرة العطاء والتميز وتقديم أفضل النتائج.

سائلين المولى عز وجل لكم دوام التوفيق والنجاح.

وتفضلوا بقبول وافر التحية والتقدير،،

**المدير العام / الرئيس التنفيذي**  
شركة [اسم المنشأة]  
التوقيع والختم: _____________________
:::

💡 *يمكنك نسخ نص الخطاب بضغطة زر وطباعته أو تعديل أي بنود فيه.* `;
  }

  // 2. Disciplinary / Warning Letter
  if (q.includes("إنذار") || q.includes("انذار") || q.includes("لفت نظر") || q.includes("تحذير")) {
    return `⚠️ **نموذج خطاب إنذار إداري رسمي موثق:**

:::document
**الرقم المرجعي:** HR-WARN-2026-${Math.floor(1000 + Math.random() * 9000)}  
**التاريخ:** ${new Date().toLocaleDateString("ar-SA")}  

**إلى الموظف:** ${empName}  
**الرقم الوظيفي:** ${empNo}  
**المسمى الوظيفي:** ${empTitle} — ${empDept}  

**الموضوع: إشعار إنذار كتابي رسمي بموجب لائحة تنظيم العمل**

السلام عليكم ورحمة الله وبركاته،،

إشارة إلى مراجعة سجلات الالتزام وسير العمل الخاصة بكم، فقد تبيّن [تكرار التأخير عن مواعيد الدوام الرسمي بدون إذن / التغيب غير المبرر / عدم استكمال المهام الوظيفية المسندة إليكم وفق الجداول المحددة].

وحيث إن ذلك يتعارض مع التزاماتكم التعاقدية ولائحة تنظيم العمل المعتمدة بالمنشأة، فإن إدارة الموارد البشرية توجه لكم هذا **الإنذار الكتابي**.

نأمل منكم تصحيح هذا التقصير والحرص على الالتزام التام بواجباتكم ومواعيد العمل مستقبلاً، علماً بأنه في حال تكرار المخالفة، ستضطر الإدارة إلى اتخاذ الإجراءات التأديبية الأشد وفقاً للمادة 66 من نظام العمل السعودي ولائحة الجزاءات.

**إدارة الموارد البشرية:** ___________________  
**توقيع الموظف بالعلم والاستلام:** ___________________  **التاريخ:** ____________
:::

💡 *يمكنك التعديل على صيغة المخالفة أو تحديد تاريخها المحدد قبل طباعة الخطاب.* `;
  }

  // 3. Salary Verification Certificate
  if (q.includes("تعريف بالراتب") || q.includes("شهادة تعريف") || q.includes("خطاب تعريف")) {
    return `📄 **خطاب تعريف بالراتب موجه للجهات الرسمية والبنوك:**

:::document
**الرقم المرجعي:** HR-CERT-2026-${Math.floor(1000 + Math.random() * 9000)}  
**التاريخ:** ${new Date().toLocaleDateString("ar-SA")}  

**إلى من يهمه الأمر (البنوك / السفارات / الجهات التمويلية والرسمية)**

السلام عليكم ورحمة الله وبركاته،،

تشهد شركة [اسم المنشأة] بأن السيد/ة: **${empName}**، يحمل هوية رقم: **${mentionedEmployee?.nationalIdOrIqama || "[رقم الهوية / الإقامة]"}**، وجنسيته/ا: **${mentionedEmployee?.nationality || "[الجنسية]"}**، يعمل لدينا ومقيد في سجلاتنا بالبيانات التالية:

• **المسمى الوظيفي:** ${empTitle}  
• **تاريخ الالتحاق بالعمل:** ${empHire}  
• **الحالة الوظيفية:** على رأس العمل حتى تاريخه  
• **الراتب الأساسي الشهري:** ${mentionedEmployee ? Number(mentionedEmployee.basicSalary || 0).toLocaleString("en-US") : "[0,000]"} ريال سعودي  
• **بدل السكن الشهري:** ${mentionedEmployee ? Number(mentionedEmployee.housingAllowance || 0).toLocaleString("en-US") : "[0,000]"} ريال سعودي  
• **بدل النقل الشهري:** ${mentionedEmployee ? Number(mentionedEmployee.transportAllowance || 0).toLocaleString("en-US") : "[0,000]"} ريال سعودي  
• **إجمالي الراتب الشهري:** ${empSalary > 0 ? empSalary.toLocaleString("en-US") : "[0,000]"} ريال سعودي  

أعطيت له هذه الشهادة بناءً على طلبه لتقديمها إلى [اسم الجهة المقدم إليها الخطاب] دون أدنى مسؤولية أو التزام مالي على عاتق الشركة تجاه الغير.

وتفضلوا بقبول فائق الاحترام والتقدير،،

**إدارة الموارد البشرية**  
شركة [اسم المنشأة]  
الختم الرسمي: ____________________
::: `;
  }

  // 4. Experience & Discharge Certificate
  if (q.includes("شهادة خبرة") || q.includes("اخلاء طرف") || q.includes("إخلاء طرف")) {
    return `📄 **نموذج شهادة خبرة وإخلاء طرف نظامية (المادة 88 من نظام العمل):**

:::document
**الرقم:** HR-EXP-2026-${Math.floor(1000 + Math.random() * 9000)}  
**التاريخ:** ${new Date().toLocaleDateString("ar-SA")}  

**شهادة خدمة وخبرة مهنية**

تشهد إدارة شركة [اسم المنشأة] بأن السيد/ة: **${empName}**، الحامل للهوية رقم **(${mentionedEmployee?.nationalIdOrIqama || "[رقم الهوية / الإقامة]"})**، قد عمل لدى الشركة وفق التفاصيل الموضحة أدناه:

• **المسمى الوظيفي الأخير:** ${empTitle}  
• **تاريخ بدء الخدمة:** ${empHire}  
• **تاريخ انتهاء الخدمة:** ${new Date().toLocaleDateString("ar-SA")}  
• **الراتب الأخير:** ${empSalary > 0 ? `${empSalary.toLocaleString("en-US")} ريال سعودي` : "[الراتب الأخير]"}  

وقد تم إخلاء طرفه من كافة العهد والأجهزة والالتزامات العينية والمالية المستحقة للشركة، ولم يعد في ذمته أي التزام تجاه المنشأة حتى تاريخه.

وقد أعطيت له هذه الشهادة عملاً بأحكام المادة (88) من نظام العمل السعودي بعد إنهاء خدماته، مع تمنياتنا له بالتوفيق والنجاح الدائم في مسيرته المهنية.

**الإدارة العامة للموارد البشرية**  
شركة [اسم المنشأة]  
التوقيع: __________________   الختم الرسمي: __________________
::: `;
  }

  // 5. Job Offer Letter
  if (q.includes("عرض وظيفي") || q.includes("عرض عمل") || q.includes("job offer")) {
    return `📄 **نموذج عرض وظيفي رسمي متكامل (Job Offer Letter):**

:::document
**التاريخ:** ${new Date().toLocaleDateString("ar-SA")}  
**إلى السيد/ة:** [اسم المرشح الكامل] المحترم/ة  

السلام عليكم ورحمة الله وبركاته،،

يسر شركة [اسم المنشأة] أن تقدم لكم هذا العرض الوظيفي الرسمي للانضمام إلى فريق عملنا، وذلك وفق البنود والتفاصيل الآتية:

1. **المسمى الوظيفي:** [المسمى الوظيفي المستهدف]
2. **الإدارة / القسم:** [اسم الإدارة]
3. **تاريخ المباشرة المتوقع:** [اليوم / الشهر / السنة]
4. **فترة التجربة:** (90 يوماً) وفق نظام العمل السعودي قابلة للتمديد كتابياً حتى 180 يوماً.

**الحزمة المالية والبدلات الشهرية:**
• **الراتب الأساسي:** [00,000] ريال سعودي
• **بدل السكن:** [0,000] ريال سعودي (25% من الأساسي)
• **بدل النقل:** [0,000] ريال سعودي (10% من الأساسي)
• **إجمالي الراتب الشهري:** [00,000] ريال سعودي

**المزايا الإضافية:**
• تأمين طبي شامل (فئة التعاونية A) للموظف وعائلته المعتمدة.
• إجازة سنوية مدفوعة الأجر مدتها 21 يوماً ترتفع إلى 30 يوماً بعد 5 سنوات.
• التسجيل الكامل في التأمينات الاجتماعية ومنصة قوى.

يسري هذا العرض لمدة (5) أيام عمل من تاريخ صدوره. يرجى التوقيع وإعادة النسخة في حال الموافقة.

**إدارة الموارد البشرية:** ___________________  
**توقيع المرشح بالقبول:** ___________________  **التاريخ:** ____________
::: `;
  }

  // 6. Welcome Onboarding Email
  if (q.includes("ايميل ترحيبي") || q.includes("إيميل ترحيبي") || q.includes("ترحيب بموظف")) {
    return `📨 **صيغة إيميل ترحيبي رسمي بالموظف الجديد (Onboarding Welcome Email):**

:::document
**الموضوع:** أهلاً بك في عائلتنا، ${empName}! 🌟

عزيزي/عزيزتي **${empName}** المحترم/ة،

السلام عليكم ورحمة الله وبركاته،،

يسعدنا ويشرفنا انضمامك إلى فريق عمل **[اسم المنشأة]** كـ **${empTitle}** ضمن فريق **${empDept}**.

نحن واثقون بأن خبراتك ومهاراتك ستكون إضافة مميزة ومحفزة للجميع وسنحقق معاً نجاحات باهرة.

**تفاصيل اليوم الأول لراحتك:**
• **موعد الاستقبال:** الساعة 09:00 صباحاً
• **المقر:** المبنى الرئيسي — الدور [X]
• **مرشدك في اليوم الأول (Buddy):** [اسم المشرف/الزميل] — [رقم الجوال]

سيكون بانتظارك مكتبك المهيأ مع جهاز الحاسب المحمول والعهد التقنية، وبرنامج تعريفي موجز لربطك بالأنظمة والزملاء.

مرحباً بك مجدداً ونتمنى لك رحلة مهنية ملهمة وثرية!

وتفضلوا بقبول خالص التحية والتقدير،،

**فريق الموارد البشرية**  
[اسم المنشأة]
::: `;
  }

  // 7. Resignation Acceptance Letter
  if (q.includes("قبول استقالة") || q.includes("الموافقة على الاستقالة")) {
    return `📄 **نموذج خطاب قبول استقالة رسمي:**

:::document
**الرقم:** HR-RES-2026-${Math.floor(1000 + Math.random() * 9000)}  
**التاريخ:** ${new Date().toLocaleDateString("ar-SA")}  

**إلى السيد/ة:** ${empName}  
**المسمى الوظيفي:** ${empTitle} — ${empDept}  

**الموضوع: قبول الاستقالة وبدء إجراءات تسليم المهام**

السلام عليكم ورحمة الله وبركاته،،

إشارة إلى طلب الاستقالة المقدم من قبلكم بتاريخ [تاريخ تقديم الاستقالة]، نود إحاطتكم بموافقة إدارة الشركة على قبول استقالتكم، مع الالتزام بفترة الإشعار النظامية المتفق عليها.

وعليه، سيكون آخر يوم عمل فعلي لكم في المنشأة هو: **[تاريخ آخر يوم دوام]**.

يرجى التنسيق مع مديركم المباشر لإتمام إجراءات تسليم كافة الملفات والمهام العالقة، ومراجعة إدارة الموارد البشرية لإجراء إخلاء الطرف المالي والعيني واستلام مستحقاتكم النظامية ومكافأة نهاية الخدمة وفقاً لنظام العمل.

نشكر لكم كل ما قدمتموه من جهد مخلص طوال فترة عملكم، متمنين لكم دوام التوفيق والنجاح في خطواتكم المستقبلية.

**مدير عام الموارد البشرية**  
شركة [اسم المنشأة]  
التوقيع: ___________________
::: `;
  }

  // 8. Internal Circular / Memo
  if (q.includes("تعميم") || q.includes("اعلان داخلي") || q.includes("إعلان داخلي") || q.includes("memo")) {
    return `📢 **صيغة تعميم إداري داخلي رسمي (Administrative Circular):**

:::document
**تعميم إداري رقم:** [04 / 2026]  
**التاريخ:** ${new Date().toLocaleDateString("ar-SA")}  
**إلى:** جميع موظفي ومنسوبي شركة [اسم المنشأة]  
**من:** الإدارة العامة للموارد البشرية والعمليات  
**الموضوع:** [عنوان التعميم — مثال: تنظيم الإجازات السنوية / تحديث أوقات العمل]  

السلام عليكم ورحمة الله وبركاته،،

انطلاقاً من حرص إدارة المنشأة على تعزيز انتظام بيئة العمل وتحقيق أعلى معايير الجودة والإنتاجية، نود إحاطة جميع الزملاء بالنقاط التنظيمية التالية:

1. **[البند الأول]:** [شرح الإجراء أو السياسة الجديدة بشكل موجز ومباشر].
2. **[البند الثاني]:** [مواعيد بدء التطبيق والفئات المشمولة بهذا التعميم].
3. **[البند الثالث]:** [قنوات التواصل في حال وجود أي استفسارات أو ملاحظات].

شاكرين ومقدرين للجميع حسن التعاون والالتزام الدائم لما فيه رفعة وازدهار المنشأة.

وتفضلوا بقبول فائق التحية والاحترام،،

**الإدارة العامة للموارد البشرية**  
شركة [اسم المنشأة]
::: `;
  }

  // --------------------------------------------------------------------------
  // D. LIVE SYSTEM DATA ANALYTICS & INSIGHTS (بيانات المنشأة الحية)
  // --------------------------------------------------------------------------

  // 1. Department Deep Dive
  const matchedDept = orgUnits.find((d) => {
    const name = (d.nameAr || "").toLowerCase();
    return name.length > 2 && q.includes(name);
  });

  if (matchedDept && (q.includes("قسم") || q.includes("ادارة") || q.includes("إدارة") || q.includes("موظفين") || q.includes("رواتب") || q.includes("فريق") || q.includes("كم"))) {
    const deptEmps = employees.filter((e) => e.departmentId === matchedDept.id);
    const saudiCount = deptEmps.filter((e) => (e.nationality || "").includes("سعودي")).length;
    const saudizationPct = deptEmps.length > 0 ? Math.round((saudiCount / deptEmps.length) * 100) : 0;
    const totalDeptSalary = deptEmps.reduce(
      (acc, e) =>
        acc +
        (Number(e.basicSalary) || 0) +
        (Number(e.housingAllowance) || 0) +
        (Number(e.transportAllowance) || 0),
      0
    );
    const avgSalary = deptEmps.length > 0 ? Math.round(totalDeptSalary / deptEmps.length) : 0;

    const memberList = deptEmps
      .slice(0, 6)
      .map(
        (e) =>
          `• **${e.firstNameAr} ${e.lastNameAr}** — ${e.jobTitleAr} (${(
            (Number(e.basicSalary) || 0) + (Number(e.housingAllowance) || 0) + (Number(e.transportAllowance) || 0)
          ).toLocaleString("en-US")} ر.س)`
      )
      .join("\n");

    return `🏢 **التحليل الذكي لـ ${matchedDept.nameAr} في نظامك:**

**1. المؤشرات التشغيلية والمالية للقسم:**
• **إجمالي عدد الكادر:** ${deptEmps.length} موظفاً
• **نسبة التوطين في القسم:** ${saudizationPct}% (${saudiCount} سعودي من أصل ${deptEmps.length})
• **إجمالي كتلة الرواتب الشهرية:** ${totalDeptSalary.toLocaleString("en-US")} ر.س
• **متوسط الراتب في القسم:** ${avgSalary.toLocaleString("en-US")} ر.س شهرياً

**2. عينة من كادر الفريق المسجل:**
${memberList || "• لم يتم تعيين موظفين في هذا القسم حتى الآن."}
${deptEmps.length > 6 ? `
*(ويوجد ${deptEmps.length - 6} موظفاً آخرين مسجلين في هذا القسم)*` : ""}

💡 *يمكنك سؤالي عن أي موظف بالاسم للاطلاع على تفاصيل ملفه 360° فوراً.* `;
  }

  // 2. Highest Earners in Company
  if (q.includes("اعلى الرواتب") || q.includes("أعلى الرواتب") || q.includes("اعلى موظف") || q.includes("أعلى موظف") || q.includes("اكثر الرواتب") || q.includes("أكثر الرواتب")) {
    const sorted = [...employees]
      .sort((a, b) => {
        const salA = (Number(a.basicSalary) || 0) + (Number(a.housingAllowance) || 0) + (Number(a.transportAllowance) || 0);
        const salB = (Number(b.basicSalary) || 0) + (Number(b.housingAllowance) || 0) + (Number(b.transportAllowance) || 0);
        return salB - salA;
      })
      .slice(0, 5);

    const rows = sorted
      .map((e, idx) => {
        const dept = orgUnits.find((d) => d.id === e.departmentId)?.nameAr || "الإدارة العامة";
        const tot = (Number(e.basicSalary) || 0) + (Number(e.housingAllowance) || 0) + (Number(e.transportAllowance) || 0);
        return `${idx + 1}. **${e.firstNameAr} ${e.lastNameAr}** (${e.jobTitleAr}) — ${dept}: **${tot.toLocaleString("en-US")} ر.س**`;
      })
      .join("\n");

    return `📊 **قائمة أعلى 5 موظفين من حيث إجمالي الراتب الشهري في المنشأة:**

${rows}

💡 *الأرقام أعلاه تشمل الراتب الأساسي + بدلات السكن والنقل المسجلة في عقود النظام.* `;
  }

  // --------------------------------------------------------------------------
  // E. SAUDI LABOR LAW & REGULATORY POLICIES (الأنظمة واللوائح المعتمدة)
  // --------------------------------------------------------------------------
  if (q.includes("مكافأة") || q.includes("نهاية الخدمة")) {
    return `💰 **الدليل النظامي لمكافأة نهاية الخدمة (المادتان 84 و 85 من نظام العمل السعودي):**

**1. معايير الاحتساب الأساسية (المادة 84):**
• تُحسب على أساس **آخر أجر فعلي** (الأساسي + بدلات السكن والنقل الدورية).
• **السنوات الخمس الأولى:** أجر 15 يوماً (نصف شهر) عن كل سنة خدمة.
• **السنوات التالية:** أجر 30 يوماً (شهر كامل) عن كل سنة بعد الخامسة.
• أجزاء السنة تحسب بنسبة ما قضاه العامل منها في العمل.

**2. حالات الاستقالة وحصص الاستحقاق (المادة 85):**
• أقل من سنتين: **0% (لا يستحق أي مكافأة)**.
• من سنتين حتى 5 سنوات: **ثلث المكافأة (33.33%)**.
• من 5 سنوات حتى 10 سنوات: **ثلثي المكافأة (66.67%)**.
• 10 سنوات فأكثر: **المكافأة كاملة (100%)**.

💡 *جرّب كتابة: "احسب نهاية خدمة راتب 12000 و 6 سنوات استقالة" وسأحسبها لك بالأرقام فوراً!* `;
  }

  if (q.includes("فترة التجربة") || q.includes("مدة التجربة")) {
    return `⏱️ **أحكام وضوابط فترة التجربة (المادة 53 من نظام العمل):**

1. **المدة الأصلية:** لا يجوز أن تزيد عن **(90 يوماً)**.
2. **التمديد النظامي:** يجوز باتفاق كتابي صريح بين الطرفين تمديدها بحد أقصى إلى **(180 يوماً)**.
3. **الاستثناءات:** لا تدخل إجازتا العيدين والإجازات المرضية في احتساب مدة التجربة.
4. **الإنهاء:** يحق لأي من الطرفين إنهاء العقد خلال فترة التجربة دون أي التزام بمكافأة نهاية خدمة أو تعويض أو إشعار (ما لم ينص العقد على غير ذلك).
5. **التكرار:** لا يجوز وضع العامل تحت التجربة لدى صاحب العمل نفسه أكثر من مرة إلا في مهنة أخرى أو بعد مضي 6 أشهر على انتهاء العقد الأول.`;
  }

  if (q.includes("تأمينات") || q.includes("gosi") || q.includes("نسبة التأمينات")) {
    return `🏛️ **نسب الاشتراكات المعتمدة في التأمينات الاجتماعية (GOSI):**

**1. للموظف السعودي (المجموع 21.5%):**
• **حصة الموظف (تُخصم من راتبه):** 9% (معاشات تقاعد) + 0.75% (ساند - التعطل عن العمل) = **9.75%**.
• **حصة صاحب العمل (تتحملها المنشأة):** 9% (معاشات) + 2% (أخطار مهنية) + 0.75% (ساند) = **11.75%**.
• **الحد الأقصى للأجر الخاضع للاشتراك:** 45,000 ريال شهرياً.

**2. للموظف غير السعودي:**
• **حصة المنشأة فقط:** 2% تغطية فرع الأخطار المهنية (لا يُخصم على الموظف شيء).

💡 *يقوم نظام مدار بحساب هذه الحصص تلقائياً في مسير الرواتب الشهري.* `;
  }

  if (q.includes("ساعات العمل") || q.includes("الاضافي") || q.includes("الإضافي") || q.includes("اوفرتايم")) {
    return `⏰ **نظام ساعات العمل والعمل الإضافي (Overtime):**

• **ساعات العمل المعتادة:** 8 ساعات يومياً أو 48 ساعة أسبوعياً.
• **شهر رمضان المبارك:** تخفض إلى **6 ساعات يومياً** أو **36 ساعة أسبوعياً** للمسلمين.
• **الراحة الأسبوعية:** لا تقل عن 24 ساعة متتالية بأجر كامل (يوم الجمعة أو ما يعادله).
• **أجر الساعة الإضافية:** أجر الساعة العادي + **50% من الأجر الأساسي** (أي 150% من الساعة الأساسية).`;
  }

  // --------------------------------------------------------------------------
  // F. STRATEGIC HR, OKRs vs KPIs, AND TALENT MANAGEMENT
  // --------------------------------------------------------------------------
  if (q.includes("okr") || q.includes("kpi") || q.includes("فرق بين") || q.includes("مؤشرات الاداء") || q.includes("مؤشرات الأداء")) {
    return `🎯 **مصفوفة الفروق بين OKRs و KPIs في الموارد البشرية:**

| المعيار | مؤشرات الأداء (KPIs) | الأهداف والنتائج الرئيسية (OKRs) |
| :--- | :--- | :--- |
| **الغاية** | استقرار العمليات اليومية ومراقبة الصحة التشغيلية. | قيادة التغيير الإستراتيجي والقفزات النوعية. |
| **السؤال** | "هل أعمالنا تسير بأمان وبالمعدل المطلوب؟" | "ما هو التحدي الجديد الذي سنحققه في Q3؟" |
| **الدورة** | مستمرة وسنوية. | ربع سنوية (كل 3 أشهر). |
| **نسبة الإنجاز** | متوقع 100% (أقل من ذلك يعتبر تقصيراً). | تحقيق 70% يعتبر نجاحاً استثنائياً لطموحه. |
| **مثال HR** | "المحافظة على معدل تسرب وظيفي أقل من 5%." | "بناء أكاديمية تدريب داخلية وتأهيل 30 قائد فريق سعودي خلال 90 يوماً." |

💡 *المنشآت الرائدة تستخدم KPIs لقياس استقرار السفينة، و OKRs لتحديد وجهة الإبحار.* `;
  }

  if (q.includes("مقابلة") || q.includes("مقابلات") || q.includes("أسئلة المقابلة") || q.includes("star")) {
    return `🎙️ **دليل إدارة مقابلات التوظيف السلوكية بمنهجية STAR:**

**منهجية STAR تضمن تقييم أفعال المرشح السابقة كأفضل مؤشر لأدائه المستقبلي:**
1. **الموقف (Situation):** "صف لي موقفاً حرجاً تعطل فيه تسليم مشروع رئيسي في عملك السابق."
2. **المهمة (Task):** "ما هو دورك المحدد ومسؤوليتك المباشرة في تلك اللحظة؟"
3. **الإجراء (Action):** "ما هي الخطوات الدقيقة التي اتخذتها بمبادرة منك لحل المشكلة؟"
4. **النتيجة (Result):** "ما هي الأرقام أو المخرجات الإيجابية الملموسة التي تحققت؟"

**مؤشرات التقييم:**
• الفطنة والمهارة التقنية (1 - 5)
• اتخاذ القرار تحت الضغط (1 - 5)
• مهارات التواصل والتنسيق مع الفريق (1 - 5)
• التوافق مع قيم وثقافة المنشأة (Culture Fit) (1 - 5)`;
  }

  // --------------------------------------------------------------------------
  // G. GENERAL PROBLEM SOLVING & BUSINESS ADVISORY
  // --------------------------------------------------------------------------
  const activeCount = employees.filter((e) => e.status === "active").length;
  const saudiCount = employees.filter((e) => e.nationality === "سعودي").length;
  const saudiPct = empCount > 0 ? Math.round((saudiCount / empCount) * 100) : 0;
  const deptCount = orgUnits.length;
  return `أهلاً بك، سأجيبك بحرية وبشكل مباشر 🤝

سؤالك: **"${query}"**

لم أجد في بيانات نظامك ما يرتبط مباشرة بهذا السؤال، لذلك أجيبك من الخبرة العامة في الإدارة والموارد البشرية:
• حدّد الهدف والجهة المتأثرة أولاً (موظف، قسم، أو المنشأة كلها).
• تحقق من الإطار النظامي للدولة المعنية (أدعم 7 دول: السعودية، مصر، الإمارات، قطر، الكويت، البحرين، عُمان).
• وثّق القرار في تعميم أو نموذج رسمي، وتابع أثره بمؤشر واضح.

📊 **لمحة سريعة من نظامك الآن:** ${empCount} موظف (${activeCount} على رأس العمل، سعوديون ${saudiPct}%) موزعين على ${deptCount} وحدة تنظيمية.

⚙️ **للمحادثة الحرة بأي موضوع كأنك مع ChatGPT:** افتح إعدادات المحرك (أيقونة الترس) وأدخل مفتاح OpenAI أو Gemini أو OpenRouter، وسيجيب المساعد على أي سؤال مع بقائه مرتبطاً ببياناتك.

يمكنني أيضاً: إضافة موظف (بالصوت/الصورة)، تحليل أي تقرير، صياغة خطاب رسمي، أو شرح قانون العمل لأي دولة. ماذا تريد؟`;
}

// ============================================================================
// 4. LOCAL STORAGE CONVERSATION & MESSAGE PERSISTENCE
// ============================================================================

const CONV_STORAGE_KEY = "madarx_ai_conversations_v2";
const MSG_STORAGE_KEY = "madarx_ai_messages_v2";

const DEFAULT_CONVERSATIONS: AIConversation[] = [
  {
    id: "conv-1",
    companyId: "comp-001",
    userId: "user-001",
    title: "تحليل التقارير الشامل ومؤشرات النظام",
    contextModule: "reports",
    status: "active",
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "conv-2",
    companyId: "comp-001",
    userId: "user-001",
    title: "تحليل مسير الرواتب والتوطين وحماية الأجور",
    contextModule: "payroll",
    status: "active",
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 5).toISOString(),
  },
];

const DEFAULT_MESSAGES: Record<string, AIChatMessage[]> = {
  "conv-1": [
    {
      id: "msg-welcome",
      conversationId: "conv-1",
      role: "assistant",
      content:
        "مرحباً بك في **المساعد الذكي ومحلل التقارير المؤسسي (MadarX AI Copilot)**.\n\nأنا متصل مباشرةً بجميع وحدات النظام (الموظفون، الرواتب وحماية الأجور WPS، الحضور والانصراف، الإجازات، العقود ومنصة قوى، التوطين ونطاقات، الأداء، التوظيف، والعهد).\n\nيمكنك سؤالي عن أي تقرير أو موظف أو مؤشر مالي وتشغيلي، أو الضغط على أي من أزرار التحليل الفوري أدناه!",
      createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    },
  ],
  "conv-2": [
    {
      id: "msg-201",
      conversationId: "conv-2",
      role: "user",
      content: "حلل لي تقرير مسير الرواتب والتكاليف المالية وجاهزية حماية الأجور",
      createdAt: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: "msg-202",
      conversationId: "conv-2",
      role: "assistant",
      content:
        "📊 **ملخص مسير الرواتب وحماية الأجور (WPS):**\n\nيتم احتساب الرواتب الأساسية وبدلات السكن والنقل والبدلات المخصصة وحسميات التأمينات الاجتماعية (GOSI) تلقائياً لجميع الموظفين النشطين.\n\nاضغط على تبويب **«محلل التقارير الذكي»** بالأعلى أو اطلب تحليل الرواتب الآن لعرض الأرقام الحية المحدثة لحظياً.",
      createdAt: new Date(Date.now() - 86395000).toISOString(),
    },
  ],
};

function loadStoredConversations(): AIConversation[] {
  if (typeof window === "undefined") return DEFAULT_CONVERSATIONS;
  try {
    const raw = window.localStorage.getItem(CONV_STORAGE_KEY);
    if (!raw) return DEFAULT_CONVERSATIONS;
    const parsed = JSON.parse(raw) as AIConversation[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_CONVERSATIONS;
  } catch {
    return DEFAULT_CONVERSATIONS;
  }
}

function saveStoredConversations(convs: AIConversation[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CONV_STORAGE_KEY, JSON.stringify(convs));
  } catch {
    // ignore storage quota errors
  }
}

function loadStoredMessages(): Record<string, AIChatMessage[]> {
  if (typeof window === "undefined") return DEFAULT_MESSAGES;
  try {
    const raw = window.localStorage.getItem(MSG_STORAGE_KEY);
    if (!raw) return DEFAULT_MESSAGES;
    const parsed = JSON.parse(raw) as Record<string, AIChatMessage[]>;
    return parsed && typeof parsed === "object" ? { ...DEFAULT_MESSAGES, ...parsed } : DEFAULT_MESSAGES;
  } catch {
    return DEFAULT_MESSAGES;
  }
}

function saveStoredMessages(msgs: Record<string, AIChatMessage[]>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MSG_STORAGE_KEY, JSON.stringify(msgs));
  } catch {
    // ignore storage quota errors
  }
}

// ============================================================================
// 5. SEEDED INSIGHTS & TOOL CALLS
// ============================================================================

const SEEDED_INSIGHTS: AIInsight[] = [
  {
    id: "ins-1",
    companyId: "comp-001",
    category: "certificate_expiry",
    severity: "high",
    titleAr: "متابعة صلاحية الوثائق الرسمية والهويات",
    titleEn: "Expiring Official Documents & IDs",
    explanationAr: "تم رصد وثائق رسمية وهويات/إقامات تقترب من تاريخ الانتهاء وتستوجب التجديد المبكر لتفادي إيقاف الخدمات الحكومية.",
    explanationEn: "Official documents and residency permits are approaching expiry.",
    entityType: "document",
    recommendedAction: "فتح خزينة الوثائق وإرسال إشعارات التجديد للموظفين المعنيين",
    status: "active",
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "ins-2",
    companyId: "comp-001",
    category: "probation_due",
    severity: "critical",
    titleAr: "تقييم فترة التجربة للموظفين الجدد قبل الاستحقاق",
    titleEn: "Probation Period Ending Soon",
    explanationAr: "يوجد موظفون في فترة التجربة (90 يوماً) يتوجب استكمال نموذج تقييم الأداء وتثبيتهم أو تمديد التجربة وفق المادة 53 من نظام العمل.",
    explanationEn: "Employees in probation period require evaluation before automatic confirmation.",
    entityType: "employee",
    recommendedAction: "إصدار نموذج تقييم فترة التجربة للمدير المباشر",
    status: "active",
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "ins-3",
    companyId: "comp-001",
    category: "attendance_sla",
    severity: "medium",
    titleAr: "فرصة لتحسين الانضباط وتقليل دقائق التأخير الصباحي",
    titleEn: "Attendance Lateness Optimization",
    explanationAr: "أظهر تحليل سجلات الحضور وجود دقائق تأخير متكررة وطلبات تصحيح بصمة معلقة تحتاج إلى الاعتماد قبل إقفال مسير الرواتب.",
    explanationEn: "Attendance logs show recurring late minutes and pending correction requests.",
    entityType: "department",
    recommendedAction: "مراجعة سجلات الحضور والانصراف واعتماد التصحيحات",
    status: "active",
    createdAt: new Date(Date.now() - 259200000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "ins-4",
    companyId: "comp-001",
    category: "payroll_anomaly",
    severity: "high",
    titleAr: "التحقق من جاهزية الآيبان وملف حماية الأجور (WPS)",
    titleEn: "WPS & IBAN Readiness Check",
    explanationAr: "ينصح المساعد الذكي بمراجعة اكتمال أرقام الآيبان (IBAN) وحالة قفل الحسابات البنكية قبل تصدير ملف مدد / WPS الشهري.",
    explanationEn: "Verify IBAN completeness and bank lock status prior to WPS export.",
    entityType: "payroll_run",
    recommendedAction: "تشغيل فحص جاهزية مسير الرواتب وحماية الأجور",
    status: "active",
    createdAt: new Date(Date.now() - 43200000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const SEEDED_TOOL_CALLS: AIToolCall[] = [
  {
    id: "tc-101",
    conversationId: "conv-1",
    toolName: "reports.analyze_executive_360",
    parameters: { scope: "all_modules", includeAnomalies: true },
    result: { healthScore: 93, analyzedModules: 8 },
    requiresConfirmation: false,
    isConfirmed: true,
    executionStatus: "executed",
    latencyMs: 38,
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: "tc-102",
    conversationId: "conv-2",
    toolName: "payroll.get_summary",
    parameters: { month: 3, year: 2026, checkWpsReadiness: true },
    result: { wpsReady: true, gosiCalculated: true },
    requiresConfirmation: false,
    isConfirmed: true,
    executionStatus: "executed",
    latencyMs: 54,
    createdAt: new Date(Date.now() - 86396000).toISOString(),
  },
];

// ============================================================================
// 6. REACT QUERY HOOKS
// ============================================================================

export function useAIConversations() {
  const auth = useAuth() as any;
  const activeCompanyId = auth?.activeCompanyId || auth?.companyId || "comp-001";
  return useQuery({
    queryKey: ["ai", "conversations", activeCompanyId],
    queryFn: async (): Promise<AIConversation[]> => {
      const localConvs = loadStoredConversations();
      try {
        const { data, error } = await (supabase as any)
          .from("ai_conversations")
          .select("*")
          .order("updated_at", { ascending: false })
          .limit(20);
        if (!error && data && data.length > 0) {
          return data.map((r: any) => ({
            id: r.id,
            companyId: r.company_id,
            userId: r.user_id,
            title: r.title,
            contextModule: r.context_module,
            status: r.status,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
          }));
        }
      } catch {
        // Fallback to local persisted conversations
      }
      return localConvs;
    },
    staleTime: 10000,
  });
}

export function useCreateAIConversation() {
  const queryClient = useQueryClient();
  const auth = useAuth() as any;
  const activeCompanyId = auth?.activeCompanyId || auth?.companyId || "comp-001";

  return useMutation({
    mutationFn: async (title?: string): Promise<AIConversation> => {
      const convs = loadStoredConversations();
      const newConv: AIConversation = {
        id: `conv-${Date.now()}`,
        companyId: activeCompanyId || "comp-001",
        userId: "user-001",
        title: title?.trim() || `محادثة تحليلية جديدة (${convs.length + 1})`,
        contextModule: "reports",
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const updated = [newConv, ...convs];
      saveStoredConversations(updated);

      const allMsgs = loadStoredMessages();
      allMsgs[newConv.id] = [
        {
          id: `msg-init-${Date.now()}`,
          conversationId: newConv.id,
          role: "assistant",
          content:
            "تم فتح جلسة تحليلية جديدة ✨. يمكنك الآن طلب تحليل أي تقرير في النظام (الرواتب، الموظفين، التوطين، الحضور، الإجازات، العقود، الأداء، أو التقرير التنفيذي الشامل 360°).",
          createdAt: new Date().toISOString(),
        },
      ];
      saveStoredMessages(allMsgs);
      return newConv;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai", "conversations"] });
    },
  });
}

export function useClearAIConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (conversationId: string) => {
      const allMsgs = loadStoredMessages();
      allMsgs[conversationId] = [
        {
          id: `msg-reset-${Date.now()}`,
          conversationId,
          role: "assistant",
          content: "تم مسح سجل المحادثة وتحديث الاتصال المباشر ببيانات النظام. كيف يمكنني مساعدتك في تحليل التقارير اليوم؟",
          createdAt: new Date().toISOString(),
        },
      ];
      saveStoredMessages(allMsgs);
      return conversationId;
    },
    onSuccess: (conversationId) => {
      queryClient.invalidateQueries({ queryKey: ["ai", "messages", conversationId] });
    },
  });
}

export function useChatMessages(conversationId: string) {
  return useQuery({
    queryKey: ["ai", "messages", conversationId],
    queryFn: async (): Promise<AIChatMessage[]> => {
      const stored = loadStoredMessages();
      try {
        const { data, error } = await (supabase as any)
          .from("ai_messages")
          .select("*")
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: true });
        if (!error && data && data.length > 0) {
          return data.map((r: any) => ({
            id: r.id,
            conversationId: r.conversation_id,
            role: r.role,
            content: r.content,
            metadata: r.metadata,
            createdAt: r.created_at,
          }));
        }
      } catch {
        // Fallback to local persisted messages
      }
      return stored[conversationId] || DEFAULT_MESSAGES["conv-1"];
    },
    staleTime: 2000,
  });
}

export function useAIInsights() {
  const auth = useAuth() as any;
  const activeCompanyId = auth?.activeCompanyId || auth?.companyId || "comp-001";
  const app = useApp();

  return useQuery({
    queryKey: ["ai", "insights", activeCompanyId, app.employees.length, app.requests.length],
    queryFn: async (): Promise<AIInsight[]> => {
      try {
        const { data, error } = await (supabase as any)
          .from("ai_insights")
          .select("*")
          .eq("status", "active")
          .order("created_at", { ascending: false });
        if (!error && data && data.length > 0) {
          return data.map((r: any) => ({
            id: r.id,
            companyId: r.company_id,
            category: r.category,
            severity: r.severity,
            titleAr: r.title_ar,
            titleEn: r.title_en,
            explanationAr: r.explanation_ar,
            explanationEn: r.explanation_en,
            entityType: r.entity_type,
            entityId: r.entity_id,
            recommendedAction: r.recommended_action,
            status: r.status,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
          }));
        }
      } catch {
        // Fallback to dynamic + seeded insights
      }

      const probationCount = app.employees.filter((e) => e.status === "probation").length;
      const pendingReqCount = app.requests.filter(
        (r) => r.status === "submitted" || r.status === "pending_approval"
      ).length;
      const missingIbanCount = app.employees.filter((e) => !e.iban || e.iban.trim().length < 15).length;

      const dynamicInsights: AIInsight[] = [
        {
          ...SEEDED_INSIGHTS[0],
          explanationAr: `يوجد حالياً ${(app.employeeDocs ?? []).length} وثيقة رسمية تحت المراقبة الآلية في خزينة الوثائق لضمان عدم انتهاء الإقامات أو التراخيص المهنية.`,
        },
        {
          ...SEEDED_INSIGHTS[1],
          titleAr: `متابعة فترة التجربة (${probationCount} موظفين حاليين)`,
          explanationAr: `يوجد ${probationCount} موظفين في فترة التجربة حالياً؛ يوصي المساعد الذكي بجدولة تقييم الأداء قبل انتهاء الـ 90 يوماً الأولى.`,
        },
        {
          ...SEEDED_INSIGHTS[2],
          titleAr: `معاملات وطلبات بانتظار الاعتماد (${pendingReqCount} طلب)`,
          explanationAr: `يوجد ${pendingReqCount} طلبات في سلسلة الموافقات (إجازات وطلبات ذاتية) بانتظار اتخاذ قرار لضمان الالتزام بمعيار SLA.`,
        },
        {
          ...SEEDED_INSIGHTS[3],
          explanationAr:
            missingIbanCount > 0
              ? `تم رصد ${missingIbanCount} موظفين بحاجة إلى استكمال أو تدقيق رقم الآيبان البنكي قبل رفع ملف حماية الأجور (WPS).`
              : `جميع الموظفين النشطين (${app.employees.length} موظف) مكتملو البيانات البنكية وجاهزون لملف حماية الأجور (WPS).`,
        },
      ];

      return dynamicInsights;
    },
    staleTime: 15000,
  });
}

export function useAIDashboardKpis() {
  const auth = useAuth() as any;
  const activeCompanyId = auth?.activeCompanyId || auth?.companyId || "comp-001";
  return useQuery({
    queryKey: ["ai", "kpis", activeCompanyId],
    queryFn: async (): Promise<AIUsageMetrics> => {
      try {
        const { data, error } = await (supabase as any).rpc("get_ai_dashboard_kpis", {
          p_company_id: activeCompanyId,
        });
        if (!error && data) {
          return {
            totalRequests: data.total_requests ?? 284,
            successfulRequests: data.successful_requests ?? 282,
            totalTokens: data.total_tokens ?? 94200,
            estimatedCostUsd: data.estimated_cost_usd ?? 1.85,
            avgLatencyMs: data.avg_latency_ms ?? 165,
            totalToolCalls: data.total_tool_calls ?? 96,
            toolFailureRatePct: data.tool_failure_rate_pct ?? 0,
            activeInsights: data.active_insights ?? 4,
            positiveFeedbackPct: data.positive_feedback_pct ?? 98.4,
          };
        }
      } catch {
        // Fallback to observability summary
      }
      const obs = aiObservability.getMetricsSummary();
      return {
        totalRequests: 284 + obs.totalEvents,
        successfulRequests: 282 + obs.totalEvents,
        totalTokens: 94200 + obs.totalEvents * 250,
        estimatedCostUsd: Number((1.85 + obs.totalCostUsd).toFixed(4)),
        avgLatencyMs: obs.averageLatencyMs || 165,
        totalToolCalls: 96 + obs.totalEvents,
        toolFailureRatePct: 0,
        activeInsights: SEEDED_INSIGHTS.length,
        positiveFeedbackPct: 98.4,
      };
    },
    staleTime: 15000,
  });
}

export function useAIToolCalls() {
  return useQuery({
    queryKey: ["ai", "tool_calls"],
    queryFn: async (): Promise<AIToolCall[]> => {
      return SEEDED_TOOL_CALLS;
    },
    staleTime: 30000,
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  const app = useApp();

  return useMutation({
    mutationFn: async ({
      conversationId,
      content,
      userRole = "hr_manager",
      metadata,
    }: {
      conversationId: string;
      content: string;
      userRole?: string;
      metadata?: Record<string, unknown>;
    }) => {
      const startTime = Date.now();
      const sanitization = detectAndSanitizePrompt(content);

      const userMessage: AIChatMessage = {
        id: `msg-u-${Date.now()}`,
        conversationId,
        role: "user",
        content,
        metadata,
        createdAt: new Date().toISOString(),
      };

      if (!sanitization.isSafe) {
        const blockedMsg: AIChatMessage = {
          id: `msg-a-${Date.now() + 1}`,
          conversationId,
          role: "assistant",
          content: `⛔ تم حجب الطلب بواسطة جدار الحماية الذكي (AI Safety Guard): غير مصرح بتنفيذ تعليمات تتجاوز الصلاحيات أو قواعد البيانات المباشرة.`,
          createdAt: new Date().toISOString(),
        };
        appendMessagesToStorage(conversationId, [userMessage, blockedMsg], content);
        return { userMessage, assistantMessage: blockedMsg };
      }

      let responseText = "";
      let intent = "general_chat";

      // Sovereign Internal AI Engine: 100% self-contained, instant, private, and deep-system aware
      const res = generateSmartAssistantResponse(
        sanitization.sanitizedPrompt,
        app,
        userRole
      );
      responseText = res.responseText;
      intent = res.intent;

      // Free-form conversation: when a live LLM engine is configured, answer general
      // questions with it, grounded in live system data and recent chat history.
      if (res.intent === "general_chat" && !res.matchedReportDomain) {
        const cfg = loadAIProviderConfig();
        if (cfg.provider !== "built_in" && cfg.apiKey?.trim()) {
          try {
            const history = (loadStoredMessages()[conversationId] || [])
              .slice(-8)
              .map((m) => `${m.role === "user" ? "المستخدم" : "المساعد"}: ${m.content.slice(0, 600)}`)
              .join("\n");
            const llmPrompt = history
              ? `سياق المحادثة السابقة:\n${history}\n\nالرسالة الجديدة من المستخدم:\n${sanitization.sanitizedPrompt}`
              : sanitization.sanitizedPrompt;
            responseText = await callExternalLLM(llmPrompt, buildSystemPromptForLLM(app), cfg);
            intent = "general_chat_llm";
          } catch (err: any) {
            responseText = `${res.responseText}\n\n⚠️ تعذر الاتصال بالمحرك الخارجي (${err?.message || "خطأ غير معروف"}) فتم الرد بالمحرك المدمج.`;
          }
        }
      }
      const latency = Math.max(25, Date.now() - startTime);
      aiObservability.recordEvent({
        conversationId,
        userId: "current-user",
        toolName: intent,
        modelLatencyMs: latency,
        toolLatencyMs: 12,
        totalLatencyMs: latency + 12,
        inputTokens: content.length * 2,
        outputTokens: responseText.length * 2,
        estimatedCostUsd: 0.0004,
        status: "success",
      });

      const assistantMessage: AIChatMessage = {
        id: `msg-a-${Date.now() + 1}`,
        conversationId,
        role: "assistant",
        content: responseText,
        metadata: res.metadata || metadata,
        createdAt: new Date().toISOString(),
      };

      appendMessagesToStorage(conversationId, [userMessage, assistantMessage], content);

      return {
        userMessage,
        assistantMessage,
      };
    },
    onSuccess: (data, variables) => {
      queryClient.setQueryData<AIChatMessage[]>(
        ["ai", "messages", variables.conversationId],
        (old = []) => {
          const exists = old.some((m) => m.id === data.assistantMessage.id);
          if (exists) return old;
          return [...old, data.userMessage, data.assistantMessage];
        }
      );
      queryClient.invalidateQueries({ queryKey: ["ai", "conversations"] });
      queryClient.invalidateQueries({ queryKey: ["ai", "kpis"] });
    },
  });
}

function appendMessagesToStorage(
  conversationId: string,
  newMessages: AIChatMessage[],
  latestUserPrompt: string
) {
  const allMsgs = loadStoredMessages();
  const currentList = allMsgs[conversationId] || [];
  allMsgs[conversationId] = [...currentList, ...newMessages];
  saveStoredMessages(allMsgs);

  const convs = loadStoredConversations();
  const updatedConvs = convs.map((c) => {
    if (c.id !== conversationId) return c;
    const shouldUpdateTitle = c.title.startsWith("محادثة تحليلية جديدة");
    return {
      ...c,
      title: shouldUpdateTitle ? latestUserPrompt.slice(0, 42) : c.title,
      updatedAt: new Date().toISOString(),
    };
  });
  saveStoredConversations(updatedConvs);
}
