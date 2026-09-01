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
  Sparkles,
  Plus,
  TrendingUp,
  LayoutGrid,
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

export const PerformanceView: React.FC = () => {
  const {
    performanceCycles,
    evaluations,
    employees,
    currentUser,
    currentRole,
    addEvaluation,
    addPerformanceCycle,
    language,
    t,
  } = useApp();
  const canManage = canManageModule(currentRole, "performance");
  const [activeTab, setActiveTab] = useState("cycles");

  // Modals state
  const [isSubmitEvaluationOpen, setIsSubmitEvaluationOpen] = useState(false);
  const [isAddCycleOpen, setIsAddCycleOpen] = useState(false);

  // Evaluation Form State
  const [targetEmpId, setTargetEmpId] = useState(employees[0]?.id || "");
  const [evalType, setEvalType] = useState<"manager" | "peer" | "self">("manager");
  const [scorePerformance, setScorePerformance] = useState(5);
  const [scoreLeadership, setScoreLeadership] = useState(4);
  const [scoreTeamwork, setScoreTeamwork] = useState(5);
  const [feedbackNote, setFeedbackNote] = useState("");

  // Cycle Form State
  const [cycleTitle, setCycleTitle] = useState("");
  const [cycleStartDate, setCycleStartDate] = useState("2026-09-01");
  const [cycleEndDate, setCycleEndDate] = useState("2026-12-31");

  const handleSubmitEvaluation = () => {
    if (!feedbackNote) {
      alert("يرجى كتابة ملاحظات وتوصيات التقييم");
      return;
    }
    const emp = employees.find((e) => e.id === targetEmpId);
    const avgScore = Number(((scorePerformance + scoreLeadership + scoreTeamwork) / 3).toFixed(1));

    addEvaluation({
      cycleId: performanceCycles[0]?.id || "cyc-1",
      employeeId: targetEmpId,
      employeeName: `${emp?.firstNameAr} ${emp?.lastNameAr}`,
      evaluatorId: currentUser.id,
      evaluatorName: `${currentUser.firstNameAr} ${currentUser.lastNameAr}`,
      evaluationType: evalType,
      status: "submitted",
      overallScore: avgScore,
      submittedAt: new Date().toISOString(),
    });

    alert(
      `تم توثيق تقييم الأداء لـ (${emp?.firstNameAr} ${emp?.lastNameAr}) بنتيجة ${avgScore} / 5.0 بنجاح!`,
    );
    setIsSubmitEvaluationOpen(false);
    setFeedbackNote("");
  };

  const handleCreateCycle = () => {
    if (!cycleTitle) {
      alert("يرجى كتابة عنوان دورة التقييم");
      return;
    }
    addPerformanceCycle({
      titleAr: cycleTitle,
      titleEn: cycleTitle,
      startDate: cycleStartDate,
      endDate: cycleEndDate,
      status: "active",
      periodType: "annual",
      participantsCount: employees.length,
      completionRate: 0,
    });
    alert(`تم إطلاق دورة التقييم (${cycleTitle}) بنجاح وإشعار جميع الموظفين!`);
    setIsAddCycleOpen(false);
    setCycleTitle("");
  };

  // 9-Box Grid Categories
  const nineBoxes = [
    { title: "قادة المستقبل (High Potential / High Perf)", color: "bg-emerald-500/10 border-emerald-300 text-emerald-800", count: 4 },
    { title: "نجوم الأداء العالي (High Perf / Medium Pot)", color: "bg-teal-500/10 border-teal-300 text-teal-800", count: 7 },
    { title: "خبراء التخصص (High Perf / Low Pot)", color: "bg-blue-500/10 border-blue-300 text-blue-800", count: 12 },
    { title: "كفاءات واعدة (Medium Perf / High Pot)", color: "bg-indigo-500/10 border-indigo-300 text-indigo-800", count: 5 },
    { title: "العمود الفقري الأساسي (Solid Core)", color: "bg-primary/10 border-primary/30 text-primary", count: 28 },
    { title: "أداء مستقر (Effective Professional)", color: "bg-amber-500/10 border-amber-300 text-amber-800", count: 14 },
    { title: "محتمل عالي يحتاج توجيه (Enigma)", color: "bg-purple-500/10 border-purple-300 text-purple-800", count: 3 },
    { title: "يحتاج تدريب وتطوير (Dilemma)", color: "bg-orange-500/10 border-orange-300 text-orange-800", count: 4 },
    { title: "خطة تصحيح الأداء (Action Plan)", color: "bg-destructive/10 border-destructive/30 text-destructive", count: 1 },
  ];

  return (
    <div className="space-y-6">
      {/* Header (Google M3 Style) */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/70 pb-5">
        <div>
          <h1 className="text-xl font-black text-foreground flex items-center gap-2.5">
            <IconSymbol name="stars" source="material" filled size={24} className="text-primary" />
            {t.performance.cycles} وإدارة الأداء (360° Review - M09)
          </h1>
          <p className="text-xs text-muted-foreground font-medium mt-1">
            تقييمات الأداء متعددة الأطراف (الذاتي، المدير المباشر، الزملاء) ومصفوفة المواهب 9-Box Grid
          </p>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2.5">
            <Button
              onClick={() => setIsSubmitEvaluationOpen(true)}
              size="sm"
              className="rounded-full font-bold text-xs gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs h-10 px-4"
            >
              <Plus className="h-4 w-4" />
              إجراء تقييم موظف (360°)
            </Button>
            <Button
              onClick={() => setIsAddCycleOpen(true)}
              variant="outline"
              size="sm"
              className="rounded-full font-bold text-xs gap-1.5 border-border/80 hover:bg-secondary h-10 px-4 shadow-xs"
            >
              <Plus className="h-4 w-4 text-primary" />
              إطلاق دورة تقييم جديدة
            </Button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-3 max-w-md bg-muted/60 p-1 rounded-full border border-border/60">
          <TabsTrigger value="cycles" className="rounded-full text-xs font-bold py-2 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-xs">
            دورات التقييم ({performanceCycles.length})
          </TabsTrigger>
          <TabsTrigger value="ninebox" className="rounded-full text-xs font-bold py-2 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-xs">
            مصفوفة 9-Box Grid
          </TabsTrigger>
          <TabsTrigger value="evaluations" className="rounded-full text-xs font-bold py-2 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-xs">
            سجل التقييمات ({evaluations.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Performance Cycles */}
        <TabsContent value="cycles" className="space-y-4 pt-4">
          {performanceCycles.map((cyc) => (
            <div key={cyc.id} className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-4">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-base font-black text-foreground">{cyc.titleAr}</h2>
                    <Badge variant="outline" className="text-emerald-700 bg-emerald-50 text-[10px] rounded-full px-2.5 font-bold border-emerald-200">
                      دورة نشطة
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground font-medium mt-1">
                    الفترة: من {cyc.startDate} إلى {cyc.endDate}
                  </p>
                </div>
                <div className="flex items-center gap-3.5">
                  <div className="text-end">
                    <span className="text-xs font-black text-foreground block">
                      {cyc.completionRate}% مكتمل
                    </span>
                    <p className="text-[10px] text-muted-foreground font-semibold">
                      {cyc.participantsCount} موظف مشارك
                    </p>
                  </div>
                  <div className="h-2.5 w-28 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all"
                      style={{ width: `${cyc.completionRate}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Evaluations Grid */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-muted-foreground uppercase">
                  التقييمات المنجزة حديثاً في الدورة
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {evaluations.map((ev) => (
                    <div
                      key={ev.id}
                      className="rounded-2xl border border-border/70 bg-muted/20 p-4 text-xs space-y-2.5 hover:bg-card transition-all"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-black text-foreground block">{ev.employeeName}</h4>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            المقيّم: {ev.evaluatorName} (
                            {ev.evaluationType === "manager" ? "تقييم المدير" : "تقييم الزملاء"})
                          </p>
                        </div>
                        <div className="flex items-center gap-1 font-black text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-full text-xs">
                          <Star className="h-3.5 w-3.5 fill-current" />
                          {ev.overallScore} / 5.0
                        </div>
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-muted-foreground border-t border-border/60 pt-2 font-mono">
                        <span className="text-emerald-700 font-bold">الحالة: معتمد وموثق</span>
                        <span>
                          {new Date(ev.submittedAt || "").toLocaleDateString(
                            language === "ar" ? "ar-SA" : "en-US",
                          )}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </TabsContent>

        {/* Tab 2: 9-Box Grid Talent Matrix */}
        <TabsContent value="ninebox" className="space-y-4 pt-4">
          <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <h3 className="font-black text-sm text-foreground flex items-center gap-2">
                  <LayoutGrid className="h-4 w-4 text-primary" />
                  مصفوفة المواهب والأداء المؤسسي (9-Box Talent Matrix)
                </h3>
                <p className="text-xs text-muted-foreground font-medium mt-0.5">
                  توزيع موظفي المنشأة حسب محوري الأداء الفعلي (X) والإمكانات المستقبلية (Y)
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {nineBoxes.map((box, idx) => (
                <div key={idx} className={`rounded-2xl border p-4 text-xs space-y-2 ${box.color}`}>
                  <div className="flex items-center justify-between font-bold">
                    <span className="text-[11px] leading-tight">{box.title}</span>
                    <Badge variant="secondary" className="font-black text-xs rounded-full px-2">
                      {box.count}
                    </Badge>
                  </div>
                  <p className="text-[10px] opacity-80">
                    تمثيل {((box.count / 78) * 100).toFixed(0)}% من إجمالي القوى العاملة
                  </p>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* Tab 3: All Evaluations Ledger */}
        <TabsContent value="evaluations" className="space-y-4 pt-4">
          <div className="rounded-3xl border border-border/80 bg-card overflow-hidden shadow-xs">
            <table className="w-full text-xs">
              <thead className="border-b border-border/60 bg-muted/40 font-bold text-muted-foreground">
                <tr>
                  <th className="py-3 px-4 text-start">الموظف المقيم</th>
                  <th className="py-3 px-4 text-start">نوع التقييم</th>
                  <th className="py-3 px-4 text-start">المقيّم</th>
                  <th className="py-3 px-4 text-start">النتيجة الإجمالية</th>
                  <th className="py-3 px-4 text-start">تاريخ التوثيق</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {evaluations.map((ev) => (
                  <tr key={ev.id} className="hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-4 font-bold text-foreground">{ev.employeeName}</td>
                    <td className="py-3 px-4">
                      {ev.evaluationType === "manager"
                        ? "تقييم المدير المباشر"
                        : "تقييم الزملاء (Peer)"}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground font-semibold">{ev.evaluatorName}</td>
                    <td className="py-3 px-4 font-black text-amber-600 font-mono">
                      ★ {ev.overallScore} / 5.0
                    </td>
                    <td className="py-3 px-4 text-muted-foreground font-mono">
                      {new Date(ev.submittedAt || "").toLocaleDateString(
                        language === "ar" ? "ar-SA" : "en-US",
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Submit Evaluation Modal */}
      <Dialog open={isSubmitEvaluationOpen} onOpenChange={setIsSubmitEvaluationOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
              إجراء تقييم أداء 360 درجة
            </DialogTitle>
            <DialogDescription className="text-xs font-medium">
              تقييم الكفاءات السلوكية وتحقيق المستهدفات OKRs
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs py-2">
            <div className="space-y-1.5">
              <label className="font-bold">الموظف المراد تقييمه *</label>
              <select
                value={targetEmpId}
                onChange={(e) => setTargetEmpId(e.target.value)}
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 font-semibold"
              >
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.firstNameAr} {emp.lastNameAr} ({emp.jobTitleAr})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold">نوع التقييم *</label>
              <select
                value={evalType}
                onChange={(e) => setEvalType(e.target.value as "manager" | "peer" | "self")}
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 font-bold"
              >
                <option value="manager">تقييم المدير المباشر (Manager Review)</option>
                <option value="peer">تقييم الزملاء (Peer Review)</option>
                <option value="self">التقييم الذاتي (Self Review)</option>
              </select>
            </div>

            {/* Competency Scoring Sliders */}
            <div className="rounded-2xl border border-border/80 bg-muted/20 p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-bold">1. الإنجاز وتحقيق الأهداف:</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setScorePerformance(v)}
                      className={`h-7 w-7 rounded-xl text-xs font-black transition-all ${
                        scorePerformance === v
                          ? "bg-amber-500 text-white shadow-xs"
                          : "bg-muted text-muted-foreground hover:bg-card"
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="font-bold">2. المبادرة والقيادة والالتزام:</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setScoreLeadership(v)}
                      className={`h-7 w-7 rounded-xl text-xs font-black transition-all ${
                        scoreLeadership === v
                          ? "bg-amber-500 text-white shadow-xs"
                          : "bg-muted text-muted-foreground hover:bg-card"
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="font-bold">3. التعاون وروح الفريق:</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setScoreTeamwork(v)}
                      className={`h-7 w-7 rounded-xl text-xs font-black transition-all ${
                        scoreTeamwork === v
                          ? "bg-amber-500 text-white shadow-xs"
                          : "bg-muted text-muted-foreground hover:bg-card"
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold">الملاحظات والتوصيات التطويرية *</label>
              <textarea
                rows={2}
                value={feedbackNote}
                onChange={(e) => setFeedbackNote(e.target.value)}
                placeholder="اكتب نقاط القوة ومجالات التطوير المقترحة للموظف..."
                className="w-full rounded-2xl border border-border/80 bg-muted/40 p-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>

          <DialogFooter className="mt-3">
            <Button
              size="sm"
              onClick={handleSubmitEvaluation}
              className="rounded-full text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 h-9"
            >
              تأكيد وتوثيق التقييم
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Cycle Modal */}
      <Dialog open={isAddCycleOpen} onOpenChange={setIsAddCycleOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              إطلاق دورة تقييم أداء جديدة
            </DialogTitle>
            <DialogDescription className="text-xs font-medium">
              تحديد الفترة الزمنية والمستهدفين
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs py-2">
            <div className="space-y-1.5">
              <label className="font-bold">عنوان دورة التقييم *</label>
              <input
                type="text"
                value={cycleTitle}
                onChange={(e) => setCycleTitle(e.target.value)}
                placeholder="مثال: دورة تقييم الأداء للربع الأخير Q4 2026"
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="font-bold">تاريخ البدء *</label>
                <input
                  type="date"
                  value={cycleStartDate}
                  onChange={(e) => setCycleStartDate(e.target.value)}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-bold">تاريخ الانتهاء *</label>
                <input
                  type="date"
                  value={cycleEndDate}
                  onChange={(e) => setCycleEndDate(e.target.value)}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="mt-3">
            <Button size="sm" onClick={handleCreateCycle} className="rounded-full text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-5 h-9">
              إطلاق الدورة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
