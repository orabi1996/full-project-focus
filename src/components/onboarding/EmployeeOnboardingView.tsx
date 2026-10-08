import React, { useState } from "react";
import {
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Upload,
  ShieldCheck,
  User,
  Briefcase,
  AlertTriangle,
  ChevronDown,
  Sparkles,
  Laptop,
} from "lucide-react";
import { toast } from "sonner";
import type {
  OnboardingCase,
  OnboardingTask,
  OnboardingDocumentRequirement,
  OnboardingAcknowledgement,
} from "../../lib/domains/onboarding";
import {
  updateOnboardingTaskStatus,
  acknowledgeOnboardingPolicy,
} from "../../lib/data/onboarding-repository";

interface EmployeeOnboardingViewProps {
  onboardingCase: OnboardingCase;
  tasks: OnboardingTask[];
  documents: OnboardingDocumentRequirement[];
  acknowledgements: OnboardingAcknowledgement[];
  onRefresh: () => void;
}

export const EmployeeOnboardingView: React.FC<EmployeeOnboardingViewProps> = ({
  onboardingCase,
  tasks,
  documents,
  acknowledgements,
  onRefresh,
}) => {
  const [activeTab, setActiveTab] = useState<"journey" | "docs" | "policies" | "assets">("journey");
  const [signatureText, setSignatureText] = useState("");
  const [submittingAck, setSubmittingAck] = useState(false);

  const employeeTasks = tasks.filter((t) => t.ownerRole === "employee");
  const completedEmployeeTasks = employeeTasks.filter((t) => t.status === "completed").length;
  const progress =
    employeeTasks.length > 0
      ? Math.round((completedEmployeeTasks / employeeTasks.length) * 100)
      : 100;

  const handleToggleTask = async (task: OnboardingTask) => {
    if (task.status === "completed") return;
    try {
      const res = await updateOnboardingTaskStatus(task.id, "completed");
      if (!res.ok) {
        toast.error(res.message || "تعذر تحديث حالة المهمة");
        return;
      }
      toast.success("تم إكمال المهمة بنجاح");
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ أثناء حفظ المهمة");
    }
  };

  const handleAcknowledge = async (policyCode: string, titleAr: string, titleEn: string) => {
    if (!signatureText.trim()) {
      toast.error("يرجى كتابة اسمك الثلاثي كإقرار وتوقيع إلكتروني");
      return;
    }
    try {
      setSubmittingAck(true);
      const res = await acknowledgeOnboardingPolicy({
        caseId: onboardingCase.id,
        companyId: onboardingCase.companyId,
        employeeId: onboardingCase.employeeId,
        policyCode,
        policyTitleAr: titleAr,
        policyTitleEn: titleEn,
        signatureText: signatureText.trim(),
      });
      if (!res.ok) {
        toast.error(res.error || "تعذر حفظ الإقرار");
        return;
      }
      toast.success(`تم تسجيل الإقرار الرقمي على ${titleAr} بنجاح`);
      setSignatureText("");
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ غير متوقع");
    } finally {
      setSubmittingAck(false);
    }
  };

  const isAck = (code: string) => acknowledgements.some((a) => a.policyCode === code);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Welcome Hero Banner */}
      <div className="rounded-3xl bg-linear-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 p-6 md:p-8 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/15 text-primary text-xs font-bold">
              <Sparkles className="h-3.5 w-3.5" />
              أهلاً بك في فريق العمل!
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-foreground tracking-tight">
              رحلة التهيئة والمباشرة
            </h2>
            <p className="text-sm text-muted-foreground max-w-md">
              نحن متحمسون لانضمامك إلينا! يرجى إكمال المهام التحضيرية والوثائق المطلوبة قبل تاريخ
              المباشرة الرسمي.
            </p>
          </div>

          <div className="bg-card/90 backdrop-blur-md rounded-2xl border border-border p-5 shadow-lg space-y-3 min-w-[220px]">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <Calendar className="h-4 w-4 text-primary" />
              تاريخ المباشرة الرسمي:
            </div>
            <div className="text-lg font-black text-foreground font-mono">
              {onboardingCase.joiningDate}
            </div>
            <div className="space-y-1.5 pt-2 border-t border-border/60">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">إنجاز المهام:</span>
                <span className="font-bold text-foreground">{progress}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab("journey")}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
            activeTab === "journey"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          قائمة المهام ({completedEmployeeTasks}/{employeeTasks.length})
        </button>
        <button
          onClick={() => setActiveTab("docs")}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
            activeTab === "docs"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          الوثائق والمستندات ({documents.length})
        </button>
        <button
          onClick={() => setActiveTab("policies")}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
            activeTab === "policies"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          الإقرارات والسياسات ({acknowledgements.length}/3)
        </button>
        <button
          onClick={() => setActiveTab("assets")}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
            activeTab === "assets"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          تجهيزات اليوم الأول
        </button>
      </div>

      {/* Tab: Tasks Journey */}
      {activeTab === "journey" && (
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground mb-1">
            المهام الموكلة إليك لإتمام إجراءات التعاقد والمباشرة:
          </div>
          {employeeTasks.length === 0 ? (
            <div className="p-8 text-center rounded-2xl border border-dashed border-border text-muted-foreground text-sm">
              لا توجد مهام إضافية مطلوبة حالياً.
            </div>
          ) : (
            employeeTasks.map((t) => (
              <div
                key={t.id}
                className={`p-4 rounded-2xl border transition-all flex items-start justify-between gap-4 ${
                  t.status === "completed"
                    ? "bg-muted/40 border-border opacity-80"
                    : "bg-card border-border hover:border-primary/50 shadow-xs"
                }`}
              >
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => handleToggleTask(t)}
                    disabled={t.status === "completed"}
                    className={`mt-0.5 h-5 w-5 rounded-md border flex items-center justify-center transition-colors ${
                      t.status === "completed"
                        ? "bg-emerald-600 border-emerald-600 text-white cursor-default"
                        : "border-input hover:border-primary bg-background"
                    }`}
                  >
                    {t.status === "completed" && <CheckCircle2 className="h-4 w-4" />}
                  </button>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4
                        className={`text-sm font-bold ${
                          t.status === "completed"
                            ? "line-through text-muted-foreground"
                            : "text-foreground"
                        }`}
                      >
                        {t.titleAr}
                      </h4>
                      {t.isBlocking && (
                        <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 text-[10px] font-bold">
                          إلزامية للمباشرة
                        </span>
                      )}
                    </div>
                    {t.descriptionAr && (
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {t.descriptionAr}
                      </p>
                    )}
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-1">
                      <span className="flex items-center gap-1 font-mono">
                        <Calendar className="h-3.5 w-3.5" />
                        موعد الإنجاز: {t.dueDate}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  {t.status === "completed" ? (
                    <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-xs font-bold">
                      مكتملة
                    </span>
                  ) : (
                    <button
                      onClick={() => handleToggleTask(t)}
                      className="px-3 py-1.5 text-xs font-bold rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
                    >
                      تأكيد الإنجاز
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab: Documents */}
      {activeTab === "docs" && (
        <div className="space-y-4">
          <div className="text-xs text-muted-foreground">
            المستندات المطلوبة لاعتماد ملفك الوظيفي وإصدار بطاقة العمل:
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {documents.map((d) => (
              <div
                key={d.id}
                className="p-5 rounded-2xl bg-card border border-border shadow-xs space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      <h4 className="text-sm font-bold text-foreground">{d.nameAr}</h4>
                    </div>
                    <span className="text-[11px] text-muted-foreground block">{d.nameEn}</span>
                  </div>
                  {d.isMandatory && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10px] font-bold">
                      إلزامي
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <div className="text-xs">
                    {d.status === "verified" && (
                      <span className="text-emerald-600 font-bold flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> معتمد رسمياً
                      </span>
                    )}
                    {d.status === "uploaded" && (
                      <span className="text-sky-600 font-bold flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" /> قيد مراجعة الموارد البشرية
                      </span>
                    )}
                    {d.status === "rejected" && (
                      <span className="text-rose-600 font-bold flex items-center gap-1">
                        <AlertTriangle className="h-3.5 w-3.5" /> مرفوض: {d.rejectionReason}
                      </span>
                    )}
                    {d.status === "pending" && (
                      <span className="text-muted-foreground flex items-center gap-1">
                        بانتظار الرفع
                      </span>
                    )}
                  </div>

                  {d.status !== "verified" && (
                    <button
                      onClick={() => {
                        toast.info("يرجى اختيار ملف الوثيقة من جهازك بصيغة PDF أو صورة واضحة");
                      }}
                      className="px-3 py-1.5 text-xs font-bold rounded-xl border border-input hover:bg-muted text-foreground flex items-center gap-1.5 transition-colors"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      {d.status === "uploaded" ? "استبدال" : "رفع المستند"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Digital Policy Acknowledgements */}
      {activeTab === "policies" && (
        <div className="space-y-4">
          <div className="text-xs text-muted-foreground">
            يرجى مراجعة وتأكيد الإقرار الرقمي على لوائح وأنظمة العمل المعتمدة:
          </div>

          {[
            {
              code: "POL_CONDUCT",
              titleAr: "ميثاق السلوك المهني وأخلاقيات العمل",
              titleEn: "Code of Conduct & Ethics",
              desc: "الالتزام بقيم النزاهة، الأمانة المهنية، والحفاظ على سرية معلومات المنشأة وعملائها.",
            },
            {
              code: "POL_CYBER",
              titleAr: "سياسة الأمن السيبراني واستخدام الأصول التقنية",
              titleEn: "Cybersecurity & IT Usage Policy",
              desc: "ضوابط استخدام البريد الإلكتروني المؤسسي، حماية كلمات المرور، واستخدام الأجهزة المصروفة.",
            },
            {
              code: "POL_SAFETY",
              titleAr: "سياسة السلامة المهنية والصحة والبيئة",
              titleEn: "Health, Safety & Environment Policy",
              desc: "إرشادات السلامة العامة في بيئة العمل، خطط الطوارئ، وتدابير الحماية والوقاية.",
            },
          ].map((pol) => {
            const acknowledged = isAck(pol.code);
            return (
              <div
                key={pol.code}
                className="p-5 rounded-2xl bg-card border border-border shadow-xs space-y-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-primary" />
                      <h4 className="text-sm font-bold text-foreground">{pol.titleAr}</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">{pol.desc}</p>
                  </div>
                  {acknowledged ? (
                    <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-xs font-bold flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" /> تم الإقرار رقمياً
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-700 text-xs font-bold">
                      بانتظار التوقيع
                    </span>
                  )}
                </div>

                {!acknowledged && (
                  <div className="pt-3 border-t border-border flex flex-col sm:flex-row items-center gap-3">
                    <input
                      type="text"
                      placeholder="اكتب اسمك الكامل كتوقيع إلكتروني ملزم..."
                      value={signatureText}
                      onChange={(e) => setSignatureText(e.target.value)}
                      className="w-full sm:flex-1 h-9 px-3 text-xs rounded-xl border border-input bg-background text-foreground focus:ring-2 focus:ring-primary focus:outline-hidden"
                    />
                    <button
                      onClick={() => handleAcknowledge(pol.code, pol.titleAr, pol.titleEn)}
                      disabled={submittingAck || !signatureText.trim()}
                      className="w-full sm:w-auto px-4 py-2 text-xs font-bold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      إقرار وتوقيع
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Tab: Assets & Day 1 Readiness */}
      {activeTab === "assets" && (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl bg-card border border-border shadow-xs space-y-4">
            <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Laptop className="h-4 w-4 text-primary" />
              تجهيزات اليوم الأول (Day 1 Readiness)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-muted/40 border border-border space-y-1">
                <span className="text-muted-foreground block">البريد الإلكتروني المؤسسي:</span>
                <span className="font-bold text-foreground font-mono">
                  {onboardingCase.employeeNo
                    ? `${onboardingCase.employeeNo.toLowerCase()}@madarx.sa`
                    : "قيد الإنشاء"}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-muted/40 border border-border space-y-1">
                <span className="text-muted-foreground block">بطاقة الدخول وبصمة الحضور:</span>
                <span className="font-bold text-emerald-600">جاهزة للاستلام في الاستقبال</span>
              </div>

              <div className="p-3 rounded-xl bg-muted/40 border border-border space-y-1">
                <span className="text-muted-foreground block">المرشد الزميل (Buddy):</span>
                <span className="font-bold text-foreground">
                  {onboardingCase.buddyName || "سيتم تعيينه في اليوم الأول"}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-muted/40 border border-border space-y-1">
                <span className="text-muted-foreground block">المدير المباشر:</span>
                <span className="font-bold text-foreground">
                  {onboardingCase.managerName || "مدير القسم"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
