// ============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PROMPT 29: PRODUCTION LEARNING, SKILLS, CERTIFICATIONS & TRAINING HUB
// src/components/learning/LearningView.tsx
// ============================================================================

import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  GraduationCap,
  BookOpen,
  Calendar,
  Users,
  Award,
  ShieldCheck,
  AlertTriangle,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Layers,
  MapPin,
  ExternalLink,
  DollarSign,
  TrendingUp,
  RotateCcw,
  UserCheck,
  XCircle,
  FileText,
  Filter,
  Check,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "../ui/card";
import { learningQueryKeys } from "../../lib/query/learning-query-keys";
import {
  fetchLearningKpis,
  fetchSkills,
  fetchSkillCategories,
  fetchLearningItems,
  fetchLearningPrograms,
  fetchTrainingSessions,
  fetchTrainingEnrollments,
  fetchCertificationsCatalog,
  fetchEmployeeCertifications,
  fetchTrainingProviders,
  fetchMandatoryRules,
  fetchEmployeeSkills,
  recordAttendanceAndCompletion,
  triggerMandatoryAssignment,
  triggerCertificationExpiryCheck,
} from "../../lib/data/learning-repository";
import type {
  TrainingSession,
  EmployeeCertification,
  LearningItem,
  Skill,
  TrainingEnrollment,
} from "../../lib/domains/learning";
import {
  evaluateSessionCapacity,
  evaluateCertificationExpiry,
  formatProficiencyLevel,
  calculateSkillGap,
} from "../../lib/domains/learning";
import { CreateCourseModal } from "./CreateCourseModal";
import { CreateSessionModal } from "./CreateSessionModal";
import { EnrollmentModal } from "./EnrollmentModal";
import { CreateSkillModal } from "./CreateSkillModal";
import { EmployeeCertificationModal } from "./EmployeeCertificationModal";
import { VerifyCertificateModal } from "./VerifyCertificateModal";
import { supabase } from "../../integrations/supabase/client";

interface LearningViewProps {
  companyId?: string;
}

