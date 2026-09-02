import React, { useEffect, useState, useMemo } from "react";
import { useApp } from "../../lib/context/AppContext";
import type { Candidate, CandidateStage } from "../../types";
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
  Sparkles,
  UserCheck,
  Printer,
  Search,
  Filter,
  ShieldCheck,
  Building2,
  ArrowRight,
} from "lucide-react";
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
}

export const RecruitmentView: React.FC<RecruitmentViewProps> = ({ section = "ats" }) => {
  const {
    jobOpenings,
    candidates,
    workforcePlans,
    orgUnits,
    workLocations,
    subsidiaries,
    company,
    currentRole,
    addJobOpening,
    addCandidate,
    updateCandidateScore,
    moveCandidateStage,
    sendJobOffer,
    addEmployee,
    openEmployeeProfile,
    language,
    t,
  } = useApp();

  const [activeTab, setActiveTab] = useState(section === "ats" ? "pipeline" : "workforce");

  // Selected Candidate for actions
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [candidateToHire, setCandidateToHire] = useState<Candidate | null>(null);
  const [offerCandidateToPrint, setOfferCandidateToPrint] = useState<Candidate | null>(null);

  // Filter in Kanban
  const [candidateSearch, setCandidateSearch] = useState("");
  const [candidateJobFilter, setCandidateJobFilter] = useState("all");

  // Modals
  const [isOfferModalOpen, setIsOfferModalOpen] = useState(false);
  const [isAddJobOpen, setIsAddJobOpen] = useState(false);
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [isScorecardOpen, setIsScorecardOpen] = useState(false);
  const [isOnboardingModalOpen, setIsOnboardingModalOpen] = useState(false);

  // New Job Opening State
  const [newJob, setNewJob] = useState({
    titleAr: "",
    titleEn: "",
    departmentId: orgUnits[0]?.id || "",
    openingsCount: 1,
    salaryMin: 12000,
    salaryMax: 18000,
    descriptionAr: "",
  });

  // Apply State
  const [applyingJob, setApplyingJob] = useState(jobOpenings[0]);
  const [applicantName, setApplicantName] = useState("");
  const [applicantEmail, setApplicantEmail] = useState("");
  const [applicantPhone, setApplicantPhone] = useState("");

  // Offer State
  const [offerBasic, setOfferBasic] = useState(16000);
  const [offerHousing, setOfferHousing] = useState(4000);
  const [offerTransport, setOfferTransport] = useState(1000);
  const [offerStartDate, setOfferStartDate] = useState("2026-10-01");

  // Onboarding (Convert to Employee) State
  const [onboardEmpNo, setOnboardEmpNo] = useState("");
  const [onboardDeptId, setOnboardDeptId] = useState(orgUnits[0]?.id || "");
  const [onboardLocationId, setOnboardLocationId] = useState(workLocations[0]?.id || "");
  const [onboardBasic, setOnboardBasic] = useState(15000);
  const [onboardHousing, setOnboardHousing] = useState(3750);
  const [onboardTransport, setOnboardTransport] = useState(1000);
  const [onboardStartDate, setOnboardStartDate] = useState(new Date().toISOString().slice(0, 10));

  // Scorecard State
  const [techRating, setTechRating] = useState(5);
  const [commRating, setCommRating] = useState(4);
  const [evalNotes, setEvalNotes] = useState("");

  const canManageRecruitment = ["super_admin", "hr_manager", "recruiter"].includes(currentRole);

  useEffect(() => {
    setActiveTab(section === "ats" ? "pipeline" : "workforce");
  }, [section]);

  const stages: { key: CandidateStage; labelAr: string; color: string }[] = [
    { key: "applied", labelAr: "مقدم جديد", color: "border-blue-300" },
    { key: "screening", labelAr: "الفرز والتدقيق", color: "border-amber-300" },
    { key: "interview", labelAr: "المقابلة الشخصية", color: "border-purple-300" },
    { key: "assessment", labelAr: "التقييم الفني", color: "border-indigo-300" },
    { key: "job_offer", labelAr: "العرض الوظيفي", color: "border-emerald-300" },
    { key: "hired", labelAr: "تم التعيين", color: "border-emerald-600" },
  ];

  const filteredCandidates = useMemo(() => {
    return candidates.filter((c) => {
      const matchesSearch =
        c.fullName.toLowerCase().includes(candidateSearch.toLowerCase()) ||
        c.email.toLowerCase().includes(candidateSearch.toLowerCase()) ||
        c.jobTitle.toLowerCase().includes(candidateSearch.toLowerCase());
      const matchesJob = candidateJobFilter === "all" || c.jobId === candidateJobFilter;
      return matchesSearch && matchesJob;
    });
  }, [candidates, candidateSearch, candidateJobFilter]);

  const handleCreateJob = () => {
    if (!newJob.titleAr.trim()) {
      toast.error("يرجى كتابة المسمى الوظيفي");
      return;
    }
    const dept = orgUnits.find((u) => u.id === newJob.departmentId);
    addJobOpening({
      titleAr: newJob.titleAr,
      titleEn: newJob.titleEn || newJob.titleAr,
      departmentId: newJob.departmentId,
      departmentName: dept?.nameAr || "التقنية",
      locationId: workLocations[0]?.id || "",
      locationName: workLocations[0]?.nameAr || "غير محدد",
      employmentType: "full_time",
      requirementsAr: "حسب متطلبات الوظيفة",
      requirementsEn: "As per job requirements",
      openingsCount: newJob.openingsCount,
      filledCount: 0,
      salaryMin: newJob.salaryMin,
      salaryMax: newJob.salaryMax,
      descriptionAr: newJob.descriptionAr || "وظيفة جديدة معتمدة في خطة التوظيف",
      descriptionEn: "Job Opening",
      publishedStatus: "published",
      publishedAt: new Date().toISOString().split("T")[0],
    });
    toast.success("تم نشر الوظيفة الشاغرة بنجاح في بوابة التوظيف!");
    setIsAddJobOpen(false);
    setNewJob({
      titleAr: "",
      titleEn: "",
      departmentId: orgUnits[0]?.id || "",
      openingsCount: 1,
      salaryMin: 12000,
      salaryMax: 18000,
      descriptionAr: "",
    });
  };

  const handleApplyForJob = () => {
    if (!applicantName.trim() || !applicantEmail.trim()) {
      toast.error("يرجى استكمال الاسم والبريد الإلكتروني");
      return;
    }
    addCandidate({
      jobId: applyingJob?.id || "job-1",
      jobTitle: applyingJob?.titleAr || "مهندس برمجيات",
      fullName: applicantName,
      email: applicantEmail,
      phone: applicantPhone || "0550001234",
      stage: "applied",
      ratingScore: 5.0,
      appliedDate: new Date().toISOString().split("T")[0],
      source: "website",
      notesCount: 0,
      cvUrl: "https://cdn.focus-hrms.com/resumes/applicant.pdf",
    });
    toast.success(`تم استلام طلب التقديم لـ (${applicantName}) ونقله فورياً لمرحلة الفرز في الـ ATS!`);
    setIsApplyModalOpen(false);
    setApplicantName("");
    setApplicantEmail("");
  };

  const handleSaveScorecard = () => {
    if (!selectedCandidate) return;
    const avg = Number(((techRating + commRating) / 2).toFixed(1));
    updateCandidateScore(selectedCandidate.id, avg);
    toast.success(`تم حفظ بطاقة تقييم المرشح بنجاح! النتيجة: ${avg} / 5.0`);
    setIsScorecardOpen(false);
  };

  const handleSendOffer = () => {
    if (!selectedCandidate) return;
    sendJobOffer({
      candidateId: selectedCandidate.id,
      candidateName: selectedCandidate.fullName,
      jobTitle: selectedCandidate.jobTitle,
      basicSalary: offerBasic,
      housingAllowance: offerHousing,
      transportAllowance: offerTransport,
      proposedStartDate: offerStartDate,
    });
    toast.success(`تم إصدار وتوثيق عرض العمل للمرشح (${selectedCandidate.fullName}) بنجاح`);
    setIsOfferModalOpen(false);
  };

  const handleOpenOnboarding = (cand: Candidate) => {
    setCandidateToHire(cand);
    setOnboardEmpNo(`EMP-${Math.floor(1000 + Math.random() * 9000)}`);
    setOnboardBasic(offerBasic || 15000);
    setOnboardHousing(offerHousing || 3750);
    setOnboardTransport(offerTransport || 1000);
    setOnboardStartDate(new Date().toISOString().slice(0, 10));
    setIsOnboardingModalOpen(true);
  };

  const handleCompleteOnboarding = () => {
    if (!candidateToHire) return;
    const nameParts = candidateToHire.fullName.trim().split(" ");
    const firstName = nameParts[0] || "موظف";
    const lastName = nameParts.slice(1).join(" ") || "جديد";

    const dept = orgUnits.find((u) => u.id === onboardDeptId);
    const loc = workLocations.find((w) => w.id === onboardLocationId);
    const sub = subsidiaries[0];

    const total = onboardBasic + onboardHousing + onboardTransport;

    addEmployee({
      employeeNo: onboardEmpNo,
      firstNameAr: firstName,
      lastNameAr: lastName,
      firstNameEn: firstName,
      lastNameEn: lastName,
      email: candidateToHire.email,
      phone: candidateToHire.phone,
      departmentId: onboardDeptId,
      departmentName: dept?.nameAr || "التقنية",
      subsidiaryId: sub?.id || "sub-1",
      subsidiaryName: sub?.nameAr || company.legalNameAr,
      workLocationId: onboardLocationId,
      workLocationName: loc?.nameAr || "المقر الرئيسي",
      jobTitleAr: candidateToHire.jobTitle,
      jobTitleEn: candidateToHire.jobTitle,
      employmentStatus: "active",
      hireDate: onboardStartDate,
      joiningDate: onboardStartDate,
      basicSalary: onboardBasic,
      housingAllowance: onboardHousing,
      transportAllowance: onboardTransport,
      otherAllowances: 0,
      totalSalary: total,
      gosiDeductionPercentage: 9.75,
      isGosiEnrolled: true,
      bankName: "مصرف الراجحي",
      iban: "SA0000000000000000000000",
      shiftId: "shift-general",
      avatarUrl: `https://images.unsplash.com/photo-${1534528741775 + Math.floor(Math.random() * 500)}?w=150`,
    });

    moveCandidateStage(candidateToHire.id, "hired");
    toast.success(
      `تهانينا! تم تعيين (${candidateToHire.fullName}) وإدراجه رسمياً كموظف نشط في النظام!`,
    );
    setIsOnboardingModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header (Google M3 Style) */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/70 pb-5">
        <div>
          <h1 className="text-xl font-black text-foreground flex items-center gap-2.5">
            <IconSymbol name="person_search" source="material" filled size={26} className="text-primary" />
            {section === "ats"
              ? "بوابة استقطاب وتتبع المترشحين ATS (M09)"
              : "تخطيط القوى العاملة والميزانيات (M10)"}
          </h1>
          <p className="text-xs text-muted-foreground font-medium mt-1">
            {section === "ats"
              ? "تتبع مراحل التوظيف (Kanban)، بطاقات المقابلات، العروض الوظيفية، والتعيين المباشر في النظام"
              : "مقارنة العدد الحالي بالمستهدف ونمذجة تكلفة خطط التعيين والإحلال"}
          </p>
        </div>

        {section === "ats" && canManageRecruitment && (
          <div className="flex flex-wrap gap-2.5">
            <Button
              onClick={() => setIsAddJobOpen(true)}
              size="sm"
              className="rounded-full font-bold text-xs gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs h-10 px-5"
            >
              <Plus className="h-4 w-4" />
              نشر وظيفة شاغرة
            </Button>
            <Button
              onClick={() => {
                setApplyingJob(jobOpenings[0]);
                setIsApplyModalOpen(true);
              }}
              variant="outline"
              size="sm"
              className="rounded-full font-bold text-xs gap-1.5 border-border/80 hover:bg-secondary h-10 px-4 shadow-xs"
            >
              <Globe className="h-4 w-4 text-emerald-600" />
              محاكاة تقديم مرشح جديد
            </Button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList
          className={`grid max-w-md bg-muted/60 p-1 rounded-2xl border border-border/60 ${
            section === "ats" ? "grid-cols-2" : "grid-cols-1"
          }`}
        >
          {section === "ats" ? (
            <>
              <TabsTrigger value="pipeline" className="rounded-xl text-xs font-bold py-2">
                لوحة المرشحين (Kanban) ({candidates.length})
              </TabsTrigger>
              <TabsTrigger value="jobs" className="rounded-xl text-xs font-bold py-2">
                الوظائف الشاغرة ({jobOpenings.length})
              </TabsTrigger>
            </>
          ) : (
            <TabsTrigger value="workforce" className="rounded-xl text-xs font-bold py-2">
              تخطيط الميزانيات ({workforcePlans.length})
            </TabsTrigger>
          )}
        </TabsList>

        {/* Tab 1: Kanban Pipeline */}
        <TabsContent value="pipeline" className="space-y-4 pt-4">
          {/* Search & Filter Bar */}
          <div className="flex flex-wrap items-center gap-2.5 pb-2">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={candidateSearch}
                onChange={(e) => setCandidateSearch(e.target.value)}
                placeholder="بحث باسم المرشح، الوظيفة، البريد..."
                className="w-full h-9 rounded-full border border-border/80 bg-muted/40 pr-9 pl-4 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <select
              value={candidateJobFilter}
              onChange={(e) => setCandidateJobFilter(e.target.value)}
              className="h-9 rounded-full border border-border/80 bg-muted/40 px-3 text-xs font-medium focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="all">كافة الوظائف الشاغرة</option>
              {jobOpenings.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.titleAr}
                </option>
              ))}
            </select>
          </div>

          {/* Kanban Board Container */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 min-h-[550px] overflow-x-auto pb-4">
            {stages.map((stage) => {
              const stageCandidates = filteredCandidates.filter((c) => c.stage === stage.key);
              return (
                <div
                  key={stage.key}
                  className="rounded-3xl border border-border/80 bg-card p-3.5 shadow-xs flex flex-col space-y-3 min-w-[200px]"
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
                  <div className="flex-1 space-y-2.5 overflow-y-auto max-h-[500px] pr-0.5">
                    {stageCandidates.map((cand) => (
                      <div
                        key={cand.id}
                        className="rounded-2xl border border-border/70 bg-muted/20 p-3 shadow-xs space-y-2 hover:border-primary/50 transition-all"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-bold text-xs text-foreground block">{cand.fullName}</h4>
                            <span className="text-[10px] text-muted-foreground block">{cand.jobTitle}</span>
                          </div>
                          <div className="flex items-center gap-0.5 text-amber-500 font-mono text-[10px] font-bold">
                            <Star className="h-3 w-3 fill-amber-500" />
                            <span>{cand.ratingScore}</span>
                          </div>
                        </div>

                        <div className="space-y-1 text-[10px] text-muted-foreground font-mono">
                          <div className="flex items-center gap-1 truncate">
                            <Mail className="h-3 w-3 shrink-0" />
                            <span className="truncate">{cand.email}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Phone className="h-3 w-3 shrink-0" />
                            <span>{cand.phone}</span>
                          </div>
                        </div>

                        {/* Stage Progression Actions */}
                        {canManageRecruitment && (
                          <div className="flex items-center justify-between pt-2 border-t border-border/60 gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedCandidate(cand);
                                setIsScorecardOpen(true);
                              }}
                              className="h-6 text-[9px] px-1.5 rounded-full font-bold text-primary hover:bg-secondary"
                            >
                              <Award className="h-3 w-3 mr-0.5" />
                              تقييم
                            </Button>

                            {stage.key !== "job_offer" && stage.key !== "hired" ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  const currentIndex = stages.findIndex((s) => s.key === stage.key);
                                  if (currentIndex < stages.length - 1) {
                                    moveCandidateStage(cand.id, stages[currentIndex + 1].key);
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
                                  onClick={() => {
                                    setSelectedCandidate(cand);
                                    setIsOfferModalOpen(true);
                                  }}
                                  className="h-6 text-[9px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2 rounded-full shadow-xs"
                                >
                                  عرض
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleOpenOnboarding(cand)}
                                  className="h-6 text-[9px] text-primary font-bold px-2 rounded-full border-primary/30 hover:bg-secondary"
                                  title="تعيين كموظف رسمي"
                                >
                                  تعيين
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1">
                                <Badge
                                  variant="outline"
                                  className="text-[9px] text-emerald-700 bg-emerald-50 rounded-full font-bold border-emerald-200"
                                >
                                  تم التعيين
                                </Badge>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setOfferCandidateToPrint(cand)}
                                  className="h-6 w-6 p-0 rounded-full text-primary"
                                  title="طباعة العرض"
                                >
                                  <Printer className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
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
        </TabsContent>

        {/* Tab 2: Job Openings */}
        <TabsContent value="jobs" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {jobOpenings.map((job) => (
              <div
                key={job.id}
                className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-3.5 hover:border-primary/40 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-black text-sm text-foreground">{job.titleAr}</h3>
                    <p className="text-xs text-muted-foreground font-medium mt-0.5">
                      {job.departmentName} • {job.locationName}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className="text-emerald-700 bg-emerald-50 text-[10px] rounded-full px-2.5 font-bold border-emerald-200"
                  >
                    منشورة للتقديم
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground font-medium leading-relaxed">
                  {job.descriptionAr}
                </p>
                <div className="border-t border-border/60 pt-3 flex justify-between text-xs font-semibold text-muted-foreground">
                  <span>
                    الشواغر المطلوبة: <strong className="text-foreground">{job.openingsCount}</strong>
                  </span>
                  <span className="text-primary font-mono font-bold">
                    الراتب: {job.salaryMin?.toLocaleString()} - {job.salaryMax?.toLocaleString()} ر.س
                  </span>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Tab 3: Workforce Planning */}
        <TabsContent value="workforce" className="space-y-4 pt-4">
          {workforcePlans.map((wp) => (
            <div key={wp.id} className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div>
                  <h3 className="font-black text-sm text-foreground">{wp.titleAr}</h3>
                  <p className="text-xs text-muted-foreground font-medium mt-0.5">
                    لعام {wp.year} • {wp.departmentName}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="text-emerald-700 bg-emerald-50 text-[10px] rounded-full px-2.5 font-bold border-emerald-200"
                >
                  خطة معتمدة
                </Badge>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div className="rounded-2xl border border-border/60 p-4 bg-muted/20">
                  <span className="text-muted-foreground font-bold">العدد الحالي</span>
                  <p className="text-xl font-black text-foreground mt-1">
                    {wp.currentHeadcount} موظف
                  </p>
                </div>
                <div className="rounded-2xl border border-border/60 p-4 bg-muted/20">
                  <span className="text-muted-foreground font-bold">التعيينات المخططة</span>
                  <p className="text-xl font-black text-emerald-600 mt-1">
                    +{wp.plannedHires} وظيفة
                  </p>
                </div>
                <div className="rounded-2xl border border-primary/20 p-4 bg-secondary/30">
                  <span className="text-primary font-bold">العدد المستهدف</span>
                  <p className="text-xl font-black text-primary mt-1">{wp.targetHeadcount} موظف</p>
                </div>
                <div className="rounded-2xl border border-border/60 p-4 bg-muted/20">
                  <span className="text-muted-foreground font-bold">التكلفة السنوية التقديرية</span>
                  <p className="text-xl font-black text-foreground mt-1 font-mono">
                    {(wp.projectedCost / 1000000).toFixed(1)}M ر.س
                  </p>
                </div>
              </div>
            </div>
          ))}
        </TabsContent>
      </Tabs>

      {/* MODAL 1: Onboarding Wizard (Convert to Employee) */}
      {candidateToHire && (
        <Dialog open={isOnboardingModalOpen} onOpenChange={setIsOnboardingModalOpen}>
          <DialogContent className="max-w-lg rounded-3xl p-6">
            <DialogHeader>
              <DialogTitle className="text-base font-black flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-emerald-600" />
                تعيين المرشح وإدراجه في سجل الموظفين
              </DialogTitle>
              <DialogDescription className="text-xs font-medium">
                تحويل المرشح ({candidateToHire.fullName}) إلى موظف رسمي نشط بنظام FOCUS HRMS
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3.5 text-xs py-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <label className="font-bold">الرقم الوظيفي الجديد *</label>
                  <input
                    type="text"
                    value={onboardEmpNo}
                    onChange={(e) => setOnboardEmpNo(e.target.value)}
                    className="w-full h-9 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono font-bold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="font-bold">تاريخ المباشرة الرسمي *</label>
                  <input
                    type="date"
                    value={onboardStartDate}
                    onChange={(e) => setOnboardStartDate(e.target.value)}
                    className="w-full h-9 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <label className="font-bold">الإدارة / القسم *</label>
                  <select
                    value={onboardDeptId}
                    onChange={(e) => setOnboardDeptId(e.target.value)}
                    className="w-full h-9 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    {orgUnits.map((u) => (
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
                    className="w-full h-9 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    {workLocations.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.nameAr}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Salary Package */}
              <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/60 space-y-2">
                <span className="font-bold text-foreground block">الحزمة المالية المعتمدة:</span>
                <div className="grid grid-cols-3 gap-2 font-mono">
                  <div>
                    <label className="text-[10px] text-muted-foreground block font-sans">الأساسي</label>
                    <input
                      type="number"
                      value={onboardBasic}
                      onChange={(e) => setOnboardBasic(Number(e.target.value))}
                      className="w-full h-8 rounded-xl border border-border/80 bg-card px-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground block font-sans">السكن</label>
                    <input
                      type="number"
                      value={onboardHousing}
                      onChange={(e) => setOnboardHousing(Number(e.target.value))}
                      className="w-full h-8 rounded-xl border border-border/80 bg-card px-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground block font-sans">النقل</label>
                    <input
                      type="number"
                      value={onboardTransport}
                      onChange={(e) => setOnboardTransport(Number(e.target.value))}
                      className="w-full h-8 rounded-xl border border-border/80 bg-card px-2 text-xs"
                    />
                  </div>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-border/60 font-black text-sm text-primary">
                  <span>إجمالي الراتب الشهري:</span>
                  <span className="font-mono">
                    {(onboardBasic + onboardHousing + onboardTransport).toLocaleString()} ر.س
                  </span>
                </div>
              </div>
            </div>

            <DialogFooter className="mt-3">
              <Button
                size="sm"
                onClick={handleCompleteOnboarding}
                className="rounded-full text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 h-9"
              >
                تأكيد التعيين وإنشاء الملف الوظيفي
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* MODAL 2: Printable Job Offer Document */}
      {offerCandidateToPrint && (
        <Dialog
          open={!!offerCandidateToPrint}
          onOpenChange={() => setOfferCandidateToPrint(null)}
        >
          <DialogContent className="max-w-xl rounded-3xl p-6">
            <div className="border-b border-border/60 pb-3 text-center space-y-1">
              <h2 className="text-base font-black text-foreground">
                عرض عمل رسمي (Job Offer Letter)
              </h2>
              <p className="text-xs text-muted-foreground font-medium">
                {company.legalNameAr} • س.ت: {company.crNumber || "1010892341"}
              </p>
            </div>

            <div className="space-y-3.5 text-xs py-2 leading-relaxed">
              <p className="font-bold text-foreground">
                عناية الفاضل/ة: <strong className="text-primary">{offerCandidateToPrint.fullName}</strong> المحترم/ة
              </p>
              <p className="text-muted-foreground">
                يسر إدارة المنشأة تقديم هذا العرض الوظيفي للانضمام لفريق عملنا على النحو التالي:
              </p>

              <div className="rounded-2xl border border-border/80 bg-muted/20 p-4 space-y-2 font-mono">
                <div className="flex justify-between">
                  <span className="font-sans">المسمى الوظيفي:</span>
                  <span className="font-bold text-foreground font-sans">{offerCandidateToPrint.jobTitle}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-sans">الراتب الأساسي الشهري:</span>
                  <span className="font-bold">{offerBasic.toLocaleString()} ر.س</span>
                </div>
                <div className="flex justify-between text-emerald-600 font-bold">
                  <span className="font-sans">بدل السكن والنقل:</span>
                  <span>+{(offerHousing + offerTransport).toLocaleString()} ر.س</span>
                </div>
                <div className="border-t border-border/60 pt-2 flex justify-between font-black text-sm text-primary font-sans">
                  <span>إجمالي الراتب الشهري:</span>
                  <span className="font-mono">{(offerBasic + offerHousing + offerTransport).toLocaleString()} ر.س</span>
                </div>
              </div>

              <div className="space-y-1 text-muted-foreground text-[11px]">
                <p>• فترة التجربة: 90 يوماً وفق المادة 53 من نظام العمل السعودي.</p>
                <p>• الإجازة السنوية: 30 يوماً مدفوعة الأجر وفق المادة 109.</p>
                <p>• تأمين طبي شامل من الفئة الممتازة للموظف وعائلته.</p>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-3 border-t border-border/60 text-center text-xs">
                <div>
                  <span className="text-muted-foreground block text-[10px]">قبول وتوقيع المرشح:</span>
                  <span className="font-bold block mt-3 text-foreground">{offerCandidateToPrint.fullName}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">إدارة الموارد البشرية:</span>
                  <div className="flex items-center justify-center gap-1 mt-2 text-emerald-600 font-bold">
                    <ShieldCheck className="h-4 w-4" />
                    <span>معتمد رسمياً</span>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="mt-2">
              <Button
                size="sm"
                onClick={() => window.print()}
                className="w-full rounded-full text-xs font-bold gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground h-9"
              >
                <Printer className="h-4 w-4" />
                طباعة العرض الوظيفي الرسمي
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* MODAL 3: Add Job Opening Modal */}
      <Dialog open={isAddJobOpen} onOpenChange={setIsAddJobOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-primary" />
              نشر وظيفة شاغرة جديدة
            </DialogTitle>
            <DialogDescription className="text-xs font-medium">
              تحديد المتطلبات ونطاق الراتب لنشرها في بوابة التوظيف
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs py-2">
            <div className="space-y-1.5">
              <label className="font-bold">المسمى الوظيفي *</label>
              <input
                type="text"
                value={newJob.titleAr}
                onChange={(e) => setNewJob({ ...newJob, titleAr: e.target.value })}
                placeholder="مثال: مطور أنظمة سحابية أول"
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 font-bold"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold">الإدارة المعنية *</label>
              <select
                value={newJob.departmentId}
                onChange={(e) => setNewJob({ ...newJob, departmentId: e.target.value })}
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                {orgUnits.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.nameAr}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="font-bold">الحد الأدنى للراتب</label>
                <input
                  type="number"
                  value={newJob.salaryMin}
                  onChange={(e) => setNewJob({ ...newJob, salaryMin: Number(e.target.value) })}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-bold">الحد الأعلى للراتب</label>
                <input
                  type="number"
                  value={newJob.salaryMax}
                  onChange={(e) => setNewJob({ ...newJob, salaryMax: Number(e.target.value) })}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold">الوصف والمتطلبات</label>
              <textarea
                rows={3}
                value={newJob.descriptionAr}
                onChange={(e) => setNewJob({ ...newJob, descriptionAr: e.target.value })}
                placeholder="اكتب نبذة عن الوظيفة والمتطلبات والخبرات المطلوبة..."
                className="w-full rounded-2xl border border-border/80 bg-muted/40 p-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>

          <DialogFooter className="mt-3">
            <Button
              size="sm"
              onClick={handleCreateJob}
              className="rounded-full text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-5 h-9"
            >
              نشر الوظيفة فوراً
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 4: Scorecard Evaluation Modal */}
      {selectedCandidate && (
        <Dialog open={isScorecardOpen} onOpenChange={setIsScorecardOpen}>
          <DialogContent className="max-w-md rounded-3xl p-6">
            <DialogHeader>
              <DialogTitle className="text-base font-black flex items-center gap-2">
                <Award className="h-5 w-5 text-primary" />
                بطاقة تقييم المقابلة ({selectedCandidate.fullName})
              </DialogTitle>
              <DialogDescription className="text-xs font-medium">
                الوظيفة: {selectedCandidate.jobTitle}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3.5 text-xs py-2">
              <div className="space-y-1.5">
                <div className="flex justify-between font-bold">
                  <span>الكفاءة الفنية والخبرة:</span>
                  <span className="text-primary font-mono">{techRating} / 5</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="5"
                  step="1"
                  value={techRating}
                  onChange={(e) => setTechRating(Number(e.target.value))}
                  className="w-full cursor-pointer accent-primary"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between font-bold">
                  <span>مهارات التواصل والقيادة:</span>
                  <span className="text-primary font-mono">{commRating} / 5</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="5"
                  step="1"
                  value={commRating}
                  onChange={(e) => setCommRating(Number(e.target.value))}
                  className="w-full cursor-pointer accent-primary"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold">ملاحظات المقابلة وتوصية التعيين</label>
                <textarea
                  rows={2}
                  value={evalNotes}
                  onChange={(e) => setEvalNotes(e.target.value)}
                  placeholder="مرشح متميز ولديه شغف قوي بالتقنيات الحديثة..."
                  className="w-full rounded-2xl border border-border/80 bg-muted/40 p-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>

            <DialogFooter className="mt-3">
              <Button
                size="sm"
                onClick={handleSaveScorecard}
                className="rounded-full text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-5 h-9"
              >
                حفظ التقييم وترقية المرشح
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* MODAL 5: Public Application Simulator */}
      <Dialog open={isApplyModalOpen} onOpenChange={setIsApplyModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Globe className="h-5 w-5 text-emerald-600" />
              بوابة التوظيف الإلكترونية (نموذج التقديم)
            </DialogTitle>
            <DialogDescription className="text-xs font-medium">
              الوظيفة: {applyingJob?.titleAr || "مهندس برمجيات"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs py-2">
            <div className="space-y-1.5">
              <label className="font-bold">الاسم الكامل للمرشح *</label>
              <input
                type="text"
                value={applicantName}
                onChange={(e) => setApplicantName(e.target.value)}
                placeholder="مثال: يوسف العتيبي"
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div className="space-y-1.5">
              <label className="font-bold">البريد الإلكتروني *</label>
              <input
                type="email"
                value={applicantEmail}
                onChange={(e) => setApplicantEmail(e.target.value)}
                placeholder="yousef@example.com"
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div className="space-y-1.5">
              <label className="font-bold">رقم الجوال</label>
              <input
                type="text"
                value={applicantPhone}
                onChange={(e) => setApplicantPhone(e.target.value)}
                placeholder="05XXXXXXXX"
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>

          <DialogFooter className="mt-3">
            <Button
              size="sm"
              onClick={handleApplyForJob}
              className="rounded-full text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 h-9"
            >
              إرسال طلب التقديم
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 6: Issue Job Offer Modal */}
      {selectedCandidate && (
        <Dialog open={isOfferModalOpen} onOpenChange={setIsOfferModalOpen}>
          <DialogContent className="max-w-md rounded-3xl p-6">
            <DialogHeader>
              <DialogTitle className="text-base font-black flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                إصدار عرض عمل رسمي ({selectedCandidate.fullName})
              </DialogTitle>
              <DialogDescription className="text-xs font-medium">
                المسمى: {selectedCandidate.jobTitle}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3.5 text-xs py-2">
              <div className="space-y-1.5">
                <label className="font-bold">الراتب الأساسي (ر.س) *</label>
                <input
                  type="number"
                  value={offerBasic}
                  onChange={(e) => setOfferBasic(Number(e.target.value))}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <label className="font-bold">بدل السكن</label>
                  <input
                    type="number"
                    value={offerHousing}
                    onChange={(e) => setOfferHousing(Number(e.target.value))}
                    className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="font-bold">بدل النقل</label>
                  <input
                    type="number"
                    value={offerTransport}
                    onChange={(e) => setOfferTransport(Number(e.target.value))}
                    className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-primary/20 bg-secondary/30 p-3.5 flex justify-between font-black text-primary text-sm">
                <span>إجمالي العرض الشهري:</span>
                <span className="font-mono">
                  {(offerBasic + offerHousing + offerTransport).toLocaleString()} ر.س
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold">تاريخ المباشرة المقترح *</label>
                <input
                  type="date"
                  value={offerStartDate}
                  onChange={(e) => setOfferStartDate(e.target.value)}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>

            <DialogFooter className="mt-3">
              <Button
                size="sm"
                onClick={handleSendOffer}
                className="rounded-full text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 h-9"
              >
                تأكيد وإرسال العرض للمرشح
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
