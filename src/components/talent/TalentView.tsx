// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PROMPT 30: PRODUCTION TALENT, CAREER, SUCCESSION & MOBILITY HUB
// src/components/talent/TalentView.tsx
// ============================================================================

import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Compass,
  GitFork,
  Grid,
  Layers,
  Award,
  Briefcase,
  Users2,
  TrendingUp,
  ShieldCheck,
  AlertTriangle,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  MapPin,
  ChevronRight,
  ExternalLink,
  Target,
  Sparkles,
  UserCheck,
  XCircle,
  FileText,
  Filter,
  Settings,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "../ui/card";
import { talentQueryKeys } from "../../lib/query/talent-query-keys";
import {
  fetchTalentKpis,
  fetchCareerPaths,
  fetchTalentReviewCycles,
  fetchTalentAssessments,
  fetchTalentPools,
  fetchCriticalRoles,
  fetchSuccessionPlans,
  fetchInternalOpportunities,
  fetchInternalApplications,
  fetchMentoringRelationships,
  fetchCareerConversations,
  fetchTalentDevelopmentActions,
  calculateCareerReadinessAndGaps,
  selectInternalCandidateAndInitiateMovement,
} from "../../lib/data/talent-repository";
import {
  mapPerformancePotentialToNineBox,
  getNineBoxCellInfo,
  formatReadinessTimeline,
  formatCareerPathType,
  evaluateSuccessionPlanHealth,
  type NineBoxCellCode,
  type CareerPath,
  type TalentPool,
  type SuccessionPlan,
  type InternalOpportunity,
  type TalentAssessment,
  type PerformanceRatingLevel,
  type PotentialRatingLevel,
} from "../../lib/domains/talent";
import { CreateCareerPathModal } from "./CreateCareerPathModal";
import { CareerAspirationsModal } from "./CareerAspirationsModal";
import { TalentAssessmentModal } from "./TalentAssessmentModal";
import { CreateTalentPoolModal } from "./CreateTalentPoolModal";
import { NominateSuccessorModal } from "./NominateSuccessorModal";
import { CreateInternalOpportunityModal } from "./CreateInternalOpportunityModal";
import { InternalApplicationModal } from "./InternalApplicationModal";
import { CreateDevelopmentActionModal } from "./CreateDevelopmentActionModal";
import { MentoringModal } from "./MentoringModal";
import { supabase } from "../../integrations/supabase/client";

interface TalentViewProps {
  companyId?: string;
}

