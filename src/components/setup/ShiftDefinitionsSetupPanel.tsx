import React, { useState } from "react";
import { useApp } from "../../lib/context/AppContext";
import { canManageModule } from "../../lib/auth/permissions";
import { Clock, Plus, CheckCircle2, Trash2, Pencil, Calendar } from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";

export const ShiftDefinitionsSetupPanel: React.FC = () => {
  const { shifts, addShift, currentRole, language } = useApp();
  const canManage = canManageModule(currentRole, "shifts");

  const [isAddShiftOpen, setIsAddShiftOpen] = useState(false);
  const [shiftName, setShiftName] = useState("");
  const [shiftStartTime, setShiftStartTime] = useState("08:00");
  const [shiftEndTime, setShiftEndTime] = useState("17:00");
  const [shiftGraceArrival, setShiftGraceArrival] = useState(15);
  const [shiftType, setShiftType] = useState<"fixed" | "flexible" | "split">("fixed");
  const [isOvertimeEligible, setIsOvertimeEligible] = useState(true);
  const [isCreatingShift, setIsCreatingShift] = useState(false);

  const handleCreateShift = async () => {
    if (!shiftName.trim()) {
      toast.error("يرجى إدخال اسم الوردية");
      return;
    }

    setIsCreatingShift(true);
    try {
      const created = await addShift({
        code: `SH-${Math.floor(10 + Math.random() * 90)}`,
        nameAr: shiftName.trim(),
        nameEn: shiftName.trim(),
        type: shiftType,
        startTime: shiftStartTime,
        endTime: shiftEndTime,
        graceMinutesArrival: shiftGraceArrival,
        graceMinutesDeparture: 15,
        color: "#0284c7",
        overtimeEligible: isOvertimeEligible,
        allowSinglePunch: false,
      });

      if (created) {
        toast.success("تم تعريف وردية العمل بنجاح");
        setIsAddShiftOpen(false);
        setShiftName("");
      }
    } catch {
      toast.error("حدث خطأ أثناء حفظ الوردية");
    } finally {
      setIsCreatingShift(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
        <div>
          <h2 className="text-base font-black text-foreground flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            تعريف سياسات وورديات العمل لشركة «الأندلس»
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            هذه الشاشة مخصصة فقط لتهيئة سياسات الورديات وقواعد ساعات العمل دون الدخول في العمليات اليومية أو جداول التوزيع الأسبوعية.
          </p>
        </div>

        {canManage && (
          <Button
            size="sm"
            onClick={() => setIsAddShiftOpen(true)}
            className="rounded-full text-xs font-bold gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 cursor-pointer shadow-xs"
          >
            <Plus className="h-4 w-4" />
            تعريف وردية جديدة
          </Button>
        )}
      </div>

      {/* Shifts Grid */}
      {shifts.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border/80 bg-card p-12 text-center">
          <div className="flex flex-col items-center justify-center gap-3">
            <div className="h-14 w-14 rounded-2xl bg-muted/60 flex items-center justify-center text-muted-foreground">
              <Clock className="h-7 w-7" />
            </div>
            <p className="font-bold text-foreground text-sm">
              لم يتم تعريف أي ورديات عمل بعد بشركة «الأندلس»
            </p>
            <p className="text-xs text-muted-foreground max-w-md">
              قم بتهيئة الورديات الأساسية (الدوام الصباحي، الورديات المسائية، أو الدوام المرن) لتعتمد عليها لاحقاً في الحضور والانصراف.
            </p>
            {canManage && (
              <Button
                size="sm"
                onClick={() => setIsAddShiftOpen(true)}
                className="rounded-full text-xs font-bold gap-2 mt-2 cursor-pointer shadow-xs"
              >
                <Plus className="h-4 w-4" />
                تعريف أول وردية الآن
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {shifts.map((sh) => (
            <div
              key={sh.id}
              className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-3.5 relative overflow-hidden hover:border-primary/40 transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className="h-3.5 w-3.5 rounded-full shadow-xs"
                    style={{ backgroundColor: sh.color || "#0284c7" }}
                  />
                  <h3 className="font-black text-xs text-foreground">
                    {language === "ar" ? sh.nameAr : sh.nameEn}
                  </h3>
                </div>
                <Badge variant="outline" className="text-[10px] rounded-full px-2.5 font-bold">
                  {sh.type === "fixed" ? "ثابت" : sh.type === "flexible" ? "مرن" : "فترتان"}
                </Badge>
              </div>

              <div className="rounded-2xl border border-border/60 bg-muted/20 p-3.5 text-xs space-y-2 font-mono">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">أوقات العمل:</span>
                  <span className="font-bold text-foreground">
                    {sh.startTime} - {sh.endTime}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">فترة السماح (حضور):</span>
                  <span className="font-bold text-emerald-600">
                    +{sh.graceMinutesArrival} دقيقة
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">احتساب الإضافي:</span>
                  <span className="font-bold text-primary">
                    {sh.overtimeEligible ? "مفعل (المادة 107)" : "غير مفعل"}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Shift Dialog */}
      <Dialog open={isAddShiftOpen} onOpenChange={setIsAddShiftOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-black">تعريف وردية عمل جديدة</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              حدد مواعيد بداية ونهاية العمل وفترات السماح لنظام الحضور الذكي.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="space-y-1.5">
              <label className="font-bold text-foreground">اسم الوردية:</label>
              <input
                type="text"
                value={shiftName}
                onChange={(e) => setShiftName(e.target.value)}
                placeholder="مثال: الدوام الصباحي الرئيسي"
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="font-bold text-foreground">وقت البدء:</label>
                <input
                  type="time"
                  value={shiftStartTime}
                  onChange={(e) => setShiftStartTime(e.target.value)}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 font-mono text-xs outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-bold text-foreground">وقت الانتهاء:</label>
                <input
                  type="time"
                  value={shiftEndTime}
                  onChange={(e) => setShiftEndTime(e.target.value)}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 font-mono text-xs outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="font-bold text-foreground">نوع الوردية:</label>
                <select
                  value={shiftType}
                  onChange={(e) => setShiftType(e.target.value as any)}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="fixed">دوام ثابت</option>
                  <option value="flexible">دوام مرن</option>
                  <option value="split">فترتان (صباحي / مسائي)</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="font-bold text-foreground">سماح التأخير (دقائق):</label>
                <input
                  type="number"
                  min={0}
                  max={60}
                  value={shiftGraceArrival}
                  onChange={(e) => setShiftGraceArrival(Number(e.target.value))}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 font-mono text-xs outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAddShiftOpen(false)}
              className="rounded-full text-xs font-bold"
            >
              إلغاء
            </Button>
            <Button
              size="sm"
              disabled={isCreatingShift}
              onClick={handleCreateShift}
              className="rounded-full text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isCreatingShift ? "جاري الحفظ..." : "حفظ الوردية"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
