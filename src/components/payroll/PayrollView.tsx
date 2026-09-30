import React, { useEffect, useState, useMemo } from "react";
import { useApp } from "../../lib/context/AppContext";
import { exportToCSV, generateWPSSIFFile } from "../../lib/utils/export-helpers";
import type { EmployeePayrollDetail, FinalSettlementRecord } from "../../types";
import type { SeparationType, SettlementCalculationPreview } from "../../lib/business/settlement.functions";
import { useAuth } from "../../lib/auth/AuthContext";
import { useDemoStore } from "../../lib/domains/demo/demo-store";
import { usePayroll, usePayrollMutations } from "../../lib/domains/payroll";
import { useEmployees } from "../../lib/domains/employees";
import {
  usePayrollExceptions,
  usePayrollRunEmployees,
  useCompanyBankAccounts,
} from "../../lib/data/payroll-repository";
import { IconSymbol } from "../ui/IconSymbol";
import { PayrollDistributionPanel } from "./PayrollDistributionPanel";
import { SalaryFilesPanel } from "./SalaryFilesPanel";
import { PayrollPaymentsPanel } from "./PayrollPaymentsPanel";
import { PayrollReconciliationPanel } from "./PayrollReconciliationPanel";
import { LoansTreasuryPanel } from "./LoansTreasuryPanel";
import { BankTransferPanel } from "./BankTransferPanel";
import { SettlementNotificationsPanel } from "./SettlementNotificationsPanel";
import { MonthlyReportsPanel } from "./MonthlyReportsPanel";
import { AppLogo } from "../common/AppLogo";
import {
  Wallet,
  DollarSign,
  Download,
  Lock,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  AlertCircle,
  Eye,
  Plus,
  ArrowDownRight,
  TrendingUp,
  Receipt,
  Printer,
  ShieldCheck,
  Building,
  CreditCard,
  FileCheck,
  Search,
  Filter,
  Info,
  Calendar,
  UserCheck,
  UserX,
  Coins,
  ListOrdered,
  QrCode,
  RotateCcw,
} from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { toast } from "sonner";
import {
  useEmployeeSeparations,
  useClearanceItems,
  useSeparationMutations,
  type EmployeeSeparation,
  SEPARATION_TYPE_LABELS,
  CLEARANCE_CATEGORY_LABELS,
  CLEARANCE_STATUS_LABELS,
} from "../../lib/domains/separation";
import {
  useLoanInstallments,
  useLoanMutations,
} from "../../lib/domains/loans";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";

interface PayrollViewProps {
  section?: "payroll" | "loans";
  initialRunId?: string;
}

