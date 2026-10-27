import React, { useState, useMemo } from "react";
import { useBootstrapData } from "../../lib/domains/bootstrap/use-bootstrap";
import {
  useCompensationKPIs,
  useSalaryPayGrades,
  useSalaryRanges,
  useEmployeeCompensationPackages,
  useCompensationChangeRequests,
  useCompensationReviewCycles,
  useBenefitPlans,
  useBenefitEnrollments,
  useApproveSalaryChangeRequest,
  useFinalizeCompensationReview,
  useGenerateTotalRewardsStatement,
} from "../../lib/data/compensation-repository";
import {
  RANGE_STATUS_LABELS_AR,
  REASON_LABELS_AR,
  REVIEW_CYCLE_STATUS_LABELS_AR,
} from "../../lib/domains/compensation";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { useNavigate } from "@tanstack/react-router";
import {
  DollarSign,
  TrendingUp,
  Users,
  ShieldCheck,
  CheckCircle2,
  Plus,
  Layers,
  Award,
  Calendar,
  Gift,
  FileText,
  Search,
  Filter,
  Settings,
} from "lucide-react";
import { toast } from "sonner";
import { CreateSalaryChangeModal } from "./CreateSalaryChangeModal";
import { CreateStructureModal } from "./CreateStructureModal";
import { ReviewCycleModal } from "./ReviewCycleModal";
import { BenefitEnrollmentModal } from "./BenefitEnrollmentModal";
import { TotalRewardsStatementModal } from "./TotalRewardsStatementModal";

