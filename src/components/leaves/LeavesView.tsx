import React, { useState } from 'react';
import { useApp } from '../../lib/context/AppContext';
import {
  CalendarDays,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Calendar,
  Users,
  Info,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';

export const LeavesView: React.FC = () => {
  const { leaveBalances, leaveTypes, employees, applyLeave, language, t } = useApp();
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [selectedTypeId, setSelectedTypeId] = useState(leaveTypes[0]?.id || '');
  const [startDate, setStartDate] = useState('2026-09-01');
  const [endDate, setEndDate] = useState('2026-09-05');
  const [totalDays, setTotalDays] = useState(5);
  const [reason, setReason] = useState('');

  const selectedBalance = leaveBalances.find(b => b.leaveTypeId === selectedTypeId);

  const handleApply = () => {
    if (!reason) {
      alert('يرجى كتابة سبب الإجازة');
      return;
    }
    const success = applyLeave({
      leaveTypeId: selectedTypeId,
      startDate,
      endDate,
      totalDays,
      reason,
    });
    if (success) {
      alert('تم تقديم طلب الإجازة وحجز الرصيد بنجاح وتحويله للاعتماد');
      setIsApplyModalOpen(false);
      setReason('');
    } else {
      alert('عذراً، رصيدك المتاح لا يكفي لتغطية عدد الأيام المطلوبة');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            {t.leaves.balance} وإدارة العطلات
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            متابعة أرصدة الإجازات السنوية والمرضية، التقديم، وحجز الرصيد وتقويم إجازات الفريق
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setIsApplyModalOpen(true)}
            size="sm"
            className="font-bold text-xs gap-1.5 bg-primary"
          >
            <Plus className="h-4 w-4" />
            {t.leaves.applyLeave}
          </Button>
        </div>
      </div>

      {/* Leave Balances Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {leaveBalances.map(bal => (
          <div
            key={bal.leaveTypeId}
            className="rounded-xl border bg-card p-4 shadow-sm space-y-3 relative overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-foreground">
                {language === 'ar' ? bal.leaveTypeNameAr : bal.leaveTypeNameEn}
              </span>
              <div
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: bal.color }}
              />
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-foreground">{bal.availableBalance}</span>
              <span className="text-xs text-muted-foreground font-semibold">يوم متاح</span>
            </div>

            <div className="grid grid-cols-3 gap-2 border-t pt-2.5 text-[10px] text-muted-foreground text-center">
              <div>
                <p>المستحق</p>
                <p className="font-bold text-foreground">{bal.annualEntitlement}</p>
              </div>
              <div>
                <p>المستخدم</p>
                <p className="font-bold text-foreground">{bal.usedDays}</p>
              </div>
              <div>
                <p className="text-amber-600">المحجوز</p>
                <p className="font-bold text-amber-600">{bal.reservedDays}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Team Leave Schedule & Policies Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Team Leaves Calendar */}
        <div className="rounded-xl border bg-card p-4 shadow-sm lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              {t.leaves.teamCalendar} (سبتمبر 2026)
            </h2>
            <Badge variant="outline" className="text-[10px]">
              مخطط زمني
            </Badge>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="rounded-lg border bg-muted/20 p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img
                  src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150"
                  alt="محمد"
                  className="h-8 w-8 rounded-full border object-cover"
                />
                <div>
                  <span className="font-bold text-foreground">محمد الشمري</span>
                  <p className="text-[10px] text-muted-foreground">إجازة سنوية (مجدولة)</p>
                </div>
              </div>
              <Badge className="bg-sky-500/10 text-sky-700 border-sky-200 text-[10px]" variant="outline">
                5 سبتمبر - 12 سبتمبر (6 أيام)
              </Badge>
            </div>

            <div className="rounded-lg border bg-muted/20 p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img
                  src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150"
                  alt="نورة"
                  className="h-8 w-8 rounded-full border object-cover"
                />
                <div>
                  <span className="font-bold text-foreground">نورة القحطاني</span>
                  <p className="text-[10px] text-muted-foreground">إجازة سنوية (معتمدة)</p>
                </div>
              </div>
              <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-200 text-[10px]" variant="outline">
                15 سبتمبر - 20 سبتمبر (5 أيام)
              </Badge>
            </div>
          </div>
        </div>

        {/* Leave Policies Info */}
        <div className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2 border-b pb-3">
            <Info className="h-4 w-4 text-primary" />
            سياسات وقواعد الإجازات
          </h2>
          <div className="space-y-2 text-xs text-muted-foreground">
            <p>• الإجازة السنوية تخصم من أيام العمل الفعلية فقط مع استبعاد عطلات نهاية الأسبوع والأعياد الرسمية.</p>
            <p>• يتم حجز الرصيد فور تقديم الطلب لمنع تكرار الحجز.</p>
            <p>• الإجازات المرضية تخضع لشرائح نظام العمل السعودي (أول 30 يوم بأجر كامل، 60 يوم بثلاثة أرباع الأجر).</p>
            <p>• الحد الأقصى لترحيل الإجازة السنوية للعام القادم هو 10 أيام عمل.</p>
          </div>
        </div>
      </div>

      {/* Apply Leave Modal */}
      <Dialog open={isApplyModalOpen} onOpenChange={setIsApplyModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              {t.leaves.applyLeave}
            </DialogTitle>
            <DialogDescription className="text-xs">
              سيتم فحص رصيدك المتاح وحجزه وإرسال الطلب لسلسلة الموافقات
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-xs py-2">
            <div className="space-y-1">
              <label className="font-bold">نوع الإجازة *</label>
              <select
                value={selectedTypeId}
                onChange={e => setSelectedTypeId(e.target.value)}
                className="w-full h-8 rounded border px-2.5"
              >
                {leaveTypes.map(lt => (
                  <option key={lt.id} value={lt.id}>{lt.nameAr}</option>
                ))}
              </select>
            </div>

            {selectedBalance && (
              <div className="rounded-lg border bg-muted/20 p-2.5 flex justify-between text-xs font-semibold">
                <span>رصيدك المتاح حالياً:</span>
                <span className="text-emerald-600 font-bold">{selectedBalance.availableBalance} يوم</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="font-bold">من تاريخ *</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full h-8 rounded border px-2.5"
                />
              </div>
              <div className="space-y-1">
                <label className="font-bold">إلى تاريخ *</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full h-8 rounded border px-2.5"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-bold">عدد أيام الإجازة *</label>
              <input
                type="number"
                min="1"
                max="30"
                value={totalDays}
                onChange={e => setTotalDays(Number(e.target.value))}
                className="w-full h-8 rounded border px-2.5"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold">سبب الإجازة *</label>
              <textarea
                rows={2}
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="اكتب سبب طلب الإجازة..."
                className="w-full rounded border p-2 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button size="sm" onClick={handleApply} className="text-xs bg-primary font-bold">
              تأكيد وإرسال الطلب
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
