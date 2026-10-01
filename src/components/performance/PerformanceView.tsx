import React, { useState } from "react";
import { useApp } from "../../lib/context/AppContext";
import { canManageModule } from "../../lib/auth/permissions";
import { IconSymbol } from "../ui/IconSymbol";
import {
  Award,
  Star,
  CheckCircle2,
  Users,
  Target,
  BarChart3,
  Calendar,
  Plus,
  TrendingUp,
  LayoutGrid,
  ShieldCheck,
  Scale,
  BookOpen,
  Sparkles,
  AlertCircle,
  Clock,
  ArrowUpRight,
  Sliders,
  FileText,
  UserCheck,
  Check,
  Play,
  Lock,
} from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import { toast } from "sonner";
import {
  usePerformance,
  usePerformanceMutations,
  usePerformanceCycles,
  useCycleParticipants,
  usePerformanceGoals,
  useReviewAssignments,
  useMyReviews,
  useTeamReviews,
  useCalibrationSessions,
  useNineBoxData,
  useDevelopmentPlans,
  usePIPs,
  usePerformanceKPIs,
  useCompetencyFrameworks,
  useCompetencies,
  type PerformanceCycle,
  type PerformanceGoalCategory,
  type PerformanceGoalLevel,
  type ReviewType,
} from "../../lib/domains/performance";

