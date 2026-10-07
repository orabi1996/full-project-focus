import React, { useState, useMemo } from "react";
import { useApp } from "../../lib/context/AppContext";
import {
  Clock,
  CalendarDays,
  FileText,
  DollarSign,
  MapPin,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Shield,
  QrCode,
  Download,
  Plus,
  Printer,
  ShieldCheck,
  Eye,
  EyeOff,
  Edit3,
  Check,
  X,
  Briefcase,
  Phone,
  Mail,
  Building2,
  Sparkles,
  Users,
  UserCheck,
  Home,
  Layers,
  User,
  Filter,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import { toast } from "sonner";
import { latestEmployeePayroll, employeeLeaveBalances } from "../../lib/utils/ess-records";
import {
  PROFILE_CHANGE_FIELDS_CATALOG,
  useAuthenticatedEmployeeContext,
  useMyProfileChangeRequests,
  useManagerTeamSummary,
  useManagerTeamMembers,
  useSubmitProfileChangeRequest,
  useUpdateMyDirectProfileFields,
  useReviewProfileChangeRequest,
} from "../../lib/domains/ess";

export type EssActiveTab = "overview" | "requests" | "services" | "profile" | "team";
export type MssSubTab = "team_overview" | "team_approvals" | "team_attendance";

export const EssMobileView: React.FC<{ onNavigate: (tabId: string) => void }> = ({
  onNavigate,
}) => {
  const {
    currentUser,
    leaveBalances,
    leaveTypes,
    punchInOut,
    requests,
    payrollDetails,
    payrollRuns,
    dataMode,
    submitRequest,
    company,
    applyLeave,
    submitAttendanceCorrection,
    language,
    t,
    isSaving,
    currentRole,
  } = useApp();

  // Navigation & Mode States
  const [activeTab, setActiveTab] = useState<EssActiveTab>("overview");
  const [viewMode, setViewMode] = useState<"ess" | "mss">("ess");
  const [mssTab, setMssTab] = useState<MssSubTab>("team_overview");
  const [requestsFilter, setRequestsFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");

  // Privacy toggles
  const [showSensitiveData, setShowSensitiveData] = useState(false);

  // ESS & MSS Server Queries & Mutations
  const { data: authContext, refetch: refetchAuthContext } = useAuthenticatedEmployeeContext();
  const { data: profileChangeRequests = [], refetch: refetchPcr } = useMyProfileChangeRequests();
  const isManagerUser = Boolean(
    authContext?.is_manager ||
    (authContext?.direct_reports_count ?? 0) > 0 ||
    currentRole === "line_manager" ||
    currentRole === "hr_manager" ||
    currentRole === "super_admin"
  );

  const { data: teamSummary, refetch: refetchTeamSummary } = useManagerTeamSummary(
    undefined,
    isManagerUser
  );
  const { data: teamMembers = [], refetch: refetchTeamMembers } = useManagerTeamMembers(
    undefined,
    isManagerUser
  );

  const submitPcrMutation = useSubmitProfileChangeRequest();
  const updateDirectProfileMutation = useUpdateMyDirectProfileFields();
  const reviewPcrMutation = useReviewProfileChangeRequest();

  // Dialog States
  const [isCertificateModalOpen, setIsCertificateModalOpen] = useState(false);
  const [isPayslipModalOpen, setIsPayslipModalOpen] = useState(false);
  const [isQuickLeaveModalOpen, setIsQuickLeaveModalOpen] = useState(false);
  const [isPunchCorrectionModalOpen, setIsPunchCorrectionModalOpen] = useState(false);
  const [isProfileChangeModalOpen, setIsProfileChangeModalOpen] = useState(false);
  const [isDirectEditModalOpen, setIsDirectEditModalOpen] = useState(false);
  const [reviewingPcr, setReviewingPcr] = useState<any | null>(null);
  const [reviewNote, setReviewNote] = useState("");

  // Certificate State
  const [certificateDestination, setCertificateDestination] = useState("سفارة / جهة حكومية / بنك");

  // Quick Leave Form State
  const [leaveTypeId, setLeaveTypeId] = useState(leaveTypes[0]?.id || "");
  const [leaveStart, setLeaveStart] = useState(new Date().toISOString().slice(0, 10));
  const [leaveEnd, setLeaveEnd] = useState(new Date().toISOString().slice(0, 10));
  const [leaveDays, setLeaveDays] = useState(3);
  const [leaveReason, setLeaveReason] = useState("");

  // Punch Correction Form State
  const [corrDate, setCorrDate] = useState(new Date().toISOString().slice(0, 10));
  const [corrPunchType, setCorrPunchType] = useState<"check_in" | "check_out">("check_in");
  const [corrTime, setCorrTime] = useState("08:30");
  const [corrReason, setCorrReason] = useState("");

  // Profile Change Form State
  const [pcrFieldName, setPcrFieldName] = useState("bank_iban");
  const [pcrRequestedValue, setPcrRequestedValue] = useState("");
  const [pcrReason, setPcrReason] = useState("");

  // Direct Contact Edit State
  const [directPhone, setDirectPhone] = useState(currentUser.phone || "0551234567");
  const [directPersonalEmail, setDirectPersonalEmail] = useState("");
  const [emergencyName, setEmergencyName] = useState(currentUser.emergencyContact?.name || "");
  const [emergencyPhone, setEmergencyPhone] = useState(currentUser.emergencyContact?.phone || "");
  const [emergencyRelation, setEmergencyRelation] = useState(currentUser.emergencyContact?.relation || "أب");

  // Profile resolution (server context preferred, fallback to AppContext currentUser)
  const empProfile = authContext?.employee || {
    id: currentUser.id,
    company_id: company.id,
    employee_no: currentUser.employeeNo,
    first_name_ar: currentUser.firstNameAr,
    last_name_ar: currentUser.lastNameAr,
    first_name_en: currentUser.firstNameEn,
    last_name_en: currentUser.lastNameEn,
    full_name: `${currentUser.firstNameAr} ${currentUser.lastNameAr}`,
    email: currentUser.email,
    phone: currentUser.phone,
    job_title_ar: currentUser.jobTitleAr,
    job_title_en: currentUser.jobTitleEn,
    department_id: currentUser.departmentId,
    department_name: currentUser.departmentName || "تقنية المعلومات",
    manager_id: currentUser.managerId || null,
    manager_name: "سارة المنصور",
    status: currentUser.status,
    hire_date: currentUser.hireDate,
    contract_type: currentUser.contractType || "full_time",
    national_id_or_iqama: currentUser.nationalIdOrIqama,
    nationality: currentUser.nationality,
    gender: currentUser.gender || "male",
    marital_status: currentUser.maritalStatus || "single",
    avatar_url: currentUser.avatarUrl,
    basic_salary: currentUser.basicSalary,
    housing_allowance: currentUser.housingAllowance || 0,
    transport_allowance: currentUser.transportAllowance || 0,
    total_salary: currentUser.totalSalary,
    bank_iban: currentUser.iban || "SA0380000000608010167519",
    bank_name: currentUser.bankName || "مصرف الراجحي",
    emergency_contact: currentUser.emergencyContact || null,
  };

  // Balances & Payroll resolution
  const myBalances = employeeLeaveBalances(empProfile.id, leaveBalances, dataMode === "demo");
  const annualBalance = myBalances.find((b) => b.leaveTypeId === "lt-annual") || myBalances[0];
  const myPayroll = latestEmployeePayroll(empProfile.id, payrollDetails, payrollRuns);
  const myRun = payrollRuns.find((r) => r.id === myPayroll?.payrollRunId);

  // Unified Requests Track
  const myPendingWorkflowRequests = useMemo(() => {
    return requests
      .filter((r) => !empProfile.id || r.employeeId === empProfile.id)
      .map((r) => ({
        id: r.id,
        referenceNo: r.referenceNo,
        type: r.type,
        title: r.payload.leaveTypeNameAr || r.payload.categoryNameAr || r.payload.reason || r.type,
        status: r.status,
        date: r.createdAt ? r.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10),
        raw: r,
      }));
  }, [requests, empProfile.id]);

  const unifiedRequests = useMemo(() => {
    const pcrItems = profileChangeRequests.map((p) => ({
      id: p.id,
      referenceNo: p.request_number,
      type: "profile_change",
      title: `تعديل ${p.field_label_ar} إلى: ${p.requested_value}`,
      status: p.status,
      date: p.created_at.slice(0, 10),
      raw: p,
    }));
    return [...myPendingWorkflowRequests, ...pcrItems].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [myPendingWorkflowRequests, profileChangeRequests]);

  const filteredRequests = useMemo(() => {
    if (requestsFilter === "all") return unifiedRequests;
    return unifiedRequests.filter((r) => r.status === requestsFilter);
  }, [unifiedRequests, requestsFilter]);

  // Punch actions
  const handlePunch = (type: "in" | "out") => {
    if (isSaving) return;
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const res = await punchInOut(type, {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
          if (res.success) {
            toast.success(
              `${res.message} (GPS: ${res.geofenceValid ? "داخل نطاق مقر العمل" : "خارج النطاق"})`
            );
          }
        },
        async () => {
          const res = await punchInOut(type);
          if (res.success) toast.success(res.message);
        }
      );
    } else {
      void punchInOut(type).then((res) => {
        if (res.success) toast.success(res.message);
      });
    }
  };

  const handleRequestCertificate = async () => {
    if (isSaving) return;
    if (!certificateDestination.trim()) {
      toast.error("أدخل الجهة الموجه إليها الخطاب");
      return;
    }
    const ok = await submitRequest({
      type: "salary_certificate",
      payload: { destination: certificateDestination.trim() },
    });
    if (ok) {
      toast.success("تم حفظ طلب شهادة الراتب وإرساله للاعتماد");
      setIsCertificateModalOpen(false);
    }
  };

  const handleSubmitQuickLeave = async () => {
    if (isSaving) return;
    if (!leaveReason.trim()) {
      toast.error("يرجى كتابة سبب الإجازة");
      return;
    }
    const ok = await applyLeave({
      leaveTypeId,
      startDate: leaveStart,
      endDate: leaveEnd,
      totalDays: leaveDays,
      reason: leaveReason.trim(),
    });
    if (ok) {
      toast.success("تم إرسال طلب الإجازة بنجاح وهو قيد اعتماد المدير المباشر");
      setIsQuickLeaveModalOpen(false);
      setLeaveReason("");
    } else {
      toast.error("تعذر إرسال طلب الإجازة");
    }
  };

  const handleSubmitPunchCorrection = async () => {
    if (isSaving) return;
    if (!corrReason.trim()) {
      toast.error("يرجى كتابة سبب تصحيح البصمة");
      return;
    }
    const ok = await submitAttendanceCorrection({
      workDate: corrDate,
      correctIn: corrPunchType === "check_in" ? corrTime : undefined,
      correctOut: corrPunchType === "check_out" ? corrTime : undefined,
      reason: corrReason.trim(),
    });
    if (ok) {
      toast.success("تم رفع طلب تصحيح البصمة للاعتماد");
      setIsPunchCorrectionModalOpen(false);
      setCorrReason("");
    } else {
      toast.error("تعذر إرسال طلب تصحيح البصمة");
    }
  };

  const handleSubmitProfileChange = async () => {
    if (!pcrRequestedValue.trim()) {
      toast.error("يرجى إدخال القيمة الجديدة المطلوبة");
      return;
    }
    if (!pcrReason.trim()) {
      toast.error("يرجى ذكر مبرر طلب التعديل");
      return;
    }

    const fieldDef = PROFILE_CHANGE_FIELDS_CATALOG[pcrFieldName];
    const oldValue = (empProfile as any)[pcrFieldName] ? String((empProfile as any)[pcrFieldName]) : "";

    try {
      const res = await submitPcrMutation.mutateAsync({
        fieldName: pcrFieldName,
        requestedValue: pcrRequestedValue.trim(),
        reason: pcrReason.trim(),
        oldValue,
      });
      if (res.success) {
        toast.success(`تم تسجيل طلب التعديل برقم ${res.request_number || "جديد"} وأرسل للاعتماد`);
        setIsProfileChangeModalOpen(false);
        setPcrRequestedValue("");
        setPcrReason("");
        void refetchPcr();
      } else {
        toast.error(res.error || "تعذر تسجيل الطلب");
      }
    } catch (err: any) {
      toast.error(err?.message || "حدث خطأ أثناء إرسال طلب التعديل");
    }
  };

  const handleUpdateDirectProfile = async () => {
    try {
      const res = await updateDirectProfileMutation.mutateAsync({
        phone: directPhone.trim(),
        personalEmail: directPersonalEmail.trim() || undefined,
        emergencyContact: {
          name: emergencyName.trim(),
          phone: emergencyPhone.trim(),
          relation: emergencyRelation.trim(),
        },
      });
      if (res.success) {
        toast.success("تم تحديث بيانات الاتصال بنجاح في ملفك الشخصي");
        setIsDirectEditModalOpen(false);
        void refetchAuthContext();
      } else {
        toast.error(res.error || "تعذر التحديث");
      }
    } catch (err: any) {
      toast.error(err?.message || "فشل تحديث البيانات");
    }
  };

  const handleReviewPcr = async (status: "approved" | "rejected") => {
    if (!reviewingPcr) return;
    try {
      const res = await reviewPcrMutation.mutateAsync({
        requestId: reviewingPcr.id,
        status,
        reviewNotes: reviewNote.trim() || undefined,
      });
      if (res.success) {
        toast.success(status === "approved" ? "تم اعتماد طلب التعديل وتحديث السجل" : "تم رفض الطلب");
        setReviewingPcr(null);
        setReviewNote("");
        void refetchPcr();
        void refetchTeamSummary();
      }
    } catch (err: any) {
      toast.error(err?.message || "فشل تنفيذ الإجراء");
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-3 sm:px-6 py-4 pb-28 sm:pb-12 space-y-5 animate-in fade-in duration-200">
      {/* ========================================================================= */}
      {/* 1. TOP HEADER & PERSONA BANNER */}
      {/* ========================================================================= */}
      <div className="rounded-3xl border border-border/80 bg-card p-4 sm:p-6 shadow-xs relative overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-primary via-[#00B5FF] to-emerald-400" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* User Details */}
          <div className="flex items-center gap-3.5">
            <div className="relative">
              <img
                src={
                  empProfile.avatar_url ||
                  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150"
                }
                alt={empProfile.first_name_ar}
                className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl border-2 border-primary/20 object-cover shadow-xs"
              />
              <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-emerald-500 border-2 border-background" />
            </div>

            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black text-foreground">
                  {language === "ar"
                    ? `${empProfile.first_name_ar} ${empProfile.last_name_ar}`
                    : `${empProfile.first_name_en} ${empProfile.last_name_en}`}
                </h1>
                <Badge variant="outline" className="text-[10px] font-mono border-primary/30 text-primary">
                  {empProfile.employee_no}
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground font-medium">
                <span>{empProfile.job_title_ar}</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Building2 className="h-3 w-3 text-primary/70" />
                  {empProfile.department_name}
                </span>
                {empProfile.manager_name && (
                  <>
                    <span>•</span>
                    <span className="text-[11px] text-muted-foreground/80">
                      المدير: {empProfile.manager_name}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Mode Switcher (ESS vs MSS) if Manager */}
          {isManagerUser && (
            <div className="flex items-center p-1 rounded-2xl bg-muted/40 border border-border/80 self-start sm:self-center">
              <Button
                variant={viewMode === "ess" ? "default" : "ghost"}
                size="sm"
                onClick={() => {
                  setViewMode("ess");
                  setActiveTab("overview");
                }}
                className={`rounded-xl text-xs font-bold h-8 px-3.5 gap-1.5 ${
                  viewMode === "ess" ? "shadow-xs" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <User className="h-3.5 w-3.5" />
                خدماتي الذاتية (ESS)
              </Button>
              <Button
                variant={viewMode === "mss" ? "default" : "ghost"}
                size="sm"
                onClick={() => {
                  setViewMode("mss");
                  setActiveTab("team");
                }}
                className={`rounded-xl text-xs font-bold h-8 px-3.5 gap-1.5 ${
                  viewMode === "mss" ? "shadow-xs" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                بوابة المدير (MSS)
                {((teamSummary?.pending_leaves_count ?? 0) + (teamSummary?.pending_profile_changes_count ?? 0)) > 0 && (
                  <Badge className="h-4 px-1.5 text-[9px] bg-destructive text-destructive-foreground">
                    {(teamSummary?.pending_leaves_count ?? 0) + (teamSummary?.pending_profile_changes_count ?? 0)}
                  </Badge>
                )}
              </Button>
            </div>
          )}
        </div>

        {/* Desktop Tab Bar */}
        <div className="hidden sm:flex items-center gap-2 border-t border-border/60 pt-3 mt-4">
          {viewMode === "ess" ? (
            <>
              <Button
                variant={activeTab === "overview" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setActiveTab("overview")}
                className="rounded-xl text-xs font-bold gap-1.5 h-8"
              >
                <Home className="h-3.5 w-3.5" />
                الرئيسية
              </Button>
              <Button
                variant={activeTab === "requests" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setActiveTab("requests")}
                className="rounded-xl text-xs font-bold gap-1.5 h-8"
              >
                <FileText className="h-3.5 w-3.5" />
                طلباتي
                {unifiedRequests.length > 0 && (
                  <Badge variant="outline" className="h-4 px-1.5 text-[9px]">
                    {unifiedRequests.length}
                  </Badge>
                )}
              </Button>
              <Button
                variant={activeTab === "services" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setActiveTab("services")}
                className="rounded-xl text-xs font-bold gap-1.5 h-8"
              >
                <Layers className="h-3.5 w-3.5" />
                دليل الخدمات السريعة
              </Button>
              <Button
                variant={activeTab === "profile" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setActiveTab("profile")}
                className="rounded-xl text-xs font-bold gap-1.5 h-8"
              >
                <User className="h-3.5 w-3.5" />
                الملف الشخصي والأمان
              </Button>
            </>
          ) : (
            <>
              <Button
                variant={mssTab === "team_overview" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setMssTab("team_overview")}
                className="rounded-xl text-xs font-bold gap-1.5 h-8"
              >
                <Home className="h-3.5 w-3.5" />
                لوحة الفريق
              </Button>
              <Button
                variant={mssTab === "team_approvals" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setMssTab("team_approvals")}
                className="rounded-xl text-xs font-bold gap-1.5 h-8"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                موافقات تنتظر اعتمادي
                {((teamSummary?.pending_leaves_count ?? 0) + (teamSummary?.pending_profile_changes_count ?? 0)) > 0 && (
                  <Badge className="h-4 px-1.5 text-[9px] bg-amber-500 text-white">
                    {(teamSummary?.pending_leaves_count ?? 0) + (teamSummary?.pending_profile_changes_count ?? 0)}
                  </Badge>
                )}
              </Button>
              <Button
                variant={mssTab === "team_attendance" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setMssTab("team_attendance")}
                className="rounded-xl text-xs font-bold gap-1.5 h-8"
              >
                <Users className="h-3.5 w-3.5" />
                سجل وحضور الفريق
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. MAIN BODY CONTENT */}
      {/* ========================================================================= */}

      {/* ------------------------------------------------------------------------- */}
      {/* 2A. ESS MODE - TAB: OVERVIEW */}
      {/* ------------------------------------------------------------------------- */}
      {viewMode === "ess" && activeTab === "overview" && (
        <div className="space-y-4">
          {/* Quick Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Metric 1: Leave Balance */}
            <div className="rounded-3xl border border-border/80 bg-card p-3.5 sm:p-4 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold">
                <span>رصيد الإجازة السنوية</span>
                <CalendarDays className="h-4 w-4 text-sky-500" />
              </div>
              <div className="my-2">
                <span className="text-xl sm:text-2xl font-black text-foreground font-mono">
                  {annualBalance?.availableBalance ?? 21}
                </span>
                <span className="text-xs text-muted-foreground mr-1">يوم</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsQuickLeaveModalOpen(true)}
                className="h-7 p-0 text-[11px] font-bold text-primary hover:text-primary/80 justify-start"
              >
                + طلب إجازة سريعة
              </Button>
            </div>

            {/* Metric 2: Latest Payslip */}
            <div className="rounded-3xl border border-border/80 bg-card p-3.5 sm:p-4 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold">
                <span>آخر صافي راتب</span>
                <DollarSign className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="my-2">
                <span className="text-xl sm:text-2xl font-black text-foreground font-mono">
                  {(myPayroll?.netSalary ?? empProfile.total_salary).toLocaleString()}
                </span>
                <span className="text-xs text-muted-foreground mr-1">ر.س</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsPayslipModalOpen(true)}
                className="h-7 p-0 text-[11px] font-bold text-primary hover:text-primary/80 justify-start"
              >
                عرض قسيمة الراتب
              </Button>
            </div>

            {/* Metric 3: GPS Punch Status */}
            <div className="rounded-3xl border border-border/80 bg-card p-3.5 sm:p-4 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold">
                <span>حالة الحضور اليوم</span>
                <Clock className="h-4 w-4 text-amber-500" />
              </div>
              <div className="my-2 flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-sm sm:text-base font-black text-foreground">
                  دوام منتظم
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground truncate">
                المقر: برج العليا (الرياض)
              </span>
            </div>

            {/* Metric 4: Pending Requests */}
            <div className="rounded-3xl border border-border/80 bg-card p-3.5 sm:p-4 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold">
                <span>الطلبات النشطة</span>
                <FileText className="h-4 w-4 text-purple-500" />
              </div>
              <div className="my-2">
                <span className="text-xl sm:text-2xl font-black text-foreground font-mono">
                  {unifiedRequests.filter((r) => r.status === "pending").length}
                </span>
                <span className="text-xs text-muted-foreground mr-1">قيد الاعتماد</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveTab("requests")}
                className="h-7 p-0 text-[11px] font-bold text-primary hover:text-primary/80 justify-start"
              >
                متابعة الطلبات
              </Button>
            </div>
          </div>

          {/* GPS Clock-In / Clock-Out Card */}
          <div className="rounded-3xl border border-border/80 bg-gradient-to-br from-card via-card to-muted/30 p-4 sm:p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-emerald-600 animate-bounce" />
                  <span className="text-xs sm:text-sm font-bold text-foreground">
                    تسجيل الحضور والانصراف الجغرافي (Geofence)
                  </span>
                  <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-300 bg-emerald-50">
                    داخل النطاق المعتمد
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  يتم التحقق من الموقع الجغرافي مباشرة وتسجيل البصمة الرقمية وفق سياسة الشركة
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                <Button
                  onClick={() => handlePunch("in")}
                  disabled={isSaving}
                  className="rounded-2xl h-10 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 shadow-xs"
                >
                  <Clock className="h-4 w-4" />
                  تسجيل دخول
                </Button>
                <Button
                  onClick={() => handlePunch("out")}
                  disabled={isSaving}
                  variant="outline"
                  className="rounded-2xl h-10 px-5 border-border/80 hover:bg-muted font-bold text-xs gap-1.5"
                >
                  <Clock className="h-4 w-4 text-amber-600" />
                  تسجيل خروج
                </Button>
              </div>
            </div>
          </div>

          {/* Quick Actions Grid */}
          <div className="space-y-2.5">
            <h2 className="text-xs sm:text-sm font-black text-foreground uppercase tracking-wider">
              الخدمات السريعة الأكثر طلباً
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <button
                type="button"
                onClick={() => setIsQuickLeaveModalOpen(true)}
                className="rounded-3xl border border-border/80 bg-card p-4 text-start hover:border-primary/50 transition-all hover:bg-muted/40 cursor-pointer shadow-xs group"
              >
                <div className="h-10 w-10 rounded-2xl bg-sky-50 dark:bg-sky-950/40 flex items-center justify-center text-sky-600 mb-2.5 group-hover:scale-105 transition-transform">
                  <CalendarDays className="h-5 w-5" />
                </div>
                <p className="text-xs sm:text-sm font-black text-foreground">طلب إجازة</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">تقديم طلب فوري</p>
              </button>

              <button
                type="button"
                onClick={() => setIsPunchCorrectionModalOpen(true)}
                className="rounded-3xl border border-border/80 bg-card p-4 text-start hover:border-primary/50 transition-all hover:bg-muted/40 cursor-pointer shadow-xs group"
              >
                <div className="h-10 w-10 rounded-2xl bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center text-amber-600 mb-2.5 group-hover:scale-105 transition-transform">
                  <Clock className="h-5 w-5" />
                </div>
                <p className="text-xs sm:text-sm font-black text-foreground">تصحيح بصمة</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">نسيان أو عطل جهاز</p>
              </button>

              <button
                type="button"
                onClick={() => setIsPayslipModalOpen(true)}
                className="rounded-3xl border border-border/80 bg-card p-4 text-start hover:border-primary/50 transition-all hover:bg-muted/40 cursor-pointer shadow-xs group"
              >
                <div className="h-10 w-10 rounded-2xl bg-purple-50 dark:bg-purple-950/40 flex items-center justify-center text-purple-600 mb-2.5 group-hover:scale-105 transition-transform">
                  <FileText className="h-5 w-5" />
                </div>
                <p className="text-xs sm:text-sm font-black text-foreground">قسيمة الراتب</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">كشف شهري رسمي</p>
              </button>

              <button
                type="button"
                onClick={() => setIsCertificateModalOpen(true)}
                className="rounded-3xl border border-border/80 bg-card p-4 text-start hover:border-primary/50 transition-all hover:bg-muted/40 cursor-pointer shadow-xs group"
              >
                <div className="h-10 w-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600 mb-2.5 group-hover:scale-105 transition-transform">
                  <QrCode className="h-5 w-5" />
                </div>
                <p className="text-xs sm:text-sm font-black text-foreground">شهادة تعريف</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">خطاب رسمي بالراتب</p>
              </button>
            </div>
          </div>

          {/* Recent Requests Section */}
          <div className="rounded-3xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs sm:text-sm font-black text-foreground">
                أحدث طلباتي ومسار الاعتماد
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveTab("requests")}
                className="text-xs font-bold text-primary hover:text-primary/80 h-7 px-2"
              >
                عرض كافة الطلبات ({unifiedRequests.length})
                <ChevronRight className="h-3.5 w-3.5 mr-1" />
              </Button>
            </div>

            {unifiedRequests.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-xs font-medium">
                لا توجد طلبات معلقة أو سابقة حتى الآن
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {unifiedRequests.slice(0, 4).map((req) => (
                  <div key={req.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground truncate block">
                          {req.title}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {req.referenceNo}
                        </span>
                      </div>
                      <span className="text-[11px] text-muted-foreground">{req.date}</span>
                    </div>

                    <Badge
                      variant="outline"
                      className={`text-[10px] rounded-full font-bold shrink-0 ${
                        req.status === "approved"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                          : req.status === "rejected"
                          ? "bg-destructive/10 text-destructive border-destructive/30"
                          : "bg-amber-50 text-amber-700 border-amber-300"
                      }`}
                    >
                      {req.status === "approved"
                        ? "معتمد"
                        : req.status === "rejected"
                        ? "مرفوض"
                        : "قيد المراجعة"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------------- */}
      {/* 2B. ESS MODE - TAB: REQUESTS */}
      {/* ------------------------------------------------------------------------- */}
      {viewMode === "ess" && activeTab === "requests" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-foreground">سجل الطلبات والاعتمادات</h2>
              <p className="text-xs text-muted-foreground">
                تتبع حالة جميع الطلبات والإجراءات الإدارية المقدمة
              </p>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              <Button
                size="sm"
                variant={requestsFilter === "all" ? "default" : "outline"}
                onClick={() => setRequestsFilter("all")}
                className="h-8 rounded-full text-xs font-bold px-3.5"
              >
                الكل ({unifiedRequests.length})
              </Button>
              <Button
                size="sm"
                variant={requestsFilter === "pending" ? "default" : "outline"}
                onClick={() => setRequestsFilter("pending")}
                className="h-8 rounded-full text-xs font-bold px-3.5 text-amber-600 border-amber-300"
              >
                قيد الاعتماد ({unifiedRequests.filter((r) => r.status === "pending").length})
              </Button>
              <Button
                size="sm"
                variant={requestsFilter === "approved" ? "default" : "outline"}
                onClick={() => setRequestsFilter("approved")}
                className="h-8 rounded-full text-xs font-bold px-3.5 text-emerald-600 border-emerald-300"
              >
                معتمدة ({unifiedRequests.filter((r) => r.status === "approved").length})
              </Button>
              <Button
                size="sm"
                variant={requestsFilter === "rejected" ? "default" : "outline"}
                onClick={() => setRequestsFilter("rejected")}
                className="h-8 rounded-full text-xs font-bold px-3.5 text-destructive border-destructive/30"
              >
                مرفوضة ({unifiedRequests.filter((r) => r.status === "rejected").length})
              </Button>
            </div>
          </div>

          <div className="rounded-3xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs space-y-3">
            {filteredRequests.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-xs font-medium space-y-2">
                <FileText className="h-8 w-8 mx-auto opacity-40" />
                <p>لا توجد طلبات تطابق الفلتر المحدد</p>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {filteredRequests.map((req) => (
                  <div key={req.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm text-foreground">{req.title}</span>
                        <Badge variant="outline" className="text-[10px] font-mono">
                          {req.referenceNo}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>تاريخ التقديم: {req.date}</span>
                        <span>•</span>
                        <span>النوع: {req.type === "profile_change" ? "تعديل بيانات" : "إجراء ذاتي"}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-center">
                      <Badge
                        variant="outline"
                        className={`text-xs rounded-full font-bold px-3 py-0.5 ${
                          req.status === "approved"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                            : req.status === "rejected"
                            ? "bg-destructive/10 text-destructive border-destructive/30"
                            : "bg-amber-50 text-amber-700 border-amber-300"
                        }`}
                      >
                        {req.status === "approved"
                          ? "تم الاعتماد"
                          : req.status === "rejected"
                          ? "مرفوض"
                          : "قيد المراجعة"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------------- */}
      {/* 2C. ESS MODE - TAB: SERVICES */}
      {/* ------------------------------------------------------------------------- */}
      {viewMode === "ess" && activeTab === "services" && (
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-black text-foreground">دليل الخدمات الذاتية الشامل</h2>
            <p className="text-xs text-muted-foreground">
              اختر الخدمة المطلوبة للتقديم المباشر أو استخراج المستندات المعتمدة
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {/* Service: Leave */}
            <div className="rounded-3xl border border-border/80 bg-card p-4 shadow-xs space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-sky-50 dark:bg-sky-950/50 flex items-center justify-center text-sky-600">
                  <CalendarDays className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-foreground">إدارة الإجازات</h3>
                  <p className="text-xs text-muted-foreground">سنوية، مرضية، اضطرارية</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                رصيدك المتاح حالياً: <strong>{annualBalance?.availableBalance ?? 21} يوم</strong>.
              </p>
              <Button
                size="sm"
                onClick={() => setIsQuickLeaveModalOpen(true)}
                className="w-full rounded-2xl text-xs font-bold h-9 bg-sky-600 hover:bg-sky-700 text-white"
              >
                تقديم طلب إجازة
              </Button>
            </div>

            {/* Service: Attendance Correction */}
            <div className="rounded-3xl border border-border/80 bg-card p-4 shadow-xs space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center text-amber-600">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-foreground">تصحيح البصمة</h3>
                  <p className="text-xs text-muted-foreground">تسجيل حضور أو انصراف منسي</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                تصحيح أوقات الدخول والخروج في حال وجود عطل أو مهمة خارجية.
              </p>
              <Button
                size="sm"
                onClick={() => setIsPunchCorrectionModalOpen(true)}
                className="w-full rounded-2xl text-xs font-bold h-9 bg-amber-600 hover:bg-amber-700 text-white"
              >
                طلب تصحيح بصمة
              </Button>
            </div>

            {/* Service: Payslip */}
            <div className="rounded-3xl border border-border/80 bg-card p-4 shadow-xs space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-purple-50 dark:bg-purple-950/50 flex items-center justify-center text-purple-600">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-foreground">قسائم الرواتب</h3>
                  <p className="text-xs text-muted-foreground">كشف الحساب والبدلات والاستقطاعات</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                استخراج وطباعة قسيمة الراتب الرسمية المعتمدة للشهر الحالي أو الأشهر السابقة.
              </p>
              <Button
                size="sm"
                onClick={() => setIsPayslipModalOpen(true)}
                className="w-full rounded-2xl text-xs font-bold h-9 bg-purple-600 hover:bg-purple-700 text-white"
              >
                عرض وطباعة القسيمة
              </Button>
            </div>

            {/* Service: Salary Certificate */}
            <div className="rounded-3xl border border-border/80 bg-card p-4 shadow-xs space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600">
                  <QrCode className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-foreground">شهادة تعريف بالراتب</h3>
                  <p className="text-xs text-muted-foreground">موثقة ومزودة برمز التحقق (QR)</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                طلب خطاب تعريف رسمي موجه للبنوك أو السفارات أو الجهات الحكومية.
              </p>
              <Button
                size="sm"
                onClick={() => setIsCertificateModalOpen(true)}
                className="w-full rounded-2xl text-xs font-bold h-9 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                إصدار شهادة تعريف
              </Button>
            </div>

            {/* Service: Profile Data Change */}
            <div className="rounded-3xl border border-border/80 bg-card p-4 shadow-xs space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600">
                  <Edit3 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-foreground">تعديل البيانات الرسمية</h3>
                  <p className="text-xs text-muted-foreground">الآيبان البنكي، الحالة الاجتماعية، الهاتف</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                طلب تحديث البيانات الحساسة مع مسار تدقيق معتمد لدى قسم الموارد البشرية والمالية.
              </p>
              <Button
                size="sm"
                onClick={() => setIsProfileChangeModalOpen(true)}
                className="w-full rounded-2xl text-xs font-bold h-9 bg-blue-600 hover:bg-blue-700 text-white"
              >
                طلب تعديل بيانات
              </Button>
            </div>

            {/* Service: Workflow Navigation */}
            <div className="rounded-3xl border border-border/80 bg-card p-4 shadow-xs space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center text-rose-600">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-foreground">مركز مسارات العمل</h3>
                  <p className="text-xs text-muted-foreground">طلبات متقدمة، سلف، عهد</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                الانتقال إلى مركز مسارات العمل المتقدم لرفع مطالبات المصروفات أو طلبات السلف.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onNavigate("workflow")}
                className="w-full rounded-2xl text-xs font-bold h-9 border-border/80"
              >
                فتح مسارات العمل الكاملة
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------------- */}
      {/* 2D. ESS MODE - TAB: PROFILE & SECURITY */}
      {/* ------------------------------------------------------------------------- */}
      {viewMode === "ess" && activeTab === "profile" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-black text-foreground">الملف الوظيفي والشخصي</h2>
              <p className="text-xs text-muted-foreground">
                البيانات المعتمدة في سجل الموظف وسجل التأمينات
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSensitiveData(!showSensitiveData)}
                className="rounded-2xl text-xs font-bold h-8 gap-1.5 border-border/80"
              >
                {showSensitiveData ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {showSensitiveData ? "إخفاء البيانات الحساسة" : "إظهار البيانات الحساسة"}
              </Button>
              <Button
                size="sm"
                onClick={() => setIsDirectEditModalOpen(true)}
                className="rounded-2xl text-xs font-bold h-8 gap-1.5"
              >
                <Edit3 className="h-3.5 w-3.5" />
                تعديل بيانات التواصل
              </Button>
            </div>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Card 1: Job & Contract Info */}
            <div className="rounded-3xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs space-y-3">
              <h3 className="text-xs font-black text-foreground uppercase flex items-center gap-1.5">
                <Briefcase className="h-4 w-4 text-primary" />
                البيانات الوظيفية والتعاقدية
              </h3>
              <div className="divide-y divide-border/60 text-xs">
                <div className="py-2 flex justify-between">
                  <span className="text-muted-foreground">المسمى الوظيفي:</span>
                  <span className="font-bold text-foreground">{empProfile.job_title_ar}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-muted-foreground">الإدارة / القسم:</span>
                  <span className="font-bold text-foreground">{empProfile.department_name}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-muted-foreground">المدير المباشر:</span>
                  <span className="font-bold text-foreground">{empProfile.manager_name}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-muted-foreground">تاريخ المباشرة:</span>
                  <span className="font-mono text-foreground">{empProfile.hire_date}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-muted-foreground">نوع العقد:</span>
                  <span className="font-semibold text-foreground">
                    {empProfile.contract_type === "full_time" ? "دوام كامل (محدد المدة)" : "عقد عمل"}
                  </span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-muted-foreground">حالة الحساب:</span>
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 font-bold">
                    نشط على رأس العمل
                  </Badge>
                </div>
              </div>
            </div>

            {/* Card 2: Personal & Identity Info */}
            <div className="rounded-3xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs space-y-3">
              <h3 className="text-xs font-black text-foreground uppercase flex items-center gap-1.5">
                <Shield className="h-4 w-4 text-primary" />
                الهوية والبيانات الشخصية
              </h3>
              <div className="divide-y divide-border/60 text-xs">
                <div className="py-2 flex justify-between">
                  <span className="text-muted-foreground">رقم الهوية الوطنية / الإقامة:</span>
                  <span className="font-mono font-bold text-foreground">
                    {showSensitiveData
                      ? empProfile.national_id_or_iqama
                      : `******${empProfile.national_id_or_iqama.slice(-4)}`}
                  </span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-muted-foreground">الجنسية:</span>
                  <span className="font-bold text-foreground">{empProfile.nationality}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-muted-foreground">الحالة الاجتماعية:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground">
                      {empProfile.marital_status === "married" ? "متزوج / متزوجة" : "أعزب / عزباء"}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setPcrFieldName("marital_status");
                        setIsProfileChangeModalOpen(true);
                      }}
                      className="h-5 px-1.5 text-[10px] text-primary hover:underline"
                    >
                      طلب تحديث
                    </Button>
                  </div>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-muted-foreground">رقم الجوال:</span>
                  <span className="font-mono text-foreground">{empProfile.phone}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-muted-foreground">البريد الإلكتروني:</span>
                  <span className="font-mono text-foreground">{empProfile.email}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-muted-foreground">جهة اتصال الطوارئ:</span>
                  <span className="text-foreground">
                    {empProfile.emergency_contact
                      ? `${empProfile.emergency_contact.name} (${empProfile.emergency_contact.relation}) - ${empProfile.emergency_contact.phone}`
                      : "غير محدد"}
                  </span>
                </div>
              </div>
            </div>

            {/* Card 3: Banking & Payroll Details */}
            <div className="rounded-3xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs space-y-3 md:col-span-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-foreground uppercase flex items-center gap-1.5">
                  <DollarSign className="h-4 w-4 text-emerald-600" />
                  البيانات المالية والحساب البنكي المعتمد
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPcrFieldName("bank_iban");
                    setIsProfileChangeModalOpen(true);
                  }}
                  className="rounded-2xl text-xs font-bold h-7 gap-1"
                >
                  <Edit3 className="h-3 w-3" />
                  طلب تغيير الحساب البنكي (IBAN)
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="rounded-2xl border border-border/70 bg-muted/20 p-3 space-y-1">
                  <span className="text-muted-foreground block text-[11px]">اسم البنك:</span>
                  <span className="font-black text-foreground text-sm">{empProfile.bank_name || "مصرف الراجحي"}</span>
                </div>
                <div className="rounded-2xl border border-border/70 bg-muted/20 p-3 space-y-1">
                  <span className="text-muted-foreground block text-[11px]">رقم الآيبان (IBAN):</span>
                  <span className="font-mono font-bold text-foreground text-xs">
                    {showSensitiveData
                      ? empProfile.bank_iban
                      : `SA***${(empProfile.bank_iban || "").slice(-6)}`}
                  </span>
                </div>
                <div className="rounded-2xl border border-border/70 bg-muted/20 p-3 space-y-1">
                  <span className="text-muted-foreground block text-[11px]">إجمالي الراتب التعاقدي:</span>
                  <span className="font-mono font-black text-foreground text-sm text-emerald-600">
                    {showSensitiveData ? `${empProfile.total_salary.toLocaleString()} ر.س` : "•••••• ر.س"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------------- */}
      {/* 2E. MSS MODE - MANAGER SELF-SERVICE (فريق العمل) */}
      {/* ------------------------------------------------------------------------- */}
      {viewMode === "mss" && (
        <div className="space-y-4">
          {/* MSS Mobile Subtabs */}
          <div className="flex sm:hidden items-center gap-1 p-1 rounded-2xl bg-muted/40 border border-border/80 overflow-x-auto">
            <Button
              variant={mssTab === "team_overview" ? "default" : "ghost"}
              size="sm"
              onClick={() => setMssTab("team_overview")}
              className="rounded-xl text-xs font-bold h-7 px-3"
            >
              نظرة عامة
            </Button>
            <Button
              variant={mssTab === "team_approvals" ? "default" : "ghost"}
              size="sm"
              onClick={() => setMssTab("team_approvals")}
              className="rounded-xl text-xs font-bold h-7 px-3"
            >
              الموافقات ({((teamSummary?.pending_leaves_count ?? 0) + (teamSummary?.pending_profile_changes_count ?? 0))})
            </Button>
            <Button
              variant={mssTab === "team_attendance" ? "default" : "ghost"}
              size="sm"
              onClick={() => setMssTab("team_attendance")}
              className="rounded-xl text-xs font-bold h-7 px-3"
            >
              حضور الفريق
            </Button>
          </div>

          {/* Subtab 1: Team Overview */}
          {mssTab === "team_overview" && (
            <div className="space-y-4">
              {/* Team KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-3xl border border-border/80 bg-card p-4 shadow-xs">
                  <span className="text-xs text-muted-foreground font-semibold block">إجمالي أفراد الفريق</span>
                  <h3 className="text-2xl font-black text-foreground mt-1 font-mono">
                    {teamSummary?.total_team_members ?? teamMembers.length}
                  </h3>
                  <span className="text-[10px] text-muted-foreground">مرؤوسين مباشرين</span>
                </div>

                <div className="rounded-3xl border border-border/80 bg-card p-4 shadow-xs">
                  <span className="text-xs text-muted-foreground font-semibold block">حاضر اليوم</span>
                  <h3 className="text-2xl font-black text-emerald-600 mt-1 font-mono">
                    {teamSummary?.present_today ?? 0}
                  </h3>
                  <span className="text-[10px] text-emerald-600 font-bold">باشروا العمل</span>
                </div>

                <div className="rounded-3xl border border-border/80 bg-card p-4 shadow-xs">
                  <span className="text-xs text-muted-foreground font-semibold block">في إجازة معتمدة</span>
                  <h3 className="text-2xl font-black text-sky-600 mt-1 font-mono">
                    {teamSummary?.on_leave_today ?? 0}
                  </h3>
                  <span className="text-[10px] text-sky-600 font-bold">إجازة رسمية</span>
                </div>

                <div className="rounded-3xl border border-border/80 bg-card p-4 shadow-xs">
                  <span className="text-xs text-muted-foreground font-semibold block">طلبات تنتظر اعتمادك</span>
                  <h3 className="text-2xl font-black text-amber-600 mt-1 font-mono">
                    {(teamSummary?.pending_leaves_count ?? 0) + (teamSummary?.pending_profile_changes_count ?? 0)}
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setMssTab("team_approvals")}
                    className="p-0 h-6 text-[10px] text-primary font-bold hover:underline"
                  >
                    اتخاذ القرار الآن ←
                  </Button>
                </div>
              </div>

              {/* Team Members Roster Preview */}
              <div className="rounded-3xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-foreground">أعضاء الفريق ومتابعة اليوم</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setMssTab("team_attendance")}
                    className="text-xs font-bold text-primary h-7"
                  >
                    عرض السجل الكامل
                  </Button>
                </div>

                <div className="divide-y divide-border/60">
                  {teamMembers.slice(0, 5).map((member) => (
                    <div key={member.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={
                            member.avatar_url ||
                            "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150"
                          }
                          alt={member.full_name}
                          className="h-10 w-10 rounded-2xl object-cover border border-border/80 shrink-0"
                        />
                        <div className="truncate">
                          <p className="font-bold text-foreground truncate">{member.full_name}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{member.job_title_ar}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {member.on_leave ? (
                          <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-300 text-[10px]">
                            في إجازة
                          </Badge>
                        ) : member.attendance_today?.status === "present" ? (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px]">
                            حاضر {member.attendance_today.check_in}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-muted text-muted-foreground border-border text-[10px]">
                            لم يسجل بعد
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Subtab 2: Team Approvals Queue */}
          {mssTab === "team_approvals" && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-black text-foreground">طابور الموافقات واعتماد طلبات الفريق</h3>
                <p className="text-xs text-muted-foreground">
                  الطلبات الإدارية وتحديثات البيانات الموجهة لك بصفتك مديراً مباشراً
                </p>
              </div>

              {profileChangeRequests.filter((p) => p.status === "pending").length === 0 ? (
                <div className="rounded-3xl border border-border/80 bg-card p-10 text-center space-y-2 text-xs text-muted-foreground shadow-xs">
                  <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto opacity-70" />
                  <p className="font-bold text-foreground">لا توجد طلبات معلقة تنتظر اعتمادك</p>
                  <p>جميع طلبات أعضاء فريقك تمت معالجتها ومطابقتها بالنظام</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {profileChangeRequests
                    .filter((p) => p.status === "pending")
                    .map((pcr) => (
                      <div
                        key={pcr.id}
                        className="rounded-3xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs space-y-3"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">
                                {pcr.request_number}
                              </Badge>
                              <span className="font-bold text-foreground text-sm">
                                طلب تحديث {pcr.field_label_ar}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              الموظف: <strong>عبدالله العتيبي</strong> (EMP-005)
                            </p>
                          </div>

                          <span className="text-[11px] text-muted-foreground font-mono">
                            {pcr.created_at.slice(0, 10)}
                          </span>
                        </div>

                        <div className="rounded-2xl border border-border/60 bg-muted/20 p-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-muted-foreground text-[11px] block">القيمة الحالية:</span>
                            <span className="font-mono text-foreground">{pcr.old_value || "غير مسجل"}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground text-[11px] block">القيمة الجديدة المطلوبة:</span>
                            <span className="font-mono font-bold text-primary">{pcr.requested_value}</span>
                          </div>
                          <div className="sm:col-span-2 mt-1">
                            <span className="text-muted-foreground text-[11px] block">سبب التعديل:</span>
                            <span className="text-foreground">{pcr.reason}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setReviewingPcr(pcr);
                              setReviewNote("");
                            }}
                            className="rounded-2xl text-xs font-bold h-8 text-destructive border-destructive/30 hover:bg-destructive/10"
                          >
                            <X className="h-3.5 w-3.5 ml-1" />
                            رفض الطلب
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => {
                              setReviewingPcr(pcr);
                              void handleReviewPcr("approved");
                            }}
                            className="rounded-2xl text-xs font-bold h-8 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                          >
                            <Check className="h-3.5 w-3.5 ml-1" />
                            اعتماد الطلب
                          </Button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* Subtab 3: Team Attendance Full Roster */}
          {mssTab === "team_attendance" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black text-foreground">حضور وتواجد الفريق المباشر</h3>
                  <p className="text-xs text-muted-foreground">
                    متابعة أوقات تسجيل البصمة وحالات الإجازة اللحظية
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    void refetchTeamMembers();
                    toast.success("تم تحديث حالة حضور الفريق");
                  }}
                  className="rounded-2xl text-xs font-bold h-8 gap-1 border-border/80"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  تحديث
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {teamMembers.map((member) => (
                  <div
                    key={member.id}
                    className="rounded-3xl border border-border/80 bg-card p-4 shadow-xs space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <img
                          src={
                            member.avatar_url ||
                            "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150"
                          }
                          alt={member.full_name}
                          className="h-12 w-12 rounded-2xl object-cover border border-border/80"
                        />
                        <div>
                          <p className="font-bold text-foreground text-sm">{member.full_name}</p>
                          <p className="text-xs text-muted-foreground">{member.job_title_ar}</p>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {member.employee_no}
                          </span>
                        </div>
                      </div>

                      {member.on_leave ? (
                        <Badge className="bg-sky-50 text-sky-700 border-sky-300 text-xs font-bold">
                          إجازة
                        </Badge>
                      ) : member.attendance_today?.status === "present" ? (
                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-300 text-xs font-bold">
                          حاضر
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          لم يسجل
                        </Badge>
                      )}
                    </div>

                    <div className="rounded-2xl border border-border/60 bg-muted/20 p-2.5 flex items-center justify-between text-xs font-mono">
                      <span>وقت الدخول:</span>
                      <strong className="text-foreground">
                        {member.attendance_today?.check_in || "—"}
                      </strong>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        asChild
                        className="flex-1 rounded-2xl text-xs font-bold h-8 border-border/80 gap-1"
                      >
                        <a href={`tel:${member.phone}`}>
                          <Phone className="h-3 w-3" />
                          اتصال
                        </a>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        asChild
                        className="flex-1 rounded-2xl text-xs font-bold h-8 border-border/80 gap-1"
                      >
                        <a href={`mailto:${member.email}`}>
                          <Mail className="h-3 w-3" />
                          بريد
                        </a>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. MOBILE BOTTOM NAVIGATION (Native-feel fixed bar on small viewports) */}
      {/* ========================================================================= */}
      <div className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-card/95 backdrop-blur-md border-t border-border/80 px-2 py-1.5 shadow-2xl safe-area-pb">
        <div className="grid grid-cols-4 gap-1">
          {viewMode === "ess" ? (
            <>
              <button
                type="button"
                onClick={() => setActiveTab("overview")}
                className={`flex flex-col items-center justify-center py-1.5 rounded-2xl text-[10px] font-bold transition-colors ${
                  activeTab === "overview"
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Home className="h-5 w-5 mb-0.5" />
                الرئيسية
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("requests")}
                className={`flex flex-col items-center justify-center py-1.5 rounded-2xl text-[10px] font-bold transition-colors relative ${
                  activeTab === "requests"
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <FileText className="h-5 w-5 mb-0.5" />
                طلباتي
                {unifiedRequests.filter((r) => r.status === "pending").length > 0 && (
                  <span className="absolute top-1 right-3 h-2 w-2 rounded-full bg-amber-500" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("services")}
                className={`flex flex-col items-center justify-center py-1.5 rounded-2xl text-[10px] font-bold transition-colors ${
                  activeTab === "services"
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Layers className="h-5 w-5 mb-0.5" />
                خدماتي
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("profile")}
                className={`flex flex-col items-center justify-center py-1.5 rounded-2xl text-[10px] font-bold transition-colors ${
                  activeTab === "profile"
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <User className="h-5 w-5 mb-0.5" />
                ملفي
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setMssTab("team_overview")}
                className={`flex flex-col items-center justify-center py-1.5 rounded-2xl text-[10px] font-bold transition-colors ${
                  mssTab === "team_overview"
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Home className="h-5 w-5 mb-0.5" />
                لوحة الفريق
              </button>

              <button
                type="button"
                onClick={() => setMssTab("team_approvals")}
                className={`flex flex-col items-center justify-center py-1.5 rounded-2xl text-[10px] font-bold transition-colors relative ${
                  mssTab === "team_approvals"
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <CheckCircle2 className="h-5 w-5 mb-0.5" />
                الموافقات
                {((teamSummary?.pending_leaves_count ?? 0) + (teamSummary?.pending_profile_changes_count ?? 0)) > 0 && (
                  <span className="absolute top-1 right-3 h-2 w-2 rounded-full bg-amber-500" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setMssTab("team_attendance")}
                className={`flex flex-col items-center justify-center py-1.5 rounded-2xl text-[10px] font-bold transition-colors ${
                  mssTab === "team_attendance"
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Users className="h-5 w-5 mb-0.5" />
                الحضور
              </button>

              <button
                type="button"
                onClick={() => {
                  setViewMode("ess");
                  setActiveTab("overview");
                }}
                className="flex flex-col items-center justify-center py-1.5 rounded-2xl text-[10px] font-bold text-muted-foreground hover:text-foreground"
              >
                <ArrowRight className="h-5 w-5 mb-0.5" />
                بوابة الموظف
              </button>
            </>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. MODALS & DIALOGS */}
      {/* ========================================================================= */}

      {/* MODAL 1: Quick Leave Request */}
      <Dialog open={isQuickLeaveModalOpen} onOpenChange={setIsQuickLeaveModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6 overflow-y-auto max-h-[90vh] border border-border/80 shadow-2xl">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary via-[#00B5FF] to-emerald-400" />
          <DialogHeader className="pt-1">
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              تقديم طلب إجازة سريعة
            </DialogTitle>
            <DialogDescription className="text-xs font-medium text-muted-foreground">
              سيتم إرسال الطلب لمديرك المباشر تلقائياً للموافقة والاعتماد
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs py-2">
            <div className="space-y-1.5">
              <label className="font-bold">نوع الإجازة *</label>
              <select
                value={leaveTypeId}
                onChange={(e) => setLeaveTypeId(e.target.value)}
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                {leaveTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nameAr} ({t.maxDaysPerYear} يوم سنوي)
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="font-bold">تاريخ البدء *</label>
                <input
                  type="date"
                  value={leaveStart}
                  onChange={(e) => setLeaveStart(e.target.value)}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-bold">تاريخ النهاية *</label>
                <input
                  type="date"
                  value={leaveEnd}
                  onChange={(e) => setLeaveEnd(e.target.value)}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold">عدد الأيام المطلوبة *</label>
              <input
                type="number"
                min={1}
                value={leaveDays}
                onChange={(e) => setLeaveDays(Number(e.target.value))}
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold">سبب الإجازة *</label>
              <textarea
                rows={2}
                value={leaveReason}
                onChange={(e) => setLeaveReason(e.target.value)}
                placeholder="اكتب سبب طلب الإجازة..."
                className="w-full rounded-2xl border border-border/80 bg-muted/40 p-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button
              size="sm"
              onClick={handleSubmitQuickLeave}
              disabled={isSaving}
              className="rounded-full text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-6 h-10 shadow-xs cursor-pointer"
            >
              إرسال طلب الإجازة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: Punch Correction */}
      <Dialog open={isPunchCorrectionModalOpen} onOpenChange={setIsPunchCorrectionModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6 overflow-y-auto max-h-[90vh] border border-border/80 shadow-2xl">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary via-[#00B5FF] to-emerald-400" />
          <DialogHeader className="pt-1">
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              طلب تصحيح بصمة حضور / انصراف
            </DialogTitle>
            <DialogDescription className="text-xs font-medium text-muted-foreground">
              في حال تعذر تسجيل البصمة أو وجود عطل فني في جهاز البصمة
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs py-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="font-bold">تاريخ البصمة *</label>
                <input
                  type="date"
                  value={corrDate}
                  onChange={(e) => setCorrDate(e.target.value)}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-bold">نوع البصمة *</label>
                <select
                  value={corrPunchType}
                  onChange={(e) => setCorrPunchType(e.target.value as any)}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="check_in">بصمة حضور (صباحي)</option>
                  <option value="check_out">بصمة انصراف (مسائي)</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold">التوقيت الفعلي *</label>
              <input
                type="time"
                value={corrTime}
                onChange={(e) => setCorrTime(e.target.value)}
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold">مبرر التصحيح *</label>
              <textarea
                rows={2}
                value={corrReason}
                onChange={(e) => setCorrReason(e.target.value)}
                placeholder="مثال: مهمة عمل خارجية، عطل في جهاز البصمة..."
                className="w-full rounded-2xl border border-border/80 bg-muted/40 p-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button
              size="sm"
              onClick={handleSubmitPunchCorrection}
              disabled={isSaving}
              className="rounded-full text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-6 h-10 shadow-xs cursor-pointer"
            >
              إرسال طلب التصحيح
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 3: Salary Certificate Modal */}
      <Dialog open={isCertificateModalOpen} onOpenChange={setIsCertificateModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6 overflow-y-auto max-h-[90vh] border border-border/80 shadow-2xl">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary via-[#00B5FF] to-emerald-400" />
          <DialogHeader className="pt-1">
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <QrCode className="h-5 w-5 text-primary" />
              طلب شهادة تعريف بالراتب
            </DialogTitle>
            <DialogDescription className="text-xs font-medium text-muted-foreground">
              يُحفظ الطلب ويرسل للجهة المختصة للمراجعة وإصدار الشهادة المعتمدة
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs py-2">
            <div className="space-y-1.5">
              <label className="font-bold">الجهة الموجه إليها الخطاب *</label>
              <input
                type="text"
                value={certificateDestination}
                onChange={(e) => setCertificateDestination(e.target.value)}
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-semibold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 space-y-1.5 text-xs">
              <p className="font-bold text-foreground">بيانات الشهادة المعتمدة:</p>
              <p className="text-muted-foreground">
                الموظف:{" "}
                <strong className="text-foreground">
                  {empProfile.first_name_ar} {empProfile.last_name_ar}
                </strong>
              </p>
              <p className="text-muted-foreground font-mono">
                الراتب الأساسي: {empProfile.basic_salary.toLocaleString()} ر.س • إجمالي الراتب: {empProfile.total_salary.toLocaleString()} ر.س
              </p>
              <p className="text-muted-foreground font-mono">
                تاريخ المباشرة: {empProfile.hire_date}
              </p>
            </div>
          </div>

          <DialogFooter className="mt-3">
            <Button
              size="sm"
              onClick={handleRequestCertificate}
              disabled={isSaving}
              className="rounded-full text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-6 h-10 shadow-xs cursor-pointer"
            >
              إرسال طلب الشهادة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 4: Mobile Payslip Modal with Overtime & Print */}
      {myPayroll && (
        <Dialog open={isPayslipModalOpen} onOpenChange={setIsPayslipModalOpen}>
          <DialogContent className="max-w-md rounded-3xl p-6 overflow-y-auto max-h-[90vh] border border-border/80 shadow-2xl">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary via-[#00B5FF] to-emerald-400" />
            <DialogHeader className="pt-1">
              <DialogTitle className="text-base font-black flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                قسيمة الراتب الرسمية
              </DialogTitle>
              <DialogDescription className="text-xs font-medium text-muted-foreground">
                {company.legalNameAr} • {myRun?.periodMonth}/{myRun?.periodYear}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3.5 text-xs py-2 font-mono">
              <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 space-y-2">
                <div className="flex justify-between">
                  <span>الراتب الأساسي:</span>
                  <span className="font-bold">{myPayroll.basicSalary.toLocaleString()} ر.س</span>
                </div>
                <div className="flex justify-between text-emerald-600 font-bold">
                  <span>بدل السكن + النقل:</span>
                  <span>
                    +{(myPayroll.housingAllowance + myPayroll.transportAllowance).toLocaleString()} ر.س
                  </span>
                </div>
                {myPayroll.overtimeAmount > 0 && (
                  <div className="flex justify-between text-primary font-bold">
                    <span>بدل ساعات إضافية (المادة 107):</span>
                    <span>+{myPayroll.overtimeAmount.toLocaleString()} ر.س</span>
                  </div>
                )}
                <div className="flex justify-between text-destructive font-bold">
                  <span>التأمينات الاجتماعية (GOSI):</span>
                  <span>-{myPayroll.gosiEmployeeDeduction.toLocaleString()} ر.س</span>
                </div>
                {myPayroll.loanInstallmentDeduction > 0 && (
                  <div className="flex justify-between text-destructive font-bold">
                    <span>استقطاع السلفة الشهرية:</span>
                    <span>-{myPayroll.loanInstallmentDeduction.toLocaleString()} ر.س</span>
                  </div>
                )}
                <div className="border-t border-border/60 pt-2 flex justify-between font-black text-sm text-primary font-sans">
                  <span>صافي الراتب:</span>
                  <span className="font-mono">{myPayroll.netSalary.toLocaleString()} ر.س</span>
                </div>
              </div>

              {/* Security Seal */}
              <div className="p-2.5 rounded-2xl bg-secondary/50 border border-primary/20 flex items-center justify-between text-[10px] font-sans">
                <div className="flex items-center gap-1.5 text-foreground">
                  <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>مستخرج وموثق من بيانات مسيّر الرواتب</span>
                </div>
                <Badge
                  variant="outline"
                  className="font-mono text-[9px] border-emerald-300 text-emerald-700 bg-emerald-500/10 font-bold"
                >
                  {myRun?.status === "paid" ? "تم تسجيل الصرف" : "مسيّر معتمد"}
                </Badge>
              </div>
            </div>

            <DialogFooter className="flex gap-2 mt-2">
              <Button
                size="sm"
                onClick={() => window.print()}
                variant="outline"
                className="flex-1 text-xs font-bold gap-1.5 rounded-full h-10 border-border/80 hover:bg-secondary cursor-pointer"
              >
                <Printer className="h-4 w-4" />
                طباعة
              </Button>
              <Button
                size="sm"
                onClick={() => setIsPayslipModalOpen(false)}
                className="flex-1 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-full h-10 shadow-xs cursor-pointer"
              >
                إغلاق
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* MODAL 5: Official Profile Change Request */}
      <Dialog open={isProfileChangeModalOpen} onOpenChange={setIsProfileChangeModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6 overflow-y-auto max-h-[90vh] border border-border/80 shadow-2xl">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary via-[#00B5FF] to-emerald-400" />
          <DialogHeader className="pt-1">
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Edit3 className="h-5 w-5 text-primary" />
              طلب تعديل البيانات الرسمية
            </DialogTitle>
            <DialogDescription className="text-xs font-medium text-muted-foreground">
              تخضع التعديلات الحساسة لموافقة الموارد البشرية والمالية مع حفظ سجل تدقيق كامل
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs py-2">
            <div className="space-y-1.5">
              <label className="font-bold">الحقل المطلوب تعديله *</label>
              <select
                value={pcrFieldName}
                onChange={(e) => {
                  setPcrFieldName(e.target.value);
                  setPcrRequestedValue("");
                }}
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                {Object.values(PROFILE_CHANGE_FIELDS_CATALOG).map((f) => (
                  <option key={f.field_name} value={f.field_name}>
                    {f.label_ar} ({f.risk_level === "high" ? "يتطلب اعتماد رسمي" : "تحديث مباشر"})
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-muted-foreground">
                {PROFILE_CHANGE_FIELDS_CATALOG[pcrFieldName]?.description_ar}
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold">القيمة الحالية المسجلة:</label>
              <div className="h-10 rounded-2xl border border-border/60 bg-muted/30 px-3 flex items-center text-xs font-mono text-muted-foreground">
                {(empProfile as any)[pcrFieldName] || "غير مسجل"}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold">القيمة الجديدة المطلوبة *</label>
              {PROFILE_CHANGE_FIELDS_CATALOG[pcrFieldName]?.input_type === "select" ? (
                <select
                  value={pcrRequestedValue}
                  onChange={(e) => setPcrRequestedValue(e.target.value)}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="">-- اختر القيمة --</option>
                  {PROFILE_CHANGE_FIELDS_CATALOG[pcrFieldName]?.options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label_ar}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={
                    PROFILE_CHANGE_FIELDS_CATALOG[pcrFieldName]?.input_type === "iban"
                      ? "text"
                      : PROFILE_CHANGE_FIELDS_CATALOG[pcrFieldName]?.input_type || "text"
                  }
                  value={pcrRequestedValue}
                  onChange={(e) => setPcrRequestedValue(e.target.value)}
                  placeholder={
                    pcrFieldName === "bank_iban"
                      ? "SA..."
                      : "أدخل القيمة الجديدة..."
                  }
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              )}
            </div>

            <div className="space-y-1.5">
              <label className="font-bold">سبب التعديل / المبرر *</label>
              <textarea
                rows={2}
                value={pcrReason}
                onChange={(e) => setPcrReason(e.target.value)}
                placeholder="اكتب سبب طلب تعديل هذا الحقل..."
                className="w-full rounded-2xl border border-border/80 bg-muted/40 p-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button
              size="sm"
              onClick={handleSubmitProfileChange}
              disabled={submitPcrMutation.isPending}
              className="rounded-full text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-6 h-10 shadow-xs cursor-pointer"
            >
              {submitPcrMutation.isPending ? "جاري الإرسال…" : "إرسال طلب التعديل"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 6: Direct Contact Edit Modal */}
      <Dialog open={isDirectEditModalOpen} onOpenChange={setIsDirectEditModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6 overflow-y-auto max-h-[90vh] border border-border/80 shadow-2xl">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary via-[#00B5FF] to-emerald-400" />
          <DialogHeader className="pt-1">
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Phone className="h-5 w-5 text-primary" />
              تحديث بيانات الاتصال والطوارئ
            </DialogTitle>
            <DialogDescription className="text-xs font-medium text-muted-foreground">
              تحديث فوري مباشر لرقم الجوال وجهة الاتصال في حالات الطوارئ
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs py-2">
            <div className="space-y-1.5">
              <label className="font-bold">رقم الجوال الشخصي *</label>
              <input
                type="tel"
                value={directPhone}
                onChange={(e) => setDirectPhone(e.target.value)}
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold">البريد الإلكتروني البديل</label>
              <input
                type="email"
                value={directPersonalEmail}
                onChange={(e) => setDirectPersonalEmail(e.target.value)}
                placeholder="name@personal.com"
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div className="border-t border-border/60 pt-3 space-y-2">
              <h4 className="font-bold text-foreground">جهة الاتصال في حالات الطوارئ</h4>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[11px] text-muted-foreground">الاسم</label>
                  <input
                    type="text"
                    value={emergencyName}
                    onChange={(e) => setEmergencyName(e.target.value)}
                    placeholder="مثال: فهد العتيبي"
                    className="w-full h-9 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-muted-foreground">صلة القرابة</label>
                  <input
                    type="text"
                    value={emergencyRelation}
                    onChange={(e) => setEmergencyRelation(e.target.value)}
                    placeholder="مثال: أب / أخ / زوجة"
                    className="w-full h-9 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">رقم الهاتف للطوارئ</label>
                <input
                  type="tel"
                  value={emergencyPhone}
                  onChange={(e) => setEmergencyPhone(e.target.value)}
                  placeholder="05xxxxxxxx"
                  className="w-full h-9 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button
              size="sm"
              onClick={handleUpdateDirectProfile}
              disabled={updateDirectProfileMutation.isPending}
              className="rounded-full text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-6 h-10 shadow-xs cursor-pointer"
            >
              {updateDirectProfileMutation.isPending ? "جاري الحفظ…" : "حفظ التعديلات"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 7: Manager Review Note Modal (on Reject or Decision Note) */}
      {reviewingPcr && (
        <Dialog open={Boolean(reviewingPcr)} onOpenChange={() => setReviewingPcr(null)}>
          <DialogContent className="max-w-md rounded-3xl p-6 overflow-y-auto max-h-[90vh] border border-border/80 shadow-2xl">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary via-[#00B5FF] to-emerald-400" />
            <DialogHeader className="pt-1">
              <DialogTitle className="text-base font-black flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                اتخاذ قرار بشأن طلب التعديل
              </DialogTitle>
              <DialogDescription className="text-xs font-medium text-muted-foreground">
                طلب رقم {reviewingPcr.request_number} ({reviewingPcr.field_label_ar})
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 text-xs py-2">
              <div className="space-y-1.5">
                <label className="font-bold">ملاحظات القرار / سبب الرفض (اختياري)</label>
                <textarea
                  rows={3}
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder="أدخل ملاحظات توضيحية للموظف..."
                  className="w-full rounded-2xl border border-border/80 bg-muted/40 p-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>

            <DialogFooter className="flex gap-2 mt-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleReviewPcr("rejected")}
                disabled={reviewPcrMutation.isPending}
                className="flex-1 rounded-full text-xs font-bold h-10 text-destructive border-destructive/30"
              >
                تأكيد الرفض
              </Button>
              <Button
                size="sm"
                onClick={() => void handleReviewPcr("approved")}
                disabled={reviewPcrMutation.isPending}
                className="flex-1 rounded-full text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10 shadow-xs"
              >
                تأكيد الاعتماد
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
