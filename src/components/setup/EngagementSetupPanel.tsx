import React from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Heart,
  Smile,
  ShieldCheck,
  Lock,
  Award,
  Sparkles,
  ExternalLink,
  CheckCircle2,
  HelpCircle,
  BarChart3,
  Users2,
} from "lucide-react";
import { useApp } from "../../lib/context/AppContext";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { engagementQueryKeys } from "../../lib/query/engagement-query-keys";
import {
  fetchEngagementKpis,
  fetchSurveyQuestions,
  fetchRecognitionCampaigns,
} from "../../lib/data/engagement-repository";

export const EngagementSetupPanel: React.FC = () => {
  const navigate = useNavigate();
  const { company, employees } = useApp();
  const companyId = company?.id || employees[0]?.subsidiaryId || "default";

  const { data: kpis } = useQuery({
    queryKey: engagementQueryKeys.kpis(companyId),
    queryFn: () => fetchEngagementKpis(companyId),
    enabled: Boolean(companyId),
  });

  const { data: questions = [] } = useQuery({
    queryKey: engagementQueryKeys.questions.list(companyId, "all"),
    queryFn: () => fetchSurveyQuestions(companyId, "all"),
    enabled: Boolean(companyId),
  });

  const { data: campaigns = [] } = useQuery({
    queryKey: engagementQueryKeys.campaigns.list(companyId),
    queryFn: () => fetchRecognitionCampaigns(companyId),
    enabled: Boolean(companyId),
  });

  // Standard Question Bank Categories
  const questionCategories = [
    { key: "workplace", titleAr: "بيئة وثقافة العمل", count: 8, description: "قياس الراحة النفسية والمادية والأمان الوظيفي وروح الفريق" },
    { key: "leadership", titleAr: "القيادة والتواصل الشفاف", count: 6, description: "تقييم وضوح الرؤية ودعم الإدارة وثقة الموظفين بالقادة" },
    { key: "growth", titleAr: "التطوير والمسار المهني", count: 7, description: "فرص التعلم والتدريب والترقي واستغلال القدرات الفردية" },
    { key: "rewards", titleAr: "التقدير والمكافآت والعدالة", count: 5, description: "ملاءمة التقدير المعنوي والمادي مع حجم الجهد والإنجاز" },
    { key: "wellbeing", titleAr: "التوازن وجودة الحياة", count: 4, description: "التوازن بين متطلبات العمل والحياة الشخصية وإدارة الضغوط" },
  ];

  // Recognition Badges Catalog
  const recognitionBadges = [
    { title: "بطل الخدمة والتميز", type: "peer_to_peer", icon: "⭐", description: "شكر وتقدير فوري بين الزملاء عند تقديم مساعدة استثنائية" },
    { title: "روح الابتكار والإبداع", type: "manager_award", icon: "💡", description: "تكريم المبادرات والأفكار النوعية التي طوّرت سير العمل" },
    { title: "العمل بروح الفريق الواحد", type: "company_wide", icon: "🤝", description: "وسام شهري لتعزيز التعاون والتكاتف بين الأقسام المختلفة" },
    { title: "التفاني والالتزام المتميز", type: "quarterly", icon: "🏆", description: "تقدير ربع سنوي لأصحاب الأداء الثابت والالتزام المتقن" },
  ];

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header Banner */}
      <div className="rounded-3xl border border-primary/20 bg-gradient-to-l from-primary/10 via-card to-card p-6 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Badge className="bg-primary/15 text-primary border-primary/30 text-xs font-bold">
              حوكمة الارتباط المؤسسي والنبض
            </Badge>
            <Badge variant="outline" className="text-[11px] font-mono">
              حاجز سرية إلزامي (N ≥ 5) • {questions.length} أسئلة معيارية
            </Badge>
          </div>
          <h2 className="text-lg font-black text-foreground">
            تهيئة بنك أسئلة النبض، سياسات سرية الاستبيانات، وحملات التقدير
          </h2>
          <p className="text-xs text-muted-foreground max-w-3xl leading-relaxed">
            ضبط محاور قياس نبض المنشأة واستبيانات الرضا، وفرض حاجز السرية الصارم لحماية هوية المشاركين، وإدارة كتالوج أوسمة التقدير وثقافة الشكر. لإطلاق استبيان فعلي أو تقديم شهادات التقدير، انتقل إلى شاشة العمليات.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate({ to: "/engagement" })}
            className="rounded-xl text-xs font-bold gap-1.5"
          >
            <ExternalLink className="h-3.5 w-3.5 text-primary" />
            شاشة نبض واستبيانات الموظفين
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-bold">
            <span>محاور قياس الارتباط</span>
            <Smile className="h-4 w-4 text-primary" />
          </div>
          <div className="text-2xl font-black text-foreground font-mono">
            {questionCategories.length}
          </div>
          <p className="text-[11px] text-muted-foreground">محاور معتمدة دولياً لقياس الـ eNPS</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-bold">
            <span>حاجز السرية الإلزامي</span>
            <Lock className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-foreground font-mono">5 ردود</div>
          <p className="text-[11px] text-muted-foreground">حظر إظهار أي قسم يقل عن 5 مشاركين</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-bold">
            <span>أوسمة التقدير المعتمدة</span>
            <Award className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-foreground font-mono">
            {recognitionBadges.length}
          </div>
          <p className="text-[11px] text-muted-foreground">أوسمة للشكر الفوري والشهري والربع سنوي</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-bold">
            <span>حملات التقدير النشطة</span>
            <Sparkles className="h-4 w-4 text-purple-600" />
          </div>
          <div className="text-2xl font-black text-foreground font-mono">
            {campaigns.length}
          </div>
          <p className="text-[11px] text-muted-foreground">حملات تحفيز وتنافس بين الفرق</p>
        </div>
      </div>

      {/* Section 1: Strict Anonymity & Privacy Policy */}
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 space-y-2.5">
        <div className="flex items-center gap-2 text-emerald-800 font-black text-sm">
          <ShieldCheck className="h-5 w-5 text-emerald-600" />
          مبدأ السرية المطلقة في استبيانات النبض (Anonymity Threshold Governance)
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          يلتزم النظام ببروتوكول السرية المشفر: يتم تشفير جميع إجابات استبيانات الرضا والنبض وفصلها تماماً عن معرفات المستخدمين (User IDs). لا يمكن لأي مسؤول أو مدير استعراض نتائج أي وحدة تنظيمية أو قسم يقل عدد المشاركين فيه عن <strong>5 موظفين</strong>، وتُدمج نتائجهم تلقائياً في الإدارة العليا لمنع أي محاولة للتعرف على أصحاب الآراء.
        </p>
      </div>

      {/* Section 2: Question Categories & Recognition Badges */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <h3 className="text-sm font-black text-foreground flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-primary" />
            محاور بنك الأسئلة المعتمدة ({questionCategories.length})
          </h3>
          <p className="text-xs text-muted-foreground">
            تصنيفات الأسئلة الموحدة لقياس أبعاد الرضا والارتباط المؤسسي
          </p>
          <div className="divide-y divide-border">
            {questionCategories.map((cat) => (
              <div key={cat.key} className="py-2.5 flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-foreground">{cat.titleAr}</div>
                  <div className="text-[11px] text-muted-foreground">{cat.description}</div>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono">
                  {cat.count} أسئلة
                </Badge>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <h3 className="text-sm font-black text-foreground flex items-center gap-2">
            <Award className="h-4 w-4 text-amber-500" />
            كتالوج أوسمة الشكر والتقدير ({recognitionBadges.length})
          </h3>
          <p className="text-xs text-muted-foreground">
            الأوسمة المتاحة للموظفين والمديرين لتعزيز ثقافة الاعتراف بالإنجاز
          </p>
          <div className="divide-y divide-border">
            {recognitionBadges.map((badge, idx) => (
              <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <span className="text-lg">{badge.icon}</span>
                  <div>
                    <div className="font-bold text-foreground">{badge.title}</div>
                    <div className="text-[11px] text-muted-foreground">{badge.description}</div>
                  </div>
                </div>
                <Badge className="bg-amber-500/10 text-amber-700 border-amber-500/20 text-[10px]">
                  معتمد
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