export const PerformanceView: React.FC = () => {
  const { employees, currentUser, currentRole, openEmployeeProfile, language, t } = useApp();
  const canManage = canManageModule(currentRole, "performance");
  const [activeTab, setActiveTab] = useState("cycles");

  // Domain hooks & repository queries
  const { performanceCycles: cyclesCompat } = usePerformance();
  const mutations = usePerformanceMutations();

  const { data: cycles = [], isLoading: isLoadingCycles, refetch: refetchCycles } = usePerformanceCycles();
  const [selectedCycleId, setSelectedCycleId] = useState<string>("");

  // Determine active cycle ID safely
  const activeCycle = cycles.find((c) => c.id === selectedCycleId) || cycles[0];
  const currentCycleId = activeCycle?.id || "";

  // Data queries parameterized by selected cycle
  const { data: participants = [], isLoading: isLoadingParticipants } = useCycleParticipants(currentCycleId);
  const { data: goals = [], isLoading: isLoadingGoals } = usePerformanceGoals({ cycleId: currentCycleId });
  const { data: myReviews = [], isLoading: isLoadingMyReviews } = useMyReviews(currentCycleId);
  const { data: teamReviews = [], isLoading: isLoadingTeamReviews } = useTeamReviews(currentCycleId);
  const { data: allAssignments = [], isLoading: isLoadingAssignments } = useReviewAssignments({ cycleId: currentCycleId });
  const { data: calibrationSessions = [], isLoading: isLoadingCalibration } = useCalibrationSessions(currentCycleId);
  const { data: nineBoxData, isLoading: isLoadingNineBox } = useNineBoxData(currentCycleId);
  const { data: devPlans = [], isLoading: isLoadingDevPlans } = useDevelopmentPlans();
  const { data: pips = [], isLoading: isLoadingPIPs } = usePIPs();
  const { data: kpis } = usePerformanceKPIs(currentCycleId);
  const { data: frameworks = [] } = useCompetencyFrameworks();
  const { data: competencies = [] } = useCompetencies();

  // Modals state
  const [isAddCycleOpen, setIsAddCycleOpen] = useState(false);
  const [isSubmitGoalOpen, setIsSubmitGoalOpen] = useState(false);
  const [isUpdateGoalProgressOpen, setIsUpdateGoalProgressOpen] = useState(false);
  const [selectedGoalId, setSelectedGoalId] = useState("");
  const [newGoalProgress, setNewGoalProgress] = useState<number>(0);
  const [goalProgressNote, setGoalProgressNote] = useState("");

  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<any>(null);
  const [reviewScoreGoals, setReviewScoreGoals] = useState<number>(4);
  const [reviewScoreCompetencies, setReviewScoreCompetencies] = useState<number>(4);
  const [reviewStrengths, setReviewStrengths] = useState("");
  const [reviewGrowth, setReviewGrowth] = useState("");
  const [reviewGeneral, setReviewGeneral] = useState("");

  const [isAssignPeersOpen, setIsAssignPeersOpen] = useState(false);
  const [targetPeerEmployeeId, setTargetPeerEmployeeId] = useState("");
  const [selectedPeerIds, setSelectedPeerIds] = useState<string[]>([]);
  const [isAnonymousPeers, setIsAnonymousPeers] = useState(true);

  const [isCalibrationModalOpen, setIsCalibrationModalOpen] = useState(false);
  const [selectedParticipantForCalib, setSelectedParticipantForCalib] = useState<any>(null);
  const [calibratedScore, setCalibratedScore] = useState<number>(4.0);
  const [calibratedLabel, setCalibratedLabel] = useState("أداء متميز (Exceeds)");
  const [calibrationReason, setCalibrationReason] = useState("");

  const [isAssessPotentialModalOpen, setIsAssessPotentialModalOpen] = useState(false);
  const [selectedParticipantForPotential, setSelectedParticipantForPotential] = useState<any>(null);
  const [potentialLevel, setPotentialLevel] = useState<"low" | "medium" | "high">("medium");
  const [potentialRationale, setPotentialRationale] = useState("");

  const [isCreateIDPOpen, setIsCreateIDPOpen] = useState(false);
  const [idpEmployeeId, setIdpEmployeeId] = useState("");
  const [idpTitle, setIdpTitle] = useState("");
  const [idpObjective, setIdpObjective] = useState("");
  const [idpActionType, setIdpActionType] = useState<any>("training");
  const [idpActivity, setIdpActivity] = useState("");
  const [idpSuccessMetric, setIdpSuccessMetric] = useState("");

  const [isCreatePIPOpen, setIsCreatePIPOpen] = useState(false);
  const [pipEmployeeId, setPipEmployeeId] = useState("");
  const [pipStartDate, setPipStartDate] = useState("");
  const [pipEndDate, setPipEndDate] = useState("");
  const [pipDeficiencies, setPipDeficiencies] = useState("");
  const [pipExpectedOutcomes, setPipExpectedOutcomes] = useState("");

  // Cycle creation form state
  const [cycleTitleAr, setCycleTitleAr] = useState("");
  const [cycleTitleEn, setCycleTitleEn] = useState("");
  const [cycleStartDate, setCycleStartDate] = useState("");
  const [cycleEndDate, setCycleEndDate] = useState("");
  const [cyclePeriodType, setCyclePeriodType] = useState<PerformanceCycle["periodType"]>("annual");
  const [cycleGoalsWeight, setCycleGoalsWeight] = useState(60);
  const [cycleCompetenciesWeight, setCycleCompetenciesWeight] = useState(40);
  const [cycleAllowPeers, setCycleAllowPeers] = useState(true);

  // Goal creation form state
  const [goalEmployeeId, setGoalEmployeeId] = useState("");
  const [goalCategory, setGoalCategory] = useState<PerformanceGoalCategory>("individual");
  const [goalLevel, setGoalLevel] = useState<PerformanceGoalLevel>("individual");
  const [goalTitleAr, setGoalTitleAr] = useState("");
  const [goalDescription, setGoalDescription] = useState("");
  const [goalTargetValue, setGoalTargetValue] = useState(100);
  const [goalWeight, setGoalWeight] = useState(25);

  // Handlers
  const handleCreateCycle = async () => {
    if (!cycleTitleAr.trim() || !cycleStartDate || !cycleEndDate) {
      toast.error("يرجى ملء جميع الحقول الإلزامية لدورة التقييم");
      return;
    }
    if (cycleGoalsWeight + cycleCompetenciesWeight !== 100) {
      toast.error("مجموع أوزان الأهداف والكفاءات يجب أن يساوي 100%");
      return;
    }

    const ok = await mutations.createCycle.mutateAsync({
      titleAr: cycleTitleAr,
      titleEn: cycleTitleEn || cycleTitleAr,
      periodType: cyclePeriodType,
      startDate: cycleStartDate,
      endDate: cycleEndDate,
      goalsWeightPct: cycleGoalsWeight,
      competenciesWeightPct: cycleCompetenciesWeight,
      allowPeerReviews: cycleAllowPeers,
    });

    if (ok) {
      setIsAddCycleOpen(false);
      setCycleTitleAr("");
      setCycleTitleEn("");
      setCycleStartDate("");
      setCycleEndDate("");
      refetchCycles();
    }
  };

  const handleLaunchCycle = async (cycleId: string) => {
    if (!confirm("هل أنت متأكد من إطلاق دورة التقييم وتجميد سجل الموظفين الحالي؟")) return;
    await mutations.launchCycle(cycleId);
    refetchCycles();
  };

  const handleFinalizeCycle = async (cycleId: string) => {
    if (!confirm("هل أنت متأكد من الاعتماد النهائي وإقفال دورة التقييم؟ ستصبح جميع النتائج للقراءة فقط وغير قابلة للتعديل.")) return;
    await mutations.finalizeCycle(cycleId);
    refetchCycles();
  };

  const handleCreateGoal = async () => {
    if (!currentCycleId) {
      toast.error("يرجى تحديد دورة تقييم نشطة أولاً");
      return;
    }
    if (!goalEmployeeId || !goalTitleAr.trim()) {
      toast.error("يرجى اختيار الموظف وعنوان الهدف");
      return;
    }
    if (goalWeight <= 0 || goalWeight > 100) {
      toast.error("وزن الهدف يجب أن يكون بين 1% و 100%");
      return;
    }

    const ok = await mutations.submitGoal({
      cycleId: currentCycleId,
      employeeId: goalEmployeeId,
      category: goalCategory,
      level: goalLevel,
      titleAr: goalTitleAr,
      description: goalDescription,
      targetValue: goalTargetValue,
      weight: goalWeight,
      startValue: 0,
      metricType: "percentage",
    });

    if (ok) {
      setIsSubmitGoalOpen(false);
      setGoalTitleAr("");
      setGoalDescription("");
    }
  };

  const handleUpdateGoalProgress = async () => {
    if (!selectedGoalId) return;
    const ok = await mutations.updateGoalProgress(
      selectedGoalId,
      newGoalProgress,
      newGoalProgress,
      goalProgressNote
    );
    if (ok) {
      setIsUpdateGoalProgressOpen(false);
      setGoalProgressNote("");
    }
  };

  const handleSubmitReview = async () => {
    if (!selectedAssignment) return;
    const ok = await mutations.submitReview({
      assignmentId: selectedAssignment.id,
      scores: [
        {
          item_type: "goal",
          item_id: "goals-aggregate",
          score: reviewScoreGoals,
          weight_pct: 60,
          comment: "تقييم إنجاز الأهداف والمستهدفات الذكية",
        },
        {
          item_type: "competency",
          item_id: "competencies-aggregate",
          score: reviewScoreCompetencies,
          weight_pct: 40,
          comment: "تقييم الكفاءات السلوكية والقيادية",
        },
      ],
      strengthsSummary: reviewStrengths,
      growthAreasSummary: reviewGrowth,
      generalFeedback: reviewGeneral,
    });

    if (ok) {
      setIsReviewModalOpen(false);
      setSelectedAssignment(null);
      setReviewStrengths("");
      setReviewGrowth("");
      setReviewGeneral("");
    }
  };

  const handleAssignPeers = async () => {
    if (!currentCycleId || !targetPeerEmployeeId || selectedPeerIds.length === 0) {
      toast.error("يرجى تحديد الموظف واختيار الزملاء المقيّمين");
      return;
    }

    const ok = await mutations.assignPeerReviewers(
      currentCycleId,
      targetPeerEmployeeId,
      selectedPeerIds,
      isAnonymousPeers
    );

    if (ok) {
      setIsAssignPeersOpen(false);
      setTargetPeerEmployeeId("");
      setSelectedPeerIds([]);
    }
  };

  const handleSaveCalibration = async () => {
    if (!selectedParticipantForCalib || !calibrationSessions[0]?.id) {
      toast.error("لا توجد جلسة معايرة نشطة مرتبطة بهذه الدورة");
      return;
    }
    if (!calibrationReason.trim()) {
      toast.error("يرجى توثيق سبب المعايرة والموازنة");
      return;
    }

    const ok = await mutations.adjustCalibration({
      sessionId: calibrationSessions[0].id,
      participantId: selectedParticipantForCalib.id,
      calibratedScore,
      calibratedRatingLabel: calibratedLabel,
      calibrationReason,
    });

    if (ok) {
      setIsCalibrationModalOpen(false);
      setSelectedParticipantForCalib(null);
      setCalibrationReason("");
    }
  };

  const handleSavePotential = async () => {
    if (!selectedParticipantForPotential || !currentCycleId) return;

    const ok = await mutations.assessPotential({
      cycleId: currentCycleId,
      participantId: selectedParticipantForPotential.id,
      potentialLevel,
      rationale: potentialRationale,
    });

    if (ok) {
      setIsAssessPotentialModalOpen(false);
      setSelectedParticipantForPotential(null);
      setPotentialRationale("");
    }
  };

  const handleSaveIDP = async () => {
    if (!idpEmployeeId || !idpTitle.trim() || !idpObjective.trim()) {
      toast.error("يرجى ملء الحقول الإلزامية لخطة التطوير");
      return;
    }

    const ok = await mutations.saveDevelopmentPlan({
      cycleId: currentCycleId || undefined,
      employeeId: idpEmployeeId,
      titleAr: idpTitle,
      items: [
        {
          objectiveAr: idpObjective,
          actionType: idpActionType,
          activityDescription: idpActivity || idpObjective,
          successMetric: idpSuccessMetric || "إتمام البرنامج بنجاح",
          targetDate: new Date(new Date().getTime() + 90 * 24 * 3600 * 1000).toISOString().split("T")[0],
        },
      ],
    });

    if (ok) {
      setIsCreateIDPOpen(false);
      setIdpTitle("");
      setIdpObjective("");
      setIdpActivity("");
      setIdpSuccessMetric("");
    }
  };

  const handleSavePIP = async () => {
    if (!pipEmployeeId || !pipStartDate || !pipEndDate || !pipDeficiencies.trim()) {
      toast.error("يرجى استكمال بيانات خطة تصحيح الأداء الإلزامية");
      return;
    }

    const ok = await mutations.createPIP({
      cycleId: currentCycleId || undefined,
      employeeId: pipEmployeeId,
      startDate: pipStartDate,
      endDate: pipEndDate,
      performanceDeficiencies: pipDeficiencies,
      expectedOutcomes: pipExpectedOutcomes,
    });

    if (ok) {
      setIsCreatePIPOpen(false);
      setPipDeficiencies("");
      setPipExpectedOutcomes("");
    }
  };

  return (
    <div className="space-y-6">
      {/* Executive Header */}
      <div className="classera-page-header">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-xs">
              <IconSymbol name="trending_up" source="material" filled size={24} className="text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-foreground">
                  {t.performance.cycles} وإدارة الأداء الشامل (360° & OKRs)
                </h1>
                <Badge variant="outline" className="text-[11px] font-bold border-primary/30 text-primary bg-primary/5 rounded-full px-2.5 py-0.5">
                  Enterprise Grade
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground font-medium mt-0.5">
                إدارة دورات التقييم، الأهداف الذكية، تقييمات 360 درجة، جلسات المعايرة، مصفوفة 9-Box، وخطط التطوير الفردية
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Active Cycle Selector */}
          {cycles.length > 0 && (
            <div className="flex items-center gap-1.5 bg-card border border-border/80 rounded-2xl px-3 py-1.5 shadow-xs">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <select
                value={selectedCycleId || currentCycleId}
                onChange={(e) => setSelectedCycleId(e.target.value)}
                className="text-xs font-bold bg-transparent text-foreground focus:outline-none cursor-pointer"
              >
                {cycles.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.titleAr} ({c.status})
                  </option>
                ))}
              </select>
            </div>
          )}

          {canManage && (
            <>
              <Button
                onClick={() => setIsAddCycleOpen(true)}
                variant="outline"
                size="sm"
                className="rounded-full font-bold text-xs gap-1.5 border-border/80 hover:bg-secondary h-10 px-4 shadow-xs cursor-pointer"
              >
                <Plus className="h-4 w-4 text-primary" />
                دورة تقييم جديدة
              </Button>
              <Button
                onClick={() => setIsSubmitGoalOpen(true)}
                size="sm"
                className="classera-btn-primary rounded-full font-bold text-xs gap-1.5 shadow-xs h-10 px-5 cursor-pointer"
              >
                <Target className="h-4 w-4" />
                إضافة هدف ذكي (OKR)
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Primary KPI Stats Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="classera-kpi-card p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-muted-foreground">الدورات النشطة</span>
            <h4 className="text-xl font-black text-foreground mt-0.5 font-tabular-nums font-mono">
              {kpis?.activeCyclesCount ?? cycles.filter((c) => c.status === "open" || c.status === "review_in_progress").length}
            </h4>
            <span className="text-[10px] text-primary font-bold">من أصل {cycles.length} دورات</span>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-secondary flex items-center justify-center text-primary">
            <Calendar className="h-5 w-5" />
          </div>
        </div>

        <div className="classera-kpi-card p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-muted-foreground">المشاركون المعتمدون</span>
            <h4 className="text-xl font-black text-foreground mt-0.5 font-tabular-nums font-mono">
              {kpis?.totalParticipants ?? participants.length}
            </h4>
            <span className="text-[10px] text-emerald-600 font-bold">مجمّدون في الدورة</span>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
            <Users className="h-5 w-5" />
          </div>
        </div>

        <div className="classera-kpi-card p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-muted-foreground">نسبة إنجاز التقييم</span>
            <h4 className="text-xl font-black text-foreground mt-0.5 font-tabular-nums font-mono">
              {kpis?.overallCompletionRate ?? activeCycle?.completionRate ?? 0}%
            </h4>
            <span className="text-[10px] text-muted-foreground font-semibold">ذاتي ومباشر وزملاء</span>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-600">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>

        <div className="classera-kpi-card p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-muted-foreground">تقييمات الذاتية</span>
            <h4 className="text-xl font-black text-foreground mt-0.5 font-tabular-nums font-mono">
              {kpis?.selfReviewCompletionRate ?? 0}%
            </h4>
            <span className="text-[10px] text-indigo-600 font-bold">إنجاز الموظفين</span>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-600">
            <UserCheck className="h-5 w-5" />
          </div>
        </div>

        <div className="classera-kpi-card p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-muted-foreground">المواهب العليا (Top)</span>
            <h4 className="text-xl font-black text-foreground mt-0.5 font-tabular-nums font-mono">
              {kpis?.topPerformersCount ?? 0}
            </h4>
            <span className="text-[10px] text-amber-600 font-bold">مصفوفة 9-Box</span>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-600">
            <Sparkles className="h-5 w-5" />
          </div>
        </div>

        <div className="classera-kpi-card p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-muted-foreground">خطط التطوير (IDP)</span>
            <h4 className="text-xl font-black text-foreground mt-0.5 font-tabular-nums font-mono">
              {kpis?.idpCount ?? devPlans.length}
            </h4>
            <span className="text-[10px] text-teal-600 font-bold">{kpis?.pipCount ?? pips.length} قيد التحسين (PIP)</span>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-teal-500/10 flex items-center justify-center text-teal-600">
            <BookOpen className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Main Enterprise 8 Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="classera-tabs-strip w-full flex overflow-x-auto justify-start p-1.5 gap-1.5 scrollbar-none">
          <TabsTrigger value="cycles" className="rounded-xl text-xs font-bold py-2 whitespace-nowrap px-3.5">
            <Calendar className="h-3.5 w-3.5 me-1.5 inline" />
            الدورات والتخطيط ({cycles.length})
          </TabsTrigger>
          <TabsTrigger value="goals" className="rounded-xl text-xs font-bold py-2 whitespace-nowrap px-3.5">
            <Target className="h-3.5 w-3.5 me-1.5 inline" />
            الأهداف و OKRs ({goals.length})
          </TabsTrigger>
          <TabsTrigger value="my-reviews" className="rounded-xl text-xs font-bold py-2 whitespace-nowrap px-3.5">
            <UserCheck className="h-3.5 w-3.5 me-1.5 inline" />
            تقييماتي ({myReviews.length})
          </TabsTrigger>
          <TabsTrigger value="team-reviews" className="rounded-xl text-xs font-bold py-2 whitespace-nowrap px-3.5">
            <Users className="h-3.5 w-3.5 me-1.5 inline" />
            تقييمات فريقي ({teamReviews.length})
          </TabsTrigger>
          <TabsTrigger value="360" className="rounded-xl text-xs font-bold py-2 whitespace-nowrap px-3.5">
            <Award className="h-3.5 w-3.5 me-1.5 inline" />
            التقييم الشامل 360° ({allAssignments.filter((a) => a.reviewType === "peer").length})
          </TabsTrigger>
          <TabsTrigger value="calibration" className="rounded-xl text-xs font-bold py-2 whitespace-nowrap px-3.5">
            <Scale className="h-3.5 w-3.5 me-1.5 inline" />
            المعايرة والموازنة ({calibrationSessions.length})
          </TabsTrigger>
          <TabsTrigger value="ninebox" className="rounded-xl text-xs font-bold py-2 whitespace-nowrap px-3.5">
            <LayoutGrid className="h-3.5 w-3.5 me-1.5 inline" />
            مصفوفة 9-Box Grid
          </TabsTrigger>
          <TabsTrigger value="development" className="rounded-xl text-xs font-bold py-2 whitespace-nowrap px-3.5">
            <BookOpen className="h-3.5 w-3.5 me-1.5 inline" />
            خطط التطوير و PIP ({devPlans.length + pips.length})
          </TabsTrigger>
        </TabsList>

        {/* ------------------------------------------------------------- */}
        {/* TAB 1: CYCLES & PLANNING                                       */}
        {/* ------------------------------------------------------------- */}
        <TabsContent value="cycles" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 gap-4">
            {cycles.map((cyc) => {
              const isLocked = cyc.status === "finalized" || cyc.isLocked;
              return (
                <div key={cyc.id} className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-4">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <h2 className="text-base font-black text-foreground">{cyc.titleAr}</h2>
                        <Badge
                          variant="outline"
                          className={
                            cyc.status === "finalized"
                              ? "text-blue-700 bg-blue-50 border-blue-200 text-[10px] rounded-full px-2.5 font-bold"
                              : cyc.status === "open" || cyc.status === "review_in_progress"
                              ? "text-emerald-700 bg-emerald-50 border-emerald-200 text-[10px] rounded-full px-2.5 font-bold"
                              : "text-amber-700 bg-amber-50 border-amber-200 text-[10px] rounded-full px-2.5 font-bold"
                          }
                        >
                          {cyc.status === "draft" && "مسودة (Draft)"}
                          {cyc.status === "planned" && "مخططة (Planned)"}
                          {cyc.status === "open" && "مفتوحة لتحديد الأهداف"}
                          {cyc.status === "review_in_progress" && "التقييم قيد التنفيذ"}
                          {cyc.status === "calibration" && "مرحلة المعايرة والموازنة"}
                          {cyc.status === "finalized" && "معتمدة ومقفلة نهائياً (Locked)"}
                          {cyc.status === "archived" && "مؤرشفة"}
                        </Badge>
                        {isLocked && (
                          <Badge variant="outline" className="text-muted-foreground border-border text-[10px] rounded-full gap-1">
                            <Lock className="h-3 w-3" />
                            سجل مجمد
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground font-medium mt-1">
                        الفترة: من {cyc.startDate} إلى {cyc.endDate} | وزن الأهداف: {cyc.goalsWeightPct}% | وزن الكفاءات: {cyc.competenciesWeightPct}%
                      </p>
                    </div>

                    <div className="flex items-center gap-3.5">
                      <div className="text-end">
                        <span className="text-xs font-black text-foreground block">
                          {cyc.completionRate}% مكتمل
                        </span>
                        <p className="text-[10px] text-muted-foreground font-semibold">
                          {cyc.participantsCount} مشارك
                        </p>
                      </div>
                      <div className="h-2.5 w-28 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all"
                          style={{ width: `${cyc.completionRate}%` }}
                        />
                      </div>

                      {canManage && (
                        <div className="flex items-center gap-2 ms-2">
                          {(cyc.status === "draft" || cyc.status === "planned") && (
                            <Button
                              onClick={() => handleLaunchCycle(cyc.id)}
                              size="sm"
                              className="classera-btn-primary rounded-full text-xs font-bold h-8 px-3.5 gap-1.5 cursor-pointer"
                            >
                              <Play className="h-3.5 w-3.5" />
                              إطلاق وتجميد المشاركين
                            </Button>
                          )}
                          {cyc.status === "calibration" && (
                            <Button
                              onClick={() => handleFinalizeCycle(cyc.id)}
                              size="sm"
                              className="bg-blue-600 hover:bg-blue-700 text-white rounded-full text-xs font-bold h-8 px-3.5 gap-1.5 cursor-pointer"
                            >
                              <Lock className="h-3.5 w-3.5" />
                              اعتماد وإقفال نهائي
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Cycle Participants Breakdown */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-muted-foreground uppercase">
                        الموظفون المشاركون في الدورة ({participants.length})
                      </h3>
                      <span className="text-[11px] text-muted-foreground font-mono">
                        مقياس التقييم: {cyc.ratingScaleMin} إلى {cyc.ratingScaleMax}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {participants.slice(0, 6).map((p) => (
                        <div key={p.id} className="rounded-2xl border border-border/70 bg-muted/20 p-3.5 text-xs space-y-1.5 hover:bg-card transition-all">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-foreground">{p.employeeNameAr}</span>
                            <Badge variant="secondary" className="text-[10px] font-mono">
                              {p.finalOverallScore ? `★ ${p.finalOverallScore}` : "قيد التقييم"}
                            </Badge>
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            {p.jobTitle || "موظف"} | {p.departmentName || "عام"}
                          </p>
                          <div className="text-[10px] text-muted-foreground flex justify-between items-center border-t border-border/50 pt-1.5">
                            <span>المدير: {p.managerName || "غير محدد"}</span>
                            <span className="font-bold text-primary">{p.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* ------------------------------------------------------------- */}
        {/* TAB 2: GOALS & OKRs                                            */}
        {/* ------------------------------------------------------------- */}
        <TabsContent value="goals" className="space-y-4 pt-4">
          <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <h3 className="font-black text-sm text-foreground flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  الأهداف والمستهدفات الذكية (Cascading OKRs)
                </h3>
                <p className="text-xs text-muted-foreground font-medium mt-0.5">
                  أهداف مترابطة وموزونة بنسبة 100% مع تتبع تفصيلي لنسب الإنجاز وسجل تاريخي للتعديلات
                </p>
              </div>
              {canManage && (
                <Button
                  onClick={() => setIsSubmitGoalOpen(true)}
                  size="sm"
                  className="classera-btn-primary rounded-full text-xs font-bold h-9 px-4 gap-1.5 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  إضافة هدف
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {goals.map((g) => (
                <div key={g.id} className="rounded-2xl border border-border/80 p-4 bg-muted/10 space-y-3 hover:bg-card transition-all">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] font-bold">
                          {g.category === "individual" && "فردي"}
                          {g.category === "departmental" && "إداري"}
                          {g.category === "strategic" && "استراتيجي"}
                          {g.category === "operational" && "تشغيلي"}
                        </Badge>
                        <span className="text-xs font-bold text-foreground">{g.titleAr}</span>
                      </div>
                      {g.description && (
                        <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                          {g.description}
                        </p>
                      )}
                    </div>
                    <Badge variant="secondary" className="font-mono text-xs font-black">
                      وزن {g.weight}%
                    </Badge>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px] font-semibold text-muted-foreground">
                      <span>نسبة الإنجاز المحققة</span>
                      <span className="font-mono font-bold text-foreground">{g.progressPercentage}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${g.progressPercentage}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-border/60 pt-2 text-[10px] text-muted-foreground">
                    <span>
                      المستهدف: {g.targetValue} ({g.metricType})
                    </span>
                    <Button
                      onClick={() => {
                        setSelectedGoalId(g.id);
                        setNewGoalProgress(g.progressPercentage);
                        setIsUpdateGoalProgressOpen(true);
                      }}
                      variant="ghost"
                      size="sm"
                      className="h-7 text-[10px] font-bold text-primary hover:bg-primary/10 rounded-full px-2.5 cursor-pointer"
                    >
                      تحديث الإنجاز
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* ------------------------------------------------------------- */}
        {/* TAB 3: MY REVIEWS                                              */}
        {/* ------------------------------------------------------------- */}
        <TabsContent value="my-reviews" className="space-y-4 pt-4">
          <div className="rounded-3xl border border-border/80 bg-card overflow-hidden shadow-xs">
            <div className="p-4 border-b border-border/60 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-foreground">التقييمات الموكلة إليّ</h3>
                <p className="text-xs text-muted-foreground mt-0.5">تقييماتك الذاتية وتقييمات الزملاء والموظفين المكلف بتقييمهم</p>
              </div>
            </div>
            <table className="w-full text-xs">
              <thead className="border-b border-border/60 bg-muted/40 font-bold text-muted-foreground">
                <tr>
                  <th className="py-3 px-4 text-start">الموظف المعني</th>
                  <th className="py-3 px-4 text-start">نوع التقييم</th>
                  <th className="py-3 px-4 text-start">الحالة</th>
                  <th className="py-3 px-4 text-start">تاريخ الاستحقاق</th>
                  <th className="py-3 px-4 text-end">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {myReviews.map((rev) => (
                  <tr key={rev.id} className="hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-4 font-bold text-foreground">{rev.employeeName}</td>
                    <td className="py-3 px-4">
                      <Badge variant="outline" className="text-[10px] font-bold">
                        {rev.reviewType === "self" && "تقييم ذاتي (Self)"}
                        {rev.reviewType === "manager" && "تقييم مدير (Manager)"}
                        {rev.reviewType === "peer" && "تقييم زميل (Peer)"}
                        {rev.reviewType === "subordinate" && "تقييم مرؤوس"}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-[11px] font-bold ${rev.status === "submitted" || rev.status === "locked" ? "text-emerald-600" : "text-amber-600"}`}>
                        {rev.status === "submitted" ? "مكتمل ومقدم" : "قيد الانتظار"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground font-mono">{rev.dueDate || "نهاية الدورة"}</td>
                    <td className="py-3 px-4 text-end">
                      <Button
                        onClick={() => {
                          setSelectedAssignment(rev);
                          setIsReviewModalOpen(true);
                        }}
                        disabled={rev.status === "submitted" || rev.status === "locked"}
                        size="sm"
                        className="rounded-full text-[11px] font-bold h-8 px-3 classera-btn-primary cursor-pointer"
                      >
                        {rev.status === "submitted" ? "تم التقديم" : "إجراء التقييم"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* ------------------------------------------------------------- */}
        {/* TAB 4: TEAM REVIEWS                                            */}
        {/* ------------------------------------------------------------- */}
        <TabsContent value="team-reviews" className="space-y-4 pt-4">
          <div className="rounded-3xl border border-border/80 bg-card overflow-hidden shadow-xs">
            <div className="p-4 border-b border-border/60">
              <h3 className="font-bold text-sm text-foreground">تقييمات أعضاء الفريق المباشر</h3>
              <p className="text-xs text-muted-foreground mt-0.5">مراجعة واعتماد أداء مرؤوسيك المباشرين ومطابقة الأهداف مع الكفاءات</p>
            </div>
            <table className="w-full text-xs">
              <thead className="border-b border-border/60 bg-muted/40 font-bold text-muted-foreground">
                <tr>
                  <th className="py-3 px-4 text-start">الموظف</th>
                  <th className="py-3 px-4 text-start">المدير المقيّم</th>
                  <th className="py-3 px-4 text-start">الحالة</th>
                  <th className="py-3 px-4 text-start">الدرجة الموزونة</th>
                  <th className="py-3 px-4 text-end">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {teamReviews.map((rev) => (
                  <tr key={rev.id} className="hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-4 font-bold text-foreground">{rev.employeeName}</td>
                    <td className="py-3 px-4 text-muted-foreground">{rev.reviewerName}</td>
                    <td className="py-3 px-4">
                      <Badge variant="outline" className="text-[10px]">
                        {rev.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-amber-600">
                      {rev.review?.overallScore ? `★ ${rev.review.overallScore} / 5.0` : "-"}
                    </td>
                    <td className="py-3 px-4 text-end">
                      <Button
                        onClick={() => {
                          setSelectedAssignment(rev);
                          setIsReviewModalOpen(true);
                        }}
                        size="sm"
                        variant="outline"
                        className="rounded-full text-[11px] font-bold h-8 px-3 border-border hover:bg-secondary cursor-pointer"
                      >
                        {rev.status === "submitted" ? "تعديل المراجعة" : "تقييم الموظف"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* ------------------------------------------------------------- */}
        {/* TAB 5: 360° PEER REVIEW HUB                                    */}
        {/* ------------------------------------------------------------- */}
        <TabsContent value="360" className="space-y-4 pt-4">
          <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <h3 className="font-black text-sm text-foreground flex items-center gap-2">
                  <Award className="h-4 w-4 text-primary" />
                  منظومة التقييم الشامل 360° (Peer & Multi-Rater)
                </h3>
                <p className="text-xs text-muted-foreground font-medium mt-0.5">
                  إدارة تكليفات مراجعة الأقران والزملاء مع ضمان سرية الهوية (Anonymity) ومصداقية التقييم المؤسسي
                </p>
              </div>
              {canManage && (
                <Button
                  onClick={() => setIsAssignPeersOpen(true)}
                  size="sm"
                  className="classera-btn-primary rounded-full text-xs font-bold h-9 px-4 gap-1.5 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  تعيين مقيمي الزملاء
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {allAssignments
                .filter((a) => a.reviewType === "peer")
                .map((a) => (
                  <div key={a.id} className="rounded-2xl border border-border/80 p-4 bg-muted/10 space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-foreground">الموظف: {a.employeeName}</span>
                      <Badge variant="outline" className="text-[10px] text-primary border-primary/30">
                        تقييم أقران
                      </Badge>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      المقيّم: {a.isAnonymous ? "مقيّم مجهول الهوية (سري)" : a.reviewerName}
                    </div>
                    <div className="flex justify-between items-center border-t border-border/60 pt-2 text-[10px] text-muted-foreground">
                      <span>الحالة: {a.status === "submitted" ? "تم التقديم" : "قيد التنفيذ"}</span>
                      {a.review?.overallScore && (
                        <span className="font-bold text-amber-600 font-mono">
                          ★ {a.review.overallScore}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </TabsContent>

        {/* ------------------------------------------------------------- */}
        {/* TAB 6: CALIBRATION & DISTRIBUTION                             */}
        {/* ------------------------------------------------------------- */}
        <TabsContent value="calibration" className="space-y-4 pt-4">
          <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <h3 className="font-black text-sm text-foreground flex items-center gap-2">
                  <Scale className="h-4 w-4 text-primary" />
                  جلسات المعايرة والموازنة (Calibration Sessions)
                </h3>
                <p className="text-xs text-muted-foreground font-medium mt-0.5">
                  معايرة نتائج التقييم لتحقيق التوزيع الطبيعي العادل مع توثيق أسباب التعديل وتوقيع المنسق
                </p>
              </div>
            </div>

            {/* Participants pending calibration */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-muted-foreground uppercase">
                نتائج الموظفين المؤهلة للمعايرة في هذه الدورة
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {participants.slice(0, 8).map((p) => (
                  <div key={p.id} className="rounded-2xl border border-border/80 p-4 bg-card text-xs flex justify-between items-center shadow-xs">
                    <div>
                      <span className="font-bold text-foreground block">{p.employeeNameAr}</span>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        النتيجة الأصلية: {p.finalOverallScore ?? "-"} | النتيجة المعايرة: {p.calibratedScore ?? "لم تعاير"}
                      </p>
                    </div>
                    {canManage && (
                      <Button
                        onClick={() => {
                          setSelectedParticipantForCalib(p);
                          setCalibratedScore(p.calibratedScore || p.finalOverallScore || 4.0);
                          setIsCalibrationModalOpen(true);
                        }}
                        size="sm"
                        variant="outline"
                        className="rounded-full text-xs font-bold h-8 border-primary/40 text-primary hover:bg-primary/10 cursor-pointer"
                      >
                        معايرة النتيجة
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ------------------------------------------------------------- */}
        {/* TAB 7: 9-BOX TALENT MATRIX (AUTHORITATIVE)                    */}
        {/* ------------------------------------------------------------- */}
        <TabsContent value="ninebox" className="space-y-4 pt-4">
          <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <h3 className="font-black text-sm text-foreground flex items-center gap-2">
                  <LayoutGrid className="h-4 w-4 text-primary" />
                  مصفوفة المواهب المؤسسية (9-Box Grid Talent Matrix)
                </h3>
                <p className="text-xs text-muted-foreground font-medium mt-0.5">
                  توزيع حقيقي لموظفي المنشأة وفق محوري الأداء الفعلي والإمكانات المستقبلية المحسوبة
                </p>
              </div>
              <Badge variant="outline" className="text-xs font-mono font-bold text-primary">
                إجمالي القوى العاملة: {nineBoxData?.totalWorkforce ?? participants.length}
              </Badge>
            </div>

            {/* 3x3 Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {(nineBoxData?.cells || []).map((box) => (
                <div key={box.cellCode} className={`rounded-2xl border p-4 text-xs space-y-2.5 ${box.colorClass} shadow-xs`}>
                  <div className="flex items-center justify-between font-bold">
                    <span className="text-[11px] leading-tight">{box.titleAr}</span>
                    <Badge variant="secondary" className="font-black text-xs rounded-full px-2 font-mono">
                      {box.count}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center text-[10px] opacity-85 border-t border-current/20 pt-2 font-mono">
                    <span>الخلية: {box.cellCode}</span>
                    <span>{box.percentage}% من القوى العاملة</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Assess participant potential action */}
            {canManage && (
              <div className="border-t border-border/60 pt-4">
                <h4 className="text-xs font-bold text-muted-foreground mb-2">تقييم إمكانات موظف ووضعه في المصفوفة</h4>
                <div className="flex flex-wrap gap-2">
                  {participants.slice(0, 6).map((p) => (
                    <Button
                      key={p.id}
                      onClick={() => {
                        setSelectedParticipantForPotential(p);
                        setIsAssessPotentialModalOpen(true);
                      }}
                      size="sm"
                      variant="outline"
                      className="rounded-full text-[11px] font-bold border-border/80 h-8 hover:bg-secondary cursor-pointer"
                    >
                      تقييم {p.employeeNameAr}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ------------------------------------------------------------- */}
        {/* TAB 8: DEVELOPMENT PLANS & PIP                                */}
        {/* ------------------------------------------------------------- */}
        <TabsContent value="development" className="space-y-6 pt-4">
          {/* Individual Development Plans (IDP) */}
          <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <h3 className="font-black text-sm text-foreground flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-primary" />
                  خطط التطوير الفردية (IDP - Individual Development Plans)
                </h3>
                <p className="text-xs text-muted-foreground font-medium mt-0.5">
                  برامج التدريب والتوجيه المهني المخصصة لسد فجوات الكفاءات
                </p>
              </div>
              {canManage && (
                <Button
                  onClick={() => setIsCreateIDPOpen(true)}
                  size="sm"
                  className="classera-btn-primary rounded-full text-xs font-bold h-9 px-4 gap-1.5 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  إنشاء خطة تطوير (IDP)
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {devPlans.map((dp) => (
                <div key={dp.id} className="rounded-2xl border border-border/80 p-4 bg-muted/10 space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-foreground">{dp.employeeName}</span>
                    <Badge variant="outline" className="text-[10px] text-emerald-700 bg-emerald-50">
                      {dp.status}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{dp.titleAr}</p>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                      <span>الإنجاز</span>
                      <span>{dp.overallProgressPct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${dp.overallProgressPct}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Performance Improvement Plans (PIP) */}
          <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <h3 className="font-black text-sm text-foreground flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  خطط تصحيح الأداء (PIP - Performance Improvement Plans)
                </h3>
                <p className="text-xs text-muted-foreground font-medium mt-0.5">
                  إجراءات نظامية لدعم وتوجيه الموظفين ذوي الأداء المنخفض مع فترات مراجعة دورية
                </p>
              </div>
              {canManage && (
                <Button
                  onClick={() => setIsCreatePIPOpen(true)}
                  size="sm"
                  variant="outline"
                  className="rounded-full text-xs font-bold h-9 px-4 gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  تفعيل خطة تصحيح (PIP)
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pips.map((pip) => (
                <div key={pip.id} className="rounded-2xl border border-destructive/30 p-4 bg-destructive/5 space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-foreground">{pip.employeeName}</span>
                    <Badge variant="destructive" className="text-[10px]">
                      {pip.status}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{pip.performanceDeficiencies}</p>
                  <div className="flex justify-between items-center text-[10px] text-muted-foreground border-t border-border/60 pt-2 font-mono">
                    <span>الفترة: من {pip.startDate} إلى {pip.endDate}</span>
                    <span>المراجعة كل {pip.reviewFrequencyDays} يوم</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* ============================================================= */}
      {/* MODALS                                                        */}
      {/* ============================================================= */}

      {/* 1. Create Performance Cycle Modal */}
      <Dialog open={isAddCycleOpen} onOpenChange={setIsAddCycleOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              إطلاق دورة تقييم جديدة
            </DialogTitle>
            <DialogDescription className="text-xs font-medium">
              تحديد التواريخ، الأوزان النسبية، ونوع دورة التقييم
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs py-2">
            <div className="space-y-1">
              <label className="font-bold">عنوان الدورة (بالعربية) *</label>
              <input
                type="text"
                value={cycleTitleAr}
                onChange={(e) => setCycleTitleAr(e.target.value)}
                placeholder="مثال: دورة تقييم الأداء السنوية 2026"
                className="w-full h-10 rounded-2xl border border-border/80 px-3 text-xs bg-muted/30 focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 font-semibold"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-bold">تاريخ البدء *</label>
                <input
                  type="date"
                  value={cycleStartDate}
                  onChange={(e) => setCycleStartDate(e.target.value)}
                  className="w-full h-10 rounded-2xl border border-border/80 px-3 text-xs bg-muted/30 font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="font-bold">تاريخ الانتهاء *</label>
                <input
                  type="date"
                  value={cycleEndDate}
                  onChange={(e) => setCycleEndDate(e.target.value)}
                  className="w-full h-10 rounded-2xl border border-border/80 px-3 text-xs bg-muted/30 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-bold">وزن الأهداف (OKRs) %</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={cycleGoalsWeight}
                  onChange={(e) => {
                    const g = Number(e.target.value);
                    setCycleGoalsWeight(g);
                    setCycleCompetenciesWeight(100 - g);
                  }}
                  className="w-full h-10 rounded-2xl border border-border/80 px-3 text-xs bg-muted/30 font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="font-bold">وزن الكفاءات %</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={cycleCompetenciesWeight}
                  readOnly
                  className="w-full h-10 rounded-2xl border border-border/80 px-3 text-xs bg-muted/50 font-mono opacity-80"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="peer-cb"
                checked={cycleAllowPeers}
                onChange={(e) => setCycleAllowPeers(e.target.checked)}
                className="rounded border-border"
              />
              <label htmlFor="peer-cb" className="font-bold text-[11px] cursor-pointer">
                تمكين مراجعات الأقران والزملاء (360° Peer Reviews)
              </label>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setIsAddCycleOpen(false)} className="rounded-full text-xs font-bold">
              إلغاء
            </Button>
            <Button onClick={handleCreateCycle} className="classera-btn-primary rounded-full text-xs font-bold px-5">
              إنشاء الدورة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 2. Submit Goal Modal */}
      <Dialog open={isSubmitGoalOpen} onOpenChange={setIsSubmitGoalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              إضافة هدف ذكي (OKR)
            </DialogTitle>
            <DialogDescription className="text-xs font-medium">
              تحديد تفاصيل الهدف والوزن النسبي في الدورة
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs py-2">
            <div className="space-y-1">
              <label className="font-bold">الموظف المعني *</label>
              <select
                value={goalEmployeeId}
                onChange={(e) => setGoalEmployeeId(e.target.value)}
                className="w-full h-10 rounded-2xl border border-border/80 px-3 text-xs bg-muted/30 font-semibold"
              >
                <option value="">-- اختر الموظف --</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.firstNameAr} {e.lastNameAr} ({e.employeeNo})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-bold">تصنيف الهدف</label>
                <select
                  value={goalCategory}
                  onChange={(e) => setGoalCategory(e.target.value as any)}
                  className="w-full h-10 rounded-2xl border border-border/80 px-3 text-xs bg-muted/30 font-semibold"
                >
                  <option value="individual">فردي</option>
                  <option value="departmental">إداري</option>
                  <option value="strategic">استراتيجي</option>
                  <option value="operational">تشغيلي</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="font-bold">وزن الهدف (%) *</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={goalWeight}
                  onChange={(e) => setGoalWeight(Number(e.target.value))}
                  className="w-full h-10 rounded-2xl border border-border/80 px-3 text-xs bg-muted/30 font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-bold">عنوان الهدف الذكي *</label>
              <input
                type="text"
                value={goalTitleAr}
                onChange={(e) => setGoalTitleAr(e.target.value)}
                placeholder="مثال: زيادة معدل رضا العملاء إلى 95%"
                className="w-full h-10 rounded-2xl border border-border/80 px-3 text-xs bg-muted/30 font-semibold"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold">الوصف ومعايير القياس</label>
              <textarea
                value={goalDescription}
                onChange={(e) => setGoalDescription(e.target.value)}
                rows={2}
                className="w-full rounded-2xl border border-border/80 p-3 text-xs bg-muted/30 font-medium"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setIsSubmitGoalOpen(false)} className="rounded-full text-xs font-bold">
              إلغاء
            </Button>
            <Button onClick={handleCreateGoal} className="classera-btn-primary rounded-full text-xs font-bold px-5">
              حفظ الهدف
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 3. Update Goal Progress Modal */}
      <Dialog open={isUpdateGoalProgressOpen} onOpenChange={setIsUpdateGoalProgressOpen}>
        <DialogContent className="max-w-sm rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black">تحديث نسبة إنجاز الهدف</DialogTitle>
          </DialogHeader>

          <div className="space-y-3.5 text-xs py-2">
            <div className="space-y-1">
              <label className="font-bold">نسبة الإنجاز المحققة (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={newGoalProgress}
                onChange={(e) => setNewGoalProgress(Number(e.target.value))}
                className="w-full h-10 rounded-2xl border border-border/80 px-3 text-xs font-mono font-bold"
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold">ملاحظات التحديث والإثبات</label>
              <textarea
                value={goalProgressNote}
                onChange={(e) => setGoalProgressNote(e.target.value)}
                rows={2}
                placeholder="بيان ما تم تحقيقه..."
                className="w-full rounded-2xl border border-border/80 p-3 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setIsUpdateGoalProgressOpen(false)} className="rounded-full text-xs font-bold">
              إلغاء
            </Button>
            <Button onClick={handleUpdateGoalProgress} className="classera-btn-primary rounded-full text-xs font-bold px-5">
              تأكيد التحديث
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 4. Perform Review Modal */}
      <Dialog open={isReviewModalOpen} onOpenChange={setIsReviewModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
              إجراء وتوثيق تقييم الأداء
            </DialogTitle>
            <DialogDescription className="text-xs font-medium">
              الموظف: {selectedAssignment?.employeeName} ({selectedAssignment?.reviewType})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs py-2">
            <div className="space-y-1">
              <label className="font-bold flex justify-between">
                <span>درجة تحقيق الأهداف (Goals Score):</span>
                <span className="font-mono text-primary font-black">{reviewScoreGoals} / 5.0</span>
              </label>
              <input
                type="range"
                min="1"
                max="5"
                step="0.5"
                value={reviewScoreGoals}
                onChange={(e) => setReviewScoreGoals(Number(e.target.value))}
                className="w-full accent-primary"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold flex justify-between">
                <span>درجة الكفاءات والسلوك (Competency Score):</span>
                <span className="font-mono text-primary font-black">{reviewScoreCompetencies} / 5.0</span>
              </label>
              <input
                type="range"
                min="1"
                max="5"
                step="0.5"
                value={reviewScoreCompetencies}
                onChange={(e) => setReviewScoreCompetencies(Number(e.target.value))}
                className="w-full accent-primary"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold">أبرز نقاط القوة والإنجاز</label>
              <textarea
                value={reviewStrengths}
                onChange={(e) => setReviewStrengths(e.target.value)}
                rows={2}
                placeholder="توثيق نقاط القوة..."
                className="w-full rounded-2xl border border-border/80 p-2.5 text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold">مجالات التحسين والتطوير المستقبلي</label>
              <textarea
                value={reviewGrowth}
                onChange={(e) => setReviewGrowth(e.target.value)}
                rows={2}
                placeholder="مجالات التحسين المستمرة..."
                className="w-full rounded-2xl border border-border/80 p-2.5 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setIsReviewModalOpen(false)} className="rounded-full text-xs font-bold">
              إلغاء
            </Button>
            <Button onClick={handleSubmitReview} className="classera-btn-primary rounded-full text-xs font-bold px-5">
              اعتماد وإرسال التقييم
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 5. Assign Peer Reviewers Modal */}
      <Dialog open={isAssignPeersOpen} onOpenChange={setIsAssignPeersOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              تعيين مقيمي الزملاء (360° Peer Review)
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3.5 text-xs py-2">
            <div className="space-y-1">
              <label className="font-bold">الموظف المراد تقييمه *</label>
              <select
                value={targetPeerEmployeeId}
                onChange={(e) => setTargetPeerEmployeeId(e.target.value)}
                className="w-full h-10 rounded-2xl border border-border/80 px-3 text-xs bg-muted/30 font-semibold"
              >
                <option value="">-- اختر الموظف --</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.firstNameAr} {e.lastNameAr}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-bold">الزملاء المقيّمون (اختر 1 إلى 3) *</label>
              <select
                multiple
                value={selectedPeerIds}
                onChange={(e) => {
                  const opts = Array.from(e.target.selectedOptions, (option) => option.value);
                  setSelectedPeerIds(opts);
                }}
                className="w-full h-24 rounded-2xl border border-border/80 p-2 text-xs bg-muted/30 font-semibold"
              >
                {employees
                  .filter((e) => e.id !== targetPeerEmployeeId)
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.firstNameAr} {e.lastNameAr}
                    </option>
                  ))}
              </select>
              <span className="text-[10px] text-muted-foreground block">
                اضغط Ctrl لاختيار أكثر من زميل
              </span>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="anon-cb"
                checked={isAnonymousPeers}
                onChange={(e) => setIsAnonymousPeers(e.target.checked)}
                className="rounded border-border"
              />
              <label htmlFor="anon-cb" className="font-bold text-[11px] cursor-pointer">
                الحفاظ على سرية هوية المقيّم أمام الموظف (Anonymous)
              </label>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setIsAssignPeersOpen(false)} className="rounded-full text-xs font-bold">
              إلغاء
            </Button>
            <Button onClick={handleAssignPeers} className="classera-btn-primary rounded-full text-xs font-bold px-5">
              توليد التكليفات
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 6. Calibration Adjustment Modal */}
      <Dialog open={isCalibrationModalOpen} onOpenChange={setIsCalibrationModalOpen}>
        <DialogContent className="max-w-sm rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Scale className="h-5 w-5 text-primary" />
              معايرة وموازنة النتيجة
            </DialogTitle>
            <DialogDescription className="text-xs font-medium">
              الموظف: {selectedParticipantForCalib?.employeeNameAr}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs py-2">
            <div className="space-y-1">
              <label className="font-bold">النتيجة المعايرة المعدلة (Score)</label>
              <input
                type="number"
                step="0.1"
                min="1"
                max="5"
                value={calibratedScore}
                onChange={(e) => setCalibratedScore(Number(e.target.value))}
                className="w-full h-10 rounded-2xl border border-border/80 px-3 text-xs font-mono font-bold"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold">مسمى التصنيف المعاير</label>
              <select
                value={calibratedLabel}
                onChange={(e) => setCalibratedLabel(e.target.value)}
                className="w-full h-10 rounded-2xl border border-border/80 px-3 text-xs"
              >
                <option value="استثنائي (Exceptional)">استثنائي (Exceptional)</option>
                <option value="يتجاوز التوقعات (Exceeds)">يتجاوز التوقعات (Exceeds)</option>
                <option value="يلبي التوقعات (Meets)">يلبي التوقعات (Meets)</option>
                <option value="يحتاج تطوير (Needs Development)">يحتاج تطوير (Needs Development)</option>
                <option value="غير مرضٍ (Unsatisfactory)">غير مرضٍ (Unsatisfactory)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-bold">مبرر وسبب المعايرة *</label>
              <textarea
                value={calibrationReason}
                onChange={(e) => setCalibrationReason(e.target.value)}
                rows={2}
                placeholder="بيان مبررات لجنة المعايرة والموازنة..."
                className="w-full rounded-2xl border border-border/80 p-3 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setIsCalibrationModalOpen(false)} className="rounded-full text-xs font-bold">
              إلغاء
            </Button>
            <Button onClick={handleSaveCalibration} className="classera-btn-primary rounded-full text-xs font-bold px-5">
              اعتماد المعايرة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 7. Assess Potential Modal */}
      <Dialog open={isAssessPotentialModalOpen} onOpenChange={setIsAssessPotentialModalOpen}>
        <DialogContent className="max-w-sm rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500" />
              تقييم الإمكانات والمواهب
            </DialogTitle>
            <DialogDescription className="text-xs font-medium">
              الموظف: {selectedParticipantForPotential?.employeeNameAr}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs py-2">
            <div className="space-y-1">
              <label className="font-bold">مستوى الإمكانات والقدرات المستقبلية (Potential)</label>
              <select
                value={potentialLevel}
                onChange={(e) => setPotentialLevel(e.target.value as any)}
                className="w-full h-10 rounded-2xl border border-border/80 px-3 text-xs font-semibold"
              >
                <option value="high">إمكانات عالية (High Potential)</option>
                <option value="medium">إمكانات متوسطة (Medium Potential)</option>
                <option value="low">إمكانات محدودة حالياً (Low Potential)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-bold">ملاحظات ومبررات التقييم</label>
              <textarea
                value={potentialRationale}
                onChange={(e) => setPotentialRationale(e.target.value)}
                rows={2}
                placeholder="سرعة التعلم، المهارات القيادية، الاستعداد..."
                className="w-full rounded-2xl border border-border/80 p-3 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setIsAssessPotentialModalOpen(false)} className="rounded-full text-xs font-bold">
              إلغاء
            </Button>
            <Button onClick={handleSavePotential} className="classera-btn-primary rounded-full text-xs font-bold px-5">
              تحديث المصفوفة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 8. Create IDP Modal */}
      <Dialog open={isCreateIDPOpen} onOpenChange={setIsCreateIDPOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              إنشاء خطة تطوير فردية (IDP)
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 text-xs py-2">
            <div className="space-y-1">
              <label className="font-bold">الموظف *</label>
              <select
                value={idpEmployeeId}
                onChange={(e) => setIdpEmployeeId(e.target.value)}
                className="w-full h-10 rounded-2xl border border-border/80 px-3 text-xs bg-muted/30 font-semibold"
              >
                <option value="">-- اختر الموظف --</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.firstNameAr} {e.lastNameAr}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-bold">مسمى خطة التطوير *</label>
              <input
                type="text"
                value={idpTitle}
                onChange={(e) => setIdpTitle(e.target.value)}
                placeholder="مثال: برنامج تأهيل القيادات الشابة 2026"
                className="w-full h-10 rounded-2xl border border-border/80 px-3 text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold">الهدف التطويري الأساسي *</label>
              <input
                type="text"
                value={idpObjective}
                onChange={(e) => setIdpObjective(e.target.value)}
                placeholder="مثال: تطوير مهارات إدارة المشاريع الاحترافية"
                className="w-full h-10 rounded-2xl border border-border/80 px-3 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-bold">نوع النشاط</label>
                <select
                  value={idpActionType}
                  onChange={(e) => setIdpActionType(e.target.value)}
                  className="w-full h-10 rounded-2xl border border-border/80 px-3 text-xs"
                >
                  <option value="training">تدريب مباشر</option>
                  <option value="mentoring">توجيه وإرشاد</option>
                  <option value="certification">شهادة احترافية</option>
                  <option value="project_assignment">تكليف بمشروع</option>
                  <option value="self_study">تعلم ذاتي</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="font-bold">معيار النجاح</label>
                <input
                  type="text"
                  value={idpSuccessMetric}
                  onChange={(e) => setIdpSuccessMetric(e.target.value)}
                  placeholder="اجتياز الاختبار بنسبة 85%"
                  className="w-full h-10 rounded-2xl border border-border/80 px-3 text-xs"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setIsCreateIDPOpen(false)} className="rounded-full text-xs font-bold">
              إلغاء
            </Button>
            <Button onClick={handleSaveIDP} className="classera-btn-primary rounded-full text-xs font-bold px-5">
              حفظ الخطة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 9. Create PIP Modal */}
      <Dialog open={isCreatePIPOpen} onOpenChange={setIsCreatePIPOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              تفعيل خطة تصحيح الأداء (PIP)
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 text-xs py-2">
            <div className="space-y-1">
              <label className="font-bold">الموظف المعني *</label>
              <select
                value={pipEmployeeId}
                onChange={(e) => setPipEmployeeId(e.target.value)}
                className="w-full h-10 rounded-2xl border border-border/80 px-3 text-xs bg-muted/30 font-semibold"
              >
                <option value="">-- اختر الموظف --</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.firstNameAr} {e.lastNameAr}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-bold">تاريخ البدء *</label>
                <input
                  type="date"
                  value={pipStartDate}
                  onChange={(e) => setPipStartDate(e.target.value)}
                  className="w-full h-10 rounded-2xl border border-border/80 px-3 text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="font-bold">تاريخ الانتهاء *</label>
                <input
                  type="date"
                  value={pipEndDate}
                  onChange={(e) => setPipEndDate(e.target.value)}
                  className="w-full h-10 rounded-2xl border border-border/80 px-3 text-xs font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-bold">أوجه القصور المطلوب تصحيحها *</label>
              <textarea
                value={pipDeficiencies}
                onChange={(e) => setPipDeficiencies(e.target.value)}
                rows={2}
                placeholder="تحديد الفجوات في الأداء بدقة..."
                className="w-full rounded-2xl border border-border/80 p-3 text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold">المخرجات والنتائج المتوقعة</label>
              <textarea
                value={pipExpectedOutcomes}
                onChange={(e) => setPipExpectedOutcomes(e.target.value)}
                rows={2}
                placeholder="المستهدفات التي تثبت تحسن الأداء..."
                className="w-full rounded-2xl border border-border/80 p-3 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setIsCreatePIPOpen(false)} className="rounded-full text-xs font-bold">
              إلغاء
            </Button>
            <Button onClick={handleSavePIP} className="bg-destructive hover:bg-destructive/90 text-white rounded-full text-xs font-bold px-5">
              تفعيل الخطة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
