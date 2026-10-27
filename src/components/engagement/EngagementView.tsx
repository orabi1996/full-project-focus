// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PROMPT 31: PRODUCTION EMPLOYEE ENGAGEMENT, SURVEYS, PULSE & RECOGNITION HUB
// src/components/engagement/EngagementView.tsx
// ============================================================================

import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Heart,
  Smile,
  BarChart3,
  TrendingUp,
  ShieldCheck,
  Lock,
  Target,
  Sparkles,
  Award,
  CheckCircle2,
  Clock,
  Plus,
  Send,
  HelpCircle,
  Eye,
  RefreshCw,
  Users2,
  Filter,
  Search,
  MessageSquare,
  AlertTriangle,
  FileText,
  Building,
  Settings,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "../ui/card";
import { supabase } from "../../integrations/supabase/client";
import { engagementQueryKeys } from "../../lib/query/engagement-query-keys";
import {
  fetchEngagementKpis,
  fetchSurveyInstances,
  fetchSurveyQuestions,
  fetchEngagementActionPlans,
  fetchEmployeeRecognitions,
  fetchRecognitionCampaigns,
  fetchCampaignNominations,
  launchSurveyInstance,
  recalculateSurveyAnalytics,
  toggleActionItemStatus,
  updateEngagementActionPlan,
} from "../../lib/data/engagement-repository";
import {
  formatSurveyStatus,
  formatSurveyType,
  formatDimensionName,
  formatActionPlanStatus,
  formatCampaignType,
  evaluateAnonymityThreshold,
  calculateEnps,
  type SurveyInstance,
  type SurveyQuestion,
  type EngagementActionPlan,
  type EmployeeRecognition,
  type RecognitionCampaign,
  type QuestionCategory,
} from "../../lib/domains/engagement";

import { CreateSurveyModal } from "./CreateSurveyModal";
import { TakeSurveyModal } from "./TakeSurveyModal";
import { SendRecognitionModal } from "./SendRecognitionModal";
import { CreateActionPlanModal } from "./CreateActionPlanModal";
import { NominateCampaignModal } from "./NominateCampaignModal";
import { CreateQuestionModal } from "./CreateQuestionModal";

interface EngagementViewProps {
  companyId?: string;
}

