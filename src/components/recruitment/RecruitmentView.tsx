import React, { useEffect, useState, useMemo } from "react";
import {
  useRecruitmentDomain,
  useRecruitmentKpisQuery,
  useRecruitmentRequisitionsQuery,
  useJobOpeningsQuery,
  useCandidatePipelineQuery,
  useCandidateInterviewsQuery,
  useInterviewScorecardsQuery,
  useJobOffersQuery,
  useTalentPoolQuery,
  type RecruitmentRequisition,
  type JobOpeningRecord,
  type CandidateRecord,
  type CandidateInterview,
  type JobOfferRecord,
  type TalentPoolEntry,
  type ScorecardRecommendation,
  type EmploymentType,
  type WorkType,
} from "../../lib/domains/recruitment";
import { useApp } from "../../lib/context/AppContext";
import type { CandidateStage, ContractType, OrgUnit, WorkLocation } from "../../types";
import { IconSymbol } from "../ui/IconSymbol";
import {
  UserPlus,
  Briefcase,
  TrendingUp,
  Plus,
  Star,
  Mail,
  Phone,
  FileText,
  CheckCircle2,
  DollarSign,
  ChevronRight,
  Send,
  Eye,
  Award,
  Globe,
  UserCheck,
  Printer,
  Search,
  Filter,
  ShieldCheck,
  Building2,
  ArrowRight,
  Upload,
  X,
  Calendar,
  Clock,
  Check,
  AlertCircle,
  MapPin,
  Sparkles,
  PauseCircle,
  PlayCircle,
  FileCheck,
  Users,
  Layers,
  Database,
  Share2,
} from "lucide-react";
import { createSignedDownloadUrl, getSignedUrlForFileId } from "../../lib/storage";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";

interface RecruitmentViewProps {
  section?: "ats" | "workforce";
  initialTab?: string;
}

