import React, { useState } from "react";
import {
  Users,
  Calendar,
  CheckCircle2,
  Clock,
  Award,
  Star,
  UserCheck,
  ShieldCheck,
  FileText,
  ChevronRight,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import type {
  OnboardingCase,
  ProbationCase,
  ProbationRecommendation,
} from "../../lib/domains/onboarding";
import { submitProbationReview } from "../../lib/data/onboarding-repository";

interface ManagerOnboardingViewProps {
  teamCases: OnboardingCase[];
  probationCases: ProbationCase[];
  onRefresh: () => void;
}

export const ManagerOnboardingView: React.FC<ManagerOnboardingViewProps> = ({
  teamCases,
  probationCases,
  onRefresh,
}) => {
  const [selectedProbCase, setSelectedProbCase] = useState<ProbationCase | null>(null);
  const [rating, setRating] = useState<number>(4.5);
  const [goalsScore, setGoalsScore] = useState<number>(90);
  const [competencyScore, setCompetencyScore] = useState<number>(85);
  const [recommendation, setRecommendation] = useState<ProbationRecommendation>("confirm");
  const [comments, setComments] = useState("");
  const [strengths, setStrengths] = useState("");
  const [improvements, setImprovements] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProbCase) return;
    if (!comments.trim()) {
      toast.error("يرجى كتابة الملاحظات والتقييم التفصيلي للموظف");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await submitProbationReview({
        caseId: selectedProbCase.id,
        reviewType: "final",
        rating,
        goalsScore,
        competencyScore,
        recommendation,
        comments: comments.trim(),
        strengths: strengths.trim() || undefined,
        improvements: improvements.trim() || undefined,
      });

      if (!res.ok) {
        toast.error(res.message || "تعذر حفظ التقييم");
        return;
      }

      toast.success("تم إرسال تقييم فترة التجربة والتوصية الإدارية بنجاح إلى الموارد البشرية");
      setSelectedProbCase(null);
      setComments("");
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ غير متوقع");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="p-4 rounded-2xl bg-card border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-foreground">فريق العمل المنضم حديثاً</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            متابعة تهيئة أعضاء الفريق المباشرين، اعتماد خطة الأهداف، وتقديم تقييمات فترة التجربة
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-xl bg-primary/10 text-primary">
          <ShieldCheck className="h-4 w-4" />
          حماية الخصوصية: البيانات البنكية والوثائق الحساسة محجوبة
        </div>
      </div>

      {/* Grid of Team Onboarding Cases */}
      <div className="space-y-4">
        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
          المنضمون الجدد في فريقك ({teamCases.length})
        </h4>

        {teamCases.length === 0 ? (
          <div className="p-8 text-center rounded-2xl border border-dashed border-border text-muted-foreground text-sm">
            لا يوجد موظفون جدد قيد التهيئة في فريقك حالياً.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {teamCases.map((c) => (
              <div
                key={c.id}
                className="p-5 rounded-2xl bg-card border border-border shadow-xs space-y-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h5 className="text-sm font-bold text-foreground">
                      {c.employeeName || "موظف جديد"}
                    </h5>
                    <p className="text-xs text-muted-foreground">
                      {c.jobTitle || "المسمى الوظيفي"} • {c.departmentName || "القسم"}
                    </p>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      c.readinessStatus === "ready"
                        ? "bg-emerald-500/10 text-emerald-600"
                        : c.readinessStatus === "partially_ready"
                        ? "bg-sky-500/10 text-sky-600"
                        : "bg-amber-500/10 text-amber-600"
                    }`}
                  >
                    {c.readinessStatus === "ready"
                      ? "جاهز للمباشرة"
                      : c.readinessStatus === "partially_ready"
                      ? "جاهز جزئياً"
                      : "بانتظار الاستكمال"}
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>تاريخ المباشرة:</span>
                    <span className="font-bold text-foreground font-mono">{c.joiningDate}</span>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>المرشد الزميل (Buddy):</span>
                    <span className="font-semibold text-foreground">
                      {c.buddyName || "غير محدد"}
                    </span>
                  </div>
                  <div className="space-y-1 pt-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">نسبة إنجاز التهيئة:</span>
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

                <div className="pt-2 border-t border-border flex items-center justify-end gap-2">
                  <button
                    onClick={() => {
                      toast.success(
                        `تم إرسال بريد ترحيبي وجدولة جلسة التعارف مع ${c.employeeName}`,
                      );
                    }}
                    className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-input hover:bg-muted text-foreground flex items-center gap-1.5 transition-colors"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    جلسة التعارف
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Probation Evaluations Section */}
      <div className="space-y-4 pt-4 border-t border-border">
        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
          متابعة وتقييم فترات التجربة ({probationCases.length})
        </h4>

        {probationCases.length === 0 ? (
          <div className="p-8 text-center rounded-2xl border border-dashed border-border text-muted-foreground text-sm">
            لا توجد حالات فترة تجربة نشطة لفريقك حالياً.
          </div>
        ) : (
          <div className="space-y-3">
            {probationCases.map((p) => (
              <div
                key={p.id}
                className="p-4 rounded-2xl bg-card border border-border shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h5 className="text-sm font-bold text-foreground">
                      {p.employeeName || p.employeeNo}
                    </h5>
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
                        ? "مثبت نهائياً"
                        : p.status === "extended"
                        ? "مُمدد"
                        : p.status === "failed"
                        ? "غير مجتاز"
                        : "فترة التجربة جارية"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    تاريخ البدء: {p.startDate} • تاريخ الانتهاء الحالي:{" "}
                    <span className="font-mono font-bold text-foreground">{p.currentEndDate}</span>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedProbCase(p)}
                    className="px-4 py-2 text-xs font-bold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5 transition-colors shadow-xs"
                  >
                    <Award className="h-3.5 w-3.5" />
                    تقييم فترة التجربة
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Review Submission Modal */}
      {selectedProbCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-2xl bg-card border border-border p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h4 className="text-base font-bold text-foreground">
                  تقييم فترة التجربة: {selectedProbCase.employeeName}
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  تقديم تقييم الجدارات وتوصية تثبيت الموظف أو تمديده
                </p>
              </div>
              <button
                onClick={() => setSelectedProbCase(null)}
                className="p-1 rounded-lg text-muted-foreground hover:bg-muted"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitReview} className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    التقييم العام (1-5)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    step="0.1"
                    value={rating}
                    onChange={(e) => setRating(Number(e.target.value))}
                    className="w-full h-9 px-3 text-xs rounded-xl border border-input bg-background text-foreground"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    نسبة الأهداف (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={goalsScore}
                    onChange={(e) => setGoalsScore(Number(e.target.value))}
                    className="w-full h-9 px-3 text-xs rounded-xl border border-input bg-background text-foreground"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    الجدارات السلوكية (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={competencyScore}
                    onChange={(e) => setCompetencyScore(Number(e.target.value))}
                    className="w-full h-9 px-3 text-xs rounded-xl border border-input bg-background text-foreground"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  توصية المدير المباشر <span className="text-destructive">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setRecommendation("confirm")}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all ${
                      recommendation === "confirm"
                        ? "bg-emerald-500/10 border-emerald-500 text-emerald-600"
                        : "border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    تثبيت التعيين
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecommendation("extend")}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all ${
                      recommendation === "extend"
                        ? "bg-amber-500/10 border-amber-500 text-amber-600"
                        : "border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    تمديد التجربة
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecommendation("terminate")}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all ${
                      recommendation === "terminate"
                        ? "bg-rose-500/10 border-rose-500 text-rose-600"
                        : "border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    إنهاء التعاقد
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  أبرز نقاط القوة والإنجازات
                </label>
                <input
                  type="text"
                  value={strengths}
                  onChange={(e) => setStrengths(e.target.value)}
                  placeholder="سرعة التعلم، مهارات التواصل، الالتزام بالمهام..."
                  className="w-full h-9 px-3 text-xs rounded-xl border border-input bg-background text-foreground"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  مجالات التحسين والتطوير
                </label>
                <input
                  type="text"
                  value={improvements}
                  onChange={(e) => setImprovements(e.target.value)}
                  placeholder="بحاجة لمزيد من الإتقان لسياسات المنشأة..."
                  className="w-full h-9 px-3 text-xs rounded-xl border border-input bg-background text-foreground"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  ملاحظات التقييم الإداري <span className="text-destructive">*</span>
                </label>
                <textarea
                  rows={2}
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder="تفاصيل التقييم الدوري والتوصية المرفوعة..."
                  className="w-full p-2.5 text-xs rounded-xl border border-input bg-background text-foreground resize-none"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setSelectedProbCase(null)}
                  className="px-3 py-1.5 text-xs rounded-xl border border-border text-muted-foreground hover:bg-muted"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 text-xs font-bold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {isSubmitting ? "جاري الإرسال..." : "إرسال التقييم للموارد البشرية"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
