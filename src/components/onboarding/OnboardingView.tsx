import React, { useState, useEffect, useMemo } from "react";
import {
  Users,
  UserPlus,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileText,
  Laptop,
  Award,
  Search,
  Filter,
  RefreshCw,
  Plus,
  Eye,
  ShieldCheck,
  ChevronRight,
  TrendingUp,
  X,
  Check,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useApp } from "../../lib/context/AppContext";
import {
  fetchOnboardingKpisRecord,
  fetchOnboardingCases,
  fetchOnboardingTasks,
  fetchOnboardingDocumentRequirements,
  fetchOnboardingAcknowledgements,
  fetchOnboardingTemplates,
  fetchOnboardingTaskDefinitions,
  fetchProbationCases,
  fetchProbationPolicies,
  fetchMyOnboardingCase,
  fetchMyOnboardingTasks,
  fetchTeamOnboardingCases,
  updateOnboardingTaskStatus,
  verifyOnboardingDocument,
  completeOnboardingCase,
  calculateCaseReadiness,
} from "../../lib/data/onboarding-repository";
import type {
  OnboardingCase,
  OnboardingTask,
  OnboardingDocumentRequirement,
  OnboardingAcknowledgement,
  OnboardingTemplate,
  OnboardingTaskDefinition,
  ProbationCase,
  ProbationPolicy,
  OnboardingKpis,
} from "../../lib/domains/onboarding";
import { canCompleteOnboarding } from "../../lib/domains/onboarding";
import { CreateOnboardingCaseModal } from "./CreateOnboardingCaseModal";
import { ProbationDecisionModal } from "./ProbationDecisionModal";
import { EmployeeOnboardingView } from "./EmployeeOnboardingView";
import { ManagerOnboardingView } from "./ManagerOnboardingView";

