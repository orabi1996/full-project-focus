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
} from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { CompanyProfilePanel } from "../organization/CompanyProfilePanel";
import { OrganizationView } from "../organization/OrganizationView";
import { ShiftDefinitionsSetupPanel } from "./ShiftDefinitionsSetupPanel";
import { LeavePoliciesSetupPanel } from "./LeavePoliciesSetupPanel";
import { UserCompanyAccessPanel } from "./UserCompanyAccessPanel";
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
      <Tabs value={activeSetupTab} onValueChange={setActiveSetupTab} className="w-full">
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
                  onClick={() => setActiveSetupTab("company")}
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
                  onClick={() => setActiveSetupTab("org")}
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
                  onClick={() => setActiveSetupTab("org")}
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
              <div className="mt-4 pt-3 border-t border-border/60 flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setActiveSetupTab("users")}
                  className="rounded-full text-xs font-bold gap-1.5 cursor-pointer"
                >
                  مراجعة واعتماد الربط
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
      </Tabs>
    </div>
  );
};
