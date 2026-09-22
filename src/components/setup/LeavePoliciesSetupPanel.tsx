import React, { useState } from "react";
import { useApp } from "../../lib/context/AppContext";
import { canManageModule } from "../../lib/auth/permissions";
import { useLeaveTypes, useLeaveMutations } from "../../lib/domains/leaves";
import { CalendarCheck, Plus, CheckCircle2, ShieldCheck, Info } from "lucide-react";
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

export const LeavePoliciesSetupPanel: React.FC = () => {
  const { currentRole } = useApp();
  const canManage = canManageModule(currentRole, "leaves");

  const { leaveTypes } = useLeaveTypes();
  const { addLeaveType } = useLeaveMutations();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [typeNameAr, setTypeNameAr] = useState("");
  const [typeNameEn, setTypeNameEn] = useState("");
  const [typeMaxDays, setTypeMaxDays] = useState(30);
  const [typeIsPaid, setTypeIsPaid] = useState(true);
  const [typeDeductWorkingDays, setTypeDeductWorkingDays] = useState(true);
  const [typeAccrualMethod, setTypeAccrualMethod] = useState<
    "monthly_accrual" | "yearly_frontloaded" | "contract_anniversary"
  >("yearly_frontloaded");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreateLeaveType = async () => {
    if (!typeNameAr.trim()) {
      toast.error("يرجى إدخال اسم نوع الإجازة بالعربية");
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await addLeaveType({
        nameAr: typeNameAr.trim(),
        nameEn: typeNameEn.trim() || typeNameAr.trim(),
        isPaid: typeIsPaid,
        maxDaysPerYear: typeMaxDays,
        color: "#004BCE",
        deductFromWorkingDaysOnly: typeDeductWorkingDays,
        allowHalfDay: true,
        allowNegativeBalance: false,
        requiresAttachment: false,
        accrualMethod: typeAccrualMethod,
        carryoverLimitDays: 0,
        carryoverExpiryMonths: 0,
      });

      if (created) {
        toast.success("تم تعريف نوع وسياسة الإجازة بنجاح");
        setIsAddModalOpen(false);
        setTypeNameAr("");
        setTypeNameEn("");
      }
    } catch {
      toast.error("حدث خطأ أثناء حفظ نوع الإجازة");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
        <div>
          <h2 className="text-base font-black text-foreground flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-primary" />
            تعريف سياسات وأنواع الإجازات لشركة «الأندلس»
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            هذه الشاشة مخصصة فقط لتهيئة أنواع وسياسات الإجازات وحصص الاستحقاق السنوية دون إدراج طلبات الموظفين اليومية أو التقاويم التشغيلية.
          </p>
        </div>

        {canManage && (
          <Button
            size="sm"
            onClick={() => setIsAddModalOpen(true)}
            className="rounded-full text-xs font-bold gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 cursor-pointer shadow-xs"
          >
            <Plus className="h-4 w-4" />
            تعريف نوع إجازة جديد
          </Button>
        )}
      </div>

      {/* Grid */}
      {leaveTypes.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border/80 bg-card p-12 text-center">
          <div className="flex flex-col items-center justify-center gap-3">
            <div className="h-14 w-14 rounded-2xl bg-muted/60 flex items-center justify-center text-muted-foreground">
              <CalendarCheck className="h-7 w-7" />
            </div>
            <p className="font-bold text-foreground text-sm">
              لم يتم تعريف أي سياسات أو أنواع إجازات بعد بشركة «الأندلس»
            </p>
            <p className="text-xs text-muted-foreground max-w-md">
              قم بتهيئة أنواع الإجازات الأساسية (السنوية الاعتيادية، المرضية، الإجازات الطارئة) وتحديد الحد الأقصى للأيام وسياسة الدفع.
            </p>
            {canManage && (
              <Button
                size="sm"
                onClick={() => setIsAddModalOpen(true)}
                className="rounded-full text-xs font-bold gap-2 mt-2 cursor-pointer shadow-xs"
              >
                <Plus className="h-4 w-4" />
                تعريف أول نوع إجازة الآن
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {leaveTypes.map((type) => (
            <div
              key={type.id}
              className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-3.5 relative overflow-hidden hover:border-primary/40 transition-all"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-black text-xs text-foreground">{type.nameAr}</h3>
                <Badge
                  variant="outline"
                  className={`text-[10px] rounded-full px-2.5 font-bold ${
                    type.isPaid
                      ? "bg-emerald-500/10 text-emerald-700 border-emerald-200"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {type.isPaid ? "مدفوعة الأجر" : "بدون أجر"}
                </Badge>
              </div>

              <div className="rounded-2xl border border-border/60 bg-muted/20 p-3.5 text-xs space-y-2 font-mono">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">الحد السنوي:</span>
                  <span className="font-bold text-foreground font-sans">
                    {type.maxDaysPerYear} يوماً
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">طريقة الاستحقاق:</span>
                  <span className="font-bold text-primary font-sans">
                    {type.accrualMethod === "monthly_accrual"
                      ? "استحقاق شهري دوري"
                      : "رصيد مقدم سنوي"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">احتساب أيام العمل:</span>
                  <span className="font-bold text-emerald-600 font-sans">
                    {type.deductFromWorkingDaysOnly ? "خصم أيام العمل فقط" : "خصم كافة الأيام"}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Statutory Guidance */}
      <div className="rounded-2xl border border-border/80 bg-muted/20 p-4 text-xs space-y-2">
        <div className="flex items-center gap-2 font-bold text-foreground">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          إرشادات نظام العمل السعودي (المادتان 109 و 113):
        </div>
        <p className="text-muted-foreground leading-relaxed">
          تستحق الإجازة السنوية بأجر مدفوع بحد أدنى 21 يوماً وتزاد إلى 30 يوماً متى أمضى العامل 5 سنوات متصلة. كما يحق للعامل إجازات بأجر كامل في حالات الزواج (5 أيام) والوفاة (5 أيام) ومولود جديد (3 أيام).
        </p>
      </div>

      {/* Add Leave Type Dialog */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-black">تعريف نوع إجازة جديد</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              حدد اسم الإجازة والحد الأقصى للأيام المسموح بها وسياسة الاستحقاق.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="space-y-1.5">
              <label className="font-bold text-foreground">اسم الإجازة بالعربية:</label>
              <input
                type="text"
                value={typeNameAr}
                onChange={(e) => setTypeNameAr(e.target.value)}
                placeholder="مثال: الإجازة السنوية الاعتيادية"
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="font-bold text-foreground">الحد السنوي (أيام):</label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={typeMaxDays}
                  onChange={(e) => setTypeMaxDays(Number(e.target.value))}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 font-mono text-xs outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-foreground">طبيعة الأجر:</label>
                <select
                  value={typeIsPaid ? "paid" : "unpaid"}
                  onChange={(e) => setTypeIsPaid(e.target.value === "paid")}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="paid">مدفوعة الأجر بالكامل</option>
                  <option value="unpaid">بدون أجر (إجازة غير مدفوعة)</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-foreground">طريقة الاستحقاق:</label>
              <select
                value={typeAccrualMethod}
                onChange={(e) => setTypeAccrualMethod(e.target.value as any)}
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="yearly_frontloaded">رصيد مقدم في بداية السنة (30 يوماً مباشرة)</option>
                <option value="monthly_accrual">استحقاق شهري دوري (مثال: 2.5 يوم كل شهر)</option>
                <option value="contract_anniversary">استحقاق سنوي مرتبط بتاريخ العقد</option>
              </select>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAddModalOpen(false)}
              className="rounded-full text-xs font-bold"
            >
              إلغاء
            </Button>
            <Button
              size="sm"
              disabled={isSubmitting}
              onClick={handleCreateLeaveType}
              className="rounded-full text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isSubmitting ? "جاري الحفظ..." : "حفظ السياسة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
