// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PROMPT 32: 360° CASE FILE / DOSSIER MODAL
// src/components/employee-relations/CaseDetailModal.tsx
// ============================================================================

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { toast } from "sonner";
import {
  Shield,
  Clock,
  User,
  FileText,
  Search,
  Scale,
  AlertTriangle,
  FolderLock,
  Plus,
  Send,
  Calendar,
  CheckCircle,
  XCircle,
  HelpCircle,
} from "lucide-react";
import {
  useErCaseDetail,
  useErCaseNotes,
  useErInvestigations,
  useErInterviews,
  useErEvidence,
  useErDecisions,
  useAddErCaseNote,
  addErEvidenceRecord,
  scheduleErInterviewRecord,
} from "../../lib/data/employee-relations-repository";
import {
  formatCaseStatus,
  formatCaseType,
  formatConfidentialityLevel,
  formatSeverity,
  formatDecisionType,
  formatFindingOutcome,
  isSlaBreached,
} from "../../lib/domains/employee-relations";

interface CaseDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseId: string | null;
  companyId: string;
  onOpenTriage: () => void;
  onOpenInvestigation: () => void;
  onOpenDecision: () => void;
  onOpenWarning: () => void;
  onOpenAppeal: () => void;
}

export const CaseDetailModal: React.FC<CaseDetailModalProps> = ({
  isOpen,
  onClose,
  caseId,
  companyId,
  onOpenTriage,
  onOpenInvestigation,
  onOpenDecision,
  onOpenWarning,
  onOpenAppeal,
}) => {
  const [activeTab, setActiveTab] = useState<"summary" | "investigation" | "evidence" | "notes" | "decisions">("summary");
  const [newNoteContent, setNewNoteContent] = useState("");
  const [newNoteType, setNewNoteType] = useState<"general" | "investigation" | "hearing" | "deliberation">("general");
  const [isNoteConfidential, setIsNoteConfidential] = useState(false);
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);

  // New Evidence Form State
  const [showAddEvidence, setShowAddEvidence] = useState(false);
  const [evidenceTitle, setEvidenceTitle] = useState("");
  const [evidenceType, setEvidenceType] = useState<any>("document");
  const [evidenceDesc, setEvidenceDesc] = useState("");

  const { data: erCase, isLoading } = useErCaseDetail(caseId || "");
  const { data: notes = [], refetch: refetchNotes } = useErCaseNotes(caseId || "");
  const { data: investigations = [] } = useErInvestigations(caseId || "");
  const { data: interviews = [], refetch: refetchInterviews } = useErInterviews(caseId || "");
  const { data: evidence = [], refetch: refetchEvidence } = useErEvidence(caseId || "");
  const { data: decisions = [] } = useErDecisions(caseId || "");

  const addNoteMutation = useAddErCaseNote();

  if (!isOpen || !caseId) return null;

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteContent.trim()) return;

    try {
      setIsSubmittingNote(true);
      await addNoteMutation.mutateAsync({
        caseId,
        companyId,
        authorName: "مسؤول علاقات الموظفين",
        authorRole: "ER Specialist",
        noteType: newNoteType,
        content: newNoteContent.trim(),
        isConfidential: isNoteConfidential,
      });
      toast.success("تم تدوين الملاحظة بنجاح");
      setNewNoteContent("");
      refetchNotes();
    } catch (err: any) {
      toast.error(err.message || "تعذر حفظ الملاحظة");
    } finally {
      setIsSubmittingNote(false);
    }
  };

  const handleAddEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evidenceTitle.trim()) return;
    try {
      await addErEvidenceRecord({
        caseId,
        companyId,
        evidenceNumber: `EVD-${Math.floor(1000 + Math.random() * 9000)}`,
        title: evidenceTitle.trim(),
        description: evidenceDesc.trim() || undefined,
        evidenceType,
        classification: "restricted",
      });
      toast.success("تم إيداع الدليل بنجاح في الخزينة الآمنة");
      setShowAddEvidence(false);
      setEvidenceTitle("");
      setEvidenceDesc("");
      refetchEvidence();
    } catch (err: any) {
      toast.error(err.message || "تعذر إيداع الدليل");
    }
  };

  const slaBreached = erCase ? isSlaBreached(erCase.dueDate, erCase.resolvedAt) : false;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-primary/10 text-primary">
                  {erCase?.caseNumber}
                </span>
                <span className="text-xs px-2 py-0.5 rounded font-medium bg-muted text-foreground">
                  {erCase ? formatCaseType(erCase.caseType) : ""}
                </span>
                <span className="text-xs px-2 py-0.5 rounded font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300">
                  {erCase ? formatConfidentialityLevel(erCase.confidentialityLevel) : ""}
                </span>
                {slaBreached && (
                  <span className="text-xs px-2 py-0.5 rounded font-bold bg-destructive/10 text-destructive flex items-center gap-1">
                    <Clock className="w-3 h-3" /> تجاوز SLA
                  </span>
                )}
              </div>
              <DialogTitle className="text-lg font-bold mt-1 text-foreground">
                {erCase?.title}
              </DialogTitle>
            </div>

            {/* Quick Actions Bar */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <Button size="sm" variant="outline" onClick={onOpenTriage}>
                فرز وتعيين
              </Button>
              <Button size="sm" variant="outline" onClick={onOpenInvestigation}>
                بدء تحقيق
              </Button>
              <Button size="sm" variant="outline" onClick={onOpenDecision}>
                تسجيل قرار
              </Button>
              <Button size="sm" variant="default" onClick={onOpenWarning}>
                إصدار إنذار
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Tab Navigation */}
        <div className="flex border-b border-border gap-1 overflow-x-auto text-xs font-medium pt-1">
          <button
            onClick={() => setActiveTab("summary")}
            className={`px-3 py-2 border-b-2 transition-all ${
              activeTab === "summary"
                ? "border-primary text-primary font-bold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            ملخص الأطراف والوقائع
          </button>
          <button
            onClick={() => setActiveTab("investigation")}
            className={`px-3 py-2 border-b-2 transition-all ${
              activeTab === "investigation"
                ? "border-primary text-primary font-bold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            محاضر التحقيق والجلسات ({investigations.length})
          </button>
          <button
            onClick={() => setActiveTab("evidence")}
            className={`px-3 py-2 border-b-2 transition-all ${
              activeTab === "evidence"
                ? "border-primary text-primary font-bold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            خزينة الأدلة والمستندات ({evidence.length})
          </button>
          <button
            onClick={() => setActiveTab("notes")}
            className={`px-3 py-2 border-b-2 transition-all ${
              activeTab === "notes"
                ? "border-primary text-primary font-bold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            الملاحظات والوقائع ({notes.length})
          </button>
          <button
            onClick={() => setActiveTab("decisions")}
            className={`px-3 py-2 border-b-2 transition-all ${
              activeTab === "decisions"
                ? "border-primary text-primary font-bold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            القرارات والجزاءات ({decisions.length})
          </button>
        </div>

        {/* Tab 1: Summary */}
        {activeTab === "summary" && erCase && (
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <div className="p-3 bg-card rounded-lg border border-border">
                <span className="text-[11px] text-muted-foreground font-medium">الموظف المعني بالواقعة</span>
                <p className="text-sm font-bold text-foreground mt-0.5">
                  {erCase.subjectEmployeeName || "غير محدد"}
                </p>
                {erCase.subjectDepartment && (
                  <span className="text-[11px] text-muted-foreground">{erCase.subjectDepartment}</span>
                )}
              </div>

              <div className="p-3 bg-card rounded-lg border border-border">
                <span className="text-[11px] text-muted-foreground font-medium">مقدم الشكوى / البلاغ</span>
                <p className="text-sm font-bold text-foreground mt-0.5">
                  {erCase.isAnonymousComplainant
                    ? "🛡️ محمي الهوية (Whistleblower)"
                    : erCase.complainantEmployeeName || "غير محدد"}
                </p>
              </div>

              <div className="p-3 bg-card rounded-lg border border-border">
                <span className="text-[11px] text-muted-foreground font-medium">المحقق المكلف</span>
                <p className="text-sm font-bold text-foreground mt-0.5">
                  {erCase.assignedInvestigatorName || "قيد التعيين"}
                </p>
              </div>

              <div className="p-3 bg-card rounded-lg border border-border">
                <span className="text-[11px] text-muted-foreground font-medium">تاريخ الواقعة</span>
                <p className="text-sm font-bold text-foreground mt-0.5">{erCase.incidentDate || "غير مسجل"}</p>
              </div>

              <div className="p-3 bg-card rounded-lg border border-border">
                <span className="text-[11px] text-muted-foreground font-medium">المهلة المستهدفة (SLA)</span>
                <p className="text-sm font-bold text-foreground mt-0.5">
                  {erCase.dueDate ? new Date(erCase.dueDate).toLocaleDateString("ar-SA") : "غير محدد"}
                </p>
              </div>

              <div className="p-3 bg-card rounded-lg border border-border">
                <span className="text-[11px] text-muted-foreground font-medium">حالة الملف الحالية</span>
                <p className="text-sm font-bold text-primary mt-0.5">{formatCaseStatus(erCase.status)}</p>
              </div>
            </div>

            {/* Description Card */}
            <div className="p-4 bg-muted/40 rounded-lg border border-border space-y-2">
              <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-primary" />
                شرح ووقائع البلاغ / القضية
              </h4>
              <p className="text-sm text-foreground/90 whitespace-pre-line leading-relaxed">
                {erCase.description}
              </p>
            </div>

            {erCase.resolutionSummary && (
              <div className="p-4 bg-emerald-500/10 rounded-lg border border-emerald-500/30 space-y-1">
                <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                  خلاصة التسوية والحل النهائي
                </h4>
                <p className="text-sm text-emerald-900 dark:text-emerald-200">
                  {erCase.resolutionSummary}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Investigations & Hearings */}
        {activeTab === "investigation" && (
          <div className="space-y-4 pt-2">
            {investigations.length === 0 ? (
              <div className="text-center py-8 bg-muted/30 rounded-lg border border-border">
                <Search className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                <p className="text-xs text-muted-foreground">لم يتم فتح محضر تحقيق رسمي بعد لهذه القضية</p>
                <Button size="sm" variant="outline" className="mt-3" onClick={onOpenInvestigation}>
                  بدء تحقيق رسمي الآن
                </Button>
              </div>
            ) : (
              investigations.map((inv) => (
                <div key={inv.id} className="p-4 rounded-lg border border-border bg-card space-y-3">
                  <div className="flex items-center justify-between border-b border-border pb-2">
                    <div>
                      <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                        {inv.investigationNumber}
                      </span>
                      <h4 className="text-sm font-bold text-foreground mt-0.5">{inv.scopeOfInvestigation}</h4>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded font-bold bg-indigo-500/10 text-indigo-700 dark:text-indigo-300">
                      {inv.status === "completed" ? "مكتمل" : "تحقيق جارٍ"}
                    </span>
                  </div>

                  {/* Investigation Steps Checklist */}
                  {inv.steps && inv.steps.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <h5 className="text-xs font-semibold text-muted-foreground">مراحل وخطوات التحقيق:</h5>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {inv.steps.map((st) => (
                          <div
                            key={st.id}
                            className="flex items-center gap-2 p-2 rounded bg-muted/40 border border-border text-xs"
                          >
                            {st.status === "completed" ? (
                              <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                            ) : (
                              <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                            )}
                            <span className="font-medium text-foreground">{st.title}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {inv.summaryReport && (
                    <div className="p-3 bg-muted/60 rounded text-xs text-foreground/90 whitespace-pre-line">
                      <strong>تقرير المحقق النهائي: </strong>
                      {inv.summaryReport}
                    </div>
                  )}
                </div>
              ))
            )}

            {/* Interviews & Hearings Log */}
            <div className="space-y-2 pt-2 border-t border-border">
              <h4 className="text-xs font-bold text-foreground">جلسات الاستماع والتحقيق المجدولة</h4>
              {interviews.length === 0 ? (
                <p className="text-xs text-muted-foreground">لا توجد جلسات سماع مسجلة بعد.</p>
              ) : (
                <div className="space-y-2">
                  {interviews.map((intv) => (
                    <div key={intv.id} className="p-3 bg-card rounded border border-border flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-foreground">{intv.intervieweeName}</span>
                        <span className="text-muted-foreground mr-2">({intv.interviewType})</span>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {new Date(intv.scheduledAt).toLocaleString("ar-SA")}
                        </p>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-muted text-foreground font-medium">
                        {intv.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Evidence Vault */}
        {activeTab === "evidence" && (
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-foreground">مستودع الأدلة وسلسلة الحيازة (Chain of Custody)</h4>
                <p className="text-[11px] text-muted-foreground">
                  توثيق الأدلة الرقمية والشهادات بدون إمكانية الحذف العشوائي
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setShowAddEvidence(!showAddEvidence)}>
                <Plus className="w-3.5 h-3.5 ml-1" />
                إيداع دليل جديد
              </Button>
            </div>

            {showAddEvidence && (
              <form onSubmit={handleAddEvidence} className="p-3 rounded-lg border border-border bg-muted/40 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs font-semibold">مسمى الدليل / المستند</Label>
                    <Input
                      value={evidenceTitle}
                      onChange={(e) => setEvidenceTitle(e.target.value)}
                      required
                      className="text-xs"
                      placeholder="مثال: تسجيل كاميرات المراقبة، تقرير البصمة"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">نوع الدليل</Label>
                    <select
                      className="w-full h-8 px-2 rounded border border-input bg-background text-xs"
                      value={evidenceType}
                      onChange={(e) => setEvidenceType(e.target.value)}
                    >
                      <option value="document">مستند رسمي</option>
                      <option value="email_export">مراسلات بريدية</option>
                      <option value="chat_log">سجل محادثة</option>
                      <option value="attendance_log">سجل حضور وبصمة</option>
                      <option value="witness_statement">شهادة خطية</option>
                      <option value="audit_trace">أثر تدقيق نظامي</option>
                    </select>
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-semibold">وصف الدليل ومصدره</Label>
                  <Input
                    value={evidenceDesc}
                    onChange={(e) => setEvidenceDesc(e.target.value)}
                    className="text-xs"
                    placeholder="ملاحظات حول طريقة التحريز ومصدر الوثيقة"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="outline" type="button" onClick={() => setShowAddEvidence(false)}>
                    إلغاء
                  </Button>
                  <Button size="sm" type="submit">
                    حفظ الدليل بالخزينة
                  </Button>
                </div>
              </form>
            )}

            {evidence.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">لا توجد أدلة مودعة في الخزينة حتى الآن.</p>
            ) : (
              <div className="space-y-2">
                {evidence.map((ev) => (
                  <div key={ev.id} className="p-3 rounded-lg border border-border bg-card flex items-center justify-between text-xs">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <FolderLock className="w-4 h-4 text-primary" />
                        <span className="font-bold text-foreground">{ev.title}</span>
                        <span className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded">
                          {ev.evidenceNumber}
                        </span>
                      </div>
                      {ev.description && <p className="text-[11px] text-muted-foreground mt-0.5">{ev.description}</p>}
                    </div>
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-muted text-muted-foreground">
                      {ev.classification}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Notes */}
        {activeTab === "notes" && (
          <div className="space-y-4 pt-2">
            {/* Add Note Form */}
            <form onSubmit={handleAddNote} className="p-3 bg-muted/40 rounded-lg border border-border space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">تدوين ملاحظة تحقيق أو محضر واقعة جديد</Label>
                <div className="flex items-center gap-3">
                  <select
                    className="h-7 px-2 rounded border border-input bg-background text-xs"
                    value={newNoteType}
                    onChange={(e) => setNewNoteType(e.target.value as any)}
                  >
                    <option value="general">ملاحظة عامة</option>
                    <option value="investigation">محضر تحقيق</option>
                    <option value="hearing">جلسة استماع</option>
                    <option value="deliberation">مداولة لجنة</option>
                  </select>

                  <label className="flex items-center gap-1.5 text-xs cursor-pointer text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={isNoteConfidential}
                      onChange={(e) => setIsNoteConfidential(e.target.checked)}
                      className="rounded border-input text-primary w-3.5 h-3.5 cursor-pointer"
                    />
                    سرية خاصة
                  </label>
                </div>
              </div>

              <textarea
                rows={2}
                value={newNoteContent}
                onChange={(e) => setNewNoteContent(e.target.value)}
                placeholder="اكتب تفاصيل الملاحظة أو محضر الواقعة هنا..."
                className="w-full p-2 rounded border border-input bg-background text-xs focus:outline-hidden focus:ring-1 focus:ring-primary resize-none"
              />

              <div className="flex justify-end">
                <Button size="sm" type="submit" disabled={isSubmittingNote} className="gap-1">
                  إضافة الملاحظة
                  <Send className="w-3 h-3" />
                </Button>
              </div>
            </form>

            {/* Notes List */}
            <div className="space-y-2">
              {notes.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">لا توجد ملاحظات مسجلة.</p>
              ) : (
                notes.map((n) => (
                  <div key={n.id} className="p-3 rounded-lg border border-border bg-card space-y-1 text-xs">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span className="font-bold text-foreground">{n.authorName} ({n.authorRole})</span>
                      <span>{new Date(n.createdAt).toLocaleString("ar-SA")}</span>
                    </div>
                    <p className="text-foreground/90 whitespace-pre-line">{n.content}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab 5: Decisions & Disciplinary Actions */}
        {activeTab === "decisions" && (
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-foreground">القرارات الصادرة والجزاءات التأديبية</h4>
                <p className="text-[11px] text-muted-foreground">قرارات لجنة المخالفات وحالة التوقيع والاستئناف</p>
              </div>
              <Button size="sm" variant="default" onClick={onOpenDecision}>
                إصدار قرار جديد
              </Button>
            </div>

            {decisions.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">لم يصدر أي قرار رسمي على هذا الملف حتى الآن.</p>
            ) : (
              <div className="space-y-3">
                {decisions.map((dec) => (
                  <div key={dec.id} className="p-4 rounded-lg border border-border bg-card space-y-2 text-xs">
                    <div className="flex items-center justify-between border-b border-border pb-2">
                      <div>
                        <span className="font-mono text-xs font-bold text-rose-600 dark:text-rose-400">
                          {dec.decisionNumber}
                        </span>
                        <h4 className="text-sm font-bold text-foreground mt-0.5">{formatDecisionType(dec.decisionType)}</h4>
                      </div>
                      <div className="text-left">
                        <span className="text-[11px] text-muted-foreground">سريان القرار: {dec.effectiveDate}</span>
                        {dec.appealEligible && dec.appealDeadline && (
                          <p className="text-[10px] text-amber-600 font-bold mt-0.5">
                            آخر موعد للاستئناف: {dec.appealDeadline}
                          </p>
                        )}
                      </div>
                    </div>

                    <p className="text-foreground font-medium">{dec.decisionSummary}</p>
                    <p className="text-muted-foreground leading-relaxed">{dec.rationale}</p>

                    {dec.appealEligible && (
                      <div className="pt-2 flex justify-end">
                        <Button size="sm" variant="outline" onClick={onOpenAppeal} className="text-purple-600 border-purple-200">
                          قيد طلب استئناف على هذا القرار
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