export const PayrollView: React.FC<PayrollViewProps> = ({
  section = "payroll",
  initialRunId,
}) => {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);

  // 1. Production Domain & Repository Data Hooks
  const {
    payrollRuns,
    payrollGroups,
    loans,
    settlements,
    kpis,
    isLoading: isPayrollLoading,
    refetch: refetchPayroll,
  } = usePayroll();
  const { employees } = useEmployees();
  const { data: bankAccounts = [] } = useCompanyBankAccounts();
  const demoPayrollDetails = useDemoStore((s) => s.payrollDetails);

  const {
    orgUnits,
    company,
    currentRole,
    openEmployeeProfile,
    language,
    t,
  } = useApp();

  const payrollMutations = usePayrollMutations();
  const {
    processPayrollRun,
    approvePayrollRun,
    lockAndConfirmPayrollRun,
    reopenPayrollRun,
    markPayrollAsPaid,
    createLoan,
    calculateSettlement,
    createSettlement,
  } = payrollMutations;

  const [activeTab, setActiveTab] = useState(section === "payroll" ? "runs" : "loans");
  const [selectedRunId, setSelectedRunId] = useState(
    initialRunId || payrollRuns[0]?.id || "",
  );
  const [selectedPayslipEmployee, setSelectedPayslipEmployee] =
    useState<EmployeePayrollDetail | null>(null);
  const [selectedSettlementForClearance, setSelectedSettlementForClearance] =
    useState<FinalSettlementRecord | null>(null);

  // Search & Filter in Payroll Details Table
  const [detailSearch, setDetailSearch] = useState("");
  const [detailDeptFilter, setDetailDeptFilter] = useState("all");

  const today = new Date();
  const [isRunModalOpen, setIsRunModalOpen] = useState(false);
  const [runGroupId, setRunGroupId] = useState(payrollGroups[0]?.id || "");
  const [runYear, setRunYear] = useState(today.getFullYear());
  const [runMonth, setRunMonth] = useState(today.getMonth() + 1);

  // Loan Modal State
  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);
  const [loanEmpId, setLoanEmpId] = useState(employees[0]?.id || "");
  const [loanAmount, setLoanAmount] = useState(5000);
  const [installmentsCount, setInstallmentsCount] = useState(5);
  const [loanReason, setLoanReason] = useState("");

  // Separation & Offboarding Hooks & State
  const { data: separations = [] } = useEmployeeSeparations();
  const { initiateSeparation, updateClearanceItem, finalizeOffboarding, isFinalizingOffboarding } =
    useSeparationMutations();
  const { submitLoan, settleEarly, isSettlingEarly } = useLoanMutations();

  const [selectedLoanForSchedule, setSelectedLoanForSchedule] = useState<string | null>(null);
  const { data: loanInstallments = [], isLoading: isLoadingInstallments } =
    useLoanInstallments(selectedLoanForSchedule);

  const [selectedSeparationForDetail, setSelectedSeparationForDetail] =
    useState<EmployeeSeparation | null>(null);
  const { data: clearanceItems = [] } = useClearanceItems(selectedSeparationForDetail?.id);

  const [isSeparationModalOpen, setIsSeparationModalOpen] = useState(false);
  const [sepEmpId, setSepEmpId] = useState(employees[0]?.id || "");
  const [sepType, setSepType] = useState<string>("contract_expiration");
  const [sepLastWorkingDay, setSepLastWorkingDay] = useState("2026-09-30");
  const [sepReason, setSepReason] = useState("");
  const [sepNoticeServed, setSepNoticeServed] = useState(true);
  const [isInitiatingSep, setIsInitiatingSep] = useState(false);

  // EOSB Settlement Wizard State (Server-Authoritative Preview)
  const [isSettlementModalOpen, setIsSettlementModalOpen] = useState(false);
  const [settlementEmpId, setSettlementEmpId] = useState(employees[0]?.id || "");
  const [terminationDate, setTerminationDate] = useState("2026-08-31");
  const [separationType, setSeparationType] = useState<SeparationType>("contract_expiration");
  const [settlementPreview, setSettlementPreview] = useState<SettlementCalculationPreview | null>(null);
  const [isCalculatingSettlement, setIsCalculatingSettlement] = useState(false);
  const [settlementCalcError, setSettlementCalcError] = useState<string | null>(null);

  const selectedRun = payrollRuns.find((r) => r.id === selectedRunId) || payrollRuns[0];
  const runEmployeesQuery = usePayrollRunEmployees(selectedRun?.id);
  const exceptionsQuery = usePayrollExceptions(selectedRun?.id);
  const exceptions = exceptionsQuery.data || [];
  const blockingExceptions = exceptions.filter((e) => e.severity === "blocking" && !e.isResolved);
  const warningExceptions = exceptions.filter((e) => e.severity === "warning" && !e.isResolved);

  const selectedRunDetails: EmployeePayrollDetail[] = useMemo(() => {
    if (!selectedRun) return [];
    if (isLive && runEmployeesQuery.data && runEmployeesQuery.data.length > 0) {
      return runEmployeesQuery.data.map((re) => ({
        id: re.id,
        payrollRunId: re.payrollRunId,
        employeeId: re.employeeId,
        employeeNo: re.employeeNo,
        employeeName: re.employeeName,
        jobTitle: "",
        departmentName: re.departmentName || "",
        bankName: re.bankName || "",
        iban: re.iban || "",
        basicSalary: re.basicSalary,
        housingAllowance: re.housingAllowance,
        transportAllowance: re.transportAllowance,
        otherAllowances: 0,
        overtimeHours: re.overtimeHours,
        overtimeAmount: re.overtimeAmount,
        retroAdjustments: 0,
        bonusAmount: re.bonusAmount,
        grossSalary: re.grossSalary,
        unpaidLeaveDeduction: re.unpaidLeaveDeduction,
        absenceLateDeduction: re.absenceDeduction,
        loanInstallmentDeduction: re.loanDeduction,
        gosiEmployeeDeduction: re.gosiEmployee,
        gosiEmployerContribution: re.gosiEmployer,
        otherDeductions: re.otherDeductions,
        totalDeductions: re.totalDeductions,
        netSalary: re.netSalary,
        unpaidLeaveDays: re.unpaidLeaveDays,
        absenceDays: re.absenceDays,
      }));
    }
    return demoPayrollDetails.filter((detail) => detail.payrollRunId === selectedRun.id);
  }, [selectedRun, isLive, runEmployeesQuery.data, demoPayrollDetails]);

  // Authoritative server calculation preview effect for Final Settlement
  useEffect(() => {
    if (!isSettlementModalOpen || !settlementEmpId || !terminationDate) {
      setSettlementPreview(null);
      setSettlementCalcError(null);
      return;
    }
    let isCancelled = false;
    setIsCalculatingSettlement(true);
    setSettlementCalcError(null);

    calculateSettlement({
      employeeId: settlementEmpId,
      terminationDate,
      separationType,
    })
      .then((preview) => {
        if (!isCancelled) {
          setSettlementPreview(preview);
          setSettlementCalcError(null);
        }
      })
      .catch((err: any) => {
        if (!isCancelled) {
          setSettlementPreview(null);
          setSettlementCalcError(err?.message || "تعذر احتساب مخالصة نهاية الخدمة من المحرك المالي");
        }
      })
      .finally(() => {
        if (!isCancelled) setIsCalculatingSettlement(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [isSettlementModalOpen, settlementEmpId, terminationDate, separationType, calculateSettlement]);

  const filteredRunDetails = useMemo(() => {
    return selectedRunDetails.filter((item) => {
      const matchesSearch =
        item.employeeName.toLowerCase().includes(detailSearch.toLowerCase()) ||
        item.employeeNo.toLowerCase().includes(detailSearch.toLowerCase());
      const matchesDept =
        detailDeptFilter === "all" || item.departmentName === detailDeptFilter;
      return matchesSearch && matchesDept;
    });
  }, [selectedRunDetails, detailSearch, detailDeptFilter]);

  const uniqueDepartments = useMemo(() => {
    const depts = new Set<string>();
    selectedRunDetails.forEach((d) => {
      if (d.departmentName) depts.add(d.departmentName);
    });
    return Array.from(depts);
  }, [selectedRunDetails]);

  const canManagePayroll = ["super_admin", "hr_manager", "payroll_officer"].includes(currentRole);
  const canManageSettlements = [
    "super_admin",
    "hr_manager",
    "payroll_officer",
    "finance_officer",
  ].includes(currentRole);
  const canRequestLoan = currentRole !== "auditor";

  useEffect(() => {
    setActiveTab(section === "payroll" ? "runs" : "loans");
  }, [section]);

  useEffect(() => {
    if (selectedRun && selectedRun.id !== selectedRunId) setSelectedRunId(selectedRun.id);
  }, [selectedRun, selectedRunId]);

  const [isRunningPayroll, setIsRunningPayroll] = useState(false);
  const [isCreatingLoan, setIsCreatingLoan] = useState(false);
  const [isSavingSettlement, setIsSavingSettlement] = useState(false);
  const [isLockingRun, setIsLockingRun] = useState(false);
  const [isPayingRun, setIsPayingRun] = useState(false);
  const [isApprovingRun, setIsApprovingRun] = useState(false);
  const [isReopenModalOpen, setIsReopenModalOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const [isReopeningRun, setIsReopeningRun] = useState(false);

  const handleRunNewPayroll = async () => {
    const groupId = payrollGroups.some((group) => group.id === runGroupId)
      ? runGroupId
      : payrollGroups[0]?.id;
    if (!groupId) {
      toast.error("يجب إنشاء مجموعة رواتب أولاً قبل تشغيل المسير");
      return;
    }
    const targetRunId = `pr-${groupId}-${runYear}-${String(runMonth).padStart(2, "0")}`;
    setIsRunningPayroll(true);
    try {
      const ok = await processPayrollRun(groupId, runYear, runMonth);
      if (ok) {
        setSelectedRunId(targetRunId);
        setActiveTab("runs");
        setIsRunModalOpen(false);
      }
    } finally {
      setIsRunningPayroll(false);
    }
  };

  const handleExportWPS = () => {
    if (!selectedRun) {
      toast.error("يرجى اختيار مسير رواتب أولاً");
      return;
    }

    // 1. Status Check: Must be approved, locked, or paid
    if (!["approved", "locked", "confirmed_locked", "paid"].includes(selectedRun.status)) {
      toast.error(
        `لا يمكن تصدير ملف حماية الأجور (WPS) إلا بعد اعتماد أو إقفال المسير رسمياً. (الحالة الحالية: ${selectedRun.status})`
      );
      return;
    }

    // 2. Company Establishment ID check (NO fake fallbacks)
    const establishmentId = (
      company.crNumber ||
      company.taxNumber ||
      company.unifiedNumber ||
      company.laborOfficeNumber ||
      ""
    ).trim();
    if (!establishmentId) {
      toast.error(
        "رقم المنشأة / السجل التجاري غير محدد في إعدادات المنشأة. يرجى ضبط السجل التجاري المعتمد أولاً قبل تصدير ملف WPS."
      );
      return;
    }

    // 3. Bank Code check (NO fake fallbacks)
    const primaryAccount = bankAccounts.find((a) => a.isPrimary) || bankAccounts[0];
    const employerBankCode = (
      primaryAccount?.bankCode ||
      primaryAccount?.swiftCode ||
      ""
    ).trim();
    if (!employerBankCode) {
      toast.error(
        "رمز البنك للمنشأة غير محدد في الحساب البنكي المعتمد. يرجى تهيئة رمز البنك للحساب البنكي الرئيسي قبل تصدير ملف WPS."
      );
      return;
    }

    // 4. Employee records & IBAN check
    if (selectedRunDetails.length === 0) {
      toast.error("لا توجد تفاصيل موظفين في المسير المختار جاهزة للصرف");
      return;
    }

    const invalidEmployees = selectedRunDetails.filter((d) => {
      const iban = (d.iban || "").trim().toUpperCase();
      return !iban || iban.length < 15 || /^SA0{6,}/.test(iban) || /^SA0+$/.test(iban);
    });

    if (invalidEmployees.length > 0) {
      const sampleNames = invalidEmployees
        .slice(0, 3)
        .map((e) => `${e.employeeName} (${e.employeeNo})`)
        .join("، ");
      toast.error(
        `يوجد ${invalidEmployees.length} موظف ليس لديهم آيبان بنكي معتمد أو لديهم آيبان غير صالح (${sampleNames}). تم إيقاف تصدير WPS للامتثال لحماية الأجور.`
      );
      return;
    }

    // 5. Accurate timestamps & SIF generation
    const now = new Date();
    const fileCreationDate = now.toISOString().split("T")[0];
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const fileCreationTime = `${hours}${minutes}`;

    const wpsRecords = selectedRunDetails.map((d) => ({
      employeeId: d.employeeNo,
      employeeName: d.employeeName,
      iban: (d.iban || "").trim().toUpperCase(),
      basicSalary: d.basicSalary,
      housingAllowance: d.housingAllowance,
      otherEarnings: (d.transportAllowance || 0) + (d.overtimeAmount || 0),
      deductions: d.totalDeductions,
      netSalary: d.netSalary,
    }));

    generateWPSSIFFile({
      establishmentId,
      employerBankCode,
      fileCreationDate,
      fileCreationTime,
      salaryYearMonth: `${selectedRun.periodYear}${String(selectedRun.periodMonth).padStart(2, "0")}`,
      records: wpsRecords,
    });

    toast.success(
      "تم تصدير ملف حماية الأجور (WPS SIF) المعتمد بنجاح. حالة الملف: تم التوليد وبانتظار الإرسال والاعتماد البنكي (awaiting_submission)."
    );
  };

  const handleExportPayrollCSV = () => {
    if (!selectedRun || selectedRunDetails.length === 0) return;
    const data = selectedRunDetails.map((d) => ({
      "الرقم الوظيفي": d.employeeNo,
      "اسم الموظف": d.employeeName,
      "المسمى الوظيفي": d.jobTitle,
      "القسم / الإدارة": d.departmentName,
      "الراتب الأساسي": d.basicSalary,
      "بدل السكن": d.housingAllowance,
      "بدل النقل": d.transportAllowance,
      "أجر العمل الإضافي": d.overtimeAmount,
      "التأمينات الاجتماعية (GOSI)": d.gosiEmployeeDeduction,
      "استقطاع السلف": d.loanInstallmentDeduction,
      "خصومات الغياب والتأخير": d.absenceLateDeduction,
      "إجمالي الاستقطاعات": d.totalDeductions,
      "صافي الراتب": d.netSalary,
      "اسم البنك": d.bankName,
      الآيبان: d.iban,
    }));
    exportToCSV(`Payroll_Run_${selectedRun.periodMonth}_${selectedRun.periodYear}`, data);
  };

  const handleCreateLoan = async () => {
    if (!loanReason) {
      toast.error("يرجى كتابة سبب طلب السلفة");
      return;
    }
    setIsCreatingLoan(true);
    try {
      await submitLoan({
        loanType: "personal_advance",
        amount: loanAmount,
        installments: installmentsCount,
        reason: loanReason,
        employeeId: loanEmpId,
      });
      setIsLoanModalOpen(false);
      setLoanReason("");
    } catch {
      // toast shown by mutation
    } finally {
      setIsCreatingLoan(false);
    }
  };

  const handleInitiateSeparation = async () => {
    if (!sepReason) {
      toast.error("يرجى كتابة سبب ومبرر إنهاء الخدمة");
      return;
    }
    setIsInitiatingSep(true);
    try {
      await initiateSeparation({
        employeeId: sepEmpId,
        separationType: sepType,
        lastWorkingDay: sepLastWorkingDay,
        reason: sepReason,
        noticeServed: sepNoticeServed,
      });
      setIsSeparationModalOpen(false);
      setSepReason("");
    } catch {
      // toast shown by mutation
    } finally {
      setIsInitiatingSep(false);
    }
  };

  const handleSettleLoanEarly = async (loanId: string) => {
    try {
      await settleEarly({ loanId, notes: "سداد مبكر معتمد من لوحة التحكم" });
    } catch {
      // toast shown by mutation
    }
  };

  const handleFinalizeOffboarding = async (separationId: string) => {
    try {
      await finalizeOffboarding({ separationId });
      setSelectedSeparationForDetail(null);
    } catch {
      // toast shown by mutation
    }
  };

  const handleSaveSettlement = async () => {
    if (!settlementEmpId || !terminationDate) {
      toast.error("يرجى اختيار الموظف وتحديد تاريخ نهاية الخدمة");
      return;
    }
    if (!settlementPreview) {
      toast.error("يرجى الانتظار حتى اكتمال احتساب المعاينة من المحرك المالي");
      return;
    }
    setIsSavingSettlement(true);
    try {
      const ok = await createSettlement({
        employeeId: settlementEmpId,
        terminationDate,
        separationType,
        noticePeriodServed: true,
        assetClearanceComplete: false,
        notes: `مخالصة نهاية خدمة - سبب الإنهاء: ${separationType}`,
      });
      if (ok) {
        setIsSettlementModalOpen(false);
        setSettlementPreview(null);
      }
    } finally {
      setIsSavingSettlement(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      {/* Executive Page Header */}
      <div className="classera-page-header">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-xs">
              <IconSymbol name="account_balance_wallet" source="material" filled size={24} className="text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-foreground">
                  {section === "payroll"
                    ? "مسيرات الرواتب وملفات حماية الأجور (WPS)"
                    : "إدارة السلف ومكافأة نهاية الخدمة والمخالصات"}
                </h1>
                <Badge variant="outline" className="text-[11px] font-bold border-primary/30 text-primary bg-primary/5 rounded-full px-2.5 py-0.5">
                  {section === "payroll" ? "موثق مع حماية الأجور WPS" : "متوافق مع قوى ونظام العمل"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground font-medium mt-0.5">
                {section === "payroll"
                  ? "محرك احتساب الرواتب الآلي، خصومات التأمينات (GOSI)، حماية الأجور (WPS SIF)، وقسائم الرواتب المعتمدة"
                  : "إدارة السلف الشهرية، وجدولة الأقساط، ومخالصات نهاية الخدمة (EOSB) المتوافقة مع قوى ونظام العمل"}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {section === "payroll" && canManagePayroll && (
            <Button
              onClick={() => {
                setRunGroupId(payrollGroups[0]?.id || "");
                setIsRunModalOpen(true);
              }}
              size="sm"
              className="classera-btn-primary rounded-full font-bold text-xs gap-1.5 shadow-xs h-10 px-5 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              تشغيل مسير رواتب جديد
            </Button>
          )}
          {section === "loans" && canManageSettlements && (
            <Button
              onClick={() => setIsSeparationModalOpen(true)}
              variant="outline"
              size="sm"
              className="rounded-full font-bold text-xs gap-1.5 border-border/80 hover:bg-secondary h-10 px-4 shadow-xs cursor-pointer"
            >
              <UserX className="h-4 w-4 text-primary" />
              إجراء إنهاء خدمة / استقالة
            </Button>
          )}
          {section === "loans" && canManageSettlements && (
            <Button
              onClick={() => setIsSettlementModalOpen(true)}
              variant="outline"
              size="sm"
              className="rounded-full font-bold text-xs gap-1.5 border-border/80 hover:bg-secondary h-10 px-4 shadow-xs cursor-pointer"
            >
              <FileCheck className="h-4 w-4 text-primary" />
              احتساب مخالصة نهاية الخدمة
            </Button>
          )}
          {section === "loans" && canRequestLoan && (
            <Button
              onClick={() => setIsLoanModalOpen(true)}
              variant="secondary"
              size="sm"
              className="rounded-full font-bold text-xs gap-1.5 bg-secondary text-secondary-foreground hover:bg-secondary/80 h-10 px-4 shadow-xs cursor-pointer"
            >
              <DollarSign className="h-4 w-4 text-primary" />
              طلب سلفة مالية جديدة
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="classera-tabs-strip">
          {section === "payroll" ? (
            <>
              <TabsTrigger value="runs" className="rounded-xl text-xs font-bold py-2 whitespace-nowrap px-3.5">
                مسيرات الرواتب الشهرية ({payrollRuns.length})
              </TabsTrigger>
              <TabsTrigger value="distribution" className="rounded-xl text-xs font-bold py-2 whitespace-nowrap px-3.5">
                توزيع الرواتب حسب الإدارة
              </TabsTrigger>
              <TabsTrigger value="salaryFiles" className="rounded-xl text-xs font-bold py-2 whitespace-nowrap px-3.5">
                ملفات الرواتب
              </TabsTrigger>
              <TabsTrigger value="payments" className="rounded-xl text-xs font-bold py-2 whitespace-nowrap px-3.5">
                دفع الرواتب
              </TabsTrigger>
              <TabsTrigger value="bank" className="rounded-xl text-xs font-bold py-2 whitespace-nowrap px-3.5">
                التحويل البنكي
              </TabsTrigger>
              <TabsTrigger value="reports" className="rounded-xl text-xs font-bold py-2 whitespace-nowrap px-3.5">
                التقارير الشهرية
              </TabsTrigger>
              <TabsTrigger value="reconciliation" className="rounded-xl text-xs font-bold py-2 whitespace-nowrap px-3.5">
                تسويات الرواتب
              </TabsTrigger>
            </>
          ) : (
            <>
              <TabsTrigger value="loans" className="rounded-xl text-xs font-bold py-2 whitespace-nowrap px-3.5">
                سجل السلف والأقساط ({loans.length})
              </TabsTrigger>
              <TabsTrigger value="separations" className="rounded-xl text-xs font-bold py-2 whitespace-nowrap px-3.5">
                حالات إنهاء الخدمة وإخلاء الطرف ({separations.length})
              </TabsTrigger>
              <TabsTrigger value="settlements" className="rounded-xl text-xs font-bold py-2 whitespace-nowrap px-3.5">
                مخالصات نهاية الخدمة ({settlements.length})
              </TabsTrigger>
            </>
          )}
        </TabsList>

        {/* Tab 1: Payroll Runs */}
        <TabsContent value="runs" className="space-y-4 pt-4">
          {selectedRun ? (
            <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-base font-black text-foreground">
                      مسير رواتب {selectedRun.periodMonth} / {selectedRun.periodYear} (
                      {selectedRun.payrollGroupName})
                    </h2>
                    <Badge
                      variant="outline"
                      className={`text-xs rounded-full px-3 py-0.5 font-bold ${
                        selectedRun.status === "paid"
                          ? "bg-purple-500/10 text-purple-700 border-purple-200"
                          : selectedRun.status === "locked" || selectedRun.status === "confirmed_locked"
                            ? "bg-emerald-500/10 text-emerald-700 border-emerald-200"
                            : selectedRun.status === "approved"
                              ? "bg-blue-500/10 text-blue-700 border-blue-200"
                              : selectedRun.status === "calculated"
                                ? "bg-cyan-500/10 text-cyan-700 border-cyan-200"
                                : "bg-amber-500/10 text-amber-700 border-amber-200"
                      }`}
                    >
                      {selectedRun.status === "paid"
                        ? "تم الصرف بنجاح"
                        : selectedRun.status === "locked" || selectedRun.status === "confirmed_locked"
                          ? "مغلق ومؤكد"
                          : selectedRun.status === "approved"
                            ? "معتمد وجاهز للصرف"
                            : selectedRun.status === "calculated"
                              ? "تم الاحتساب بنجاح"
                              : selectedRun.status === "under_review" || selectedRun.status === "ready_for_review"
                                ? "جاهز للمراجعة"
                                : "مسودة عمل"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground font-medium mt-1">
                    طريقة الاحتساب: ثابت 30 يوم • التغطية: {selectedRun.totalEmployees} موظف مسجل
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {payrollRuns.length > 1 && (
                    <select
                      aria-label="اختيار مسير الرواتب"
                      value={selectedRun.id}
                      onChange={(event) => setSelectedRunId(event.target.value)}
                      className="h-9 rounded-full border border-border/80 bg-background px-3 text-xs font-bold"
                    >
                      {payrollRuns.map((run) => (
                        <option key={run.id} value={run.id}>
                          {run.periodMonth}/{run.periodYear} — {run.payrollGroupName}
                        </option>
                      ))}
                    </select>
                  )}
                  <Button
                    onClick={handleExportPayrollCSV}
                    variant="outline"
                    size="sm"
                    className="rounded-full text-xs font-bold gap-1.5 h-9 border-border/80 hover:bg-secondary cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" />
                    تصدير كشف الرواتب
                  </Button>
                  <Button
                    onClick={handleExportWPS}
                    variant="outline"
                    size="sm"
                    className="rounded-full text-xs font-bold gap-1.5 text-primary border-primary/30 hover:bg-secondary h-9 cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" />
                    تحميل ملف حماية الأجور (SIF)
                  </Button>
                  {canManagePayroll && ["draft", "calculated", "ready_for_review", "under_review"].includes(selectedRun.status) && (
                    <Button
                      onClick={async () => {
                        if (blockingExceptions.length > 0) {
                          toast.error("لا يمكن اعتماد المسير مع وجود استثناءات مانعة للاعتماد");
                          return;
                        }
                        setIsApprovingRun(true);
                        try {
                          await payrollMutations.approvePayrollRun(selectedRun.id);
                        } finally {
                          setIsApprovingRun(false);
                        }
                      }}
                      disabled={isApprovingRun || blockingExceptions.length > 0}
                      size="sm"
                      className="rounded-full text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white gap-1.5 h-9 px-4 cursor-pointer"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {isApprovingRun ? "جاري الاعتماد..." : "اعتماد المسير"}
                    </Button>
                  )}
                  {canManagePayroll && ["approved", "draft", "ready_for_review"].includes(selectedRun.status) && (
                    <Button
                      onClick={async () => {
                        if (blockingExceptions.length > 0) {
                          toast.error("لا يمكن قفل المسير مع وجود استثناءات مانعة للاعتماد");
                          return;
                        }
                        setIsLockingRun(true);
                        try {
                          await lockAndConfirmPayrollRun(selectedRun.id);
                        } finally {
                          setIsLockingRun(false);
                        }
                      }}
                      disabled={isLockingRun || blockingExceptions.length > 0}
                      size="sm"
                      className="rounded-full text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 h-9 px-4 cursor-pointer"
                    >
                      <Lock className="h-3.5 w-3.5" />
                      {isLockingRun ? "جاري القفل..." : "قفل المسير وتثبيت السلف"}
                    </Button>
                  )}
                  {canManagePayroll && ["locked", "confirmed_locked", "approved"].includes(selectedRun.status) && (
                    <Button
                      onClick={() => {
                        setReopenReason("");
                        setIsReopenModalOpen(true);
                      }}
                      variant="outline"
                      size="sm"
                      className="rounded-full text-xs font-bold gap-1.5 border-amber-300 text-amber-800 bg-amber-50 hover:bg-amber-100 h-9 px-3 cursor-pointer"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      إعادة فتح المسير
                    </Button>
                  )}
                  {canManagePayroll && ["locked", "confirmed_locked", "approved"].includes(selectedRun.status) && (
                    <Button
                      onClick={async () => {
                        setIsPayingRun(true);
                        try {
                          await markPayrollAsPaid(selectedRun.id);
                        } finally {
                          setIsPayingRun(false);
                        }
                      }}
                      disabled={isPayingRun}
                      size="sm"
                      className="rounded-full text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white gap-1.5 h-9 px-4 cursor-pointer"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {isPayingRun ? "جاري التأكيد..." : "تأكيد الصرف البنكي"}
                    </Button>
                  )}
                </div>
              </div>

              {/* Exceptions Alert Banner */}
              {blockingExceptions.length > 0 && (
                <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-3.5 flex items-start gap-2.5 text-xs text-destructive">
                  <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">استثناءات مانعة للاعتماد (Blocking Exceptions - {blockingExceptions.length}):</span>
                    <ul className="list-disc list-inside mt-1 space-y-0.5 font-medium">
                      {blockingExceptions.map((ex) => (
                        <li key={ex.id}>
                          <span className="font-bold">{ex.titleAr}:</span> {ex.messageAr}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
              {warningExceptions.length > 0 && blockingExceptions.length === 0 && (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-200">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">تنبيهات احتساب المسير ({warningExceptions.length}):</span>
                    <span className="mr-1">{warningExceptions[0]?.messageAr}</span>
                  </div>
                </div>
              )}

              {/* Totals Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div className="classera-kpi-card p-4">
                  <span className="text-muted-foreground font-bold text-xs">إجمالي الراتب الأساسي</span>
                  <p className="text-lg font-black text-foreground mt-1 font-mono font-tabular-nums">
                    {selectedRun.totalBasicSalary.toLocaleString()} ر.س
                  </p>
                </div>
                <div className="classera-kpi-card p-4">
                  <span className="text-muted-foreground font-bold text-xs">البدلات والعمل الإضافي</span>
                  <p className="text-lg font-black text-emerald-600 mt-1 font-mono font-tabular-nums">
                    +{(selectedRun.totalAllowances + selectedRun.totalOvertimeAmount).toLocaleString()} ر.س
                  </p>
                </div>
                <div className="classera-kpi-card p-4">
                  <span className="text-muted-foreground font-bold text-xs">الاستقطاعات والتأمينات</span>
                  <p className="text-lg font-black text-destructive mt-1 font-mono font-tabular-nums">
                    -{selectedRun.totalDeductions.toLocaleString()} ر.س
                  </p>
                </div>
                <div className="classera-kpi-card p-4">
                  <span className="text-primary font-bold text-xs">صافي المسير النهائي</span>
                  <p className="text-xl font-black text-primary mt-1 font-mono font-tabular-nums">
                    {selectedRun.totalNetSalary.toLocaleString()} ر.س
                  </p>
                </div>
              </div>

              {/* Filter Bar */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/60">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={detailSearch}
                    onChange={(e) => setDetailSearch(e.target.value)}
                    placeholder="بحث باسم الموظف أو الرقم الوظيفي..."
                    className="w-full h-9 rounded-full border border-border/80 bg-muted/40 pr-9 pl-4 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
                <select
                  value={detailDeptFilter}
                  onChange={(e) => setDetailDeptFilter(e.target.value)}
                  className="h-9 rounded-full border border-border/80 bg-muted/40 px-3 text-xs font-medium focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="all">جميع الإدارات والأقسام</option>
                  {uniqueDepartments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>

              {/* Employee Breakdown Table */}
              <div className="overflow-x-auto rounded-2xl border border-border/60">
                <table className="w-full text-xs">
                  <thead className="classera-table-head">
                    <tr>
                      <th className="py-3 px-3 text-start">الموظف</th>
                      <th className="py-3 px-3 text-start">الراتب الأساسي</th>
                      <th className="py-3 px-3 text-start">بدل السكن والنقل</th>
                      <th className="py-3 px-3 text-start">عمل إضافي (م107)</th>
                      <th className="py-3 px-3 text-start">التأمينات (GOSI)</th>
                      <th className="py-3 px-3 text-start">سلف وخصومات شاملة</th>
                      <th className="py-3 px-3 text-start font-bold text-foreground">الصافي المحول</th>
                      <th className="py-3 px-3 text-center">القسيمة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filteredRunDetails.map((item) => {
                      const nonGosiDeduction = Number(
                        (item.totalDeductions - item.gosiEmployeeDeduction).toFixed(2),
                      );
                      return (
                        <tr key={item.id} className="classera-table-row group">
                          <td className="py-3 px-3">
                            <button
                              type="button"
                              onClick={() => openEmployeeProfile(item.employeeId)}
                              className="text-start font-bold text-foreground block group-hover:text-primary group-hover:underline cursor-pointer"
                            >
                              {item.employeeName}
                            </button>
                            <span className="block text-[10px] font-normal text-muted-foreground font-mono">
                              {item.employeeNo} • {item.departmentName}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono">
                            {item.basicSalary.toLocaleString()} ر.س
                          </td>
                          <td className="py-3 px-3 font-mono text-emerald-600 font-bold">
                            +{(item.housingAllowance + item.transportAllowance).toLocaleString()} ر.س
                          </td>
                          <td className="py-3 px-3 font-mono font-bold">
                            {item.overtimeAmount > 0 ? (
                              <span className="text-primary font-bold">
                                +{item.overtimeAmount.toLocaleString()} ر.س
                              </span>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </td>
                          <td className="py-3 px-3 font-mono text-destructive">
                            -{item.gosiEmployeeDeduction.toLocaleString()} ر.س
                          </td>
                          <td className="py-3 px-3 font-mono text-destructive">
                            {nonGosiDeduction > 0 ? (
                              <div>
                                <span className="font-bold">
                                  -{nonGosiDeduction.toLocaleString()} ر.س
                                </span>
                                <div className="text-[9px] text-muted-foreground font-sans font-normal mt-0.5 flex flex-wrap gap-1">
                                  {item.absenceLateDeduction > 0 && (
                                    <span className="bg-destructive/10 text-destructive px-1.5 py-0.2 rounded-full">
                                      بصمة/غياب: -{item.absenceLateDeduction}
                                    </span>
                                  )}
                                  {item.unpaidLeaveDeduction > 0 && (
                                    <span className="bg-amber-500/10 text-amber-700 px-1.5 py-0.2 rounded-full">
                                      إجازات: -{item.unpaidLeaveDeduction}
                                    </span>
                                  )}
                                  {item.loanInstallmentDeduction > 0 && (
                                    <span className="bg-purple-500/10 text-purple-700 px-1.5 py-0.2 rounded-full">
                                      سلفة: -{item.loanInstallmentDeduction}
                                    </span>
                                  )}
                                  {item.otherDeductions > 0 && (
                                    <span className="bg-rose-500/10 text-rose-700 px-1.5 py-0.2 rounded-full">
                                      جزاءات: -{item.otherDeductions}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </td>
                          <td className="py-3 px-3 font-mono font-black text-foreground">
                            {item.netSalary.toLocaleString()} ر.س
                          </td>
                          <td className="py-3 px-3 text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedPayslipEmployee(item)}
                              className="h-7 text-xs text-primary gap-1 font-bold rounded-full hover:bg-secondary px-3 cursor-pointer"
                            >
                              <FileText className="h-3.5 w-3.5" />
                              القسيمة
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredRunDetails.length === 0 && (
                      <tr>
                        <td colSpan={8} className="text-center py-8 text-muted-foreground">
                          لا توجد بيانات موظفين تطابق البحث المحدد
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-border/80 bg-card/60 p-12 text-center shadow-xs flex flex-col items-center justify-center gap-4 my-4">
              <div className="h-16 w-16 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-xs">
                <FileSpreadsheet className="h-8 w-8 text-primary" />
              </div>
              <div className="max-w-md space-y-1.5">
                <h3 className="text-base font-black text-foreground">
                  لم يتم تشغيل أي مسير رواتب بعد
                </h3>
                <p className="text-xs text-muted-foreground font-medium leading-relaxed">
                  يمكنك تشغيل أول مسير رواتب للمنشأة الآن؛ سيقوم النظام تلقائياً بتجميع بيانات البصمة والحضور،
                  واحتساب دقائق التأخير والانصراف المبكر، والإجازات غير المدفوعة والمرضية (م117)، والجزاءات، وأقساط السلف والتأمينات الاجتماعية.
                </p>
              </div>
              {canManagePayroll && (
                <Button
                  onClick={() => {
                    setRunGroupId(payrollGroups[0]?.id || "");
                    setIsRunModalOpen(true);
                  }}
                  className="classera-btn-primary rounded-full font-bold text-xs h-11 px-8 gap-2 shadow-sm cursor-pointer mt-2"
                >
                  <Plus className="h-4 w-4" />
                  تشغيل مسير رواتب جديد الآن
                </Button>
              )}
            </div>
          )}
        </TabsContent>

        {/* Tab: Payroll distribution by organizational unit */}
        <TabsContent value="distribution" className="space-y-4 pt-4">
          <PayrollDistributionPanel
            orgUnits={orgUnits}
            employees={employees}
            details={selectedRunDetails}
            periodLabel={
              selectedRun ? `${selectedRun.periodMonth}-${selectedRun.periodYear}` : "تقديري"
            }
            isEstimate={selectedRunDetails.length === 0}
          />
        </TabsContent>

        {/* Tab: Real salary files per employee */}
        <TabsContent value="salaryFiles" className="space-y-4 pt-4">
          <SalaryFilesPanel />
        </TabsContent>

        {/* Tab: Monthly reconciliation & per-employee points report */}
        <TabsContent value="reconciliation" className="space-y-4 pt-4">
          <PayrollReconciliationPanel />
          <SettlementNotificationsPanel />
        </TabsContent>

        <TabsContent value="bank" className="space-y-4 pt-4">
          <BankTransferPanel />
        </TabsContent>

        <TabsContent value="reports" className="space-y-4 pt-4">
          <MonthlyReportsPanel />
        </TabsContent>

        {/* Tab: Monthly salary disbursement */}
        <TabsContent value="payments" className="space-y-4 pt-4">
          <PayrollPaymentsPanel />
        </TabsContent>


        {/* Tab 2: Loans & Advances with Visual Repayment Progress */}
        <TabsContent value="loans" className="space-y-4 pt-4">
          <LoansTreasuryPanel />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {loans.map((l) => {
              const progressPercent = Math.min(
                100,
                Math.round((l.paidInstallments / l.totalInstallments) * 100),
              );
              return (
                <div
                  key={l.id}
                  className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs space-y-3 hover:border-primary/40 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-black text-sm text-foreground block">{l.employeeName}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {l.reason || "سلفة مالية مستقطعة من الراتب"}
                      </span>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] rounded-full px-2.5 font-bold ${
                        l.status === "active"
                          ? "bg-amber-500/10 text-amber-700 border-amber-300"
                          : "bg-emerald-500/10 text-emerald-700 border-emerald-300"
                      }`}
                    >
                      {l.status === "active" ? "سارية والاستقطاع نشط" : "مسددة بالكامل"}
                    </Badge>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-bold">
                      <span className="text-muted-foreground">نسبة سداد الأقساط:</span>
                      <span className="text-primary font-mono">{progressPercent}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted/60 overflow-hidden">
                      <div
                        className="h-full bg-emerald-600 rounded-full transition-all duration-500"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs border-t border-border/60 pt-2.5 font-medium text-muted-foreground">
                    <div>
                      مبلغ السلفة الإجمالي:{" "}
                      <span className="font-bold text-foreground font-mono">
                        {l.principalAmount.toLocaleString()} ر.س
                      </span>
                    </div>
                    <div>
                      القسط الشهري:{" "}
                      <span className="font-bold text-foreground font-mono">
                        {l.monthlyInstallment.toLocaleString()} ر.س
                      </span>
                    </div>
                    <div>
                      الأقساط المسددة:{" "}
                      <span className="font-bold font-mono text-emerald-600">
                        {l.paidInstallments} من {l.totalInstallments} قسط
                      </span>
                    </div>
                    <div>
                      الرصيد المتبقي:{" "}
                      <span className="font-bold text-destructive font-mono">
                        {l.remainingBalance.toLocaleString()} ر.س
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border/60 flex items-center justify-between gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-8 rounded-xl font-bold gap-1 cursor-pointer"
                      onClick={() => setSelectedLoanForSchedule(l.id)}
                    >
                      <ListOrdered className="h-3.5 w-3.5 text-primary" />
                      جدول الأقساط
                    </Button>
                    {l.status === "active" && canManageSettlements && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="text-xs h-8 rounded-xl font-bold gap-1 cursor-pointer bg-amber-500/10 text-amber-800 hover:bg-amber-500/20"
                        onClick={() => handleSettleLoanEarly(l.id)}
                        disabled={isSettlingEarly}
                      >
                        <Coins className="h-3.5 w-3.5 text-amber-600" />
                        سداد مبكر
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* Tab: Employee Separation Cases & Clearance Checklist */}
        <TabsContent value="separations" className="space-y-4 pt-4">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* List of Separations */}
            <div className="w-full lg:w-1/2 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-border/60">
                <h3 className="text-sm font-black text-foreground">حالات إنهاء الخدمة والاستقالة ({separations.length})</h3>
                <span className="text-xs text-muted-foreground font-medium">اختر حالة لعرض بنود إخلاء الطرف</span>
              </div>
              {separations.length === 0 ? (
                <div className="p-8 text-center rounded-2xl border border-dashed border-border/80 text-muted-foreground text-xs">
                  لا توجد طلبات استقالة أو حالات إنهاء خدمة مسجلة حالياً
                </div>
              ) : (
                <div className="space-y-3">
                  {separations.map((sep) => {
                    const isSelected = selectedSeparationForDetail?.id === sep.id;
                    const typeLabel = SEPARATION_TYPE_LABELS[sep.separationType] || sep.separationType;
                    const clearanceBadge = CLEARANCE_STATUS_LABELS[sep.clearanceStatus] || { label: sep.clearanceStatus, color: "bg-muted text-muted-foreground" };
                    return (
                      <div
                        key={sep.id}
                        onClick={() => setSelectedSeparationForDetail(sep)}
                        className={`rounded-2xl border p-4 cursor-pointer transition-all ${
                          isSelected
                            ? "border-primary bg-primary/5 shadow-xs ring-1 ring-primary/30"
                            : "border-border/80 bg-card hover:border-primary/40"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-black text-sm text-foreground block">{sep.employeeName}</span>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {sep.employeeNo} • آخر يوم عمل: {sep.lastWorkingDay}
                            </span>
                          </div>
                          <Badge variant="outline" className={`text-[10px] rounded-full px-2.5 font-bold ${clearanceBadge.color}`}>
                            إخلاء الطرف: {clearanceBadge.label}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2.5 mt-2 border-t border-border/60">
                          <span className="font-semibold text-foreground/80">{typeLabel}</span>
                          <span className="text-[10px] font-mono">الحالة: {sep.status === "finalized" ? "منتهية الخدمة" : sep.status}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Clearance Checklist Detail Panel */}
            <div className="w-full lg:w-1/2 rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-4">
              {selectedSeparationForDetail ? (
                <>
                  <div className="border-b border-border/60 pb-3 flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-black text-foreground">
                        قائمة إخلاء الطرف: {selectedSeparationForDetail.employeeName}
                      </h4>
                      <p className="text-[11px] text-muted-foreground">
                        {SEPARATION_TYPE_LABELS[selectedSeparationForDetail.separationType]} • ينتهي العمل في: {selectedSeparationForDetail.lastWorkingDay}
                      </p>
                    </div>
                    {selectedSeparationForDetail.clearanceStatus === "completed" && selectedSeparationForDetail.status !== "finalized" && canManageSettlements && (
                      <Button
                        size="sm"
                        className="rounded-full text-xs font-bold bg-destructive text-destructive-foreground hover:bg-destructive/90 h-9 px-4 gap-1.5 cursor-pointer shadow-xs"
                        onClick={() => handleFinalizeOffboarding(selectedSeparationForDetail.id)}
                        disabled={isFinalizingOffboarding}
                      >
                        <UserCheck className="h-4 w-4" />
                        إنهاء الخدمة رسمياً وإغلاق الملف
                      </Button>
                    )}
                  </div>

                  <div className="space-y-2.5 max-h-[450px] overflow-y-auto pr-1">
                    {clearanceItems.length === 0 ? (
                      <div className="p-6 text-center text-xs text-muted-foreground">
                        جاري تهيئة بنود إخلاء الطرف أو لا توجد بنود مطلوبة...
                      </div>
                    ) : (
                      clearanceItems.map((item) => {
                        const catLabel = CLEARANCE_CATEGORY_LABELS[item.category] || item.category;
                        const isCleared = item.status === "cleared";
                        return (
                          <div
                            key={item.id}
                            className="rounded-2xl border border-border/70 bg-muted/20 p-3.5 flex items-center justify-between gap-3"
                          >
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                                  {catLabel}
                                </span>
                                <span className="text-xs font-bold text-foreground">{item.titleAr}</span>
                              </div>
                              {item.notes && <p className="text-[11px] text-muted-foreground font-mono">{item.notes}</p>}
                            </div>

                            <div className="flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className={`text-[10px] rounded-full px-2 font-bold ${
                                  isCleared ? "bg-emerald-100 text-emerald-800 border-emerald-300" : "bg-amber-100 text-amber-800 border-amber-300"
                                }`}
                              >
                                {isCleared ? "تم الإخلاء" : "معلق"}
                              </Badge>
                              {!isCleared && canManageSettlements && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-[11px] rounded-xl font-bold cursor-pointer hover:bg-emerald-50 hover:text-emerald-700"
                                  onClick={() => updateClearanceItem({ itemId: item.id, status: "cleared" })}
                                >
                                  اعتماد
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </>
              ) : (
                <div className="py-16 text-center space-y-2">
                  <UserX className="h-10 w-10 text-muted-foreground/40 mx-auto" />
                  <p className="text-xs font-bold text-muted-foreground">
                    اختر حالة إنهاء خدمة من القائمة لمتابعة بنود إخلاء الطرف والأصول والسلف
                  </p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Tab 3: Final Settlements & Clearance Certificate */}
        <TabsContent value="settlements" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {settlements.map((s) => (
              <div
                key={s.id}
                className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs space-y-3 hover:border-primary/40 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-black text-sm text-foreground block">{s.employeeName}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      تاريخ نهاية الخدمة: {s.terminationDate}
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    className="text-emerald-700 bg-emerald-50 text-[10px] rounded-full px-2.5 font-bold"
                  >
                    معتمدة ومصادقة
                  </Badge>
                </div>

                <div className="space-y-2 text-xs text-muted-foreground border-t border-border/60 pt-3 font-medium">
                  <div className="flex justify-between">
                    <span>مدة الخدمة النظامية:</span>
                    <span className="font-bold text-foreground font-mono">
                      {s.serviceYears} سنوات و {s.serviceMonths} أشهر
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>مكافأة نهاية الخدمة (EOSB):</span>
                    <span className="font-bold text-emerald-600 font-mono">
                      {s.eosbAmount.toLocaleString()} ر.س
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>تصفية رصيد الإجازات:</span>
                    <span className="font-bold text-foreground font-mono">
                      {s.leaveBalancePayoutAmount.toLocaleString()} ر.س ({s.leaveBalancePayoutDays} يوم)
                    </span>
                  </div>
                  <div className="flex justify-between font-black text-primary border-t border-border/60 pt-2 text-sm">
                    <span>صافي الشيك النهائي:</span>
                    <span className="font-mono">{s.netSettlementAmount.toLocaleString()} ر.س</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-border/60 flex justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedSettlementForClearance(s)}
                    className="h-8 text-xs font-bold gap-1.5 rounded-full border-border/80 hover:bg-secondary px-3"
                  >
                    <Printer className="h-3.5 w-3.5 text-primary" />
                    طباعة مخالصة وإبراء ذمة
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* MODAL 1: Run Payroll Setup */}
      <Dialog open={isRunModalOpen} onOpenChange={setIsRunModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6 overflow-y-auto max-h-[90vh] border border-border/80 shadow-2xl">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary via-[#00B5FF] to-emerald-400" />
          <DialogHeader className="pt-1">
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              تشغيل مسير رواتب جديد
            </DialogTitle>
            <DialogDescription className="text-xs font-medium text-muted-foreground">
              اختر مجموعة الرواتب والفترة المطلوب تجميع الحضور والسلف والاستحقاقات لها
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2 text-xs">
            <div className="space-y-1.5">
              <label className="font-bold text-foreground" htmlFor="payroll-group">
                مجموعة الرواتب *
              </label>
              <select
                id="payroll-group"
                value={runGroupId}
                onChange={(event) => setRunGroupId(event.target.value)}
                className="h-10 w-full rounded-2xl border border-border/80 bg-muted/40 px-3 font-bold text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                {payrollGroups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.nameAr}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="font-bold text-foreground" htmlFor="payroll-month">
                  الشهر *
                </label>
                <select
                  id="payroll-month"
                  value={runMonth}
                  onChange={(event) => setRunMonth(Number(event.target.value))}
                  className="h-10 w-full rounded-2xl border border-border/80 bg-muted/40 px-3 font-bold text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                    <option key={month} value={month}>
                      {month}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="font-bold text-foreground" htmlFor="payroll-year">
                  السنة *
                </label>
                <select
                  id="payroll-year"
                  value={runYear}
                  onChange={(event) => setRunYear(Number(event.target.value))}
                  className="h-10 w-full rounded-2xl border border-border/80 bg-muted/40 px-3 font-bold text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  {[today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1].map(
                    (year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ),
                  )}
                </select>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-3">
            <Button
              size="sm"
              onClick={handleRunNewPayroll}
              disabled={payrollGroups.length === 0 || isRunningPayroll}
              className="rounded-full text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground px-6 h-10 shadow-xs cursor-pointer"
            >
              {isRunningPayroll ? "جاري الاحتساب..." : "بدء الاحتساب"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: Digital Payslip Modal */}
      {selectedPayslipEmployee && (
        <Dialog
          open={!!selectedPayslipEmployee}
          onOpenChange={() => setSelectedPayslipEmployee(null)}
        >
          <DialogContent className="max-w-lg rounded-3xl p-6 overflow-y-auto max-h-[90vh] border border-border/80 shadow-2xl">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary via-[#00B5FF] to-emerald-400" />
            <div className="border-b border-border/60 pb-4 text-center space-y-2 pt-1">
              <div className="flex justify-center mb-1">
                <AppLogo height={38} />
              </div>
              <h2 className="text-base font-black text-foreground">
                قسيمة الراتب الإلكترونية المعتمدة
              </h2>
              <p className="text-xs text-muted-foreground font-medium">
                شهر {selectedRun?.periodMonth ?? "—"} / {selectedRun?.periodYear ?? "—"} •{" "}
                {company.legalNameAr}
              </p>
              <span className="text-[10px] text-muted-foreground font-mono">
                سجل تجاري: {company.crNumber || "—"} | الرقم الضريبي: {company.taxNumber || "—"}
              </span>
            </div>

            <div className="space-y-3 text-xs py-2">
              <div className="grid grid-cols-2 gap-2 p-3 rounded-2xl bg-muted/30 border border-border/60 font-medium">
                <div>
                  <span className="text-muted-foreground block text-[10px]">اسم الموظف:</span>
                  <span className="font-bold text-foreground">{selectedPayslipEmployee.employeeName}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">الرقم الوظيفي:</span>
                  <span className="font-mono font-bold">{selectedPayslipEmployee.employeeNo}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">الإدارة / القسم:</span>
                  <span className="font-bold">{selectedPayslipEmployee.departmentName}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">البنك والآيبان:</span>
                  <span className="font-mono font-bold text-primary">{selectedPayslipEmployee.bankName}</span>
                </div>
              </div>

              {/* Earnings & Deductions Breakdown */}
              <div className="rounded-2xl border border-border/80 bg-muted/20 p-4 space-y-2 font-mono">
                <div className="flex justify-between">
                  <span>الراتب الأساسي:</span>
                  <span>{selectedPayslipEmployee.basicSalary.toLocaleString()} ر.س</span>
                </div>
                <div className="flex justify-between text-emerald-600 font-bold">
                  <span>بدل السكن:</span>
                  <span>+{selectedPayslipEmployee.housingAllowance.toLocaleString()} ر.س</span>
                </div>
                <div className="flex justify-between text-emerald-600 font-bold">
                  <span>بدل النقل:</span>
                  <span>+{selectedPayslipEmployee.transportAllowance.toLocaleString()} ر.س</span>
                </div>

                {selectedPayslipEmployee.overtimeAmount > 0 && (
                  <div className="flex justify-between text-primary font-bold">
                    <span>بدل ساعات عمل إضافي (المادة 107 - نظام العمل):</span>
                    <span>+{selectedPayslipEmployee.overtimeAmount.toLocaleString()} ر.س</span>
                  </div>
                )}

                <div className="flex justify-between text-destructive font-bold">
                  <span>التأمينات الاجتماعية (GOSI):</span>
                  <span>-{selectedPayslipEmployee.gosiEmployeeDeduction.toLocaleString()} ر.س</span>
                </div>

                {selectedPayslipEmployee.loanInstallmentDeduction > 0 && (
                  <div className="flex justify-between text-destructive font-bold">
                    <span>استقطاع السلفة الشهرية:</span>
                    <span>-{selectedPayslipEmployee.loanInstallmentDeduction.toLocaleString()} ر.س</span>
                  </div>
                )}

                {selectedPayslipEmployee.absenceLateDeduction > 0 && (
                  <div className="flex justify-between text-destructive font-bold">
                    <span>استقطاع التأخير والانصراف المبكر والغياب:</span>
                    <span>-{selectedPayslipEmployee.absenceLateDeduction.toLocaleString()} ر.س</span>
                  </div>
                )}

                {selectedPayslipEmployee.unpaidLeaveDeduction > 0 && (
                  <div className="flex justify-between text-destructive font-bold">
                    <span>استقطاع الإجازات غير مدفوعة الأجر والمرضية (م117):</span>
                    <span>-{selectedPayslipEmployee.unpaidLeaveDeduction.toLocaleString()} ر.س</span>
                  </div>
                )}

                {selectedPayslipEmployee.otherDeductions > 0 && (
                  <div className="flex justify-between text-destructive font-bold">
                    <span>الجزاءات والمخالفات الإدارية المعتمدة:</span>
                    <span>-{selectedPayslipEmployee.otherDeductions.toLocaleString()} ر.س</span>
                  </div>
                )}

                <div className="border-t border-border/60 pt-2.5 flex justify-between font-black text-sm text-primary">
                  <span>صافي الراتب المحول للحساب:</span>
                  <span>{selectedPayslipEmployee.netSalary.toLocaleString()} ر.س</span>
                </div>
              </div>

              {/* Security Seal */}
              <div className="p-2.5 rounded-2xl bg-secondary/50 border border-primary/20 flex items-center justify-between text-[10px]">
                <div className="flex items-center gap-2 text-foreground">
                  <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>معتمد ومصادق إلكترونياً • متوافق مع نظام حماية الأجور (WPS)</span>
                </div>
                <Badge variant="outline" className="font-mono text-[9px] border-emerald-300 text-emerald-700 bg-emerald-500/10 font-bold">
                  VERIFIED
                </Badge>
              </div>
            </div>

            <DialogFooter className="flex gap-2 mt-2">
              <Button
                size="sm"
                onClick={() => window.print()}
                variant="outline"
                className="flex-1 text-xs font-bold gap-1.5 rounded-full h-10 border-border/80 hover:bg-secondary cursor-pointer"
              >
                <Printer className="h-4 w-4" />
                طباعة القسيمة
              </Button>
              <Button
                size="sm"
                onClick={() => window.print()}
                className="flex-1 text-xs font-bold gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full h-10 shadow-xs cursor-pointer"
              >
                <Download className="h-4 w-4" />
                حفظ كـ PDF
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* MODAL 3: Loan Request Modal */}
      <Dialog open={isLoanModalOpen} onOpenChange={setIsLoanModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6 overflow-y-auto max-h-[90vh] border border-border/80 shadow-2xl">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary via-[#00B5FF] to-emerald-400" />
          <DialogHeader className="pt-1">
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              طلب سلفة مالية جديدة
            </DialogTitle>
            <DialogDescription className="text-xs font-medium text-muted-foreground">
              تخضع السلف لسياسة المنشأة وتستقطع شهرياً عبر مسير الرواتب
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs py-2">
            <div className="space-y-1.5">
              <label className="font-bold text-foreground">الموظف صاحب الطلب *</label>
              <select
                value={loanEmpId}
                onChange={(e) => setLoanEmpId(e.target.value)}
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 font-semibold"
              >
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.firstNameAr} {emp.lastNameAr} ({emp.employeeNo}) — {emp.jobTitleAr}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-foreground">المبلغ المطلوب (ر.س) *</label>
              <input
                type="number"
                value={loanAmount}
                onChange={(e) => setLoanAmount(Number(e.target.value))}
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 font-bold"
              />
            </div>
            <div className="space-y-1.5">
              <label className="font-bold text-foreground">عدد أشهر السداد (الأقساط) *</label>
              <select
                value={installmentsCount}
                onChange={(e) => setInstallmentsCount(Number(e.target.value))}
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-bold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value={3}>3 أشهر ({Math.round(loanAmount / 3)} ر.س / شهر)</option>
                <option value={5}>5 أشهر ({Math.round(loanAmount / 5)} ر.س / شهر)</option>
                <option value={10}>10 أشهر ({Math.round(loanAmount / 10)} ر.س / شهر)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="font-bold text-foreground">سبب ومبرر طلب السلفة *</label>
              <textarea
                rows={2}
                value={loanReason}
                onChange={(e) => setLoanReason(e.target.value)}
                placeholder="اكتب سبب طلب السلفة..."
                className="w-full rounded-2xl border border-border/80 bg-muted/40 p-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>

          <DialogFooter className="mt-3">
            <Button
              size="sm"
              onClick={handleCreateLoan}
              disabled={isCreatingLoan}
              className="rounded-full text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-6 h-10 shadow-xs cursor-pointer"
            >
              {isCreatingLoan ? "جاري الإرسال..." : "تأكيد وإرسال طلب السلفة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 4: Final Settlement & Clearance Certificate */}
      {selectedSettlementForClearance && (
        <Dialog
          open={!!selectedSettlementForClearance}
          onOpenChange={() => setSelectedSettlementForClearance(null)}
        >
          <DialogContent className="max-w-xl rounded-3xl p-6 overflow-y-auto max-h-[90vh] border border-border/80 shadow-2xl">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary via-[#00B5FF] to-emerald-400" />
            <div className="border-b border-border/60 pb-4 text-center space-y-2 pt-1">
              <div className="flex justify-center mb-1">
                <AppLogo height={38} />
              </div>
              <h2 className="text-base font-black text-foreground">
                مخالصة نهائية وإبراء ذمة مالية وقانونية
              </h2>
              <p className="text-xs text-muted-foreground font-medium">
                {company.legalNameAr} • س.ت: {company.crNumber || "—"}
              </p>
            </div>

            <div className="space-y-3.5 text-xs py-2">
              <div className="grid grid-cols-2 gap-2 p-3.5 rounded-2xl bg-muted/30 border border-border/60 font-medium">
                <div>
                  <span className="text-muted-foreground block text-[10px]">اسم الموظف:</span>
                  <span className="font-bold text-foreground">
                    {selectedSettlementForClearance.employeeName}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">تاريخ نهاية الخدمة:</span>
                  <span className="font-mono font-bold">
                    {selectedSettlementForClearance.terminationDate}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">مدة الخدمة الفعلية:</span>
                  <span className="font-bold text-foreground">
                    {selectedSettlementForClearance.serviceYears} سنوات و{" "}
                    {selectedSettlementForClearance.serviceMonths} أشهر
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">حالة الصرف:</span>
                  <span className="font-bold text-emerald-600">معتمدة للصرف البنكي</span>
                </div>
              </div>

              {/* Financial Breakdown */}
              <div className="rounded-2xl border border-border/80 bg-muted/20 p-4 space-y-2 font-mono">
                <div className="flex justify-between">
                  <span>مكافأة نهاية الخدمة النظامية (EOSB):</span>
                  <span className="font-bold text-emerald-600">
                    +{selectedSettlementForClearance.eosbAmount.toLocaleString()} ر.س
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>
                    بدل رصيد الإجازات المتبقي ({selectedSettlementForClearance.leaveBalancePayoutDays} يوم):
                  </span>
                  <span className="font-bold text-emerald-600">
                    +{selectedSettlementForClearance.leaveBalancePayoutAmount.toLocaleString()} ر.س
                  </span>
                </div>
                <div className="border-t border-border/60 pt-2.5 flex justify-between font-black text-sm text-primary">
                  <span>صافي المبلغ المستحق النهائي:</span>
                  <span>{selectedSettlementForClearance.netSettlementAmount.toLocaleString()} ر.س</span>
                </div>
              </div>

              {/* Legal Acknowledgment Statement */}
              <div className="p-3.5 rounded-2xl bg-secondary/40 border border-primary/20 text-[11px] leading-relaxed text-muted-foreground">
                <span className="font-bold text-foreground block mb-1">إقرار وإبراء ذمة:</span>
                أقر أنا الموظف الموقع أدناه بأنني استلمت كافة مستحقاتي المالية والنظامية والتعاقدية الناتجة عن عقد عملي وكامل فترة خدمتي لدى المنشأة، وليس لي لدى المنشأة أي حقوق أو مطالبات حالية أو مستقبلية، وتعتبر هذه مخالصة نهائية وإبراء ذمة شاملاً مانعاً للجهالة.
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-2 gap-4 pt-3 border-t border-border/60 text-center text-xs">
                <div>
                  <span className="text-muted-foreground block text-[10px]">توقيع الموظف (المقر بما فيه):</span>
                  <span className="font-bold block mt-3 text-foreground">
                    {selectedSettlementForClearance.employeeName}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">
                    مصادقة إدارة الموارد البشرية والمالية:
                  </span>
                  <div className="flex items-center justify-center gap-1 mt-2 text-emerald-600 font-bold">
                    <ShieldCheck className="h-4 w-4" />
                    <span>معتمد ومختوم إلكترونياً</span>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="mt-2">
              <Button
                size="sm"
                onClick={() => window.print()}
                className="w-full rounded-full text-xs font-bold gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground h-10 shadow-xs cursor-pointer"
              >
                <Printer className="h-4 w-4" />
                طباعة سند المخالصة الرسمي
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* MODAL 5: EOSB Settlement Calculator Modal */}
      <Dialog open={isSettlementModalOpen} onOpenChange={setIsSettlementModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6 overflow-y-auto max-h-[90vh] border border-border/80 shadow-2xl">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary via-[#00B5FF] to-emerald-400" />
          <DialogHeader className="pt-1">
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-primary" />
              حاسبة ومخالصة مكافأة نهاية الخدمة (EOSB)
            </DialogTitle>
            <DialogDescription className="text-xs font-medium text-muted-foreground">
              وفق المادتين 84 و 85 من نظام العمل السعودي
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs py-2">
            <div className="space-y-1.5">
              <label className="font-bold text-foreground">الموظف المنتهية خدماته *</label>
              <select
                value={settlementEmpId}
                onChange={(e) => setSettlementEmpId(e.target.value)}
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 font-semibold"
              >
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.firstNameAr} {emp.lastNameAr} ({emp.employeeNo}) — {emp.jobTitleAr}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-foreground">تاريخ نهاية الخدمة *</label>
              <input
                type="date"
                value={terminationDate}
                onChange={(e) => setTerminationDate(e.target.value)}
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 font-bold"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-foreground">سبب انتهاء العلاقة العمالية *</label>
              <select
                value={separationType}
                onChange={(e) => setSeparationType(e.target.value as any)}
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 font-semibold"
              >
                <option value="contract_expiration">انتهاء مدة العقد المحدد (مكافأة كاملة)</option>
                <option value="termination_by_employer">إنهاء من صاحب العمل بموجب م77 (مكافأة كاملة)</option>
                <option value="resignation">استقالة العامل (م85 - متدرجة حسب مدة الخدمة)</option>
                <option value="force_majeure">قوة قاهرة أو ترك العمل لظروف استثنائية (كاملة)</option>
              </select>
            </div>
            {/* Server-Authoritative Settlement Preview */}
            {settlementCalcError && (
              <div className="p-3.5 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertCircle className="h-4 w-4" />
                  <span>تعذر احتساب المخالصة (استثناء مانع - Blocking Exception)</span>
                </div>
                <p className="text-[11px] font-medium leading-relaxed">{settlementCalcError}</p>
              </div>
            )}

            {isCalculatingSettlement && (
              <div className="p-4 rounded-2xl bg-muted/40 border border-border text-center text-xs font-semibold text-muted-foreground animate-pulse">
                جاري احتساب مستحقات نهاية الخدمة بدقة وفق نظام العمل وقواعد المنشأة...
              </div>
            )}

            {settlementPreview && !isCalculatingSettlement && (
              <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/80 space-y-2.5">
                <div className="flex justify-between items-center text-xs pb-1.5 border-b border-border/50">
                  <span className="text-muted-foreground font-medium">مدة الخدمة المحتسبة:</span>
                  <span className="font-bold text-foreground font-mono">
                    {settlementPreview.serviceYears} سنة و {settlementPreview.serviceMonths} شهر ({settlementPreview.totalServiceYearsDecimal} سنة)
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs pb-1.5 border-b border-border/50">
                  <span className="text-muted-foreground font-medium">الأجر الشهري المعتمد (الأساس: {settlementPreview.calculationBasis}):</span>
                  <span className="font-bold text-foreground font-mono">
                    {Math.round(settlementPreview.totalMonthlyWage).toLocaleString("ar-SA")} ر.س
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs pb-1.5 border-b border-border/50">
                  <span className="text-muted-foreground font-medium">مكافأة نهاية الخدمة (م84 وم85):</span>
                  <span className="font-bold text-emerald-600 font-mono">
                    {Math.round(settlementPreview.eosbAmount).toLocaleString("ar-SA")} ر.س ({settlementPreview.resignationMultiplier}%)
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs pb-1.5 border-b border-border/50">
                  <span className="text-muted-foreground font-medium">بدل رصيد الإجازات المستحق ({settlementPreview.leaveBalancePayoutDays} يوم):</span>
                  <span className="font-bold text-emerald-600 font-mono">
                    +{Math.round(settlementPreview.leavePayoutAmount).toLocaleString("ar-SA")} ر.س
                  </span>
                </div>
                {settlementPreview.loanDeductionAmount > 0 && (
                  <div className="flex justify-between items-center text-xs pb-1.5 border-b border-border/50">
                    <span className="text-muted-foreground font-medium">استقطاع السلف القائمة:</span>
                    <span className="font-bold text-destructive font-mono">
                      -{Math.round(settlementPreview.loanDeductionAmount).toLocaleString("ar-SA")} ر.س
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center text-xs pt-1">
                  <span className="font-black text-foreground">صافي المستحق النهائي للمخالصة:</span>
                  <span className="text-sm font-black text-primary font-mono">
                    {Math.round(settlementPreview.netSettlementAmount).toLocaleString("ar-SA")} ر.س
                  </span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="mt-3">
            <Button
              size="sm"
              onClick={handleSaveSettlement}
              disabled={isSavingSettlement || isCalculatingSettlement || !settlementPreview || Boolean(settlementCalcError)}
              className="rounded-full text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 h-10 shadow-xs cursor-pointer disabled:opacity-50"
            >
              {isSavingSettlement ? "جاري الاعتماد والترحيل..." : "اعتماد وحفظ المخالصة رسمياً"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 6: Reopen Locked Payroll Run Modal */}
      <Dialog open={isReopenModalOpen} onOpenChange={setIsReopenModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6 border border-border/80 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2 text-foreground">
              <RotateCcw className="h-5 w-5 text-amber-600" />
              إعادة فتح مسير رواتب مقفل
            </DialogTitle>
            <DialogDescription className="text-xs font-medium text-muted-foreground">
              وفق ضوابط الحوكمة، يتطلب فتح المسير المقفل توضيح سبب رسمي للتسجيل في سجل التدقيق
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <label className="font-bold text-foreground">سبب إعادة الفتح (10 أحرف على الأقل) *</label>
              <textarea
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                rows={3}
                placeholder="مثال: تصحيح ساعات العمل الإضافي لقسم التشغيل بناءً على اعتماد إدارة الموارد البشرية..."
                className="w-full rounded-2xl border border-border/80 bg-muted/40 p-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 font-medium"
              />
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button
              size="sm"
              onClick={async () => {
                if (reopenReason.trim().length < 10) {
                  toast.error("يرجى كتابة سبب واضح لإعادة فتح المسير (10 أحرف على الأقل)");
                  return;
                }
                setIsReopeningRun(true);
                try {
                  const ok = await payrollMutations.reopenPayrollRun(selectedRun.id, reopenReason);
                  if (ok) {
                    setIsReopenModalOpen(false);
                    setReopenReason("");
                  }
                } finally {
                  setIsReopeningRun(false);
                }
              }}
              disabled={isReopeningRun || reopenReason.trim().length < 10}
              className="rounded-full text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white px-6 h-10 shadow-xs cursor-pointer"
            >
              {isReopeningRun ? "جاري الفتح..." : "تأكيد إعادة فتح المسير"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 7: Authoritative Installment Schedule Dialog */}
      {selectedLoanForSchedule && (
        <Dialog open={!!selectedLoanForSchedule} onOpenChange={() => setSelectedLoanForSchedule(null)}>
          <DialogContent className="max-w-2xl rounded-3xl p-6 overflow-y-auto max-h-[90vh] border border-border/80 shadow-2xl">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary via-[#00B5FF] to-emerald-400" />
            <DialogHeader className="pt-1">
              <DialogTitle className="text-base font-black flex items-center gap-2">
                <ListOrdered className="h-5 w-5 text-primary" />
                جدول أقساط السلفة المعتمد والموثق
              </DialogTitle>
              <DialogDescription className="text-xs font-medium text-muted-foreground">
                جدول استقطاع معتمد خادميًا يستقطع تلقائيًا عند اعتماد كل مسيّر شهري
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              {isLoadingInstallments ? (
                <div className="p-8 text-center text-muted-foreground">جاري تحميل جدول الأقساط...</div>
              ) : loanInstallments.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  لا يوجد جدول أقساط بعد (يتم إنشاء الجدول تلقائيًا فور الصرف المالي الفعلي للسلفة)
                </div>
              ) : (
                <div className="rounded-2xl border border-border/80 overflow-hidden">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-muted/50 border-b border-border/60 text-muted-foreground font-bold">
                      <tr>
                        <th className="p-3">رقم القسط</th>
                        <th className="p-3">فترة الاستحقاق</th>
                        <th className="p-3">تاريخ الاستحقاق</th>
                        <th className="p-3">المبلغ</th>
                        <th className="p-3">المستقطع</th>
                        <th className="p-3">المتبقي</th>
                        <th className="p-3">الحالة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40 font-mono">
                      {loanInstallments.map((inst) => {
                        const statusBadge =
                          inst.status === "deducted"
                            ? { label: "تم الاستقطاع", color: "bg-emerald-100 text-emerald-800" }
                            : inst.status === "early_settled"
                            ? { label: "سداد مبكر", color: "bg-blue-100 text-blue-800" }
                            : { label: "معلق", color: "bg-amber-100 text-amber-800" };
                        return (
                          <tr key={inst.id} className="hover:bg-muted/20">
                            <td className="p-3 font-bold">#{inst.installmentNumber}</td>
                            <td className="p-3">{inst.duePayrollPeriod}</td>
                            <td className="p-3">{inst.dueDate}</td>
                            <td className="p-3 font-bold">{inst.principalAmount.toLocaleString()} ر.س</td>
                            <td className="p-3 text-emerald-600">{inst.deductedAmount.toLocaleString()} ر.س</td>
                            <td className="p-3 text-destructive">{inst.remainingBalance.toLocaleString()} ر.س</td>
                            <td className="p-3">
                              <Badge variant="outline" className={`text-[10px] rounded-full px-2 font-bold ${statusBadge.color}`}>
                                {statusBadge.label}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <DialogFooter className="mt-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSelectedLoanForSchedule(null)}
                className="rounded-full text-xs font-bold px-6 h-9"
              >
                إغلاق
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* MODAL 8: Separation / Resignation Initiation Dialog */}
      <Dialog open={isSeparationModalOpen} onOpenChange={setIsSeparationModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6 overflow-y-auto max-h-[90vh] border border-border/80 shadow-2xl">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary via-[#00B5FF] to-emerald-400" />
          <DialogHeader className="pt-1">
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <UserX className="h-5 w-5 text-primary" />
              بدء إجراء إنهاء خدمة / استقالة
            </DialogTitle>
            <DialogDescription className="text-xs font-medium text-muted-foreground">
              يبدأ هذا الإجراء دورة إخلاء الطرف وحصر العهد والأصول وحساب المستحقات
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs py-2">
            <div className="space-y-1.5">
              <label className="font-bold text-foreground">الموظف المعني *</label>
              <select
                value={sepEmpId}
                onChange={(e) => setSepEmpId(e.target.value)}
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 font-semibold"
              >
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.firstNameAr} {emp.lastNameAr} ({emp.employeeNo}) — {emp.jobTitleAr}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-foreground">نوع إنهاء الخدمة / السبب النظامي *</label>
              <select
                value={sepType}
                onChange={(e) => setSepType(e.target.value)}
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-bold focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="contract_expiration">انتهاء مدة العقد (مادة 84 - استحقاق كامل)</option>
                <option value="resignation">استقالة اختيارية (مادة 85 - سلم الاستقالة)</option>
                <option value="termination">إنهاء خدمات من طرف المنشأة</option>
                <option value="termination_with_cause">فسخ العقد لسبب مشروع (مادة 80 - بدون مكافأة)</option>
                <option value="retirement">تقاعد نظامي</option>
                <option value="other">أسباب أخرى</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-foreground">آخر يوم عمل فعلي *</label>
              <input
                type="date"
                value={sepLastWorkingDay}
                onChange={(e) => setSepLastWorkingDay(e.target.value)}
                className="w-full h-10 rounded-2xl border border-border/80 bg-muted/40 px-3 text-xs font-mono focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 font-bold"
              >
              </input>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="sepNoticeServed"
                checked={sepNoticeServed}
                onChange={(e) => setSepNoticeServed(e.target.checked)}
                className="rounded border-border"
              />
              <label htmlFor="sepNoticeServed" className="font-semibold text-foreground cursor-pointer">
                تم قضاء فترة الإشعار النظامية كاملة
              </label>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-foreground">سبب ومبررات إنهاء الخدمة *</label>
              <textarea
                rows={3}
                value={sepReason}
                onChange={(e) => setSepReason(e.target.value)}
                placeholder="اكتب أسباب ومبررات إنهاء الخدمة بالتفصيل..."
                className="w-full rounded-2xl border border-border/80 bg-muted/40 p-3 text-xs focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>

          <DialogFooter className="mt-3">
            <Button
              size="sm"
              onClick={handleInitiateSeparation}
              disabled={isInitiatingSep}
              className="rounded-full text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-6 h-10 shadow-xs cursor-pointer"
            >
              {isInitiatingSep ? "جاري البدء..." : "تأكيد وبدء إجراءات إنهاء الخدمة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