export const EngagementView: React.FC<EngagementViewProps> = ({ companyId: propCompanyId }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSurveyId, setSelectedSurveyId] = useState<string>("");
  const [questionCategoryFilter, setQuestionCategoryFilter] = useState<string>("all");

  // Modals state
  const [isCreateSurveyOpen, setIsCreateSurveyOpen] = useState(false);
  const [isTakeSurveyOpen, setIsTakeSurveyOpen] = useState(false);
  const [isSendRecognitionOpen, setIsSendRecognitionOpen] = useState(false);
  const [isCreateActionPlanOpen, setIsCreateActionPlanOpen] = useState(false);
  const [isNominateModalOpen, setIsNominateModalOpen] = useState(false);
  const [isCreateQuestionOpen, setIsCreateQuestionOpen] = useState(false);

  // Context resolution
  const [companyId, setCompanyId] = useState<string>(propCompanyId || "");
  const [currentEmployeeId, setCurrentEmployeeId] = useState<string>("");
  const [employees, setEmployees] = useState<Array<{ id: string; name: string; employeeNo?: string }>>([]);
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    async function resolveContext() {
      let cId = propCompanyId;
      if (!cId) {
        const { data } = await (supabase as any)
          .from("companies")
          .select("id")
          .limit(1)
          .maybeSingle();
        if (data) cId = data.id;
      }

      if (cId) {
        setCompanyId(cId);

        // Fetch company employees
        const { data: empData } = await (supabase as any)
          .from("employees")
          .select("id, first_name_ar, last_name_ar, employee_number")
          .eq("company_id", cId)
          .limit(200);

        if (empData) {
          setEmployees(
            empData.map((e: any) => ({
              id: e.id,
              name: `${e.first_name_ar} ${e.last_name_ar}`,
              employeeNo: e.employee_number,
            }))
          );
          if (empData.length > 0) {
            setCurrentEmployeeId(empData[0].id);
          }
        }

        // Fetch departments
        const { data: deptData } = await (supabase as any)
          .from("departments")
          .select("id, name_ar")
          .eq("company_id", cId);

        if (deptData) {
          setDepartments(
            deptData.map((d: any) => ({
              id: d.id,
              name: d.name_ar,
            }))
          );
        }
      }
    }
    resolveContext();
  }, [propCompanyId]);

  // Queries
  const { data: kpis } = useQuery({
    queryKey: engagementQueryKeys.kpis(companyId),
    queryFn: () => fetchEngagementKpis(companyId),
    enabled: !!companyId,
  });

  const { data: surveys = [] } = useQuery({
    queryKey: engagementQueryKeys.surveys.list(companyId),
    queryFn: () => fetchSurveyInstances(companyId),
    enabled: !!companyId,
  });

  const { data: questions = [] } = useQuery({
    queryKey: engagementQueryKeys.questions.list(companyId, questionCategoryFilter),
    queryFn: () => fetchSurveyQuestions(companyId, questionCategoryFilter),
    enabled: !!companyId,
  });

  const { data: actionPlans = [] } = useQuery({
    queryKey: engagementQueryKeys.actionPlans.list(companyId),
    queryFn: () => fetchEngagementActionPlans(companyId),
    enabled: !!companyId,
  });

  const { data: recognitions = [] } = useQuery({
    queryKey: engagementQueryKeys.recognitions.feed(companyId),
    queryFn: () => fetchEmployeeRecognitions(companyId),
    enabled: !!companyId,
  });

  const { data: campaigns = [] } = useQuery({
    queryKey: engagementQueryKeys.campaigns.list(companyId),
    queryFn: () => fetchRecognitionCampaigns(companyId),
    enabled: !!companyId,
  });

  // Selected survey for analytics
  const activeSurveyForAnalytics = useMemo(() => {
    if (selectedSurveyId) {
      return surveys.find((s) => s.id === selectedSurveyId) || surveys[0];
    }
    return surveys[0] || null;
  }, [surveys, selectedSurveyId]);

  // Invalidation helper
  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: engagementQueryKeys.all });
  };

  // Launch survey handler
  const handleLaunchSurvey = async (surveyId: string) => {
    try {
      await launchSurveyInstance(companyId, surveyId);
      toast.success("تم إطلاق الاستبيان بنجاح وتوليد رموز المشاركة المشفرة");
      refreshAll();
    } catch (err: any) {
      toast.error(err.message || "فشل إطلاق الاستبيان");
    }
  };

  // Recalculate analytics handler
  const handleRecalculate = async (surveyId: string) => {
    try {
      await recalculateSurveyAnalytics(companyId, surveyId);
      toast.success("تمت إعادة احتساب نتائج ومؤشرات الاستبيان بنجاح");
      refreshAll();
    } catch (err: any) {
      toast.error(err.message || "فشل إعادة احتساب النتائج");
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6" dir="rtl">
      {/* 1. Header & Actions Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 text-primary rounded-xl">
              <Smile className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-700 border border-emerald-500/20">
                  شاشة العمليات ونبض الرضا اليومي
                </span>
              </div>
              <h1 className="text-2xl font-black text-foreground tracking-tight">
                الارتباط المؤسسي والنبض والتقدير
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                منظومة قياس نبض المنشأة، استبيانات الرضا، مؤشر ولاء الموظفين (eNPS)، وثقافة الشكر والتقدير.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => navigate({ to: "/setup?tab=engagement_setup" as any })}
            variant="outline"
            className="gap-2 text-xs font-bold"
          >
            <Settings className="h-4 w-4 text-primary" />
            <span>تهيئة بنك الأسئلة وحملات التقدير</span>
          </Button>

          <Button
            onClick={() => setIsSendRecognitionOpen(true)}
            variant="outline"
            className="gap-2 border-amber-300 text-amber-700 hover:bg-amber-50"
          >
            <Heart className="h-4 w-4 fill-amber-500" />
            <span>إرسال شكر وتقدير</span>
          </Button>

          <Button
            onClick={() => setIsCreateActionPlanOpen(true)}
            variant="outline"
            className="gap-2"
          >
            <Target className="h-4 w-4" />
            <span>خطة عمل تحسين</span>
          </Button>

          <Button
            onClick={() => setIsCreateSurveyOpen(true)}
            className="gap-2 bg-primary shadow-xs"
          >
            <Plus className="h-4 w-4" />
            <span>إطلاق استبيان جديد</span>
          </Button>
        </div>
      </div>

      {/* 2. Primary KPI Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="p-4 rounded-xl border bg-card shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-muted-foreground">الاستبيانات النشطة</span>
            <h4 className="text-2xl font-black text-foreground mt-0.5 font-mono">
              {kpis?.activeSurveys ?? 0}
            </h4>
            <span className="text-[10px] text-emerald-600 font-bold">مفتوحة للمشاركة</span>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
            <BarChart3 className="h-5 w-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl border bg-card shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-muted-foreground">متوسط المشاركة</span>
            <h4 className="text-2xl font-black text-foreground mt-0.5 font-mono">
              {kpis?.avgParticipation ?? 0}%
            </h4>
            <span className="text-[10px] text-blue-600 font-bold">معدل الاستجابة</span>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-700">
            <Users2 className="h-5 w-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl border bg-card shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-muted-foreground">مؤشر الولاء (eNPS)</span>
            <h4 className="text-2xl font-black text-foreground mt-0.5 font-mono">
              {kpis?.latestEnps != null && kpis.latestEnps > 0 ? `+${kpis.latestEnps}` : kpis?.latestEnps ?? 0}
            </h4>
            <span className="text-[10px] text-emerald-600 font-bold">من -100 إلى +100</span>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-700">
            <TrendingUp className="h-5 w-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl border bg-card shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-muted-foreground">خطط عمل مفتوحة</span>
            <h4 className="text-2xl font-black text-foreground mt-0.5 font-mono">
              {kpis?.openActions ?? 0}
            </h4>
            <span className="text-[10px] text-amber-600 font-bold">
              {kpis?.overdueActions ?? 0} متأخرة
            </span>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-700">
            <Target className="h-5 w-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl border bg-card shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-muted-foreground">تقديرات هذا الشهر</span>
            <h4 className="text-2xl font-black text-foreground mt-0.5 font-mono">
              {kpis?.recognitionsMonth ?? 0}
            </h4>
            <span className="text-[10px] text-purple-600 font-bold">بطاقة شكر متبادلة</span>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-purple-100 flex items-center justify-center text-purple-700">
            <Heart className="h-5 w-5 fill-purple-600" />
          </div>
        </div>

        <div className="p-4 rounded-xl border bg-card shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-muted-foreground">موظفون تم تكريمهم</span>
            <h4 className="text-2xl font-black text-foreground mt-0.5 font-mono">
              {kpis?.recognizedEmployeesCount ?? 0}
            </h4>
            <span className="text-[10px] text-teal-600 font-bold">تغطية ثقافة التقدير</span>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-teal-100 flex items-center justify-center text-teal-700">
            <Award className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* 3. Navigation Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted p-1 rounded-xl flex flex-wrap h-auto gap-1">
          <TabsTrigger value="overview" className="gap-1.5 text-xs py-2 px-3">
            <Smile className="h-3.5 w-3.5" />
            <span>نظرة عامة وميثاق السرية</span>
          </TabsTrigger>
          <TabsTrigger value="surveys" className="gap-1.5 text-xs py-2 px-3">
            <BarChart3 className="h-3.5 w-3.5" />
            <span>الاستبيانات والحملات</span>
          </TabsTrigger>
          <TabsTrigger value="results" className="gap-1.5 text-xs py-2 px-3">
            <Building className="h-3.5 w-3.5" />
            <span>النتائج والمصفوفة الخرائطية</span>
          </TabsTrigger>
          <TabsTrigger value="enps" className="gap-1.5 text-xs py-2 px-3">
            <TrendingUp className="h-3.5 w-3.5" />
            <span>تحليل مؤشر الولاء (eNPS)</span>
          </TabsTrigger>
          <TabsTrigger value="action_plans" className="gap-1.5 text-xs py-2 px-3">
            <Target className="h-3.5 w-3.5" />
            <span>خطط التحسين والمتابعة</span>
          </TabsTrigger>
          <TabsTrigger value="recognition" className="gap-1.5 text-xs py-2 px-3">
            <Heart className="h-3.5 w-3.5" />
            <span>حائط التقدير والشارات</span>
          </TabsTrigger>
          <TabsTrigger value="campaigns" className="gap-1.5 text-xs py-2 px-3">
            <Award className="h-3.5 w-3.5" />
            <span>جوائز التميز وموظف الشهر</span>
          </TabsTrigger>
          <TabsTrigger value="questions" className="gap-1.5 text-xs py-2 px-3">
            <HelpCircle className="h-3.5 w-3.5" />
            <span>بنك الأسئلة والمحاور</span>
          </TabsTrigger>
        </TabsList>

        {/* ==================================================================== */}
        {/* TAB 1: OVERVIEW & PRIVACY POLICY                                      */}
        {/* ==================================================================== */}
        <TabsContent value="overview" className="space-y-4">
          {/* Privacy Guarantee Box */}
          <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 text-emerald-900 flex items-start gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg text-emerald-700 mt-0.5">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-sm">ميثاق الخصوصية وحماية هوية المشاركين في مدار إكس (MadarX Privacy Vault)</h4>
              <p className="text-xs text-emerald-800 leading-relaxed">
                تطبق منصة مدار إكس فصلاً تقنياً مطلقاً بين استجابات الاستبيانات السرية وسجلات الموظفين. لا يتم حفظ معرّف الموظف (Employee ID) في جدول الإجابات، ويتم استخدام رموز مشاركة مؤقتة ومشفرة. كما تفرض المنصة حظراً تلقائياً على استعراض النتائج لأي مجموعة أو إدارة يقل عدد المشاركين فيها عن حد الأمان الأدنى (5 استجابات) لمنع الاستنتاج العكسي وحماية حرية التعبير بالكامل.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Active Surveys Box */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>الاستبيانات المفتوحة للمشاركة حالياً</span>
                  <Badge variant="outline" className="text-xs">
                    {surveys.filter((s) => s.status === "open").length} نشط
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs">
                  يمكن للموظفين الإجابة فوراً وسرياً عبر الخدمة الذاتية (ESS).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {surveys.filter((s) => s.status === "open").length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground text-xs">
                    لا توجد استبيانات مفتوحة حالياً. يمكنك إطلاق استبيان جديد من الزر أعلاه.
                  </div>
                ) : (
                  surveys
                    .filter((s) => s.status === "open")
                    .map((s) => (
                      <div
                        key={s.id}
                        className="p-3 rounded-lg border bg-card flex items-center justify-between gap-3 hover:border-primary/40 transition-colors"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-foreground">{s.titleAr}</span>
                            <Badge variant="secondary" className="text-[10px]">
                              {formatSurveyType(s.surveyType).labelAr}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                            <span>الرمز: {s.code}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                              <Lock className="h-3 w-3" />
                              {s.anonymityMode === "anonymous" ? "سري بالكامل" : "محدد الهوية"}
                            </span>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedSurveyId(s.id);
                            setIsTakeSurveyOpen(true);
                          }}
                          className="gap-1.5 text-xs"
                        >
                          <Send className="h-3.5 w-3.5" />
                          <span>المشاركة الآن</span>
                        </Button>
                      </div>
                    ))
                )}
              </CardContent>
            </Card>

            {/* Recent Recognitions Feed Excerpt */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>أحدث بطاقات الشكر والتقدير</span>
                  <Badge variant="outline" className="text-xs">
                    {recognitions.length} تكريم
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs">
                  نبض التقدير المتبادل بين الزملاء وفرق العمل.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {recognitions.slice(0, 3).map((r) => (
                  <div
                    key={r.id}
                    className="p-3 rounded-lg border bg-card space-y-2 hover:border-amber-300 transition-colors"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 font-bold text-foreground">
                        <span>{r.senderNameAr || "زميل"}</span>
                        <span className="text-muted-foreground font-normal">← كرّم</span>
                        <span className="text-primary">{r.recipientNameAr || "زميل"}</span>
                      </div>
                      <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px]">
                        {r.categoryNameAr || "تقدير متميز"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 italic">
                      "{r.message}"
                    </p>
                  </div>
                ))}
                {recognitions.length === 0 && (
                  <div className="py-8 text-center text-muted-foreground text-xs">
                    لم يتم إرسال أي بطاقات تقدير حتى الآن. كن أول من يشكر زميلاً!
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ==================================================================== */}
        {/* TAB 2: SURVEYS & CAMPAIGNS                                            */}
        {/* ==================================================================== */}
        <TabsContent value="surveys" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <CardTitle className="text-base">إدارة حملات واستبيانات المنشأة</CardTitle>
                  <CardDescription className="text-xs">
                    متابعة دورات الاستبيانات، نسب الاستجابة، والإطلاق الفوري للفرق المشمولة.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="بحث برمز أو عنوان الاستبيان..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-9 w-60 text-xs"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right">
                  <thead>
                    <tr className="border-b bg-muted/30 text-muted-foreground">
                      <th className="p-3 font-semibold">الرمز</th>
                      <th className="p-3 font-semibold">عنوان الاستبيان</th>
                      <th className="p-3 font-semibold">النوع</th>
                      <th className="p-3 font-semibold">نمط السرية</th>
                      <th className="p-3 font-semibold">الحالة</th>
                      <th className="p-3 font-semibold">المؤهلين / المكتمل</th>
                      <th className="p-3 font-semibold">نسبة المشاركة</th>
                      <th className="p-3 font-semibold text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {surveys
                      .filter(
                        (s) =>
                          s.titleAr.includes(searchTerm) ||
                          s.code.toLowerCase().includes(searchTerm.toLowerCase())
                      )
                      .map((s) => {
                        const statusBadge = formatSurveyStatus(s.status);
                        return (
                          <tr key={s.id} className="border-b hover:bg-muted/20 transition-colors">
                            <td className="p-3 font-mono font-bold text-foreground">{s.code}</td>
                            <td className="p-3 font-semibold text-foreground">{s.titleAr}</td>
                            <td className="p-3 text-muted-foreground">
                              {formatSurveyType(s.surveyType).labelAr}
                            </td>
                            <td className="p-3">
                              <span className="flex items-center gap-1 font-semibold text-emerald-700">
                                <Lock className="h-3 w-3" />
                                {s.anonymityMode === "anonymous" ? "سري" : "معلن"}
                              </span>
                            </td>
                            <td className="p-3">
                              <Badge className={`${statusBadge.color} text-[10px]`}>
                                {statusBadge.labelAr}
                              </Badge>
                            </td>
                            <td className="p-3 font-mono">
                              {s.snapshot?.completedCount ?? 0} / {s.snapshot?.eligibleCount ?? 0}
                            </td>
                            <td className="p-3 font-mono font-bold">
                              {s.snapshot?.participationRate ?? 0}%
                            </td>
                            <td className="p-3">
                              <div className="flex items-center justify-center gap-1.5">
                                {s.status === "draft" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleLaunchSurvey(s.id)}
                                    className="h-7 text-[11px] gap-1"
                                  >
                                    <Send className="h-3 w-3" />
                                    <span>إطلاق</span>
                                  </Button>
                                )}
                                {s.status === "open" && (
                                  <Button
                                    size="sm"
                                    variant="default"
                                    onClick={() => {
                                      setSelectedSurveyId(s.id);
                                      setIsTakeSurveyOpen(true);
                                    }}
                                    className="h-7 text-[11px] gap-1"
                                  >
                                    <Send className="h-3 w-3" />
                                    <span>مشاركة</span>
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleRecalculate(s.id)}
                                  className="h-7 text-[11px] gap-1 text-muted-foreground"
                                  title="إعادة احتساب المؤشرات"
                                >
                                  <RefreshCw className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => {
                                    setSelectedSurveyId(s.id);
                                    setActiveTab("results");
                                  }}
                                  className="h-7 text-[11px] gap-1"
                                >
                                  <BarChart3 className="h-3 w-3" />
                                  <span>التحليلات</span>
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================================================================== */}
        {/* TAB 3: RESULTS & HEATMAP (WITH PRIVACY SUPPRESSION)                   */}
        {/* ==================================================================== */}
        <TabsContent value="results" className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-foreground">الاستبيان المعروض:</span>
              <select
                value={activeSurveyForAnalytics?.id || ""}
                onChange={(e) => setSelectedSurveyId(e.target.value)}
                className="h-9 px-3 rounded-md border text-xs bg-background"
              >
                {surveys.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.titleAr} ({s.code})
                  </option>
                ))}
              </select>
            </div>
            {activeSurveyForAnalytics && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleRecalculate(activeSurveyForAnalytics.id)}
                className="gap-1.5 text-xs"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>تحديث التحليلات الآن</span>
              </Button>
            )}
          </div>

          {activeSurveyForAnalytics ? (
            <div className="space-y-4">
              {/* Snapshot Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Card className="p-4">
                  <span className="text-xs text-muted-foreground font-medium">معدل الارتباط الإجمالي</span>
                  <div className="text-3xl font-black text-foreground mt-1 font-mono">
                    {activeSurveyForAnalytics.snapshot?.overallEngagementScore ?? 0}%
                  </div>
                  <span className="text-[11px] text-emerald-600 font-semibold">
                    محسوب من مقاييس ليكرت الخماسية المعتمدة
                  </span>
                </Card>

                <Card className="p-4">
                  <span className="text-xs text-muted-foreground font-medium">نسبة إكمال الاستبيان</span>
                  <div className="text-3xl font-black text-foreground mt-1 font-mono">
                    {activeSurveyForAnalytics.snapshot?.participationRate ?? 0}%
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    {activeSurveyForAnalytics.snapshot?.completedCount ?? 0} استجابة من أصل{" "}
                    {activeSurveyForAnalytics.snapshot?.eligibleCount ?? 0}
                  </span>
                </Card>

                <Card className="p-4">
                  <span className="text-xs text-muted-foreground font-medium">مؤشر الولاء (eNPS)</span>
                  <div className="text-3xl font-black text-foreground mt-1 font-mono">
                    {activeSurveyForAnalytics.snapshot?.enpsScore != null &&
                    activeSurveyForAnalytics.snapshot.enpsScore > 0
                      ? `+${activeSurveyForAnalytics.snapshot.enpsScore}`
                      : activeSurveyForAnalytics.snapshot?.enpsScore ?? 0}
                  </div>
                  <span className="text-[11px] text-purple-600 font-semibold">
                    المروجون {activeSurveyForAnalytics.snapshot?.promotersCount ?? 0} | المنتقدون{" "}
                    {activeSurveyForAnalytics.snapshot?.detractorsCount ?? 0}
                  </span>
                </Card>
              </div>

              {/* Department Breakdown Heatmap Table with Privacy Suppression */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">تحليل الإدارات ومصفوفة الخصوصية</CardTitle>
                      <CardDescription className="text-xs">
                        توزيع درجات الارتباط عبر الإدارات مع تطبيق آلية الحجب الصارم لحماية السرية (حد أدنى 5 مشاركين).
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="text-emerald-700 bg-emerald-50 border-emerald-300 text-xs gap-1">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      الخصوصية مفعلة
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-right">
                      <thead>
                        <tr className="border-b bg-muted/30 text-muted-foreground">
                          <th className="p-3 font-semibold">الإدارة / القسم</th>
                          <th className="p-3 font-semibold">عدد الاستجابات</th>
                          <th className="p-3 font-semibold">حالة السرية وحجم العينة</th>
                          <th className="p-3 font-semibold">متوسط درجة الارتباط</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(activeSurveyForAnalytics.snapshot?.departmentScores || []).map((ds, idx) => (
                          <tr key={ds.department_id || idx} className="border-b hover:bg-muted/20">
                            <td className="p-3 font-bold text-foreground">{ds.department_name}</td>
                            <td className="p-3 font-mono font-semibold">{ds.response_count}</td>
                            <td className="p-3">
                              {ds.suppressed ? (
                                <Badge className="bg-amber-100 text-amber-800 border-amber-300 gap-1 text-[11px]">
                                  <Lock className="h-3 w-3" />
                                  محجوب لحماية السرية (&lt; 5)
                                </Badge>
                              ) : (
                                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 gap-1 text-[11px]">
                                  <CheckCircle2 className="h-3 w-3" />
                                  مستوفي لحد السرية
                                </Badge>
                              )}
                            </td>
                            <td className="p-3 font-mono text-sm font-bold">
                              {ds.suppressed ? (
                                <span className="text-muted-foreground text-xs italic">
                                  [تم الحجب للخصوصية]
                                </span>
                              ) : (
                                <span className="text-primary">{ds.score ?? 0}%</span>
                              )}
                            </td>
                          </tr>
                        ))}
                        {(activeSurveyForAnalytics.snapshot?.departmentScores || []).length === 0 && (
                          <tr>
                            <td colSpan={4} className="p-8 text-center text-muted-foreground">
                              لم يتم تسجيل استجابات كافية بعد لإظهار التحليل الإداري.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="p-12 text-center text-muted-foreground text-sm">
              يرجى اختيار استبيان لعرض تحليلاته.
            </div>
          )}
        </TabsContent>

        {/* ==================================================================== */}
        {/* TAB 4: eNPS BREAKDOWN                                                 */}
        {/* ==================================================================== */}
        <TabsContent value="enps" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span>تحليل مؤشر ولاء الموظفين المؤسسي (Employee Net Promoter Score - eNPS)</span>
                <span className="font-mono text-xl font-black text-primary">
                  {kpis?.latestEnps != null && kpis.latestEnps > 0 ? `+${kpis.latestEnps}` : kpis?.latestEnps ?? 0}
                </span>
              </CardTitle>
              <CardDescription className="text-xs">
                يقيس مؤشر eNPS مدى احتمالية ترشيح الموظفين لبيئة العمل وفق المعادلة القياسية: % المروجون - % المنتقدون.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Formula & Tiers */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border bg-emerald-50/50 border-emerald-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-emerald-900">المروجون (Promoters)</span>
                    <Badge className="bg-emerald-600 text-white text-xs">درجة 9 - 10</Badge>
                  </div>
                  <div className="text-2xl font-black text-emerald-700 font-mono">
                    {activeSurveyForAnalytics?.snapshot?.promotersCount ?? 0}
                  </div>
                  <p className="text-[11px] text-emerald-800">
                    موظفون فخورون ومتحمسون يسهمون في جذب الكفاءات ورفع الإنتاجية.
                  </p>
                </div>

                <div className="p-4 rounded-xl border bg-amber-50/50 border-amber-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-amber-900">المحايدون (Passives)</span>
                    <Badge className="bg-amber-600 text-white text-xs">درجة 7 - 8</Badge>
                  </div>
                  <div className="text-2xl font-black text-amber-700 font-mono">
                    {activeSurveyForAnalytics?.snapshot?.passivesCount ?? 0}
                  </div>
                  <p className="text-[11px] text-amber-800">
                    موظفون راضون بشكل عام ولكنهم عرضة لعروض العمل الخارجية ومبادرات الاستقطاب.
                  </p>
                </div>

                <div className="p-4 rounded-xl border bg-rose-50/50 border-rose-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-rose-900">المنتقدون (Detractors)</span>
                    <Badge className="bg-rose-600 text-white text-xs">درجة 0 - 6</Badge>
                  </div>
                  <div className="text-2xl font-black text-rose-700 font-mono">
                    {activeSurveyForAnalytics?.snapshot?.detractorsCount ?? 0}
                  </div>
                  <p className="text-[11px] text-rose-800">
                    موظفون يعانون من تحديات في بيئة العمل؛ يتطلب وضع خطط عمل وتدخلات فورية لمعالجتها.
                  </p>
                </div>
              </div>

              {/* Scale interpretation */}
              <div className="p-4 rounded-xl bg-muted/40 border text-xs space-y-2">
                <span className="font-bold text-foreground">دليل تقييم مؤشر eNPS المعياري عالمياً:</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-medium">
                  <span className="text-rose-600">&lt; 0: يحتاج تحسين عاجل</span>
                  <span className="text-amber-600">0 إلى +20: مستوى مقبول</span>
                  <span className="text-blue-600">+21 إلى +40: مستوى ممتاز</span>
                  <span className="text-emerald-600">+41 إلى +100: مستوى استثنائي عالمي</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================================================================== */}
        {/* TAB 5: ACTION PLANS                                                  */}
        {/* ==================================================================== */}
        <TabsContent value="action_plans" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-base font-bold text-foreground">خطط عمل تحسين الارتباط</h3>
              <p className="text-xs text-muted-foreground">
                المبادرات المنبثقة من نتائج الاستبيانات والمكلفة للمدراء التنفيذيين.
              </p>
            </div>
            <Button
              onClick={() => setIsCreateActionPlanOpen(true)}
              className="gap-2 text-xs"
            >
              <Plus className="h-4 w-4" />
              <span>إنشاء خطة جديدة</span>
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {actionPlans.map((plan) => {
              const statusBadge = formatActionPlanStatus(plan.status);
              return (
                <Card key={plan.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-foreground">{plan.titleAr}</span>
                        <Badge className={`${statusBadge.color} text-[10px]`}>
                          {statusBadge.labelAr}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>المحور: {plan.dimension}</span>
                        {plan.ownerNameAr && <span>• المسؤول: {plan.ownerNameAr}</span>}
                        {plan.targetDate && <span>• الإنجاز: {plan.targetDate}</span>}
                      </div>
                    </div>
                  </div>

                  {plan.description && (
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {plan.description}
                    </p>
                  )}

                  {/* Checklist Items */}
                  {plan.items && plan.items.length > 0 && (
                    <div className="p-3 bg-muted/30 rounded-lg border space-y-2">
                      <span className="text-[11px] font-bold text-foreground">المهام التنفيذية:</span>
                      <div className="space-y-1.5">
                        {plan.items.map((item) => (
                          <div key={item.id} className="flex items-center justify-between text-xs">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={item.status === "completed"}
                                onChange={async (e) => {
                                  try {
                                    await toggleActionItemStatus(
                                      item.id,
                                      e.target.checked ? "completed" : "pending"
                                    );
                                    refreshAll();
                                  } catch (err: any) {
                                    toast.error(err.message);
                                  }
                                }}
                                className="h-3.5 w-3.5 rounded"
                              />
                              <span
                                className={
                                  item.status === "completed"
                                    ? "line-through text-muted-foreground"
                                    : "text-foreground font-medium"
                                }
                              >
                                {item.titleAr}
                              </span>
                            </label>
                            {item.dueDate && (
                              <span className="text-[10px] text-muted-foreground font-mono">
                                {item.dueDate}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Status update actions */}
                  <div className="flex items-center justify-end gap-2 pt-2 border-t">
                    {plan.status !== "completed" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          try {
                            await updateEngagementActionPlan(plan.id, { status: "completed" });
                            toast.success("تم تحديث حالة الخطة إلى مكتملة");
                            refreshAll();
                          } catch (err: any) {
                            toast.error(err.message);
                          }
                        }}
                        className="h-7 text-xs text-emerald-700 hover:bg-emerald-50"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>تأكيد الإنجاز</span>
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
            {actionPlans.length === 0 && (
              <div className="col-span-2 py-12 text-center text-muted-foreground text-xs">
                لا توجد خطط عمل حالياً. يمكنك إنشاء أول خطة لمعالجة مخرجات الاستبيانات.
              </div>
            )}
          </div>
        </TabsContent>

        {/* ==================================================================== */}
        {/* TAB 6: RECOGNITION WALL & BADGES                                      */}
        {/* ==================================================================== */}
        <TabsContent value="recognition" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-base font-bold text-foreground">حائط الشكر والتقدير المؤسسي</h3>
              <p className="text-xs text-muted-foreground">
                مساحة تفاعلية لتعزيز مشاعر الامتنان والتكريم بين الزملاء وفرق العمل.
              </p>
            </div>
            <Button
              onClick={() => setIsSendRecognitionOpen(true)}
              className="gap-2 bg-amber-600 hover:bg-amber-700 text-white text-xs"
            >
              <Heart className="h-4 w-4 fill-white" />
              <span>إرسال بطاقة شكر</span>
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recognitions.map((recog) => (
              <Card key={recog.id} className="p-4 space-y-3 hover:border-amber-300 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-sm text-foreground">
                      <span>{recog.senderNameAr || "زميل"}</span>
                      <span className="text-muted-foreground font-normal">←</span>
                      <span className="text-primary">{recog.recipientNameAr || "زميل"}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {recog.recipientJobTitleAr || "فريق العمل"}
                    </div>
                  </div>
                  <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] gap-1">
                    <Sparkles className="h-3 w-3" />
                    {recog.badgeNameAr || recog.categoryNameAr || "شكر وتقدير"}
                  </Badge>
                </div>

                <div className="p-3 bg-amber-50/40 rounded-xl border border-amber-100 text-xs text-foreground leading-relaxed italic">
                  "{recog.message}"
                </div>

                <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                  <span>{new Date(recog.createdAt).toLocaleDateString("ar-SA")}</span>
                  <span className="text-amber-600 font-bold flex items-center gap-1">
                    <Heart className="h-3 w-3 fill-amber-500" />
                    تقدير معلن
                  </span>
                </div>
              </Card>
            ))}
            {recognitions.length === 0 && (
              <div className="col-span-3 py-12 text-center text-muted-foreground text-xs">
                لا توجد بطاقات تقدير حتى الآن. انقر على "إرسال بطاقة شكر" للبدء.
              </div>
            )}
          </div>
        </TabsContent>

        {/* ==================================================================== */}
        {/* TAB 7: AWARD CAMPAIGNS & NOMINATIONS                                 */}
        {/* ==================================================================== */}
        <TabsContent value="campaigns" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-base font-bold text-foreground">حملات وجوائز التميز المؤسسي</h3>
              <p className="text-xs text-muted-foreground">
                برامج موظف الشهر، جوائز الابتكار، وسفراء قيم المنشأة.
              </p>
            </div>
            <Button
              onClick={() => setIsNominateModalOpen(true)}
              className="gap-2 text-xs"
            >
              <Award className="h-4 w-4" />
              <span>ترشيح زميل لجائزة</span>
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {campaigns.map((camp) => (
              <Card key={camp.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-foreground">{camp.titleAr}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {formatCampaignType(camp.campaignType).labelAr}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      الفترة: {camp.startDate} إلى {camp.endDate}
                    </div>
                  </div>
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]">
                    {camp.status === "active" ? "الترشيح متاح" : camp.status}
                  </Badge>
                </div>

                {camp.descriptionAr && (
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {camp.descriptionAr}
                  </p>
                )}

                <div className="flex items-center justify-between text-xs pt-2 border-t">
                  <span className="font-semibold text-muted-foreground">
                    الترشيحات المقدمة: {camp.nominationsCount ?? 0}
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setIsNominateModalOpen(true)}
                    className="h-7 text-xs gap-1"
                  >
                    <Plus className="h-3 w-3" />
                    <span>تقديم ترشيح</span>
                  </Button>
                </div>
              </Card>
            ))}
            {campaigns.length === 0 && (
              <div className="col-span-2 py-12 text-center text-muted-foreground text-xs">
                لا توجد حملات تكريم نشطة حالياً.
              </div>
            )}
          </div>
        </TabsContent>

        {/* ==================================================================== */}
        {/* TAB 8: QUESTION BANK & DIMENSIONS                                    */}
        {/* ==================================================================== */}
        <TabsContent value="questions" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-base font-bold text-foreground">بنك الأسئلة والمحاور الاستراتيجية</h3>
              <p className="text-xs text-muted-foreground">
                قاعدة الأسئلة المعيارية المصنفة حسب محاور تجربة الموظف.
              </p>
            </div>
            <Button
              onClick={() => setIsCreateQuestionOpen(true)}
              className="gap-2 text-xs"
            >
              <Plus className="h-4 w-4" />
              <span>إضافة سؤال لبنك الأسئلة</span>
            </Button>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-muted-foreground">تصفية حسب المحور:</span>
                <select
                  value={questionCategoryFilter}
                  onChange={(e) => setQuestionCategoryFilter(e.target.value)}
                  className="h-8 px-2.5 rounded-md border text-xs bg-background"
                >
                  <option value="all">جميع المحاور</option>
                  <option value="leadership">القيادة العليا والرؤية</option>
                  <option value="manager">العلاقة مع المدير المباشر</option>
                  <option value="communication">التواصل الداخلي والشفافية</option>
                  <option value="culture">الثقافة وبيئة العمل</option>
                  <option value="recognition">التقدير والمكافآت</option>
                  <option value="growth">التطور والفرص المهنية</option>
                  <option value="wellbeing">الصحة وجودة الحياة</option>
                  <option value="trust">الثقة والأمان النفسي</option>
                </select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right">
                  <thead>
                    <tr className="border-b bg-muted/30 text-muted-foreground">
                      <th className="p-3 font-semibold">الرمز</th>
                      <th className="p-3 font-semibold">المحور</th>
                      <th className="p-3 font-semibold">نص السؤال</th>
                      <th className="p-3 font-semibold">نوع السؤال</th>
                      <th className="p-3 font-semibold">إلزامي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {questions.map((q) => (
                      <tr key={q.id} className="border-b hover:bg-muted/20">
                        <td className="p-3 font-mono font-bold text-foreground">{q.code}</td>
                        <td className="p-3">
                          <Badge variant="outline" className="text-[10px]">
                            {formatDimensionName(q.category).labelAr}
                          </Badge>
                        </td>
                        <td className="p-3 font-medium text-foreground max-w-md">{q.textAr}</td>
                        <td className="p-3 text-muted-foreground">{q.questionType}</td>
                        <td className="p-3">
                          {q.isRequired ? (
                            <span className="text-emerald-600 font-bold">نعم</span>
                          ) : (
                            <span className="text-muted-foreground">اختياري</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ==================================================================== */}
      {/* MODALS HOOKUP                                                        */}
      {/* ==================================================================== */}
      {isCreateSurveyOpen && (
        <CreateSurveyModal
          isOpen={isCreateSurveyOpen}
          onClose={() => setIsCreateSurveyOpen(false)}
          onSuccess={refreshAll}
          companyId={companyId}
        />
      )}

      {isTakeSurveyOpen && activeSurveyForAnalytics && (
        <TakeSurveyModal
          isOpen={isTakeSurveyOpen}
          onClose={() => setIsTakeSurveyOpen(false)}
          onSuccess={refreshAll}
          companyId={companyId}
          surveyId={activeSurveyForAnalytics.id}
          participantTokenOrEmpId={currentEmployeeId}
          isAnonymous={activeSurveyForAnalytics.anonymityMode === "anonymous"}
        />
      )}

      {isSendRecognitionOpen && (
        <SendRecognitionModal
          isOpen={isSendRecognitionOpen}
          onClose={() => setIsSendRecognitionOpen(false)}
          onSuccess={refreshAll}
          companyId={companyId}
          senderId={currentEmployeeId}
          employees={employees}
        />
      )}

      {isCreateActionPlanOpen && (
        <CreateActionPlanModal
          isOpen={isCreateActionPlanOpen}
          onClose={() => setIsCreateActionPlanOpen(false)}
          onSuccess={refreshAll}
          companyId={companyId}
          surveys={surveys}
          departments={departments}
          employees={employees}
        />
      )}

      {isNominateModalOpen && (
        <NominateCampaignModal
          isOpen={isNominateModalOpen}
          onClose={() => setIsNominateModalOpen(false)}
          onSuccess={refreshAll}
          companyId={companyId}
          nominatorId={currentEmployeeId}
          campaigns={campaigns}
          employees={employees}
        />
      )}

      {isCreateQuestionOpen && (
        <CreateQuestionModal
          isOpen={isCreateQuestionOpen}
          onClose={() => setIsCreateQuestionOpen(false)}
          onSuccess={refreshAll}
          companyId={companyId}
        />
      )}
    </div>
  );
};
