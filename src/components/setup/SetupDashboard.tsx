import React, { useMemo, useState } from "react";
import { useApp } from "../../lib/context/AppContext";
import { canManageModule } from "../../lib/auth/permissions";
import { useNavigate } from "@tanstack/react-router";
import {
  Building2,
  Network,
  MapPin,
  Clock,
  CalendarCheck,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  RefreshCw,
  Sparkles,
  Layers,
  Plus,
  Wallet,
  DollarSign,
  Receipt,
  UserPlus,
  BookOpen,
  Target,
  GraduationCap,
  Smile,
  Bot,
  UserCheck,
} from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { CompanyProfilePanel } from "../organization/CompanyProfilePanel";
import { OrganizationView } from "../organization/OrganizationView";
import { ShiftDefinitionsSetupPanel } from "./ShiftDefinitionsSetupPanel";
import { LeavePoliciesSetupPanel } from "./LeavePoliciesSetupPanel";
import { UserCompanyAccessPanel } from "./UserCompanyAccessPanel";
import { AttendancePolicySetupPanel } from "./AttendancePolicySetupPanel";
import { PayrollStatutorySetupPanel } from "./PayrollStatutorySetupPanel";
import { WorkflowChainsSetupPanel } from "./WorkflowChainsSetupPanel";
import { CompensationSetupPanel } from "./CompensationSetupPanel";
import { ExpensesPolicySetupPanel } from "./ExpensesPolicySetupPanel";
import { OnboardingProbationSetupPanel } from "./OnboardingProbationSetupPanel";
import { AssetsDocumentsSetupPanel } from "./AssetsDocumentsSetupPanel";
import { PerformanceTalentSetupPanel } from "./PerformanceTalentSetupPanel";
import { LearningErSetupPanel } from "./LearningErSetupPanel";
import { RecruitmentSetupPanel } from "./RecruitmentSetupPanel";
import { EngagementSetupPanel } from "./EngagementSetupPanel";
import { AiGovernanceSetupPanel } from "./AiGovernanceSetupPanel";
import { calculateSetupProgress } from "../../lib/domains/setup/setup-progress";
import { toast } from "sonner";

