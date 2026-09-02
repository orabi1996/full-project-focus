import React, { useEffect, useState } from "react";
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
    currentRole,
    addJobOpening,
    addCandidate,
    updateCandidateScore,
    moveCandidateStage,
    sendJobOffer,
    language,
    t,
  } = useApp();

  const [activeTab, setActiveTab] = useState(section === "ats" ? "pipeline" : "workforce");
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [isOfferModalOpen, setIsOfferModalOpen] = useState(false);
  const [isAddJobOpen, setIsAddJobOpen] = useState(false);
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [isScorecardOpen, setIsScorecardOpen] = useState(false);

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

  const handleCreateJob = () => {
    if (!newJob.titleAr) {
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
    if (!applicantName || !applicantEmail) {
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

  return (
    <div className="space-y-6">
      {/* Header (Google M3 Style) */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/70 pb-5">
        <div>
          <h1 className="text-xl font-black text-foreground flex items-center gap-2.5">
            <IconSymbol name="person_search" source="material" filled size={24} className="text-primary" />
            {section === "ats"
              ? `${t.recruitment.candidatesPipeline} والتوظيف (M08)`
              : "تخطيط القوى العاملة والميزانيات (M10)"}
          </h1>
          <p className="text-xs text-muted-foreground font-medium mt-1">
            {section === "ats"
              ? "تتبع المتقدمين، الوظائف الشاغرة، بطاقات التقييم والعروض الوظيفية الرقمية"
              : "مقارنة العدد الحالي بالمستهدف ونمذجة تكلفة خطط التعيين والإحلال"}
          </p>
        </div>
        {section === "ats" && canManageRecruitment && (
          <div className="flex flex-wrap gap-2.5">
            <Button
              onClick={() => setIsAddJobOpen(true)}
              size="sm"
              className="rounded-full font-bold text-xs gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs h-10 px-4"
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
              بوابة التوظيف (محاكاة تقديم مرشح)
            </Button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className={`grid max-w-md bg-muted/60 p-1 rounded-full border border-border/60 ${section === "ats" ? "grid-cols-2" : "grid-cols-1"}`}>
          {section === "ats" ? (
            <>
              <TabsTrigger value="pipeline" className="rounded-full text-xs font-bold py-2 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-xs">
                لوحة المرشحين (Kanban) ({candidates.length})
              </TabsTrigger>
              <TabsTrigger value="jobs" className="rounded-full text-xs font-bold py-2 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-xs">
                الوظائف الشاغرة ({jobOpenings.length})
              </TabsTrigger>
            </>
          ) : (
            <TabsTrigger value="workforce" className="rounded-full text-xs font-bold py-2 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-xs">
              تخطيط الميزانيات ({workforcePlans.length})
            </TabsTrigger>
          )}
        </TabsList>

        {/* Tab 1: Interactive ATS Kanban Pipeline */}
        <TabsContent value="pipeline" className="pt-4">
          <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
            {stages.map((stage) => {
              const stageCandidates = candidates.filter((c) => c.stage === stage.key);
              return (
                <div
                  key={stage.key}
                  className="w-72 shrink-0 rounded-3xl border border-border/80 bg-card p-4 shadow-xs space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-border/60 pb-3">
                    <span className="font-black text-xs text-foreground">{stage.labelAr}</span>
                    <Badge variant="secondary" className="text-[10px] rounded-full px-2.5 font-black">
                      {stageCandidates.length}
                    </Badge>
                  </div>

                  <div className="space-y-3 min-h-[360px]">
                    {stageCandidates.map((cand) => (
                      <div
                        key={cand.id}
                        className="rounded-2xl border border-border/70 bg-muted/20 p-3.5 text-xs space-y-2.5 shadow-xs hover:border-primary/50 transition-all hover:bg-card"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-bold text-foreground block">{cand.fullName}</h4>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{cand.jobTitle}</p>
                          </div>
                          <button
                            onClick={() => {
                              setSelectedCandidate(cand);
                              setIsScorecardOpen(true);
                            }}
                            disabled={!canManageRecruitment}
                            className="flex items-center gap-0.5 text-amber-500 font-black text-[10px] hover:underline disabled:cursor-default disabled:no-underline bg-amber-500/10 px-2 py-0.5 rounded-full"
                          >
                            <Star className="h-3 w-3 fill-current" />
                            {cand.ratingScore}
                          </button>
                        </div>

                        <div className="text-[10px] text-muted-foreground flex items-center justify-between pt-2 border-t border-border/60 font-mono">
                          <span>المصدر: {cand.source}</span>
                          <span>{cand.appliedDate}</span>
                        </div>

                        {/* Stage Progression Buttons */}
                        {canManageRecruitment && (
                          <div className="flex items-center justify-between pt-2 border-t border-border/60 gap-1.5">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedCandidate(cand);
                                setIsScorecardOpen(true);
                              }}
                              className="h-7 text-[10px] px-2 rounded-full font-bold text-primary hover:bg-secondary"
                            >
                              <Award className="h-3 w-3" />
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
                                className="h-7 text-[10px] text-primary font-bold px-3 rounded-full border-border/80 hover:bg-secondary"
                              >
                                ترقية →
                              </Button>
                            ) : stage.key === "job_offer" ? (
                              <Button
                                size="sm"
                                onClick={() => {
                                  setSelectedCandidate(cand);
                                  setIsOfferModalOpen(true);
                                }}
                                className="h-7 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 rounded-full shadow-xs"
                              >
                                إصدار عرض
                              </Button>
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-[9px] text-emerald-700 bg-emerald-50 rounded-full font-bold border-emerald-200"
                              >
                                تم التعيين
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
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
              <div key={job.id} className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-3.5 hover:border-primary/40 transition-all">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-black text-sm text-foreground">{job.titleAr}</h3>
                    <p className="text-xs text-muted-foreground font-medium mt-0.5">
                      {job.departmentName} • {job.locationName}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-emerald-700 bg-emerald-50 text-[10px] rounded-full px-2.5 font-bold border-emerald-200">
                    منشورة للتقديم
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground font-medium leading-relaxed">{job.descriptionAr}</p>
                <div className="border-t border-border/60 pt-3 flex justify-between text-xs font-semibold text-muted-foreground">
                  <span>الشواغر المطلوبة: <strong className="text-foreground">{job.openingsCount}</strong></span>
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
                <Badge variant="outline" className="text-emerald-700 bg-emerald-50 text-[10px] rounded-full px-2.5 font-bold border-emerald-200">
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

      {/* Add Job Opening Modal */}
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
                placeholder="مثال: مطور واجهات مستخدم أول (React)"
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 font-semibold"
              />
            </div>
            <div className="space-y-1.5">
              <label className="font-bold">القسم / الإدارة *</label>
              <select
                value={newJob.departmentId}
                onChange={(e) => setNewJob({ ...newJob, departmentId: e.target.value })}
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 font-bold"
              >
                {orgUnits.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nameAr}
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
                <label className="font-bold">الحد الأقصى للراتب</label>
                <input
                  type="number"
                  value={newJob.salaryMax}
                  onChange={(e) => setNewJob({ ...newJob, salaryMax: Number(e.target.value) })}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="font-bold">وصف الوظيفة والمتطلبات</label>
              <textarea
                rows={2}
                value={newJob.descriptionAr}
                onChange={(e) => setNewJob({ ...newJob, descriptionAr: e.target.value })}
                placeholder="اكتب وصفاً مختصراً للمهام..."
                className="w-full rounded-2xl border border-border/80 bg-muted/40 p-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>

          <DialogFooter className="mt-3">
            <Button size="sm" onClick={handleCreateJob} className="rounded-full text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-5 h-9">
              نشر الوظيفة في ATS
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Candidate Evaluation Scorecard Modal */}
      {selectedCandidate && (
        <Dialog open={isScorecardOpen} onOpenChange={setIsScorecardOpen}>
          <DialogContent className="max-w-md rounded-3xl p-6">
            <DialogHeader>
              <DialogTitle className="text-base font-black flex items-center gap-2">
                <Award className="h-5 w-5 text-primary" />
                بطاقة تقييم المرشح: {selectedCandidate.fullName}
              </DialogTitle>
              <DialogDescription className="text-xs font-medium">
                {selectedCandidate.jobTitle}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3.5 text-xs py-2">
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="font-bold">التقييم الفني والخبرات (Technical Skills)</label>
                  <span className="font-black text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">{techRating} / 5 نجوم</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={techRating}
                  onChange={(e) => setTechRating(Number(e.target.value))}
                  className="w-full cursor-pointer accent-primary"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="font-bold">مهارات التواصل واللغة (Communication)</label>
                  <span className="font-black text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">{commRating} / 5 نجوم</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={5}
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

      {/* Public Application Modal Simulator */}
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

      {/* Issue Job Offer Modal */}
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
                <span className="font-mono">{(offerBasic + offerHousing + offerTransport).toLocaleString()} ر.س</span>
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