export const OnboardingView: React.FC = () => {
  const { company, employees, currentRole } = useApp();
  const companyId = company?.id || employees[0]?.subsidiaryId || "default";

  const [activeTab, setActiveTab] = useState<
    "overview" | "cases" | "readiness" | "probation" | "templates" | "task_library" | "my_portal" | "manager_portal"
  >("overview");

  // Data states
  const [kpis, setKpis] = useState<OnboardingKpis | null>(null);
  const [cases, setCases] = useState<OnboardingCase[]>([]);
  const [templates, setTemplates] = useState<OnboardingTemplate[]>([]);
  const [taskDefinitions, setTaskDefinitions] = useState<OnboardingTaskDefinition[]>([]);
  const [probationCases, setProbationCases] = useState<ProbationCase[]>([]);
  const [probationPolicies, setProbationPolicies] = useState<ProbationPolicy[]>([]);
  const [myCase, setMyCase] = useState<OnboardingCase | null>(null);
  const [myTasks, setMyTasks] = useState<OnboardingTask[]>([]);
  const [teamCases, setTeamCases] = useState<OnboardingCase[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [selectedProbationCase, setSelectedProbationCase] = useState<ProbationCase | null>(null);
  const [selectedCaseDetail, setSelectedCaseDetail] = useState<OnboardingCase | null>(null);
  const [caseTasks, setCaseTasks] = useState<OnboardingTask[]>([]);
  const [caseDocs, setCaseDocs] = useState<OnboardingDocumentRequirement[]>([]);
  const [caseAcks, setCaseAcks] = useState<OnboardingAcknowledgement[]>([]);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);

  // Document rejection modal
  const [rejectingDocId, setRejectingDocId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>("");

  const loadData = async () => {
    try {
      setLoading(true);
      const [
        kpisRes,
        casesRes,
        templatesRes,
        taskDefsRes,
        probRes,
        policiesRes,
        myCaseRes,
        myTasksRes,
        teamCasesRes,
      ] = await Promise.all([
        fetchOnboardingKpisRecord(companyId),
        fetchOnboardingCases(companyId),
        fetchOnboardingTemplates(companyId),
        fetchOnboardingTaskDefinitions(companyId),
        fetchProbationCases(companyId),
        fetchProbationPolicies(companyId),
        fetchMyOnboardingCase(),
        fetchMyOnboardingTasks(),
        fetchTeamOnboardingCases(),
      ]);

      setKpis(kpisRes);
      setCases(casesRes);
      setTemplates(templatesRes);
      setTaskDefinitions(taskDefsRes);
      setProbationCases(probRes);
      setProbationPolicies(policiesRes);
      setMyCase(myCaseRes);
      setMyTasks(myTasksRes);
      setTeamCases(teamCasesRes);
    } catch (err: any) {
      toast.error("حدث خطأ أثناء تحميل بيانات التهيئة وفترة التجربة");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [companyId]);

  const loadCaseDetail = async (c: OnboardingCase) => {
    try {
      setSelectedCaseDetail(c);
      setLoadingDetail(true);
      const [tasksRes, docsRes, acksRes] = await Promise.all([
        fetchOnboardingTasks(c.id),
        fetchOnboardingDocumentRequirements(c.id),
        fetchOnboardingAcknowledgements(c.id),
      ]);
      setCaseTasks(tasksRes);
      setCaseDocs(docsRes);
      setCaseAcks(acksRes);
    } catch (err) {
      toast.error("تعذر تحميل تفاصيل ملف التهيئة");
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleTaskStatusToggle = async (task: OnboardingTask) => {
    const nextStatus = task.status === "completed" ? "pending" : "completed";
    try {
      const res = await updateOnboardingTaskStatus(task.id, nextStatus);
      if (!res.ok) {
        toast.error(res.message || "تعذر تحديث المهمة");
        return;
      }
      toast.success(nextStatus === "completed" ? "تم إكمال المهمة بنجاح" : "تم إلغاء إكمال المهمة");
      if (selectedCaseDetail) {
        await loadCaseDetail(selectedCaseDetail);
      }
      loadData();
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ غير متوقع");
    }
  };

  const handleVerifyDocument = async (requirementId: string, status: "verified" | "rejected", reason?: string) => {
    try {
      const res = await verifyOnboardingDocument(requirementId, status, reason);
      if (!res.ok) {
        toast.error(res.message || "تعذر اعتماد المستند");
        return;
      }
      toast.success(status === "verified" ? "تم اعتماد المستند رسمياً" : "تم رفض المستند وتسجيل المبررات");
      setRejectingDocId(null);
      setRejectionReason("");
      if (selectedCaseDetail) {
        await loadCaseDetail(selectedCaseDetail);
      }
      loadData();
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ أثناء اعتماد المستند");
    }
  };

  const handleCompleteCase = async (c: OnboardingCase) => {
    try {
      const tasks = await fetchOnboardingTasks(c.id);
      const docs = await fetchOnboardingDocumentRequirements(c.id);
      const check = canCompleteOnboarding(c, tasks, docs);

      if (!check.allowed) {
        toast.error(check.reasons.join(" • "));
        return;
      }

      const res = await completeOnboardingCase(c.id);
      if (!res.ok) {
        toast.error(res.message || "تعذر إغلاق ملف التهيئة");
        return;
      }

      toast.success("تم إكمال ملف التهيئة بنجاح وتفعيل فترة التجربة في سجل الموظف");
      setSelectedCaseDetail(null);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ غير متوقع");
    }
  };

  const filteredCases = useMemo(() => {
    return cases.filter((c) => {
      const matchStatus = statusFilter === "all" || c.status === statusFilter;
      const search = searchQuery.trim().toLowerCase();
      const matchSearch =
        !search ||
        (c.employeeName && c.employeeName.toLowerCase().includes(search)) ||
        (c.employeeNo && c.employeeNo.toLowerCase().includes(search)) ||
        (c.jobTitle && c.jobTitle.toLowerCase().includes(search));
      return matchStatus && matchSearch;
    });
  }, [cases, statusFilter, searchQuery]);

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-xs">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-foreground tracking-tight">
                تهيئة الموظفين الجدد وفترة التجربة
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                متابعة رحلة المنضمين من القبول إلى المباشرة وجدولة المهام واعتماد فترة التجربة
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2.5 rounded-xl border border-input bg-card hover:bg-muted text-foreground transition-colors disabled:opacity-50"
            title="تحديث البيانات"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2.5 text-xs font-bold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 shadow-sm transition-all"
          >
            <Plus className="h-4 w-4" />
            بدء تهيئة موظف جديد
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1.5 border-b border-border pb-1 overflow-x-auto text-xs font-bold">
        <button
          onClick={() => setActiveTab("overview")}
          className={`px-4 py-2.5 rounded-xl transition-all ${
            activeTab === "overview"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          نظرة عامة والمؤشرات
        </button>

        <button
          onClick={() => setActiveTab("cases")}
          className={`px-4 py-2.5 rounded-xl transition-all ${
            activeTab === "cases"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          ملفات التهيئة ({cases.length})
        </button>

        <button
          onClick={() => setActiveTab("readiness")}
          className={`px-4 py-2.5 rounded-xl transition-all ${
            activeTab === "readiness"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          جاهزية المباشرة (Day 1)
        </button>

        <button
          onClick={() => setActiveTab("probation")}
          className={`px-4 py-2.5 rounded-xl transition-all ${
            activeTab === "probation"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          إدارة فترة التجربة ({probationCases.length})
        </button>

        <button
          onClick={() => setActiveTab("templates")}
          className={`px-4 py-2.5 rounded-xl transition-all ${
            activeTab === "templates"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          النماذج القياسية
        </button>

        <button
          onClick={() => setActiveTab("task_library")}
          className={`px-4 py-2.5 rounded-xl transition-all ${
            activeTab === "task_library"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          مكتبة المهام
        </button>

        {myCase && (
          <button
            onClick={() => setActiveTab("my_portal")}
            className={`px-4 py-2.5 rounded-xl transition-all ${
              activeTab === "my_portal"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
            }`}
          >
            بوابة تهيئتي الشخصية
          </button>
        )}

        {teamCases.length > 0 && (
          <button
            onClick={() => setActiveTab("manager_portal")}
            className={`px-4 py-2.5 rounded-xl transition-all ${
              activeTab === "manager_portal"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            تهيئة فريق العمل ({teamCases.length})
          </button>
        )}
      </div>

      {/* Tab: Overview & KPIs */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* KPI Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
            <div className="p-4 rounded-2xl bg-card border border-border shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-muted-foreground">الملفات النشطة</span>
                <h4 className="text-xl font-black text-foreground mt-0.5 font-mono">
                  {kpis?.activeCases ?? cases.length}
                </h4>
                <span className="text-[10px] text-primary font-bold">قيد التهيئة</span>
              </div>
              <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                <Users className="h-5 w-5" />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-card border border-border shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-muted-foreground">مباشرة خلال 30 يوم</span>
                <h4 className="text-xl font-black text-foreground mt-0.5 font-mono">
                  {kpis?.upcomingJoiners ?? 0}
                </h4>
                <span className="text-[10px] text-sky-600 font-bold">منضمون قادمون</span>
              </div>
              <div className="h-10 w-10 rounded-2xl bg-sky-500/10 flex items-center justify-center text-sky-600">
                <Calendar className="h-5 w-5" />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-card border border-border shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-muted-foreground">جاهز للمباشرة</span>
                <h4 className="text-xl font-black text-foreground mt-0.5 font-mono">
                  {kpis?.readyToJoin ?? 0}
                </h4>
                <span className="text-[10px] text-emerald-600 font-bold">اكتملت جاهزيته</span>
              </div>
              <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-card border border-border shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-muted-foreground">مهام متأخرة</span>
                <h4 className="text-xl font-black text-foreground mt-0.5 font-mono">
                  {kpis?.overdueTasks ?? 0}
                </h4>
                <span className="text-[10px] text-rose-600 font-bold">تتطلب المتابعة</span>
              </div>
              <div className="h-10 w-10 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-card border border-border shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-muted-foreground">مراجعات تجربة مستحقة</span>
                <h4 className="text-xl font-black text-foreground mt-0.5 font-mono">
                  {kpis?.probationDue ?? probationCases.filter((p) => p.status === "review_due").length}
                </h4>
                <span className="text-[10px] text-amber-600 font-bold">خلال 14 يوماً</span>
              </div>
              <div className="h-10 w-10 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-600">
                <Clock className="h-5 w-5" />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-card border border-border shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-muted-foreground">نسبة اجتياز التجربة</span>
                <h4 className="text-xl font-black text-foreground mt-0.5 font-mono">
                  {kpis?.probationConfirmedRate ?? 100}%
                </h4>
                <span className="text-[10px] text-emerald-600 font-bold">تثبيت معتمد</span>
              </div>
              <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                <Award className="h-5 w-5" />
              </div>
            </div>
          </div>

          {/* Recent Onboarding Cases Showcase */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground">أحدث حالات التهيئة الجارية</h3>
              <button
                onClick={() => setActiveTab("cases")}
                className="text-xs text-primary font-bold hover:underline flex items-center gap-1"
              >
                عرض كافة الملفات ({cases.length})
                <ChevronRight className="h-4 w-4 rotate-180" />
              </button>
            </div>

            {cases.length === 0 ? (
              <div className="p-8 text-center rounded-2xl border border-dashed border-border text-muted-foreground text-sm">
                لا توجد حالات تهيئة نشطة حالياً. يمكنك بدء أول حالة بالضغط على "بدء تهيئة موظف جديد".
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {cases.slice(0, 3).map((c) => (
                  <div
                    key={c.id}
                    className="p-5 rounded-2xl bg-card border border-border shadow-xs space-y-4 hover:border-primary/40 transition-all cursor-pointer"
                    onClick={() => loadCaseDetail(c)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-bold text-foreground">
                          {c.employeeName || "موظف جديد"}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          {c.jobTitle || "المسمى"} • {c.departmentName || "الإدارة"}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          c.readinessStatus === "ready"
                            ? "bg-emerald-500/10 text-emerald-600"
                            : c.readinessStatus === "partially_ready"
                            ? "bg-sky-500/10 text-sky-600"
                            : "bg-amber-500/10 text-amber-600"
                        }`}
                      >
                        {c.readinessStatus === "ready"
                          ? "جاهز"
                          : c.readinessStatus === "partially_ready"
                          ? "جاهز جزئياً"
                          : "غير جاهز"}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span>تاريخ المباشرة:</span>
                        <span className="font-mono font-bold text-foreground">{c.joiningDate}</span>
                      </div>
                      <div className="space-y-1 pt-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground">الإنجاز:</span>
                          <span className="font-bold text-foreground">{c.progressPercentage}%</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${c.progressPercentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Cases List */}
      {activeTab === "cases" && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 rounded-2xl bg-card border border-border">
            <div className="relative w-full sm:w-72">
              <input
                type="text"
                placeholder="بحث بالاسم، الرقم الوظيفي، المسمى..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 pr-9 pl-3 text-xs rounded-xl border border-input bg-background text-foreground focus:ring-2 focus:ring-primary focus:outline-hidden"
              />
              <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-9 px-3 text-xs rounded-xl border border-input bg-background text-foreground focus:ring-2 focus:ring-primary focus:outline-hidden"
              >
                <option value="all">كافة الحالات</option>
                <option value="pre_onboarding">ما قبل المباشرة</option>
                <option value="in_progress">قيد التنفيذ</option>
                <option value="ready_to_join">جاهز للمباشرة</option>
                <option value="completed">مكتملة</option>
                <option value="cancelled">ملغاة</option>
              </select>
            </div>
          </div>

          {/* Cases Table */}
          {filteredCases.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-dashed border-border text-muted-foreground text-sm">
              لا توجد حالات تهيئة تطابق معايير البحث والتصفية.
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                    <tr>
                      <th className="p-3.5">الموظف / الرقم</th>
                      <th className="p-3.5">الإدارة / المسمى</th>
                      <th className="p-3.5">تاريخ المباشرة</th>
                      <th className="p-3.5">نسبة الإنجاز</th>
                      <th className="p-3.5">الجاهزية</th>
                      <th className="p-3.5">الحالة</th>
                      <th className="p-3.5 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredCases.map((c) => (
                      <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3.5 font-bold text-foreground">
                          {c.employeeName || "موظف جديد"}
                          <span className="block font-mono text-[11px] font-normal text-muted-foreground">
                            {c.employeeNo || "مسودة"}
                          </span>
                        </td>
                        <td className="p-3.5 text-muted-foreground">
                          {c.jobTitle || "—"}
                          <span className="block text-[11px]">{c.departmentName || "—"}</span>
                        </td>
                        <td className="p-3.5 font-mono font-semibold text-foreground">
                          {c.joiningDate}
                        </td>
                        <td className="p-3.5">
                          <div className="w-28 space-y-1">
                            <span className="font-bold text-foreground">{c.progressPercentage}%</span>
                            <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                              <div
                                className="h-full bg-primary rounded-full transition-all"
                                style={{ width: `${c.progressPercentage}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              c.readinessStatus === "ready"
                                ? "bg-emerald-500/10 text-emerald-600"
                                : c.readinessStatus === "partially_ready"
                                ? "bg-sky-500/10 text-sky-600"
                                : "bg-amber-500/10 text-amber-600"
                            }`}
                          >
                            {c.readinessStatus === "ready"
                              ? "جاهز"
                              : c.readinessStatus === "partially_ready"
                              ? "جاهز جزئياً"
                              : "غير جاهز"}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[10px] font-bold">
                            {c.status}
                          </span>
                        </td>
                        <td className="p-3.5 text-center">
                          <button
                            onClick={() => loadCaseDetail(c)}
                            className="px-3 py-1.5 text-xs font-bold rounded-xl border border-input hover:bg-muted text-foreground transition-colors inline-flex items-center gap-1.5"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            التفاصيل والمهام
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Joining Day Readiness */}
      {activeTab === "readiness" && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-card border border-border">
            <h3 className="text-sm font-bold text-foreground">
              مصفوفة جاهزية المباشرة لليوم الأول (Day 1 Readiness Matrix)
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              التحقق من اكتمال المهام الأساسية، المستندات، حسابات النظام، والأجهزة قبل المباشرة الفعلية
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {cases
              .filter((c) => c.status !== "completed" && c.status !== "cancelled")
              .map((c) => (
                <div
                  key={c.id}
                  className="p-5 rounded-2xl bg-card border border-border shadow-xs space-y-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-bold text-foreground">
                        {c.employeeName || "موظف جديد"}
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        تاريخ المباشرة: <span className="font-mono font-bold">{c.joiningDate}</span>
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                        c.readinessStatus === "ready"
                          ? "bg-emerald-500/10 text-emerald-600"
                          : c.readinessStatus === "partially_ready"
                          ? "bg-sky-500/10 text-sky-600"
                          : "bg-rose-500/10 text-rose-600"
                      }`}
                    >
                      {c.readinessStatus === "ready"
                        ? "جاهز للمباشرة"
                        : c.readinessStatus === "partially_ready"
                        ? "جاهز جزئياً"
                        : "غير جاهز"}
                    </span>
                  </div>

                  {c.blockingReasons && c.blockingReasons.length > 0 && (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-700 dark:text-rose-400 space-y-1">
                      <div className="font-bold flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        المعوقات الأساسية المعلقة:
                      </div>
                      <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                        {c.blockingReasons.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="pt-2 border-t border-border flex items-center justify-between">
                    <button
                      onClick={() => loadCaseDetail(c)}
                      className="px-3 py-1.5 text-xs font-bold rounded-xl border border-input hover:bg-muted text-foreground transition-colors"
                    >
                      مراجعة المتطلبات
                    </button>

                    <button
                      onClick={() => handleCompleteCase(c)}
                      disabled={c.readinessStatus !== "ready"}
                      className="px-4 py-1.5 text-xs font-bold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      اعتماد المباشرة وإنهاء التهيئة
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Tab: Probation Management */}
      {activeTab === "probation" && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-card border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-foreground">
                إدارة وحوكمة فترات التجربة (Probation Engine)
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                متابعة المواعيد النظامية للتقييم، التمديد بحد أقصى مسموح، وقرارات التثبيت أو إنهاء الخدمة
              </p>
            </div>
          </div>

          {probationCases.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-dashed border-border text-muted-foreground text-sm">
              لا توجد حالات فترة تجربة نشطة حالياً.
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                    <tr>
                      <th className="p-3.5">الموظف</th>
                      <th className="p-3.5">تاريخ البدء</th>
                      <th className="p-3.5">نهاية التجربة</th>
                      <th className="p-3.5">موعد المراجعة</th>
                      <th className="p-3.5">التمديدات</th>
                      <th className="p-3.5">الحالة</th>
                      <th className="p-3.5 text-center">القرار النهائي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {probationCases.map((p) => (
                      <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3.5 font-bold text-foreground">
                          {p.employeeName || p.employeeNo}
                          <span className="block text-[11px] text-muted-foreground font-normal">
                            {p.jobTitle || "موظف"}
                          </span>
                        </td>
                        <td className="p-3.5 font-mono">{p.startDate}</td>
                        <td className="p-3.5 font-mono font-bold text-foreground">
                          {p.currentEndDate}
                        </td>
                        <td className="p-3.5 font-mono text-amber-600 font-bold">
                          {p.reviewDueAt}
                        </td>
                        <td className="p-3.5 font-mono">
                          {p.extensionCount > 0 ? `${p.extensionDays} يوم (${p.extensionCount})` : "—"}
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              p.status === "confirmed"
                                ? "bg-emerald-500/10 text-emerald-600"
                                : p.status === "extended"
                                ? "bg-amber-500/10 text-amber-600"
                                : p.status === "failed"
                                ? "bg-rose-500/10 text-rose-600"
                                : "bg-primary/10 text-primary"
                            }`}
                          >
                            {p.status === "confirmed"
                              ? "مثبت"
                              : p.status === "extended"
                              ? "مُمدد"
                              : p.status === "failed"
                              ? "غير مجتاز"
                              : "سارية"}
                          </span>
                        </td>
                        <td className="p-3.5 text-center">
                          {p.status !== "confirmed" && p.status !== "failed" ? (
                            <button
                              onClick={() => setSelectedProbationCase(p)}
                              className="px-3 py-1.5 text-xs font-bold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors inline-flex items-center gap-1.5 shadow-xs"
                            >
                              <Award className="h-3.5 w-3.5" />
                              اتخاذ القرار
                            </button>
                          ) : (
                            <span className="text-muted-foreground font-semibold">
                              {p.finalDecision === "confirmed" ? "تثبيت معتمد" : "تم إنهاء الخدمة"}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Templates */}
      {activeTab === "templates" && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-card border border-border">
            <h3 className="text-sm font-bold text-foreground">نماذج التهيئة المعتمدة للمنشأة</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              تحديد المسارات والمهام النموذجية بحسب الدولة ونمط العمل والقسم
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {templates.map((t) => (
              <div
                key={t.id}
                className="p-5 rounded-2xl bg-card border border-border shadow-xs space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <h4 className="text-sm font-bold text-foreground">{t.nameAr}</h4>
                  <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                    إصدار {t.currentVersion}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{t.descriptionAr || t.nameEn}</p>
                <div className="pt-2 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>الدولة: {t.country}</span>
                  <span>النوع: {t.employmentType}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Task Library */}
      {activeTab === "task_library" && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-card border border-border">
            <h3 className="text-sm font-bold text-foreground">مكتبة المهام المعيارية للتهيئة</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              المهام الجاهزة مع تحديد الدور المسؤول (الموظف، الموارد البشرية، المدير، تقنية المعلومات) والإزاحة الزمنية
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                  <tr>
                    <th className="p-3.5">رمز المهمة</th>
                    <th className="p-3.5">عنوان المهمة</th>
                    <th className="p-3.5">المسؤول</th>
                    <th className="p-3.5">التصنيف</th>
                    <th className="p-3.5">موعد الإنجاز النسبي</th>
                    <th className="p-3.5">إلزامية للمباشرة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {taskDefinitions.map((td) => (
                    <tr key={td.id} className="hover:bg-muted/30">
                      <td className="p-3.5 font-mono font-bold text-foreground">{td.code}</td>
                      <td className="p-3.5 font-bold text-foreground">
                        {td.titleAr}
                        <span className="block text-[11px] text-muted-foreground font-normal">
                          {td.titleEn}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground text-[10px] font-bold">
                          {td.ownerRole}
                        </span>
                      </td>
                      <td className="p-3.5 text-muted-foreground">{td.category}</td>
                      <td className="p-3.5 font-mono font-bold text-foreground">
                        {td.relativeDueDays < 0
                          ? `T${td.relativeDueDays} يوم`
                          : td.relativeDueDays === 0
                          ? "Day 1 (يوم المباشرة)"
                          : `Day +${td.relativeDueDays}`}
                      </td>
                      <td className="p-3.5">
                        {td.isBlocking ? (
                          <span className="text-rose-600 font-bold">نعم (مانعة للمباشرة)</span>
                        ) : (
                          <span className="text-muted-foreground">اختيارية</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab: My Portal (Employee View) */}
      {activeTab === "my_portal" && myCase && (
        <EmployeeOnboardingView
          onboardingCase={myCase}
          tasks={myTasks}
          documents={caseDocs}
          acknowledgements={caseAcks}
          onRefresh={loadData}
        />
      )}

      {/* Tab: Manager Portal */}
      {activeTab === "manager_portal" && (
        <ManagerOnboardingView
          teamCases={teamCases}
          probationCases={probationCases}
          onRefresh={loadData}
        />
      )}

      {/* Detail Drawer / Modal for an Onboarding Case */}
      {selectedCaseDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-3xl rounded-2xl bg-card border border-border p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <h3 className="text-lg font-bold text-foreground">
                  تفاصيل ملف التهيئة: {selectedCaseDetail.employeeName || "موظف جديد"}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  الرقم: {selectedCaseDetail.employeeNo || "مسودة"} | تاريخ المباشرة:{" "}
                  {selectedCaseDetail.joiningDate}
                </p>
              </div>
              <button
                onClick={() => setSelectedCaseDetail(null)}
                className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {loadingDetail ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                جاري تحميل تفاصيل المهام والوثائق...
              </div>
            ) : (
              <div className="space-y-6">
                {/* Tasks Section */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    المهام والمتابعة التشغيلية ({caseTasks.length})
                  </h4>
                  <div className="space-y-2">
                    {caseTasks.map((t) => (
                      <div
                        key={t.id}
                        className="p-3 rounded-xl border border-border bg-card flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleTaskStatusToggle(t)}
                            className={`h-5 w-5 rounded-md border flex items-center justify-center transition-colors ${
                              t.status === "completed"
                                ? "bg-emerald-600 border-emerald-600 text-white"
                                : "border-input bg-background"
                            }`}
                          >
                            {t.status === "completed" && <Check className="h-3.5 w-3.5" />}
                          </button>
                          <div>
                            <span
                              className={`font-bold ${
                                t.status === "completed"
                                  ? "line-through text-muted-foreground"
                                  : "text-foreground"
                              }`}
                            >
                              {t.titleAr}
                            </span>
                            <span className="block text-[10px] text-muted-foreground">
                              المسؤول: {t.ownerRole} • الاستحقاق: {t.dueDate}
                            </span>
                          </div>
                        </div>

                        <div>
                          {t.isBlocking && (
                            <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 text-[10px] font-bold">
                              إلزامية
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Documents Verification Section */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    الوثائق والمستندات المطلوبة ({caseDocs.length})
                  </h4>
                  <div className="space-y-2">
                    {caseDocs.map((d) => (
                      <div
                        key={d.id}
                        className="p-3.5 rounded-xl border border-border bg-card flex items-center justify-between gap-3 text-xs"
                      >
                        <div>
                          <span className="font-bold text-foreground">{d.nameAr}</span>
                          <span className="block text-[10px] text-muted-foreground">
                            الحالة: {d.status === "verified" ? "معتمد" : d.status === "uploaded" ? "تم الرفع" : d.status === "rejected" ? `مرفوض: ${d.rejectionReason}` : "بانتظار الرفع"}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {d.status !== "verified" && (
                            <button
                              onClick={() => handleVerifyDocument(d.id, "verified")}
                              className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                            >
                              اعتماد
                            </button>
                          )}
                          {d.status !== "rejected" && (
                            <button
                              onClick={() => setRejectingDocId(d.id)}
                              className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 transition-colors"
                            >
                              رفض مع السبب
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Completion Action */}
                <div className="pt-4 border-t border-border flex items-center justify-between">
                  <button
                    onClick={() => setSelectedCaseDetail(null)}
                    className="px-4 py-2 text-xs font-semibold rounded-xl border border-border text-foreground hover:bg-muted"
                  >
                    إغلاق
                  </button>

                  <button
                    onClick={() => handleCompleteCase(selectedCaseDetail)}
                    className="px-5 py-2 text-xs font-bold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-1.5 shadow-sm"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    إكمال ملف التهيئة والمباشرة
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Rejection Reason Modal */}
      {rejectingDocId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-card border border-border p-5 space-y-4 shadow-2xl">
            <h4 className="text-sm font-bold text-foreground">تسجيل سبب رفض الوثيقة</h4>
            <input
              type="text"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="مثال: الصورة غير واضحة، الوثيقة منتهية الصلاحية..."
              className="w-full h-9 px-3 text-xs rounded-xl border border-input bg-background text-foreground"
              required
            />
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setRejectingDocId(null)}
                className="px-3 py-1.5 text-xs rounded-xl border border-border"
              >
                إلغاء
              </button>
              <button
                onClick={() => handleVerifyDocument(rejectingDocId, "rejected", rejectionReason)}
                className="px-4 py-1.5 text-xs font-bold rounded-xl bg-rose-600 text-white"
              >
                تأكيد الرفض
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <CreateOnboardingCaseModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={loadData}
        templates={templates}
      />

      <ProbationDecisionModal
        isOpen={!!selectedProbationCase}
        onClose={() => setSelectedProbationCase(null)}
        onSuccess={loadData}
        probationCase={selectedProbationCase}
        policy={probationPolicies.find((p) => p.id === selectedProbationCase?.policyId)}
      />
    </div>
  );
};
