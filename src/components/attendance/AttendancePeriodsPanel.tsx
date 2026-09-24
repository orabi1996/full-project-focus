import React, { useState } from "react";
import {
  Calendar,
  Lock,
  Unlock,
  ShieldCheck,
  Hash,
  Clock,
  AlertCircle,
  FileCheck,
  ChevronRight,
  Eye,
} from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  useAttendancePeriods,
  useAttendancePayrollSnapshots,
  useAttendanceMutations,
} from "../../lib/domains/attendance";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";

interface Props {
  canManage: boolean;
}

export const AttendancePeriodsPanel: React.FC<Props> = ({ canManage }) => {
  const { periods, isLoading } = useAttendancePeriods();
  const { closePeriod, reopenPeriod } = useAttendanceMutations();

  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);
  const { snapshots, isLoading: isLoadingSnapshots } = useAttendancePayrollSnapshots(
    selectedPeriodId || undefined,
  );

  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [isReopenModalOpen, setIsReopenModalOpen] = useState(false);
  const [targetPeriodId, setTargetPeriodId] = useState<string | null>(null);
  const [reopenReason, setReopenReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirmClose = async () => {
    if (!targetPeriodId) return;
    setIsSubmitting(true);
    try {
      await closePeriod(targetPeriodId);
      setIsCloseModalOpen(false);
      setTargetPeriodId(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmReopen = async () => {
    if (!targetPeriodId || !reopenReason.trim()) return;
    setIsSubmitting(true);
    try {
      await reopenPeriod(targetPeriodId, reopenReason.trim());
      setIsReopenModalOpen(false);
      setTargetPeriodId(null);
      setReopenReason("");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        جاري تحميل فترات وإغلاقات الدوام…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Informational banner */}
      <div className="p-4 rounded-2xl border border-indigo-500/20 bg-indigo-500/5 flex items-start gap-3">
        <Lock className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <span className="font-bold text-indigo-900 dark:text-indigo-300 block">
            دورة الإغلاق الشهري وحصانة مسير الرواتب (Immutable Attendance Snapshot)
          </span>
          <p className="text-muted-foreground leading-relaxed">
            عند إغلاق فترة الحضور الشهرية، يقوم النظام آليًا بتوليد لقطة بيانات نهائية غير قابلة للتعديل وتوثيقها بختم تشفير رقمي (SHA-256 Hash)، لمنع أي تلاعب في ساعات العمل أو الإضافي بعد ترحيلها إلى مسير الرواتب.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Periods List */}
        <div className="lg:col-span-1 rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-bold text-sm text-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              فترات الدوام الشهرية
            </span>
            <Badge variant="outline" className="text-[10px] rounded-full">
              {periods.length} فترة
            </Badge>
          </div>

          <div className="space-y-3">
            {periods.length === 0 ? (
              <div className="text-center py-8 text-xs text-muted-foreground">
                لا توجد فترات حضور مسجلة حاليًا
              </div>
            ) : (
              periods.map((p) => {
                const isSelected = p.id === selectedPeriodId;
                const isClosed = p.status === "closed";
                return (
                  <div
                    key={p.id}
                    onClick={() => setSelectedPeriodId(p.id)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-3 ${
                      isSelected
                        ? "border-primary bg-primary/5 shadow-xs"
                        : "border-border/60 hover:border-border hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-xs text-foreground">
                        دورة {p.periodMonth} / {p.periodYear}
                      </div>
                      <Badge
                        className={`text-[10px] rounded-full font-bold ${
                          isClosed
                            ? "bg-emerald-500/10 text-emerald-700 border-emerald-300"
                            : p.status === "reopened"
                            ? "bg-amber-500/10 text-amber-700 border-amber-300"
                            : "bg-blue-500/10 text-blue-700 border-blue-300"
                        }`}
                      >
                        {isClosed ? "مغلقة وموثقة" : p.status === "reopened" ? "مُعاد فتحها" : "مفتوحة ونشطة"}
                      </Badge>
                    </div>

                    <div className="text-[11px] text-muted-foreground font-mono">
                      من {p.fromDate} إلى {p.toDate}
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[10px]">
                      <span className="text-muted-foreground">
                        {isClosed ? "محمية من التعديل" : "قابلة للمراجعة"}
                      </span>
                      {canManage && (
                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          {!isClosed ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setTargetPeriodId(p.id);
                                setIsCloseModalOpen(true);
                              }}
                              className="h-6 text-[10px] px-2.5 rounded-lg border-emerald-300 text-emerald-700 hover:bg-emerald-50 gap-1"
                            >
                              <Lock className="h-3 w-3" />
                              إغلاق الدورة
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setTargetPeriodId(p.id);
                                setIsReopenModalOpen(true);
                              }}
                              className="h-6 text-[10px] px-2.5 rounded-lg border-amber-300 text-amber-700 hover:bg-amber-50 gap-1"
                            >
                              <Unlock className="h-3 w-3" />
                              إعادة فتح
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Snapshots & Details */}
        <div className="lg:col-span-2 rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-bold text-sm text-foreground flex items-center gap-2">
                <FileCheck className="h-4 w-4 text-emerald-600" />
                بيانات لقطة مسير الرواتب المعتمدة
              </span>
              <span className="text-xs text-muted-foreground">
                {selectedPeriodId
                  ? "السجلات الموثقة بالختم الرقمي للفترة المحددة"
                  : "يرجى اختيار فترة من القائمة الجانبية لعرض لقطة بياناتها"}
              </span>
            </div>
            {selectedPeriodId && (
              <Badge variant="outline" className="text-xs rounded-full gap-1 font-mono">
                <Hash className="h-3 w-3 text-muted-foreground" />
                {snapshots.length} موظف
              </Badge>
            )}
          </div>

          {!selectedPeriodId ? (
            <div className="p-12 text-center text-xs text-muted-foreground border border-dashed rounded-2xl">
              اختر دورة حضور من القائمة لعرض تفاصيل ساعات العمل، التأخير، والإضافي المحسوب للرواتب
            </div>
          ) : isLoadingSnapshots ? (
            <div className="p-12 text-center text-xs text-muted-foreground">
              جاري استرجاع بيانات اللقطة المعتمدة…
            </div>
          ) : snapshots.length === 0 ? (
            <div className="p-12 text-center text-xs text-muted-foreground border border-dashed rounded-2xl space-y-2">
              <AlertCircle className="h-8 w-8 text-amber-500 mx-auto" />
              <p className="font-medium text-foreground">لم يتم إنشاء لقطة معتمدة لهذه الدورة بعد</p>
              <p className="text-[11px]">سيتم توليد اللقطة وتثبيت ساعات العمل آليًا بمجرد إغلاق الدورة من قبل الموارد البشرية.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-border/60">
              <table className="w-full text-right text-xs">
                <thead className="bg-muted/50 text-muted-foreground font-semibold border-b border-border/60">
                  <tr>
                    <th className="p-3">الموظف</th>
                    <th className="p-3 text-center">أيام الحضور</th>
                    <th className="p-3 text-center">أيام الغياب</th>
                    <th className="p-3 text-center">دقائق التأخير</th>
                    <th className="p-3 text-center">ساعات العمل</th>
                    <th className="p-3 text-center">إضافي عادي (1.5x)</th>
                    <th className="p-3 text-center">إضافي عطلات (2.0x)</th>
                    <th className="p-3 text-center">الختم الرقمي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {snapshots.map((s) => (
                    <tr key={s.id} className="hover:bg-muted/20">
                      <td className="p-3">
                        <span className="font-bold text-foreground block">{s.employeeName}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">{s.employeeNo}</span>
                      </td>
                      <td className="p-3 text-center font-bold text-emerald-700">{s.totalPresentDays}</td>
                      <td className="p-3 text-center font-bold text-rose-700">{s.totalAbsentDays}</td>
                      <td className="p-3 text-center font-mono">{s.totalLateMinutes} د</td>
                      <td className="p-3 text-center font-mono font-bold">{s.totalWorkedHours} س</td>
                      <td className="p-3 text-center font-mono font-bold text-indigo-700">{s.regularOvertimeHours} س</td>
                      <td className="p-3 text-center font-mono font-bold text-purple-700">{s.holidayOvertimeHours} س</td>
                      <td className="p-3 text-center">
                        <span
                          title={s.snapshotHash}
                          className="font-mono text-[9px] bg-muted/60 px-1.5 py-0.5 rounded text-muted-foreground block truncate max-w-[90px] mx-auto cursor-help"
                        >
                          {s.snapshotHash.slice(0, 8)}…
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Close Period Confirmation Modal */}
      <Dialog open={isCloseModalOpen} onOpenChange={setIsCloseModalOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground font-bold">
              <Lock className="h-5 w-5 text-emerald-600" />
              تأكيد إغلاق دورة الحضور الشهرية
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed pt-2">
              سيؤدي إغلاق الدورة إلى حظر أي تعديل أو بصمة على الأيام المشمولة، وتثبيت لقطة معتمدة برقم تشفير رقمي موثق لمسير الرواتب.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:justify-start pt-4">
            <Button
              onClick={handleConfirmClose}
              disabled={isSubmitting}
              className="rounded-2xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5"
            >
              {isSubmitting ? "جاري الإغلاق…" : "تأكيد الإغلاق والاعتماد"}
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsCloseModalOpen(false)}
              className="rounded-2xl text-xs"
            >
              إلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reopen Period Confirmation Modal */}
      <Dialog open={isReopenModalOpen} onOpenChange={setIsReopenModalOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground font-bold">
              <Unlock className="h-5 w-5 text-amber-600" />
              إعادة فتح دورة حضور مغلقة
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed pt-2">
              يتطلب إعادة فتح دورة مغلقة تسجيل سبب تدقيقي رسمي. سيتم تسجيل اسم المستخدم وتاريخ العملية في سجل التدقيق الأمني.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-2">
            <label className="text-xs font-bold text-foreground block">
              سبب إعادة فتح الدورة *
            </label>
            <textarea
              rows={3}
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
              placeholder="اكتب سبب إعادة الفتح (مثلاً: تصحيح ساعات عمل إضافي معتمدة متأخرة)…"
              className="w-full p-3 rounded-2xl border border-border bg-background text-xs text-foreground focus:ring-2 focus:ring-primary/20 outline-none"
            />
          </div>

          <DialogFooter className="gap-2 sm:justify-start pt-4">
            <Button
              onClick={handleConfirmReopen}
              disabled={isSubmitting || !reopenReason.trim()}
              className="rounded-2xl font-bold bg-amber-600 hover:bg-amber-700 text-white text-xs gap-1.5"
            >
              {isSubmitting ? "جاري الحفظ…" : "تأكيد إعادة الفتح"}
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsReopenModalOpen(false)}
              className="rounded-2xl text-xs"
            >
              إلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
