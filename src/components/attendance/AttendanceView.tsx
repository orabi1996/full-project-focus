import React, { useState } from 'react';
import { useApp } from '../../lib/context/AppContext';
import {
  Clock,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Download,
  Filter,
  Search,
  Plus,
  Compass,
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

export const AttendanceView: React.FC = () => {
  const {
    attendanceRecords,
    currentUser,
    punchInOut,
    submitAttendanceCorrection,
    language,
    t,
  } = useApp();

  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false);
  const [correctionDate, setCorrectionDate] = useState('2026-08-30');
  const [correctInTime, setCorrectInTime] = useState('08:00');
  const [correctOutTime, setCorrectOutTime] = useState('17:00');
  const [correctionReason, setCorrectionReason] = useState('');

  const handlePunch = (type: 'in' | 'out') => {
    // Get browser geolocation if available
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          const res = punchInOut(type, { lat: pos.coords.latitude, lng: pos.coords.longitude });
          alert(`${res.message} • ${res.geofenceValid ? 'داخل السياج الجغرافي' : 'خارج النطاق'}`);
        },
        () => {
          const res = punchInOut(type);
          alert(res.message);
        }
      );
    } else {
      const res = punchInOut(type);
      alert(res.message);
    }
  };

  const handleSubmitCorrection = () => {
    if (!correctionReason) {
      alert('يرجى كتابة سبب تصحيح البصمة');
      return;
    }
    submitAttendanceCorrection({
      workDate: correctionDate,
      correctIn: correctInTime,
      correctOut: correctOutTime,
      reason: correctionReason,
    });
    alert('تم إرسال طلب تصحيح البصمة بنجاح للاعتماد');
    setIsCorrectionModalOpen(false);
    setCorrectionReason('');
  };

  return (
    <div className="space-y-6">
      {/* Header & Punch Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            {t.attendance.liveDashboard} (اليوم)
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            مراقبة الحضور اللحظية، السياج الجغرافي GPS، معالجة التأخير وكشوف الحضور الشهرية
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            onClick={() => handlePunch('in')}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 shadow-sm"
          >
            <Clock className="h-4 w-4" />
            {t.attendance.checkIn}
          </Button>
          <Button
            onClick={() => handlePunch('out')}
            variant="outline"
            className="font-bold text-xs gap-1.5 text-foreground hover:bg-muted"
          >
            <Clock className="h-4 w-4 text-amber-600" />
            {t.attendance.checkOut}
          </Button>
          <Button
            onClick={() => setIsCorrectionModalOpen(true)}
            variant="secondary"
            size="sm"
            className="text-xs font-bold gap-1"
          >
            {t.attendance.correctionRequest}
          </Button>
        </div>
      </div>

      {/* Attendance Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <span className="text-xs font-semibold text-muted-foreground">إجمالي المجدولين</span>
          <p className="text-2xl font-black text-foreground mt-2">120 موظف</p>
          <span className="text-[10px] text-emerald-600 font-bold">100% مناوبات مغطاة</span>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <span className="text-xs font-semibold text-muted-foreground">حضور فعلي مسجل</span>
          <p className="text-2xl font-black text-emerald-600 mt-2">
            {attendanceRecords.filter(a => a.status === 'present').length + 112}
          </p>
          <span className="text-[10px] text-muted-foreground">93.3% نسبة الالتزام</span>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <span className="text-xs font-semibold text-muted-foreground">تأخير وخروج مبكر</span>
          <p className="text-2xl font-black text-amber-600 mt-2">
            {attendanceRecords.filter(a => a.status === 'late').length}
          </p>
          <span className="text-[10px] text-amber-600 font-medium">ضمن فترة السماح</span>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <span className="text-xs font-semibold text-muted-foreground">غياب وإجازات</span>
          <p className="text-2xl font-black text-blue-600 mt-2">
            {attendanceRecords.filter(a => a.status === 'absent').length + 7}
          </p>
          <span className="text-[10px] text-muted-foreground">معتمد رسمياً</span>
        </div>
      </div>

      {/* Daily Attendance Sheet Table */}
      <div className="rounded-xl border bg-card overflow-hidden shadow-sm space-y-3">
        <div className="p-4 border-b flex flex-col sm:flex-row justify-between items-center gap-3">
          <h2 className="text-sm font-bold text-foreground">
            {t.attendance.dailySummary} • {new Date().toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')}
          </h2>
          <Button variant="outline" size="sm" className="h-8 text-xs font-medium gap-1">
            <Download className="h-3.5 w-3.5" />
            {t.export} كشف الحضور (Excel)
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b bg-muted/40 font-bold text-muted-foreground">
              <tr>
                <th className="py-3 px-4 text-start">الموظف</th>
                <th className="py-3 px-4 text-start">الوردية المجدولة</th>
                <th className="py-3 px-4 text-start">{t.attendance.checkInTime}</th>
                <th className="py-3 px-4 text-start">{t.attendance.checkOutTime}</th>
                <th className="py-3 px-4 text-start">{t.attendance.workedHours}</th>
                <th className="py-3 px-4 text-start">السياج GPS</th>
                <th className="py-3 px-4 text-start">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {attendanceRecords.map(rec => (
                <tr key={rec.id} className="hover:bg-muted/20">
                  <td className="py-3 px-4">
                    <span className="font-bold text-foreground">{rec.employeeName}</span>
                    <p className="text-[10px] text-muted-foreground font-mono">{rec.employeeNo}</p>
                  </td>
                  <td className="py-3 px-4 text-muted-foreground">{rec.scheduledShift || 'الوردية الصباحية'}</td>
                  <td className="py-3 px-4 font-mono font-bold text-foreground">{rec.actualIn || '—'}</td>
                  <td className="py-3 px-4 font-mono font-bold text-foreground">{rec.actualOut || '—'}</td>
                  <td className="py-3 px-4 font-semibold text-foreground">{rec.workedHours} س</td>
                  <td className="py-3 px-4">
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        rec.geofenceValid
                          ? 'bg-emerald-500/10 text-emerald-700 border-emerald-200'
                          : 'bg-destructive/10 text-destructive border-destructive/20'
                      }`}
                    >
                      {rec.geofenceValid ? 'داخل النطاق' : 'خارج النطاق'}
                    </Badge>
                  </td>
                  <td className="py-3 px-4">
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        rec.status === 'present'
                          ? 'bg-emerald-500/10 text-emerald-700 border-emerald-200'
                          : rec.status === 'late'
                          ? 'bg-amber-500/10 text-amber-700 border-amber-200'
                          : 'bg-destructive/10 text-destructive border-destructive/20'
                      }`}
                    >
                      {rec.status === 'present' ? 'حاضر في الموعد' : rec.status === 'late' ? `متأخر (${rec.lateMinutes} د)` : 'غائب'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Attendance Correction Modal */}
      <Dialog open={isCorrectionModalOpen} onOpenChange={setIsCorrectionModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              {t.attendance.correctionRequest}
            </DialogTitle>
            <DialogDescription className="text-xs">
              تقديم طلب لتعديل وقت الحضور أو الانصراف مع إرفاق المبرر للموافقة
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-xs py-2">
            <div className="space-y-1">
              <label className="font-bold">تاريخ اليوم المراد تصحيحه *</label>
              <input
                type="date"
                value={correctionDate}
                onChange={e => setCorrectionDate(e.target.value)}
                className="w-full h-8 rounded border px-2.5"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="font-bold">وقت الدخول الصحيح</label>
                <input
                  type="time"
                  value={correctInTime}
                  onChange={e => setCorrectInTime(e.target.value)}
                  className="w-full h-8 rounded border px-2.5"
                />
              </div>
              <div className="space-y-1">
                <label className="font-bold">وقت الخروج الصحيح</label>
                <input
                  type="time"
                  value={correctOutTime}
                  onChange={e => setCorrectOutTime(e.target.value)}
                  className="w-full h-8 rounded border px-2.5"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-bold">سبب عدم التسجيل أو التصحيح *</label>
              <textarea
                rows={2}
                value={correctionReason}
                onChange={e => setCorrectionReason(e.target.value)}
                placeholder="مثال: نسيان البصمة بسبب اجتماع عمل خارجي..."
                className="w-full rounded border p-2 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button size="sm" onClick={handleSubmitCorrection} className="text-xs bg-primary font-bold">
              إرسال طلب التصحيح
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
