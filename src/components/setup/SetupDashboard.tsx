import React, { useState } from "react";
import { useApp } from "../../lib/context/AppContext";
import { canManageModule } from "../../lib/auth/permissions";
import { useNavigate } from "@tanstack/react-router";
import {
  Building2,
  Network,
  MapPin,
  Clock,
  CalendarCheck,
  DollarSign,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  ExternalLink,
  Plus,
  RefreshCw,
  FileText,
  Users,
  Layers,
  ChevronRight,
  Shield,
  Briefcase,
  HelpCircle,
  Sparkles,
} from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { CompanyProfilePanel } from "../organization/CompanyProfilePanel";
import { OrganizationView } from "../organization/OrganizationView";
import { ShiftsView } from "../shifts/ShiftsView";
import { LeavesView } from "../leaves/LeavesView";
import { RbacView } from "../rbac/RbacView";
import { toast } from "sonner";

export const SetupDashboard: React.FC = () => {
  const {
    company,
    orgUnits,
    workLocations,
    costCenters,
    shifts,
    leaveTypes,
    payrollGroups,
    approvalChains,
    employees,
    currentRole,
    language,
    t,
    refreshCoreData,
  } = useApp();

  const navigate = useNavigate();
  const canManage = canManageModule(currentRole, "setup");
  const [activeSetupTab, setActiveSetupTab] = useState<string>("overview");
  const [isRefreshing, setIsRefreshing] = useState(false);

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

  // 1. Stage Validations
  const isCompanyComplete = Boolean(
    company?.legalNameAr &&
    company?.legalNameAr.trim() !== "" &&
    company?.taxNumber &&
    company?.taxNumber.trim() !== "" &&
    company?.crNumber &&
    company?.crNumber.trim() !== ""
  );

  const isOrgComplete = orgUnits.length > 0;
  const isLocationsComplete = workLocations.length > 0;
  const isShiftsComplete = shifts.length > 0;
  const isLeavesComplete = leaveTypes.length > 0;
  const isPayrollComplete = payrollGroups.length > 0;
  const isApprovalsComplete = approvalChains.length > 0;

  // Calculate completion percentage
  const stages = [
    { id: "company", title: "بيانات شركة الأندلس", complete: isCompanyComplete, weight: 20 },
    { id: "organization", title: "الهيكل التنظيمي والأقسام", complete: isOrgComplete, weight: 20 },
    { id: "locations", title: "مقار العمل ومراكز التكلفة", complete: isLocationsComplete, weight: 15 },
    { id: "shifts", title: "إعدادات الحضور والورديات", complete: isShiftsComplete, weight: 15 },
    { id: "leaves", title: "سياسات وأنواع الإجازات", complete: isLeavesComplete, weight: 10 },
    { id: "payroll", title: "مجموعات وبنود الرواتب", complete: isPayrollComplete, weight: 10 },
    { id: "approvals", title: "مسارات الاعتماد والتفويضات", complete: isApprovalsComplete, weight: 10 },
  ];

  const completedWeight = stages.filter((s) => s.complete).reduce((acc, s) => acc + s.weight, 0);
  const isFullyConfigured = completedWeight === 100;

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
                    تهيئة النظام — شركة «{company?.legalNameAr || "الأندلس"}»
                  </h1>
                  <Badge
                    variant={isFullyConfigured ? "default" : "secondary"}
                    className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      isFullyConfigured
                        ? "bg-emerald-500/10 text-emerald-600 border-emerald-200"
                        : "bg-amber-500/10 text-amber-600 border-amber-200"
                    }`}
                  >
                    {isFullyConfigured ? "مكتملة التهيئة" : "قيد التهيئة والاستكمال"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  فصل إعداد القواعد واللوائح التنظيمية عن العمليات اليومية. يتم حفظ التغييرات وتطبيقها تدريجيًا.
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
              className="rounded-full text-xs font-bold gap-2 cursor-pointer"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin text-primary" : ""}`} />
              تحديث الحالة
            </Button>
          </div>
        </div>

        {/* Progress Bar & Metric */}
        <div className="mt-6 pt-6 border-t border-border/60">
          <div className="flex items-center justify-between text-xs font-bold mb-2">
            <span className="text-foreground flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              اكتمال المتطلبات الأساسية للنظام
            </span>
            <span className="font-mono text-primary font-black text-sm">{completedWeight}%</span>
          </div>
          <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-blue-500 transition-all duration-500 rounded-full"
              style={{ width: `${completedWeight}%` }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            * لا يشترط استكمال كافة الوحدات لبدء استخدام النظام؛ يمكنك تهيئة الوحدات التي تحتاجها فقط دون التأثير على بقية العمليات.
          </p>
        </div>
      </div>

      {/* Navigation Tabs between Overview and Detailed Setup Panels */}
      <Tabs value={activeSetupTab} onValueChange={setActiveSetupTab} className="w-full">
        <TabsList className="classera-tabs-strip w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview" className="rounded-xl text-xs font-bold py-2 px-4">
            نظرة عامة وقائمة التهيئة
          </TabsTrigger>
          <TabsTrigger value="company" className="rounded-xl text-xs font-bold py-2 px-4">
            بيانات المنشأة والحسابات
          </TabsTrigger>
          <TabsTrigger value="org" className="rounded-xl text-xs font-bold py-2 px-4">
            الهيكل التنظيمي ({orgUnits.length})
          </TabsTrigger>
          <TabsTrigger value="shifts" className="rounded-xl text-xs font-bold py-2 px-4">
            إعدادات الورديات ({shifts.length})
          </TabsTrigger>
          <TabsTrigger value="leaves" className="rounded-xl text-xs font-bold py-2 px-4">
            سياسات الإجازات ({leaveTypes.length})
          </TabsTrigger>
          <TabsTrigger value="rbac" className="rounded-xl text-xs font-bold py-2 px-4">
            المستخدمون والصلاحيات
          </TabsTrigger>
        </TabsList>

        {/* ===================== TAB 1: OVERVIEW & CHECKLIST ===================== */}
        <TabsContent value="overview" className="space-y-6 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Step 1: Company Profile */}
            <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs hover:border-primary/40 transition-all">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-2xl flex items-center justify-center font-bold ${
                    isCompanyComplete ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"
                  }`}>
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-foreground">1. بيانات شركة الأندلس</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      الاسم بالعربية: «{company?.legalNameAr || "الأندلس"}»
                    </p>
                  </div>
                </div>
                <Badge
                  variant={isCompanyComplete ? "default" : "secondary"}
                  className="rounded-full text-[10px] font-bold"
                >
                  {isCompanyComplete ? "مكتمل" : "يتطلب بيانات"}
                </Badge>
              </div>
              <div className="mt-4 text-xs text-muted-foreground leading-relaxed">
                {isCompanyComplete ? (
                  <span className="text-emerald-600 font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" />
                    تم تسجيل السجل التجاري والرقم الضريبي بنجاح.
                  </span>
                ) : (
                  <span className="text-amber-700 bg-amber-500/10 px-2.5 py-1.5 rounded-xl block border border-amber-200">
                    لم يُختلق سجل تجاري أو أرقام ضريبية عشوائية. يرجى إدخال السجل التجاري والرقم الضريبي الفعلي لشركة الأندلس.
                  </span>
                )}
              </div>
              <div className="mt-4 pt-3 border-t border-border/60 flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setActiveSetupTab("company")}
                  className="rounded-full text-xs font-bold gap-1.5 cursor-pointer"
                >
                  استكمال بيانات المنشأة
                  <ArrowLeft className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Step 2: Org Structure */}
            <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs hover:border-primary/40 transition-all">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-2xl flex items-center justify-center font-bold ${
                    isOrgComplete ? "bg-emerald-500/10 text-emerald-600" : "bg-slate-500/10 text-slate-600"
                  }`}>
                    <Network className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-foreground">2. الهيكل التنظيمي والأقسام</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      عدد الأقسام الحالية: {orgUnits.length}
                    </p>
                  </div>
                </div>
                <Badge
                  variant={isOrgComplete ? "default" : "secondary"}
                  className="rounded-full text-[10px] font-bold"
                >
                  {isOrgComplete ? "مُعرّف" : "فارغ"}
                </Badge>
              </div>
              <div className="mt-4 text-xs text-muted-foreground leading-relaxed">
                {isOrgComplete ? (
                  <span className="text-emerald-600 font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" />
                    تم تعريف {orgUnits.length} وحدة تنظيمية / قسم بنجاح.
                  </span>
                ) : (
                  <span className="text-slate-600 bg-slate-500/10 px-2.5 py-1.5 rounded-xl block border border-slate-200">
                    لم تتم إضافة أقسام بعد. لن يتم اختلاق أقسام وهمية؛ يقوم المسؤول بإضافتها حسب الهيكل الفعلي.
                  </span>
                )}
              </div>
              <div className="mt-4 pt-3 border-t border-border/60 flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setActiveSetupTab("org")}
                  className="rounded-full text-xs font-bold gap-1.5 cursor-pointer"
                >
                  إدارة الهيكل التنظيمي
                  <ArrowLeft className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Step 3: Work Locations & Cost Centers */}
            <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs hover:border-primary/40 transition-all">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-2xl flex items-center justify-center font-bold ${
                    isLocationsComplete ? "bg-emerald-500/10 text-emerald-600" : "bg-slate-500/10 text-slate-600"
                  }`}>
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-foreground">3. مقار العمل ومراكز التكلفة</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      مقار العمل: {workLocations.length} | مراكز التكلفة: {costCenters.length}
                    </p>
                  </div>
                </div>
                <Badge
                  variant={isLocationsComplete ? "default" : "secondary"}
                  className="rounded-full text-[10px] font-bold"
                >
                  {isLocationsComplete ? "مُعرّف" : "فارغ"}
                </Badge>
              </div>
              <div className="mt-4 text-xs text-muted-foreground leading-relaxed">
                {isLocationsComplete ? (
                  <span className="text-emerald-600 font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" />
                    تم تعريف مقار العمل الجغرافية ونطاق البصمة بدقة.
                  </span>
                ) : (
                  <span className="text-slate-600 bg-slate-500/10 px-2.5 py-1.5 rounded-xl block border border-slate-200">
                    لم تتم إضافة مقار عمل بعد. يتم تحديد المقار والفروع ونطاقات الحضور الجغرافي من التهيئة.
                  </span>
                )}
              </div>
              <div className="mt-4 pt-3 border-t border-border/60 flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate({ to: "/organization" })}
                  className="rounded-full text-xs font-bold gap-1.5 cursor-pointer"
                >
                  إضافة مقر عمل
                  <ArrowLeft className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Step 4: Attendance & Shifts */}
            <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs hover:border-primary/40 transition-all">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-2xl flex items-center justify-center font-bold ${
                    isShiftsComplete ? "bg-emerald-500/10 text-emerald-600" : "bg-slate-500/10 text-slate-600"
                  }`}>
                    <Clock className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-foreground">4. إعدادات الحضور والورديات</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      الورديات المُعرّفة: {shifts.length}
                    </p>
                  </div>
                </div>
                <Badge
                  variant={isShiftsComplete ? "default" : "secondary"}
                  className="rounded-full text-[10px] font-bold"
                >
                  {isShiftsComplete ? "مُعرّف" : "فارغ"}
                </Badge>
              </div>
              <div className="mt-4 text-xs text-muted-foreground leading-relaxed">
                {isShiftsComplete ? (
                  <span className="text-emerald-600 font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" />
                    تم تعريف مواعيد وساعات العمل وقواعد الحضور بنجاح.
                  </span>
                ) : (
                  <span className="text-slate-600 bg-slate-500/10 px-2.5 py-1.5 rounded-xl block border border-slate-200">
                    تعريف الورديات يتم في التهيئة، بينما توزيع الموظفين عليها يتم في شاشة العمليات اليومية.
                  </span>
                )}
              </div>
              <div className="mt-4 pt-3 border-t border-border/60 flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setActiveSetupTab("shifts")}
                  className="rounded-full text-xs font-bold gap-1.5 cursor-pointer"
                >
                  تعريف الورديات
                  <ArrowLeft className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Step 5: Leave Policies */}
            <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs hover:border-primary/40 transition-all">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-2xl flex items-center justify-center font-bold ${
                    isLeavesComplete ? "bg-emerald-500/10 text-emerald-600" : "bg-slate-500/10 text-slate-600"
                  }`}>
                    <CalendarCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-foreground">5. سياسات وأنواع الإجازات</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      أنواع الإجازات المُعرّفة: {leaveTypes.length}
                    </p>
                  </div>
                </div>
                <Badge
                  variant={isLeavesComplete ? "default" : "secondary"}
                  className="rounded-full text-[10px] font-bold"
                >
                  {isLeavesComplete ? "مُعرّف" : "فارغ"}
                </Badge>
              </div>
              <div className="mt-4 text-xs text-muted-foreground leading-relaxed">
                {isLeavesComplete ? (
                  <span className="text-emerald-600 font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" />
                    لوائح الإجازات والاستحقاق السنوي والترحيل معتمدة.
                  </span>
                ) : (
                  <span className="text-slate-600 bg-slate-500/10 px-2.5 py-1.5 rounded-xl block border border-slate-200">
                    تعريف نوع الإجازة يتم في التهيئة، بينما تقديم الموظف للطلب واعتماده يتم في العمليات التشغيلية.
                  </span>
                )}
              </div>
              <div className="mt-4 pt-3 border-t border-border/60 flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setActiveSetupTab("leaves")}
                  className="rounded-full text-xs font-bold gap-1.5 cursor-pointer"
                >
                  تعريف سياسات الإجازات
                  <ArrowLeft className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Step 6: Users & Roles */}
            <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs hover:border-primary/40 transition-all">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-foreground">6. المستخدمون والأدوار والصلاحيات</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      حوكمة الوصول ونطاق المنشأة
                    </p>
                  </div>
                </div>
                <Badge variant="default" className="rounded-full text-[10px] font-bold bg-primary/10 text-primary border-primary/20">
                  محمي
                </Badge>
              </div>
              <div className="mt-4 text-xs text-muted-foreground leading-relaxed">
                <span className="text-slate-600 bg-slate-500/10 px-2.5 py-1.5 rounded-xl block border border-slate-200">
                  يتم الاحتفاظ بحسابات الدخول الحالية وصلاحياتها دون تغيير تلقائي. يراجع المسؤول ربط الحسابات بنطاق شركة الأندلس.
                </span>
              </div>
              <div className="mt-4 pt-3 border-t border-border/60 flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setActiveSetupTab("rbac")}
                  className="rounded-full text-xs font-bold gap-1.5 cursor-pointer"
                >
                  مراجعة الصلاحيات والمستخدمين
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
                استكمال البيانات القانونية والرسمية لشركة الأندلس. لا يتم اختلاق أرقام أو سجلات تجارية عشوائية.
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
          <ShiftsView />
        </TabsContent>

        {/* ===================== TAB 5: LEAVES POLICIES ===================== */}
        <TabsContent value="leaves" className="pt-4">
          <LeavesView />
        </TabsContent>

        {/* ===================== TAB 6: RBAC SETUP ===================== */}
        <TabsContent value="rbac" className="pt-4">
          <RbacView />
        </TabsContent>
      </Tabs>
    </div>
  );
};
