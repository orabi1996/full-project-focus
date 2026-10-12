// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PROMPT 31: TAKE SURVEY MODAL (ESS/MSS QUESTIONNAIRE EXPERIENCE)
// src/components/engagement/TakeSurveyModal.tsx
// ============================================================================

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { toast } from "sonner";
import { CheckCircle2, Shield, Lock, Send, HelpCircle } from "lucide-react";
import {
  fetchSurveyInstanceDetail,
  submitSurveyResponse,
  recalculateSurveyAnalytics,
} from "../../lib/data/engagement-repository";
import type { SurveyInstance, SurveyQuestionSnapshot, SurveyAnswer } from "../../lib/domains/engagement";
import { sanitizeAnonymousComment } from "../../lib/domains/engagement";

interface TakeSurveyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  companyId: string;
  surveyId: string;
  participantTokenOrEmpId: string;
  isAnonymous?: boolean;
}

export const TakeSurveyModal: React.FC<TakeSurveyModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  companyId,
  surveyId,
  participantTokenOrEmpId,
  isAnonymous = true,
}) => {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [survey, setSurvey] = useState<SurveyInstance | null>(null);
  const [answers, setAnswers] = useState<Record<string, { numeric?: number; text?: string }>>({});

  useEffect(() => {
    if (isOpen && surveyId) {
      loadSurvey();
    }
  }, [isOpen, surveyId]);

  const loadSurvey = async () => {
    try {
      setLoading(true);
      const data = await fetchSurveyInstanceDetail(surveyId);
      setSurvey(data);
    } catch (err: any) {
      toast.error(err.message || "تعذر تحميل أسئلة الاستبيان");
    } finally {
      setLoading(false);
    }
  };

  const handleNumericAnswer = (qId: string, val: number) => {
    setAnswers((prev) => ({
      ...prev,
      [qId]: { ...prev[qId], numeric: val },
    }));
  };

  const handleTextAnswer = (qId: string, text: string) => {
    setAnswers((prev) => ({
      ...prev,
      [qId]: { ...prev[qId], text },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!survey || !survey.questions) return;

    // Check required questions
    for (const q of survey.questions) {
      if (q.isRequired) {
        const ans = answers[q.id];
        if (q.questionType === "likert_scale" || q.questionType === "enps_0_10" || q.questionType === "numeric_scale") {
          if (ans?.numeric == null) {
            toast.error(`يرجى الإجابة على السؤال الإلزامي: ${q.textAr}`);
            return;
          }
        } else if (q.questionType === "free_text") {
          if (!ans?.text?.trim()) {
            toast.error(`يرجى الإجابة على السؤال الإلزامي: ${q.textAr}`);
            return;
          }
        }
      }
    }

    try {
      setSubmitting(true);
      const formattedAnswers: SurveyAnswer[] = survey.questions.map((q) => {
        const rawAns = answers[q.id];
        let valText = rawAns?.text || null;
        if (valText && isAnonymous) {
          valText = sanitizeAnonymousComment(valText, true);
        }

        return {
          questionId: q.id,
          questionCode: q.code,
          category: q.category,
          questionType: q.questionType,
          valueNumeric: rawAns?.numeric ?? null,
          valueText: valText,
        };
      });

      await submitSurveyResponse(
        companyId,
        surveyId,
        participantTokenOrEmpId,
        formattedAnswers,
        false
      );

      // Trigger automatic recalculation of analytics snapshot
      await recalculateSurveyAnalytics(companyId, surveyId).catch((err) =>
        console.warn("Recalculate analytics non-blocking error:", err)
      );

      toast.success("تم إرسال إجاباتك بنجاح. شكراً لمشاركتك في تطوير بيئة العمل!");
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ أثناء إرسال الإجابات");
    } finally {
      setSubmitting(false);
    }
  };

  const questions: SurveyQuestionSnapshot[] = survey?.questions || [];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <span>{survey?.titleAr || "المشاركة في الاستبيان"}</span>
          </DialogTitle>
          <DialogDescription>
            {isAnonymous ? (
              <span className="flex items-center gap-1.5 text-emerald-600 font-medium text-xs mt-1">
                <Lock className="h-3.5 w-3.5" />
                هذا الاستبيان سري ومجهول الهوية بالكامل. لن يتم ربط هويتك بأي من هذه الإجابات.
              </span>
            ) : (
              <span className="text-xs text-muted-foreground mt-1">
                استبيان معلن الهوية لأغراض المتابعة والتطوير المباشر.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-12 text-center text-muted-foreground text-sm">
            جاري تحميل نموذج الاستبيان...
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6 py-2">
            {questions.map((q, idx) => (
              <div
                key={q.id || idx}
                className="p-4 rounded-xl border bg-card hover:border-primary/30 transition-colors space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-primary">السؤال {idx + 1}</span>
                    <h4 className="font-semibold text-foreground text-sm leading-relaxed">
                      {q.textAr}
                      {q.isRequired && <span className="text-destructive mr-1">*</span>}
                    </h4>
                    {q.textEn && <p className="text-xs text-muted-foreground">{q.textEn}</p>}
                  </div>
                </div>

                {/* 1. Likert Scale 1-5 */}
                {q.questionType === "likert_scale" && (
                  <div className="pt-2">
                    <div className="grid grid-cols-5 gap-2">
                      {[1, 2, 3, 4, 5].map((val) => {
                        const labels = ["غير موافق بشدة", "غير موافق", "محايد", "موافق", "موافق بشدة"];
                        const isSelected = answers[q.id]?.numeric === val;
                        return (
                          <button
                            type="button"
                            key={val}
                            onClick={() => handleNumericAnswer(q.id, val)}
                            className={`p-2.5 rounded-lg border text-center transition-all ${
                              isSelected
                                ? "bg-primary text-primary-foreground border-primary font-bold shadow-xs"
                                : "bg-background hover:bg-muted text-muted-foreground"
                            }`}
                          >
                            <div className="text-lg font-black">{val}</div>
                            <div className="text-[10px] mt-0.5 leading-tight">{labels[val - 1]}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 2. eNPS Scale 0-10 */}
                {q.questionType === "enps_0_10" && (
                  <div className="pt-2 space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground font-medium px-1">
                      <span className="text-rose-600">0 - غير مرجح إطلاقاً (منتقد)</span>
                      <span className="text-amber-600">7-8 محايد</span>
                      <span className="text-emerald-600">10 - مرجح جداً (مروج)</span>
                    </div>
                    <div className="grid grid-cols-11 gap-1">
                      {Array.from({ length: 11 }, (_, i) => i).map((score) => {
                        const isSelected = answers[q.id]?.numeric === score;
                        return (
                          <button
                            type="button"
                            key={score}
                            onClick={() => handleNumericAnswer(q.id, score)}
                            className={`h-10 rounded-md border text-center text-sm font-bold transition-all ${
                              isSelected
                                ? "bg-primary text-primary-foreground border-primary scale-105 shadow-xs"
                                : score <= 6
                                ? "bg-rose-50/50 hover:bg-rose-100 text-rose-800 border-rose-200"
                                : score <= 8
                                ? "bg-amber-50/50 hover:bg-amber-100 text-amber-800 border-amber-200"
                                : "bg-emerald-50/50 hover:bg-emerald-100 text-emerald-800 border-emerald-200"
                            }`}
                          >
                            {score}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 3. Yes/No */}
                {q.questionType === "yes_no" && (
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => handleNumericAnswer(q.id, 1)}
                      className={`p-3 rounded-lg border text-sm font-bold transition-all ${
                        answers[q.id]?.numeric === 1
                          ? "bg-emerald-600 text-white border-emerald-600"
                          : "bg-background hover:bg-muted"
                      }`}
                    >
                      نعم
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNumericAnswer(q.id, 0)}
                      className={`p-3 rounded-lg border text-sm font-bold transition-all ${
                        answers[q.id]?.numeric === 0
                          ? "bg-rose-600 text-white border-rose-600"
                          : "bg-background hover:bg-muted"
                      }`}
                    >
                      لا
                    </button>
                  </div>
                )}

                {/* 4. Free text */}
                {q.questionType === "free_text" && (
                  <div className="pt-2">
                    <Textarea
                      rows={3}
                      value={answers[q.id]?.text || ""}
                      onChange={(e) => handleTextAnswer(q.id, e.target.value)}
                      placeholder="اكتب ملاحظاتك ومقترحاتك بكل حرية..."
                      className="resize-none text-sm"
                    />
                  </div>
                )}
              </div>
            ))}

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
                إلغاء
              </Button>
              <Button type="submit" disabled={submitting} className="gap-2">
                <Send className="h-4 w-4" />
                {submitting ? "جاري الإرسال..." : "إرسال الإجابات النهائية"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
