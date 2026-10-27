import React from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  GraduationCap,
  Scale,
  ShieldCheck,
  AlertTriangle,
  Award,
  ExternalLink,
  CheckCircle2,
  Clock,
  FolderLock,
} from "lucide-react";
import { useApp } from "../../lib/context/AppContext";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { learningQueryKeys } from "../../lib/query/learning-query-keys";
import {
  fetchSkills,
  fetchCertificationsCatalog,
  fetchMandatoryRules,
  triggerMandatoryAssignment,
  triggerCertificationExpiryCheck,
} from "../../lib/data/learning-repository";
import {
  formatCaseType,
  formatConfidentialityLevel,
  formatWarningLevel,
} from "../../lib/domains/employee-relations";

export const LearningErSetupPanel: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { company, employees } = useApp();
  const companyId = company?.id || employees[0]?.subsidiaryId || "default";

  const { data: skills = [] } = useQuery({
    queryKey: learningQueryKeys.skills.list(companyId),
    queryFn: () => fetchSkills(companyId),
    enabled: Boolean(companyId),
  });

  const { data: certCatalog = [] } = useQuery({
    queryKey: learningQueryKeys.certifications.catalog(companyId),
    queryFn: () => fetchCertificationsCatalog(companyId),
    enabled: Boolean(companyId),
  });

  const { data: mandatoryRules = [] } = useQuery({
    queryKey: learningQueryKeys.mandatoryRules(companyId),
    queryFn: () => fetchMandatoryRules(companyId),
    enabled: Boolean(companyId),
  });

  const assignMandatoryMutation = useMutation({
    mutationFn: (ruleId: string) => triggerMandatoryAssignment(companyId, ruleId),
    onSuccess: (res) => {
      if (res.success) {
        toast.success(`تم إسناد التدريب الإلزامي بنجاح إلى ${res.assignedCount || 0} موظفاً`);
        queryClient.invalidateQueries({ queryKey: learningQueryKeys.kpis(companyId) });
      } else {
        toast.error(res.error || "فشل إسناد التدريب الإلزامي");
      }
    },
  });

  const checkExpiryMutation = useMutation({
    mutationFn: () => triggerCertificationExpiryCheck(companyId),
    onSuccess: (res) => {
      if (res.success) {
        toast.success(`تم فحص الشهادات المهنية وإنشاء مهام التجديد (${res.processedCount || 0} شهادة)`);
        queryClient.invalidateQueries({ queryKey: learningQueryKeys.certifications.employeeList(companyId) });
      }
    },
  });

  const disciplinaryMatrix = [
    {
      level: "first_written" as const,
      slaDays: 5,
      validityMonths: 6,
      authority: "إدارة علاقات الموظفين",
    },
    {
      level: "second_written" as const,
      slaDays: 5,
      validityMonths: 12,
      authority: "مدير الموارد البشرية",
    },
    {
      level: "final" as const,
      slaDays: 7,
      validityMonths: 12,
      authority: "لجنة التحقيق الإداري والاعتماد التنفيذي",
    },
  ];

  const caseSlaGovernance = [
    { type: "grievance" as const, confidentiality: "restricted_hr" as const, targetSlaDays: 7 },
    { type: "misconduct" as const, confidentiality: "highly_confidential" as const, targetSlaDays: 10 },
    { type: "harassment_allegation" as const, confidentiality: "highly_confidential" as const, targetSlaDays: 5 },
    { type: "policy_violation" as const, confidentiality: "restricted_hr" as const, targetSlaDays: 7 },
  ];

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header Banner */}
      <div className="rounded-3xl border border-primary/20 bg-gradient-to-l from-primary/10 via-card to-card p-6 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Badge className="bg-primary/15 text-primary border-primary/30 text-xs font-bold">
              حوكمة التدريب الإلزامي وعلاقات الموظفين
            </Badge>
            <Badge variant="outline" className="text-[11px] font-mono">
              {mandatoryRules.length} قاعدة إلزامية • {skills.length} مهارة • لائحة الجزاءات
            </Badge>
          </div>
          <h2 className="text-lg font-black text-foreground">
            تهيئة قواعد التدريب الإلزامي ودليل المهارات ولائحة التحقيقات والجزاءات
          </h2>
          <p className="text-xs text-muted-foreground max-w-3xl leading-relaxed">
            إدارة قواعد الامتثال التدريبي والشهادات الاحترافية ومصفوفة المهارات، إلى جانب ضبط مستويات السرية ومهل التحقيقات الإدارية (SLA) وتدرج الإنذارات. لإدارة الجلسات التدريبية أو تسجيل القضايا والتحقيقات اليومية، انتقل إلى شاشات العمليات.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => checkExpiryMutation.mutate()}
            disabled={checkExpiryMutation.isPending}
            className="rounded-xl text-xs font-bold gap-1.5"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            فحص صلاحية التراخيص المهنية
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate({ to: "/learning" })}
            className="rounded-xl text-xs font-bold gap-1.5"
          >
            <ExternalLink className="h-3.5 w-3.5 text-primary" />
            شاشة عمليات التدريب والتعلم
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate({ to: "/employee-relations" })}
            className="rounded-xl text-xs font-bold gap-1.5"
          >
            <Scale className="h-3.5 w-3.5 text-primary" />
            شاشة قضايا وتحقيقات الموظفين
          </Button>
        </div>
      </div>

      {/* Section 1: Mandatory Training Rules & Skills Catalog */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-foreground flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                قواعد التدريب الإلزامي والامتثال ({mandatoryRules.length})
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                إسناد الدورات الإلزامية آلياً للفئات المستهدفة وضبط مهل الإنجاز
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {mandatoryRules.map((rule) => (
              <div
                key={rule.id}
                className="rounded-xl border border-border/80 bg-muted/20 p-3.5 space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-black text-foreground">{rule.ruleNameAr}</div>
                    <div className="text-[11px] text-muted-foreground">
                      الدورة: {rule.courseTitleAr}
                    </div>
                  </div>
                  <Badge variant="destructive" className="text-[10px]">
                    إلزامي ({rule.daysToComplete} يوم)
                  </Badge>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-muted-foreground">
                    الفئة المستهدفة: <strong className="text-foreground">{rule.targetType}</strong>
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => assignMandatoryMutation.mutate(rule.id)}
                    disabled={assignMandatoryMutation.isPending}
                    className="h-7 text-[11px] font-bold gap-1"
                  >
                    <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                    تفعيل الإسناد التلقائي
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-foreground flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-primary" />
                دليل المهارات والشهادات المهنية ({skills.length} مهارة • {certCatalog.length} شهادة)
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                تصنيف المهارات الفنية والقيادية المعتمدة في مصفوفة الفجوات
              </p>
            </div>
          </div>

          <div className="divide-y divide-border max-h-64 overflow-y-auto">
            {skills.slice(0, 8).map((sk) => (
              <div key={sk.id} className="py-2.5 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-foreground">{sk.nameAr}</span>
                  <span className="block text-[10px] text-muted-foreground font-mono">
                    {sk.code} • {sk.nameEn}
                  </span>
                </div>
                <Badge variant="outline" className="text-[10px]">
                  {sk.categoryNameAr || "مهارة معيارية"}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Section 2: Employee Relations SLA & Disciplinary Matrix Governance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <h3 className="text-sm font-black text-foreground flex items-center gap-2">
            <Scale className="h-4 w-4 text-primary" />
            مصفوفة تدرج الإنذارات والجزاءات التأديبية المعتمدة
          </h3>
          <p className="text-xs text-muted-foreground">
            ضوابط التدرج النظامي للإنذارات ومهل التظلم وفترة سريان الإنذار في ملف الموظف
          </p>
          <div className="divide-y divide-border">
            {disciplinaryMatrix.map((item) => (
              <div key={item.level} className="py-2.5 flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-foreground">{formatWarningLevel(item.level)}</div>
                  <div className="text-[11px] text-muted-foreground">
                    صلاحية الاعتماد: {item.authority}
                  </div>
                </div>
                <div className="text-left">
                  <Badge variant="outline" className="text-[10px] font-mono">
                    مهلة التظلم: {item.slaDays} أيام • سريان: {item.validityMonths} شهر
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <h3 className="text-sm font-black text-foreground flex items-center gap-2">
            <FolderLock className="h-4 w-4 text-indigo-600" />
            حوكمة سرية القضايا واتفاقيات مستوى الخدمة للتحقيقات (SLA)
          </h3>
          <p className="text-xs text-muted-foreground">
            المهل القياسية لإنجاز التحقيق الإداري ومستوى السرية الافتراضي لكل تصنيف قضية
          </p>
          <div className="divide-y divide-border">
            {caseSlaGovernance.map((row) => (
              <div key={row.type} className="py-2.5 flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-foreground">{formatCaseType(row.type)}</div>
                  <div className="text-[11px] text-muted-foreground">
                    مستوى السرية: {formatConfidentialityLevel(row.confidentiality)}
                  </div>
                </div>
                <Badge className="bg-indigo-500/10 text-indigo-700 border-indigo-500/20 text-[10px] gap-1">
                  <Clock className="h-3 w-3" />
                  SLA: {row.targetSlaDays} أيام عمل
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