export const RecruitmentView: React.FC<RecruitmentViewProps> = ({
  section = "ats",
  initialTab = "dashboard",
}) => {
  const { orgUnits, workLocations, company, currentRole, language, t } = useApp();
  const domain = useRecruitmentDomain();

  const companyId = company?.id;

  // React Queries from repository
  const kpisQuery = useRecruitmentKpisQuery(companyId);
  const requisitionsQuery = useRecruitmentRequisitionsQuery({ companyId });
  const openingsQuery = useJobOpeningsQuery({ companyId });
  const pipelineQuery = useCandidatePipelineQuery({ companyId });
  const interviewsQuery = useCandidateInterviewsQuery({ companyId });
  const offersQuery = useJobOffersQuery({ companyId });
  const talentPoolQuery = useTalentPoolQuery({ companyId });

  const kpis = kpisQuery.data;
  const requisitions = requisitionsQuery.data ?? [];
  const openings = openingsQuery.data ?? [];
  const candidates = pipelineQuery.data ?? [];
  const interviews = interviewsQuery.data ?? [];
  const offers = offersQuery.data ?? [];
  const talentPool = talentPoolQuery.data ?? [];

  // Active Tab: 7 core tabs
  const [activeTab, setActiveTab] = useState<string>(initialTab);

  // Selected Records for modals
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateRecord | null>(null);
  const [selectedInterview, setSelectedInterview] = useState<CandidateInterview | null>(null);
  const [candidateToHire, setCandidateToHire] = useState<CandidateRecord | null>(null);
  const [offerToPrint, setOfferToPrint] = useState<JobOfferRecord | null>(null);
  const [selectedRequisition, setSelectedRequisition] = useState<RecruitmentRequisition | null>(null);

  // Filters
  const [candidateSearch, setCandidateSearch] = useState("");
  const [candidateJobFilter, setCandidateJobFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [requisitionStatusFilter, setRequisitionStatusFilter] = useState<string>("all");
  const [openingStatusFilter, setOpeningStatusFilter] = useState<string>("all");

  // Modals visibility
  const [isRequisitionModalOpen, setIsRequisitionModalOpen] = useState(false);
  const [isAddJobOpen, setIsAddJobOpen] = useState(false);
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [isScheduleInterviewOpen, setIsScheduleInterviewOpen] = useState(false);
  const [isScorecardOpen, setIsScorecardOpen] = useState(false);
  const [isOfferModalOpen, setIsOfferModalOpen] = useState(false);
  const [isOnboardingModalOpen, setIsOnboardingModalOpen] = useState(false);
  const [isTalentPoolModalOpen, setIsTalentPoolModalOpen] = useState(false);

  // Form States - Create Requisition
  const [newReq, setNewReq] = useState({
    titleAr: "",
    titleEn: "",
    departmentId: "",
    openingsCount: 1,
    employmentType: "full_time" as EmploymentType,
    salaryMin: "",
    salaryMax: "",
    justification: "",
  });

  // Form States - Create Job Opening
  const [newJob, setNewJob] = useState({
    titleAr: "",
    titleEn: "",
    departmentId: "",
    locationId: "",
    requisitionId: "",
    openingsCount: 1,
    employmentType: "full_time" as EmploymentType,
    salaryMin: "",
    salaryMax: "",
    salaryVisibility: "range" as "exact" | "range" | "hidden",
    requirementsAr: "",
    descriptionAr: "",
  });

  // Form States - Apply Candidate
  const [applicantJobId, setApplicantJobId] = useState("");
  const [applicantName, setApplicantName] = useState("");
  const [applicantEmail, setApplicantEmail] = useState("");
  const [applicantPhone, setApplicantPhone] = useState("");
  const [applicantNationalId, setApplicantNationalId] = useState("");
  const [applicantSource, setApplicantSource] = useState("website");
  const [applicantConsent, setApplicantConsent] = useState(true);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const cvInputRef = React.useRef<HTMLInputElement>(null);

  // Form States - Schedule Interview
  const [intCandidateId, setIntCandidateId] = useState("");
  const [intJobId, setIntJobId] = useState("");
  const [intType, setIntType] = useState<string>("technical");
  const [intScheduledAt, setIntScheduledAt] = useState("");
  const [intDurationMinutes, setIntDurationMinutes] = useState(45);
  const [intLocationType, setIntLocationType] = useState<string>("video");
  const [intMeetingLink, setIntMeetingLink] = useState("");
  const [intNotes, setIntNotes] = useState("");

  // Form States - Scorecard
  const [scoreRecommendation, setScoreRecommendation] = useState<ScorecardRecommendation>("hire");
  const [techScore, setTechScore] = useState(4);
  const [commScore, setCommScore] = useState(4);
  const [cultureScore, setCultureScore] = useState(4);
  const [problemSolvingScore, setProblemSolvingScore] = useState(4);
  const [scoreStrengths, setScoreStrengths] = useState("");
  const [scoreWeaknesses, setScoreWeaknesses] = useState("");
  const [scoreFeedback, setScoreFeedback] = useState("");

  // Form States - Create Job Offer
  const [offerCandidateId, setOfferCandidateId] = useState("");
  const [offerJobId, setOfferJobId] = useState("");
  const [offerBasic, setOfferBasic] = useState<number>(0);
  const [offerHousing, setOfferHousing] = useState<number>(0);
  const [offerTransport, setOfferTransport] = useState<number>(0);
  const [offerOther, setOfferOther] = useState<number>(0);
  const [offerStartDate, setOfferStartDate] = useState("");
  const [offerExpiryDate, setOfferExpiryDate] = useState("");
  const [offerNotes, setOfferNotes] = useState("");
  const [offerFile, setOfferFile] = useState<File | null>(null);
  const offerFileInputRef = React.useRef<HTMLInputElement>(null);

  // Form States - Onboarding Wizard (Convert to Employee)
  const [onboardFirstName, setOnboardFirstName] = useState("");
  const [onboardLastName, setOnboardLastName] = useState("");
  const [onboardDeptId, setOnboardDeptId] = useState("");
  const [onboardLocationId, setOnboardLocationId] = useState("");
  const [onboardContractType, setOnboardContractType] = useState<ContractType>("full_time");
  const [onboardWorkType, setOnboardWorkType] = useState<WorkType>("on_site");
  const [onboardBasic, setOnboardBasic] = useState(0);
  const [onboardHousing, setOnboardHousing] = useState(0);
  const [onboardTransport, setOnboardTransport] = useState(0);
  const [onboardStartDate, setOnboardStartDate] = useState("");
  const [isConvertingCandidate, setIsConvertingCandidate] = useState(false);

  // Form States - Add to Talent Pool
  const [talentCandidateId, setTalentCandidateId] = useState("");
  const [talentSkills, setTalentSkills] = useState("");
  const [talentNotes, setTalentNotes] = useState("");
  const [talentRetentionMonths, setTalentRetentionMonths] = useState(12);

  const canManageRecruitment = ["super_admin", "hr_manager", "recruiter"].includes(currentRole);
  const canApprove = ["super_admin", "hr_manager", "finance_officer"].includes(currentRole);
  const canSetFinancialData = ["super_admin", "payroll_officer", "finance_officer", "hr_manager"].includes(
    currentRole,
  );

  const stages: { key: CandidateStage; labelAr: string; color: string; badgeClass: string }[] = [
    { key: "applied", labelAr: "مقدم جديد", color: "border-blue-400", badgeClass: "bg-blue-50 text-blue-700 border-blue-200" },
    { key: "screening", labelAr: "الفرز والتدقيق", color: "border-amber-400", badgeClass: "bg-amber-50 text-amber-700 border-amber-200" },
    { key: "interview", labelAr: "المقابلة الشخصية", color: "border-purple-400", badgeClass: "bg-purple-50 text-purple-700 border-purple-200" },
    { key: "assessment", labelAr: "التقييم الفني", color: "border-indigo-400", badgeClass: "bg-indigo-50 text-indigo-700 border-indigo-200" },
    { key: "job_offer", labelAr: "العرض الوظيفي", color: "border-emerald-400", badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    { key: "hired", labelAr: "تم التعيين", color: "border-emerald-700", badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  ];

  const filteredCandidates = useMemo(() => {
    return candidates.filter((c: CandidateRecord) => {
      const term = candidateSearch.trim().toLowerCase();
      const matchesSearch =
        !term ||
        c.fullName.toLowerCase().includes(term) ||
        c.email.toLowerCase().includes(term) ||
        (c.jobTitle && c.jobTitle.toLowerCase().includes(term)) ||
        (c.candidateCode && c.candidateCode.toLowerCase().includes(term));
      const matchesJob = candidateJobFilter === "all" || c.jobId === candidateJobFilter;
      return matchesSearch && matchesJob;
    });
  }, [candidates, candidateSearch, candidateJobFilter]);

  const filteredRequisitions = useMemo(() => {
    return requisitions.filter((r: RecruitmentRequisition) => {
      if (requisitionStatusFilter === "all") return true;
      return r.status === requisitionStatusFilter;
    });
  }, [requisitions, requisitionStatusFilter]);

  const filteredOpenings = useMemo(() => {
    return openings.filter((o: JobOpeningRecord) => {
      if (openingStatusFilter === "all") return true;
      return o.publishedStatus === openingStatusFilter || o.status === openingStatusFilter;
    });
  }, [openings, openingStatusFilter]);

  // Handlers
  const handleCreateRequisition = async () => {
    if (!newReq.titleAr.trim()) {
      toast.error("يرجى إدخال المسمى الوظيفي المطلوب");
      return;
    }
    const res = await domain.createRequisition({
      titleAr: newReq.titleAr.trim(),
      titleEn: newReq.titleEn.trim() || undefined,
      departmentId: newReq.departmentId || undefined,
      openingsCount: Number(newReq.openingsCount) || 1,
      employmentType: newReq.employmentType,
      salaryMin: newReq.salaryMin ? Number(newReq.salaryMin) : undefined,
      salaryMax: newReq.salaryMax ? Number(newReq.salaryMax) : undefined,
      justification: newReq.justification.trim() || undefined,
    });
    if (res.ok) {
      setIsRequisitionModalOpen(false);
      setNewReq({
        titleAr: "",
        titleEn: "",
        departmentId: "",
        openingsCount: 1,
        employmentType: "full_time",
        salaryMin: "",
        salaryMax: "",
        justification: "",
      });
    }
  };

  const handleCreateJobOpening = async () => {
    if (!newJob.titleAr.trim()) {
      toast.error("يرجى إدخال عنوان الوظيفة بالعربية");
      return;
    }
    const res = await domain.createJobOpening({
      titleAr: newJob.titleAr.trim(),
      titleEn: newJob.titleEn.trim() || newJob.titleAr.trim(),
      departmentId: newJob.departmentId || undefined,
      locationId: newJob.locationId || undefined,
      requisitionId: newJob.requisitionId || undefined,
      openingsCount: Number(newJob.openingsCount) || 1,
      employmentType: newJob.employmentType,
      salaryMin: newJob.salaryMin ? Number(newJob.salaryMin) : undefined,
      salaryMax: newJob.salaryMax ? Number(newJob.salaryMax) : undefined,
      salaryVisibility: newJob.salaryVisibility,
      requirementsAr: newJob.requirementsAr.trim() || undefined,
      descriptionAr: newJob.descriptionAr.trim() || undefined,
    });
    if (res.ok) {
      setIsAddJobOpen(false);
      setNewJob({
        titleAr: "",
        titleEn: "",
        departmentId: "",
        locationId: "",
        requisitionId: "",
        openingsCount: 1,
        employmentType: "full_time",
        salaryMin: "",
        salaryMax: "",
        salaryVisibility: "range",
        requirementsAr: "",
        descriptionAr: "",
      });
    }
  };

  const handleApplyCandidate = async () => {
    if (!applicantJobId) {
      toast.error("يرجى اختيار الوظيفة الشاغرة");
      return;
    }
    if (!applicantName.trim()) {
      toast.error("يرجى إدخال اسم المرشح بالكامل");
      return;
    }
    if (!applicantEmail.trim()) {
      toast.error("يرجى إدخال البريد الإلكتروني للمرشح");
      return;
    }
    const res = await domain.applyCandidate(
      {
        jobId: applicantJobId,
        fullName: applicantName.trim(),
        email: applicantEmail.trim(),
        phone: applicantPhone.trim() || undefined,
        nationalId: applicantNationalId.trim() || undefined,
        source: applicantSource,
        consentGiven: applicantConsent,
      },
      cvFile || undefined,
    );
    if (res.ok) {
      setIsApplyModalOpen(false);
      setApplicantJobId("");
      setApplicantName("");
      setApplicantEmail("");
      setApplicantPhone("");
      setApplicantNationalId("");
      setCvFile(null);
      if (cvInputRef.current) cvInputRef.current.value = "";
    }
  };

  const handleScheduleInterview = async () => {
    if (!intCandidateId || !intJobId) {
      toast.error("يرجى تحديد المرشح والوظيفة");
      return;
    }
    if (!intScheduledAt) {
      toast.error("يرجى تحديد موعد المقابلة");
      return;
    }
    const res = await domain.scheduleInterview({
      candidateId: intCandidateId,
      jobId: intJobId,
      interviewType: intType,
      scheduledAt: intScheduledAt,
      durationMinutes: intDurationMinutes,
      locationType: intLocationType,
      meetingLink: intMeetingLink.trim() || undefined,
      notes: intNotes.trim() || undefined,
    });
    if (res.ok) {
      setIsScheduleInterviewOpen(false);
      setIntScheduledAt("");
      setIntMeetingLink("");
      setIntNotes("");
    }
  };

  const handleSubmitScorecard = async () => {
    if (!selectedInterview) return;
    const res = await domain.submitScorecard({
      interviewId: selectedInterview.id,
      candidateId: selectedInterview.candidateId,
      recommendation: scoreRecommendation,
      strengths: scoreStrengths.trim() || undefined,
      weaknesses: scoreWeaknesses.trim() || undefined,
      generalFeedback: scoreFeedback.trim() || undefined,
      criteria: [
        { criterion_name: "المهارات الفنية", score: techScore, weight_pct: 35 },
        { criterion_name: "مهارات التواصل", score: commScore, weight_pct: 25 },
        { criterion_name: "التوافق الثقافي", score: cultureScore, weight_pct: 20 },
        { criterion_name: "حل المشكلات والتفكير التحليلي", score: problemSolvingScore, weight_pct: 20 },
      ],
    });
    if (res.ok) {
      setIsScorecardOpen(false);
      setSelectedInterview(null);
      setScoreStrengths("");
      setScoreWeaknesses("");
      setScoreFeedback("");
    }
  };

  const handleCreateOffer = async () => {
    if (!offerCandidateId) {
      toast.error("يرجى تحديد المرشح المستهدف");
      return;
    }
    if (offerBasic <= 0) {
      toast.error("يرجى إدخال راتب أساسي صحيح أكبر من صفر");
      return;
    }
    const res = await domain.createJobOffer(
      {
        candidateId: offerCandidateId,
        jobId: offerJobId || undefined,
        basicSalary: offerBasic,
        housingAllowance: offerHousing || 0,
        transportAllowance: offerTransport || 0,
        otherAllowances: offerOther || 0,
        proposedStartDate: offerStartDate || undefined,
        expiryDate: offerExpiryDate || undefined,
        notes: offerNotes.trim() || undefined,
      },
      offerFile || undefined,
    );
    if (res.ok) {
      setIsOfferModalOpen(false);
      setOfferCandidateId("");
      setOfferJobId("");
      setOfferBasic(0);
      setOfferHousing(0);
      setOfferTransport(0);
      setOfferOther(0);
      setOfferStartDate("");
      setOfferExpiryDate("");
      setOfferNotes("");
      setOfferFile(null);
      if (offerFileInputRef.current) offerFileInputRef.current.value = "";
    }
  };

  const handleOpenOnboarding = (cand: CandidateRecord) => {
    setCandidateToHire(cand);
    const [firstName = "", ...lastName] = (cand.fullName || "").trim().split(/\s+/);
    setOnboardFirstName(cand.firstNameAr || firstName);
    setOnboardLastName(cand.lastNameAr || lastName.join(" ") || firstName);
    const job = openings.find((j: JobOpeningRecord) => j.id === cand.jobId);
    setOnboardContractType(job?.employmentType || "full_time");
    setOnboardWorkType("on_site");
    setOnboardDeptId(job?.departmentId || orgUnits[0]?.id || "");
    setOnboardLocationId(job?.locationId || workLocations[0]?.id || "");

    // Check if an accepted offer exists for this candidate to prefill compensation
    const acceptedOffer = offers.find(
      (o: JobOfferRecord) => o.candidateId === cand.id && (o.status === "accepted" || o.status === "approved"),
    );
    if (acceptedOffer) {
      setOnboardBasic(acceptedOffer.basicSalary || 0);
      setOnboardHousing(acceptedOffer.housingAllowance || 0);
      setOnboardTransport(acceptedOffer.transportAllowance || 0);
      setOnboardStartDate(acceptedOffer.proposedStartDate || "");
    } else {
      setOnboardBasic(0);
      setOnboardHousing(0);
      setOnboardTransport(0);
      setOnboardStartDate("");
    }
    setIsOnboardingModalOpen(true);
  };

  const handleCompleteOnboarding = async () => {
    if (!candidateToHire || isConvertingCandidate) return;
    if (!onboardFirstName.trim() || !onboardLastName.trim()) {
      toast.error("يرجى إدخال الاسم الأول واسم العائلة للموظف");
      return;
    }
    if (!onboardDeptId || !onboardLocationId) {
      toast.error("يرجى تحديد الإدارة ومقر العمل للموظف");
      return;
    }
    if (!onboardStartDate) {
      toast.error("يرجى تحديد تاريخ المباشرة الرسمي للموظف");
      return;
    }

    const { convertCandidateToEmployee } = domain;
    setIsConvertingCandidate(true);
    try {
      const converted = await convertCandidateToEmployee({
        candidateId: candidateToHire.id,
        firstNameAr: onboardFirstName.trim(),
        lastNameAr: onboardLastName.trim(),
        departmentId: onboardDeptId,
        workLocationId: onboardLocationId,
        hireDate: onboardStartDate,
        contractType: onboardContractType,
        workType: onboardWorkType,
        basicSalary: canSetFinancialData ? onboardBasic : 0,
        housingAllowance: canSetFinancialData ? onboardHousing : 0,
        transportAllowance: canSetFinancialData ? onboardTransport : 0,
      });
      if (converted) setIsOnboardingModalOpen(false);
      if (converted) {
        setCandidateToHire(null);
      }
    } finally {
      setIsConvertingCandidate(false);
    }
  };

  const handleAddToTalentPool = async () => {
    if (!talentCandidateId) {
      toast.error("يرجى اختيار المرشح لإدراجه في بنك المواهب");
      return;
    }
    const skillsArray = talentSkills
      .split(",")
      .map((s: string) => s.trim())
      .filter(Boolean);
    const res = await domain.addToTalentPool({
      candidateId: talentCandidateId,
      skills: skillsArray,
      notes: talentNotes.trim() || undefined,
      retentionMonths: talentRetentionMonths,
    });
    if (res.ok) {
      setIsTalentPoolModalOpen(false);
      setTalentCandidateId("");
      setTalentSkills("");
      setTalentNotes("");
    }
  };

  const handleViewCandidateCv = async (cand: CandidateRecord) => {
    try {
      if (cand.cvFileId) {
        toast.info("جاري إنشاء رابط السيرة الذاتية الآمن...");
        const result = await getSignedUrlForFileId(cand.cvFileId);
        window.open(result.signedUrl, "_blank", "noopener,noreferrer");
        return;
      }
      if (cand.cvUrl) {
        if (!cand.cvUrl.startsWith("http") && !cand.cvUrl.startsWith("blob:")) {
          toast.info("جاري إنشاء رابط السيرة الذاتية الآمن...");
          const result = await createSignedDownloadUrl("candidate-cvs", cand.cvUrl);
          window.open(result.signedUrl, "_blank", "noopener,noreferrer");
          return;
        }
        window.open(cand.cvUrl, "_blank", "noopener,noreferrer");
        return;
      }
      toast.error("لا توجد سيرة ذاتية مرفقة لهذا المرشح");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذر فتح السيرة الذاتية");
    }
  };

  const handlePrintOfferLetter = (offer: JobOfferRecord) => {
    setOfferToPrint(offer);
  };

  return (
    <div className="space-y-6">
      {/* Executive Page Header */}
      <div className="classera-page-header">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-xs">
              <IconSymbol
                name="person_search"
                source="material"
                filled
                size={24}
                className="text-primary"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-foreground">
                  نظام التوظيف واستقطاب الكفاءات (ATS & Hiring Engine)
                </h1>
                <Badge
                  variant="outline"
                  className="bg-primary/5 text-primary border-primary/20 text-[10px] font-bold py-0.5 rounded-full"
                >
                  محرك معتمد
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground font-medium mt-0.5">
                إدارة دورة حياة التوظيف المتكاملة من طلبات الاحتياج والفرز الذكي حتى إصدار العروض والتعيين الفوري
              </p>
            </div>
          </div>
        </div>

        {/* Global Quick Actions */}
        <div className="flex items-center gap-2">
          {canManageRecruitment && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsRequisitionModalOpen(true)}
                className="rounded-full text-xs font-bold gap-1.5 h-9"
              >
                <Plus className="h-3.5 w-3.5" />
                طلب احتياج جديد
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsAddJobOpen(true)}
                className="rounded-full text-xs font-bold gap-1.5 h-9"
              >
                <Briefcase className="h-3.5 w-3.5" />
                وظيفة شاغرة
              </Button>
              <Button
                size="sm"
                onClick={() => setIsApplyModalOpen(true)}
                className="rounded-full text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-bold gap-1.5 h-9 shadow-xs"
              >
                <UserPlus className="h-3.5 w-3.5" />
                تقديم مرشح
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Main 7 Navigation Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted/60 p-1 rounded-2xl flex flex-wrap gap-1 w-full justify-start h-auto border border-border/60">
          <TabsTrigger
            value="dashboard"
            className="rounded-xl text-xs font-bold py-2 px-3.5 data-[state=active]:bg-card data-[state=active]:shadow-xs flex items-center gap-1.5"
          >
            <TrendingUp className="h-3.5 w-3.5 text-primary" />
            لوحة المؤشرات
          </TabsTrigger>
          <TabsTrigger
            value="requisitions"
            className="rounded-xl text-xs font-bold py-2 px-3.5 data-[state=active]:bg-card data-[state=active]:shadow-xs flex items-center gap-1.5"
          >
            <FileText className="h-3.5 w-3.5 text-indigo-600" />
            طلبات الاحتياج ({requisitions.length})
          </TabsTrigger>
          <TabsTrigger
            value="jobs"
            className="rounded-xl text-xs font-bold py-2 px-3.5 data-[state=active]:bg-card data-[state=active]:shadow-xs flex items-center gap-1.5"
          >
            <Briefcase className="h-3.5 w-3.5 text-amber-600" />
            الوظائف الشاغرة ({openings.length})
          </TabsTrigger>
          <TabsTrigger
            value="pipeline"
            className="rounded-xl text-xs font-bold py-2 px-3.5 data-[state=active]:bg-card data-[state=active]:shadow-xs flex items-center gap-1.5"
          >
            <Users className="h-3.5 w-3.5 text-blue-600" />
            مسار المتقدمين ATS ({candidates.length})
          </TabsTrigger>
          <TabsTrigger
            value="interviews"
            className="rounded-xl text-xs font-bold py-2 px-3.5 data-[state=active]:bg-card data-[state=active]:shadow-xs flex items-center gap-1.5"
          >
            <Calendar className="h-3.5 w-3.5 text-purple-600" />
            المقابلات والتقييم ({interviews.length})
          </TabsTrigger>
          <TabsTrigger
            value="offers"
            className="rounded-xl text-xs font-bold py-2 px-3.5 data-[state=active]:bg-card data-[state=active]:shadow-xs flex items-center gap-1.5"
          >
            <FileCheck className="h-3.5 w-3.5 text-emerald-600" />
            العروض والتعيين ({offers.length})
          </TabsTrigger>
          <TabsTrigger
            value="talent_pool"
            className="rounded-xl text-xs font-bold py-2 px-3.5 data-[state=active]:bg-card data-[state=active]:shadow-xs flex items-center gap-1.5"
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            بنك المواهب ({talentPool.length})
          </TabsTrigger>
        </TabsList>

        {/* ========================================================================= */}
        {/* TAB 1: DASHBOARD & KPIS */}
        {/* ========================================================================= */}
        <TabsContent value="dashboard" className="space-y-6 pt-2">
          {/* Executive KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
            <div className="classera-kpi-card p-4 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-muted-foreground">طلبات الاحتياج</span>
                <h4 className="text-xl font-black text-foreground mt-0.5 font-mono">
                  {kpis?.totalRequisitions ?? requisitions.length}
                </h4>
                <span className="text-[10px] text-amber-600 font-bold">
                  {kpis?.pendingRequisitions ?? 0} بانتظار الاعتماد
                </span>
              </div>
              <div className="h-10 w-10 rounded-2xl bg-secondary flex items-center justify-center text-primary">
                <FileText className="h-5 w-5" />
              </div>
            </div>

            <div className="classera-kpi-card p-4 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-muted-foreground">الوظائف المنشورة</span>
                <h4 className="text-xl font-black text-foreground mt-0.5 font-mono">
                  {kpis?.activeJobOpenings ?? openings.filter((o: JobOpeningRecord) => o.publishedStatus === "published").length}
                </h4>
                <span className="text-[10px] text-muted-foreground font-bold">
                  {kpis?.totalTargetOpenings ?? 0} شاغر معتمد
                </span>
              </div>
              <div className="h-10 w-10 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600">
                <Briefcase className="h-5 w-5" />
              </div>
            </div>

            <div className="classera-kpi-card p-4 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-muted-foreground">إجمالي المرشحين</span>
                <h4 className="text-xl font-black text-foreground mt-0.5 font-mono">
                  {kpis?.totalCandidates ?? candidates.length}
                </h4>
                <span className="text-[10px] text-blue-600 font-bold">
                  {kpis?.pipelineCandidates ?? candidates.filter((c: CandidateRecord) => c.stage !== "hired").length} في المسار
                </span>
              </div>
              <div className="h-10 w-10 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
                <Users className="h-5 w-5" />
              </div>
            </div>

            <div className="classera-kpi-card p-4 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-muted-foreground">المقابلات المجدولة</span>
                <h4 className="text-xl font-black text-foreground mt-0.5 font-mono">
                  {kpis?.scheduledInterviews ?? interviews.filter((i: CandidateInterview) => i.status === "scheduled").length}
                </h4>
                <span className="text-[10px] text-purple-600 font-bold">
                  {kpis?.completedInterviews ?? 0} مكتملة
                </span>
              </div>
              <div className="h-10 w-10 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600">
                <Calendar className="h-5 w-5" />
              </div>
            </div>

            <div className="classera-kpi-card p-4 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-muted-foreground">العروض الوظيفية</span>
                <h4 className="text-xl font-black text-foreground mt-0.5 font-mono">
                  {kpis?.totalOffers ?? offers.length}
                </h4>
                <span className="text-[10px] text-emerald-600 font-bold">
                  {kpis?.acceptedOffers ?? offers.filter((o: JobOfferRecord) => o.status === "accepted").length} مقبولة
                </span>
              </div>
              <div className="h-10 w-10 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                <FileCheck className="h-5 w-5" />
              </div>
            </div>

            <div className="classera-kpi-card p-4 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-muted-foreground">التعيينات المكتملة</span>
                <h4 className="text-xl font-black text-foreground mt-0.5 font-mono">
                  {kpis?.hiredCount ?? candidates.filter((c: CandidateRecord) => c.stage === "hired").length}
                </h4>
                <span className="text-[10px] text-primary font-bold">
                  متوسط {kpis?.avgTimeToHireDays ?? 18} يوم
                </span>
              </div>
              <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                <UserCheck className="h-5 w-5" />
              </div>
            </div>
          </div>

          {/* Visual Recruitment Funnel */}
          <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <h3 className="font-black text-sm text-foreground flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" />
                  قمع مسار التوظيف والتحويل الذكي (Recruitment Funnel)
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  توزيع المرشحين ومعدلات الانتقال بين المراحل التنفيذية
                </p>
              </div>
              <Badge variant="outline" className="text-xs font-mono font-bold">
                إجمالي {candidates.length} متقدم
              </Badge>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 pt-2">
              {stages.map((st) => {
                const count = candidates.filter((c: CandidateRecord) => c.stage === st.key).length;
                const pct = candidates.length > 0 ? Math.round((count / candidates.length) * 100) : 0;
                return (
                  <div
                    key={st.key}
                    className={`rounded-2xl border ${st.color} bg-muted/20 p-4 space-y-2 text-center transition-all hover:scale-[1.02] cursor-pointer`}
                    onClick={() => {
                      setActiveTab("pipeline");
                    }}
                  >
                    <span className="text-xs font-bold text-muted-foreground block">{st.labelAr}</span>
                    <h4 className="text-2xl font-black text-foreground font-mono">{count}</h4>
                    <div className="w-full bg-border/60 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-primary h-full rounded-full transition-all"
                        style={{ width: `${Math.max(pct, 5)}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground font-mono block">
                      {pct}% من الإجمالي
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Openings & Action Center */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Active Openings Widget */}
            <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-3.5">
              <div className="flex items-center justify-between border-b border-border/60 pb-2">
                <h4 className="font-bold text-xs text-foreground flex items-center gap-1.5">
                  <Briefcase className="h-4 w-4 text-primary" />
                  أحدث الوظائف الشاغرة
                </h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveTab("jobs")}
                  className="text-xs font-bold text-primary h-7 px-2"
                >
                  عرض الكل ({openings.length})
                </Button>
              </div>
              <div className="space-y-2">
                {openings.slice(0, 4).map((j: JobOpeningRecord) => (
                  <div
                    key={j.id}
                    className="p-3 rounded-2xl border border-border/60 bg-muted/20 flex items-center justify-between hover:bg-secondary/40 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-foreground">{j.titleAr}</span>
                        <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          {j.jobReference}
                        </span>
                      </div>
                      <span className="text-[11px] text-muted-foreground block mt-0.5">
                        {j.departmentName || "إدارة عامة"} • {j.openingsCount} شاغر
                      </span>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-bold ${
                        j.publishedStatus === "published"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {j.publishedStatus === "published" ? "منشورة" : "مسودة"}
                    </Badge>
                  </div>
                ))}
                {openings.length === 0 && (
                  <div className="text-center py-8 text-xs text-muted-foreground">
                    لا توجد وظائف شاغرة حالياً. اضغط على زر "وظيفة شاغرة" للإضافة.
                  </div>
                )}
              </div>
            </div>

            {/* Upcoming Interviews Widget */}
            <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-3.5">
              <div className="flex items-center justify-between border-b border-border/60 pb-2">
                <h4 className="font-bold text-xs text-foreground flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-purple-600" />
                  المقابلات القادمة
                </h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveTab("interviews")}
                  className="text-xs font-bold text-primary h-7 px-2"
                >
                  عرض الكل ({interviews.length})
                </Button>
              </div>
              <div className="space-y-2">
                {interviews.slice(0, 4).map((i: CandidateInterview) => (
                  <div
                    key={i.id}
                    className="p-3 rounded-2xl border border-border/60 bg-muted/20 flex items-center justify-between hover:bg-secondary/40 transition-colors"
                  >
                    <div>
                      <span className="font-bold text-xs text-foreground block">
                        {i.candidateName || "مرشح"}
                      </span>
                      <span className="text-[11px] text-muted-foreground font-mono block mt-0.5">
                        {i.jobTitle || "وظيفة"} • {new Date(i.scheduledAt).toLocaleString("ar-SA")}
                      </span>
                    </div>
                    <Badge variant="outline" className="text-[10px] font-bold bg-purple-50 text-purple-700 border-purple-200">
                      {i.interviewType}
                    </Badge>
                  </div>
                ))}
                {interviews.length === 0 && (
                  <div className="text-center py-8 text-xs text-muted-foreground">
                    لا توجد مقابلات مجدولة حالياً.
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ========================================================================= */}
        {/* TAB 2: REQUISITIONS */}
        {/* ========================================================================= */}
        <TabsContent value="requisitions" className="space-y-4 pt-2">
          {/* Header & Filter Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-card p-4 rounded-3xl border border-border/80">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground">تصفية حسب الحالة:</span>
              <select
                value={requisitionStatusFilter}
                onChange={(e) => setRequisitionStatusFilter(e.target.value)}
                className="h-8 rounded-full border border-border/80 bg-muted/40 px-3 text-xs font-bold focus:outline-none"
              >
                <option value="all">كافة الطلبات ({requisitions.length})</option>
                <option value="draft">مسودة</option>
                <option value="pending_approval">بانتظار الاعتماد</option>
                <option value="approved">معتمدة</option>
                <option value="rejected">مرفوضة</option>
                <option value="filled">مكتملة التعيين</option>
              </select>
            </div>

            <Button
              size="sm"
              onClick={() => setIsRequisitionModalOpen(true)}
              className="rounded-full text-xs bg-primary text-primary-foreground font-bold gap-1.5 h-8"
            >
              <Plus className="h-3.5 w-3.5" />
              إنشاء طلب احتياج وظيفي
            </Button>
          </div>

          {/* Requisitions Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredRequisitions.map((req: RecruitmentRequisition) => (
              <div
                key={req.id}
                className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-3.5 hover:border-primary/40 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-sm text-foreground">{req.titleAr}</h3>
                      <Badge variant="outline" className="font-mono text-[10px] font-bold">
                        {req.requisitionNo}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground font-medium mt-0.5">
                      {req.departmentName || "إدارة عامة"} • {req.employmentType}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-bold rounded-full px-2.5 ${
                      req.status === "approved"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : req.status === "pending_approval"
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : req.status === "rejected"
                        ? "bg-rose-50 text-rose-700 border-rose-200"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {req.status === "approved"
                      ? "معتمد"
                      : req.status === "pending_approval"
                      ? "قيد المراجعة"
                      : req.status === "rejected"
                      ? "مرفوض"
                      : req.status}
                  </Badge>
                </div>

                {req.justification && (
                  <p className="text-xs text-muted-foreground bg-muted/30 p-2.5 rounded-2xl">
                    {req.justification}
                  </p>
                )}

                <div className="border-t border-border/60 pt-3 flex items-center justify-between text-xs font-semibold text-muted-foreground">
                  <span>
                    الشواغر: <strong className="text-foreground">{req.openingsCount}</strong>
                    {req.filledCount > 0 && ` (تم شغل ${req.filledCount})`}
                  </span>
                  {(req.salaryMin || req.salaryMax) && (
                    <span className="font-mono text-primary font-bold">
                      {req.salaryMin ? req.salaryMin.toLocaleString() : "0"} -{" "}
                      {req.salaryMax ? req.salaryMax.toLocaleString() : "—"} ر.س
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
                  {canApprove && req.status === "pending_approval" && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          domain.approveRequisition({ requisitionId: req.id, decision: "reject" })
                        }
                        className="h-7 text-xs text-rose-600 rounded-full"
                      >
                        رفض
                      </Button>
                      <Button
                        size="sm"
                        onClick={() =>
                          domain.approveRequisition({ requisitionId: req.id, decision: "approve" })
                        }
                        className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-full font-bold"
                      >
                        اعتماد الطلب
                      </Button>
                    </>
                  )}

                  {req.status === "approved" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setNewJob({
                          titleAr: req.titleAr,
                          titleEn: req.titleEn || req.titleAr,
                          departmentId: req.departmentId || "",
                          locationId: "",
                          requisitionId: req.id,
                          openingsCount: req.openingsCount,
                          employmentType: req.employmentType,
                          salaryMin: req.salaryMin ? String(req.salaryMin) : "",
                          salaryMax: req.salaryMax ? String(req.salaryMax) : "",
                          salaryVisibility: "range",
                          requirementsAr: "",
                          descriptionAr: req.justification || "",
                        });
                        setIsAddJobOpen(true);
                      }}
                      className="h-7 text-xs text-primary font-bold rounded-full gap-1"
                    >
                      <Briefcase className="h-3 w-3" />
                      فتح وظيفة من هذا الاحتياج
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {filteredRequisitions.length === 0 && (
              <div className="col-span-2 text-center py-12 border-2 border-dashed border-border/60 rounded-3xl text-xs text-muted-foreground">
                لا توجد طلبات احتياج مطابقة للفلاتر الحالية.
              </div>
            )}
          </div>
        </TabsContent>

        {/* ========================================================================= */}
        {/* TAB 3: JOB OPENINGS */}
        {/* ========================================================================= */}
        <TabsContent value="jobs" className="space-y-4 pt-2">
          {/* Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-card p-4 rounded-3xl border border-border/80">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground">الحالة:</span>
              <select
                value={openingStatusFilter}
                onChange={(e) => setOpeningStatusFilter(e.target.value)}
                className="h-8 rounded-full border border-border/80 bg-muted/40 px-3 text-xs font-bold focus:outline-none"
              >
                <option value="all">كافة الوظائف ({openings.length})</option>
                <option value="published">منشورة</option>
                <option value="paused">موقوفة مؤقتاً</option>
                <option value="draft">مسودة</option>
                <option value="closed">مغلقة</option>
              </select>
            </div>

            <Button
              size="sm"
              onClick={() => setIsAddJobOpen(true)}
              className="rounded-full text-xs bg-primary text-primary-foreground font-bold gap-1.5 h-8"
            >
              <Plus className="h-3.5 w-3.5" />
              إضافة وظيفة شاغرة
            </Button>
          </div>

          {/* Job Openings Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredOpenings.map((job: JobOpeningRecord) => (
              <div
                key={job.id}
                className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-3.5 hover:border-primary/40 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-sm text-foreground">{job.titleAr}</h3>
                      <Badge variant="outline" className="font-mono text-[10px] font-bold">
                        {job.jobReference}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground font-medium mt-0.5">
                      {job.departmentName || "إدارة عامة"} • {job.locationName || "المقر الرئيسي"}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-[10px] rounded-full px-2.5 font-bold ${
                      job.publishedStatus === "published"
                        ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                        : job.publishedStatus === "paused"
                        ? "text-amber-700 bg-amber-50 border-amber-200"
                        : "text-muted-foreground bg-muted"
                    }`}
                  >
                    {job.publishedStatus === "published"
                      ? "منشورة للتقديم"
                      : job.publishedStatus === "paused"
                      ? "موقوفة مؤقتاً"
                      : "مسودة غير منشورة"}
                  </Badge>
                </div>

                {job.descriptionAr && (
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {job.descriptionAr}
                  </p>
                )}

                <div className="border-t border-border/60 pt-3 flex justify-between text-xs font-semibold text-muted-foreground">
                  <span>
                    الشواغر: <strong className="text-foreground">{job.openingsCount}</strong>
                    {job.filledCount > 0 && ` (تم تعيين ${job.filledCount})`}
                  </span>
                  {(job.salaryMin || job.salaryMax) && (
                    <span className="text-primary font-mono font-bold">
                      الراتب: {job.salaryMin?.toLocaleString()} - {job.salaryMax?.toLocaleString()}{" "}
                      {job.salaryCurrency || "ر.س"}
                    </span>
                  )}
                </div>

                {/* State Control Buttons */}
                <div className="flex items-center justify-between pt-2 border-t border-border/40">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setApplicantJobId(job.id);
                      setIsApplyModalOpen(true);
                    }}
                    className="h-7 text-xs text-primary font-bold rounded-full gap-1"
                  >
                    <UserPlus className="h-3 w-3" />
                    تقديم مرشح
                  </Button>

                  <div className="flex items-center gap-1.5">
                    {job.publishedStatus !== "published" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => domain.publishJobOpening({ jobId: job.id, action: "publish" })}
                        className="h-7 text-xs text-emerald-700 border-emerald-300 rounded-full font-bold gap-1"
                      >
                        <PlayCircle className="h-3 w-3" />
                        نشر
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => domain.publishJobOpening({ jobId: job.id, action: "pause" })}
                        className="h-7 text-xs text-amber-700 border-amber-300 rounded-full font-bold gap-1"
                      >
                        <PauseCircle className="h-3 w-3" />
                        إيقاف مؤقت
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {filteredOpenings.length === 0 && (
              <div className="col-span-2 text-center py-12 border-2 border-dashed border-border/60 rounded-3xl text-xs text-muted-foreground">
                لا توجد وظائف شاغرة مطابقة للفلاتر.
              </div>
            )}
          </div>
        </TabsContent>

        {/* ========================================================================= */}
        {/* TAB 4: CANDIDATE PIPELINE (ATS) */}
        {/* ========================================================================= */}
        <TabsContent value="pipeline" className="space-y-4 pt-2">
          {/* Search, Filter & View Mode Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2">
            <div className="flex items-center gap-2 flex-1 max-w-xl">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={candidateSearch}
                  onChange={(e) => setCandidateSearch(e.target.value)}
                  placeholder="بحث باسم المرشح، الرمز CND-، الوظيفة، البريد..."
                  className="w-full h-9 rounded-full border border-border/80 bg-muted/40 pr-9 pl-4 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <select
                value={candidateJobFilter}
                onChange={(e) => setCandidateJobFilter(e.target.value)}
                className="h-9 rounded-full border border-border/80 bg-muted/40 px-3 text-xs font-medium focus:outline-none"
              >
                <option value="all">كافة الوظائف الشاغرة</option>
                {openings.map((j: JobOpeningRecord) => (
                  <option key={j.id} value={j.id}>
                    {j.titleAr} ({j.jobReference})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={viewMode === "kanban" ? "default" : "outline"}
                onClick={() => setViewMode("kanban")}
                className="rounded-full text-xs h-8 px-3"
              >
                لوحة Kanban
              </Button>
              <Button
                size="sm"
                variant={viewMode === "list" ? "default" : "outline"}
                onClick={() => setViewMode("list")}
                className="rounded-full text-xs h-8 px-3"
              >
                جدول مفصل
              </Button>
              <Button
                size="sm"
                onClick={() => setIsApplyModalOpen(true)}
                className="rounded-full text-xs bg-primary text-primary-foreground font-bold h-8 px-3.5 gap-1"
              >
                <UserPlus className="h-3 w-3" />
                إضافة متقدم
              </Button>
            </div>
          </div>

          {/* Kanban Board Container */}
          {viewMode === "kanban" ? (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 min-h-[550px] overflow-x-auto pb-4">
              {stages.map((stage) => {
                const stageCandidates = filteredCandidates.filter((c: CandidateRecord) => c.stage === stage.key);
                return (
                  <div
                    key={stage.key}
                    className="rounded-3xl border border-border/80 bg-card p-3.5 shadow-xs flex flex-col space-y-3 min-w-[210px]"
                  >
                    {/* Column Header */}
                    <div className="flex items-center justify-between border-b border-border/60 pb-2">
                      <span className="font-black text-xs text-foreground">{stage.labelAr}</span>
                      <Badge
                        variant="secondary"
                        className="text-[10px] font-mono h-5 w-5 rounded-full p-0 flex items-center justify-center font-bold"
                      >
                        {stageCandidates.length}
                      </Badge>
                    </div>

                    {/* Candidate Cards */}
                    <div className="flex-1 space-y-2.5 overflow-y-auto max-h-[550px] pr-0.5">
                      {stageCandidates.map((cand: CandidateRecord) => (
                        <div
                          key={cand.id}
                          className="rounded-2xl border border-border/70 bg-muted/20 p-3 shadow-xs space-y-2 hover:border-primary/50 transition-all"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <h4 className="font-bold text-xs text-foreground block">
                                  {cand.fullName}
                                </h4>
                              </div>
                              <span className="text-[10px] text-muted-foreground block">
                                {cand.jobTitle || "وظيفة عامة"}
                              </span>
                              {cand.candidateCode && (
                                <span className="text-[9px] font-mono text-primary block mt-0.5">
                                  {cand.candidateCode}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-0.5 text-amber-500 font-mono text-[10px] font-bold">
                              <Star className="h-3 w-3 fill-amber-500" />
                              <span>{cand.ratingScore ?? 5.0}</span>
                            </div>
                          </div>

                          <div className="space-y-1 text-[10px] text-muted-foreground font-mono">
                            <div className="flex items-center gap-1 truncate">
                              <Mail className="h-3 w-3 shrink-0" />
                              <span className="truncate">{cand.email}</span>
                            </div>
                            {cand.phone && (
                              <div className="flex items-center gap-1">
                                <Phone className="h-3 w-3 shrink-0" />
                                <span>{cand.phone}</span>
                              </div>
                            )}
                          </div>

                          {/* Action Bar per Card */}
                          <div className="flex flex-wrap items-center justify-between pt-2 border-t border-border/60 gap-1">
                            {/* CV Viewer */}
                            {(cand.cvFileId || cand.cvUrl) && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleViewCandidateCv(cand)}
                                className="h-6 text-[9px] px-1.5 rounded-full font-bold text-muted-foreground hover:text-primary gap-0.5"
                                title="عرض السيرة الذاتية"
                              >
                                <FileText className="h-3 w-3" />
                                CV
                              </Button>
                            )}

                            {/* Schedule Interview shortcut */}
                            {stage.key === "screening" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setIntCandidateId(cand.id);
                                  setIntJobId(cand.jobId || "");
                                  setIsScheduleInterviewOpen(true);
                                }}
                                className="h-6 text-[9px] px-1.5 rounded-full text-purple-600 font-bold"
                                title="جدولة مقابلة"
                              >
                                <Calendar className="h-3 w-3 mr-0.5" />
                                مقابلة
                              </Button>
                            )}

                            {/* Issue Offer Shortcut */}
                            {stage.key === "assessment" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setOfferCandidateId(cand.id);
                                  setOfferJobId(cand.jobId || "");
                                  setIsOfferModalOpen(true);
                                }}
                                className="h-6 text-[9px] px-1.5 rounded-full text-emerald-600 font-bold"
                                title="إصدار عرض عمل"
                              >
                                <DollarSign className="h-3 w-3 mr-0.5" />
                                عرض
                              </Button>
                            )}

                            {/* Progression & Actions */}
                            {stage.key !== "job_offer" && stage.key !== "hired" ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  const currentIndex = stages.findIndex((s) => s.key === stage.key);
                                  if (currentIndex < stages.length - 1) {
                                    domain.moveCandidateStage({
                                      candidateId: cand.id,
                                      newStage: stages[currentIndex + 1].key,
                                    });
                                  }
                                }}
                                className="h-6 text-[9px] text-primary font-bold px-2.5 rounded-full border-border/80 hover:bg-secondary"
                              >
                                ترقية →
                              </Button>
                            ) : stage.key === "job_offer" ? (
                              <div className="flex items-center gap-1">
                                <Button
                                  size="sm"
                                  onClick={() => handleOpenOnboarding(cand)}
                                  className="h-6 text-[9px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2 rounded-full shadow-xs"
                                  title="تعيين كموظف رسمي"
                                >
                                  تعيين كموظف
                                </Button>
                              </div>
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-[9px] text-emerald-700 bg-emerald-50 rounded-full font-bold border-emerald-200"
                              >
                                تم التعيين
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                      {stageCandidates.length === 0 && (
                        <div className="h-28 flex items-center justify-center border-2 border-dashed border-border/60 rounded-2xl text-[10px] text-muted-foreground">
                          فارغ
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* List View */
            <div className="rounded-3xl border border-border/80 bg-card overflow-hidden shadow-xs">
              <table className="w-full text-right text-xs">
                <thead className="bg-muted/40 border-b border-border/60 text-muted-foreground font-bold">
                  <tr>
                    <th className="p-3">الرمز</th>
                    <th className="p-3">الاسم بالكامل</th>
                    <th className="p-3">الوظيفة</th>
                    <th className="p-3">البريد الإلكتروني</th>
                    <th className="p-3">المرحلة</th>
                    <th className="p-3">التقييم</th>
                    <th className="p-3">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filteredCandidates.map((cand: CandidateRecord) => (
                    <tr key={cand.id} className="hover:bg-muted/20">
                      <td className="p-3 font-mono font-bold text-primary">{cand.candidateCode}</td>
                      <td className="p-3 font-bold text-foreground">{cand.fullName}</td>
                      <td className="p-3 text-muted-foreground">{cand.jobTitle || "—"}</td>
                      <td className="p-3 font-mono text-muted-foreground">{cand.email}</td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-[10px] font-bold">
                          {stages.find((s: (typeof stages)[number]) => s.key === cand.stage)?.labelAr || cand.stage}
                        </Badge>
                      </td>
                      <td className="p-3 font-mono text-amber-500 font-bold">
                        ★ {cand.ratingScore ?? 5.0}
                      </td>
                      <td className="p-3 flex items-center gap-1.5">
                        {(cand.cvFileId || cand.cvUrl) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleViewCandidateCv(cand)}
                            className="h-7 text-xs font-bold"
                          >
                            السيرة الذاتية
                          </Button>
                        )}
                        {cand.stage === "job_offer" && (
                          <Button
                            size="sm"
                            onClick={() => handleOpenOnboarding(cand)}
                            className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-full font-bold"
                          >
                            تعيين
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredCandidates.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground">
                        لا يوجد مرشحون يطابقون معايير البحث.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* ========================================================================= */}
        {/* TAB 5: INTERVIEWS & SCORECARDS */}
        {/* ========================================================================= */}
        <TabsContent value="interviews" className="space-y-4 pt-2">
          {/* Controls */}
          <div className="flex items-center justify-between bg-card p-4 rounded-3xl border border-border/80">
            <div>
              <h4 className="font-bold text-xs text-foreground">جدول المقابلات الشخصية</h4>
              <p className="text-[11px] text-muted-foreground">
                تنظيم لجان المقابلات واعتماد بطاقات التقييم الرقمية
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => setIsScheduleInterviewOpen(true)}
              className="rounded-full text-xs bg-purple-600 hover:bg-purple-700 text-white font-bold gap-1.5 h-8"
            >
              <Calendar className="h-3.5 w-3.5" />
              جدولة مقابلة جديدة
            </Button>
          </div>

          {/* Interviews Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {interviews.map((int: CandidateInterview) => (
              <div
                key={int.id}
                className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-3 hover:border-purple-300 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-black text-xs text-foreground">{int.candidateName || "مرشح"}</h4>
                    <span className="text-[10px] text-muted-foreground font-medium block">
                      {int.jobTitle || "وظيفة شاغرة"}
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-bold rounded-full ${
                      int.status === "completed"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-purple-50 text-purple-700 border-purple-200"
                    }`}
                  >
                    {int.interviewType}
                  </Badge>
                </div>

                <div className="p-2.5 rounded-2xl bg-muted/30 text-[11px] space-y-1 font-mono">
                  <div className="flex items-center gap-1.5 text-foreground">
                    <Clock className="h-3.5 w-3.5 text-purple-600" />
                    <span>{new Date(int.scheduledAt).toLocaleString("ar-SA")}</span>
                    <span className="text-muted-foreground">({int.durationMinutes} دقيقة)</span>
                  </div>
                  {int.meetingLink && (
                    <div className="flex items-center gap-1.5 text-primary truncate">
                      <Globe className="h-3.5 w-3.5" />
                      <a
                        href={int.meetingLink}
                        target="_blank"
                        rel="noreferrer"
                        className="underline truncate"
                      >
                        رابط الاجتماع
                      </a>
                    </div>
                  )}
                </div>

                {int.notes && (
                  <p className="text-[11px] text-muted-foreground italic">ملاحظة: {int.notes}</p>
                )}

                {/* Actions */}
                <div className="pt-2 border-t border-border/60 flex items-center justify-between">
                  <span className="text-[10px] font-mono text-muted-foreground">
                    الحالة: {int.status}
                  </span>
                  <Button
                    size="sm"
                    onClick={() => {
                      setSelectedInterview(int);
                      setIsScorecardOpen(true);
                    }}
                    className="h-7 text-xs bg-purple-600 hover:bg-purple-700 text-white rounded-full font-bold gap-1"
                  >
                    <Award className="h-3 w-3" />
                    بطاقة التقييم
                  </Button>
                </div>
              </div>
            ))}
            {interviews.length === 0 && (
              <div className="col-span-3 text-center py-12 border-2 border-dashed border-border/60 rounded-3xl text-xs text-muted-foreground">
                لا توجد مقابلات مجدولة حالياً.
              </div>
            )}
          </div>
        </TabsContent>

        {/* ========================================================================= */}
        {/* TAB 6: JOB OFFERS & HIRING */}
        {/* ========================================================================= */}
        <TabsContent value="offers" className="space-y-4 pt-2">
          {/* Controls */}
          <div className="flex items-center justify-between bg-card p-4 rounded-3xl border border-border/80">
            <div>
              <h4 className="font-bold text-xs text-foreground">سجل العروض الوظيفية الرسمية</h4>
              <p className="text-[11px] text-muted-foreground">
                إصدار خطابات العرض، التحكم ببنود البدلات، واعتماد التحويل لسجل الموظفين
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => setIsOfferModalOpen(true)}
              className="rounded-full text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1.5 h-8"
            >
              <Plus className="h-3.5 w-3.5" />
              إصدار عرض عمل جديد
            </Button>
          </div>

          {/* Offers Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {offers.map((off: JobOfferRecord) => (
              <div
                key={off.id}
                className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-4 hover:border-emerald-300 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-black text-sm text-foreground">{off.candidateName || "مرشح"}</h4>
                      <Badge variant="outline" className="font-mono text-[10px] font-bold">
                        {off.offerReference}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground font-medium block mt-0.5">
                      {off.jobTitle || "وظيفة شاغرة"}
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-bold rounded-full px-2.5 ${
                      off.status === "accepted"
                        ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                        : off.status === "sent"
                        ? "bg-blue-50 text-blue-700 border-blue-200"
                        : off.status === "approved"
                        ? "bg-purple-50 text-purple-700 border-purple-200"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {off.status === "accepted"
                      ? "تم قبول العرض"
                      : off.status === "sent"
                      ? "مرسل للمرشح"
                      : off.status === "approved"
                      ? "معتمد داخلياً"
                      : off.status}
                  </Badge>
                </div>

                {/* Salary Package Breakdown */}
                <div className="p-3 rounded-2xl bg-muted/20 border border-border/60 grid grid-cols-3 gap-2 text-center text-xs">
                  <div>
                    <span className="text-[10px] text-muted-foreground block">الأساسي</span>
                    <strong className="font-mono text-foreground font-black">
                      {off.basicSalary.toLocaleString()} ر.س
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block">السكن</span>
                    <strong className="font-mono text-foreground font-black">
                      {off.housingAllowance.toLocaleString()} ر.س
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block">النقل</span>
                    <strong className="font-mono text-foreground font-black">
                      {off.transportAllowance.toLocaleString()} ر.س
                    </strong>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs font-bold px-1">
                  <span className="text-muted-foreground">إجمالي الراتب الشهري:</span>
                  <span className="text-emerald-600 font-mono text-base font-black">
                    {off.totalSalary.toLocaleString()} ر.س
                  </span>
                </div>

                {/* Offer Workflow Actions */}
                <div className="pt-3 border-t border-border/60 flex items-center justify-between gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handlePrintOfferLetter(off)}
                    className="h-8 text-xs font-bold text-primary gap-1"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    طباعة العرض
                  </Button>

                  <div className="flex items-center gap-1.5">
                    {off.status === "draft" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => domain.updateOfferStatus({ offerId: off.id, action: "approve" })}
                        className="h-8 text-xs rounded-full"
                      >
                        اعتماد داخلي
                      </Button>
                    )}

                    {(off.status === "draft" || off.status === "approved") && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => domain.updateOfferStatus({ offerId: off.id, action: "send" })}
                        className="h-8 text-xs rounded-full text-blue-600 border-blue-200"
                      >
                        إرسال للمرشح
                      </Button>
                    )}

                    {off.status === "sent" && (
                      <Button
                        size="sm"
                        onClick={() => domain.updateOfferStatus({ offerId: off.id, action: "accept" })}
                        className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-full font-bold"
                      >
                        تسجيل القبول
                      </Button>
                    )}

                    {off.status === "accepted" && (
                      <Button
                        size="sm"
                        onClick={() => {
                          const cand = candidates.find((c: CandidateRecord) => c.id === off.candidateId);
                          if (cand) handleOpenOnboarding(cand);
                          else {
                            // Construct candidate object
                            handleOpenOnboarding({
                              id: off.candidateId,
                              companyId: off.companyId,
                              candidateCode: "CND-PENDING",
                              jobId: off.jobId,
                              fullName: off.candidateName || "",
                              email: "",
                              stage: "job_offer",
                              source: "website",
                              ratingScore: 5,
                              consentGiven: true,
                              isInTalentPool: false,
                              duplicateFlag: false,
                              createdAt: new Date().toISOString(),
                              updatedAt: new Date().toISOString(),
                            });
                          }
                        }}
                        className="h-8 text-xs bg-primary text-primary-foreground font-black rounded-full shadow-xs gap-1.5"
                      >
                        <UserCheck className="h-3.5 w-3.5" />
                        تعيين كموظف رسمي
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {offers.length === 0 && (
              <div className="col-span-2 text-center py-12 border-2 border-dashed border-border/60 rounded-3xl text-xs text-muted-foreground">
                لا توجد عروض وظيفية مصدرة حالياً.
              </div>
            )}
          </div>
        </TabsContent>

        {/* ========================================================================= */}
        {/* TAB 7: TALENT POOL */}
        {/* ========================================================================= */}
        <TabsContent value="talent_pool" className="space-y-4 pt-2">
          {/* Controls */}
          <div className="flex items-center justify-between bg-card p-4 rounded-3xl border border-border/80">
            <div>
              <h4 className="font-bold text-xs text-foreground">بنك الكفاءات والمواهب (Talent Pool)</h4>
              <p className="text-[11px] text-muted-foreground">
                الاحتفاظ ببيانات المرشحين المتميزين وفق سياسات حماية البيانات ومدد الاستبقاء المعتمدة
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => setIsTalentPoolModalOpen(true)}
              className="rounded-full text-xs bg-amber-500 hover:bg-amber-600 text-white font-bold gap-1.5 h-8"
            >
              <Plus className="h-3.5 w-3.5" />
              إضافة كفاءة للبنك
            </Button>
          </div>

          {/* Talent Pool Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {talentPool.map((tp: TalentPoolEntry) => (
              <div
                key={tp.id}
                className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-3 hover:border-amber-400 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-black text-xs text-foreground">{tp.candidateName || "مرشح"}</h4>
                    <span className="text-[10px] text-muted-foreground font-mono block">
                      {tp.candidateCode}
                    </span>
                  </div>
                  <Badge variant="outline" className="text-[9px] font-bold bg-amber-50 text-amber-700 border-amber-200">
                    كفاءة مستبقاة
                  </Badge>
                </div>

                {tp.skills && tp.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {tp.skills.map((skill: string, idx: number) => (
                      <span
                        key={idx}
                        className="text-[9px] bg-secondary text-primary font-bold px-2 py-0.5 rounded-full"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                )}

                {tp.notes && <p className="text-xs text-muted-foreground">{tp.notes}</p>}

                <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                  <span>الاحتفاظ حتى:</span>
                  <span className="font-bold text-foreground">
                    {tp.retentionUntil ? new Date(tp.retentionUntil).toLocaleDateString("ar-SA") : "سنة واحدة"}
                  </span>
                </div>
              </div>
            ))}
            {talentPool.length === 0 && (
              <div className="col-span-3 text-center py-12 border-2 border-dashed border-border/60 rounded-3xl text-xs text-muted-foreground">
                بنك المواهب فارغ حالياً. يمكنك إضافة كفاءات عبر زر الإضافة بالأعلى.
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ========================================================================= */}
      {/* MODAL 1: CREATE REQUISITION */}
      {/* ========================================================================= */}
      <Dialog open={isRequisitionModalOpen} onOpenChange={setIsRequisitionModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <FileText className="h-5 w-5 text-indigo-600" />
              طلب احتياج وظيفي جديد
            </DialogTitle>
            <DialogDescription className="text-xs font-medium">
              إنشاء وتوثيق طلب توظيف جديد تمهيداً لاعتماده وتخصيص ميزانية الشواغر
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs py-2">
            <div className="space-y-1.5">
              <label className="font-bold">المسمى الوظيفي المطلوب (بالعربية) *</label>
              <input
                type="text"
                value={newReq.titleAr}
                onChange={(e) => setNewReq({ ...newReq, titleAr: e.target.value })}
                placeholder="مثال: مهندس أول نظم معلومات"
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="font-bold">الإدارة / القسم *</label>
                <select
                  value={newReq.departmentId}
                  onChange={(e) => setNewReq({ ...newReq, departmentId: e.target.value })}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none"
                >
                  <option value="">اختر الإدارة</option>
                  {orgUnits.map((u: OrgUnit) => (
                    <option key={u.id} value={u.id}>
                      {u.nameAr}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold">عدد الشواغر *</label>
                <input
                  type="number"
                  min={1}
                  value={newReq.openingsCount}
                  onChange={(e) => setNewReq({ ...newReq, openingsCount: Number(e.target.value) || 1 })}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="font-bold">الحد الأدنى للراتب (اختياري)</label>
                <input
                  type="number"
                  value={newReq.salaryMin}
                  onChange={(e) => setNewReq({ ...newReq, salaryMin: e.target.value })}
                  placeholder="ر.س"
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-bold">الحد الأعلى للراتب (اختياري)</label>
                <input
                  type="number"
                  value={newReq.salaryMax}
                  onChange={(e) => setNewReq({ ...newReq, salaryMax: e.target.value })}
                  placeholder="ر.س"
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold">المبرر الوظيفي / خطة الاستقطاب</label>
              <textarea
                value={newReq.justification}
                onChange={(e) => setNewReq({ ...newReq, justification: e.target.value })}
                placeholder="أسباب طلب الشاغر والمهام المستهدفة..."
                className="w-full h-20 rounded-2xl border border-border/80 bg-muted/40 p-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
              />
            </div>
          </div>

          <DialogFooter className="mt-3">
            <Button
              size="sm"
              onClick={handleCreateRequisition}
              className="rounded-full text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 h-9"
            >
              حفظ طلب الاحتياج
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL 2: CREATE JOB OPENING */}
      {/* ========================================================================= */}
      <Dialog open={isAddJobOpen} onOpenChange={setIsAddJobOpen}>
        <DialogContent className="max-w-lg rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-primary" />
              إضافة وظيفة شاغرة جديدة
            </DialogTitle>
            <DialogDescription className="text-xs font-medium">
              فتح وظيفة في بوابة التوظيف مع تحديد الشواغر والموقع دون أي بيانات افتراضية وهمية
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs py-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="font-bold">المسمى بالعربية *</label>
                <input
                  type="text"
                  value={newJob.titleAr}
                  onChange={(e) => setNewJob({ ...newJob, titleAr: e.target.value })}
                  placeholder="مثال: مطور واجهات أمامية"
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-bold">المسمى بالإنجليزية</label>
                <input
                  type="text"
                  value={newJob.titleEn}
                  onChange={(e) => setNewJob({ ...newJob, titleEn: e.target.value })}
                  placeholder="e.g. Frontend Engineer"
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="font-bold">الإدارة / القسم *</label>
                <select
                  value={newJob.departmentId}
                  onChange={(e) => setNewJob({ ...newJob, departmentId: e.target.value })}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none"
                >
                  <option value="">اختر الإدارة</option>
                  {orgUnits.map((u: OrgUnit) => (
                    <option key={u.id} value={u.id}>
                      {u.nameAr}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="font-bold">مقر العمل</label>
                <select
                  value={newJob.locationId}
                  onChange={(e) => setNewJob({ ...newJob, locationId: e.target.value })}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none"
                >
                  <option value="">اختر المقر</option>
                  {workLocations.map((w: WorkLocation) => (
                    <option key={w.id} value={w.id}>
                      {w.nameAr}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5">
                <label className="font-bold">عدد الشواغر *</label>
                <input
                  type="number"
                  min={1}
                  value={newJob.openingsCount}
                  onChange={(e) => setNewJob({ ...newJob, openingsCount: Number(e.target.value) || 1 })}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-bold">الحد الأدنى (ر.س)</label>
                <input
                  type="number"
                  value={newJob.salaryMin}
                  onChange={(e) => setNewJob({ ...newJob, salaryMin: e.target.value })}
                  placeholder="مثال: 8000"
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-bold">الحد الأعلى (ر.س)</label>
                <input
                  type="number"
                  value={newJob.salaryMax}
                  onChange={(e) => setNewJob({ ...newJob, salaryMax: e.target.value })}
                  placeholder="مثال: 12000"
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold">الوصف والمتطلبات</label>
              <textarea
                value={newJob.descriptionAr}
                onChange={(e) => setNewJob({ ...newJob, descriptionAr: e.target.value })}
                placeholder="تفاصيل الوظيفة والشروط المطلوبة للتقديم..."
                className="w-full h-20 rounded-2xl border border-border/80 bg-muted/40 p-3 text-xs focus:bg-card focus:outline-none resize-none"
              />
            </div>
          </div>

          <DialogFooter className="mt-3">
            <Button
              size="sm"
              onClick={handleCreateJobOpening}
              className="rounded-full text-xs bg-primary text-primary-foreground font-bold px-5 h-9"
            >
              حفظ ونشر الوظيفة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL 3: APPLY CANDIDATE */}
      {/* ========================================================================= */}
      <Dialog open={isApplyModalOpen} onOpenChange={setIsApplyModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              تقديم طلب مرشح جديد
            </DialogTitle>
            <DialogDescription className="text-xs font-medium">
              تسجيل بيانات المتقدم وإدراج السيرة الذاتية في الفرز الأولي لنظام الـ ATS
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs py-2">
            <div className="space-y-1.5">
              <label className="font-bold">الوظيفة المستهدفة *</label>
              <select
                value={applicantJobId}
                onChange={(e) => setApplicantJobId(e.target.value)}
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none"
              >
                <option value="">اختر الوظيفة الشاغرة</option>
                {openings.map((j: JobOpeningRecord) => (
                  <option key={j.id} value={j.id}>
                    {j.titleAr} ({j.jobReference})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold">الاسم بالكامل *</label>
              <input
                type="text"
                value={applicantName}
                onChange={(e) => setApplicantName(e.target.value)}
                placeholder="مثال: فيصل العبداللطيف"
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="font-bold">البريد الإلكتروني *</label>
                <input
                  type="email"
                  value={applicantEmail}
                  onChange={(e) => setApplicantEmail(e.target.value)}
                  placeholder="candidate@example.com"
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-bold">رقم الجوال</label>
                <input
                  type="text"
                  value={applicantPhone}
                  onChange={(e) => setApplicantPhone(e.target.value)}
                  placeholder="05XXXXXXXX"
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="font-bold">رقم الهوية / الإقامة</label>
                <input
                  type="text"
                  value={applicantNationalId}
                  onChange={(e) => setApplicantNationalId(e.target.value)}
                  placeholder="اختياري"
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-bold">مصدر التقديم</label>
                <select
                  value={applicantSource}
                  onChange={(e) => setApplicantSource(e.target.value)}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none"
                >
                  <option value="website">الموقع الإلكتروني</option>
                  <option value="linkedin">LinkedIn</option>
                  <option value="referral">توصية داخلية</option>
                  <option value="agency">وكالة توظيف</option>
                  <option value="direct">تقديم مباشر</option>
                </select>
              </div>
            </div>

            {/* CV Upload */}
            <div className="space-y-1.5">
              <label className="font-bold">السيرة الذاتية (CV / Resume)</label>
              <input
                ref={cvInputRef}
                type="file"
                accept=".pdf,.doc,.docx"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    if (file.size > 15 * 1024 * 1024) {
                      toast.error("حجم الملف يتجاوز الحد الأقصى (15 ميجابايت)");
                      return;
                    }
                    setCvFile(file);
                  }
                }}
              />
              {cvFile ? (
                <div className="flex items-center justify-between p-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/5">
                  <div className="flex items-center gap-2 truncate">
                    <FileText className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span className="text-xs font-bold truncate text-foreground">
                      {cvFile.name}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                      ({(cvFile.size / 1024).toFixed(0)} KB)
                    </span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setCvFile(null);
                      if (cvInputRef.current) cvInputRef.current.value = "";
                    }}
                    className="h-6 w-6 p-0 rounded-full text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <div
                  onClick={() => cvInputRef.current?.click()}
                  className="border-2 border-dashed border-emerald-500/30 rounded-2xl p-4 text-center text-muted-foreground hover:bg-secondary/30 cursor-pointer transition-colors"
                >
                  <Upload className="mx-auto h-6 w-6 mb-1 text-emerald-600" />
                  <span className="text-[11px] font-bold text-foreground block">
                    اضغط هنا لإرفاق السيرة الذاتية
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    PDF, DOC, DOCX حتى 15MB
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="consentCheck"
                checked={applicantConsent}
                onChange={(e) => setApplicantConsent(e.target.checked)}
                className="h-4 w-4 rounded border-border/80 text-primary"
              />
              <label htmlFor="consentCheck" className="text-[11px] text-muted-foreground">
                الموافقة على معالجة البيانات وفق نظام حماية البيانات الشخصية
              </label>
            </div>
          </div>

          <DialogFooter className="mt-3">
            <Button
              size="sm"
              onClick={handleApplyCandidate}
              className="rounded-full text-xs bg-primary text-primary-foreground font-bold px-5 h-9"
            >
              إرسال طلب التقديم
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL 4: SCHEDULE INTERVIEW */}
      {/* ========================================================================= */}
      <Dialog open={isScheduleInterviewOpen} onOpenChange={setIsScheduleInterviewOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Calendar className="h-5 w-5 text-purple-600" />
              جدولة مقابلة شخصية
            </DialogTitle>
            <DialogDescription className="text-xs font-medium">
              تحديد موعد المقابلة، نوع التقييم، وتوليد إشعار لجنة المقابلات
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs py-2">
            <div className="space-y-1.5">
              <label className="font-bold">المرشح المستهدف *</label>
              <select
                value={intCandidateId}
                onChange={(e) => {
                  setIntCandidateId(e.target.value);
                  const c = candidates.find((cand: CandidateRecord) => cand.id === e.target.value);
                  if (c?.jobId) setIntJobId(c.jobId);
                }}
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none"
              >
                <option value="">اختر المرشح</option>
                {candidates.map((c: CandidateRecord) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName} ({c.candidateCode || c.jobTitle})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="font-bold">نوع المقابلة</label>
                <select
                  value={intType}
                  onChange={(e) => setIntType(e.target.value)}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none"
                >
                  <option value="screening">فحص أولي (Screening)</option>
                  <option value="technical">مقابلة فنية (Technical)</option>
                  <option value="hr">مقابلة موارد بشرية (HR)</option>
                  <option value="cultural">توافق ثقافي (Culture)</option>
                  <option value="executive">مقابلة قيادية (Executive)</option>
                  <option value="final">مقابلة نهائية (Final)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold">المدة (بالدقائق)</label>
                <input
                  type="number"
                  value={intDurationMinutes}
                  onChange={(e) => setIntDurationMinutes(Number(e.target.value) || 45)}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold">موعد وتوقيت المقابلة *</label>
              <input
                type="datetime-local"
                value={intScheduledAt}
                onChange={(e) => setIntScheduledAt(e.target.value)}
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold">رابط الاجتماع / موقع المقابلة</label>
              <input
                type="text"
                value={intMeetingLink}
                onChange={(e) => setIntMeetingLink(e.target.value)}
                placeholder="رابط Google Meet / Teams أو رقم القاعة"
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold">ملاحظات للجنة المقابلات</label>
              <textarea
                value={intNotes}
                onChange={(e) => setIntNotes(e.target.value)}
                placeholder="محاور التقييم والمجالات المطلوب التركيز عليها..."
                className="w-full h-16 rounded-2xl border border-border/80 bg-muted/40 p-3 text-xs focus:bg-card focus:outline-none resize-none"
              />
            </div>
          </div>

          <DialogFooter className="mt-3">
            <Button
              size="sm"
              onClick={handleScheduleInterview}
              className="rounded-full text-xs bg-purple-600 hover:bg-purple-700 text-white font-bold px-5 h-9"
            >
              تأكيد جدولة المقابلة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL 5: INTERVIEW SCORECARD */}
      {/* ========================================================================= */}
      {selectedInterview && (
        <Dialog open={isScorecardOpen} onOpenChange={setIsScorecardOpen}>
          <DialogContent className="max-w-md rounded-3xl p-6">
            <DialogHeader>
              <DialogTitle className="text-base font-black flex items-center gap-2">
                <Award className="h-5 w-5 text-purple-600" />
                بطاقة تقييم المقابلة الشخصية (Scorecard)
              </DialogTitle>
              <DialogDescription className="text-xs font-medium">
                تقييم المرشح: {selectedInterview.candidateName || "مرشح"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3.5 text-xs py-2">
              <div className="space-y-1.5">
                <label className="font-bold">التوصية النهائية *</label>
                <select
                  value={scoreRecommendation}
                  onChange={(e) => setScoreRecommendation(e.target.value as ScorecardRecommendation)}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-bold focus:bg-card focus:outline-none"
                >
                  <option value="strong_hire">توصية قوية بالتعيين (Strong Hire)</option>
                  <option value="hire">يوصى بالتعيين (Hire)</option>
                  <option value="neutral">محايد / إعادة تقييم (Neutral)</option>
                  <option value="reject">عدم التوصية بالتعيين (Reject)</option>
                  <option value="strong_reject">رفض تام (Strong Reject)</option>
                </select>
              </div>

              {/* Criteria Scores */}
              <div className="space-y-2 p-3 rounded-2xl bg-muted/20 border border-border/60">
                <div className="flex items-center justify-between">
                  <span className="font-bold">المهارات الفنية (35%)</span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setTechScore(val)}
                        className={`h-6 w-6 rounded-full text-xs font-mono font-bold ${
                          techScore >= val ? "bg-amber-400 text-amber-950" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="font-bold">مهارات التواصل (25%)</span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setCommScore(val)}
                        className={`h-6 w-6 rounded-full text-xs font-mono font-bold ${
                          commScore >= val ? "bg-amber-400 text-amber-950" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="font-bold">التوافق الثقافي (20%)</span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setCultureScore(val)}
                        className={`h-6 w-6 rounded-full text-xs font-mono font-bold ${
                          cultureScore >= val ? "bg-amber-400 text-amber-950" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="font-bold">حل المشكلات (20%)</span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setProblemSolvingScore(val)}
                        className={`h-6 w-6 rounded-full text-xs font-mono font-bold ${
                          problemSolvingScore >= val
                            ? "bg-amber-400 text-amber-950"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold">أبرز نقاط القوة</label>
                <textarea
                  value={scoreStrengths}
                  onChange={(e) => setScoreStrengths(e.target.value)}
                  placeholder="المهام والمميزات التي برز فيها المرشح..."
                  className="w-full h-14 rounded-2xl border border-border/80 bg-muted/40 p-2.5 text-xs focus:bg-card focus:outline-none resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold">النقاط التي تحتاج تطوير</label>
                <textarea
                  value={scoreWeaknesses}
                  onChange={(e) => setScoreWeaknesses(e.target.value)}
                  placeholder="المجالات أو المتطلبات التي تحتاج تدريب..."
                  className="w-full h-14 rounded-2xl border border-border/80 bg-muted/40 p-2.5 text-xs focus:bg-card focus:outline-none resize-none"
                />
              </div>
            </div>

            <DialogFooter className="mt-3">
              <Button
                size="sm"
                onClick={handleSubmitScorecard}
                className="rounded-full text-xs bg-purple-600 hover:bg-purple-700 text-white font-bold px-5 h-9"
              >
                اعتماد وتثبيت التقييم
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ========================================================================= */}
      {/* MODAL 6: CREATE / ISSUE JOB OFFER */}
      {/* ========================================================================= */}
      <Dialog open={isOfferModalOpen} onOpenChange={setIsOfferModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-emerald-600" />
              إصدار عرض عمل رسمي
            </DialogTitle>
            <DialogDescription className="text-xs font-medium">
              تحديد تفاصيل الراتب والبدلات وتوليد العرض الوظيفي الرسمي للمرشح
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs py-2">
            <div className="space-y-1.5">
              <label className="font-bold">المرشح المستهدف *</label>
              <select
                value={offerCandidateId}
                onChange={(e) => {
                  setOfferCandidateId(e.target.value);
                  const c = candidates.find((cand: CandidateRecord) => cand.id === e.target.value);
                  if (c?.jobId) setOfferJobId(c.jobId);
                }}
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none"
              >
                <option value="">اختر المرشح</option>
                {candidates.map((c: CandidateRecord) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName} ({c.jobTitle || "وظيفة"})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold">الراتب الأساسي (ر.س) *</label>
              <input
                type="number"
                value={offerBasic || ""}
                onChange={(e) => setOfferBasic(Number(e.target.value) || 0)}
                placeholder="أدخل الراتب الأساسي"
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="font-bold">بدل السكن (ر.س)</label>
                <input
                  type="number"
                  value={offerHousing || ""}
                  onChange={(e) => setOfferHousing(Number(e.target.value) || 0)}
                  placeholder="بدل السكن"
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-bold">بدل النقل (ر.س)</label>
                <input
                  type="number"
                  value={offerTransport || ""}
                  onChange={(e) => setOfferTransport(Number(e.target.value) || 0)}
                  placeholder="بدل النقل"
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-50/50 p-3.5 flex justify-between items-center font-bold text-emerald-800">
              <span>إجمالي العرض الشهري:</span>
              <span className="font-mono text-base font-black">
                {(offerBasic + offerHousing + offerTransport + offerOther).toLocaleString()} ر.س
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="font-bold">تاريخ المباشرة المقترح</label>
                <input
                  type="date"
                  value={offerStartDate}
                  onChange={(e) => setOfferStartDate(e.target.value)}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-bold">تاريخ انتهاء صلاحية العرض</label>
                <input
                  type="date"
                  value={offerExpiryDate}
                  onChange={(e) => setOfferExpiryDate(e.target.value)}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold flex items-center gap-1.5">
                <Upload className="h-3.5 w-3.5 text-primary" />
                مرفق خطاب العرض الرسمي (اختياري - PDF / صورة)
              </label>
              <input
                ref={offerFileInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => setOfferFile(e.target.files?.[0] || null)}
                className="w-full text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
              />
            </div>
          </div>

          <DialogFooter className="mt-3">
            <Button
              size="sm"
              onClick={handleCreateOffer}
              className="rounded-full text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 h-9"
            >
              إصدار العرض الوظيفي
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL 7: ONBOARDING WIZARD (CONVERT CANDIDATE TO EMPLOYEE) */}
      {/* ========================================================================= */}
      {candidateToHire && (
        <Dialog
          open={isOnboardingModalOpen}
          onOpenChange={(open) => {
            if (!isConvertingCandidate) setIsOnboardingModalOpen(open);
          }}
        >
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl p-6">
            <DialogHeader>
              <DialogTitle className="text-base font-black flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-emerald-600" />
                تعيين المرشح وإدراجه في سجل الموظفين
              </DialogTitle>
              <DialogDescription className="text-xs font-medium">
                تحويل المرشح ({candidateToHire.fullName}) إلى مسودة موظف برقم وظيفي رسمي متسلسل
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3.5 text-xs py-2">
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1.5 font-bold">
                  الاسم الأول بالعربية *
                  <input
                    value={onboardFirstName}
                    onChange={(e) => setOnboardFirstName(e.target.value)}
                    className="w-full h-9 rounded-xl border border-border/80 px-3 text-xs"
                  />
                </label>
                <label className="space-y-1.5 font-bold">
                  اسم العائلة بالعربية *
                  <input
                    value={onboardLastName}
                    onChange={(e) => setOnboardLastName(e.target.value)}
                    className="w-full h-9 rounded-xl border border-border/80 px-3 text-xs"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <label className="font-bold">تاريخ المباشرة الرسمي *</label>
                  <input
                    type="date"
                    value={onboardStartDate}
                    onChange={(e) => setOnboardStartDate(e.target.value)}
                    className="w-full h-9 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none"
                  />
                </div>
                <div className="rounded-2xl border border-border/60 bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground flex items-center">
                  <span>الرقم الوظيفي يُولّد تلقائياً وبشكل تسلسلي EMP-YYYY-NNNN</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <label className="font-bold">الإدارة / القسم *</label>
                  <select
                    value={onboardDeptId}
                    onChange={(e) => setOnboardDeptId(e.target.value)}
                    className="w-full h-9 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none"
                  >
                    <option value="">اختر القسم</option>
                    {orgUnits.map((u: OrgUnit) => (
                      <option key={u.id} value={u.id}>
                        {u.nameAr}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="font-bold">مقر العمل *</label>
                  <select
                    value={onboardLocationId}
                    onChange={(e) => setOnboardLocationId(e.target.value)}
                    className="w-full h-9 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none"
                  >
                    <option value="">اختر مقر العمل</option>
                    {workLocations.map((w: WorkLocation) => (
                      <option key={w.id} value={w.id}>
                        {w.nameAr}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <label className="font-bold">نوع العقد *</label>
                  <select
                    value={onboardContractType}
                    onChange={(e) => setOnboardContractType(e.target.value as ContractType)}
                    className="w-full h-9 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs"
                  >
                    <option value="full_time">دوام كامل</option>
                    <option value="part_time">دوام جزئي</option>
                    <option value="contractor">متعاقد</option>
                    <option value="seasonal">موسمي</option>
                    <option value="internship">متدرب</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="font-bold">نمط العمل *</label>
                  <select
                    value={onboardWorkType}
                    onChange={(e) => setOnboardWorkType(e.target.value as WorkType)}
                    className="w-full h-9 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs"
                  >
                    <option value="full_time">حضوري في المقر</option>
                    <option value="part_time">عن بُعد</option>
                    <option value="contract">هجين</option>
                  </select>
                </div>
              </div>

              {canSetFinancialData && (
                <div className="p-3 rounded-2xl border border-emerald-500/30 bg-emerald-50/20 space-y-2">
                  <span className="font-black text-xs text-foreground block">
                    البيانات المالية التعاقدية (ر.س)
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] text-muted-foreground block">الأساسي</label>
                      <input
                        type="number"
                        value={onboardBasic}
                        onChange={(e) => setOnboardBasic(Number(e.target.value) || 0)}
                        className="w-full h-8 rounded-xl border border-border/80 px-2 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground block">بدل السكن</label>
                      <input
                        type="number"
                        value={onboardHousing}
                        onChange={(e) => setOnboardHousing(Number(e.target.value) || 0)}
                        className="w-full h-8 rounded-xl border border-border/80 px-2 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground block">بدل النقل</label>
                      <input
                        type="number"
                        value={onboardTransport}
                        onChange={(e) => setOnboardTransport(Number(e.target.value) || 0)}
                        className="w-full h-8 rounded-xl border border-border/80 px-2 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="mt-3">
              <Button
                size="sm"
                onClick={handleCompleteOnboarding}
                disabled={isConvertingCandidate}
                className="rounded-full text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 h-9"
              >
                {isConvertingCandidate ? "جاري إنشاء الموظف..." : "تأكيد التعيين وإدراج الموظف"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ========================================================================= */}
      {/* MODAL 8: ADD TO TALENT POOL */}
      {/* ========================================================================= */}
      <Dialog open={isTalentPoolModalOpen} onOpenChange={setIsTalentPoolModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500" />
              إضافة كفاءة لبنك المواهب
            </DialogTitle>
            <DialogDescription className="text-xs font-medium">
              الاحتفاظ ببيانات المرشح وتصنيف مهاراته لفرص العمل المستقبلية
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs py-2">
            <div className="space-y-1.5">
              <label className="font-bold">المرشح المستهدف *</label>
              <select
                value={talentCandidateId}
                onChange={(e) => setTalentCandidateId(e.target.value)}
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none"
              >
                <option value="">اختر المرشح</option>
                {candidates.map((c: CandidateRecord) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName} ({c.jobTitle || "مرشح"})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold">المهارات والتخصصات (مفصولة بفاصلة)</label>
              <input
                type="text"
                value={talentSkills}
                onChange={(e) => setTalentSkills(e.target.value)}
                placeholder="مثال: React, TypeScript, إدارة المشاريع, PMP"
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold">مدة الاحتفاظ بالبيانات</label>
              <select
                value={talentRetentionMonths}
                onChange={(e) => setTalentRetentionMonths(Number(e.target.value))}
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none"
              >
                <option value={6}>6 أشهر</option>
                <option value={12}>سنة واحدة (الافتراضي)</option>
                <option value={24}>سنتان</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold">ملاحظات وتقييم عام</label>
              <textarea
                value={talentNotes}
                onChange={(e) => setTalentNotes(e.target.value)}
                placeholder="ملاحظات حول مؤهلات المرشح وأنسب المناصب له..."
                className="w-full h-16 rounded-2xl border border-border/80 bg-muted/40 p-3 text-xs focus:bg-card focus:outline-none resize-none"
              />
            </div>
          </div>

          <DialogFooter className="mt-3">
            <Button
              size="sm"
              onClick={handleAddToTalentPool}
              className="rounded-full text-xs bg-amber-500 hover:bg-amber-600 text-white font-bold px-5 h-9"
            >
              حفظ في بنك المواهب
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL 9: PRINT OFFICIAL OFFER LETTER */}
      {/* ========================================================================= */}
      {offerToPrint && (
        <Dialog open={Boolean(offerToPrint)} onOpenChange={() => setOfferToPrint(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl p-8 print:p-0">
            <div className="space-y-6 text-foreground print:text-black">
              {/* Header Letterhead */}
              <div className="flex items-center justify-between border-b-2 border-primary/20 pb-4">
                <div>
                  <h2 className="text-xl font-black text-primary">
                    {company?.legalNameAr || "شركة فوكس للحلول المتطورة"}
                  </h2>
                  <p className="text-xs text-muted-foreground font-mono">
                    سجل تجاري: {company?.crNumber || "1010000000"}
                  </p>
                </div>
                <div className="text-left font-mono text-xs text-muted-foreground">
                  <div>الرقم المرجعي: {offerToPrint.offerCode}</div>
                  <div>التاريخ: {new Date(offerToPrint.createdAt).toLocaleDateString("ar-SA")}</div>
                </div>
              </div>

              {/* Offer Title */}
              <div className="text-center py-2">
                <h3 className="text-lg font-black underline underline-offset-8">
                  خطاب عرض وظيفي رسمي (Job Offer Letter)
                </h3>
              </div>

              {/* Salutation & Body */}
              <div className="space-y-3 text-xs leading-relaxed">
                <p>
                  السيد / المحترم: <strong>{offerToPrint.candidateName || "المرشح"}</strong>،
                </p>
                <p>
                  يسر إدارة <strong>{company?.legalNameAr || "الشركة"}</strong> أن تقدم لكم هذا العرض
                  للانضمام إلى فريق عملنا لشغل وظيفة <strong>{offerToPrint.jobTitle || "الوظيفة"}</strong>،
                  وذلك وفق الحزمة المالية والمزايا التعاقدية التالية:
                </p>
              </div>

              {/* Compensation Table */}
              <div className="rounded-2xl border border-border/80 overflow-hidden text-xs">
                <table className="w-full text-right">
                  <thead className="bg-muted/40 font-bold border-b border-border/80">
                    <tr>
                      <th className="p-2.5">البند التعاقدي</th>
                      <th className="p-2.5">المبلغ الشهري (بالريال السعودي)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 font-mono">
                    <tr>
                      <td className="p-2.5 font-bold">الراتب الأساسي</td>
                      <td className="p-2.5">{offerToPrint.basicSalary.toLocaleString()} ر.س</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-bold">بدل السكن</td>
                      <td className="p-2.5">{offerToPrint.housingAllowance.toLocaleString()} ر.س</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-bold">بدل النقل</td>
                      <td className="p-2.5">{offerToPrint.transportAllowance.toLocaleString()} ر.س</td>
                    </tr>
                    <tr className="bg-secondary/40 font-bold text-primary">
                      <td className="p-2.5">إجمالي الأجر الشهري</td>
                      <td className="p-2.5 text-sm font-black">
                        {offerToPrint.totalSalary.toLocaleString()} ر.س
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Terms & Conditions */}
              <div className="space-y-2 text-[11px] text-muted-foreground leading-relaxed border-t border-border/60 pt-4">
                <h4 className="font-bold text-foreground">الشروط والأحكام العامة:</h4>
                <ul className="list-disc pr-4 space-y-1">
                  <li>يخضع هذا العرض لأحكام نظام العمل السعودي ولائحته التنفيذية.</li>
                  <li>يخضع الموظف لفترة تجربة نظامية مدتها 90 يوماً قابلة للتمديد وفق النظام.</li>
                  {offerToPrint.proposedStartDate && (
                    <li>تاريخ المباشرة المتوقع: {offerToPrint.proposedStartDate}.</li>
                  )}
                  {offerToPrint.expiryDate && (
                    <li>ينتهي هذا العرض بتاريخ: {offerToPrint.expiryDate}.</li>
                  )}
                </ul>
              </div>

              {/* Signature Blocks */}
              <div className="grid grid-cols-2 gap-8 pt-8 border-t border-border/60 text-xs">
                <div className="space-y-10">
                  <span className="font-bold block">توقيع ممثل الشركة / الموارد البشرية:</span>
                  <div className="border-b border-muted-foreground/40 w-48" />
                </div>
                <div className="space-y-10">
                  <span className="font-bold block">موافقة وقبول المرشح:</span>
                  <div className="border-b border-muted-foreground/40 w-48" />
                </div>
              </div>
            </div>

            <DialogFooter className="mt-6 print:hidden">
              <Button
                size="sm"
                onClick={() => window.print()}
                className="rounded-full text-xs bg-primary text-primary-foreground font-bold px-6 h-9 gap-1.5"
              >
                <Printer className="h-4 w-4" />
                طباعة الخطاب
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