export const TalentView: React.FC<TalentViewProps> = ({ companyId: propCompanyId }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCycleId, setSelectedCycleId] = useState<string>("");

  // Modals state
  const [isPathModalOpen, setIsPathModalOpen] = useState(false);
  const [isAspirationModalOpen, setIsAspirationModalOpen] = useState(false);
  const [isAssessmentModalOpen, setIsAssessmentModalOpen] = useState(false);
  const [isPoolModalOpen, setIsPoolModalOpen] = useState(false);
  const [isNominateModalOpen, setIsNominateModalOpen] = useState(false);
  const [isOppModalOpen, setIsOppModalOpen] = useState(false);
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [isMentoringModalOpen, setIsMentoringModalOpen] = useState(false);

  // Selected entities for modals
  const [targetEmployee, setTargetEmployee] = useState<{ id: string; name: string } | null>(null);
  const [targetPlan, setTargetPlan] = useState<{ id: string; roleTitle: string } | null>(null);
  const [targetOpp, setTargetOpp] = useState<InternalOpportunity | null>(null);
  const [assessmentModalConfig, setAssessmentModalConfig] = useState<{
    employeeId: string;
    employeeName: string;
    initialPerf?: PerformanceRatingLevel;
    initialPot?: PotentialRatingLevel;
    isCalibration?: boolean;
  } | null>(null);

  // Readiness evaluation drawer state
  const [readinessResult, setReadinessResult] = useState<{
    employeeName: string;
    readiness: string;
    matchScore: number;
    gaps: any[];
    missingSkills: any[];
  } | null>(null);

  // Tenant & User resolution
  const [companyId, setCompanyId] = useState<string>(propCompanyId || "");
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [employees, setEmployees] = useState<
    Array<{ id: string; name: string; employeeNo: string; departmentName?: string; jobTitle?: string; jobPositionId?: string }>
  >([]);
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([]);
  const [positions, setPositions] = useState<Array<{ id: string; title: string }>>([]);

  useEffect(() => {
    async function resolveContext() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }

      let cId = propCompanyId;
      if (!cId) {
        const { data } = await (supabase as any)
          .from("companies")
          .select("id")
          .limit(1)
          .maybeSingle();
        if (data) cId = data.id;
      }

      if (cId) {
        setCompanyId(cId);

        // Fetch employees
        const { data: empData } = await (supabase as any)
          .from("employees")
          .select("id, first_name_ar, last_name_ar, employee_number, department_id, job_position_id, job_title_ar")
          .eq("company_id", cId)
          .order("first_name_ar", { ascending: true })
          .limit(100);

        if (empData) {
          setEmployees(
            empData.map((e: any) => ({
              id: e.id,
              name: `${e.first_name_ar} ${e.last_name_ar}`,
              employeeNo: e.employee_number || "EMP",
              jobTitle: e.job_title_ar,
              jobPositionId: e.job_position_id,
            }))
          );
        }

        // Fetch departments
        const { data: deptData } = await (supabase as any)
          .from("departments")
          .select("id, name_ar")
          .eq("company_id", cId);
        if (deptData) {
          setDepartments(deptData.map((d: any) => ({ id: d.id, name: d.name_ar })));
        }

        // Fetch job positions
        const { data: posData } = await (supabase as any)
          .from("job_positions")
          .select("id, title_ar")
          .eq("company_id", cId);
        if (posData) {
          setPositions(posData.map((p: any) => ({ id: p.id, title: p.title_ar })));
        }
      }
    }
    resolveContext();
  }, [propCompanyId]);

  // React Query Hooks
  const { data: kpis, refetch: refetchKpis } = useQuery({
    queryKey: talentQueryKeys.kpis(companyId),
    queryFn: () => fetchTalentKpis(companyId),
    enabled: !!companyId,
  });

  const { data: careerPaths = [], refetch: refetchPaths } = useQuery({
    queryKey: talentQueryKeys.careerPaths.list(companyId),
    queryFn: () => fetchCareerPaths(companyId),
    enabled: !!companyId,
  });

  const { data: reviewCycles = [], refetch: refetchCycles } = useQuery({
    queryKey: talentQueryKeys.reviewCycles.list(companyId),
    queryFn: () => fetchTalentReviewCycles(companyId),
    enabled: !!companyId,
  });

  // Set default cycle
  useEffect(() => {
    if (reviewCycles.length > 0 && !selectedCycleId) {
      setSelectedCycleId(reviewCycles[0].id);
    }
  }, [reviewCycles, selectedCycleId]);

  const { data: assessments = [], refetch: refetchAssessments } = useQuery({
    queryKey: talentQueryKeys.assessments.list(companyId, selectedCycleId || undefined),
    queryFn: () => fetchTalentAssessments(companyId, selectedCycleId || undefined),
    enabled: !!companyId,
  });

  const { data: talentPools = [], refetch: refetchPools } = useQuery({
    queryKey: talentQueryKeys.talentPools.list(companyId),
    queryFn: () => fetchTalentPools(companyId),
    enabled: !!companyId,
  });

  const { data: criticalRoles = [], refetch: refetchCriticalRoles } = useQuery({
    queryKey: talentQueryKeys.criticalRoles.list(companyId),
    queryFn: () => fetchCriticalRoles(companyId),
    enabled: !!companyId,
  });

  const { data: successionPlans = [], refetch: refetchSuccession } = useQuery({
    queryKey: talentQueryKeys.successionPlans.list(companyId),
    queryFn: () => fetchSuccessionPlans(companyId),
    enabled: !!companyId,
  });

  const { data: internalOpportunities = [], refetch: refetchOpps } = useQuery({
    queryKey: talentQueryKeys.internalOpportunities.list(companyId),
    queryFn: () => fetchInternalOpportunities(companyId),
    enabled: !!companyId,
  });

  const { data: internalApplications = [], refetch: refetchApps } = useQuery({
    queryKey: talentQueryKeys.internalOpportunities.applications(companyId),
    queryFn: () => fetchInternalApplications(companyId),
    enabled: !!companyId,
  });

  const { data: mentoringList = [], refetch: refetchMentoring } = useQuery({
    queryKey: talentQueryKeys.mentoring.list(companyId),
    queryFn: () => fetchMentoringRelationships(companyId),
    enabled: !!companyId,
  });

  const { data: conversations = [], refetch: refetchConversations } = useQuery({
    queryKey: talentQueryKeys.careerConversations.list(companyId),
    queryFn: () => fetchCareerConversations(companyId),
    enabled: !!companyId,
  });

  const { data: devActions = [], refetch: refetchDevActions } = useQuery({
    queryKey: talentQueryKeys.developmentActions.list(companyId),
    queryFn: () => fetchTalentDevelopmentActions(companyId),
    enabled: !!companyId,
  });

  // 9-Box Grid cell grouping
  const nineBoxMap = useMemo(() => {
    const map = new Map<NineBoxCellCode, TalentAssessment[]>();
    const cells: NineBoxCellCode[] = ["1A", "1B", "1C", "2A", "2B", "2C", "3A", "3B", "3C"];
    cells.forEach((c) => map.set(c, []));

    assessments.forEach((ass) => {
      const cell = ass.calibratedNineBoxCell || ass.nineBoxCell;
      if (map.has(cell)) {
        map.get(cell)!.push(ass);
      }
    });
    return map;
  }, [assessments]);

  // Handle calculating readiness
  const handleCalculateReadiness = async (empId: string, empName: string, targetPosId?: string) => {
    const posId = targetPosId || positions[0]?.id;
    if (!posId) {
      toast.error("لا توجد مناصب وظيفية مهيأة لقياس الجاهزية");
      return;
    }

    try {
      const res = await calculateCareerReadinessAndGaps(companyId, empId, posId);
      if (res.success) {
        setReadinessResult({
          employeeName: empName,
          readiness: res.readiness || "ready",
          matchScore: res.matchScore || 100,
          gaps: res.gaps || [],
          missingSkills: res.missingSkills || [],
        });
      } else {
        toast.error(res.error || "تعذر قياس الجاهزية");
      }
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ في احتساب الجاهزية");
    }
  };

  // Handle internal candidate selection & movement initiation
  const handleSelectCandidate = async (appId: string, candidateName: string) => {
    if (!confirm(`هل أنت متأكد من ترشيح واختيار المرشح (${candidateName}) وشغل الفرصة وتوليد قرار نقل/ترقية فوري؟`)) {
      return;
    }

    try {
      const res = await selectInternalCandidateAndInitiateMovement({
        companyId,
        applicationId: appId,
        movementType: "promotion",
        effectiveDate: new Date().toISOString().split("T")[0],
        initiatorId: currentUserId,
      });

      if (!res.success) {
        toast.error(res.error || "فشل اعتماد المرشح الداخلي");
        return;
      }

      toast.success(
        `تم اعتماد المرشح بنجاح وتوليد أمر التغيير الوظيفي رقم (${res.movementNumber}) في سجل الحركات الوظيفية`
      );
      refetchApps();
      refetchOpps();
      refetchKpis();
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ أثناء معالجة القرار");
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto" dir="rtl">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <Compass className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-700 border border-emerald-500/20">
                  شاشة العمليات وتنفيذ خطط التعاقب والتنقل
                </span>
              </div>
              <h1 className="text-2xl font-black tracking-tight text-foreground">
                المواهب وتخطيط التعاقب والتنقل الداخلي
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                إدارة المسارات المهنية، مصفوفة 9-Box، مجمعات المواهب، خطط التعاقب، وسوق الفرص الداخلية
              </p>
            </div>
          </div>
        </div>

        {/* Global Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate({ to: "/setup?tab=performance_talent_setup" as any })}
            className="gap-1.5 text-xs font-bold"
          >
            <Settings className="h-4 w-4 text-primary" />
            تهيئة المسارات وأطر الكفاءات
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsPathModalOpen(true)}
            className="gap-1.5 text-xs"
          >
            <GitFork className="h-4 w-4" />
            تصميم مسار
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (employees.length > 0) {
                setAssessmentModalConfig({
                  employeeId: employees[0].id,
                  employeeName: employees[0].name,
                  isCalibration: true,
                });
                setIsAssessmentModalOpen(true);
              }
            }}
            className="gap-1.5 text-xs"
          >
            <Grid className="h-4 w-4" />
            معايرة 9-Box
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsPoolModalOpen(true)}
            className="gap-1.5 text-xs"
          >
            <Layers className="h-4 w-4" />
            مجمع مواهب
          </Button>

          <Button
            size="sm"
            onClick={() => setIsOppModalOpen(true)}
            className="gap-1.5 text-xs shadow-xs"
          >
            <Plus className="h-4 w-4" />
            نشر فرصة داخلية
          </Button>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 h-auto p-1 bg-muted/60">
          <TabsTrigger value="overview" className="text-xs py-2 gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" />
            نظرة عامة
          </TabsTrigger>
          <TabsTrigger value="profiles" className="text-xs py-2 gap-1.5">
            <Compass className="h-3.5 w-3.5" />
            الملفات والجدارة
          </TabsTrigger>
          <TabsTrigger value="paths" className="text-xs py-2 gap-1.5">
            <GitFork className="h-3.5 w-3.5" />
            المسارات المهنية
          </TabsTrigger>
          <TabsTrigger value="nine_box" className="text-xs py-2 gap-1.5">
            <Grid className="h-3.5 w-3.5" />
            مصفوفة 9-Box
          </TabsTrigger>
          <TabsTrigger value="pools" className="text-xs py-2 gap-1.5">
            <Layers className="h-3.5 w-3.5" />
            مجمعات المواهب
          </TabsTrigger>
          <TabsTrigger value="succession" className="text-xs py-2 gap-1.5">
            <Award className="h-3.5 w-3.5" />
            خطط التعاقب
          </TabsTrigger>
          <TabsTrigger value="mobility" className="text-xs py-2 gap-1.5">
            <Briefcase className="h-3.5 w-3.5" />
            التنقل الداخلي
          </TabsTrigger>
          <TabsTrigger value="mentoring" className="text-xs py-2 gap-1.5">
            <Users2 className="h-3.5 w-3.5" />
            التوجيه المهني
          </TabsTrigger>
        </TabsList>

        {/* =================================================================== */}
        {/* TAB 1: OVERVIEW & EXECUTIVE TALENT KPIS                              */}
        {/* =================================================================== */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
            <Card className="shadow-xs">
              <CardContent className="p-4 flex flex-col justify-between h-full">
                <span className="text-[11px] font-bold text-muted-foreground">الوظائف الحرجة</span>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-2xl font-black font-mono">{kpis?.criticalRolesCount ?? 0}</span>
                  <Badge variant="outline" className="text-[10px] text-rose-600 border-rose-300">
                    {kpis?.rolesWithoutSuccessor ?? 0} بدون خليفة
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-xs">
              <CardContent className="p-4 flex flex-col justify-between h-full">
                <span className="text-[11px] font-bold text-muted-foreground">تغطية التعاقب</span>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-2xl font-black font-mono text-emerald-600">
                    {kpis?.successionCoverageRate ?? 0}%
                  </span>
                  <Badge variant="outline" className="text-[10px]">المستهدف 80%</Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-xs">
              <CardContent className="p-4 flex flex-col justify-between h-full">
                <span className="text-[11px] font-bold text-muted-foreground">جاهز فوراً (قوة البدلاء)</span>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-2xl font-black font-mono text-teal-600">
                    {kpis?.benchStrengthRate ?? 0}%
                  </span>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {kpis?.readyNowSuccessorsCount ?? 0} كادر
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-xs">
              <CardContent className="p-4 flex flex-col justify-between h-full">
                <span className="text-[11px] font-bold text-muted-foreground">مواهب واعدة (HiPo)</span>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-2xl font-black font-mono text-amber-600">
                    {kpis?.highPotentialCount ?? 0}
                  </span>
                  <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600">
                    معايرة معتمدة
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-xs">
              <CardContent className="p-4 flex flex-col justify-between h-full">
                <span className="text-[11px] font-bold text-muted-foreground">فرص التنقل النشطة</span>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-2xl font-black font-mono text-blue-600">
                    {kpis?.activeInternalOpps ?? 0}
                  </span>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {kpis?.internalApplicationsCount ?? 0} طلب
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-xs">
              <CardContent className="p-4 flex flex-col justify-between h-full">
                <span className="text-[11px] font-bold text-muted-foreground">إجراءات تطوير متأخرة</span>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-2xl font-black font-mono text-rose-600">
                    {kpis?.overdueActionsCount ?? 0}
                  </span>
                  <Badge variant="outline" className="text-[10px] text-rose-600 border-rose-300">
                    تتطلب متابعة
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Insights Banner */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="md:col-span-2 shadow-xs">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Award className="h-4 w-4 text-primary" />
                    الوظائف الحرجة التي تفتقر لخلفاء جاهزين (Key Person Dependency Risks)
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setActiveTab("succession")}>
                    عرض كل الخطط
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-2">
                {criticalRoles.filter((cr) => cr.vacancyRisk === "high" || cr.vacancyRisk === "critical").length === 0 ? (
                  <div className="p-6 text-center text-xs text-muted-foreground border rounded-lg">
                    لا توجد وظائف حرجة بمخاطر شغور مرتفعة حالياً
                  </div>
                ) : (
                  criticalRoles.slice(0, 4).map((cr) => (
                    <div
                      key={cr.id}
                      className="p-3 bg-muted/20 border rounded-lg flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-bold block text-sm">{cr.positionTitleAr}</span>
                        <span className="text-muted-foreground">{cr.departmentNameAr || "الإدارة العامة"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={
                            cr.vacancyRisk === "critical"
                              ? "bg-rose-500/10 text-rose-600 border-rose-300 font-bold"
                              : "bg-amber-500/10 text-amber-600 border-amber-300"
                          }
                        >
                          خطر الشغور: {cr.vacancyRisk}
                        </Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const plan = successionPlans.find((p) => p.jobPositionId === cr.jobPositionId);
                            if (plan) {
                              setTargetPlan({ id: plan.id, roleTitle: cr.positionTitleAr || "" });
                              setIsNominateModalOpen(true);
                            }
                          }}
                        >
                          ترشيح خليفة
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="shadow-xs">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  مجمعات المواهب النشطة
                </CardTitle>
                <CardDescription className="text-xs">
                  الكوادر المدرجة في برامج التطوير القيادي
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-2.5">
                {talentPools.slice(0, 4).map((pool) => (
                  <div key={pool.id} className="p-2.5 border rounded-lg flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold block">{pool.nameAr}</span>
                      <span className="text-[11px] text-muted-foreground font-mono">{pool.code}</span>
                    </div>
                    <Badge variant="secondary" className="font-mono">
                      {pool.memberCount} عضو
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* =================================================================== */}
        {/* TAB 2: PROFILES & CAREER ASPIRATIONS (ESS/MSS INTEGRATION)          */}
        {/* =================================================================== */}
        <TabsContent value="profiles" className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="h-4 w-4 absolute right-3 top-2.5 text-muted-foreground" />
              <Input
                placeholder="البحث باسم الموظف أو الرقم الوظيفي..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-9 h-9 text-xs"
              />
            </div>
          </div>

          <div className="border rounded-lg overflow-hidden bg-card">
            <table className="w-full text-xs text-right">
              <thead className="bg-muted/50 border-b font-bold text-muted-foreground">
                <tr>
                  <th className="p-3">الموظف</th>
                  <th className="p-3">المسمى الحالي</th>
                  <th className="p-3 text-center">إجراءات المواءمة المهنية</th>
                  <th className="p-3 text-center">الطموحات والتنقل</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {employees
                  .filter((e) => !searchTerm || e.name.includes(searchTerm) || e.employeeNo.includes(searchTerm))
                  .slice(0, 15)
                  .map((emp) => (
                    <tr key={emp.id} className="hover:bg-muted/20">
                      <td className="p-3 font-semibold">
                        <div>{emp.name}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">{emp.employeeNo}</div>
                      </td>
                      <td className="p-3 text-muted-foreground">{emp.jobTitle || "موظف"}</td>
                      <td className="p-3 text-center">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCalculateReadiness(emp.id, emp.name, emp.jobPositionId)}
                          className="gap-1 text-[11px]"
                        >
                          <Target className="h-3.5 w-3.5 text-primary" />
                          قياس الجاهزية وسد الفجوات
                        </Button>
                      </td>
                      <td className="p-3 text-center">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setTargetEmployee({ id: emp.id, name: emp.name });
                            setIsAspirationModalOpen(true);
                          }}
                          className="gap-1 text-[11px]"
                        >
                          <Compass className="h-3.5 w-3.5 text-blue-500" />
                          الطموحات المهنية
                        </Button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Readiness Result Drawer / Modal Preview */}
          {readinessResult && (
            <Card className="mt-4 border-primary/30 bg-primary/5">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />
                    تقرير الجاهزية الوظيفية الفعلي: {readinessResult.employeeName}
                  </CardTitle>
                  <Button size="sm" variant="ghost" onClick={() => setReadinessResult(null)}>
                    إغلاق
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-3 text-xs">
                <div className="flex items-center gap-4">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">مستوى الجاهزية المحسوب:</span>
                    <Badge variant="outline" className="font-bold text-xs mt-0.5">
                      {readinessResult.readiness === "ready" && "جاهز فوراً للترقية"}
                      {readinessResult.readiness === "near_ready" && "قريب من الجاهزية"}
                      {readinessResult.readiness === "development_required" && "يتطلب خطة تطوير مهارات"}
                      {readinessResult.readiness === "not_ready" && "غير مستوفٍ للشروط"}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">نسبة تطابق المهارات:</span>
                    <span className="font-mono font-bold text-sm text-foreground">
                      {readinessResult.matchScore}%
                    </span>
                  </div>
                </div>

                {readinessResult.missingSkills.length > 0 && (
                  <div>
                    <span className="font-bold block mb-1 text-rose-600">الفجوات المهارية المرصودة:</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {readinessResult.missingSkills.map((sk: any, idx: number) => (
                        <div key={idx} className="p-2 border rounded bg-background flex justify-between">
                          <span>{sk.name_ar}</span>
                          <span className="font-mono text-muted-foreground">
                            المطلوب: {sk.required} | الحالي: {sk.current} (فجوة: {sk.gap})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* =================================================================== */}
        {/* TAB 3: CAREER PATHS & TRANSITION RULES                              */}
        {/* =================================================================== */}
        <TabsContent value="paths" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold">هندسة المسارات والتدرج الوظيفي (Career Architecture)</h3>
              <p className="text-xs text-muted-foreground">
                المسارات الرأسية والأفقية والقيادية ومعايير الانتقال المعتمدة
              </p>
            </div>
            <Button size="sm" onClick={() => setIsPathModalOpen(true)} className="gap-1.5 text-xs">
              <Plus className="h-4 w-4" />
              تصميم مسار جديد
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {careerPaths.map((path) => {
              const typeInfo = formatCareerPathType(path.pathType);
              return (
                <Card key={path.id} className="shadow-xs">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-sm font-bold">{path.titleAr}</CardTitle>
                        <CardDescription className="text-xs font-mono">{path.code}</CardDescription>
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        {typeInfo.ar}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 space-y-3">
                    <p className="text-xs text-muted-foreground">{path.descriptionAr || "لا توجد شروط إضافية"}</p>

                    {/* Path Steps */}
                    <div className="space-y-2 border-t pt-2">
                      <span className="text-[11px] font-bold block text-muted-foreground">محطات التدرج:</span>
                      {path.steps && path.steps.length > 0 ? (
                        path.steps.map((step) => (
                          <div
                            key={step.id}
                            className="p-2 bg-muted/20 border rounded-md flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-muted-foreground">
                                #{step.stepOrder}
                              </span>
                              <span className="font-bold">{step.jobTitleAr}</span>
                              {step.targetGrade && (
                                <Badge variant="secondary" className="text-[9px] font-mono">
                                  {step.targetGrade}
                                </Badge>
                              )}
                            </div>
                            <div className="text-[11px] text-muted-foreground font-mono">
                              {step.minTenureMonths} شهر | أداء {step.requiredPerformanceRating}+
                            </div>
                          </div>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground">لم يتم ربط محطات تدرج</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* =================================================================== */}
        {/* TAB 4: 9-BOX MATRIX & TALENT CALIBRATION GRID                       */}
        {/* =================================================================== */}
        <TabsContent value="nine_box" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold">مصفوفة 9-Box والمعايرة المؤسسية</h3>
              <p className="text-xs text-muted-foreground">
                تقاطع الأداء الفعلي مع الإمكانيات والنمو لترشيح القيادات ومعالجة التعثر
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Label className="text-xs font-semibold whitespace-nowrap">دورة المراجعة:</Label>
              <select
                className="flex h-8 rounded-md border border-input bg-transparent px-2.5 py-1 text-xs shadow-xs focus-visible:outline-hidden"
                value={selectedCycleId}
                onChange={(e) => setSelectedCycleId(e.target.value)}
              >
                {reviewCycles.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.titleAr} ({c.year})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Interactive 3x3 Grid */}
          <div className="border rounded-xl p-4 bg-muted/10 space-y-3">
            {/* Header / Axis indicators */}
            <div className="flex justify-between text-xs font-bold text-muted-foreground px-2">
              <span>المحور الرأسي: الإمكانيات والنمو (Potential) ↑</span>
              <span>المحور الأفقي: الأداء الفعلي (Performance) →</span>
            </div>

            {/* 3 Rows of the 9-Box Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Row 1: High Potential (3A, 2A, 1A) */}
              {[
                { code: "3A" as NineBoxCellCode, perf: "low", pot: "high" },
                { code: "2A" as NineBoxCellCode, perf: "medium", pot: "high" },
                { code: "1A" as NineBoxCellCode, perf: "high", pot: "high" },
              ].map(({ code }) => {
                const info = getNineBoxCellInfo(code);
                const items = nineBoxMap.get(code) || [];
                return (
                  <div
                    key={code}
                    className={`p-3 rounded-lg border min-h-[140px] flex flex-col justify-between ${info.colorClass}`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs">{info.titleAr}</span>
                        <Badge variant="outline" className="font-mono text-[10px] bg-background">
                          {items.length} موظف
                        </Badge>
                      </div>
                      <p className="text-[10px] opacity-80 mt-1 line-clamp-2">{info.descriptionAr}</p>
                    </div>

                    <div className="mt-2 space-y-1">
                      {items.slice(0, 3).map((it) => (
                        <div
                          key={it.id}
                          className="text-[11px] bg-background/80 px-2 py-0.5 rounded flex items-center justify-between cursor-pointer hover:bg-background"
                          onClick={() => {
                            setAssessmentModalConfig({
                              employeeId: it.employeeId,
                              employeeName: it.employeeName || "",
                              initialPerf: it.calibratedPerformanceRating || it.performanceRating,
                              initialPot: it.calibratedPotentialRating || it.potentialRating,
                              isCalibration: true,
                            });
                            setIsAssessmentModalOpen(true);
                          }}
                        >
                          <span className="truncate">{it.employeeName}</span>
                          <span className="text-[9px] text-muted-foreground font-mono">
                            {it.status === "calibrated" ? "معاير" : "مقترح"}
                          </span>
                        </div>
                      ))}
                      {items.length > 3 && (
                        <div className="text-[10px] text-center opacity-70">
                          +{items.length - 3} آخرين
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Row 2: Medium Potential (3B, 2B, 1B) */}
              {[
                { code: "3B" as NineBoxCellCode, perf: "low", pot: "medium" },
                { code: "2B" as NineBoxCellCode, perf: "medium", pot: "medium" },
                { code: "1B" as NineBoxCellCode, perf: "high", pot: "medium" },
              ].map(({ code }) => {
                const info = getNineBoxCellInfo(code);
                const items = nineBoxMap.get(code) || [];
                return (
                  <div
                    key={code}
                    className={`p-3 rounded-lg border min-h-[140px] flex flex-col justify-between ${info.colorClass}`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs">{info.titleAr}</span>
                        <Badge variant="outline" className="font-mono text-[10px] bg-background">
                          {items.length} موظف
                        </Badge>
                      </div>
                      <p className="text-[10px] opacity-80 mt-1 line-clamp-2">{info.descriptionAr}</p>
                    </div>

                    <div className="mt-2 space-y-1">
                      {items.slice(0, 3).map((it) => (
                        <div
                          key={it.id}
                          className="text-[11px] bg-background/80 px-2 py-0.5 rounded flex items-center justify-between cursor-pointer hover:bg-background"
                          onClick={() => {
                            setAssessmentModalConfig({
                              employeeId: it.employeeId,
                              employeeName: it.employeeName || "",
                              initialPerf: it.calibratedPerformanceRating || it.performanceRating,
                              initialPot: it.calibratedPotentialRating || it.potentialRating,
                              isCalibration: true,
                            });
                            setIsAssessmentModalOpen(true);
                          }}
                        >
                          <span className="truncate">{it.employeeName}</span>
                          <span className="text-[9px] text-muted-foreground font-mono">
                            {it.status === "calibrated" ? "معاير" : "مقترح"}
                          </span>
                        </div>
                      ))}
                      {items.length > 3 && (
                        <div className="text-[10px] text-center opacity-70">
                          +{items.length - 3} آخرين
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Row 3: Low Potential (3C, 2C, 1C) */}
              {[
                { code: "3C" as NineBoxCellCode, perf: "low", pot: "low" },
                { code: "2C" as NineBoxCellCode, perf: "medium", pot: "low" },
                { code: "1C" as NineBoxCellCode, perf: "high", pot: "low" },
              ].map(({ code }) => {
                const info = getNineBoxCellInfo(code);
                const items = nineBoxMap.get(code) || [];
                return (
                  <div
                    key={code}
                    className={`p-3 rounded-lg border min-h-[140px] flex flex-col justify-between ${info.colorClass}`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs">{info.titleAr}</span>
                        <Badge variant="outline" className="font-mono text-[10px] bg-background">
                          {items.length} موظف
                        </Badge>
                      </div>
                      <p className="text-[10px] opacity-80 mt-1 line-clamp-2">{info.descriptionAr}</p>
                    </div>

                    <div className="mt-2 space-y-1">
                      {items.slice(0, 3).map((it) => (
                        <div
                          key={it.id}
                          className="text-[11px] bg-background/80 px-2 py-0.5 rounded flex items-center justify-between cursor-pointer hover:bg-background"
                          onClick={() => {
                            setAssessmentModalConfig({
                              employeeId: it.employeeId,
                              employeeName: it.employeeName || "",
                              initialPerf: it.calibratedPerformanceRating || it.performanceRating,
                              initialPot: it.calibratedPotentialRating || it.potentialRating,
                              isCalibration: true,
                            });
                            setIsAssessmentModalOpen(true);
                          }}
                        >
                          <span className="truncate">{it.employeeName}</span>
                          <span className="text-[9px] text-muted-foreground font-mono">
                            {it.status === "calibrated" ? "معاير" : "مقترح"}
                          </span>
                        </div>
                      ))}
                      {items.length > 3 && (
                        <div className="text-[10px] text-center opacity-70">
                          +{items.length - 3} آخرين
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>

        {/* =================================================================== */}
        {/* TAB 5: TALENT POOLS (HIPO, LEADERSHIP, TECHNICAL)                    */}
        {/* =================================================================== */}
        <TabsContent value="pools" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold">مجمعات المواهب المؤسسية (Enterprise Talent Pools)</h3>
              <p className="text-xs text-muted-foreground">
                إدارة برامج القيادات الواعدة والمواهب التقنية الحرجة
              </p>
            </div>
            <Button size="sm" onClick={() => setIsPoolModalOpen(true)} className="gap-1.5 text-xs">
              <Plus className="h-4 w-4" />
              إنشاء مجمع جديد
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {talentPools.map((pool) => (
              <Card key={pool.id} className="shadow-xs">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-sm font-bold">{pool.nameAr}</CardTitle>
                      <CardDescription className="text-xs font-mono">{pool.code}</CardDescription>
                    </div>
                    <Badge variant="secondary" className="font-mono text-xs">
                      {pool.memberCount} عضو
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-3">
                  <p className="text-xs text-muted-foreground">{pool.descriptionAr || "لا توجد تفاصيل إضافية"}</p>
                  <div className="flex items-center justify-between pt-2 border-t text-[11px] text-muted-foreground">
                    <span>النوع: {pool.poolType}</span>
                    {pool.isConfidential && (
                      <Badge variant="outline" className="text-[9px] text-amber-600 border-amber-300">
                        مجمع سري
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* =================================================================== */}
        {/* TAB 6: SUCCESSION PLANNING & CRITICAL ROLES                         */}
        {/* =================================================================== */}
        <TabsContent value="succession" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold">خطط التعاقب الوظيفي للوظائف والقيادات الحرجة</h3>
              <p className="text-xs text-muted-foreground">
                تحديد البدلاء وتدرج الجاهزية لحماية استمرارية الأعمال
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {successionPlans.map((plan) => (
              <Card key={plan.id} className="shadow-xs">
                <CardHeader className="pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <Award className="h-4 w-4 text-primary" />
                        {plan.positionTitleAr}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        شاغل المنصب الحالي: <span className="font-bold text-foreground">{plan.incumbentName || "شاغر حالياً"}</span>
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-xs">
                        جاهز فوراً: {plan.readyNowCount}
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setTargetPlan({ id: plan.id, roleTitle: plan.positionTitleAr || "" });
                          setIsNominateModalOpen(true);
                        }}
                        className="gap-1 text-xs"
                      >
                        <Plus className="h-3 w-3" />
                        ترشيح خليفة
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  {/* Succession Candidates Table */}
                  <div className="border rounded-md overflow-hidden bg-background">
                    <table className="w-full text-xs text-right">
                      <thead className="bg-muted/40 border-b font-bold text-muted-foreground">
                        <tr>
                          <th className="p-2.5">المرتبة</th>
                          <th className="p-2.5">المرشح الخليفة</th>
                          <th className="p-2.5">أفق الجاهزية</th>
                          <th className="p-2.5">حالة الترشيح</th>
                          <th className="p-2.5">طوارئ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {plan.candidates && plan.candidates.length > 0 ? (
                          plan.candidates.map((cand) => {
                            const tl = formatReadinessTimeline(cand.readinessTimeline);
                            return (
                              <tr key={cand.id}>
                                <td className="p-2.5 font-bold font-mono">#{cand.ranking}</td>
                                <td className="p-2.5 font-semibold">
                                  {cand.employeeName}
                                  <span className="text-[10px] text-muted-foreground block font-mono">
                                    {cand.employeeNo}
                                  </span>
                                </td>
                                <td className="p-2.5">
                                  <Badge variant="outline" className={`text-[10px] ${tl.badgeClass}`}>
                                    {tl.ar}
                                  </Badge>
                                </td>
                                <td className="p-2.5 text-muted-foreground">{cand.status}</td>
                                <td className="p-2.5">
                                  {cand.isEmergencySuccessor && (
                                    <Badge variant="outline" className="text-[9px] bg-rose-500/10 text-rose-600 border-rose-300">
                                      طوارئ
                                    </Badge>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={5} className="p-4 text-center text-muted-foreground">
                              لا يوجد خلفاء مرشحون لهذه الوظيفة حالياً. يرجى المبادرة بالترشيح.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* =================================================================== */}
        {/* TAB 7: INTERNAL MOBILITY & JOB MARKETPLACE                          */}
        {/* =================================================================== */}
        <TabsContent value="mobility" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold">سوق التنقل الوظيفي الداخلي (Internal Mobility Marketplace)</h3>
              <p className="text-xs text-muted-foreground">
                ربط الموظفين بالفرص والتكليفات الداخلية ونقل الكفاءات دون فقدان الحقيقة التاريخية
              </p>
            </div>
            <Button size="sm" onClick={() => setIsOppModalOpen(true)} className="gap-1.5 text-xs">
              <Plus className="h-4 w-4" />
              نشر فرصة جديدة
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {internalOpportunities.map((opp) => (
              <Card key={opp.id} className="shadow-xs">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-sm font-bold">{opp.titleAr}</CardTitle>
                      <CardDescription className="text-xs">
                        {opp.departmentNameAr || "عامة"} | {opp.targetGrade || "G07"}
                      </CardDescription>
                    </div>
                    <Badge variant={opp.status === "open" ? "default" : "secondary"} className="text-[10px]">
                      {opp.status === "open" ? "متاحة للتقديم" : opp.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-3">
                  <p className="text-xs text-muted-foreground line-clamp-2">{opp.descriptionAr || "لا توجد تفاصيل إضافية"}</p>
                  <div className="flex items-center justify-between pt-2 border-t text-xs">
                    <span className="text-muted-foreground font-mono">
                      {opp.applicationCount} متقدم داخلي
                    </span>
                    {opp.status === "open" && (
                      <Button
                        size="sm"
                        onClick={() => {
                          setTargetOpp(opp);
                          setIsApplyModalOpen(true);
                        }}
                      >
                        تقديم طلب انتقال
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Internal Applications Management for HR / Mobility Committee */}
          <div className="mt-6 space-y-2">
            <h4 className="text-xs font-bold text-muted-foreground">طلبات التقديم الداخلي الواردة</h4>
            <div className="border rounded-lg overflow-hidden bg-card">
              <table className="w-full text-xs text-right">
                <thead className="bg-muted/50 border-b font-bold text-muted-foreground">
                  <tr>
                    <th className="p-3">الموظف المتقدم</th>
                    <th className="p-3">الفرصة المستهدفة</th>
                    <th className="p-3">نسبة المواءمة</th>
                    <th className="p-3">الحالة</th>
                    <th className="p-3 text-center">القرار والربط بالحركات الوظيفية</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {internalApplications.length > 0 ? (
                    internalApplications.map((app) => (
                      <tr key={app.id}>
                        <td className="p-3 font-semibold">
                          {app.employeeName}
                          <span className="text-[10px] text-muted-foreground block font-mono">
                            {app.employeeNo}
                          </span>
                        </td>
                        <td className="p-3">{app.opportunityTitleAr}</td>
                        <td className="p-3">
                          <Badge variant="outline" className="font-mono font-bold text-emerald-600 border-emerald-300">
                            {app.matchScore}%
                          </Badge>
                        </td>
                        <td className="p-3 text-muted-foreground">{app.status}</td>
                        <td className="p-3 text-center">
                          {app.status !== "selected" ? (
                            <Button
                              size="sm"
                              onClick={() => handleSelectCandidate(app.id, app.employeeName || "")}
                              className="text-[11px] gap-1"
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              تعيين ونقل وظيفي
                            </Button>
                          ) : (
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-300">
                              تم التعيين والربط بحركة وظيفية
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-muted-foreground">
                        لا توجد طلبات تقديم داخلي مسجلة حتى الآن
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* =================================================================== */}
        {/* TAB 8: MENTORING & CAREER CONVERSATIONS                             */}
        {/* =================================================================== */}
        <TabsContent value="mentoring" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold">التوجيه المهني والمحادثات المهنية (Mentorship & Conversations)</h3>
              <p className="text-xs text-muted-foreground">
                توثيق علاقات التوجيه وجلسات الحوار المهني بين الموظف والمدير
              </p>
            </div>
            <Button size="sm" onClick={() => setIsMentoringModalOpen(true)} className="gap-1.5 text-xs">
              <Plus className="h-4 w-4" />
              تفعيل شراكة توجيه
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="shadow-xs">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Users2 className="h-4 w-4 text-primary" />
                  شراكات التوجيه الفعالة
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-2">
                {mentoringList.length > 0 ? (
                  mentoringList.map((m) => (
                    <div key={m.id} className="p-3 bg-muted/20 border rounded-lg text-xs space-y-1">
                      <div className="flex justify-between font-bold">
                        <span>الموجه: {m.mentorName}</span>
                        <span className="text-primary">المسترشد: {m.menteeName}</span>
                      </div>
                      <p className="text-muted-foreground text-[11px]">{m.objectiveAr}</p>
                    </div>
                  ))
                ) : (
                  <div className="p-6 text-center text-xs text-muted-foreground border rounded-lg">
                    لا توجد شراكات توجيه نشطة حالياً
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-xs">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Compass className="h-4 w-4 text-primary" />
                  سجل المحادثات المهنية (Career Conversations)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-2">
                {conversations.length > 0 ? (
                  conversations.map((conv) => (
                    <div key={conv.id} className="p-3 bg-muted/20 border rounded-lg text-xs space-y-1">
                      <div className="flex justify-between font-bold">
                        <span>الموظف: {conv.employeeName}</span>
                        <span className="text-muted-foreground font-mono">{conv.conversationDate}</span>
                      </div>
                      <p className="text-muted-foreground text-[11px]">{conv.careerGoalsDiscussed}</p>
                    </div>
                  ))
                ) : (
                  <div className="p-6 text-center text-xs text-muted-foreground border rounded-lg">
                    لا توجد محادثات مهنية مسجلة
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Modals Rendering */}
      <CreateCareerPathModal
        isOpen={isPathModalOpen}
        onClose={() => setIsPathModalOpen(false)}
        onSuccess={() => {
          refetchPaths();
          refetchKpis();
        }}
        companyId={companyId}
      />

      {targetEmployee && (
        <CareerAspirationsModal
          isOpen={isAspirationModalOpen}
          onClose={() => {
            setIsAspirationModalOpen(false);
            setTargetEmployee(null);
          }}
          onSuccess={() => {
            refetchKpis();
          }}
          companyId={companyId}
          employeeId={targetEmployee.id}
          employeeName={targetEmployee.name}
        />
      )}

      {assessmentModalConfig && (
        <TalentAssessmentModal
          isOpen={isAssessmentModalOpen}
          onClose={() => {
            setIsAssessmentModalOpen(false);
            setAssessmentModalConfig(null);
          }}
          onSuccess={() => {
            refetchAssessments();
            refetchKpis();
          }}
          companyId={companyId}
          cycles={reviewCycles}
          employeeId={assessmentModalConfig.employeeId}
          employeeName={assessmentModalConfig.employeeName}
          initialPerformance={assessmentModalConfig.initialPerf}
          initialPotential={assessmentModalConfig.initialPot}
          isCalibration={assessmentModalConfig.isCalibration}
        />
      )}

      <CreateTalentPoolModal
        isOpen={isPoolModalOpen}
        onClose={() => setIsPoolModalOpen(false)}
        onSuccess={() => {
          refetchPools();
          refetchKpis();
        }}
        companyId={companyId}
      />

      {targetPlan && (
        <NominateSuccessorModal
          isOpen={isNominateModalOpen}
          onClose={() => {
            setIsNominateModalOpen(false);
            setTargetPlan(null);
          }}
          onSuccess={() => {
            refetchSuccession();
            refetchKpis();
          }}
          companyId={companyId}
          planId={targetPlan.id}
          roleTitle={targetPlan.roleTitle}
          employees={employees}
        />
      )}

      <CreateInternalOpportunityModal
        isOpen={isOppModalOpen}
        onClose={() => setIsOppModalOpen(false)}
        onSuccess={() => {
          refetchOpps();
          refetchKpis();
        }}
        companyId={companyId}
        departments={departments}
      />

      {targetOpp && (
        <InternalApplicationModal
          isOpen={isApplyModalOpen}
          onClose={() => {
            setIsApplyModalOpen(false);
            setTargetOpp(null);
          }}
          onSuccess={() => {
            refetchApps();
            refetchOpps();
            refetchKpis();
          }}
          companyId={companyId}
          opportunity={targetOpp}
          employeeId={employees[0]?.id || ""}
        />
      )}

      <MentoringModal
        isOpen={isMentoringModalOpen}
        onClose={() => setIsMentoringModalOpen(false)}
        onSuccess={() => {
          refetchMentoring();
          refetchKpis();
        }}
        companyId={companyId}
        employees={employees}
      />
    </div>
  );
};