export function CompensationView() {
  const { company, employees = [] } = useBootstrapData();
  const navigate = useNavigate();
  const companyId = company?.id || "";

  const [activeTab, setActiveTab] = useState<string>("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Modals state
  const [salaryChangeModalOpen, setSalaryChangeModalOpen] = useState(false);
  const [structureModalOpen, setStructureModalOpen] = useState(false);
  const [reviewCycleModalOpen, setReviewCycleModalOpen] = useState(false);
  const [benefitEnrollmentModalOpen, setBenefitEnrollmentModalOpen] = useState(false);
  const [statementModalOpen, setStatementModalOpen] = useState(false);
  const [selectedStatementEmp, setSelectedStatementEmp] = useState<{ id: string; name: string; no: string } | null>(null);

  // Queries
  const { data: kpis } = useCompensationKPIs(companyId);
  const { data: payGrades = [] } = useSalaryPayGrades(companyId);
  const { data: salaryRanges = [], refetch: refetchRanges } = useSalaryRanges(companyId);
  const { data: packages = [] } = useEmployeeCompensationPackages(companyId);
  const { data: changeRequests = [] } = useCompensationChangeRequests(companyId, statusFilter);
  const { data: reviewCycles = [], refetch: refetchCycles } = useCompensationReviewCycles(companyId);
  const { data: benefitPlans = [] } = useBenefitPlans(companyId);
  const { data: enrollments = [] } = useBenefitEnrollments(companyId);

  // Mutations
  const approveChangeMutation = useApproveSalaryChangeRequest();
  const finalizeCycleMutation = useFinalizeCompensationReview();
  const generateStatementMutation = useGenerateTotalRewardsStatement();

  // Employee list mapped for selectors
  const formattedEmployees = useMemo(() => {
    return employees.map((e: any) => ({
      id: e.id,
      name: `${e.firstNameAr || ""} ${e.lastNameAr || ""}`.trim() || e.name || "موظف",
      employeeNo: e.employeeNo || e.employee_number || "EMP-001",
      basicSalary: Number(e.basicSalary || e.basic_salary || 0),
    }));
  }, [employees]);

  const handleApproveChange = async (requestId: string) => {
    try {
      await approveChangeMutation.mutateAsync({
        companyId,
        requestId,
        applyImmediately: true,
      });
      toast.success("تم اعتماد وتطبيق طلب تعديل الراتب بنجاح");
    } catch (err: any) {
      toast.error(err.message || "فشل اعتماد الطلب");
    }
  };

  const handleFinalizeCycle = async (cycleId: string) => {
    try {
      await finalizeCycleMutation.mutateAsync({
        companyId,
        cycleId,
      });
      toast.success("تم اعتماد وتطبيق نتائج دورة مراجعة الرواتب في ملفات الموظفين بنجاح");
      refetchCycles();
    } catch (err: any) {
      toast.error(err.message || "فشل إغلاق الدورة");
    }
  };

  const handleOpenStatement = async (emp: { id: string; name: string; no: string }) => {
    setSelectedStatementEmp(emp);
    try {
      await generateStatementMutation.mutateAsync({
        companyId,
        employeeId: emp.id,
      });
      setStatementModalOpen(true);
    } catch (err: any) {
      toast.error(err.message || "فشل توليد كشف المكافآت");
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6 pb-16">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-black text-foreground flex items-center gap-2.5">
              <DollarSign className="h-7 w-7 text-primary" />
              التعويضات والمزايا والمكافآت الشاملة (Compensation & Total Rewards)
            </h1>
            <Badge className="text-[11px] font-bold border-emerald-500/30 text-emerald-600 bg-emerald-500/10 rounded-full px-2.5 py-0.5">
              شاشة العمليات وحزم رواتب الموظفين
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            إدارة هياكل ونطاقات الرواتب، البدلات، حزم التعويضات المؤرخة، دورات مراجعة الرواتب السنوية، والمزايا المؤسسية.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate({ to: "/setup?tab=compensation_setup" as any })}
            className="gap-1.5 border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
          >
            <Settings className="h-4 w-4" />
            تهيئة سلالم الرواتب والمزايا
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setStructureModalOpen(true)}
            className="gap-1.5"
          >
            <Layers className="h-4 w-4" />
            هيكل ونطاقات الرواتب
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setReviewCycleModalOpen(true)}
            className="gap-1.5"
          >
            <Calendar className="h-4 w-4" />
            إطلاق دورة مراجعة
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setBenefitEnrollmentModalOpen(true)}
            className="gap-1.5"
          >
            <Gift className="h-4 w-4" />
            تسجيل مزايا
          </Button>

          <Button
            size="sm"
            onClick={() => setSalaryChangeModalOpen(true)}
            className="gap-1.5 shadow-sm"
          >
            <Plus className="h-4 w-4" />
            طلب تعديل راتب
          </Button>
        </div>
      </div>

      {/* KPI Stats Bar (8 Cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <div className="p-3.5 rounded-xl border bg-card shadow-xs">
          <span className="text-[11px] font-bold text-muted-foreground block truncate">إجمالي مسير الرواتب</span>
          <h4 className="text-lg font-black text-foreground mt-0.5 font-mono truncate">
            {kpis?.total_base_payroll?.toLocaleString() ?? 0}
          </h4>
          <span className="text-[10px] text-muted-foreground font-semibold">ريال شهرياً</span>
        </div>

        <div className="p-3.5 rounded-xl border bg-card shadow-xs">
          <span className="text-[11px] font-bold text-muted-foreground block truncate">متوسط الراتب</span>
          <h4 className="text-lg font-black text-foreground mt-0.5 font-mono truncate">
            {kpis?.average_salary?.toLocaleString() ?? 0}
          </h4>
          <span className="text-[10px] text-muted-foreground font-semibold">ريال / موظف</span>
        </div>

        <div className="p-3.5 rounded-xl border bg-card shadow-xs">
          <span className="text-[11px] font-bold text-muted-foreground block truncate">الموظفون المشمولون</span>
          <h4 className="text-lg font-black text-foreground mt-0.5 font-mono">
            {kpis?.total_active_employees ?? 0}
          </h4>
          <span className="text-[10px] text-emerald-600 font-semibold">على رأس العمل</span>
        </div>

        <div className="p-3.5 rounded-xl border bg-card shadow-xs">
          <span className="text-[11px] font-bold text-muted-foreground block truncate">متوسط Compa-Ratio</span>
          <h4 className="text-lg font-black text-foreground mt-0.5 font-mono text-primary">
            {kpis?.average_compa_ratio ?? 100}%
          </h4>
          <span className="text-[10px] text-muted-foreground font-semibold">معدل التنافسية</span>
        </div>

        <div className="p-3.5 rounded-xl border bg-card shadow-xs">
          <span className="text-[11px] font-bold text-muted-foreground block truncate">أقل من النطاق</span>
          <h4 className="text-lg font-black text-amber-600 mt-0.5 font-mono">
            {kpis?.below_range_count ?? 0}
          </h4>
          <span className="text-[10px] text-amber-600 font-semibold">يحتاج تعديل سوقي</span>
        </div>

        <div className="p-3.5 rounded-xl border bg-card shadow-xs">
          <span className="text-[11px] font-bold text-muted-foreground block truncate">أعلى من النطاق</span>
          <h4 className="text-lg font-black text-rose-600 mt-0.5 font-mono">
            {kpis?.above_range_count ?? 0}
          </h4>
          <span className="text-[10px] text-rose-600 font-semibold">استثناء معتمد</span>
        </div>

        <div className="p-3.5 rounded-xl border bg-card shadow-xs">
          <span className="text-[11px] font-bold text-muted-foreground block truncate">خطط المزايا النشطة</span>
          <h4 className="text-lg font-black text-indigo-600 mt-0.5 font-mono">
            {kpis?.active_benefit_plans ?? 0}
          </h4>
          <span className="text-[10px] text-muted-foreground font-semibold">تأمين وبرامج</span>
        </div>

        <div className="p-3.5 rounded-xl border bg-card shadow-xs">
          <span className="text-[11px] font-bold text-muted-foreground block truncate">طلبات التعديل</span>
          <h4 className="text-lg font-black text-foreground mt-0.5 font-mono">
            {kpis?.open_change_requests ?? 0}
          </h4>
          <span className="text-[10px] text-blue-600 font-semibold">قيد المراجعة</span>
        </div>
      </div>

      {/* Main Tabs Container */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted/70 p-1 rounded-xl flex-wrap h-auto">
          <TabsTrigger value="overview" className="gap-1.5 text-xs py-2">
            <TrendingUp className="h-3.5 w-3.5" />
            نظرة عامة
          </TabsTrigger>
          <TabsTrigger value="salary_ranges" className="gap-1.5 text-xs py-2">
            <Layers className="h-3.5 w-3.5" />
            نطاقات الرواتب ({salaryRanges.length})
          </TabsTrigger>
          <TabsTrigger value="packages" className="gap-1.5 text-xs py-2">
            <Users className="h-3.5 w-3.5" />
            حزم الموظفين ({packages.length})
          </TabsTrigger>
          <TabsTrigger value="change_requests" className="gap-1.5 text-xs py-2">
            <CheckCircle2 className="h-3.5 w-3.5" />
            طلبات التعديل ({changeRequests.length})
          </TabsTrigger>
          <TabsTrigger value="review_cycles" className="gap-1.5 text-xs py-2">
            <Calendar className="h-3.5 w-3.5" />
            دورات المراجعة السنوية ({reviewCycles.length})
          </TabsTrigger>
          <TabsTrigger value="benefits" className="gap-1.5 text-xs py-2">
            <Gift className="h-3.5 w-3.5" />
            المزايا والتأمين ({benefitPlans.length})
          </TabsTrigger>
          <TabsTrigger value="total_rewards" className="gap-1.5 text-xs py-2">
            <Award className="h-3.5 w-3.5" />
            المكافآت الشاملة (Total Rewards)
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Overview */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Quick Summary Card */}
            <div className="p-5 rounded-2xl border bg-card space-y-4">
              <h3 className="font-black text-base flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                حوكمة الرواتب والامتثال المالي (Governance & Compliance)
              </h3>
              <p className="text-sm text-muted-foreground">
                محرك التعويضات في مدار إكس يضمن التاريخية الكاملة والتأريخ الساري (Effective Dating) لجميع حزم الرواتب، بحيث لا يتم استبدال السجلات التاريخية أبداً وتخضع كافة الزيادات لمسارات موافقة إلكترونية موثقة.
              </p>
              <div className="grid grid-cols-2 gap-3 pt-2 text-sm">
                <div className="p-3 bg-secondary/40 rounded-lg">
                  <span className="text-xs text-muted-foreground block">الدرجات الوظيفية المعتمدة</span>
                  <span className="font-bold text-foreground mt-1 block">{payGrades.length} درجات</span>
                </div>
                <div className="p-3 bg-secondary/40 rounded-lg">
                  <span className="text-xs text-muted-foreground block">التسجيل في المزايا الطبية</span>
                  <span className="font-bold text-emerald-600 mt-1 block">{enrollments.length} موظف مسجل</span>
                </div>
              </div>
            </div>

            {/* Merit Planning Action Card */}
            <div className="p-5 rounded-2xl border bg-gradient-to-br from-primary/5 via-card to-secondary/20 space-y-4">
              <h3 className="font-black text-base flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                دورات مراجعة الرواتب والاستحقاق (Merit Cycles)
              </h3>
              <p className="text-sm text-muted-foreground">
                إتاحة مراجعات الأداء السنوية لربط نتائج التقييم بمصفوفة الاستحقاق (Merit Matrix) واحتساب التوصيات بناءً على نسبة Compa-Ratio والميزانية المرصودة لكل إدارة.
              </p>
              <div className="flex gap-2 pt-2">
                <Button size="sm" onClick={() => setReviewCycleModalOpen(true)}>
                  إطلاق دورة مراجعة جديدة
                </Button>
                <Button size="sm" variant="outline" onClick={() => setActiveTab("change_requests")}>
                  استعراض الطلبات المعلقة
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: Salary Ranges & Pay Bands */}
        <TabsContent value="salary_ranges" className="space-y-4">
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
                <Settings className="h-4.5 w-4.5 text-amber-600" />
              </div>
              <div>
                <h4 className="text-xs font-black text-foreground">تهيئة سلالم ونطاقات الرواتب المركزية</h4>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                  لضبط الدرجات الوظيفية، نطاقات الرواتب (Min/Mid/Max)، وكتالوج خطط المزايا من مركز التهيئة الموحد للمنشأة:
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate({ to: "/setup?tab=compensation_setup" as any })}
              className="h-8 text-[11px] font-bold rounded-xl gap-1.5 border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300 hover:bg-amber-500/20 shrink-0"
            >
              <Settings className="h-3.5 w-3.5" />
              فتح شاشة تهيئة سلالم الرواتب
            </Button>
          </div>
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-bold text-base">نطاقات الرواتب وهيكل الدرجات الوظيفية</h3>
              <p className="text-xs text-muted-foreground">الحد الأدنى ونقطة المنتصف والحد الأقصى لكل درجة وظيفية</p>
            </div>
            <Button size="sm" onClick={() => setStructureModalOpen(true)} className="gap-1.5">
              <Plus className="h-4 w-4" />
              إضافة نطاق جديد
            </Button>
          </div>

          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right">
                <thead className="bg-muted/50 text-xs text-muted-foreground border-b font-medium">
                  <tr>
                    <th className="p-3.5">الدرجة الوظيفية</th>
                    <th className="p-3.5">المسار المهني</th>
                    <th className="p-3.5">الحد الأدنى (Min)</th>
                    <th className="p-3.5">نقطة المنتصف (Mid)</th>
                    <th className="p-3.5">الحد الأقصى (Max)</th>
                    <th className="p-3.5">اتساع النطاق (Spread)</th>
                    <th className="p-3.5">تاريخ السريان</th>
                    <th className="p-3.5">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {salaryRanges.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-muted-foreground">
                        لا توجد نطاقات رواتب مسجلة حتى الآن. انقر على &quot;إضافة نطاق جديد&quot; للبدء.
                      </td>
                    </tr>
                  ) : (
                    salaryRanges.map((range) => (
                      <tr key={range.id} className="hover:bg-muted/20">
                        <td className="p-3.5 font-bold text-foreground">
                          {range.pay_grade?.code || "G-01"} — {range.pay_grade?.name_ar || "الدرجة الوظيفية"}
                        </td>
                        <td className="p-3.5 text-xs text-muted-foreground">
                          {range.pay_grade?.career_track || "مهني وتخصصي"}
                        </td>
                        <td className="p-3.5 font-mono font-bold text-foreground">
                          {range.minimum_salary.toLocaleString()} {range.currency}
                        </td>
                        <td className="p-3.5 font-mono font-bold text-primary">
                          {range.midpoint_salary.toLocaleString()} {range.currency}
                        </td>
                        <td className="p-3.5 font-mono font-bold text-foreground">
                          {range.maximum_salary.toLocaleString()} {range.currency}
                        </td>
                        <td className="p-3.5 text-xs font-semibold text-muted-foreground">
                          {range.spread_percentage || 50}%
                        </td>
                        <td className="p-3.5 text-xs font-mono text-muted-foreground">
                          {range.effective_from}
                        </td>
                        <td className="p-3.5">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 font-semibold">
                            نشط معتمد
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* Tab 3: Employee Compensation Packages */}
        <TabsContent value="packages" className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="h-4 w-4 absolute right-3 top-2.5 text-muted-foreground" />
              <Input
                placeholder="بحث بالاسم أو الرقم الوظيفي..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-9 text-sm"
              />
            </div>
            <Button size="sm" onClick={() => setSalaryChangeModalOpen(true)} className="gap-1.5">
              <Plus className="h-4 w-4" />
              طلب تعديل راتب موظف
            </Button>
          </div>

          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right">
                <thead className="bg-muted/50 text-xs text-muted-foreground border-b font-medium">
                  <tr>
                    <th className="p-3.5">الموظف</th>
                    <th className="p-3.5">الإصدار (Version)</th>
                    <th className="p-3.5">الراتب الأساسي</th>
                    <th className="p-3.5">إجمالي الراتب</th>
                    <th className="p-3.5">Compa-Ratio</th>
                    <th className="p-3.5">موقع النطاق</th>
                    <th className="p-3.5">تاريخ السريان</th>
                    <th className="p-3.5">الحالة</th>
                    <th className="p-3.5">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {packages.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-muted-foreground">
                        لا توجد حزم تعويضات مسجلة بعد. يتم توليد الحزم تلقائياً عند التوظيف أو الترقية.
                      </td>
                    </tr>
                  ) : (
                    packages
                      .filter((p) =>
                        searchQuery
                          ? (p.employee_name_ar && p.employee_name_ar.includes(searchQuery)) ||
                            (p.employee_number && p.employee_number.includes(searchQuery))
                          : true
                      )
                      .map((pkg) => (
                        <tr key={pkg.id} className="hover:bg-muted/20">
                          <td className="p-3.5">
                            <span className="font-bold text-foreground block">
                              {pkg.employee_name_ar || "موظف"}
                            </span>
                            <span className="text-xs text-muted-foreground font-mono">
                              {pkg.employee_number}
                            </span>
                          </td>
                          <td className="p-3.5 font-mono text-xs font-bold text-muted-foreground">
                            v{pkg.package_version}
                          </td>
                          <td className="p-3.5 font-mono font-bold text-foreground">
                            {pkg.basic_salary.toLocaleString()} {pkg.currency}
                          </td>
                          <td className="p-3.5 font-mono font-bold text-emerald-600">
                            {pkg.total_gross_salary.toLocaleString()} {pkg.currency}
                          </td>
                          <td className="p-3.5 font-mono font-bold text-primary">
                            {pkg.compa_ratio ? `${pkg.compa_ratio}%` : "100%"}
                          </td>
                          <td className="p-3.5">
                            <span
                              className={`text-xs px-2 py-0.5 rounded border font-semibold ${
                                RANGE_STATUS_LABELS_AR[pkg.range_status]?.color || ""
                              }`}
                            >
                              {RANGE_STATUS_LABELS_AR[pkg.range_status]?.label || "ضمن النطاق"}
                            </span>
                          </td>
                          <td className="p-3.5 text-xs font-mono text-muted-foreground">
                            {pkg.effective_from}
                          </td>
                          <td className="p-3.5">
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                                pkg.status === "active"
                                  ? "bg-emerald-500/10 text-emerald-600"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {pkg.status === "active" ? "ساري ومعتمد" : "سابق ومؤرشف"}
                            </span>
                          </td>
                          <td className="p-3.5">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                handleOpenStatement({
                                  id: pkg.employee_id,
                                  name: pkg.employee_name_ar || "",
                                  no: pkg.employee_number || "",
                                })
                              }
                              className="gap-1 text-xs"
                            >
                              <FileText className="h-3.5 w-3.5" />
                              كشف المكافآت
                            </Button>
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* Tab 4: Salary Change Requests */}
        <TabsContent value="change_requests" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-bold text-base">طلبات تعديل وزيادة الرواتب (Change Requests)</h3>
              <p className="text-xs text-muted-foreground">مراجعة وتدقيق واعتماد زيادات الرواتب الخاضعة للحوكمة</p>
            </div>
            <Button size="sm" onClick={() => setSalaryChangeModalOpen(true)} className="gap-1.5">
              <Plus className="h-4 w-4" />
              طلب جديد
            </Button>
          </div>

          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right">
                <thead className="bg-muted/50 text-xs text-muted-foreground border-b font-medium">
                  <tr>
                    <th className="p-3.5">رقم الطلب</th>
                    <th className="p-3.5">الموظف</th>
                    <th className="p-3.5">سبب التعديل</th>
                    <th className="p-3.5">الراتب الحالي</th>
                    <th className="p-3.5">المقترح</th>
                    <th className="p-3.5">الزيادة (%)</th>
                    <th className="p-3.5">Compa-Ratio</th>
                    <th className="p-3.5">الحالة</th>
                    <th className="p-3.5">إجراءات الاعتماد</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {changeRequests.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-muted-foreground">
                        لا توجد طلبات تعديل رواتب حالياً.
                      </td>
                    </tr>
                  ) : (
                    changeRequests.map((req) => (
                      <tr key={req.id} className="hover:bg-muted/20">
                        <td className="p-3.5 font-mono text-xs font-bold text-primary">
                          {req.request_number}
                        </td>
                        <td className="p-3.5 font-bold text-foreground">
                          {req.employee_name_ar}
                        </td>
                        <td className="p-3.5 text-xs text-muted-foreground">
                          {REASON_LABELS_AR[req.reason] || req.reason}
                        </td>
                        <td className="p-3.5 font-mono text-xs text-muted-foreground">
                          {req.current_basic.toLocaleString()} ر.س
                        </td>
                        <td className="p-3.5 font-mono font-bold text-foreground">
                          {req.proposed_basic.toLocaleString()} ر.س
                        </td>
                        <td className="p-3.5 font-mono font-bold text-emerald-600">
                          +{req.increase_percentage}%
                        </td>
                        <td className="p-3.5 font-mono text-xs">
                          {req.proposed_compa_ratio ? `${req.proposed_compa_ratio}%` : "100%"}
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                              req.status === "applied"
                                ? "bg-emerald-500/10 text-emerald-600"
                                : req.status === "submitted"
                                ? "bg-blue-500/10 text-blue-600"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {req.status === "applied"
                              ? "مطبق بالراتب"
                              : req.status === "submitted"
                              ? "قيد المراجعة"
                              : req.status}
                          </span>
                        </td>
                        <td className="p-3.5">
                          {req.status === "submitted" && (
                            <Button
                              size="sm"
                              onClick={() => handleApproveChange(req.id)}
                              disabled={approveChangeMutation.isPending}
                              className="text-xs h-7 gap-1"
                            >
                              اعتماد وتطبيق
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* Tab 5: Compensation Review Cycles */}
        <TabsContent value="review_cycles" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-bold text-base">دورات مراجعة الرواتب السنوية (Merit Review Cycles)</h3>
              <p className="text-xs text-muted-foreground">تخطيط الميزانيات واعتماد الزيادات السنوية وتطبيقها آلياً</p>
            </div>
            <Button size="sm" onClick={() => setReviewCycleModalOpen(true)} className="gap-1.5">
              <Plus className="h-4 w-4" />
              إطلاق دورة مراجعة
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {reviewCycles.length === 0 ? (
              <div className="col-span-full p-8 text-center text-muted-foreground border rounded-xl bg-card">
                لا توجد دورات مراجعة رواتب مفتوحة. انقر على &quot;إطلاق دورة مراجعة&quot; لبدء التخطيط السنوي.
              </div>
            ) : (
              reviewCycles.map((cycle) => (
                <div key={cycle.id} className="p-4 rounded-xl border bg-card space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-mono text-xs font-bold text-primary">{cycle.cycle_code}</span>
                      <h4 className="font-bold text-foreground text-base mt-0.5">{cycle.name_ar}</h4>
                    </div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-semibold ${
                        REVIEW_CYCLE_STATUS_LABELS_AR[cycle.status]?.color || ""
                      }`}
                    >
                      {REVIEW_CYCLE_STATUS_LABELS_AR[cycle.status]?.label || cycle.status}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-muted-foreground border-t pt-2">
                    <div className="flex justify-between">
                      <span>الميزانية المرصودة:</span>
                      <span className="font-mono font-bold text-foreground">
                        {cycle.allocated_budget.toLocaleString()} {cycle.currency}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>الموظفون المؤهلون:</span>
                      <span className="font-bold text-foreground">{cycle.total_eligible_employees} موظف</span>
                    </div>
                    <div className="flex justify-between">
                      <span>تاريخ سريان الزيادات:</span>
                      <span className="font-mono text-foreground">{cycle.effective_date}</span>
                    </div>
                  </div>

                  {cycle.status === "open" && (
                    <div className="pt-2 border-t">
                      <Button
                        size="sm"
                        onClick={() => handleFinalizeCycle(cycle.id)}
                        disabled={finalizeCycleMutation.isPending}
                        className="w-full text-xs"
                      >
                        اعتماد وتطبيق نتائج الدورة في الرواتب
                      </Button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </TabsContent>

        {/* Tab 6: Benefits Catalog & Plans */}
        <TabsContent value="benefits" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-bold text-base">كتالوج المزايا والتأمين الطبي (Benefits Catalog)</h3>
              <p className="text-xs text-muted-foreground">خطط الرعاية الصحية والمزايا العينية والتسجيلات المعتمدة</p>
            </div>
            <Button size="sm" onClick={() => setBenefitEnrollmentModalOpen(true)} className="gap-1.5">
              <Plus className="h-4 w-4" />
              تسجيل موظف جديد
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {benefitPlans.map((plan) => (
              <div key={plan.id} className="p-4 rounded-xl border bg-card space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-bold text-primary uppercase tracking-wider block">
                      {plan.category?.name_ar || "مزايا مؤسسية"}
                    </span>
                    <h4 className="font-bold text-foreground text-base mt-0.5">{plan.name_ar}</h4>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary font-bold uppercase">
                    {plan.tier_level}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-muted-foreground border-t pt-2">
                  <div className="flex justify-between">
                    <span>مساهمة المنشأة الشهرية:</span>
                    <span className="font-mono font-bold text-emerald-600">
                      {plan.employer_monthly_cost.toLocaleString()} ر.س
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>استقطاع الموظف الشهري:</span>
                    <span className="font-mono font-bold text-foreground">
                      {plan.employee_monthly_cost.toLocaleString()} ر.س
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>تغطية أفراد الأسرة:</span>
                    <span className="font-semibold text-foreground">
                      {plan.dependent_coverage_allowed ? "مسموحة" : "غير متاحة"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Tab 7: Total Rewards Statements */}
        <TabsContent value="total_rewards" className="space-y-4">
          <div className="p-4 rounded-xl border bg-card space-y-3">
            <h3 className="font-bold text-base">كشوفات المكافآت الشاملة للموظفين (Total Rewards Statements)</h3>
            <p className="text-sm text-muted-foreground">
              اختر الموظف لاستعراض وطباعة بيان القيمة الإجمالية المستثمرة لصاحب العمل (Total Employer Value)، شاملاً الراتب الأساسي والبدلات والمكافآت وتكاليف التأمين وحصة صاحب العمل في التأمينات الاجتماعية.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
              {formattedEmployees.slice(0, 12).map((emp) => (
                <div
                  key={emp.id}
                  className="p-3 rounded-lg border bg-secondary/20 hover:bg-secondary/40 flex items-center justify-between transition-colors"
                >
                  <div>
                    <span className="font-bold text-sm text-foreground block">{emp.name}</span>
                    <span className="text-xs text-muted-foreground font-mono">{emp.employeeNo}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      handleOpenStatement({
                        id: emp.id,
                        name: emp.name,
                        no: emp.employeeNo,
                      })
                    }
                    className="gap-1 text-xs"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    عرض الكشف
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <CreateSalaryChangeModal
        open={salaryChangeModalOpen}
        onOpenChange={setSalaryChangeModalOpen}
        companyId={companyId}
        employees={formattedEmployees}
      />

      <CreateStructureModal
        open={structureModalOpen}
        onOpenChange={setStructureModalOpen}
        companyId={companyId}
        onSuccess={refetchRanges}
      />

      <ReviewCycleModal
        open={reviewCycleModalOpen}
        onOpenChange={setReviewCycleModalOpen}
        companyId={companyId}
        onSuccess={refetchCycles}
      />

      <BenefitEnrollmentModal
        open={benefitEnrollmentModalOpen}
        onOpenChange={setBenefitEnrollmentModalOpen}
        companyId={companyId}
        employees={formattedEmployees}
        onSuccess={() => {}}
      />

      {selectedStatementEmp && (
        <TotalRewardsStatementModal
          open={statementModalOpen}
          onOpenChange={setStatementModalOpen}
          companyId={companyId}
          employeeId={selectedStatementEmp.id}
          employeeName={selectedStatementEmp.name}
          employeeNo={selectedStatementEmp.no}
        />
      )}
    </div>
  );
}
