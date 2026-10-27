import React, { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useApp } from "../../lib/context/AppContext";
import { canManageModule } from "../../lib/auth/permissions";
import { useLeaveTypes, useLeaveMutations } from "../../lib/domains/leaves";
import { useEmployeeDirectory } from "../../lib/domains/employees";
import { useBootstrapData } from "../../lib/domains/bootstrap/use-bootstrap";
import {
  CalendarCheck,
  Plus,
  ShieldCheck,
  Info,
  Sliders,
  TrendingUp,
  RotateCcw,
  ArrowLeft,
  Search,
  Settings,
  AlertTriangle,
  FileCheck,
  Clock,
} from "lucide-react";
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
import {
  getCompanyYear,
  isValidTimezone,
} from "../../lib/utils/timezone-dates";
import type { EmployeeDirectoryItem } from "../../types";

export const LeavePoliciesSetupPanel: React.FC = () => {
  const navigate = useNavigate();
  const { currentRole, company: appCompany } = useApp();
  const { company: bootstrapCompany } = useBootstrapData();
  const company = bootstrapCompany || appCompany;

  const canManage = canManageModule(currentRole, "leaves");

  // Timezone check
  const companyTz = company?.timezone;
  const hasValidTimezone = isValidTimezone(companyTz);
  const currentYear = getCompanyYear(companyTz);

  const { leaveTypes } = useLeaveTypes();
  const {
    addLeaveType,
    adjustLeaveBalance,
    accrueLeaveBalances,
    carryoverLeaveBalances,
    expireCarryoverBalances,
  } = useLeaveMutations();

  // Add Type Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [typeNameAr, setTypeNameAr] = useState("");
  const [typeNameEn, setTypeNameEn] = useState("");
  const [typeMaxDays, setTypeMaxDays] = useState<number | "">(30);
  const [typeIsPaid, setTypeIsPaid] = useState<boolean>(true);
  const [typeDeductWorkingDays, setTypeDeductWorkingDays] = useState<boolean>(true);
  const [typeAllowHalfDay, setTypeAllowHalfDay] = useState<boolean>(true);
  const [typeAllowNegative, setTypeAllowNegative] = useState<boolean>(false);
  const [typeRequiresAttachment, setTypeRequiresAttachment] = useState<boolean>(false);
  const [typeAccrualMethod, setTypeAccrualMethod] = useState<
    "yearly_frontloaded" | "monthly_accrual" | "contract_anniversary"
  >("yearly_frontloaded");
  const [typeCarryoverLimit, setTypeCarryoverLimit] = useState<number | "">(0);
  const [typeCarryoverExpiryMonths, setTypeCarryoverExpiryMonths] = useState<number | "">(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Adjust Balance Modal State
  const [isAdjustBalanceOpen, setIsAdjustBalanceOpen] = useState(false);
  const [adjustEmpId, setAdjustEmpId] = useState("");
  const [adjustEmpSearch, setAdjustEmpSearch] = useState("");
  const [adjustTypeId, setAdjustTypeId] = useState("");
  const [adjustDays, setAdjustDays] = useState(1);
  const [adjustReason, setAdjustReason] = useState("");
  const [isAdjustingBalance, setIsAdjustingBalance] = useState(false);

  const { data: directoryData } = useEmployeeDirectory(
    {
      search: adjustEmpSearch.trim() || undefined,
      status: "active",
      pageSize: 50,
    },
    { enabled: canManage },
  );
  const filteredAdjustEmployees = directoryData?.items ?? [];

  const handleCreateLeaveType = async () => {
    if (!typeNameAr.trim()) {
      toast.error("يرجى إدخال اسم نوع الإجازة بالعربية");
      return;
    }
    if (typeMaxDays === "" || Number(typeMaxDays) < 0) {
      toast.error("يرجى تحديد الاستحقاق السنوي بالأيام (أكبر من أو يساوي صفر)");
      return;
    }
    if (typeCarryoverLimit === "" || Number(typeCarryoverLimit) < 0) {
      toast.error("يرجى تحديد الحد الأقصى لترحيل الأيام سنوياً");
      return;
    }
    if (typeCarryoverExpiryMonths === "" || Number(typeCarryoverExpiryMonths) < 0) {
      toast.error("يرجى تحديد مدة صلاحية الرصيد المرحل بالأشهر");
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await addLeaveType({
        nameAr: typeNameAr.trim(),
        nameEn: typeNameEn.trim() || undefined,
        isPaid: typeIsPaid,
        maxDaysPerYear: Number(typeMaxDays),
        color: "#004BCE",
        deductFromWorkingDaysOnly: typeDeductWorkingDays,
        allowHalfDay: typeAllowHalfDay,
        allowNegativeBalance: typeAllowNegative,
        requiresAttachment: typeRequiresAttachment,
        accrualMethod: typeAccrualMethod,
        carryoverLimitDays: Number(typeCarryoverLimit),
        carryoverExpiryMonths: Number(typeCarryoverExpiryMonths),
        companyId: company?.id,
        jurisdiction: company?.country || undefined,
      });

      if (created) {
        toast.success("تم تعريف نوع وسياسة الإجازة بنجاح");
        setIsAddModalOpen(false);
        setTypeNameAr("");
        setTypeNameEn("");
        setTypeMaxDays(30);
        setTypeIsPaid(true);
        setTypeDeductWorkingDays(true);
        setTypeAllowHalfDay(true);
        setTypeAllowNegative(false);
        setTypeRequiresAttachment(false);
        setTypeAccrualMethod("yearly_frontloaded");
        setTypeCarryoverLimit(0);
        setTypeCarryoverExpiryMonths(0);
      }
    } catch {
      toast.error("حدث خطأ أثناء حفظ نوع الإجازة");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAdjustBalance = async () => {
    if (!adjustEmpId) {
      toast.error("يرجى اختيار الموظف أولاً");
      return;
    }
    if (!adjustReason.trim()) {
      toast.error("يرجى كتابة سبب تعديل الرصيد");
      return;
    }
    setIsAdjustingBalance(true);
    try {
      const targetType = adjustTypeId || leaveTypes[0]?.id || "";
      const ok = await adjustLeaveBalance(adjustEmpId, targetType, adjustDays, adjustReason.trim());
      if (ok) {
        setIsAdjustBalanceOpen(false);
        setAdjustReason("");
        setAdjustEmpId("");
        toast.success("تم توثيق تعديل الرصيد بنجاح");
      }
    } finally {
      setIsAdjustingBalance(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Clear Operational Separation */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base md:text-lg font-black text-foreground flex items-center gap-2">
              <CalendarCheck className="h-5 w-5 text-primary" />
              تهيئة سياسات ولوائح الإجازات — شركة «{company?.legalNameAr || "الأندلس"}»
            </h2>
            <Badge variant="outline" className="text-[10px] font-bold border-primary/30 text-primary bg-primary/5 rounded-full px-2.5 py-0.5">
              شاشة التهيئة والحوكمة
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1 max-w-3xl leading-relaxed">
            هذه الشاشة مخصصة لمدراء الموارد البشرية لتهيئة أنواع وسياسات الإجازات، استحقاقاتها السنوية، شروط الترحيل، وإجراء عمليات الترحيل السنوية المركزية (Accruals & Carryover)، بمعزل تام عن شاشات تقديم ومتابعة الطلبات اليومية للموظفين.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate({ to: "/leaves" })}
            className="rounded-full text-xs font-bold gap-1.5 h-9 px-4 cursor-pointer border-border/80 hover:bg-secondary"
          >
            الانتقال للعمليات اليومية للإجازات
            <ArrowLeft className="h-4 w-4" />
          </Button>

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
      </div>

      {/* Timezone Validation Notice */}
      {!hasValidTimezone && canManage && (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 flex items-center gap-3 text-destructive shadow-xs">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <div className="text-xs">
            <p className="font-bold">تنبيه حرج: المنطقة الزمنية للمنشأة غير مهيأة</p>
            <p className="text-[11px] opacity-90 mt-0.5">
              يتطلب تشغيل دورات ترحيل الاستحقاق السنوي وإنهاء الصلاحية ضبط المنطقة الزمنية (Timezone) في ملف المنشأة لمنع افتراضات التواريخ الضمنية.
            </p>
          </div>
        </div>
      )}

      {/* Administrative Batch Operations Card */}
      {canManage && (
        <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
            <div>
              <h3 className="text-xs font-black text-foreground flex items-center gap-2">
                <Sliders className="h-4 w-4 text-primary" />
                العمليات الدورية والسنوية لسياسات الأرصدة (Administrative Batch Operations)
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                تنفيذ استحقاق الأرصدة المجمعة، ترحيل رصيد السنة السابقة، وإنهاء صلاحية الأرصدة حسب السياسة المعتمدة لسنة {currentYear}.
              </p>
            </div>
            <Badge variant="outline" className="text-[10px] font-mono font-bold">
              السنة المالية الحالية: {currentYear}
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              onClick={() => {
                if (!hasValidTimezone) {
                  toast.error("لا يمكن ترحيل الاستحقاق: المنطقة الزمنية للشركة غير مهيأة");
                  return;
                }
                accrueLeaveBalances(currentYear, undefined, undefined, company?.id);
              }}
              disabled={!hasValidTimezone}
              size="sm"
              variant="secondary"
              className="rounded-full font-bold text-xs gap-1.5 bg-secondary text-secondary-foreground hover:bg-secondary/80 h-9 px-4 shadow-xs cursor-pointer disabled:opacity-50"
            >
              <TrendingUp className="h-4 w-4 text-primary" />
              ترحيل الاستحقاق السنوي ({currentYear})
            </Button>

            <Button
              onClick={() => {
                if (!hasValidTimezone) {
                  toast.error("لا يمكن ترحيل الأرصدة: المنطقة الزمنية للشركة غير مهيأة");
                  return;
                }
                carryoverLeaveBalances(currentYear - 1, currentYear, undefined, company?.id);
              }}
              disabled={!hasValidTimezone}
              size="sm"
              variant="secondary"
              className="rounded-full font-bold text-xs gap-1.5 bg-secondary text-secondary-foreground hover:bg-secondary/80 h-9 px-4 shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Sliders className="h-4 w-4 text-primary" />
              ترحيل الأرصدة ({currentYear - 1} → {currentYear})
            </Button>

            <Button
              onClick={() => {
                if (!hasValidTimezone) {
                  toast.error("لا يمكن إنهاء الصلاحية: المنطقة الزمنية للشركة غير مهيأة");
                  return;
                }
                expireCarryoverBalances(currentYear, company?.id);
              }}
              disabled={!hasValidTimezone}
              size="sm"
              variant="outline"
              className="rounded-full font-bold text-xs gap-1.5 border-border/80 hover:bg-secondary h-9 px-4 shadow-xs cursor-pointer disabled:opacity-50"
            >
              <RotateCcw className="h-4 w-4 text-primary" />
              إنهاء صلاحية الأرصدة المرحّلة
            </Button>

            <Button
              onClick={() => {
                setAdjustTypeId(leaveTypes[0]?.id || "");
                setIsAdjustBalanceOpen(true);
              }}
              size="sm"
              variant="outline"
              className="rounded-full font-bold text-xs gap-1.5 border-border/80 hover:bg-secondary h-9 px-4 shadow-xs cursor-pointer"
            >
              <Sliders className="h-4 w-4 text-emerald-600" />
              تعديل رصيد استثنائي لموظف
            </Button>
          </div>
        </div>
      )}

      {/* Grid of Defined Leave Types */}
      {leaveTypes.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border/80 bg-card p-12 text-center">
          <div className="flex flex-col items-center justify-center gap-3">
            <div className="h-14 w-14 rounded-2xl bg-muted/60 flex items-center justify-center text-muted-foreground">
              <CalendarCheck className="h-7 w-7" />
            </div>
            <p className="font-bold text-foreground text-sm">
              لم يتم تعريف أي سياسات أو أنواع إجازات بعد بشركة «{company?.legalNameAr || "الأندلس"}»
            </p>
            <p className="text-xs text-muted-foreground max-w-md leading-relaxed">
              قم بتهيئة أنواع الإجازات الأساسية (السنوية الاعتيادية، المرضية، الإجازات الطارئة) وتحديد الحد الأقصى للأيام وسياسة الدفع وحساب أيام العمل.
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
              className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs space-y-3.5 relative overflow-hidden hover:border-primary/40 transition-all flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-black text-xs text-foreground">{type.nameAr}</h3>
                    {type.nameEn && (
                      <p className="text-[10px] text-muted-foreground font-sans mt-0.5">{type.nameEn}</p>
                    )}
                  </div>
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
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground font-sans">الاستحقاق السنوي:</span>
                    <span className="font-bold text-foreground font-sans">
                      {type.maxDaysPerYear} يوماً
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground font-sans">طريقة الاستحقاق:</span>
                    <span className="font-bold text-primary font-sans">
                      {type.accrualMethod === "monthly_accrual"
                        ? "استحقاق شهري دوري"
                        : type.accrualMethod === "contract_anniversary"
                        ? "ذكرى العقد السنوية"
                        : "رصيد مقدم سنوي"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground font-sans">احتساب أيام العمل:</span>
                    <span className="font-bold text-emerald-600 font-sans">
                      {type.deductFromWorkingDaysOnly ? "خصم أيام العمل فقط" : "خصم كافة الأيام"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground font-sans">الحد الأقصى للترحيل:</span>
                    <span className="font-bold text-foreground font-sans">
                      {type.carryoverLimitDays > 0 ? `${type.carryoverLimitDays} يوماً` : "غير مسموح"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground font-sans">صلاحية المرحل:</span>
                    <span className="font-bold text-foreground font-sans">
                      {(type.carryoverExpiryMonths ?? 0) > 0 ? `${type.carryoverExpiryMonths} أشهر` : "طوال العام"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-t border-border/50 pt-1.5 text-[11px] font-sans">
                    <span className="text-muted-foreground">المرفق الرسمي:</span>
                    <span className={type.requiresAttachment ? "text-amber-600 font-bold" : "text-muted-foreground"}>
                      {type.requiresAttachment ? "إلزامي" : "اختياري"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 text-[11px] text-muted-foreground border-t border-border/50">
                <span className={`inline-block h-2 w-2 rounded-full ${type.allowHalfDay ? "bg-emerald-500" : "bg-slate-300"}`} />
                <span>نصف يوم: {type.allowHalfDay ? "متاح" : "غير متاح"}</span>
                <span className="mx-1">•</span>
                <span className={`inline-block h-2 w-2 rounded-full ${type.allowNegativeBalance ? "bg-amber-500" : "bg-slate-300"}`} />
                <span>رصيد سالب: {type.allowNegativeBalance ? "متاح" : "محظور"}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Statutory Guidance and Regional Compliance */}
      <div className="rounded-3xl border border-border/80 bg-muted/20 p-5 text-xs space-y-3">
        <div className="flex items-center gap-2 font-black text-foreground">
          <ShieldCheck className="h-5 w-5 text-emerald-600" />
          المرجعية النظامية لإعداد سياسات الإجازات (نظام العمل وحزم الدول):
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-muted-foreground leading-relaxed">
          <div className="rounded-2xl border border-border/60 bg-card p-3.5 space-y-1">
            <span className="font-bold text-foreground block">المملكة العربية السعودية (نظام العمل):</span>
            <p>
              • <strong>المادة 109:</strong> إجازة سنوية مدفوعة بأجر لا تقل عن 21 يوماً وتزاد إلى 30 يوماً متى أمضى العامل 5 سنوات متصلة.
            </p>
            <p>
              • <strong>المادة 113:</strong> إجازات بأجر كامل في الزواج (5 أيام)، الوفاة (5 أيام)، ومولود جديد (3 أيام).
            </p>
            <p>
              • <strong>المادة 117:</strong> الإجازة المرضية (أول 30 يوماً بأجر كامل، 60 يوماً بثلاثة أرباع، 30 يوماً بدون أجر).
            </p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card p-3.5 space-y-1">
            <span className="font-bold text-foreground block">مصر ودول مجلس التعاون (EG, QA, OM, BH):</span>
            <p>
              • <strong>مصر (قانون العمل 12):</strong> 21 يوماً سنوياً تزداد إلى 30 يوماً بعد 10 سنوات خدمة أو لمن تجاوز سن الـ 50.
            </p>
            <p>
              • <strong>قطر وسلطنة عمان والبحرين:</strong> إجازات سنوية اعتيادية (30 يوماً تقويمياً) مع إلزامية توثيق تقارير الإجازات المرضية رسمياً.
            </p>
          </div>
        </div>
      </div>

      {/* Add Leave Type Dialog */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <CalendarCheck className="h-5 w-5 text-primary" />
              تعريف نوع وسياسة إجازة جديدة
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              حدد اسم الإجازة والحد الأقصى للأيام المسموح بها وسياسة الاستحقاق والترحيل.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2 text-xs">
            <div className="space-y-1.5">
              <label className="font-bold text-foreground">اسم الإجازة بالعربية *</label>
              <input
                type="text"
                value={typeNameAr}
                onChange={(e) => setTypeNameAr(e.target.value)}
                placeholder="مثال: الإجازة السنوية الاعتيادية"
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-foreground">اسم الإجازة بالإنجليزية (اختياري)</label>
              <input
                type="text"
                value={typeNameEn}
                onChange={(e) => setTypeNameEn(e.target.value)}
                placeholder="Example: Annual Leave"
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs outline-none focus:ring-2 focus:ring-primary/20 font-sans"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="font-bold text-foreground">الاستحقاق السنوي (أيام) *</label>
                <input
                  type="number"
                  min={0}
                  max={365}
                  value={typeMaxDays}
                  onChange={(e) => setTypeMaxDays(e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 font-mono text-xs outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-foreground">طبيعة الأجر *</label>
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
              <label className="font-bold text-foreground">طريقة الاستحقاق (Accrual Method) *</label>
              <select
                value={typeAccrualMethod}
                onChange={(e) => setTypeAccrualMethod(e.target.value as any)}
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="yearly_frontloaded">رصيد مقدم في بداية السنة (Yearly Frontloaded)</option>
                <option value="monthly_accrual">استحقاق شهري دوري (Monthly Accrual)</option>
                <option value="contract_anniversary">استحقاق مرتبط بذكرى العقد (Contract Anniversary)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="font-bold text-foreground">الحد الأقصى للترحيل سنوياً</label>
                <input
                  type="number"
                  min={0}
                  value={typeCarryoverLimit}
                  onChange={(e) => setTypeCarryoverLimit(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="0 لعدم الترحيل"
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 font-mono text-xs outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-foreground">صلاحية المرحل (أشهر)</label>
                <input
                  type="number"
                  min={0}
                  value={typeCarryoverExpiryMonths}
                  onChange={(e) => setTypeCarryoverExpiryMonths(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="0 لعدم الإنهاء"
                  className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 font-mono text-xs outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-border/60">
              <div className="flex items-center justify-between">
                <label className="font-bold text-foreground">خصم أيام العمل الفعلية فقط:</label>
                <input
                  type="checkbox"
                  checked={typeDeductWorkingDays}
                  onChange={(e) => setTypeDeductWorkingDays(e.target.checked)}
                  className="rounded text-primary h-4 w-4"
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="font-bold text-foreground">السماح بتقديم نصف يوم (0.5):</label>
                <input
                  type="checkbox"
                  checked={typeAllowHalfDay}
                  onChange={(e) => setTypeAllowHalfDay(e.target.checked)}
                  className="rounded text-primary h-4 w-4"
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="font-bold text-foreground">السماح برصيد سالب (سلفة إجازة):</label>
                <input
                  type="checkbox"
                  checked={typeAllowNegative}
                  onChange={(e) => setTypeAllowNegative(e.target.checked)}
                  className="rounded text-primary h-4 w-4"
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="font-bold text-foreground">إلزامية إرفاق مستند أو تقرير طبي:</label>
                <input
                  type="checkbox"
                  checked={typeRequiresAttachment}
                  onChange={(e) => setTypeRequiresAttachment(e.target.checked)}
                  className="rounded text-primary h-4 w-4"
                />
              </div>
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

      {/* Adjust Balance Dialog */}
      <Dialog open={isAdjustBalanceOpen} onOpenChange={setIsAdjustBalanceOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Sliders className="h-5 w-5 text-primary" />
              تعديل رصيد إجازة استثنائي (Balance Adjustment)
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              إضافة أو خصم أيام رصيد مع توثيق الأسباب في سجل التدقيق الإداري والمالي.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2 text-xs">
            <div className="space-y-1.5">
              <label className="font-bold">الموظف المعني *</label>
              <div className="relative mb-2">
                <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="ابحث بالاسم أو الرقم الوظيفي..."
                  value={adjustEmpSearch}
                  onChange={(e) => setAdjustEmpSearch(e.target.value)}
                  className="w-full h-9 rounded-xl border border-border/80 bg-muted/40 pr-9 pl-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <select
                value={adjustEmpId}
                onChange={(e) => setAdjustEmpId(e.target.value)}
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 font-semibold"
              >
                <option value="">-- اختر الموظف --</option>
                {filteredAdjustEmployees.map((emp: EmployeeDirectoryItem) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.firstNameAr} {emp.lastNameAr} {emp.employeeNo ? `(${emp.employeeNo})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold">نوع الإجازة *</label>
              <select
                value={adjustTypeId}
                onChange={(e) => setAdjustTypeId(e.target.value)}
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 font-semibold"
              >
                {leaveTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.nameAr}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold">عدد الأيام للتعديل (+ إضافة / - خصم) *</label>
              <input
                type="number"
                value={adjustDays}
                onChange={(e) => setAdjustDays(Number(e.target.value))}
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 font-mono text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold">سبب التعديل الاستثنائي *</label>
              <textarea
                rows={2}
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="مثال: رصيد تعويضي عن ساعات عمل إضافية في عطلة رسمية..."
                className="w-full rounded-2xl border border-border/80 bg-muted/40 p-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAdjustBalanceOpen(false)}
              className="rounded-full text-xs font-bold"
            >
              إلغاء
            </Button>
            <Button
              size="sm"
              onClick={handleAdjustBalance}
              disabled={isAdjustingBalance}
              className="rounded-full text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 h-9"
            >
              {isAdjustingBalance ? "جاري التوثيق..." : "تأكيد وتوثيق تعديل الرصيد"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