export const SetupDashboard: React.FC = () => {
  const {
    company,
    orgUnits,
    workLocations,
    costCenters,
    jobPositions,
    shifts,
    leaveTypes,
    currentRole,
    refreshCoreData,
  } = useApp();

  const navigate = useNavigate();
  const canManage = canManageModule(currentRole, "setup");
  const [activeSetupTab, setActiveSetupTab] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab");
      if (
        tabParam &&
        [
          "overview",
          "company",
          "org",
          "shifts",
          "leaves",
          "users",
          "attendance_policy",
          "payroll_statutory",
          "workflows",
          "compensation_setup",
          "expenses_setup",
          "onboarding_setup",
          "assets_docs_setup",
          "performance_talent_setup",
          "learning_er_setup",
          "recruitment_setup",
          "engagement_setup",
          "ai_governance",
        ].includes(tabParam)
      ) {
        return tabParam;
      }
    }
    return "overview";
  });
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleTabChange = (newTab: string) => {
    setActiveSetupTab(newTab);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", newTab);
      window.history.replaceState({}, "", url.toString());
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshCoreData();
      toast.success("تم تحديث حالة التهيئة بنجاح");
    } catch {
      toast.error("حدث خطأ أثناء تحديث البيانات");
    } finally {
      setIsRefreshing(false);
    }
  };

  // Unified domain progress calculation
  const progress = useMemo(() => {
    return calculateSetupProgress({
      company,
      orgUnits,
      workLocations,
      costCenters,
      jobPositions,
      shifts,
      leaveTypes,
    });
  }, [company, orgUnits, workLocations, costCenters, jobPositions, shifts, leaveTypes]);

  const companyName = company?.legalNameAr || "الأندلس";

  return (
    <div className="space-y-6 pb-12" dir="rtl">
      {/* Top Header Card */}
      <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-card p-6 md:p-8 shadow-xs">
        <div className="absolute top-0 end-0 h-48 w-48 bg-primary/5 rounded-full blur-3xl -z-10 pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold shadow-xs">
                <Building2 className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl md:text-2xl font-black text-foreground">
                    تهيئة النظام — شركة «{companyName}»
                  </h1>
                  <Badge
                    variant={progress.isFullyConfigured ? "default" : "secondary"}
                    className="rounded-full text-xs font-bold"
                  >
                    {progress.isFullyConfigured ? "مكتمل الجاهزية" : "قيد الاستكمال"}
                  </Badge>
                </div>
                <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
                  إعداد الملف المؤسسي، الهيكل الإداري، ومقار العمل وقواعد التشغيل لشركة الأندلس بصورة معزولة عن العمليات اليومية.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="rounded-full text-xs font-bold gap-1.5 h-10 px-4 cursor-pointer"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin text-primary" : ""}`} />
              تحديث الحالة
            </Button>
            <Button
              size="sm"
              onClick={() => navigate({ to: "/dashboard" })}
              className="rounded-full text-xs font-bold gap-1.5 bg-secondary text-secondary-foreground hover:bg-secondary/80 h-10 px-4 cursor-pointer"
            >
              الانتقال للعمليات
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Progress Metric Bar */}
        <div className="mt-8 space-y-3 rounded-2xl bg-muted/40 p-5 border border-border/60">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="flex items-center gap-1.5 text-foreground">
              <Sparkles className="h-4 w-4 text-amber-500" />
              نسبة جاهزية التهيئة العامة للنظام
            </span>
            <span className="font-mono text-sm font-black text-primary">
              {progress.percentage}%
            </span>
          </div>

          <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-500 transition-all duration-500"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>

          {progress.missingFields.length > 0 && (
            <div className="pt-2 text-[11px] text-muted-foreground">
              <span className="font-bold text-amber-600">المتطلبات المتبقية: </span>
              {progress.missingFields.join(" • ")}
            </div>
          )}
        </div>
      </div>

      {/* Tabs Navigation */}
      <Tabs value={activeSetupTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="classera-tabs-strip max-w-4xl flex-wrap h-auto p-1.5 gap-1">
          <TabsTrigger value="overview" className="rounded-xl text-xs font-bold py-2 px-3.5">
            لوحة المتابعة العامة
          </TabsTrigger>
          <TabsTrigger value="company" className="rounded-xl text-xs font-bold py-2 px-3.5">
            1. بيانات المنشأة والسجل
          </TabsTrigger>
          <TabsTrigger value="org" className="rounded-xl text-xs font-bold py-2 px-3.5">
            2. الهيكل والمقار
          </TabsTrigger>
          <TabsTrigger value="shifts" className="rounded-xl text-xs font-bold py-2 px-3.5">
            3. الورديات وساعات العمل
          </TabsTrigger>
          <TabsTrigger value="leaves" className="rounded-xl text-xs font-bold py-2 px-3.5">
            4. سياسات الإجازات
          </TabsTrigger>
          <TabsTrigger value="users" className="rounded-xl text-xs font-bold py-2 px-3.5">
            5. حوكمة ربط المستخدمين
          </TabsTrigger>
          <TabsTrigger value="attendance_policy" className="rounded-xl text-xs font-bold py-2 px-3.5">
            6. سياسات الدوام ونظام العمل
          </TabsTrigger>
          <TabsTrigger value="payroll_statutory" className="rounded-xl text-xs font-bold py-2 px-3.5">
            7. الرواتب والحزم النظامية
          </TabsTrigger>
          <TabsTrigger value="workflows" className="rounded-xl text-xs font-bold py-2 px-3.5">
            8. مسارات الاعتماد والتفويض
          </TabsTrigger>
          <TabsTrigger value="compensation_setup" className="rounded-xl text-xs font-bold py-2 px-3.5">
            9. سلالم الرواتب والمزايا
          </TabsTrigger>
          <TabsTrigger value="expenses_setup" className="rounded-xl text-xs font-bold py-2 px-3.5">
            10. فئات وسياسات النفقات
          </TabsTrigger>
          <TabsTrigger value="onboarding_setup" className="rounded-xl text-xs font-bold py-2 px-3.5">
            11. قوالب المباشرة والتجربة
          </TabsTrigger>
          <TabsTrigger value="assets_docs_setup" className="rounded-xl text-xs font-bold py-2 px-3.5">
            12. اللوائح وتصنيفات العهد
          </TabsTrigger>
          <TabsTrigger value="performance_talent_setup" className="rounded-xl text-xs font-bold py-2 px-3.5">
            13. دورات الأداء ومسارات المواهب
          </TabsTrigger>
          <TabsTrigger value="learning_er_setup" className="rounded-xl text-xs font-bold py-2 px-3.5">
            14. التدريب الإلزامي ولائحة التحقيقات
          </TabsTrigger>
          <TabsTrigger value="recruitment_setup" className="rounded-xl text-xs font-bold py-2 px-3.5">
            15. التوظيف وبنك المواهب
          </TabsTrigger>
          <TabsTrigger value="engagement_setup" className="rounded-xl text-xs font-bold py-2 px-3.5">
            16. سرية الاستبيانات والتقدير
          </TabsTrigger>
          <TabsTrigger value="ai_governance" className="rounded-xl text-xs font-bold py-2 px-3.5">
            17. حوكمة وسياسات الذكاء الاصطناعي
          </TabsTrigger>
        </TabsList>

        {/* ===================== TAB 1: OVERVIEW STAGES ===================== */}
        <TabsContent value="overview" className="space-y-6 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Step 1: Company Profile */}
            <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs hover:border-primary/40 transition-all flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-foreground">1. بيانات شركة «الأندلس»</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">الاسم والسجل التجاري</p>
                    </div>
                  </div>
                  <Badge
                    variant={company?.crNumber ? "default" : "secondary"}
                    className="rounded-full text-[10px] font-bold"
                  >
                    {company?.crNumber ? "مكتمل" : "يتطلب استكمال"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  الاسم بالعربية مثبت كـ «الأندلس». يجب إدخال رقم السجل التجاري المعتمد لإثبات التأسيس.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-border/60 flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleTabChange("company")}
                  className="rounded-full text-xs font-bold gap-1.5 cursor-pointer"
                >
                  استكمال البيانات
                  <ArrowLeft className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Step 2: Org Structure */}
            <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs hover:border-primary/40 transition-all flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-2xl flex items-center justify-center font-bold ${
                      orgUnits.length > 0 ? "bg-emerald-500/10 text-emerald-600" : "bg-slate-500/10 text-slate-600"
                    }`}>
                      <Network className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-foreground">2. الهيكل التنظيمي</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">الأقسام: {orgUnits.length}</p>
                    </div>
                  </div>
                  <Badge
                    variant={orgUnits.length > 0 ? "default" : "secondary"}
                    className="rounded-full text-[10px] font-bold"
                  >
                    {orgUnits.length > 0 ? "مُعرّف" : "فارغ"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {orgUnits.length > 0
                    ? `تم بناء ${orgUnits.length} وحدة تنظيمية في الهيكل المعتمد.`
                    : "لم تتم إضافة أقسام بعد — يضيف المسؤول الأقسام الحقيقية دون افتراض أي بيانات وهمية."}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-border/60 flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleTabChange("org")}
                  className="rounded-full text-xs font-bold gap-1.5 cursor-pointer"
                >
                  إدارة الهيكل التنظيمي
                  <ArrowLeft className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Step 3: Work Locations */}
            <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs hover:border-primary/40 transition-all flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-2xl flex items-center justify-center font-bold ${
                      workLocations.length > 0 ? "bg-emerald-500/10 text-emerald-600" : "bg-slate-500/10 text-slate-600"
                    }`}>
                      <MapPin className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-foreground">3. مقار العمل ومراكز التكلفة</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">المواقع: {workLocations.length}</p>
                    </div>
                  </div>
                  <Badge
                    variant={workLocations.length > 0 ? "default" : "secondary"}
                    className="rounded-full text-[10px] font-bold"
                  >
                    {workLocations.length > 0 ? "مُعرّف" : "فارغ"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {workLocations.length > 0
                    ? `تم تعريف ${workLocations.length} موقع جغرافي وسياج حضور ذكي.`
                    : "يلزم تحديد المقر الرئيسي والفروع مع نطاق الـ GPS لتفعيل تحضير الموظفين."}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-border/60 flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleTabChange("org")}
                  className="rounded-full text-xs font-bold gap-1.5 cursor-pointer"
                >
                  إضافة وإدارة مقار العمل
                  <ArrowLeft className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Step 4: Shifts */}
            <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs hover:border-primary/40 transition-all flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-2xl flex items-center justify-center font-bold ${
                      shifts.length > 0 ? "bg-emerald-500/10 text-emerald-600" : "bg-slate-500/10 text-slate-600"
                    }`}>
                      <Clock className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-foreground">4. سياسات وورديات العمل</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">الورديات: {shifts.length}</p>
                    </div>
                  </div>
                  <Badge
                    variant={shifts.length > 0 ? "default" : "secondary"}
                    className="rounded-full text-[10px] font-bold"
                  >
                    {shifts.length > 0 ? "مُعرّف" : "فارغ"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  تعريف قواعد الورديات وأوقات السماح يتم هنا، بينما توزيع الموظفين يتم في العمليات اليومية.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => navigate({ to: "/shifts" })}
                  className="rounded-full text-[11px] font-bold text-muted-foreground hover:text-primary px-2.5 cursor-pointer"
                >
                  شاشة الجدولة اليومية
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleTabChange("shifts")}
                  className="rounded-full text-xs font-bold gap-1.5 cursor-pointer"
                >
                  تعريف الورديات
                  <ArrowLeft className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Step 5: Leaves */}
            <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs hover:border-primary/40 transition-all flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-2xl flex items-center justify-center font-bold ${
                      leaveTypes.length > 0 ? "bg-emerald-500/10 text-emerald-600" : "bg-slate-500/10 text-slate-600"
                    }`}>
                      <CalendarCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-foreground">5. لوائح وأنواع الإجازات</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">الأنواع: {leaveTypes.length}</p>
                    </div>
                  </div>
                  <Badge
                    variant={leaveTypes.length > 0 ? "default" : "secondary"}
                    className="rounded-full text-[10px] font-bold"
                  >
                    {leaveTypes.length > 0 ? "مُعرّف" : "فارغ"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  تعريف سياسات الاستحقاق والترحيل يتم هنا، بينما تقديم واعتماد الإجازات يتم في العمليات.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => navigate({ to: "/leaves" })}
                  className="rounded-full text-[11px] font-bold text-muted-foreground hover:text-primary px-2.5 cursor-pointer"
                >
                  شاشة طلبات الإجازات
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleTabChange("leaves")}
                  className="rounded-full text-xs font-bold gap-1.5 cursor-pointer"
                >
                  تعريف سياسات الإجازات
                  <ArrowLeft className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Step 6: Users Governance */}
            <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs hover:border-primary/40 transition-all flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-foreground">6. حوكمة ربط المستخدمين</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">ربط الحسابات بالشركة</p>
                    </div>
                  </div>
                  <Badge variant="default" className="rounded-full text-[10px] font-bold bg-primary/10 text-primary border-primary/20">
                    محمي
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  ربط الحسابات المعتمدة بنطاق شركة «الأندلس» دون منح أي صلاحيات إضافية تلقائياً.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => navigate({ to: "/rbac" })}
                  className="rounded-full text-[11px] font-bold text-muted-foreground hover:text-primary px-2.5 cursor-pointer"
                >
                  مصفوفة الصلاحيات
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleTabChange("users")}
                  className="rounded-full text-xs font-bold gap-1.5 cursor-pointer"
                >
                  مراجعة واعتماد الربط
                  <ArrowLeft className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Step 7: Attendance Policy & Labor Law */}
            <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs hover:border-primary/40 transition-all flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
                      <Layers className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-foreground">7. سياسات الدوام والسياج الجغرافي</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">أنظمة العمل (SA, EG, QA, OM, BH)</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="rounded-full text-[10px] font-bold border-amber-500/30 text-amber-600 bg-amber-500/10">
                    حوكمة الدوام
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  ضبط دقائق السماح، حدود العمل الإضافي، والسياج الجغرافي، بينما تتم متابعة البصمات اليومية في شاشة الحضور.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => navigate({ to: "/attendance" })}
                  className="rounded-full text-[11px] font-bold text-muted-foreground hover:text-primary px-2.5 cursor-pointer"
                >
                  شاشة الحضور اليومي
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleTabChange("attendance_policy")}
                  className="rounded-full text-xs font-bold gap-1.5 cursor-pointer"
                >
                  تهيئة سياسات الدوام
                  <ArrowLeft className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Step 8: Payroll & Country Packs Setup */}
            <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs hover:border-primary/40 transition-all flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
                      <Wallet className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-foreground">8. تهيئة الرواتب والحزم النظامية</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">التأمينات وحماية الأجور (WPS)</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="rounded-full text-[10px] font-bold border-emerald-500/30 text-emerald-600 bg-emerald-500/10">
                    5 دول معتمدة
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  تهيئة مجموعات الرواتب، حسابات البنوك لملفات WPS، ونسب التأمينات والضرائب، بينما يتم تشغيل المسيرات في شاشة الرواتب.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => navigate({ to: "/payroll" })}
                  className="rounded-full text-[11px] font-bold text-muted-foreground hover:text-primary px-2.5 cursor-pointer"
                >
                  شاشة مسيرات الرواتب
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleTabChange("payroll_statutory")}
                  className="rounded-full text-xs font-bold gap-1.5 cursor-pointer"
                >
                  تهيئة الرواتب والأنظمة
                  <ArrowLeft className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Step 9: Workflow Chains & Delegations */}
            <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs hover:border-primary/40 transition-all flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center font-bold">
                      <Layers className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-foreground">9. هندسة مسارات الاعتماد والتفويض</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">سلاسل الموافقات وتفويض الصلاحيات</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="rounded-full text-[10px] font-bold border-indigo-500/30 text-indigo-600 bg-indigo-500/10">
                    حوكمة الاعتمادات
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  بناء مستويات الاعتماد المتسلسلة وقواعد التفويض، بينما تتم معالجة الطلبات اليومية في صندوق الوارد.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => navigate({ to: "/workflows" })}
                  className="rounded-full text-[11px] font-bold text-muted-foreground hover:text-primary px-2.5 cursor-pointer"
                >
                  صندوق الوارد اليومي
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleTabChange("workflows")}
                  className="rounded-full text-xs font-bold gap-1.5 cursor-pointer"
                >
                  تصميم مسارات الاعتماد
                  <ArrowLeft className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Step 10: Compensation & Benefits Setup */}
            <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs hover:border-primary/40 transition-all flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                      <DollarSign className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-foreground">10. سلالم الرواتب وكتالوج المزايا</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">نطاقات الدرجات والتأمين الطبي</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="rounded-full text-[10px] font-bold border-primary/30 text-primary bg-primary/5">
                    Compa-Ratio
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  تهيئة الدرجات الوظيفية، نطاقات الرواتب (Min/Mid/Max)، وخطط المزايا، بينما تتم طلبات التعديل ودورات المراجعة في شاشة التعويضات.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => navigate({ to: "/compensation" })}
                  className="rounded-full text-[11px] font-bold text-muted-foreground hover:text-primary px-2.5 cursor-pointer"
                >
                  شاشة التعويضات والمكافآت
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleTabChange("compensation_setup")}
                  className="rounded-full text-xs font-bold gap-1.5 cursor-pointer"
                >
                  تهيئة سلالم الرواتب
                  <ArrowLeft className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Step 11: Expenses Policies Setup */}
            <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs hover:border-primary/40 transition-all flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
                      <Receipt className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-foreground">11. فئات وسياسات النفقات</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">سقوف الصرف وأكواد الأستاذ العام</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="rounded-full text-[10px] font-bold border-amber-500/30 text-amber-600 bg-amber-500/10">
                    حوكمة النفقات
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  تعريف فئات المصروفات، حدود التحذير والمنع، ورموز الحسابات (GL)، بينما يتم تقديم المطالبات ودفعات الصرف في شاشة النفقات.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => navigate({ to: "/expenses" })}
                  className="rounded-full text-[11px] font-bold text-muted-foreground hover:text-primary px-2.5 cursor-pointer"
                >
                  شاشة مطالبات النفقات
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleTabChange("expenses_setup")}
                  className="rounded-full text-xs font-bold gap-1.5 cursor-pointer"
                >
                  تهيئة فئات النفقات
                  <ArrowLeft className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Step 12: Onboarding & Probation Setup */}
            <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs hover:border-primary/40 transition-all flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
                      <UserPlus className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-foreground">12. قوالب المباشرة وفترة التجربة</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">مكتبة مهام Day 1 ولوائح التجربة</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="rounded-full text-[10px] font-bold border-emerald-500/30 text-emerald-600 bg-emerald-500/10">
                    Day 1 Readiness
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  تهيئة قوالب المباشرة، المهام الإلزامية، وسياسات فترة التجربة، بينما تتم متابعة ملفات المنضمين الجدد في شاشة التهيئة.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => navigate({ to: "/onboarding" })}
                  className="rounded-full text-[11px] font-bold text-muted-foreground hover:text-primary px-2.5 cursor-pointer"
                >
                  شاشة ملفات المباشرة
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleTabChange("onboarding_setup")}
                  className="rounded-full text-xs font-bold gap-1.5 cursor-pointer"
                >
                  تهيئة قوالب المباشرة
                  <ArrowLeft className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Step 13: Corporate Bylaws & Assets Setup */}
            <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs hover:border-primary/40 transition-all flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center font-bold">
                      <BookOpen className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-foreground">13. اللوائح الداخلية وتصنيفات العهد</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">إقرارات الاطلاع وفئات المستندات</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="rounded-full text-[10px] font-bold border-indigo-500/30 text-indigo-600 bg-indigo-500/10">
                    حوكمة الأصول والوثائق
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  نشر اللوائح الملزمة بإقرار القراءة وتصنيفات العهد والوثائق، بينما يتم تسليم العهد وإصدار الشهادات في شاشات التشغيل.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => navigate({ to: "/assets" })}
                  className="rounded-full text-[11px] font-bold text-muted-foreground hover:text-primary px-2.5 cursor-pointer"
                >
                  شاشة العهد المسلمة
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleTabChange("assets_docs_setup")}
                  className="rounded-full text-xs font-bold gap-1.5 cursor-pointer"
                >
                  تهيئة اللوائح والعهد
                  <ArrowLeft className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Step 14: Performance & Talent Setup */}
            <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs hover:border-primary/40 transition-all flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                      <Target className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-foreground">14. دورات الأداء ومسارات المواهب</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">أوزان OKRs وأطر الكفاءات والمسارات</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="rounded-full text-[10px] font-bold border-primary/30 text-primary bg-primary/5">
                    360° & 9-Box
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  تأسيس دورات التقييم السنوية، ضبط أوزان الأهداف والكفاءات، والمسارات المهنية، بينما يتم تنفيذ التقييمات وخطط التعاقب في شاشات العمليات.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => navigate({ to: "/performance" })}
                  className="rounded-full text-[11px] font-bold text-muted-foreground hover:text-primary px-2.5 cursor-pointer"
                >
                  شاشة تقييم الأداء
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleTabChange("performance_talent_setup")}
                  className="rounded-full text-xs font-bold gap-1.5 cursor-pointer"
                >
                  تهيئة الأداء والمواهب
                  <ArrowLeft className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Step 15: Learning & Employee Relations Setup */}
            <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs hover:border-primary/40 transition-all flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
                      <GraduationCap className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-foreground">15. التدريب الإلزامي ولائحة التحقيقات</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">قواعد الامتثال ومصفوفة الجزاءات</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="rounded-full text-[10px] font-bold border-amber-500/30 text-amber-600 bg-amber-500/10">
                    SLA والامتثال
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  إدارة قواعد التدريب الإلزامي ودليل المهارات، ومصفوفة تدرج الإنذارات ومهل التحقيقات، بينما تدار الجلسات والقضايا في شاشات التشغيل.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => navigate({ to: "/learning" })}
                  className="rounded-full text-[11px] font-bold text-muted-foreground hover:text-primary px-2.5 cursor-pointer"
                >
                  شاشة التدريب والتعلم
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleTabChange("learning_er_setup")}
                  className="rounded-full text-xs font-bold gap-1.5 cursor-pointer"
                >
                  تهيئة التدريب والتحقيقات
                  <ArrowLeft className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Step 16: Recruitment & ATS Setup */}
            <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs hover:border-primary/40 transition-all flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                      <UserPlus className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-foreground">16. مراحل التوظيف وبنك المواهب</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">أوزان التقييم وحوكمة الـ SLA</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="rounded-full text-[10px] font-bold border-primary/30 text-primary bg-primary/5">
                    ATS Governance
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  ضبط معايير بطاقات تقييم المقابلات ومراحل مسار التعيين، بينما يتم فرز المرشحين وإجراء المقابلات في شاشة التوظيف.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => navigate({ to: "/recruitment" })}
                  className="rounded-full text-[11px] font-bold text-muted-foreground hover:text-primary px-2.5 cursor-pointer"
                >
                  شاشة التوظيف والفرز
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleTabChange("recruitment_setup")}
                  className="rounded-full text-xs font-bold gap-1.5 cursor-pointer"
                >
                  تهيئة التوظيف
                  <ArrowLeft className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Step 17: Engagement & Surveys Setup */}
            <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs hover:border-primary/40 transition-all flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
                      <Smile className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-foreground">17. سرية الاستبيانات وأوسمة التقدير</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">حاجز السرية الإلزامي (N ≥ 5)</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="rounded-full text-[10px] font-bold border-amber-500/30 text-amber-600 bg-amber-500/10">
                    eNPS & Kudos
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  حوكمة بنك أسئلة النبض وحاجز السرية لحماية الموظفين وكتالوج الأوسمة، بينما تتم المشاركة وتقديم الشكر في شاشة الارتباط.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => navigate({ to: "/engagement" })}
                  className="rounded-full text-[11px] font-bold text-muted-foreground hover:text-primary px-2.5 cursor-pointer"
                >
                  شاشة نبض الموظفين
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleTabChange("engagement_setup")}
                  className="rounded-full text-xs font-bold gap-1.5 cursor-pointer"
                >
                  تهيئة الارتباط
                  <ArrowLeft className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Step 18: AI Governance Setup */}
            <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs hover:border-primary/40 transition-all flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-purple-500/10 text-purple-600 flex items-center justify-center font-bold">
                      <Bot className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-foreground">18. حوكمة وسياسات الذكاء الاصطناعي</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">تجريد PII ومنع الاختلاق والأمان</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="rounded-full text-[10px] font-bold border-purple-500/30 text-purple-600 bg-purple-500/10">
                    Governed AI
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  إدارة نماذج المزودين المعتمدة وسياسات حماية البيانات الحساسة وتأصيل الحقائق، بينما تدار الاستعلامات في شاشة المساعد الذكي.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => navigate({ to: "/ai-copilot" })}
                  className="rounded-full text-[11px] font-bold text-muted-foreground hover:text-primary px-2.5 cursor-pointer"
                >
                  شاشة المساعد الذكي
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleTabChange("ai_governance")}
                  className="rounded-full text-xs font-bold gap-1.5 cursor-pointer"
                >
                  تهيئة الذكاء الاصطناعي
                  <ArrowLeft className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ===================== TAB 2: COMPANY PROFILE ===================== */}
        <TabsContent value="company" className="pt-4">
          <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs">
            <div className="mb-6">
              <h2 className="text-base font-black text-foreground">بيانات المنشأة والحسابات البنكية</h2>
              <p className="text-xs text-muted-foreground mt-1">
                استكمال البيانات القانونية لشركة «الأندلس». لا يتم اختلاق أرقام أو سجلات تجارية عشوائية.
              </p>
            </div>
            <CompanyProfilePanel />
          </div>
        </TabsContent>

        {/* ===================== TAB 3: ORG STRUCTURE ===================== */}
        <TabsContent value="org" className="pt-4">
          <OrganizationView />
        </TabsContent>

        {/* ===================== TAB 4: SHIFTS SETUP ===================== */}
        <TabsContent value="shifts" className="pt-4">
          <ShiftDefinitionsSetupPanel />
        </TabsContent>

        {/* ===================== TAB 5: LEAVES POLICIES ===================== */}
        <TabsContent value="leaves" className="pt-4">
          <LeavePoliciesSetupPanel />
        </TabsContent>

        {/* ===================== TAB 6: USERS GOVERNANCE ===================== */}
        <TabsContent value="users" className="pt-4">
          <UserCompanyAccessPanel />
        </TabsContent>

        {/* ===================== TAB 7: ATTENDANCE POLICIES ===================== */}
        <TabsContent value="attendance_policy" className="pt-4">
          <AttendancePolicySetupPanel />
        </TabsContent>

        {/* ===================== TAB 8: PAYROLL & STATUTORY SETUP ===================== */}
        <TabsContent value="payroll_statutory" className="pt-4">
          <PayrollStatutorySetupPanel />
        </TabsContent>

        {/* ===================== TAB 9: WORKFLOW CHAINS SETUP ===================== */}
        <TabsContent value="workflows" className="pt-4">
          <WorkflowChainsSetupPanel />
        </TabsContent>

        {/* ===================== TAB 10: COMPENSATION & BENEFITS SETUP ===================== */}
        <TabsContent value="compensation_setup" className="pt-4">
          <CompensationSetupPanel />
        </TabsContent>

        {/* ===================== TAB 11: EXPENSES POLICIES SETUP ===================== */}
        <TabsContent value="expenses_setup" className="pt-4">
          <ExpensesPolicySetupPanel />
        </TabsContent>

        {/* ===================== TAB 12: ONBOARDING & PROBATION SETUP ===================== */}
        <TabsContent value="onboarding_setup" className="pt-4">
          <OnboardingProbationSetupPanel />
        </TabsContent>

        {/* ===================== TAB 13: ASSETS & DOCUMENTS SETUP ===================== */}
        <TabsContent value="assets_docs_setup" className="pt-4">
          <AssetsDocumentsSetupPanel />
        </TabsContent>

        {/* ===================== TAB 14: PERFORMANCE & TALENT SETUP ===================== */}
        <TabsContent value="performance_talent_setup" className="pt-4">
          <PerformanceTalentSetupPanel />
        </TabsContent>

        {/* ===================== TAB 15: LEARNING & ER SETUP ===================== */}
        <TabsContent value="learning_er_setup" className="pt-4">
          <LearningErSetupPanel />
        </TabsContent>

        {/* ===================== TAB 16: RECRUITMENT & ATS SETUP ===================== */}
        <TabsContent value="recruitment_setup" className="pt-4">
          <RecruitmentSetupPanel />
        </TabsContent>

        {/* ===================== TAB 17: ENGAGEMENT & RECOGNITION SETUP ===================== */}
        <TabsContent value="engagement_setup" className="pt-4">
          <EngagementSetupPanel />
        </TabsContent>

        {/* ===================== TAB 18: AI GOVERNANCE SETUP ===================== */}
        <TabsContent value="ai_governance" className="pt-4">
          <AiGovernanceSetupPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
};