export const LearningView: React.FC<LearningViewProps> = ({ companyId: propCompanyId }) => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Modals state
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [isSkillModalOpen, setIsSkillModalOpen] = useState(false);
  const [isCertModalOpen, setIsCertModalOpen] = useState(false);
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);

  const [selectedSession, setSelectedSession] = useState<TrainingSession | null>(null);
  const [selectedCert, setSelectedCert] = useState<EmployeeCertification | null>(null);

  // Tenant & User resolution
  const [companyId, setCompanyId] = useState<string>(propCompanyId || "");
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [employees, setEmployees] = useState<Array<{ id: string; name: string; employeeNo?: string; departmentName?: string; jobTitle?: string }>>([]);

  useEffect(() => {
    async function resolveContext() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }

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
        // Load employees
        const { data: emps } = await (supabase as any)
          .from("employees")
          .select("id, first_name_ar, last_name_ar, employee_no, departments(name_ar)")
          .eq("company_id", cId)
          .eq("status", "active")
          .order("first_name_ar");

        if (emps) {
          setEmployees(
            emps.map((e: any) => ({
              id: e.id,
              name: `${e.first_name_ar || ""} ${e.last_name_ar || ""}`.trim(),
              employeeNo: e.employee_no,
              departmentName: e.departments?.name_ar,
            }))
          );
        }
      }
    }
    resolveContext();
  }, [propCompanyId]);

  // Queries
  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: learningQueryKeys.kpis(companyId),
    queryFn: () => fetchLearningKpis(companyId),
    enabled: Boolean(companyId),
  });

  const { data: courses = [], isLoading: coursesLoading } = useQuery({
    queryKey: learningQueryKeys.courses.list(companyId),
    queryFn: () => fetchLearningItems(companyId),
    enabled: Boolean(companyId),
  });

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: learningQueryKeys.sessions.list(companyId),
    queryFn: () => fetchTrainingSessions(companyId),
    enabled: Boolean(companyId),
  });

  const { data: enrollments = [], isLoading: enrollmentsLoading } = useQuery({
    queryKey: learningQueryKeys.enrollments.list(companyId),
    queryFn: () => fetchTrainingEnrollments(companyId),
    enabled: Boolean(companyId),
  });

  const { data: skills = [], isLoading: skillsLoading } = useQuery({
    queryKey: learningQueryKeys.skills.list(companyId),
    queryFn: () => fetchSkills(companyId),
    enabled: Boolean(companyId),
  });

  const { data: employeeSkills = [] } = useQuery({
    queryKey: learningQueryKeys.skills.employeeSkills(companyId),
    queryFn: () => fetchEmployeeSkills(companyId),
    enabled: Boolean(companyId),
  });

  const { data: certCatalog = [] } = useQuery({
    queryKey: learningQueryKeys.certifications.catalog(companyId),
    queryFn: () => fetchCertificationsCatalog(companyId),
    enabled: Boolean(companyId),
  });

  const { data: employeeCerts = [], isLoading: certsLoading } = useQuery({
    queryKey: learningQueryKeys.certifications.employeeList(companyId),
    queryFn: () => fetchEmployeeCertifications(companyId),
    enabled: Boolean(companyId),
  });

  const { data: providers = [] } = useQuery({
    queryKey: learningQueryKeys.providers(companyId),
    queryFn: () => fetchTrainingProviders(companyId),
    enabled: Boolean(companyId),
  });

  const { data: mandatoryRules = [] } = useQuery({
    queryKey: learningQueryKeys.mandatoryRules(companyId),
    queryFn: () => fetchMandatoryRules(companyId),
    enabled: Boolean(companyId),
  });

  // Attendance update mutation
  const updateAttendanceMutation = useMutation({
    mutationFn: (vars: { enrollmentId: string; attendanceStatus: string; completionStatus: string; score?: number }) =>
      recordAttendanceAndCompletion({
        companyId,
        enrollmentId: vars.enrollmentId,
        attendanceStatus: vars.attendanceStatus,
        completionStatus: vars.completionStatus,
        score: vars.score,
      }),
    onSuccess: (res) => {
      if (res.success) {
        toast.success("تم تحديث حالة الحضور والإكمال بنجاح");
        queryClient.invalidateQueries({ queryKey: learningQueryKeys.enrollments.list(companyId) });
        queryClient.invalidateQueries({ queryKey: learningQueryKeys.kpis(companyId) });
      } else {
        toast.error(res.error || "فشل تحديث السجل");
      }
    },
  });

  // Assign mandatory learning mutation
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

  // Expiry check mutation
  const checkExpiryMutation = useMutation({
    mutationFn: () => triggerCertificationExpiryCheck(companyId),
    onSuccess: (res) => {
      if (res.success) {
        toast.success(`تم فحص الشهادات المهنية وإنشاء مهام التجديد (${res.processedCount || 0} شهادة)`);
        queryClient.invalidateQueries({ queryKey: learningQueryKeys.certifications.employeeList(companyId) });
        queryClient.invalidateQueries({ queryKey: learningQueryKeys.kpis(companyId) });
      }
    },
  });

  // Filtered Courses
  const filteredCourses = useMemo(() => {
    return courses.filter((c) => {
      const matchSearch =
        c.titleAr.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.titleEn.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.code.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCat = categoryFilter === "all" || c.category === categoryFilter;
      return matchSearch && matchCat;
    });
  }, [courses, searchTerm, categoryFilter]);

  return (
    <div className="space-y-6 p-4 sm:p-6 pb-16 max-w-7xl mx-auto" dir="rtl">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-xs">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-foreground tracking-tight">
                منظومة التعليم، المهارات والشهادات الاحترافية
              </h1>
              <p className="text-xs font-semibold text-muted-foreground mt-0.5">
                إدارة الخطط التعليمية، فجوات الكفاءة، الجلسات التدريبية وتراخيص الامتثال المهني
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => checkExpiryMutation.mutate()}
            disabled={checkExpiryMutation.isPending}
            className="gap-2 text-xs font-bold"
          >
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            تدقيق صلاحية الشهادات
          </Button>

          <Button
            size="sm"
            onClick={() => setIsCourseModalOpen(true)}
            className="gap-2 text-xs font-bold bg-primary text-primary-foreground shadow-xs"
          >
            <Plus className="h-4 w-4" />
            إضافة دورة تدريبية
          </Button>
        </div>
      </div>

      {/* Main Tabs Hub */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-8 gap-1 p-1 bg-secondary/50 rounded-xl">
          <TabsTrigger value="overview" className="text-xs font-bold gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" />
            نظرة عامة
          </TabsTrigger>
          <TabsTrigger value="courses" className="text-xs font-bold gap-1.5">
            <BookOpen className="h-3.5 w-3.5" />
            دليل الدورات
          </TabsTrigger>
          <TabsTrigger value="sessions" className="text-xs font-bold gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            الجلسات التدريبية
          </TabsTrigger>
          <TabsTrigger value="enrollments" className="text-xs font-bold gap-1.5">
            <Users className="h-3.5 w-3.5" />
            التسجيل والحضور
          </TabsTrigger>
          <TabsTrigger value="skills" className="text-xs font-bold gap-1.5">
            <Award className="h-3.5 w-3.5" />
            دليل المهارات
          </TabsTrigger>
          <TabsTrigger value="gaps" className="text-xs font-bold gap-1.5">
            <Layers className="h-3.5 w-3.5" />
            مصفوفة الفجوات
          </TabsTrigger>
          <TabsTrigger value="certifications" className="text-xs font-bold gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" />
            الشهادات المهنية
          </TabsTrigger>
          <TabsTrigger value="mandatory" className="text-xs font-bold gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" />
            التدريب الإلزامي
          </TabsTrigger>
        </TabsList>

        {/* 1. OVERVIEW TAB */}
        <TabsContent value="overview" className="space-y-6 focus:outline-none">
          {/* Governed KPIs Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
            <div className="classera-kpi-card p-4 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-muted-foreground">الدورات النشطة</span>
                <h4 className="text-xl font-black text-foreground mt-0.5 font-mono">
                  {kpis?.activeCourses ?? 0}
                </h4>
                <span className="text-[10px] text-primary font-bold">برنامج متاح</span>
              </div>
              <div className="h-10 w-10 rounded-2xl bg-secondary flex items-center justify-center text-primary">
                <BookOpen className="h-5 w-5" />
              </div>
            </div>

            <div className="classera-kpi-card p-4 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-muted-foreground">الجلسات القادمة</span>
                <h4 className="text-xl font-black text-foreground mt-0.5 font-mono">
                  {kpis?.upcomingSessions ?? 0}
                </h4>
                <span className="text-[10px] text-purple-600 font-bold">جلسة مجدولة</span>
              </div>
              <div className="h-10 w-10 rounded-2xl bg-secondary flex items-center justify-center text-purple-600">
                <Calendar className="h-5 w-5" />
              </div>
            </div>

            <div className="classera-kpi-card p-4 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-muted-foreground">إجمالي التسجيلات</span>
                <h4 className="text-xl font-black text-foreground mt-0.5 font-mono">
                  {kpis?.totalEnrollments ?? 0}
                </h4>
                <span className="text-[10px] text-blue-600 font-bold">
                  مكتمل: {kpis?.completedEnrollments ?? 0}
                </span>
              </div>
              <div className="h-10 w-10 rounded-2xl bg-secondary flex items-center justify-center text-blue-600">
                <Users className="h-5 w-5" />
              </div>
            </div>

            <div className="classera-kpi-card p-4 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-muted-foreground">معدل الإكمال</span>
                <h4 className="text-xl font-black text-emerald-600 mt-0.5 font-mono">
                  {kpis?.completionRate ?? 0}%
                </h4>
                <span className="text-[10px] text-emerald-700 font-bold">إنجاز برامج</span>
              </div>
              <div className="h-10 w-10 rounded-2xl bg-secondary flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            </div>

            <div className="classera-kpi-card p-4 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-muted-foreground">شهادات قاربت الانتهاء</span>
                <h4 className="text-xl font-black text-amber-600 mt-0.5 font-mono">
                  {kpis?.expiringCertifications ?? 0}
                </h4>
                <span className="text-[10px] text-amber-700 font-bold">تتطلب التجديد</span>
              </div>
              <div className="h-10 w-10 rounded-2xl bg-secondary flex items-center justify-center text-amber-600">
                <ShieldCheck className="h-5 w-5" />
              </div>
            </div>

            <div className="classera-kpi-card p-4 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-muted-foreground">الاستثمار في التدريب</span>
                <h4 className="text-lg font-black text-foreground mt-0.5 font-mono">
                  {Number(kpis?.totalTrainingCost ?? 0).toLocaleString()} <span className="text-xs">ر.س</span>
                </h4>
                <span className="text-[10px] text-muted-foreground font-bold">التكلفة الإجمالية</span>
              </div>
              <div className="h-10 w-10 rounded-2xl bg-secondary flex items-center justify-center text-foreground">
                <DollarSign className="h-5 w-5" />
              </div>
            </div>
          </div>

          {/* Quick Actions & Recent Sessions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="shadow-xs">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold flex items-center justify-between">
                  <span>الجلسات التدريبية المجدولة القادمة</span>
                  <Badge variant="outline" className="font-mono text-xs">
                    {sessions.length} جلسة
                  </Badge>
                </CardTitle>
                <CardDescription>
                  الجلسات المفتوحة للتسجيل مع توفر المقاعد والروابط
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {sessions.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    لا توجد جلسات تدريبية قادمة مجدولة حالياً
                  </div>
                ) : (
                  sessions.slice(0, 4).map((sess) => {
                    const cap = evaluateSessionCapacity(sess.capacity, sess.enrolledCount);
                    return (
                      <div
                        key={sess.id}
                        className="p-3 rounded-xl border bg-card flex items-center justify-between gap-4"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold font-mono px-1.5 py-0.5 bg-secondary rounded text-primary">
                              {sess.sessionCode}
                            </span>
                            <h5 className="text-sm font-bold text-foreground">
                              {sess.courseTitleAr || "دورة تدريبية"}
                            </h5>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              {new Date(sess.startDate).toLocaleDateString("ar-SA")}
                            </span>
                            {sess.trainerName && (
                              <span className="flex items-center gap-1">
                                <UserCheck className="h-3.5 w-3.5" />
                                {sess.trainerName}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-left">
                            <span className="text-[11px] font-bold text-muted-foreground block">
                              {cap.isFull ? "مكتمل" : `متاح: ${cap.seatsRemaining}`}
                            </span>
                            <span className="text-xs font-mono font-bold text-foreground">
                              {sess.enrolledCount}/{sess.capacity}
                            </span>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedSession(sess);
                              setIsEnrollModalOpen(true);
                            }}
                            className="text-xs font-bold"
                          >
                            تسجيل
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            <Card className="shadow-xs">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold flex items-center justify-between">
                  <span>تنبيهات الامتثال وتجديد الشهادات المهنية</span>
                  <Badge variant="outline" className="font-mono text-xs text-amber-600">
                    {employeeCerts.filter((c) => c.status === "expiring" || c.status === "expired").length} تنبيه
                  </Badge>
                </CardTitle>
                <CardDescription>
                  الشهادات والتراخيص المهنية التي قاربت على الانتهاء وتتطلب التجديد
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {employeeCerts.filter((c) => c.status === "expiring" || c.status === "expired").length === 0 ? (
                  <div className="text-center py-8 text-sm text-emerald-600 font-bold flex flex-col items-center gap-2">
                    <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                    جميع الشهادات المهنية سارية وممتثلة بالكامل
                  </div>
                ) : (
                  employeeCerts
                    .filter((c) => c.status === "expiring" || c.status === "expired")
                    .slice(0, 4)
                    .map((cert) => (
                      <div
                        key={cert.id}
                        className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 flex items-center justify-between gap-4"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-foreground">
                              {cert.certificationNameAr}
                            </span>
                            <Badge
                              variant={cert.status === "expired" ? "destructive" : "secondary"}
                              className="text-[10px]"
                            >
                              {cert.status === "expired" ? "منتهية" : "قاربت على الانتهاء"}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-3">
                            <span>الموظف: {cert.employeeName}</span>
                            <span className="font-mono">الانتهاء: {cert.expiryDate}</span>
                          </div>
                        </div>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedCert(cert);
                            setIsVerifyModalOpen(true);
                          }}
                          className="text-xs font-bold"
                        >
                          تدقيق
                        </Button>
                      </div>
                    ))
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 2. COURSES TAB */}
        <TabsContent value="courses" className="space-y-4 focus:outline-none">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="البحث باسم الدورة أو الرمز..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-9 text-xs"
                />
              </div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="rounded-md border border-input bg-background px-3 py-2 text-xs shadow-xs"
              >
                <option value="all">جميع التصنيفات</option>
                <option value="functional">تخصصي / وظيفي</option>
                <option value="technical">تقني</option>
                <option value="leadership">قيادي</option>
                <option value="compliance">امتثال</option>
                <option value="safety">سلامة</option>
              </select>
            </div>

            <Button
              size="sm"
              onClick={() => setIsCourseModalOpen(true)}
              className="gap-2 text-xs font-bold"
            >
              <Plus className="h-4 w-4" />
              إضافة برنامج تدريبي
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCourses.length === 0 ? (
              <div className="col-span-full text-center py-12 text-muted-foreground text-sm">
                لا توجد دورات تدريبية مطابقة لمعايير البحث
              </div>
            ) : (
              filteredCourses.map((course) => (
                <Card key={course.id} className="shadow-xs hover:border-primary/40 transition-colors">
                  <CardHeader className="pb-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[11px] font-bold font-mono px-2 py-0.5 rounded bg-primary/10 text-primary">
                        {course.code}
                      </span>
                      {course.isMandatory && (
                        <Badge variant="destructive" className="text-[10px]">
                          إلزامي
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="text-base font-bold mt-1.5 leading-snug">
                      {course.titleAr}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {course.titleEn}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 text-xs">
                    <div className="grid grid-cols-2 gap-2 text-muted-foreground pt-1 border-t">
                      <div>
                        <span className="block text-[10px] font-bold">المدة:</span>
                        <span className="font-bold text-foreground">{course.durationHours} ساعة</span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold">طريقة التقديم:</span>
                        <span className="font-bold text-foreground">
                          {course.deliveryMethod === "virtual" ? "عن بعد" : "حضوري"}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold">المزود:</span>
                        <span className="font-bold text-foreground">
                          {course.providerNameAr || "تدريب داخلي"}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold">التكلفة التقديرية:</span>
                        <span className="font-mono font-bold text-foreground">
                          {course.estimatedCost > 0 ? `${course.estimatedCost} ر.س` : "مجاني"}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 flex items-center justify-between">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setIsSessionModalOpen(true);
                        }}
                        className="w-full text-xs font-bold gap-1.5"
                      >
                        <Calendar className="h-3.5 w-3.5" />
                        جدولة جلسة
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* 3. SESSIONS TAB */}
        <TabsContent value="sessions" className="space-y-4 focus:outline-none">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold">جدول الجلسات التدريبية المفتوحة والقادمة</h3>
            <Button
              size="sm"
              onClick={() => setIsSessionModalOpen(true)}
              className="gap-2 text-xs font-bold"
            >
              <Plus className="h-4 w-4" />
              جدولة جلسة جديدة
            </Button>
          </div>

          <div className="rounded-xl border bg-card overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-secondary/40 border-b">
                <tr>
                  <th className="p-3 text-right font-bold">رمز الجلسة</th>
                  <th className="p-3 text-right font-bold">الدورة التدريبية</th>
                  <th className="p-3 text-right font-bold">المواعيد</th>
                  <th className="p-3 text-right font-bold">المدرب / القاعة</th>
                  <th className="p-3 text-center font-bold">المقاعد والسعة</th>
                  <th className="p-3 text-center font-bold">الحالة</th>
                  <th className="p-3 text-center font-bold">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sessions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      لا توجد جلسات تدريبية حالياً
                    </td>
                  </tr>
                ) : (
                  sessions.map((sess) => {
                    const cap = evaluateSessionCapacity(sess.capacity, sess.enrolledCount);
                    return (
                      <tr key={sess.id} className="hover:bg-secondary/20">
                        <td className="p-3 font-mono font-bold text-primary">
                          {sess.sessionCode}
                        </td>
                        <td className="p-3 font-bold text-foreground">
                          {sess.courseTitleAr}
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {new Date(sess.startDate).toLocaleDateString("ar-SA")}
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {sess.trainerName || "—"} {sess.location ? `(${sess.location})` : ""}
                        </td>
                        <td className="p-3 text-center font-mono">
                          <span className={`font-bold ${cap.isFull ? "text-rose-600" : "text-emerald-600"}`}>
                            {sess.enrolledCount}
                          </span>
                          <span className="text-muted-foreground"> / {sess.capacity}</span>
                        </td>
                        <td className="p-3 text-center">
                          <Badge variant={cap.isFull ? "secondary" : "outline"}>
                            {cap.isFull ? "مكتمل" : "مفتوح"}
                          </Badge>
                        </td>
                        <td className="p-3 text-center">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedSession(sess);
                              setIsEnrollModalOpen(true);
                            }}
                            className="text-xs font-bold text-primary"
                          >
                            تسجيل موظف
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* 4. ENROLLMENTS & ATTENDANCE TAB */}
        <TabsContent value="enrollments" className="space-y-4 focus:outline-none">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold">سجل التسجيل، الحضور وإكمال التدريب</h3>
          </div>

          <div className="rounded-xl border bg-card overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-secondary/40 border-b">
                <tr>
                  <th className="p-3 text-right font-bold">الموظف</th>
                  <th className="p-3 text-right font-bold">الجلسة والدورة</th>
                  <th className="p-3 text-right font-bold">المصدر</th>
                  <th className="p-3 text-center font-bold">حالة الحضور</th>
                  <th className="p-3 text-center font-bold">النتيجة والإكمال</th>
                  <th className="p-3 text-center font-bold">تحديث الحضور</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {enrollments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      لا توجد تسجيلات حتى الآن
                    </td>
                  </tr>
                ) : (
                  enrollments.map((enr) => (
                    <tr key={enr.id} className="hover:bg-secondary/20">
                      <td className="p-3">
                        <div className="font-bold text-foreground">{enr.employeeName}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">{enr.employeeNo}</div>
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-foreground">{enr.courseTitleAr}</div>
                        <div className="text-[10px] font-mono text-muted-foreground">{enr.sessionCode}</div>
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {enr.enrollmentSource}
                      </td>
                      <td className="p-3 text-center">
                        <Badge
                          variant={enr.attendanceStatus === "present" ? "default" : "outline"}
                          className="text-[10px]"
                        >
                          {enr.attendanceStatus || "قيد الانتظار"}
                        </Badge>
                      </td>
                      <td className="p-3 text-center">
                        <Badge
                          variant={enr.completionStatus === "completed" ? "default" : "secondary"}
                          className="text-[10px]"
                        >
                          {enr.completionStatus === "completed" ? "مكتمل بنجاح" : "قيد الإنجاز"}
                        </Badge>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-[10px] gap-1 text-emerald-600 hover:text-emerald-700"
                            onClick={() =>
                              updateAttendanceMutation.mutate({
                                enrollmentId: enr.id,
                                attendanceStatus: "present",
                                completionStatus: "completed",
                                score: 95,
                              })
                            }
                          >
                            <Check className="h-3 w-3" />
                            حضر واكتمل
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-[10px] gap-1 text-rose-600 hover:text-rose-700"
                            onClick={() =>
                              updateAttendanceMutation.mutate({
                                enrollmentId: enr.id,
                                attendanceStatus: "absent",
                                completionStatus: "failed",
                              })
                            }
                          >
                            <XCircle className="h-3 w-3" />
                            غياب
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* 5. SKILLS CATALOG TAB */}
        <TabsContent value="skills" className="space-y-4 focus:outline-none">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold">دليل المهارات التنظيمية المعتمدة</h3>
            <Button
              size="sm"
              onClick={() => setIsSkillModalOpen(true)}
              className="gap-2 text-xs font-bold"
            >
              <Plus className="h-4 w-4" />
              إضافة مهارة جديدة
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {skills.map((skill) => (
              <Card key={skill.id} className="shadow-xs">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-secondary text-primary">
                      {skill.code}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {skill.category}
                    </Badge>
                  </div>
                  <CardTitle className="text-base font-bold mt-1">
                    {skill.nameAr}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {skill.nameEn}
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  <p className="line-clamp-2">{skill.descriptionAr || "مهارة معيارية بالمنظمة"}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* 6. SKILL GAPS & MATRIX TAB */}
        <TabsContent value="gaps" className="space-y-4 focus:outline-none">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold">مصفوفة مهارات الموظفين وفجوات الكفاءة</h3>
              <p className="text-xs text-muted-foreground">
                المقارنة بين المستوى المعتمد للموظف والمستوى المطلوب للمنصب
              </p>
            </div>
          </div>

          <div className="rounded-xl border bg-card overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-secondary/40 border-b">
                <tr>
                  <th className="p-3 text-right font-bold">الموظف</th>
                  <th className="p-3 text-right font-bold">المهارة</th>
                  <th className="p-3 text-center font-bold">المستوى الذاتي</th>
                  <th className="p-3 text-center font-bold">المستوى المعتمد</th>
                  <th className="p-3 text-right font-bold">المصدر</th>
                  <th className="p-3 text-center font-bold">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {employeeSkills.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      لا توجد تقييمات مهارات مسجلة حتى الآن
                    </td>
                  </tr>
                ) : (
                  employeeSkills.map((es) => (
                    <tr key={es.id} className="hover:bg-secondary/20">
                      <td className="p-3 font-bold text-foreground">
                        {es.employeeName}
                      </td>
                      <td className="p-3">
                        <span className="font-bold text-foreground">{es.skillNameAr}</span>
                        <span className="block text-[10px] font-mono text-muted-foreground">{es.skillCode}</span>
                      </td>
                      <td className="p-3 text-center font-mono">
                        {es.selfReportedLevel ? `L${es.selfReportedLevel}` : "—"}
                      </td>
                      <td className="p-3 text-center font-mono font-bold text-primary">
                        L{es.currentProficiency}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {es.source}
                      </td>
                      <td className="p-3 text-center">
                        <Badge variant="outline" className="text-[10px]">
                          {es.status}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* 7. CERTIFICATIONS TAB */}
        <TabsContent value="certifications" className="space-y-4 focus:outline-none">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold">سجل الشهادات المهنية والرخص المهنية</h3>
              <p className="text-xs text-muted-foreground">
                التدقيق والاعتماد وتتبع صلاحية التراخيص المهنية
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => setIsCertModalOpen(true)}
              className="gap-2 text-xs font-bold"
            >
              <Plus className="h-4 w-4" />
              تسجيل شهادة لموظف
            </Button>
          </div>

          <div className="rounded-xl border bg-card overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-secondary/40 border-b">
                <tr>
                  <th className="p-3 text-right font-bold">الموظف</th>
                  <th className="p-3 text-right font-bold">الشهادة المهنية</th>
                  <th className="p-3 text-right font-bold">رقم الشهادة / الجهة</th>
                  <th className="p-3 text-right font-bold">تاريخ الانتهاء</th>
                  <th className="p-3 text-center font-bold">حالة الصلاحية</th>
                  <th className="p-3 text-center font-bold">حالة التدقيق</th>
                  <th className="p-3 text-center font-bold">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {employeeCerts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      لا توجد شهادات مهنية مسجلة
                    </td>
                  </tr>
                ) : (
                  employeeCerts.map((cert) => {
                    const exp = evaluateCertificationExpiry(cert.expiryDate);
                    return (
                      <tr key={cert.id} className="hover:bg-secondary/20">
                        <td className="p-3 font-bold text-foreground">
                          {cert.employeeName}
                        </td>
                        <td className="p-3 font-bold text-foreground">
                          {cert.certificationNameAr}
                        </td>
                        <td className="p-3">
                          <span className="font-mono font-bold block">{cert.certificateNumber}</span>
                          <span className="text-[10px] text-muted-foreground">{cert.issuer}</span>
                        </td>
                        <td className="p-3 font-mono text-muted-foreground">
                          {cert.expiryDate || "دائمة"}
                        </td>
                        <td className="p-3 text-center">
                          <Badge
                            variant={
                              exp.status === "expired"
                                ? "destructive"
                                : exp.status === "expiring"
                                ? "secondary"
                                : "outline"
                            }
                            className="text-[10px]"
                          >
                            {exp.status === "expired"
                              ? "منتهية"
                              : exp.status === "expiring"
                              ? "قاربت على الانتهاء"
                              : "سارية"}
                          </Badge>
                        </td>
                        <td className="p-3 text-center">
                          <Badge
                            variant={cert.verificationStatus === "verified" ? "default" : "outline"}
                            className="text-[10px]"
                          >
                            {cert.verificationStatus === "verified" ? "معتمدة" : "قيد التدقيق"}
                          </Badge>
                        </td>
                        <td className="p-3 text-center">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedCert(cert);
                              setIsVerifyModalOpen(true);
                            }}
                            className="text-xs font-bold text-primary"
                          >
                            تدقيق
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* 8. MANDATORY LEARNING TAB */}
        <TabsContent value="mandatory" className="space-y-4 focus:outline-none">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold">قواعد التدريب الإلزامي والامتثال</h3>
              <p className="text-xs text-muted-foreground">
                إسناد الدورات الإلزامية آلياً للفئات المستهدفة
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {mandatoryRules.map((rule) => (
              <Card key={rule.id} className="shadow-xs">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-bold">{rule.ruleNameAr}</CardTitle>
                    <Badge variant="destructive" className="text-[10px]">إلزامي</Badge>
                  </div>
                  <CardDescription className="text-xs">
                    الدورة: {rule.courseTitleAr}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                    <div>
                      <span className="block text-[10px] font-bold">الفئة المستهدفة:</span>
                      <span className="font-bold text-foreground">{rule.targetType}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold">مهلة الإكمال:</span>
                      <span className="font-bold text-foreground">{rule.daysToComplete} يوماً</span>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    onClick={() => assignMandatoryMutation.mutate(rule.id)}
                    disabled={assignMandatoryMutation.isPending}
                    className="w-full text-xs font-bold gap-2"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    تشغيل الإسناد التلقائي للمستهدفين
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <CreateCourseModal
        isOpen={isCourseModalOpen}
        onClose={() => setIsCourseModalOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: learningQueryKeys.courses.list(companyId) });
          queryClient.invalidateQueries({ queryKey: learningQueryKeys.kpis(companyId) });
        }}
        companyId={companyId}
        providers={providers}
      />

      <CreateSessionModal
        isOpen={isSessionModalOpen}
        onClose={() => setIsSessionModalOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: learningQueryKeys.sessions.list(companyId) });
          queryClient.invalidateQueries({ queryKey: learningQueryKeys.kpis(companyId) });
        }}
        companyId={companyId}
        courses={courses}
      />

      <EnrollmentModal
        isOpen={isEnrollModalOpen}
        onClose={() => {
          setIsEnrollModalOpen(false);
          setSelectedSession(null);
        }}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: learningQueryKeys.sessions.list(companyId) });
          queryClient.invalidateQueries({ queryKey: learningQueryKeys.enrollments.list(companyId) });
          queryClient.invalidateQueries({ queryKey: learningQueryKeys.kpis(companyId) });
        }}
        companyId={companyId}
        session={selectedSession}
        employees={employees}
      />

      <CreateSkillModal
        isOpen={isSkillModalOpen}
        onClose={() => setIsSkillModalOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: learningQueryKeys.skills.list(companyId) });
          queryClient.invalidateQueries({ queryKey: learningQueryKeys.kpis(companyId) });
        }}
        companyId={companyId}
      />

      <EmployeeCertificationModal
        isOpen={isCertModalOpen}
        onClose={() => setIsCertModalOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: learningQueryKeys.certifications.employeeList(companyId) });
          queryClient.invalidateQueries({ queryKey: learningQueryKeys.kpis(companyId) });
        }}
        companyId={companyId}
        certificationsCatalog={certCatalog}
        employees={employees}
      />

      <VerifyCertificateModal
        isOpen={isVerifyModalOpen}
        onClose={() => {
          setIsVerifyModalOpen(false);
          setSelectedCert(null);
        }}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: learningQueryKeys.certifications.employeeList(companyId) });
          queryClient.invalidateQueries({ queryKey: learningQueryKeys.kpis(companyId) });
        }}
        companyId={companyId}
        cert={selectedCert}
        currentUserId={currentUserId}
      />
    </div>
  );
};
