import React, { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  UserPlus,
  Briefcase,
  Star,
  Layers,
  ShieldCheck,
  Plus,
  ExternalLink,
  CheckCircle2,
  Clock,
  Award,
  Filter,
} from "lucide-react";
import { useApp } from "../../lib/context/AppContext";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  useRecruitmentKpisQuery,
  useRecruitmentRequisitionsQuery,
  useTalentPoolQuery,
} from "../../lib/domains/recruitment";

export const RecruitmentSetupPanel: React.FC = () => {
  const navigate = useNavigate();
  const { company, employees, currentRole } = useApp();
  const companyId = company?.id;

  const kpisQuery = useRecruitmentKpisQuery(companyId);
  const requisitionsQuery = useRecruitmentRequisitionsQuery({ companyId });
  const talentPoolQuery = useTalentPoolQuery({ companyId });

  const kpis = kpisQuery.data;
  const requisitions = requisitionsQuery.data ?? [];
  const talentPool = talentPoolQuery.data ?? [];

  // Standard Pipeline Stages
  const pipelineStages = [
    { key: "applied", labelAr: "مقدم جديد", slaDays: 2, description: "استلام السيرة الذاتية وفحص استيفاء الشروط الأساسية" },
    { key: "screening", labelAr: "الفرز والتدقيق الأولي", slaDays: 3, description: "مطابقة الخبرات والتواصل الهاتفي الاستكشافي" },
    { key: "interview", labelAr: "المقابلة الشخصية", slaDays: 5, description: "المقابلة الفنية والسلوكية مع فريق العمل والمدير" },
    { key: "assessment", labelAr: "التقييم الفني والمهمة", slaDays: 4, description: "اختبار القدرات أو دراسة الحالة المهنية" },
    { key: "job_offer", labelAr: "العرض الوظيفي", slaDays: 3, description: "إعداد واعتماد العرض المالي وإرساله للمرشح" },
    { key: "hired", labelAr: "تم التعيين والمباشرة", slaDays: 1, description: "التحويل الفوري لملف موظف والبدء في التهيئة" },
  ];

  // Standard Scorecard Criteria
  const scorecardCriteria = [
    { name: "المهارات الفنية والتخصصية", weightPct: 35, description: "إتقان الأدوات والمعارف المرتبطة بالوظيفة الشاغرة" },
    { name: "مهارات التواصل والعمل الجماعي", weightPct: 25, description: "القدرة على التعبير والتعاون والتفاوض الإيجابي" },
    { name: "التوافق الثقافي والقيم المؤسسية", weightPct: 20, description: "الانسجام مع قيم المنشأة وسلوكيات العمل الاحترافي" },
    { name: "حل المشكلات والتفكير التحليلي", weightPct: 20, description: "المنهجية في التعامل مع التحديات واتخاذ القرارات" },
  ];

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header Banner */}
      <div className="rounded-3xl border border-primary/20 bg-gradient-to-l from-primary/10 via-card to-card p-6 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Badge className="bg-primary/15 text-primary border-primary/30 text-xs font-bold">
              حوكمة التوظيف واستقطاب الكفاءات
            </Badge>
            <Badge variant="outline" className="text-[11px] font-mono">
              {pipelineStages.length} مراحل توظيف • {scorecardCriteria.length} معايير تقييم
            </Badge>
          </div>
          <h2 className="text-lg font-black text-foreground">
            تهيئة مراحل التوظيف ومعايير تقييم المقابلات وبنك المواهب
          </h2>
          <p className="text-xs text-muted-foreground max-w-3xl leading-relaxed">
            ضبط سياسات طلبات الاحتياج الوظيفي، وتحديد أوزان بطاقات التقييم (Scorecards) ومراحل خط أنابيب المرشحين، وقواعد الاحتفاظ ببنك المواهب. لإجراء المقابلات وإصدار العروض وتحويل المرشحين، انتقل إلى شاشة العمليات.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate({ to: "/recruitment" })}
            className="rounded-xl text-xs font-bold gap-1.5"
          >
            <ExternalLink className="h-3.5 w-3.5 text-primary" />
            شاشة عمليات التوظيف والفرز
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-bold">
            <span>مراحل مسار التعيين</span>
            <Layers className="h-4 w-4 text-primary" />
          </div>
          <div className="text-2xl font-black text-foreground font-mono">{pipelineStages.length}</div>
          <p className="text-[11px] text-muted-foreground">مراحل محددة بـ SLA ملزم</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-bold">
            <span>أوزان بطاقة التقييم</span>
            <Award className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-foreground font-mono">100%</div>
          <p className="text-[11px] text-muted-foreground">موزعة على 4 معايير معيارية</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-bold">
            <span>بنك المواهب المحفوظ</span>
            <Star className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-foreground font-mono">
            {talentPool.length}
          </div>
          <p className="text-[11px] text-muted-foreground">مرشحين محفوظين للفرص المستقبلية</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-bold">
            <span>الوظائف الشاغرة المعتمدة</span>
            <Briefcase className="h-4 w-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-foreground font-mono">
            {kpis?.openJobs ?? 0}
          </div>
          <p className="text-[11px] text-muted-foreground">شواغر جاهزة للنشر والاستقطاب</p>
        </div>
      </div>

      {/* Section 1: Standard Scorecard Weighting & Assessment Governance */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-black text-foreground flex items-center gap-2">
              <Star className="h-4 w-4 text-primary" />
              معايير بطاقة تقييم المقابلات الموحدة (Interview Scorecard)
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              الأوزان المعتمدة لحساب التقييم النهائي للمرشح وتحديد أهلية التوصية بالتعيين
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {scorecardCriteria.map((crit, idx) => (
            <div
              key={idx}
              className="rounded-2xl border border-border/80 bg-muted/20 p-4 space-y-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-black text-foreground">{crit.name}</span>
                <Badge className="bg-primary/10 text-primary border-primary/20 text-xs font-mono font-bold">
                  {crit.weightPct}%
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {crit.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Section 2: Pipeline Stages & SLA Matrix */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <div>
          <h3 className="text-sm font-black text-foreground flex items-center gap-2">
            <Layers className="h-4 w-4 text-indigo-600" />
            حوكمة مراحل خط أنابيب التوظيف واتفاقية مستوى الخدمة (SLA)
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            الحد الأقصى لأيام العمل المسموح بها في كل مرحلة لمنع تراكم الطلبات وضمان سرعة التعيين
          </p>
        </div>

        <div className="divide-y divide-border">
          {pipelineStages.map((stg) => (
            <div
              key={stg.key}
              className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
            >
              <div>
                <span className="font-bold text-foreground">{stg.labelAr}</span>
                <span className="text-[11px] text-muted-foreground block mt-0.5">
                  {stg.description}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="text-[10px] gap-1 font-mono">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  المهلة القصوى: {stg.slaDays} أيام عمل
                </Badge>
                <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-500/20 text-[10px]">
                  مرحلة قياسية
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
