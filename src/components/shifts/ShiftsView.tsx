import React, { useState } from "react";
import { useApp } from "../../lib/context/AppContext";
import { canManageModule } from "../../lib/auth/permissions";
import { IconSymbol } from "../ui/IconSymbol";
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
  Sparkles,
} from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";

export const ShiftsView: React.FC = () => {
  const { shifts, employees, addShift, openEmployeeProfile, currentRole, language, t } = useApp();
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
      toast.error("يرجى كتابة اسم الوردية / الدوام");
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
    toast.success(`تم إنشاء الوردية (${shiftName}) بنجاح!`);
    setIsAddShiftOpen(false);
    setShiftName("");
  };

  const handleCreateDevice = () => {
    if (!deviceName) {
      toast.error("يرجى كتابة اسم الجهاز");
      return;
    }
    toast.success(`تم ربط واختبار الاتصال بجهاز البصمة (${deviceName}) بنجاح!`);
    setIsAddDeviceOpen(false);
    setDeviceName("");
  };

  return (
    <div className="space-y-6">
      {/* Header (Google M3 Style) */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/70 pb-5">
        <div>
          <h1 className="text-xl font-black text-foreground flex items-center gap-2.5">
            <IconSymbol name="calendar_month" source="material" filled size={24} className="text-primary" />
            {t.nav.shifts} والورديات وأجهزة البصمة (M09)
          </h1>
          <p className="text-xs text-muted-foreground font-medium mt-1">
            فترات الدوام، سياسات المرونة والتأخير، جدول الجدولة التفاعلي وربط أجهزة الحضور
          </p>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2.5">
            <Button
              onClick={() => setIsAddShiftOpen(true)}
              size="sm"
              className="rounded-full font-bold text-xs gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs h-10 px-4"
            >
              <Plus className="h-4 w-4" />
              إنشاء وردية دوام جديدة
            </Button>
            <Button
              onClick={() => setIsAddDeviceOpen(true)}
              variant="outline"
              size="sm"
              className="rounded-full font-bold text-xs gap-1.5 border-border/80 hover:bg-secondary h-10 px-4 shadow-xs"
            >
              <Server className="h-4 w-4 text-primary" />
              ربط جهاز بصمة
            </Button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-3 max-w-md bg-muted/60 p-1 rounded-full border border-border/60">
          <TabsTrigger value="definitions" className="rounded-full text-xs font-bold py-2 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-xs">
            {t.attendance.shiftsManagement} ({shifts.length})
          </TabsTrigger>
          <TabsTrigger value="scheduler" className="rounded-full text-xs font-bold py-2 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-xs">
            {t.attendance.scheduler}
          </TabsTrigger>
          <TabsTrigger value="devices" className="rounded-full text-xs font-bold py-2 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-xs">
            {t.attendance.devices}
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Shift Definitions */}
        <TabsContent value="definitions" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {shifts.map((sh) => (
              <div
                key={sh.id}
                className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-3.5 relative overflow-hidden hover:border-primary/40 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="h-3.5 w-3.5 rounded-full shadow-xs" style={{ backgroundColor: sh.color || "#0B57D0" }} />
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
                    <span className="text-muted-foreground">حساب الإضافي:</span>
                    <span className="font-bold text-primary">
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
          <div className="rounded-3xl border border-border/80 bg-card overflow-hidden shadow-xs space-y-3 p-5">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <span className="text-xs font-black text-foreground">
                جدول الدوامات الأسبوعي المعتمد (سبتمبر 2026)
              </span>
              <Badge variant="outline" className="text-emerald-700 bg-emerald-50 text-[10px] rounded-full px-2.5 font-bold border-emerald-200">
                تم النشر لكافة الفروع
              </Badge>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-border/60">
              <table className="w-full text-xs">
                <thead className="border-b border-border/60 bg-muted/40 font-bold text-muted-foreground">
                  <tr>
                    <th className="py-3 px-4 text-start">الموظف</th>
                    {daysOfWeek.map((day, idx) => (
                      <th key={idx} className="py-3 px-2 text-center">
                        {day}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {employees.slice(0, 8).map((emp) => (
                    <tr key={emp.id} className="hover:bg-muted/20 transition-colors group">
                      <td className="py-3 px-4 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openEmployeeProfile(emp)}
                          className="font-bold text-foreground group-hover:text-primary group-hover:underline cursor-pointer text-start"
                        >
                          {emp.firstNameAr} {emp.lastNameAr}
                        </button>
                      </td>
                      {daysOfWeek.map((_, dIdx) => (
                        <td key={dIdx} className="py-3 px-2 text-center">
                          {dIdx === 5 || dIdx === 6 ? (
                            <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] text-muted-foreground font-bold">
                              راحة
                            </span>
                          ) : (
                            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] text-primary font-mono font-bold">
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
            <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2 border-b border-border/60 pb-3">
                <Server className="h-4 w-4 text-primary" />
                <h3 className="font-black text-xs text-foreground">
                  أجهزة البصمة المربوطة بالسحابة (ZKTeco / Anviz)
                </h3>
              </div>
              <div className="space-y-2.5 text-xs">
                <div className="rounded-2xl border border-border/60 bg-muted/20 p-3.5 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-foreground">جهاز البوابة الرئيسية (برج العليا)</p>
                    <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                      IP: 192.168.10.150 • Port: 4370
                    </p>
                  </div>
                  <Badge variant="outline" className="text-emerald-700 bg-emerald-50 text-[10px] rounded-full px-2.5 font-bold border-emerald-200">
                    متصل الآن
                  </Badge>
                </div>
                <div className="rounded-2xl border border-border/60 bg-muted/20 p-3.5 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-foreground">جهاز فرع الغربية (جدة)</p>
                    <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                      IP: 192.168.20.150 • Port: 4370
                    </p>
                  </div>
                  <Badge variant="outline" className="text-emerald-700 bg-emerald-50 text-[10px] rounded-full px-2.5 font-bold border-emerald-200">
                    متصل الآن
                  </Badge>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-3.5">
              <div className="flex items-center gap-2 border-b border-border/60 pb-3">
                <Upload className="h-4 w-4 text-primary" />
                <h3 className="font-black text-xs text-foreground">
                  استيراد حركات البصمة الخام (Raw Punches)
                </h3>
              </div>
              <p className="text-xs text-muted-foreground font-medium leading-relaxed">
                يمكن رفع ملفات حركات البصمة من أجهزة USB بصيغة CSV أو Excel وسيتم تطبيق فحص التكرارات ومطابقتها آلياً.
              </p>
              <Button
                onClick={() => toast.success("تم استيراد ومعالجة 450 حركة بصمة خام ومطابقتها بنجاح!")}
                size="sm"
                variant="outline"
                className="rounded-full text-xs font-bold gap-1.5 w-full h-10 border-border/80 hover:bg-secondary"
              >
                <Upload className="h-4 w-4 text-primary" />
                اختيار ملف البصمات (CSV / XLSX)
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Add Shift Modal */}
      <Dialog open={isAddShiftOpen} onOpenChange={setIsAddShiftOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <CalendarCheck className="h-5 w-5 text-primary" />
              إنشاء وردية دوام جديدة
            </DialogTitle>
            <DialogDescription className="text-xs font-medium">
              تحديد أوقات الحضور والانصراف ونوافذ السماح
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs py-2">
            <div className="space-y-1.5">
              <label className="font-bold">اسم الوردية *</label>
              <input
                type="text"
                value={shiftName}
                onChange={(e) => setShiftName(e.target.value)}
                placeholder="مثال: الوردية المسائية (خدمة العملاء)"
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="font-bold">وقت بدء العمل *</label>
                <input
                  type="time"
                  value={shiftStartTime}
                  onChange={(e) => setShiftStartTime(e.target.value)}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-bold">وقت انتهاء العمل *</label>
                <input
                  type="time"
                  value={shiftEndTime}
                  onChange={(e) => setShiftEndTime(e.target.value)}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="font-bold">فترة السماح عند الحضور (دقائق)</label>
              <input
                type="number"
                value={shiftGraceArrival}
                onChange={(e) => setShiftGraceArrival(Number(e.target.value))}
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>

          <DialogFooter className="mt-3">
            <Button size="sm" onClick={handleCreateShift} className="rounded-full text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-5 h-9">
              تأكيد وإنشاء الوردية
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Device Modal */}
      <Dialog open={isAddDeviceOpen} onOpenChange={setIsAddDeviceOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Server className="h-5 w-5 text-primary" />
              ربط جهاز بصمة سحابي (Biometric Device)
            </DialogTitle>
            <DialogDescription className="text-xs font-medium">
              تحديد عنوان IP والمنفذ للمزامنة التلقائية
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs py-2">
            <div className="space-y-1.5">
              <label className="font-bold">اسم وموقع الجهاز *</label>
              <input
                type="text"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                placeholder="مثال: جهاز بوابة المستودعات المركزية"
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div className="space-y-1.5">
              <label className="font-bold">عنوان IP *</label>
              <input
                type="text"
                value={deviceIp}
                onChange={(e) => setDeviceIp(e.target.value)}
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>

          <DialogFooter className="mt-3">
            <Button size="sm" onClick={handleCreateDevice} className="rounded-full text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-5 h-9">
              اختبار وربط الجهاز
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
