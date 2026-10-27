import React, { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useApp } from "../../lib/context/AppContext";
import {
  fetchOnboardingTemplates,
  fetchOnboardingTaskDefinitions,
  fetchProbationPolicies,
} from "../../lib/data/onboarding-repository";
import type {
  OnboardingTemplate,
  OnboardingTaskDefinition,
  ProbationPolicy,
} from "../../lib/domains/onboarding";
import {
  UserPlus,
  Layers,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  Clock,
  RefreshCw,
} from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { toast } from "sonner";

export const OnboardingProbationSetupPanel: React.FC = () => {
  const { company, employees } = useApp();
  const navigate = useNavigate();
  const companyId = company?.id || employees[0]?.subsidiaryId || "default";

  const [templates, setTemplates] = useState<OnboardingTemplate[]>([]);
  const [taskDefinitions, setTaskDefinitions] = useState<OnboardingTaskDefinition[]>([]);
  const [probationPolicies, setProbationPolicies] = useState<ProbationPolicy[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadSetupData = async () => {
    try {
      setLoading(true);
      const [templatesRes, taskDefsRes, policiesRes] = await Promise.all([
        fetchOnboardingTemplates(companyId),
        fetchOnboardingTaskDefinitions(companyId),
        fetchProbationPolicies(companyId),
      ]);
      setTemplates(templatesRes);
      setTaskDefinitions(taskDefsRes);
      setProbationPolicies(policiesRes);
    } catch {
      toast.error("تعذر تحميل قوالب التهيئة وسياسات فترة التجربة");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSetupData();
  }, [companyId]);

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base font-black text-foreground flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              تهيئة قوالب المباشرة ومكتبة المهام وسياسات التجربة لشركة «{company?.legalNameAr || "الأندلس"}»
            </h2>
            <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px] font-bold">
              شاشة التهيئة والحوكمة
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            ضبط نماذج تهيئة المنضمين الجدد، مكتبة المهام القياسية، ولوائح فترة التجربة، بينما تتم متابعة ملفات الموظفين اليومية وقرارات التثبيت في شاشة التهيئة.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={loadSetupData}
            disabled={loading}
            className="rounded-full text-xs font-bold gap-1.5 h-9 px-3 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            تحديث
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate({ to: "/onboarding" })}
            className="rounded-full text-xs font-bold gap-1.5 h-9 px-3.5 border-primary/30 text-primary hover:bg-primary/5 cursor-pointer"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            الانتقال لملفات التهيئة وجاهزية المباشرة
          </Button>
        </div>
      </div>

      {/* Section 1: Probation Policies */}
      <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-black text-foreground">
              سياسات ولوائح فترة التجربة المعتمدة ({probationPolicies.length})
            </h3>
          </div>
          <Badge variant="outline" className="text-[10px] font-bold rounded-full">
            متوافقة مع نظام العمل
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          {probationPolicies.length === 0 ? (
            <div className="col-span-3 p-4 rounded-2xl bg-muted/30 border border-border/60 flex items-center justify-between">
              <div>
                <span className="font-black text-foreground block">السياسة القياسية لفترة التجربة (نظام العمل السعودي — المادة 53)</span>
                <span className="text-[11px] text-muted-foreground mt-0.5 block">
                  المدة الأساسية: 90 يوماً • الحد الأقصى بعد التمديد الخطي: 180 يوماً • تنبيه التقييم قبل 14 يوماً
                </span>
              </div>
              <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-300 text-[10px] rounded-full font-bold">
                مفعلة تلقائياً
              </Badge>
            </div>
          ) : (
            probationPolicies.map((pol: any) => (
              <div key={pol.id} className="p-4 rounded-2xl bg-muted/30 border border-border/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-black text-foreground">{pol.nameAr || pol.country || "سياسة فترة التجربة"}</span>
                  <Badge variant="outline" className="text-[10px] font-mono rounded-full">
                    {pol.defaultDays || 90} يوم
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  الحد الأقصى للتمديد: {pol.maxDaysWithExtension || 180} يوماً
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Section 2: Onboarding Templates */}
      <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-black text-foreground">
              نماذج وقوالب التهيئة المعتمدة للمنشأة ({templates.length})
            </h3>
          </div>
          <Badge variant="outline" className="text-[10px] font-bold rounded-full">
            حسب الدولة ونمط التعاقد
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {templates.map((t) => (
            <div
              key={t.id}
              className="p-4 rounded-2xl bg-muted/20 border border-border/70 space-y-2.5 text-xs"
            >
              <div className="flex items-start justify-between gap-2">
                <h4 className="font-black text-foreground text-sm">{t.nameAr}</h4>
                <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] rounded-full">
                  إصدار {t.currentVersion}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">{t.descriptionAr || t.nameEn}</p>
              <div className="pt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                <span>الدولة: {t.country}</span>
                <span>النمط: {t.employmentType}</span>
              </div>
            </div>
          ))}
          {templates.length === 0 && !loading && (
            <div className="col-span-3 text-center py-6 text-xs text-muted-foreground">
              لا توجد قوالب تهيئة مسجلة حالياً.
            </div>
          )}
        </div>
      </div>

      {/* Section 3: Standard Task Library */}
      <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-emerald-600" />
            <h3 className="text-sm font-black text-foreground">
              مكتبة المهام المعيارية للتهيئة ({taskDefinitions.length} مهمة قياسية)
            </h3>
          </div>
          <Badge variant="outline" className="text-[10px] font-bold rounded-full border-emerald-500/30 text-emerald-600">
            جاهزية اليوم الأول (Day 1)
          </Badge>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-border/60">
          <table className="w-full text-right text-xs">
            <thead className="bg-muted/40 border-b border-border/60 text-muted-foreground font-bold">
              <tr>
                <th className="py-3 px-4">رمز المهمة</th>
                <th className="py-3 px-4">عنوان المهمة</th>
                <th className="py-3 px-4">الجهة المسؤولة</th>
                <th className="py-3 px-4">التصنيف</th>
                <th className="py-3 px-4 text-center">الموعد النسبي</th>
                <th className="py-3 px-4 text-center">شرط المباشرة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {taskDefinitions.map((td) => (
                <tr key={td.id} className="hover:bg-muted/20">
                  <td className="py-3 px-4 font-mono font-bold text-primary">{td.code}</td>
                  <td className="py-3 px-4 font-bold text-foreground">
                    {td.titleAr}
                    <span className="block text-[10px] text-muted-foreground font-normal">
                      {td.titleEn}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant="outline" className="text-[10px] rounded-full font-bold">
                      {td.ownerRole}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-muted-foreground">{td.category}</td>
                  <td className="py-3 px-4 text-center font-mono font-bold text-foreground">
                    {td.relativeDueDays < 0
                      ? `T${td.relativeDueDays} يوم`
                      : td.relativeDueDays === 0
                        ? "Day 1"
                        : `Day +${td.relativeDueDays}`}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {td.isBlocking ? (
                      <Badge className="bg-rose-500/10 text-rose-600 border-rose-500/20 text-[10px] rounded-full font-bold">
                        مانعة للمباشرة
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-[11px]">اختيارية</span>
                    )}
                  </td>
                </tr>
              ))}
              {taskDefinitions.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    لا توجد مهام معيارية مسجلة حالياً.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
