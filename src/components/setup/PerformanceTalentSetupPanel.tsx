import React, { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Award,
  Target,
  Compass,
  GitFork,
  Layers,
  ShieldCheck,
  Plus,
  ExternalLink,
  Calendar,
  BookOpen,
  Play,
  Lock,
} from "lucide-react";
import { useApp } from "../../lib/context/AppContext";
import { canManageModule } from "../../lib/auth/permissions";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import {
  usePerformanceCycles,
  usePerformanceMutations,
  useCompetencyFrameworks,
  useCompetencies,
  type PerformanceCycle,
} from "../../lib/domains/performance";
import { talentQueryKeys } from "../../lib/query/talent-query-keys";
import {
  fetchCareerPaths,
  fetchTalentPools,
  fetchCriticalRoles,
} from "../../lib/data/talent-repository";

export const PerformanceTalentSetupPanel: React.FC = () => {
  const navigate = useNavigate();
  const { company, employees, currentRole } = useApp();
  const companyId = company?.id || employees[0]?.subsidiaryId || "default";
  const canManage = canManageModule(currentRole, "performance");

  const mutations = usePerformanceMutations();
  const { data: cycles = [], refetch: refetchCycles } = usePerformanceCycles();
  const { data: frameworks = [] } = useCompetencyFrameworks();
  const { data: competencies = [] } = useCompetencies();

  const { data: careerPaths = [] } = useQuery({
    queryKey: talentQueryKeys.careerPaths.list(companyId),
    queryFn: () => fetchCareerPaths(companyId),
    enabled: Boolean(companyId),
  });

  const { data: talentPools = [] } = useQuery({
    queryKey: talentQueryKeys.talentPools.list(companyId),
    queryFn: () => fetchTalentPools(companyId),
    enabled: Boolean(companyId),
  });

  const { data: criticalRoles = [] } = useQuery({
    queryKey: talentQueryKeys.criticalRoles.list(companyId),
    queryFn: () => fetchCriticalRoles(companyId),
    enabled: Boolean(companyId),
  });

  const [isAddCycleOpen, setIsAddCycleOpen] = useState(false);
  const [cycleTitleAr, setCycleTitleAr] = useState("");
  const [cycleTitleEn, setCycleTitleEn] = useState("");
  const [cycleStartDate, setCycleStartDate] = useState("");
  const [cycleEndDate, setCycleEndDate] = useState("");
  const [cyclePeriodType, setCyclePeriodType] = useState<PerformanceCycle["periodType"]>("annual");
  const [cycleGoalsWeight, setCycleGoalsWeight] = useState(60);
  const [cycleCompetenciesWeight, setCycleCompetenciesWeight] = useState(40);
  const [cycleAllowPeers, setCycleAllowPeers] = useState(true);

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

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header Banner */}
      <div className="rounded-3xl border border-primary/20 bg-gradient-to-l from-primary/10 via-card to-card p-6 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Badge className="bg-primary/15 text-primary border-primary/30 text-xs font-bold">
              حوكمة الأداء والمواهب والتعاقب
            </Badge>
            <Badge variant="outline" className="text-[11px] font-mono">
              {cycles.length} دورة تقييم • {competencies.length} كفاءة • {careerPaths.length} مسار وظيفي
            </Badge>
          </div>
          <h2 className="text-lg font-black text-foreground">
            تهيئة دورات الأداء وأطر الكفاءات والمسارات الوظيفية
          </h2>
          <p className="text-xs text-muted-foreground max-w-3xl leading-relaxed">
            ضبط أوزان التقييم بين الأهداف الذكية والكفاءات السلوكية، إدارة دورات التقييم السنوية ونصف السنوية، وتحديد أطر الكفاءات والمسارات المهنية والمناصب الحرجة. لتسجيل أهداف الموظفين وتنفيذ التقييمات ومعايرة مصفوفة 9-Box، انتقل إلى شاشات العمليات.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {canManage && (
            <Button
              size="sm"
              onClick={() => setIsAddCycleOpen(true)}
              className="rounded-xl text-xs font-bold gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              تأسيس دورة تقييم جديدة
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate({ to: "/performance" })}
            className="rounded-xl text-xs font-bold gap-1.5"
          >
            <ExternalLink className="h-3.5 w-3.5 text-primary" />
            شاشة عمليات تقييم الأداء
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate({ to: "/talent" })}
            className="rounded-xl text-xs font-bold gap-1.5"
          >
            <Compass className="h-3.5 w-3.5 text-primary" />
            شاشة المواهب والتعاقب
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-bold">
            <span>دورات الأداء المعتمدة</span>
            <Calendar className="h-4 w-4 text-primary" />
          </div>
          <div className="text-2xl font-black text-foreground font-mono">{cycles.length}</div>
          <p className="text-[11px] text-muted-foreground">دورات سنوية وربع سنوية وتجريبية</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-bold">
            <span>أطر ومكتبة الكفاءات</span>
            <BookOpen className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-foreground font-mono">
            {competencies.length}
          </div>
          <p className="text-[11px] text-muted-foreground">
            موزعة على {frameworks.length} إطار كفاءات قيادي وفني
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-bold">
            <span>المسارات المهنية</span>
            <GitFork className="h-4 w-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-foreground font-mono">
            {careerPaths.length}
          </div>
          <p className="text-[11px] text-muted-foreground">مسارات الترقي والتدرج الوظيفي</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-bold">
            <span>المناصب الحرجة ومجمعات المواهب</span>
            <Layers className="h-4 w-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-foreground font-mono">
            {criticalRoles.length} / {talentPools.length}
          </div>
          <p className="text-[11px] text-muted-foreground">مناصب حرجة ومجمعات قيادات</p>
        </div>
      </div>

      {/* Section 1: Performance Cycles Governance */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-black text-foreground flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              حوكمة دورات تقييم الأداء وأوزان الاحتساب
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              تحديد الفترات الزمنية ونسب التوزيع بين الأهداف الفردية (OKRs) والكفاءات السلوكية وتفعيل تقييم الزملاء 360°
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cycles.map((cycle) => (
            <div
              key={cycle.id}
              className="rounded-2xl border border-border/80 bg-muted/20 p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="text-xs font-black text-foreground">{cycle.titleAr}</h4>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {cycle.startDate} → {cycle.endDate}
                  </span>
                </div>
                <Badge variant="outline" className="text-[10px] font-bold">
                  {cycle.status}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] bg-card p-2.5 rounded-xl border border-border/60">
                <div>
                  <span className="text-muted-foreground block">وزن الأهداف:</span>
                  <span className="font-black text-primary font-mono">{cycle.goalsWeightPct}%</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">وزن الكفاءات:</span>
                  <span className="font-black text-emerald-600 font-mono">
                    {cycle.competenciesWeightPct}%
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                <span>تقييم 360° للزملاء: {cycle.allowPeerReviews ? "مفعّل" : "غير مفعّل"}</span>
                {canManage && cycle.status === "draft" && (
                  <button
                    onClick={() => mutations.launchCycle(cycle.id).then(() => refetchCycles())}
                    className="text-primary font-bold hover:underline flex items-center gap-1"
                  >
                    <Play className="h-3 w-3" />
                    إطلاق الدورة
                  </button>
                )}
                {canManage && (cycle.status === "open" || cycle.status === "review_in_progress") && (
                  <button
                    onClick={() => mutations.finalizeCycle(cycle.id).then(() => refetchCycles())}
                    className="text-amber-600 font-bold hover:underline flex items-center gap-1"
                  >
                    <Lock className="h-3 w-3" />
                    إقفال نهائي
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section 2: Competency Matrix & Career Paths */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-foreground flex items-center gap-2">
              <Award className="h-4 w-4 text-emerald-600" />
              مكتبة الكفاءات السلوكية والقيادية ({competencies.length})
            </h3>
          </div>
          <div className="divide-y divide-border max-h-64 overflow-y-auto">
            {competencies.slice(0, 8).map((comp) => (
              <div key={comp.id} className="py-2.5 flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-foreground">{comp.titleAr}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {comp.descriptionAr || comp.titleEn}
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px]">
                  {comp.category}
                </Badge>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-foreground flex items-center gap-2">
              <GitFork className="h-4 w-4 text-indigo-600" />
              المسارات المهنية المعتمدة ({careerPaths.length})
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate({ to: "/talent" })}
              className="h-7 text-[11px] font-bold text-primary"
            >
              إدارة في شاشة المواهب
            </Button>
          </div>
          <div className="divide-y divide-border max-h-64 overflow-y-auto">
            {careerPaths.map((path) => (
              <div key={path.id} className="py-2.5 flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-foreground">{path.titleAr}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {path.jobFamily || path.titleEn} • {path.steps?.length || 0} مستويات تدرج
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono">
                  {path.code}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Add Cycle Modal */}
      <Dialog open={isAddCycleOpen} onOpenChange={setIsAddCycleOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-black">تأسيس دورة تقييم أداء جديدة</DialogTitle>
            <DialogDescription className="text-xs">
              تحديد الفترة الزمنية وأوزان احتساب الأهداف والكفاءات المعتمدة للدورة.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-bold block mb-1">اسم الدورة (عربي)</label>
              <input
                type="text"
                value={cycleTitleAr}
                onChange={(e) => setCycleTitleAr(e.target.value)}
                placeholder="مثال: التقييم السنوي للعام 2026"
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold block mb-1">تاريخ البداية</label>
                <input
                  type="date"
                  value={cycleStartDate}
                  onChange={(e) => setCycleStartDate(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-bold block mb-1">تاريخ النهاية</label>
                <input
                  type="date"
                  value={cycleEndDate}
                  onChange={(e) => setCycleEndDate(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold block mb-1">وزن الأهداف (%)</label>
                <input
                  type="number"
                  value={cycleGoalsWeight}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setCycleGoalsWeight(val);
                    setCycleCompetenciesWeight(100 - val);
                  }}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-bold block mb-1">وزن الكفاءات (%)</label>
                <input
                  type="number"
                  value={cycleCompetenciesWeight}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setCycleCompetenciesWeight(val);
                    setCycleGoalsWeight(100 - val);
                  }}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs font-mono"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsAddCycleOpen(false)}>
              إلغاء
            </Button>
            <Button size="sm" onClick={handleCreateCycle}>
              حفظ وتأسيس الدورة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
