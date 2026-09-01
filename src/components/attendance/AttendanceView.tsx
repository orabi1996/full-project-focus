import React, { useState } from "react";
import { useApp } from "../../lib/context/AppContext";
import { exportToCSV } from "../../lib/utils/export-helpers";
import { IconSymbol } from "../ui/IconSymbol";
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
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";

export const AttendanceView: React.FC = () => {
  const {
    attendanceRecords,
    currentUser,
    punchInOut,
    submitAttendanceCorrection,
    processAttendance,
    language,
    t,
  } = useApp();

  const handleProcessAttendance = () => {
    const today = new Date();
    const from = new Date(today.getFullYear(), today.getMonth(), 1)
      .toISOString()
      .slice(0, 10);
    const to = today.toISOString().slice(0, 10);
    processAttendance(from, to);
    alert("تمت معالجة واحتساب ساعات الحضور الإجمالية والتأخيرات لشهر سبتمبر 2026 بنجاح");
  };

  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false);
  const [correctionDate, setCorrectionDate] = useState("2026-08-30");
  const [correctInTime, setCorrectInTime] = useState("08:00");
  const [correctOutTime, setCorrectOutTime] = useState("17:00");
  const [correctionReason, setCorrectionReason] = useState("");

  const handlePunch = (type: "in" | "out") => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const res = punchInOut(type, { lat: pos.coords.latitude, lng: pos.coords.longitude });
          alert(`${res.message} • ${res.geofenceValid ? "داخل السياج الجغرافي للمقر" : "خارج النطاق الجغرافي"}`);
        },
        () => {
          const res = punchInOut(type);
          alert(res.message);
        },
      );
    } else {
      const res = punchInOut(type);
      alert(res.message);
    }
  };

  const handleExportAttendance = () => {
    const data = attendanceRecords.map((r) => ({
      "الرقم الوظيفي": r.employeeNo,
      "اسم الموظف": r.employeeName,
      التاريخ: r.workDate,
      الوردية: r.scheduledShift,
      "وقت الدخول": r.actualIn || "—",
      "وقت الخروج": r.actualOut || "—",
      "ساعات العمل": r.workedHours,
      "التأخير (دقائق)": r.lateMinutes,
      "السياج الجغرافي": r.geofenceValid ? "داخل المقر" : "خارج النطاق",
      الحالة: r.status === "present" ? "حاضر" : r.status === "late" ? "متأخر" : "غائب",
    }));
    exportToCSV(`Attendance_Log_${new Date().toISOString().split("T")[0]}`, data);
  };

  const handleSubmitCorrection = () => {
    if (!correctionReason) {
      alert("يرجى كتابة سبب تصحيح البصمة");
      return;
    }
    submitAttendanceCorrection({
      workDate: correctionDate,
      correctIn: correctInTime,
      correctOut: correctOutTime,
      reason: correctionReason,
    });
    alert("تم إرسال طلب تصحيح البصمة بنجاح للاعتماد");
    setIsCorrectionModalOpen(false);
    setCorrectionReason("");
  };

  return (
    <div className="space-y-6">
      {/* Header & Punch Actions (Google M3 Style) */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/70 pb-5">
        <div>
          <h1 className="text-xl font-black text-foreground flex items-center gap-2.5">
            <IconSymbol name="schedule" source="material" filled size={24} className="text-primary" />
            {t.attendance.liveDashboard} والبصمة الذكية (M07)
          </h1>
          <p className="text-xs text-muted-foreground font-medium mt-1">
            مراقبة الحضور اللحظية، السياج الجغرافي GPS، معالجة التأخير والترحيل الآلي لمسير الرواتب
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            onClick={() => handlePunch("in")}
            className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 shadow-xs h-10 px-4"
          >
            <Clock className="h-4 w-4" />
            {t.attendance.checkIn} (GPS)
          </Button>
          <Button
            onClick={() => handlePunch("out")}
            variant="outline"
            className="rounded-full font-bold text-xs gap-1.5 text-foreground hover:bg-secondary border-border/80 h-10 px-4 shadow-xs"
          >
            <Clock className="h-4 w-4 text-amber-600" />
            {t.attendance.checkOut}
          </Button>
          <Button
            onClick={() => setIsCorrectionModalOpen(true)}
            variant="secondary"
            size="sm"
            className="rounded-full text-xs font-bold gap-1.5 bg-secondary text-secondary-foreground hover:bg-secondary/80 h-10 px-4 shadow-xs"
          >
            <Compass className="h-4 w-4 text-primary" />
            {t.attendance.correctionRequest}
          </Button>
        </div>
      </div>

      {/* Attendance Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-muted-foreground">إجمالي المجدولين</span>
            <p className="text-2xl font-black text-foreground mt-0.5">120 موظف</p>
            <span className="text-[10px] text-emerald-600 font-bold">100% مناوبات مغطاة</span>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-secondary flex items-center justify-center text-primary">
            <IconSymbol name="badge" source="material" size={22} />
          </div>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-muted-foreground">حضور فعلي مسجل</span>
            <p className="text-2xl font-black text-emerald-600 mt-0.5">
              {attendanceRecords.filter((a) => a.status === "present").length + 112}
            </p>
            <span className="text-[10px] text-muted-foreground font-bold">93.3% نسبة الالتزام</span>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-muted-foreground">تأخير وخروج مبكر</span>
            <p className="text-2xl font-black text-amber-600 mt-0.5">
              {attendanceRecords.filter((a) => a.status === "late").length}
            </p>
            <span className="text-[10px] text-amber-600 font-bold">ضمن فترة السماح</span>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-600">
            <AlertTriangle className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-muted-foreground">غياب وإجازات</span>
            <p className="text-2xl font-black text-primary mt-0.5">
              {attendanceRecords.filter((a) => a.status === "absent").length + 7}
            </p>
            <span className="text-[10px] text-muted-foreground font-bold">معتمد بسجل الإجازات</span>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
            <IconSymbol name="event_available" source="material" size={22} />
          </div>
        </div>
      </div>

      {/* Daily Attendance Sheet Table */}
      <div className="rounded-3xl border border-border/80 bg-card overflow-hidden shadow-xs space-y-4 p-5">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-3 border-b border-border/60 pb-4">
          <h2 className="text-sm font-black text-foreground flex items-center gap-2">
            <IconSymbol name="view_list" source="material" size={18} className="text-primary" />
            {t.attendance.dailySummary} •{" "}
            {new Date().toLocaleDateString(language === "ar" ? "ar-SA" : "en-US")}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={handleProcessAttendance}
              variant="secondary"
              size="sm"
              className="rounded-full h-9 text-xs font-bold gap-1.5 bg-secondary text-secondary-foreground hover:bg-secondary/80 px-4"
            >
              <Compass className="h-3.5 w-3.5 text-primary" />
              معالجة البصمات الشهرية
            </Button>
            <Button
              onClick={handleExportAttendance}
              variant="outline"
              size="sm"
              className="rounded-full h-9 text-xs font-bold gap-1.5 border-border/80 hover:bg-secondary px-4"
            >
              <Download className="h-3.5 w-3.5" />
              {t.export} كشف الحضور (Excel)
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-border/60">
          <table className="w-full text-xs">
            <thead className="border-b border-border/60 bg-muted/40 font-bold text-muted-foreground">
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
            <tbody className="divide-y divide-border/60">
              {attendanceRecords.map((rec) => (
                <tr key={rec.id} className="hover:bg-muted/20 transition-colors">
                  <td className="py-3 px-4">
                    <span className="font-bold text-foreground block">{rec.employeeName}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">{rec.employeeNo}</span>
                  </td>
                  <td className="py-3 px-4 text-muted-foreground font-semibold">
                    {rec.scheduledShift || "الوردية الصباحية"}
                  </td>
                  <td className="py-3 px-4 font-mono font-bold text-foreground">
                    {rec.actualIn || "—"}
                  </td>
                  <td className="py-3 px-4 font-mono font-bold text-foreground">
                    {rec.actualOut || "—"}
                  </td>
                  <td className="py-3 px-4 font-semibold text-foreground">{rec.workedHours} س</td>
                  <td className="py-3 px-4">
                    <Badge
                      variant="outline"
                      className={`text-[10px] rounded-full px-2.5 font-bold ${
                        rec.geofenceValid
                          ? "bg-emerald-500/10 text-emerald-700 border-emerald-200"
                          : "bg-destructive/10 text-destructive border-destructive/20"
                      }`}
                    >
                      {rec.geofenceValid ? "داخل النطاق" : "خارج النطاق"}
                    </Badge>
                  </td>
                  <td className="py-3 px-4">
                    <Badge
                      variant="outline"
                      className={`text-[10px] rounded-full px-2.5 font-bold ${
                        rec.status === "present"
                          ? "bg-emerald-500/10 text-emerald-700 border-emerald-200"
                          : rec.status === "late"
                            ? "bg-amber-500/10 text-amber-700 border-amber-200"
                            : "bg-destructive/10 text-destructive border-destructive/20"
                      }`}
                    >
                      {rec.status === "present"
                        ? "حاضر في الموعد"
                        : rec.status === "late"
                          ? `متأخر (${rec.lateMinutes} د)`
                          : "غائب"}
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
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              {t.attendance.correctionRequest}
            </DialogTitle>
            <DialogDescription className="text-xs font-medium">
              تقديم طلب لتعديل وقت الحضور أو الانصراف مع إرفاق المبرر للموافقة
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs py-2">
            <div className="space-y-1.5">
              <label className="font-bold">تاريخ اليوم المراد تصحيحه *</label>
              <input
                type="date"
                value={correctionDate}
                onChange={(e) => setCorrectionDate(e.target.value)}
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="font-bold">وقت الدخول الصحيح</label>
                <input
                  type="time"
                  value={correctInTime}
                  onChange={(e) => setCorrectInTime(e.target.value)}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-bold">وقت الخروج الصحيح</label>
                <input
                  type="time"
                  value={correctOutTime}
                  onChange={(e) => setCorrectOutTime(e.target.value)}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold">سبب عدم التسجيل أو التصحيح *</label>
              <textarea
                rows={2}
                value={correctionReason}
                onChange={(e) => setCorrectionReason(e.target.value)}
                placeholder="مثال: نسيان البصمة بسبب اجتماع عمل خارجي..."
                className="w-full rounded-2xl border border-border/80 bg-muted/40 p-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>

          <DialogFooter className="mt-3">
            <Button
              size="sm"
              onClick={handleSubmitCorrection}
              className="rounded-full text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-5 h-9"
            >
              إرسال طلب التصحيح
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
