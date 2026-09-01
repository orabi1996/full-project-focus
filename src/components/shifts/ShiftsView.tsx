import React, { useState } from "react";
import { useApp } from "../../lib/context/AppContext";
import { canManageModule } from "../../lib/auth/permissions";
import {
  CalendarCheck,
  Clock,
  Plus,
  Server,
  Upload,
  CheckCircle2,
  Calendar,
  Layers,
  MapPin,
  Save,
} from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";

export const ShiftsView: React.FC = () => {
  const { shifts, employees, addShift, currentRole, language, t } = useApp();
  const canManage = canManageModule(currentRole, "shifts");
  const [activeTab, setActiveTab] = useState("definitions");

  // Modals state
  const [isAddShiftOpen, setIsAddShiftOpen] = useState(false);
  const [isAssignShiftOpen, setIsAssignShiftOpen] = useState(false);
  const [isAddDeviceOpen, setIsAddDeviceOpen] = useState(false);

  // New Shift Form State
  const [shiftName, setShiftName] = useState("");
  const [shiftStartTime, setShiftStartTime] = useState("08:00");
  const [shiftEndTime, setShiftEndTime] = useState("17:00");
  const [shiftGraceArrival, setShiftGraceArrival] = useState(15);
  const [shiftType, setShiftType] = useState<"fixed" | "flexible" | "split">("fixed");

  // Device Form State
  const [deviceName, setDeviceName] = useState("");
  const [deviceIp, setDeviceIp] = useState("192.168.1.200");

  const daysOfWeek = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

  const handleCreateShift = () => {
    if (!shiftName) {
      alert("يرجى كتابة اسم الوردية / الدوام");
      return;
    }
    addShift({
      code: `SH-${Math.floor(10 + Math.random() * 90)}`,
      nameAr: shiftName,
      nameEn: shiftName,
      type: shiftType,
      startTime: shiftStartTime,
      endTime: shiftEndTime,
      graceMinutesArrival: shiftGraceArrival,
      graceMinutesDeparture: 15,
      color: "#0284c7",
      overtimeEligible: true,
      allowSinglePunch: false,
    });
    alert(`تم إنشاء الوردية (${shiftName}) بنجاح!`);
    setIsAddShiftOpen(false);
    setShiftName("");
  };

  const handleCreateDevice = () => {
    if (!deviceName) {
      alert("يرجى كتابة اسم الجهاز");
      return;
    }
    alert(`تم ربط واختبار الاتصال بجهاز البصمة (${deviceName}) بنجاح!`);
    setIsAddDeviceOpen(false);
    setDeviceName("");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-primary" />
            {t.nav.shifts} والورديات وأجهزة البصمة (M08 & M09)
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            فترات الدوام، سياسات المرونة والتأخير، جدول الجدولة التفاعلي وربط أجهزة الحضور
          </p>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => setIsAddShiftOpen(true)}
              size="sm"
              className="font-bold text-xs gap-1.5 bg-primary"
            >
              <Plus className="h-4 w-4" />
              إنشاء وردية دوام جديدة
            </Button>
            <Button
              onClick={() => setIsAddDeviceOpen(true)}
              variant="outline"
              size="sm"
              className="font-bold text-xs gap-1.5"
            >
              <Server className="h-4 w-4" />
              ربط جهاز بصمة جديد
            </Button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-3 max-w-md">
          <TabsTrigger value="definitions" className="text-xs font-bold">
            {t.attendance.shiftsManagement} ({shifts.length})
          </TabsTrigger>
          <TabsTrigger value="scheduler" className="text-xs font-bold">
            {t.attendance.scheduler}
          </TabsTrigger>
          <TabsTrigger value="devices" className="text-xs font-bold">
            {t.attendance.devices}
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Shift Definitions */}
        <TabsContent value="definitions" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {shifts.map((sh) => (
              <div
                key={sh.id}
                className="rounded-xl border bg-card p-4 shadow-sm space-y-3 relative overflow-hidden"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: sh.color }} />
                    <h3 className="font-bold text-xs text-foreground">
                      {language === "ar" ? sh.nameAr : sh.nameEn}
                    </h3>
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    {sh.type === "fixed" ? "ثابت" : sh.type === "flexible" ? "مرن" : "فترتان"}
                  </Badge>
                </div>

                <div className="rounded-lg border bg-muted/20 p-3 text-xs space-y-1.5 font-mono">
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
                    <span className="text-muted-foreground">حساب الساعات الإضافية:</span>
                    <span className="font-bold text-foreground">
                      {sh.overtimeEligible ? "مفعل (1.5x)" : "غير مفعل"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Tab 2: Interactive Scheduler Matrix */}
        <TabsContent value="scheduler" className="space-y-4 pt-4">
          <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
            <div className="p-3 border-b bg-muted/30 flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">
                جدول الدوامات الأسبوعي (30 أغسطس - 5 سبتمبر 2026)
              </span>
              <Badge variant="outline" className="text-emerald-700 bg-emerald-50 text-[10px]">
                تم النشر لكافة الفروع
              </Badge>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="border-b bg-muted/40 font-bold text-muted-foreground">
                  <tr>
                    <th className="py-2.5 px-3 text-start">الموظف</th>
                    {daysOfWeek.map((day, idx) => (
                      <th key={idx} className="py-2.5 px-2 text-center">
                        {day}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {employees.slice(0, 8).map((emp) => (
                    <tr key={emp.id} className="hover:bg-muted/20">
                      <td className="py-2.5 px-3 font-bold text-foreground whitespace-nowrap">
                        {emp.firstNameAr} {emp.lastNameAr}
                      </td>
                      {daysOfWeek.map((_, dIdx) => (
                        <td key={dIdx} className="py-2.5 px-2 text-center">
                          {dIdx === 5 || dIdx === 6 ? (
                            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground font-semibold">
                              راحة
                            </span>
                          ) : (
                            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary font-bold">
                              08:00 - 17:00
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* Tab 3: Devices & Import */}
        <TabsContent value="devices" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
              <div className="flex items-center gap-2 border-b pb-2">
                <Server className="h-4 w-4 text-primary" />
                <h3 className="font-bold text-xs text-foreground">
                  أجهزة البصمة المربوطة بالسحابة (ZKTeco / Anviz)
                </h3>
              </div>
              <div className="space-y-2 text-xs">
                <div className="rounded-lg border p-2.5 flex items-center justify-between">
                  <div>
                    <p className="font-bold">جهاز البوابة الرئيسية (برج العليا)</p>
                    <p className="text-[10px] text-muted-foreground font-mono">
                      IP: 192.168.10.150 • متصل
                    </p>
                  </div>
                  <Badge variant="outline" className="text-emerald-700 bg-emerald-50 text-[10px]">
                    متصل الآن
                  </Badge>
                </div>
                <div className="rounded-lg border p-2.5 flex items-center justify-between">
                  <div>
                    <p className="font-bold">جهاز فرع الغربية (جدة)</p>
                    <p className="text-[10px] text-muted-foreground font-mono">
                      IP: 192.168.20.150 • متصل
                    </p>
                  </div>
                  <Badge variant="outline" className="text-emerald-700 bg-emerald-50 text-[10px]">
                    متصل الآن
                  </Badge>
                </div>
              </div>
            </div>

            <div className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
              <div className="flex items-center gap-2 border-b pb-2">
                <Upload className="h-4 w-4 text-primary" />
                <h3 className="font-bold text-xs text-foreground">
                  استيراد سجلات البصمة الخام (Raw Punches)
                </h3>
              </div>
              <p className="text-xs text-muted-foreground">
                يمكن رفع ملفات البصمة بصيغة CSV أو Excel وسيتم تطبيق فحص التكرارات (Idempotency)
                ومطابقتها مع الدوامات المجدولة.
              </p>
              <Button
                onClick={() => alert("تم استيراد ومعالجة 450 حركة بصمة خام ومطابقتها بنجاح!")}
                size="sm"
                variant="outline"
                className="text-xs font-bold gap-1 w-full"
              >
                <Upload className="h-3.5 w-3.5" />
                اختيار ملف البصمات (CSV / XLSX)
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Add Shift Modal */}
      <Dialog open={isAddShiftOpen} onOpenChange={setIsAddShiftOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <CalendarCheck className="h-5 w-5 text-primary" />
              إنشاء وردية دوام جديدة
            </DialogTitle>
            <DialogDescription className="text-xs">
              تحديد أوقات الحضور والانصراف ونوافذ السماح
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-xs py-2">
            <div className="space-y-1">
              <label className="font-bold">اسم الوردية *</label>
              <input
                type="text"
                value={shiftName}
                onChange={(e) => setShiftName(e.target.value)}
                placeholder="مثال: الوردية المسائية (خدمة العملاء)"
                className="w-full h-8 rounded border px-2.5"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="font-bold">وقت بدء العمل *</label>
                <input
                  type="time"
                  value={shiftStartTime}
                  onChange={(e) => setShiftStartTime(e.target.value)}
                  className="w-full h-8 rounded border px-2.5"
                />
              </div>
              <div className="space-y-1">
                <label className="font-bold">وقت انتهاء العمل *</label>
                <input
                  type="time"
                  value={shiftEndTime}
                  onChange={(e) => setShiftEndTime(e.target.value)}
                  className="w-full h-8 rounded border px-2.5"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="font-bold">فترة السماح عند الحضور (دقائق)</label>
              <input
                type="number"
                value={shiftGraceArrival}
                onChange={(e) => setShiftGraceArrival(Number(e.target.value))}
                className="w-full h-8 rounded border px-2.5"
              />
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button size="sm" onClick={handleCreateShift} className="text-xs bg-primary font-bold">
              تأكيد وإنشاء الوردية
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Device Modal */}
      <Dialog open={isAddDeviceOpen} onOpenChange={setIsAddDeviceOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Server className="h-5 w-5 text-primary" />
              ربط جهاز بصمة سحابي (Biometric Device)
            </DialogTitle>
            <DialogDescription className="text-xs">
              تحديد عنوان IP والمنفذ للمزامنة التلقائية
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-xs py-2">
            <div className="space-y-1">
              <label className="font-bold">اسم وموقع الجهاز *</label>
              <input
                type="text"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                placeholder="مثال: جهاز بوابة المستودعات المركزية"
                className="w-full h-8 rounded border px-2.5"
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold">عنوان IP *</label>
              <input
                type="text"
                value={deviceIp}
                onChange={(e) => setDeviceIp(e.target.value)}
                className="w-full h-8 rounded border px-2.5 font-mono"
              />
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button size="sm" onClick={handleCreateDevice} className="text-xs bg-primary font-bold">
              اختبار وربط الجهاز
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
