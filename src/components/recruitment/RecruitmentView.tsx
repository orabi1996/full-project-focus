import React, { useState } from 'react';
import { useApp } from '../../lib/context/AppContext';
import type { CandidateStage } from '../../types';
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
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';

export const RecruitmentView: React.FC = () => {
  const {
    jobOpenings,
    candidates,
    workforcePlans,
    moveCandidateStage,
    sendJobOffer,
    language,
    t,
  } = useApp();

  const [activeTab, setActiveTab] = useState('pipeline');
  const [selectedCandidate, setSelectedCandidate] = useState<any | null>(null);
  const [isOfferModalOpen, setIsOfferModalOpen] = useState(false);
  const [offerBasic, setOfferBasic] = useState(16000);
  const [offerHousing, setOfferHousing] = useState(4000);
  const [offerTransport, setOfferTransport] = useState(1000);
  const [offerStartDate, setOfferStartDate] = useState('2026-10-01');

  const stages: { key: CandidateStage; labelAr: string; color: string }[] = [
    { key: 'applied', labelAr: 'مقدم جديد', color: 'border-blue-300' },
    { key: 'screening', labelAr: 'الفرز والتدقيق', color: 'border-amber-300' },
    { key: 'interview', labelAr: 'المقابلة الشخصية', color: 'border-purple-300' },
    { key: 'assessment', labelAr: 'التقييم الفني', color: 'border-indigo-300' },
    { key: 'job_offer', labelAr: 'العرض الوظيفي', color: 'border-emerald-300' },
    { key: 'hired', labelAr: 'تم التعيين', color: 'border-emerald-600' },
  ];

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
    alert(`تم إصدار وتوثيق عرض العمل للمرشح (${selectedCandidate.fullName}) بنجاح`);
    setIsOfferModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            {t.recruitment.candidatesPipeline} وتخطيط القوى العاملة
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            تتبع المتقدمين (ATS Kanban Pipeline)، الوظائف الشاغرة، العروض الوظيفية ونمذجة الميزانيات
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-3 max-w-md">
          <TabsTrigger value="pipeline" className="text-xs font-bold">
            لوحة المرشحين (Kanban)
          </TabsTrigger>
          <TabsTrigger value="jobs" className="text-xs font-bold">
            الوظائف الشاغرة ({jobOpenings.length})
          </TabsTrigger>
          <TabsTrigger value="workforce" className="text-xs font-bold">
            تخطيط الميزانيات ({workforcePlans.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Interactive ATS Kanban Pipeline */}
        <TabsContent value="pipeline" className="pt-4">
          <div className="flex gap-3 overflow-x-auto pb-4">
            {stages.map(stage => {
              const stageCandidates = candidates.filter(c => c.stage === stage.key);
              return (
                <div
                  key={stage.key}
                  className="w-72 shrink-0 rounded-xl border bg-card p-3 shadow-xs space-y-3"
                >
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="font-bold text-xs text-foreground">{stage.labelAr}</span>
                    <Badge variant="secondary" className="text-[10px] font-bold">
                      {stageCandidates.length}
                    </Badge>
                  </div>

                  <div className="space-y-2.5 min-h-[300px]">
                    {stageCandidates.map(cand => (
                      <div
                        key={cand.id}
                        className="rounded-lg border bg-muted/20 p-3 text-xs space-y-2 shadow-xs hover:border-primary/50 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-bold text-foreground">{cand.fullName}</h4>
                            <p className="text-[10px] text-muted-foreground">{cand.jobTitle}</p>
                          </div>
                          <div className="flex items-center gap-0.5 text-amber-500 font-bold text-[10px]">
                            <Star className="h-3 w-3 fill-current" />
                            {cand.ratingScore}
                          </div>
                        </div>

                        <div className="text-[10px] text-muted-foreground flex items-center justify-between pt-1 border-t">
                          <span>المصدر: {cand.source}</span>
                          <span>{cand.appliedDate}</span>
                        </div>

                        {/* Stage Progression Buttons */}
                        <div className="flex items-center justify-between pt-2 border-t">
                          {stage.key !== 'job_offer' && stage.key !== 'hired' ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                const currentIndex = stages.findIndex(s => s.key === stage.key);
                                if (currentIndex < stages.length - 1) {
                                  moveCandidateStage(cand.id, stages[currentIndex + 1].key);
                                }
                              }}
                              className="h-6 text-[10px] text-primary font-bold px-2"
                            >
                              ترقية للمرحلة التالية →
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedCandidate(cand);
                                setIsOfferModalOpen(true);
                              }}
                              className="h-6 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2"
                            >
                              إصدار عرض عمل
                            </Button>
                          )}
                        </div>
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
            {jobOpenings.map(job => (
              <div key={job.id} className="rounded-xl border bg-card p-5 shadow-sm space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-foreground">{job.titleAr}</h3>
                    <p className="text-xs text-muted-foreground">{job.departmentName} • {job.locationName}</p>
                  </div>
                  <Badge variant="outline" className="text-emerald-700 bg-emerald-50 text-[10px]">
                    منشورة للتقديم
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{job.descriptionAr}</p>
                <div className="border-t pt-2 flex justify-between text-xs font-semibold text-muted-foreground">
                  <span>الشواغر المطلوبة: {job.openingsCount}</span>
                  <span className="text-primary">
                    الراتب: {job.salaryMin?.toLocaleString()} - {job.salaryMax?.toLocaleString()} ر.س
                  </span>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Tab 3: Workforce Planning */}
        <TabsContent value="workforce" className="space-y-4 pt-4">
          {workforcePlans.map(wp => (
            <div key={wp.id} className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <h3 className="font-bold text-sm text-foreground">{wp.titleAr}</h3>
                  <p className="text-xs text-muted-foreground">لعام {wp.year} • {wp.departmentName}</p>
                </div>
                <Badge variant="outline" className="text-emerald-700 bg-emerald-50 text-[10px]">
                  خطة معتمدة
                </Badge>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="rounded-lg border p-3 bg-muted/20">
                  <span className="text-muted-foreground">العدد الحالي</span>
                  <p className="text-lg font-bold text-foreground mt-1">{wp.currentHeadcount} موظف</p>
                </div>
                <div className="rounded-lg border p-3 bg-muted/20">
                  <span className="text-muted-foreground">التعيينات المخططة</span>
                  <p className="text-lg font-bold text-emerald-600 mt-1">+{wp.plannedHires} وظيفة</p>
                </div>
                <div className="rounded-lg border p-3 bg-muted/20">
                  <span className="text-muted-foreground">العدد المستهدف</span>
                  <p className="text-lg font-bold text-primary mt-1">{wp.targetHeadcount} موظف</p>
                </div>
                <div className="rounded-lg border p-3 bg-muted/20">
                  <span className="text-muted-foreground">التكلفة السنوية التقديرية</span>
                  <p className="text-lg font-bold text-foreground mt-1">{(wp.projectedCost / 1000000).toFixed(1)}M ر.س</p>
                </div>
              </div>
            </div>
          ))}
        </TabsContent>
      </Tabs>

      {/* Issue Job Offer Modal */}
      {selectedCandidate && (
        <Dialog open={isOfferModalOpen} onOpenChange={setIsOfferModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                إصدار عرض عمل رسمي ({selectedCandidate.fullName})
              </DialogTitle>
              <DialogDescription className="text-xs">
                المسمى: {selectedCandidate.jobTitle}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 text-xs py-2">
              <div className="space-y-1">
                <label className="font-bold">الراتب الأساسي (ر.س) *</label>
                <input
                  type="number"
                  value={offerBasic}
                  onChange={e => setOfferBasic(Number(e.target.value))}
                  className="w-full h-8 rounded border px-2.5"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="font-bold">بدل السكن</label>
                  <input
                    type="number"
                    value={offerHousing}
                    onChange={e => setOfferHousing(Number(e.target.value))}
                    className="w-full h-8 rounded border px-2.5"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold">بدل النقل</label>
                  <input
                    type="number"
                    value={offerTransport}
                    onChange={e => setOfferTransport(Number(e.target.value))}
                    className="w-full h-8 rounded border px-2.5"
                  />
                </div>
              </div>

              <div className="rounded-lg border bg-muted/20 p-2.5 flex justify-between font-bold text-primary">
                <span>إجمالي العرض الشهري:</span>
                <span>{(offerBasic + offerHousing + offerTransport).toLocaleString()} ر.س</span>
              </div>

              <div className="space-y-1">
                <label className="font-bold">تاريخ المباشرة المقترح *</label>
                <input
                  type="date"
                  value={offerStartDate}
                  onChange={e => setOfferStartDate(e.target.value)}
                  className="w-full h-8 rounded border px-2.5"
                />
              </div>
            </div>

            <DialogFooter className="mt-2">
              <Button size="sm" onClick={handleSendOffer} className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                تأكيد وإرسال العرض للمرشح
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
