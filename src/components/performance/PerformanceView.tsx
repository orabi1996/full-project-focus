import React from 'react';
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
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

export const PerformanceView: React.FC = () => {
  const { performanceCycles, evaluations, language, t } = useApp();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" />
            {t.performance.cycles} وإدارة الأداء (360° Review)
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            تقييمات الأداء متعددة الأطراف (الذاتي، المدير المباشر، الزملاء) وتوزيع الأوزان 100%
          </p>
        </div>
      </div>

      {/* Active Performance Cycle Card */}
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
            <h3 className="text-xs font-bold text-muted-foreground uppercase">سجل التقييمات في الدورة</h3>
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
    </div>
  );
};
