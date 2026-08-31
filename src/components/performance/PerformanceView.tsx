import React, { useState } from 'react';
import { useApp } from '../../lib/context/AppContext';
import {
  Award,
  Star,
  CheckCircle2,
  Users,
  Target,
  BarChart3,
  Calendar,
  Sparkles,
  Plus,
  TrendingUp,
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

export const PerformanceView: React.FC = () => {
  const { performanceCycles, evaluations, employees, language, t } = useApp();
  const [activeTab, setActiveTab] = useState('cycles');

  // Modals state
  const [isSubmitEvaluationOpen, setIsSubmitEvaluationOpen] = useState(false);
  const [isAddCycleOpen, setIsAddCycleOpen] = useState(false);

  // Evaluation Form State
  const [targetEmpId, setTargetEmpId] = useState(employees[0]?.id || '');
  const [evalType, setEvalType] = useState<'manager' | 'peer' | 'self'>('manager');
  const [scorePerformance, setScorePerformance] = useState(5);
  const [scoreLeadership, setScoreLeadership] = useState(4);
  const [scoreTeamwork, setScoreTeamwork] = useState(5);
  const [feedbackNote, setFeedbackNote] = useState('');

  // Cycle Form State
  const [cycleTitle, setCycleTitle] = useState('');
  const [cycleStartDate, setCycleStartDate] = useState('2026-09-01');
  const [cycleEndDate, setCycleEndDate] = useState('2026-12-31');

  const handleSubmitEvaluation = () => {
    if (!feedbackNote) {
      alert('يرجى كتابة ملاحظات وتوصيات التقييم');
      return;
    }
    const emp = employees.find(e => e.id === targetEmpId);
    const avgScore = Number(((scorePerformance + scoreLeadership + scoreTeamwork) / 3).toFixed(1));

    evaluations.push({
      id: `ev-${Date.now()}`,
      cycleId: performanceCycles[0]?.id || 'cyc-1',
      employeeId: targetEmpId,
      employeeName: `${emp?.firstNameAr} ${emp?.lastNameAr}`,
      evaluatorId: 'emp-admin',
      evaluatorName: 'المدير التنفيذي / المباشر',
      evaluationType: evalType,
      status: 'submitted',
      overallScore: avgScore,
      submittedAt: new Date().toISOString(),
    });

    alert(`تم توثيق تقييم الأداء لـ (${emp?.firstNameAr} ${emp?.lastNameAr}) بنتيجة ${avgScore} / 5.0 بنجاح!`);
    setIsSubmitEvaluationOpen(false);
    setFeedbackNote('');
  };

  const handleCreateCycle = () => {
    if (!cycleTitle) {
      alert('يرجى كتابة عنوان دورة التقييم');
      return;
    }
    performanceCycles.push({
      id: `cyc-${Date.now()}`,
      titleAr: cycleTitle,
      titleEn: cycleTitle,
      startDate: cycleStartDate,
      endDate: cycleEndDate,
      status: 'active',
      periodType: 'annual',
      participantsCount: employees.length,
      completionRate: 0,
    });
    alert(`تم إطلاق دورة التقييم (${cycleTitle}) بنجاح وإشعار جميع الموظفين!`);
    setIsAddCycleOpen(false);
    setCycleTitle('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" />
            {t.performance.cycles} وإدارة الأداء (360° Review - M13)
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            تقييمات الأداء متعددة الأطراف (الذاتي، المدير المباشر، الزملاء) وتوزيع الأوزان 100%
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setIsSubmitEvaluationOpen(true)} size="sm" className="font-bold text-xs gap-1.5 bg-primary">
            <Plus className="h-4 w-4" />
            إجراء تقييم موظف (360°)
          </Button>
          <Button onClick={() => setIsAddCycleOpen(true)} variant="outline" size="sm" className="font-bold text-xs gap-1.5">
            <Plus className="h-4 w-4" />
            إطلاق دورة تقييم جديدة
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-2 max-w-xs">
          <TabsTrigger value="cycles" className="text-xs font-bold">
            دورات التقييم ({performanceCycles.length})
          </TabsTrigger>
          <TabsTrigger value="evaluations" className="text-xs font-bold">
            سجل التقييمات ({evaluations.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Performance Cycles */}
        <TabsContent value="cycles" className="space-y-4 pt-4">
          {performanceCycles.map(cyc => (
            <div key={cyc.id} className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-black text-foreground">{cyc.titleAr}</h2>
                    <Badge variant="outline" className="text-emerald-700 bg-emerald-50 text-[10px]">
                      دورة نشطة
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    الفترة: من {cyc.startDate} إلى {cyc.endDate}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-end">
                    <span className="text-xs font-bold text-foreground">{cyc.completionRate}% مكتمل</span>
                    <p className="text-[10px] text-muted-foreground">{cyc.participantsCount} موظف مشارك</p>
                  </div>
                  <div className="h-2 w-24 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${cyc.completionRate}%` }} />
                  </div>
                </div>
              </div>

              {/* Evaluations Grid */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-muted-foreground uppercase">التقييمات المنجزة حديثاً في الدورة</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {evaluations.map(ev => (
                    <div key={ev.id} className="rounded-lg border bg-muted/20 p-3 text-xs space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-bold text-foreground">{ev.employeeName}</h4>
                          <p className="text-[10px] text-muted-foreground">
                            المقيّم: {ev.evaluatorName} ({ev.evaluationType === 'manager' ? 'تقييم المدير' : 'تقييم الزملاء'})
                          </p>
                        </div>
                        <div className="flex items-center gap-1 font-black text-amber-500 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          <Star className="h-3.5 w-3.5 fill-current" />
                          {ev.overallScore} / 5.0
                        </div>
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-muted-foreground border-t pt-1.5">
                        <span>الحالة: معتمد وموثق</span>
                        <span>{new Date(ev.submittedAt || '').toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </TabsContent>

        {/* Tab 2: All Evaluations Ledger */}
        <TabsContent value="evaluations" className="space-y-4 pt-4">
          <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
            <table className="w-full text-xs">
              <thead className="border-b bg-muted/40 font-bold text-muted-foreground">
                <tr>
                  <th className="py-3 px-4 text-start">الموظف المقيم</th>
                  <th className="py-3 px-4 text-start">نوع التقييم</th>
                  <th className="py-3 px-4 text-start">المقيّم</th>
                  <th className="py-3 px-4 text-start">النتيجة الإجمالية</th>
                  <th className="py-3 px-4 text-start">تاريخ التوثيق</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {evaluations.map(ev => (
                  <tr key={ev.id} className="hover:bg-muted/20">
                    <td className="py-3 px-4 font-bold text-foreground">{ev.employeeName}</td>
                    <td className="py-3 px-4">
                      {ev.evaluationType === 'manager' ? 'تقييم المدير المباشر' : 'تقييم الزملاء (Peer)'}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">{ev.evaluatorName}</td>
                    <td className="py-3 px-4 font-bold text-amber-600">
                      ★ {ev.overallScore} / 5.0
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {new Date(ev.submittedAt || '').toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Submit Evaluation Modal */}
      <Dialog open={isSubmitEvaluationOpen} onOpenChange={setIsSubmitEvaluationOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
              إجراء تقييم أداء 360 درجة
            </DialogTitle>
            <DialogDescription className="text-xs">
              تقييم الكفاءات السلوكية وتحقيق المستهدفات OKRs
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-xs py-2">
            <div className="space-y-1">
              <label className="font-bold">الموظف المراد تقييمه *</label>
              <select
                value={targetEmpId}
                onChange={e => setTargetEmpId(e.target.value)}
                className="w-full h-8 rounded border px-2.5"
              >
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.firstNameAr} {emp.lastNameAr} ({emp.jobTitleAr})</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-bold">نوع التقييم *</label>
              <select
                value={evalType}
                onChange={e => setEvalType(e.target.value as any)}
                className="w-full h-8 rounded border px-2.5"
              >
                <option value="manager">تقييم المدير المباشر (Manager Review)</option>
                <option value="peer">تقييم الزملاء (Peer Review)</option>
                <option value="self">التقييم الذاتي (Self Review)</option>
              </select>
            </div>

            {/* Competency Scoring Sliders */}
            <div className="rounded-lg border bg-muted/20 p-3 space-y-2.5">
              <div className="flex justify-between items-center">
                <span>1. الإنجاز وتحقيق الأهداف الوظيفية:</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setScorePerformance(v)}
                      className={`h-6 w-6 rounded text-xs font-bold ${
                        scorePerformance === v ? 'bg-amber-500 text-white' : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span>2. المبادرة والقيادة والالتزام:</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setScoreLeadership(v)}
                      className={`h-6 w-6 rounded text-xs font-bold ${
                        scoreLeadership === v ? 'bg-amber-500 text-white' : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span>3. التعاون وروح الفريق:</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setScoreTeamwork(v)}
                      className={`h-6 w-6 rounded text-xs font-bold ${
                        scoreTeamwork === v ? 'bg-amber-500 text-white' : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-bold">الملاحظات والتوصيات التطويرية *</label>
              <textarea
                rows={2}
                value={feedbackNote}
                onChange={e => setFeedbackNote(e.target.value)}
                placeholder="اكتب نقاط القوة ومجالات التطوير المقترحة للموظف..."
                className="w-full rounded border p-2 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button size="sm" onClick={handleSubmitEvaluation} className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
              تأكيد وتوثيق التقييم
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Cycle Modal */}
      <Dialog open={isAddCycleOpen} onOpenChange={setIsAddCycleOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              إطلاق دورة تقييم أداء جديدة
            </DialogTitle>
            <DialogDescription className="text-xs">
              تحديد الفترة الزمنية والمستهدفين
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-xs py-2">
            <div className="space-y-1">
              <label className="font-bold">عنوان دورة التقييم *</label>
              <input
                type="text"
                value={cycleTitle}
                onChange={e => setCycleTitle(e.target.value)}
                placeholder="مثال: دورة تقييم الأداء للربع الأخير Q4 2026"
                className="w-full h-8 rounded border px-2.5"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="font-bold">تاريخ البدء *</label>
                <input
                  type="date"
                  value={cycleStartDate}
                  onChange={e => setCycleStartDate(e.target.value)}
                  className="w-full h-8 rounded border px-2.5"
                />
              </div>
              <div className="space-y-1">
                <label className="font-bold">تاريخ الانتهاء *</label>
                <input
                  type="date"
                  value={cycleEndDate}
                  onChange={e => setCycleEndDate(e.target.value)}
                  className="w-full h-8 rounded border px-2.5"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button size="sm" onClick={handleCreateCycle} className="text-xs bg-primary font-bold">
              إطلاق الدورة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
