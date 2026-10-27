// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PROMPT 32: PRODUCTION EMPLOYEE RELATIONS, CASES, GRIEVANCES,
//            INVESTIGATIONS & DISCIPLINARY ENGINE
// View: src/components/employee-relations/EmployeeRelationsView.tsx
// ============================================================================

import React, { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../integrations/supabase/client";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { toast } from "sonner";
import {
  Shield,
  Search,
  Plus,
  RefreshCw,
  AlertTriangle,
  Scale,
  Clock,
  UserCheck,
  FolderLock,
  FileText,
  AlertCircle,
  Eye,
  PenTool,
  ShieldAlert,
  HelpCircle,
  CheckCircle2,
  Calendar,
  Briefcase,
  Users,
  Settings,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";

import {
  useErKpis,
  useErCases,
  useErWarnings,
  useErAppeals,
  useErCaps,
  useErInvestigations,
} from "../../lib/data/employee-relations-repository";
import { employeeRelationsQueryKeys } from "../../lib/query/employee-relations-query-keys";

import {
  formatCaseStatus,
  formatCaseType,
  formatConfidentialityLevel,
  formatSeverity,
  formatWarningLevel,
  formatAcknowledgementStatus,
  formatAppealStatus,
  isSlaBreached,
  type ErCase,
  type ErEmployeeWarning,
  type ErCaseStatus,
  type ErCaseType,
  type ErSeverity,
} from "../../lib/domains/employee-relations";

import { CreateCaseModal } from "./CreateCaseModal";
import { CaseTriageModal } from "./CaseTriageModal";
import { InvestigationModal } from "./InvestigationModal";
import { RecordDecisionModal } from "./RecordDecisionModal";
import { IssueDisciplinaryActionModal } from "./IssueDisciplinaryActionModal";
import { SubmitAppealModal } from "./SubmitAppealModal";
import { AcknowledgeWarningModal } from "./AcknowledgeWarningModal";
import { CaseDetailModal } from "./CaseDetailModal";

interface EmployeeRelationsViewProps {
  companyId?: string;
}

export const EmployeeRelationsView: React.FC<EmployeeRelationsViewProps> = ({
  companyId: propCompanyId,
}) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [companyId, setCompanyId] = useState<string>(propCompanyId || "");
  const [activeTab, setActiveTab] = useState<"cases" | "investigations" | "warnings" | "appeals" | "caps">("cases");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [caseTypeFilter, setCaseTypeFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");

  // Selected Entities for Modals
  const [selectedCase, setSelectedCase] = useState<ErCase | null>(null);
  const [selectedWarning, setSelectedWarning] = useState<ErEmployeeWarning | null>(null);

  // Modals Visibility State
  const [isCreateCaseOpen, setIsCreateCaseOpen] = useState(false);
  const [isTriageOpen, setIsTriageOpen] = useState(false);
  const [isInvestigationOpen, setIsInvestigationOpen] = useState(false);
  const [isDecisionOpen, setIsDecisionOpen] = useState(false);
  const [isWarningOpen, setIsWarningOpen] = useState(false);
  const [isAppealOpen, setIsAppealOpen] = useState(false);
  const [isAcknowledgeWarningOpen, setIsAcknowledgeWarningOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Context resolution
  useEffect(() => {
    async function resolveCompany() {
      if (propCompanyId) {
        setCompanyId(propCompanyId);
        return;
      }
      const { data } = await (supabase as any)
        .from("companies")
        .select("id")
        .limit(1)
        .maybeSingle();
      if (data?.id) {
        setCompanyId(data.id);
      }
    }
    resolveCompany();
  }, [propCompanyId]);

  // Queries
  const { data: kpis, isLoading: isLoadingKpis, refetch: refetchKpis } = useErKpis(companyId);
  const {
    data: cases = [],
    isLoading: isLoadingCases,
    refetch: refetchCases,
  } = useErCases(companyId, {
    status: statusFilter !== "all" ? statusFilter : undefined,
    caseType: caseTypeFilter !== "all" ? caseTypeFilter : undefined,
    severity: severityFilter !== "all" ? severityFilter : undefined,
  });
  const { data: warnings = [], refetch: refetchWarnings } = useErWarnings(companyId);
  const { data: appeals = [], refetch: refetchAppeals } = useErAppeals(companyId);
  const { data: caps = [], refetch: refetchCaps } = useErCaps(companyId);

  const handleRefreshAll = () => {
    refetchKpis();
    refetchCases();
    refetchWarnings();
    refetchAppeals();
    refetchCaps();
    toast.success("تم تحديث بيانات علاقات الموظفين والتحقيقات");
  };

  // Filter cases client-side by search term
  const filteredCases = cases.filter((c) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      c.caseNumber.toLowerCase().includes(term) ||
      c.title.toLowerCase().includes(term) ||
      (c.subjectEmployeeName && c.subjectEmployeeName.toLowerCase().includes(term)) ||
      (c.complainantEmployeeName && c.complainantEmployeeName.toLowerCase().includes(term)) ||
      (c.assignedInvestigatorName && c.assignedInvestigatorName.toLowerCase().includes(term))
    );
  });

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto" dir="rtl">
      {/* 1. Header & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <Scale className="w-6 h-6 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-700 border border-emerald-500/20">
                  شاشة العمليات وسجل القضايا والتحقيقات
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-foreground">
                علاقات الموظفين والقضايا والتحقيقات
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                إدارة القضايا العمالية والتظلمات، التحقيقات الإدارية، محاضر الجلسات، وسجل الجزاءات والإنذارات المعتمدة
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate({ to: "/setup?tab=learning_er_setup" as any })}
            className="gap-1.5 h-9 font-bold text-xs"
          >
            <Settings className="w-4 h-4 text-primary" />
            <span>تهيئة لائحة الجزاءات وسياسات SLA</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshAll}
            className="gap-1.5 h-9"
          >
            <RefreshCw className="w-4 h-4" />
            <span>تحديث</span>
          </Button>

          <Button
            size="sm"
            onClick={() => setIsCreateCaseOpen(true)}
            className="gap-1.5 h-9 bg-primary text-primary-foreground shadow-xs font-semibold"
          >
            <Plus className="w-4 h-4" />
            <span>تسجيل قضية / تظلم جديد</span>
          </Button>
        </div>
      </div>

      {/* 2. Executive KPI Cards Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Open Cases */}
        <div className="p-3.5 rounded-xl bg-card border border-border shadow-xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-semibold">قضايا مفتوحة</span>
            <FolderLock className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-xl font-black text-foreground font-mono">
            {kpis?.openCases ?? 0}
          </div>
          <div className="text-[10px] text-muted-foreground">
            من إجمالي {kpis?.totalCases ?? 0} قضية مسجلة
          </div>
        </div>

        {/* Active Investigations */}
        <div className="p-3.5 rounded-xl bg-card border border-border shadow-xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-semibold">تحقيقات جارية</span>
            <Search className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-xl font-black text-foreground font-mono">
            {kpis?.activeInvestigations ?? 0}
          </div>
          <div className="text-[10px] text-indigo-600 font-medium">
            جلسات سماع ومواجهة نشطة
          </div>
        </div>

        {/* SLA Breached */}
        <div className="p-3.5 rounded-xl bg-card border border-border shadow-xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-semibold">تجاوز مهلة الحل</span>
            <Clock className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-xl font-black text-rose-600 dark:text-rose-400 font-mono">
            {kpis?.slaBreachedCount ?? 0}
          </div>
          <div className="text-[10px] text-muted-foreground">
            تتطلب تدخلاً عاجلاً
          </div>
        </div>

        {/* Pending Warning Signatures */}
        <div className="p-3.5 rounded-xl bg-card border border-border shadow-xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-semibold">بانتظار توقيع الموظف</span>
            <PenTool className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl font-black text-foreground font-mono">
            {kpis?.pendingAcknowledgements ?? 0}
          </div>
          <div className="text-[10px] text-amber-600 font-medium">
            إنذارات صادرة قيد التسليم
          </div>
        </div>

        {/* Open Appeals */}
        <div className="p-3.5 rounded-xl bg-card border border-border shadow-xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-semibold">استئنافات وتظلمات</span>
            <ShieldAlert className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-xl font-black text-foreground font-mono">
            {kpis?.openAppeals ?? 0}
          </div>
          <div className="text-[10px] text-purple-600 font-medium">
            أمام لجنة التظلمات
          </div>
        </div>

        {/* Active Corrective Action Plans */}
        <div className="p-3.5 rounded-xl bg-card border border-border shadow-xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-semibold">خطط تصحيح (CAP)</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl font-black text-foreground font-mono">
            {kpis?.activeCaps ?? 0}
          </div>
          <div className="text-[10px] text-emerald-600 font-medium">
            برامج تدريب وتأهيل سلوكي
          </div>
        </div>
      </div>

      {/* 3. Tab Navigation */}
      <div className="flex border-b border-border gap-2 overflow-x-auto text-sm font-semibold">
        <button
          onClick={() => setActiveTab("cases")}
          className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 ${
            activeTab === "cases"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <FolderLock className="w-4 h-4" />
          سجل القضايا والشكاوى ({cases.length})
        </button>

        <button
          onClick={() => setActiveTab("investigations")}
          className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 ${
            activeTab === "investigations"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Search className="w-4 h-4" />
          التحقيقات وجلسات السماع ({kpis?.activeInvestigations ?? 0})
        </button>

        <button
          onClick={() => setActiveTab("warnings")}
          className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 ${
            activeTab === "warnings"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          الإنذارات والجزاءات ({warnings.length})
        </button>

        <button
          onClick={() => setActiveTab("appeals")}
          className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 ${
            activeTab === "appeals"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Shield className="w-4 h-4" />
          التظلمات والاستئنافات ({appeals.length})
        </button>

        <button
          onClick={() => setActiveTab("caps")}
          className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 ${
            activeTab === "caps"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Briefcase className="w-4 h-4" />
          خطط تصحيح السلوك (CAP) ({caps.length})
        </button>
      </div>

      {/* 4. Tab 1: Cases Register */}
      {activeTab === "cases" && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-card p-3.5 rounded-xl border border-border">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 absolute right-3 top-2.5 text-muted-foreground" />
              <Input
                placeholder="بحث برقم القضية، الموظف، العنوان..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-9 text-xs h-9"
              />
            </div>

            {/* Status Filter */}
            <div>
              <select
                className="w-full h-9 px-3 rounded-md border border-input bg-background text-xs focus:outline-hidden focus:ring-1 focus:ring-ring"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">كافة الحالات</option>
                <option value="submitted">مقدمة جديدة</option>
                <option value="under_review">قيد المراجعة والفرز</option>
                <option value="investigation">تحقيق رسمي جارٍ</option>
                <option value="awaiting_response">بانتظار إفادة</option>
                <option value="action_required">يتطلب إجراءً تأديبياً</option>
                <option value="appeal_pending">استئناف معلق</option>
                <option value="resolved">تم البت فيها</option>
                <option value="closed">مغلقة نهائياً</option>
              </select>
            </div>

            {/* Case Type Filter */}
            <div>
              <select
                className="w-full h-9 px-3 rounded-md border border-input bg-background text-xs focus:outline-hidden focus:ring-1 focus:ring-ring"
                value={caseTypeFilter}
                onChange={(e) => setCaseTypeFilter(e.target.value)}
              >
                <option value="all">كافة التصنيفات</option>
                <option value="grievance">تظلم موظف</option>
                <option value="employee_complaint">شكوى موظف</option>
                <option value="manager_complaint">شكوى من مدير</option>
                <option value="workplace_incident">حادثة بيئة عمل</option>
                <option value="policy_violation">مخالفة سياسات المنشأة</option>
                <option value="misconduct">سوء سلوك مهني</option>
                <option value="attendance_discipline">مخالفة انضباط وحضور</option>
                <option value="harassment_allegation">ادعاء مضايقة أو تحرش</option>
              </select>
            </div>

            {/* Severity Filter */}
            <div>
              <select
                className="w-full h-9 px-3 rounded-md border border-input bg-background text-xs focus:outline-hidden focus:ring-1 focus:ring-ring"
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
              >
                <option value="all">كافة درجات الخطورة</option>
                <option value="low">منخفضة (Low)</option>
                <option value="medium">متوسطة (Medium)</option>
                <option value="high">عالية (High)</option>
                <option value="critical">حرجة للغاية (Critical)</option>
              </select>
            </div>
          </div>

          {/* Cases Table */}
          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
            {isLoadingCases ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                جاري تحميل سجل القضايا والتظلمات...
              </div>
            ) : filteredCases.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <FolderLock className="w-10 h-10 text-muted-foreground mx-auto opacity-40" />
                <h3 className="text-sm font-bold text-foreground">لا توجد قضايا مطابقة لمعايير البحث</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  يمكنك تسجيل قضية جديدة أو تعديل فلاتر التصفية لعرض السجلات السابقة.
                </p>
                <Button size="sm" onClick={() => setIsCreateCaseOpen(true)}>
                  تسجيل قضية جديدة الآن
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                    <tr>
                      <th className="p-3">رقم القضية</th>
                      <th className="p-3">العنوان والتصنيف</th>
                      <th className="p-3">الموظف المعني</th>
                      <th className="p-3">السرية</th>
                      <th className="p-3">الخطورة</th>
                      <th className="p-3">الحالة</th>
                      <th className="p-3">مهلة SLA</th>
                      <th className="p-3 text-center">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredCases.map((c) => {
                      const breached = isSlaBreached(c.dueDate, c.resolvedAt);
                      return (
                        <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                          <td className="p-3 font-mono font-bold text-primary whitespace-nowrap">
                            {c.caseNumber}
                          </td>
                          <td className="p-3">
                            <div className="font-bold text-foreground">{c.title}</div>
                            <span className="text-[11px] text-muted-foreground">
                              {formatCaseType(c.caseType)}
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="font-medium text-foreground">
                              {c.subjectEmployeeName || "غير محدد"}
                            </div>
                            {c.subjectDepartment && (
                              <div className="text-[10px] text-muted-foreground">
                                {c.subjectDepartment}
                              </div>
                            )}
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                c.confidentialityLevel === "highly_confidential"
                                  ? "bg-rose-500/10 text-rose-700 dark:text-rose-300"
                                  : c.confidentialityLevel === "legal_sensitive"
                                  ? "bg-purple-500/10 text-purple-700 dark:text-purple-300"
                                  : "bg-muted text-foreground"
                              }`}
                            >
                              {formatConfidentialityLevel(c.confidentialityLevel)}
                            </span>
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                c.severity === "critical"
                                  ? "bg-rose-500/15 text-rose-600"
                                  : c.severity === "high"
                                  ? "bg-amber-500/15 text-amber-600"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {formatSeverity(c.severity)}
                            </span>
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                c.status === "resolved" || c.status === "closed"
                                  ? "bg-emerald-500/10 text-emerald-600"
                                  : c.status === "investigation"
                                  ? "bg-indigo-500/10 text-indigo-600"
                                  : c.status === "action_required"
                                  ? "bg-rose-500/10 text-rose-600"
                                  : "bg-blue-500/10 text-blue-600"
                              }`}
                            >
                              {formatCaseStatus(c.status)}
                            </span>
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            {breached ? (
                              <span className="text-[11px] font-bold text-rose-600 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" /> متجاوز
                              </span>
                            ) : (
                              <span className="text-[11px] text-muted-foreground">
                                {c.dueDate || "غير محدد"}
                              </span>
                            )}
                          </td>
                          <td className="p-3 whitespace-nowrap text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setSelectedCase(c);
                                  setIsDetailModalOpen(true);
                                }}
                                className="h-7 px-2 text-xs"
                              >
                                <Eye className="w-3.5 h-3.5 ml-1" />
                                التفاصيل
                              </Button>

                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedCase(c);
                                  setIsTriageOpen(true);
                                }}
                                className="h-7 px-2 text-xs"
                              >
                                فرز
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. Tab 2: Investigations & Hearings */}
      {activeTab === "investigations" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-foreground">التحقيقات الإدارية النشطة</h3>
              <p className="text-xs text-muted-foreground">
                متابعة محاضر الاستجواب، فحص الأدلة، وجلسات المواجهة الرسمية
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {cases
              .filter((c) => c.status === "investigation" || c.status === "under_review")
              .map((c) => (
                <div
                  key={c.id}
                  className="p-4 rounded-xl border border-border bg-card space-y-3 hover:border-primary/40 transition-all shadow-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-primary">{c.caseNumber}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-indigo-500/10 text-indigo-600">
                      تحقيق جارٍ
                    </span>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-foreground">{c.title}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{c.description}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-border">
                    <div>
                      <span className="text-[10px] text-muted-foreground">الموظف المعني:</span>
                      <p className="font-semibold text-foreground">{c.subjectEmployeeName || "غير محدد"}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground">المحقق المكلف:</span>
                      <p className="font-semibold text-foreground">{c.assignedInvestigatorName || "قيد التعيين"}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-muted-foreground">المهلة: {c.dueDate}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedCase(c);
                        setIsDetailModalOpen(true);
                      }}
                      className="text-xs h-7"
                    >
                      فتح محضر التحقيق
                    </Button>
                  </div>
                </div>
              ))}
          </div>

          {cases.filter((c) => c.status === "investigation" || c.status === "under_review").length === 0 && (
            <div className="p-8 text-center text-xs text-muted-foreground bg-muted/20 rounded-xl border border-border">
              لا توجد تحقيقات جارية في الوقت الحالي.
            </div>
          )}
        </div>
      )}

      {/* 6. Tab 3: Warnings & Disciplinary Registry */}
      {activeTab === "warnings" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-foreground">سجل الإنذارات والجزاءات الرسمية المعتمدة</h3>
              <p className="text-xs text-muted-foreground">
                التدرج التأديبي، مدد سريان الخطابات، وتتبع توقيع واستلام الموظف
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
            {warnings.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                لا توجد إنذارات تأديبية مسجلة حالياً في سجل المنشأة.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                    <tr>
                      <th className="p-3">رقم الإنذار</th>
                      <th className="p-3">الموظف المعني</th>
                      <th className="p-3">درجة الإنذار</th>
                      <th className="p-3">تاريخ الإصدار</th>
                      <th className="p-3">تاريخ الانتهاء</th>
                      <th className="p-3">حالة التوقيع</th>
                      <th className="p-3 text-center">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {warnings.map((w) => (
                      <tr key={w.id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3 font-mono font-bold text-amber-600 dark:text-amber-400">
                          {w.warningNumber}
                        </td>
                        <td className="p-3">
                          <div className="font-bold text-foreground">{w.employeeName}</div>
                          <span className="text-[10px] text-muted-foreground">{w.employeeNumber}</span>
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300">
                            {formatWarningLevel(w.warningLevel)}
                          </span>
                        </td>
                        <td className="p-3 text-muted-foreground">{w.issuedDate}</td>
                        <td className="p-3 text-muted-foreground">{w.validUntil}</td>
                        <td className="p-3 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              w.acknowledgementStatus === "acknowledged"
                                ? "bg-emerald-500/10 text-emerald-600"
                                : w.acknowledgementStatus === "refused_to_sign"
                                ? "bg-rose-500/10 text-rose-600"
                                : "bg-amber-500/10 text-amber-600"
                            }`}
                          >
                            {formatAcknowledgementStatus(w.acknowledgementStatus)}
                          </span>
                        </td>
                        <td className="p-3 text-center whitespace-nowrap">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedWarning(w);
                              setIsAcknowledgeWarningOpen(true);
                            }}
                            className="h-7 text-xs"
                          >
                            <PenTool className="w-3 h-3 ml-1" />
                            توقيع / إثبات
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 7. Tab 4: Grievances & Appeals */}
      {activeTab === "appeals" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-foreground">لجنة الاستئنافات والتظلمات العمالية</h3>
              <p className="text-xs text-muted-foreground">
                فحص طلبات التظلم المستقلة مع ضمان مبدأ فصل السلطات وحماية حقوق التقاضي الداخلي
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
            {appeals.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                لا توجد طلبات استئناف أو تظلمات معلقة حالياً.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                    <tr>
                      <th className="p-3">رقم الاستئناف</th>
                      <th className="p-3">المستأنف</th>
                      <th className="p-3">السند النظامي</th>
                      <th className="p-3">الحالة</th>
                      <th className="p-3">لجنة الفحص</th>
                      <th className="p-3">تاريخ التقديم</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {appeals.map((ap) => (
                      <tr key={ap.id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3 font-mono font-bold text-purple-600 dark:text-purple-400">
                          {ap.appealNumber}
                        </td>
                        <td className="p-3 font-bold text-foreground">{ap.appellantName}</td>
                        <td className="p-3 text-muted-foreground">{ap.groundsForAppeal}</td>
                        <td className="p-3 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-700 dark:text-purple-300">
                            {formatAppealStatus(ap.status)}
                          </span>
                        </td>
                        <td className="p-3 text-foreground font-medium">
                          {ap.appealsOfficerName || "قيد التعيين المحايد"}
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {new Date(ap.createdAt).toLocaleDateString("ar-SA")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 8. Tab 5: Corrective Action Plans (CAP) */}
      {activeTab === "caps" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-foreground">خطط تحسين الأداء والسلوك (CAP)</h3>
              <p className="text-xs text-muted-foreground">
                برامج التمكين وإعادة التأهيل السلوكي والربط مع منظومة التدريب
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {caps.map((cap) => (
              <div key={cap.id} className="p-4 rounded-xl border border-border bg-card space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-foreground">{cap.title}</h4>
                  <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-emerald-500/10 text-emerald-600">
                    {cap.status === "completed" ? "مكتمل" : "قيد التنفيذ"}
                  </span>
                </div>

                <p className="text-xs text-muted-foreground">{cap.objectives}</p>

                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-muted-foreground font-medium">
                    <span>نسبة الإنجاز:</span>
                    <span>{cap.progressPct}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-2 rounded-full transition-all"
                      style={{ width: `${cap.progressPct}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-2 border-t border-border text-muted-foreground">
                  <span>الموظف: {cap.employeeName}</span>
                  <span>المشرف: {cap.supervisorName || "إدارة الموارد البشرية"}</span>
                </div>
              </div>
            ))}
          </div>

          {caps.length === 0 && (
            <div className="p-8 text-center text-xs text-muted-foreground bg-muted/20 rounded-xl border border-border">
              لا توجد خطط تصحيح أداء سلوكي نشطة في الوقت الحالي.
            </div>
          )}
        </div>
      )}

      {/* Modals Container */}
      <CreateCaseModal
        isOpen={isCreateCaseOpen}
        onClose={() => setIsCreateCaseOpen(false)}
        onSuccess={() => {
          refetchCases();
          refetchKpis();
        }}
        companyId={companyId}
      />

      <CaseTriageModal
        isOpen={isTriageOpen}
        onClose={() => setIsTriageOpen(false)}
        onSuccess={() => {
          refetchCases();
          refetchKpis();
        }}
        erCase={selectedCase}
      />

      <InvestigationModal
        isOpen={isInvestigationOpen}
        onClose={() => setIsInvestigationOpen(false)}
        onSuccess={() => {
          refetchCases();
          refetchKpis();
        }}
        erCase={selectedCase}
      />

      <RecordDecisionModal
        isOpen={isDecisionOpen}
        onClose={() => setIsDecisionOpen(false)}
        onSuccess={() => {
          refetchCases();
          refetchKpis();
        }}
        erCase={selectedCase}
      />

      <IssueDisciplinaryActionModal
        isOpen={isWarningOpen}
        onClose={() => setIsWarningOpen(false)}
        onSuccess={() => {
          refetchCases();
          refetchWarnings();
          refetchKpis();
        }}
        erCase={selectedCase}
      />

      <SubmitAppealModal
        isOpen={isAppealOpen}
        onClose={() => setIsAppealOpen(false)}
        onSuccess={() => {
          refetchCases();
          refetchAppeals();
          refetchKpis();
        }}
        erCase={selectedCase}
      />

      <AcknowledgeWarningModal
        isOpen={isAcknowledgeWarningOpen}
        onClose={() => setIsAcknowledgeWarningOpen(false)}
        onSuccess={() => {
          refetchWarnings();
          refetchKpis();
        }}
        warning={selectedWarning}
      />

      <CaseDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        caseId={selectedCase?.id || null}
        companyId={companyId}
        onOpenTriage={() => setIsTriageOpen(true)}
        onOpenInvestigation={() => setIsInvestigationOpen(true)}
        onOpenDecision={() => setIsDecisionOpen(true)}
        onOpenWarning={() => setIsWarningOpen(true)}
        onOpenAppeal={() => setIsAppealOpen(true)}
      />
    </div>
  );
};
