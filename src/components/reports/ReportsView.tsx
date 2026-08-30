import React from 'react';
import { useApp } from '../../lib/context/AppContext';
import {
  FileBarChart,
  Download,
  Filter,
  Users,
  Wallet,
  Clock,
  CalendarDays,
  Receipt,
  FileSpreadsheet,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

export const ReportsView: React.FC = () => {
  const { language, t } = useApp();

  const standardReports = [
    { id: 'rep-emp', titleAr: 'تقرير الموظفين الشامل وبيانات العقود', category: 'شؤون الموظفين', format: 'Excel / PDF' },
    { id: 'rep-pay', titleAr: 'تقرير مسيرات الرواتب الشهرية والبدلات', category: 'الرواتب', format: 'Excel / CSV' },
    { id: 'rep-att', titleAr: 'تقرير الحضور والانصراف وساعات العمل الإضافية', category: 'الحضور', format: 'Excel' },
    { id: 'rep-gosi', titleAr: 'تقرير التأمينات الاجتماعية وحماية الأجور (WPS)', category: 'الرواتب', format: 'SIF / Excel' },
    { id: 'rep-leave', titleAr: 'تقرير أرصدة الإجازات والمحجوز والمستهلك', category: 'الإجازات', format: 'Excel / PDF' },
    { id: 'rep-exp', titleAr: 'تقرير النفقات والمصروفات ومراكز التكلفة', category: 'المالية', format: 'Excel / PDF' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <FileBarChart className="h-5 w-5 text-primary" />
            {t.system.reportsCatalog} والتحليلات
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            استخراج التقارير القياسية والمخصصة، الجدولة التلقائية وتصدير ملفات Excel / PDF / CSV
          </p>
        </div>
      </div>

      {/* Reports Catalog Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {standardReports.map(rep => (
          <div key={rep.id} className="rounded-xl border bg-card p-5 shadow-sm space-y-3 hover:border-primary/40 transition-colors">
            <div className="flex items-start justify-between">
              <Badge variant="secondary" className="text-[10px]">
                {rep.category}
              </Badge>
              <span className="text-[10px] font-mono text-muted-foreground">{rep.format}</span>
            </div>

            <h3 className="font-bold text-xs text-foreground leading-relaxed">{rep.titleAr}</h3>

            <div className="border-t pt-3 flex gap-2">
              <Button
                size="sm"
                onClick={() => alert(`جاري تصدير وتحميل ${rep.titleAr}`)}
                className="w-full text-xs font-bold gap-1 bg-primary"
              >
                <Download className="h-3.5 w-3.5" />
                تصدير التقرير
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
