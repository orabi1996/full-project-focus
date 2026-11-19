import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../integrations/supabase/client";
import { previewPayrollServer } from "../../lib/business/payroll.functions";
import { CountryPayrollPolicyPanel } from "./CountryPayrollPolicyPanel";
import { COUNTRY_PACK_CATALOG, payrollCountry, isNationalOf, formatPayrollMoney, resolveCountryPayrollPolicy, type CountryPolicyRecord } from "../../lib/business/payroll-country";
import React, { useEffect, useState, useMemo, useRef } from "react";
import { useApp } from "../../lib/context/AppContext";
import { generateWPSSIFFile } from "../../lib/utils/export-helpers";
import type { EmployeePayrollDetail, FinalSettlementRecord } from "../../types";
import type { SeparationType, SettlementCalculationPreview } from "../../lib/business/settlement.functions";
import { useAuth } from "../../lib/auth/AuthContext";

import { usePayroll, usePayrollMutations } from "../../lib/domains/payroll";
import { useEmployees } from "../../lib/domains/employees";
import {
  usePayrollExceptions,
  usePayrollRunEmployees,
  useCompanyBankAccounts,
} from "../../lib/data/payroll-repository";
import { IconSymbol } from "../ui/IconSymbol";
import { SalaryFilesPanel } from "./SalaryFilesPanel";
import { AppLogo } from "../common/AppLogo";
import { PayrollPaymentsPanel } from "./PayrollPaymentsPanel";
import { LoansTreasuryPanel } from "./LoansTreasuryPanel";
import { BankTransferPanel } from "./BankTransferPanel";
import {
  Wallet,
  DollarSign,
  Download,
  Lock,
  CheckCircle2,
  FileSpreadsheet,
  AlertCircle,
  Eye,
  Plus,
  ArrowDownRight,
  TrendingUp,
  Receipt,
  Building,
  CreditCard,
  FileCheck,
  Printer,
  ShieldCheck,
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
  Settings,
  CheckSquare,
  Square,
  Users,
  MapPin,
  Briefcase,
  Clock,
  SlidersHorizontal,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
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
  const navigate = useNavigate();
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


  const {
    orgUnits,
    workLocations,
    company,
    currentRole,
    language,
    t,
  } = useApp();

  const companyCountry = useMemo(() => {
    try { return payrollCountry(company.country); } catch { return null; }
  }, [company.country]);
  const countryPack = companyCountry ? COUNTRY_PACK_CATALOG[companyCountry] : null;
  const [countryPolicyOpen, setCountryPolicyOpen] = useState(false);
  const [schemeOverrides, setSchemeOverrides] = useState<Record<string, string>>({});
  const [registeredWages, setRegisteredWages] = useState<Record<string, number>>({});
  const [runPreview, setRunPreview] = useState<Awaited<ReturnType<typeof previewPayrollServer>> | null>(null);
  const [previewPending, setPreviewPending] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const countryPolicies = useQuery({ queryKey: ["payroll-country-policies", company.id, companyCountry],
    enabled: Boolean(isLive && company.id && companyCountry), queryFn: async () => {
      const { data, error } = await (supabase as any).from("payroll_country_policies").select("*")
        .eq("company_id", company.id).eq("country_code", companyCountry);
      if (error) throw new Error(error.message);
      return data as CountryPolicyRecord[];
    } });

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
  const [selectedSettlementForClearance, setSelectedSettlementForClearance] =
    useState<FinalSettlementRecord | null>(null);

  const today = new Date();
  const [isRunModalOpen, setIsRunModalOpen] = useState(false);
  const [runWizardStep, setRunWizardStep] = useState<1 | 2 | 3>(1);
  const [runGroupId, setRunGroupId] = useState(payrollGroups[0]?.id || "all");
  const [runBasis, setRunBasis] = useState<"fixed_30_days" | "calendar_days">("fixed_30_days");
  const [runYear, setRunYear] = useState(today.getFullYear());
  const [runMonth, setRunMonth] = useState(today.getMonth() + 1);
  const [runBranchId, setRunBranchId] = useState<string>("all");
  const [runPeriodMode, setRunPeriodMode] = useState<"full_month" | "custom_end_date" | "custom_days">("full_month");
  const [runCustomEndDate, setRunCustomEndDate] = useState<string>("");
  const [runCustomDays, setRunCustomDays] = useState<number>(30);
  const [runDeptFilter, setRunDeptFilter] = useState<string>("all");
  const [runCategoryFilter, setRunCategoryFilter] = useState<string>("all");
  const [runEmpSearch, setRunEmpSearch] = useState<string>("");
  const [selectedRunEmpIds, setSelectedRunEmpIds] = useState<string[]>([]);
  const [replaceRunDraft, setReplaceRunDraft] = useState(false);
  const [runNotes, setRunNotes] = useState<string>("");

  const previewKey = JSON.stringify([runGroupId, runBasis, runYear, runMonth, runBranchId, runDeptFilter,
    runCategoryFilter, runPeriodMode, runCustomEndDate, runCustomDays, selectedRunEmpIds, schemeOverrides, registeredWages, replaceRunDraft,
    company.id, companyCountry, countryPolicies.data]);
  const latestPreviewKey = useRef(previewKey);
  latestPreviewKey.current = previewKey;
  useEffect(() => { setRunPreview(null); setPreviewError(""); }, [previewKey]);
  const activeCountryPolicy = useMemo(() => {
    if (!companyCountry) return null;
    const start = `${runYear}-${String(runMonth).padStart(2, "0")}-01`;
    const end = new Date(Date.UTC(runYear, runMonth, 0)).toISOString().slice(0, 10);
    try { return resolveCountryPayrollPolicy(countryPolicies.data ?? [], companyCountry, start, end); } catch { return null; }
  }, [companyCountry, countryPolicies.data, runYear, runMonth]);

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
  const money = (amount: number) => formatPayrollMoney(amount, selectedRun?.currency || company.currency || countryPack?.currencyCode || "SAR");
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
        otherDeductions: re.otherDeductions - (re.incomeTax || 0),
        incomeTax: re.incomeTax,
        totalDeductions: re.totalDeductions,
        netSalary: re.netSalary,
        unpaidLeaveDays: re.unpaidLeaveDays,
        absenceDays: re.absenceDays,
      }));
    }
    return [];
  }, [selectedRun, isLive, runEmployeesQuery.data]);

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

  const canManagePayroll = ["super_admin", "org_admin", "hr_manager", "payroll_officer", "finance_officer"].includes(currentRole);
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

  // Available job categories derived from employee records
  const availableJobCategories = useMemo(() => {
    const cats = new Set<string>();
    employees.forEach((emp) => {
      const cat = (emp as any).jobCategory;
      if (cat && typeof cat === "string" && cat.trim()) {
        cats.add(cat.trim());
      }
    });
    if (cats.size === 0) {
      return ["إدارية / تخصصية", "تشغيلية / دعم", "قيادية / إشرافية", "فنية / مهنية"];
    }
    return Array.from(cats);
  }, [employees]);

  // Candidates for payroll run based on current modal filters
  const eligibleRunEmployees = useMemo(() => {
    return employees.filter((emp) => {
      // 1. Status: active or on_leave
      const status = emp.status || "active";
      if (status !== "active" && status !== "on_leave" && status !== "terminated") return false;

      // 2. Payroll group (if defined on employee)
      if (emp.payrollGroupId && runGroupId && runGroupId !== "all" && emp.payrollGroupId !== runGroupId) {
        return false;
      }

      // 3. Branch / Work Location filter
      if (runBranchId !== "all") {
        const matchesBranch =
          emp.workLocationId === runBranchId ||
          (emp as any).locationId === runBranchId;
        if (!matchesBranch) return false;
      }

      // 4. Department filter
      if (runDeptFilter !== "all" && emp.departmentId !== runDeptFilter) {
        return false;
      }

      // 5. Job category filter
      if (runCategoryFilter !== "all") {
        const empCat = (emp as any).jobCategory;
        if (empCat !== runCategoryFilter) return false;
      }

      // 6. Search query (name or employee number or national ID)
      if (runEmpSearch.trim()) {
        const q = runEmpSearch.toLowerCase().trim();
        const fullName = `${emp.firstNameAr || ""} ${emp.lastNameAr || ""} ${emp.fullName || ""} ${emp.firstNameEn || ""} ${emp.lastNameEn || ""}`.toLowerCase();
        const empNo = (emp.employeeNo || "").toLowerCase();
        const nid = (emp.nationalIdOrIqama || "").toLowerCase();
        if (!fullName.includes(q) && !empNo.includes(q) && !nid.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [employees, runGroupId, runBranchId, runDeptFilter, runCategoryFilter, runEmpSearch]);

  // Sync selected employees when opening modal or changing primary scope
  useEffect(() => {
    if (isRunModalOpen) {
      setSelectedRunEmpIds(eligibleRunEmployees.map((e) => e.id));
    }
  }, [isRunModalOpen, runGroupId, runBranchId, runDeptFilter, runCategoryFilter]);

  // Multi-select toggle handlers
  const handleToggleSelectAll = () => {
    const eligibleIds = eligibleRunEmployees.map((e) => e.id);
    const allSelected = eligibleIds.length > 0 && eligibleIds.every((id) => selectedRunEmpIds.includes(id));
    if (allSelected) {
      const eligibleSet = new Set(eligibleIds);
      setSelectedRunEmpIds(selectedRunEmpIds.filter((id) => !eligibleSet.has(id)));
    } else {
      const combined = new Set([...selectedRunEmpIds, ...eligibleIds]);
      setSelectedRunEmpIds(Array.from(combined));
    }
  };

  const handleToggleEmployee = (empId: string) => {
    setSelectedRunEmpIds((prev) =>
      prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId]
    );
  };

  const handleSelectOnlySaudis = () => {
    const saudiIds = eligibleRunEmployees
      .filter((e) => Boolean(e.nationality && companyCountry && isNationalOf(e.nationality, companyCountry)))
      .map((e) => e.id);
    setSelectedRunEmpIds(saudiIds);
  };

  const handleSelectOnlyExpats = () => {
    const expatIds = eligibleRunEmployees
      .filter((e) => !(e.nationality && companyCountry && isNationalOf(e.nationality, companyCountry)))
      .map((e) => e.id);
    setSelectedRunEmpIds(expatIds);
  };

  // Count-only summary keeps employee salary details in the Reports module.
  const selectedRunStats = useMemo(() => {
    const selectedEmps = employees.filter((e) => selectedRunEmpIds.includes(e.id));
    const saudiCount = selectedEmps.filter((e) => Boolean(e.nationality && companyCountry && isNationalOf(e.nationality, companyCountry))).length;
    return { count: selectedEmps.length, saudiCount, expatCount: selectedEmps.length - saudiCount };
  }, [employees, selectedRunEmpIds, companyCountry]);

  const previewNewPayroll = async () => {
    const requestedKey = latestPreviewKey.current;
    setPreviewPending(true); setPreviewError(""); setRunPreview(null);
    try {
      const result = await previewPayrollServer({ data: { companyId: company.id, payrollGroupId: runGroupId || "all", replaceAll: replaceRunDraft, calculationBasis: runGroupId === "all" ? runBasis : undefined,
        year: runYear, month: runMonth, branchId: runBranchId !== "all" ? runBranchId : undefined,
        departmentId: runDeptFilter !== "all" ? runDeptFilter : undefined,
        jobCategory: runCategoryFilter !== "all" ? runCategoryFilter : undefined,
        periodCalculationMode: runPeriodMode, periodEndDate: runCustomEndDate, customDaysCount: runCustomDays,
        selectedEmployeeIds: selectedRunEmpIds, schemeOverrides, registeredWages } });
      if (requestedKey === latestPreviewKey.current) setRunPreview(result);
    } catch (cause) { if (requestedKey === latestPreviewKey.current) setPreviewError(cause instanceof Error ? cause.message : "تعذر فحص المسير"); }
    finally { setPreviewPending(false); }
  };

  const handleRunNewPayroll = async () => {
    const groupId = runGroupId === "all" || payrollGroups.length === 0 ? "all" :
      payrollGroups.some(group => group.id === runGroupId) ? runGroupId : payrollGroups[0].id;

    if (selectedRunEmpIds.length === 0) {
      toast.error("يرجى اختيار موظف واحد على الأقل لتشغيل المسير");
      return;
    }

    if (runPeriodMode === "custom_end_date" && !runCustomEndDate) {
      toast.error("يرجى تحديد تاريخ نهاية الفترة المخصص");
      return;
    }

    if (runPeriodMode === "custom_days" && (!runCustomDays || runCustomDays < 1 || runCustomDays > 31)) {
      toast.error("يرجى إدخال عدد أيام صحيح (بين 1 و 31 يوماً)");
      return;
    }

    if (!runPreview) { toast.error("راجع نتيجة فحص المسير قبل التشغيل"); return; }
    setIsRunningPayroll(true);
    try {
      const ok = await processPayrollRun(groupId, runYear, runMonth, {
        companyId: company.id, schemeOverrides, registeredWages, replaceAll: replaceRunDraft, calculationBasis: groupId === "all" ? runBasis : undefined,
        branchId: runBranchId !== "all" ? runBranchId : undefined,
        departmentId: runDeptFilter !== "all" ? runDeptFilter : undefined,
        jobCategory: runCategoryFilter !== "all" ? runCategoryFilter : undefined,
        periodCalculationMode: runPeriodMode,
        periodEndDate: runPeriodMode === "custom_end_date" ? runCustomEndDate : undefined,
        customDaysCount: runPeriodMode === "custom_days" ? runCustomDays : undefined,
        selectedEmployeeIds: selectedRunEmpIds,
        runNotes: runNotes.trim() || undefined,
      });
      if (ok) {
        setSelectedRunId("");
        setActiveTab("runs");
        setIsRunModalOpen(false);
      }
    } finally {
      setIsRunningPayroll(false);
    }
  };

  const handleExportWPS = () => {
    if ((selectedRun?.countryCode || companyCountry) !== "SA") {
      toast.error("ملف التحويل لهذه الدولة يحتاج قالب البنك المعتمد من شاشة حزم الدول"); return;
    }
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
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-black text-foreground">
                  {section === "payroll"
                    ? "مسيرات الرواتب"
                    : "إدارة السلف ومكافأة نهاية الخدمة والمخالصات"}
                </h1>

              </div>
              <p className="text-xs text-muted-foreground font-medium mt-0.5">
                {section === "payroll"
                  ? "احتساب الرواتب وفق دولة المنشأة وسياسة الاشتراك والضريبة، مع مراجعة النتيجة قبل إنشاء المسير"
                  : "إدارة السلف الشهرية، وجدولة الأقساط، ومخالصات نهاية الخدمة (EOSB) المتوافقة مع قوى ونظام العمل"}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {section === "payroll" && canManagePayroll && countryPack && <Button variant="outline" size="sm" disabled={!isLive} onClick={() => setCountryPolicyOpen(true)}>سياسة رواتب الدولة</Button>}
          {section === "payroll" && canManagePayroll && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate({ to: "/setup?tab=payroll_statutory" as any })}
              className="rounded-full font-bold text-xs gap-1.5 border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 h-10 px-4 cursor-pointer"
            >
              <Settings className="h-3.5 w-3.5" />
              تهيئة مجموعات الرواتب والحزم النظامية
            </Button>
          )}
          {section === "payroll" && canManagePayroll && (
            <Button
              onClick={() => {
                setRunGroupId(payrollGroups[0]?.id || "all");
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
              <TabsTrigger value="salaryFiles" className="rounded-xl text-xs font-bold py-2 whitespace-nowrap px-3.5">
                ملفات الرواتب
              </TabsTrigger>
              <TabsTrigger value="payments" className="rounded-xl text-xs font-bold py-2 whitespace-nowrap px-3.5">
                دفع الرواتب
              </TabsTrigger>
              <TabsTrigger value="bank" className="rounded-xl text-xs font-bold py-2 whitespace-nowrap px-3.5">
                التحويل البنكي
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

              <div className="rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-4 text-sm">
                <p className="font-bold text-foreground">اكتمل تجهيز شاشة المسير وإجراءاته.</p>
                <p className="mt-1 text-xs text-muted-foreground">تفاصيل الموظفين والرواتب والقسائم والتوزيع الإداري متاحة في قسم التقارير.</p>
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
                  اختر الفترة والموظفين، ثم راجع الاستحقاقات والخصومات وسياسة دولة المنشأة قبل إنشاء المسير.
                </p>
              </div>
              {canManagePayroll && (
                <Button
                  onClick={() => {
                    setRunGroupId(payrollGroups[0]?.id || "all");
                    setRunWizardStep(1);
                    setRunPreview(null);
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

        {/* Tab: Real salary files per employee */}
        <TabsContent value="salaryFiles" className="space-y-4 pt-4">
          <SalaryFilesPanel />
        </TabsContent>

        <TabsContent value="bank" className="space-y-4 pt-4">
          <BankTransferPanel />
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
                        {money(l.principalAmount)}
                      </span>
                    </div>
                    <div>
                      القسط الشهري:{" "}
                      <span className="font-bold text-foreground font-mono">
                        {money(l.monthlyInstallment)}
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
                        {money(l.remainingBalance)}
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
                      {money(s.eosbAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>تصفية رصيد الإجازات:</span>
                    <span className="font-bold text-foreground font-mono">
                      {money(s.leaveBalancePayoutAmount)} ({s.leaveBalancePayoutDays} يوم)
                    </span>
                  </div>
                  <div className="flex justify-between font-black text-primary border-t border-border/60 pt-2 text-sm">
                    <span>صافي الشيك النهائي:</span>
                    <span className="font-mono">{money(s.netSettlementAmount)}</span>
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
      {companyCountry && <Dialog open={countryPolicyOpen} onOpenChange={setCountryPolicyOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>سياسة الرواتب — {countryPack?.nameAr}</DialogTitle><DialogDescription>إصدارات مؤرخة لقواعد الاشتراك والضريبة. تبقى نسخة القواعد محفوظة مع كل مسير.</DialogDescription></DialogHeader>
          <CountryPayrollPolicyPanel key={`${company.id}-${companyCountry}`} companyId={company.id} country={companyCountry} initialEffectiveFrom={`${runYear}-${String(runMonth).padStart(2, "0")}-01`}
            onSaved={() => { void countryPolicies.refetch(); setRunPreview(null); toast.success("تم حفظ إصدار السياسة"); }} />
        </DialogContent>
      </Dialog>}

      <Dialog open={isRunModalOpen} onOpenChange={setIsRunModalOpen}>
        <DialogContent className="max-w-4xl rounded-3xl p-6 md:p-8 overflow-y-auto max-h-[92vh] border border-border/80 shadow-2xl space-y-5">
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-primary via-[#00B5FF] to-emerald-400" />

          <DialogHeader className="pt-2 border-b border-border/60 pb-3">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg font-black flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                إعداد وتشغيل مسير الرواتب المالي
              </DialogTitle>
              <Badge variant="outline" className="text-xs px-3 py-1 bg-primary/5 text-primary border-primary/20 font-bold">
                محرك الأجور والامتثال المعتمد
              </Badge>
            </div>
            <DialogDescription className="text-xs font-medium text-muted-foreground mt-1">
              اختر دورة الرواتب والموظفين المطلوبين، ثم راجع المعاينة قبل الإنشاء. خيارات الفترة والفلاتر المتقدمة اختيارية.
            </DialogDescription>
            <div className="grid grid-cols-3 gap-2 pt-2" aria-label="خطوات إنشاء المسير">
              {[
                { step: 1, label: "دورة الرواتب" },
                { step: 2, label: "اختيار الموظفين" },
                { step: 3, label: "المراجعة والإنشاء" },
              ].map(({ step, label }) => (
                <div key={step} className={`rounded-xl border px-3 py-2 text-center text-[11px] ${runWizardStep === step ? "border-primary bg-primary/10 text-primary font-bold" : "border-border/60 text-muted-foreground"}`}>
                  <span className="me-1">{step}.</span>{label}
                </div>
              ))}
            </div>
          </DialogHeader>

          {runWizardStep === 1 && (
            <div className="space-y-4">
          {/* Section 1: الدورة والفرع */}
          <div className="rounded-2xl border border-border/80 bg-muted/20 p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-black text-foreground">
              <Building className="h-4 w-4 text-primary" />
              <span>1. محددات الدورة ومقر العمل (الفرع)</span>
            </div>

            <div className="rounded-xl border bg-card p-3 text-sm space-y-2">
              <div className="flex flex-wrap justify-between gap-2"><span>دولة المنشأة — {countryPack?.nameAr || "تحتاج تهيئة"}</span><span>العملة — {countryPack?.currencyCode || company.currency}</span></div>
              <p className="text-xs text-muted-foreground">{activeCountryPolicy?.policy.name || (companyCountry === "SA" ? "السعودية — الإعداد الحالي للتأمينات" : "يلزم اعتماد سياسة رواتب لهذه الدولة")}</p>
              <Button type="button" variant="outline" size="sm" onClick={() => setCountryPolicyOpen(true)}>إعداد سياسة الدولة</Button>
              {countryPolicies.isError && <p role="alert" className="text-destructive">تعذر قراءة سياسة الدولة</p>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div className="space-y-1.5">
                <label className="font-bold text-foreground" htmlFor="payroll-group">
                  مجموعة الرواتب *
                </label>
                <select
                  id="payroll-group"
                  value={runGroupId}
                  onChange={(event) => setRunGroupId(event.target.value)}
                  className="h-10 w-full rounded-xl border border-border/80 bg-card px-3 font-bold text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-xs"
                >
                  <option value="all">جميع موظفي المنشأة</option>
                  {payrollGroups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.nameAr}
                    </option>
                  ))}
                </select>
                {runGroupId === "all" && <label className="block space-y-1.5">أساس الحساب
                  <select aria-label="أساس حساب مسير المنشأة" className="h-10 w-full rounded-xl border bg-card px-3" value={runBasis} onChange={event => setRunBasis(event.target.value as typeof runBasis)}>
                    <option value="fixed_30_days">ثابت 30 يومًا</option><option value="calendar_days">الأيام الفعلية للشهر</option>
                  </select>
                </label>}
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-foreground" htmlFor="payroll-branch">
                  الفرع / مقر العمل *
                </label>
                <select
                  id="payroll-branch"
                  value={runBranchId}
                  onChange={(event) => setRunBranchId(event.target.value)}
                  className="h-10 w-full rounded-xl border border-border/80 bg-card px-3 font-bold text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-xs"
                >
                  <option value="all">🏢 جميع الفروع والمقرات (الكل)</option>
                  {workLocations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      📍 {loc.nameAr} {loc.code ? `(${loc.code})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-foreground" htmlFor="payroll-month">
                  الشهر المستحق *
                </label>
                <select
                  id="payroll-month"
                  value={runMonth}
                  onChange={(event) => setRunMonth(Number(event.target.value))}
                  className="h-10 w-full rounded-xl border border-border/80 bg-card px-3 font-bold text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-xs"
                >
                  {[
                    { m: 1, name: "يناير (01)" },
                    { m: 2, name: "فبراير (02)" },
                    { m: 3, name: "مارس (03)" },
                    { m: 4, name: "أبريل (04)" },
                    { m: 5, name: "مايو (05)" },
                    { m: 6, name: "يونيو (06)" },
                    { m: 7, name: "يوليو (07)" },
                    { m: 8, name: "أغسطس (08)" },
                    { m: 9, name: "سبتمبر (09)" },
                    { m: 10, name: "أكتوبر (10)" },
                    { m: 11, name: "نوفمبر (11)" },
                    { m: 12, name: "ديسمبر (12)" },
                  ].map(({ m, name }) => (
                    <option key={m} value={m}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-foreground" htmlFor="payroll-year">
                  السنة المالية *
                </label>
                <select
                  id="payroll-year"
                  value={runYear}
                  onChange={(event) => setRunYear(Number(event.target.value))}
                  className="h-10 w-full rounded-xl border border-border/80 bg-card px-3 font-bold text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-xs"
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

          <details className="rounded-2xl border border-border/80 bg-muted/20 p-4">
            <summary className="cursor-pointer text-xs font-black text-foreground">خيارات متقدمة: تخصيص فترة الاحتساب</summary>
            <div className="mt-3 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 font-black text-foreground">
                <Calendar className="h-4 w-4 text-primary" />
                <span>فترة احتساب مخصصة (اختياري)</span>
              </div>
              <span className="text-[11px] text-muted-foreground font-medium">
                احتساب تناسبي تلقائي وفق نظام العمل
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <button
                type="button"
                onClick={() => setRunPeriodMode("full_month")}
                className={`p-3 rounded-2xl border text-right transition-all flex flex-col justify-between gap-2 cursor-pointer ${
                  runPeriodMode === "full_month"
                    ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/30"
                    : "border-border/70 bg-card hover:border-border"
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-black text-foreground">كامل الشهر التعاقدي</span>
                  <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${runPeriodMode === "full_month" ? "border-primary bg-primary" : "border-muted-foreground/40"}`}>
                    {runPeriodMode === "full_month" && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  شهر كامل وفق أساس الحساب المحدد في مجموعة الرواتب
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setRunPeriodMode("custom_end_date");
                  if (!runCustomEndDate) {
                    setRunCustomEndDate(`${runYear}-${String(runMonth).padStart(2, "0")}-20`);
                  }
                }}
                className={`p-3 rounded-2xl border text-right transition-all flex flex-col justify-between gap-2 cursor-pointer ${
                  runPeriodMode === "custom_end_date"
                    ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/30"
                    : "border-border/70 bg-card hover:border-border"
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-black text-foreground">تاريخ نهاية مخصص</span>
                  <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${runPeriodMode === "custom_end_date" ? "border-primary bg-primary" : "border-muted-foreground/40"}`}>
                    {runPeriodMode === "custom_end_date" && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  احتساب حتى يوم محدد بالشهر (صرف مبكر أو مسير مجتزأ)
                </p>
              </button>

              <button
                type="button"
                onClick={() => setRunPeriodMode("custom_days")}
                className={`p-3 rounded-2xl border text-right transition-all flex flex-col justify-between gap-2 cursor-pointer ${
                  runPeriodMode === "custom_days"
                    ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/30"
                    : "border-border/70 bg-card hover:border-border"
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-black text-foreground">عدد أيام محدد</span>
                  <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${runPeriodMode === "custom_days" ? "border-primary bg-primary" : "border-muted-foreground/40"}`}>
                    {runPeriodMode === "custom_days" && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  تحديد عدد الأيام بدقة (مثل 15 يوماً لنصف شهر أو فترة خاصة)
                </p>
              </button>
            </div>

            {/* Sub-inputs for custom period */}
            {runPeriodMode === "custom_end_date" && (
              <div className="p-3 rounded-xl bg-card border border-primary/20 space-y-1.5 animate-in fade-in-50 duration-200">
                <label className="text-xs font-bold text-foreground flex items-center gap-1.5" htmlFor="run-custom-end-date">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  تاريخ نهاية فترة الاحتساب *
                </label>
                <input
                  id="run-custom-end-date"
                  type="date"
                  value={runCustomEndDate}
                  onChange={(e) => setRunCustomEndDate(e.target.value)}
                  className="h-10 w-full sm:w-64 rounded-xl border border-border/80 bg-background px-3 font-mono font-bold text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-xs"
                />
                <p className="text-[11px] text-muted-foreground">
                  سيتم احتساب استحقاقات الموظفين من بداية الشهر وحتى هذا التاريخ مع تطبيق التناسب النظامي.
                </p>
              </div>
            )}

            {runPeriodMode === "custom_days" && (
              <div className="p-3 rounded-xl bg-card border border-primary/20 space-y-1.5 animate-in fade-in-50 duration-200">
                <label className="text-xs font-bold text-foreground flex items-center gap-1.5" htmlFor="run-custom-days-input">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  عدد الأيام المستحقة للاحتساب (1 إلى 31) *
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="run-custom-days-input"
                    type="number"
                    min={1}
                    max={31}
                    value={runCustomDays}
                    onChange={(e) => setRunCustomDays(Math.max(1, Math.min(31, Number(e.target.value) || 1)))}
                    className="h-10 w-32 rounded-xl border border-border/80 bg-background px-3 font-mono font-bold text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-xs text-center"
                  />
                  <span className="text-xs font-bold text-foreground">يوماً</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  سيتم احتساب الفترة من أول الشهر إلى اليوم {runCustomDays} وفق سياسة المجموعة وتواريخ استحقاق كل موظف.
                </p>
              </div>
            )}
            </div>
          </details>

            </div>
          )}

          {runWizardStep === 2 && (
            <div className="space-y-4">
          <details className="rounded-2xl border border-border/80 bg-muted/20 p-4">
            <summary className="cursor-pointer text-xs font-black text-foreground">خيارات متقدمة: فرز الموظفين حسب الإدارة والفئة والبحث</summary>
            <div className="mt-3 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 font-black text-foreground">
                <SlidersHorizontal className="h-4 w-4 text-primary" />
                <span>فلاتر اختيارية لتحديد الموظفين</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="space-y-1.5">
                <label className="font-bold text-foreground" htmlFor="filter-run-dept">
                  الإدارة / القسم
                </label>
                <select
                  id="filter-run-dept"
                  value={runDeptFilter}
                  onChange={(e) => setRunDeptFilter(e.target.value)}
                  className="h-10 w-full rounded-xl border border-border/80 bg-card px-3 font-bold text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-xs"
                >
                  <option value="all">جميع الإدارات والأقسام (الكل)</option>
                  {orgUnits.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.nameAr}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-foreground" htmlFor="filter-run-cat">
                  الفئة الوظيفية / الدرجة
                </label>
                <select
                  id="filter-run-cat"
                  value={runCategoryFilter}
                  onChange={(e) => setRunCategoryFilter(e.target.value)}
                  className="h-10 w-full rounded-xl border border-border/80 bg-card px-3 font-bold text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-xs"
                >
                  <option value="all">جميع الفئات الوظيفية (الكل)</option>
                  {availableJobCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-foreground" htmlFor="filter-run-search">
                  بحث بالاسم أو الرقم الوظيفي
                </label>
                <div className="relative">
                  <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                  <input
                    id="filter-run-search"
                    type="text"
                    value={runEmpSearch}
                    onChange={(e) => setRunEmpSearch(e.target.value)}
                    placeholder="ابحث بالاسم أو الرقم..."
                    className="h-10 w-full rounded-xl border border-border/80 bg-card pr-9 pl-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-xs"
                  />
                  {runEmpSearch && (
                    <button
                      type="button"
                      onClick={() => setRunEmpSearch("")}
                      className="absolute left-2.5 top-2.5 text-xs text-muted-foreground hover:text-foreground p-0.5"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>
            </div>
          </details>

          {/* Section 4: جدول الموظفين المشمولين وتحديد المالت سلكت */}
          <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <span className="text-xs font-black text-foreground">
                  اختيار الموظفين المشمولين في المسير
                </span>
                <Badge variant="secondary" className="text-[11px] font-bold px-2 py-0.5">
                  تم تحديد {selectedRunStats.count} من أصل {eligibleRunEmployees.length}
                </Badge>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleToggleSelectAll}
                  className="h-7 text-[11px] font-bold rounded-lg px-2.5 gap-1 border-border/70 cursor-pointer"
                >
                  {eligibleRunEmployees.length > 0 && eligibleRunEmployees.every((e) => selectedRunEmpIds.includes(e.id)) ? (
                    <>
                      <Square className="h-3 w-3 text-muted-foreground" />
                      إلغاء تحديد المعروض
                    </>
                  ) : (
                    <>
                      <CheckSquare className="h-3 w-3 text-primary" />
                      تحديد كل المعروض ({eligibleRunEmployees.length})
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={handleSelectOnlySaudis}
                  className="h-7 text-[11px] font-bold rounded-lg px-2 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 cursor-pointer"
                >
                  مواطنو دولة المنشأة
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={handleSelectOnlyExpats}
                  className="h-7 text-[11px] font-bold rounded-lg px-2 text-blue-700 dark:text-blue-400 hover:bg-blue-500/10 cursor-pointer"
                >
                  🌐 مقيمون فقط
                </Button>
              </div>
            </div>

            {/* Employees Table container */}
            <div className="border border-border/70 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
              <table className="w-full text-xs text-right border-collapse">
                <thead className="bg-muted/60 sticky top-0 z-10 border-b border-border/80 text-muted-foreground font-bold text-[11px]">
                  <tr>
                    <th className="p-2.5 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={
                          eligibleRunEmployees.length > 0 &&
                          eligibleRunEmployees.every((e) => selectedRunEmpIds.includes(e.id))
                        }
                        onChange={handleToggleSelectAll}
                        className="rounded border-border h-4 w-4 text-primary focus:ring-primary cursor-pointer"
                      />
                    </th>
                    <th className="p-2.5">الموظف</th>
                    <th className="p-2.5">الإدارة / الوظيفة</th>
                    <th className="p-2.5">الفرع / الموقع</th>
                    <th className="p-2.5">نظام الاشتراك</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {eligibleRunEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-muted-foreground text-xs font-medium">
                        لا يوجد موظفون مطابقون للفلاتر المحددة حالياً. جرّب تغيير الفرع أو القسم أو مسح حقل البحث.
                      </td>
                    </tr>
                  ) : (
                    eligibleRunEmployees.map((emp) => {
                      const isSelected = selectedRunEmpIds.includes(emp.id);
                      const isSaudi = Boolean(emp.nationality && companyCountry && isNationalOf(emp.nationality, companyCountry));
                      const branch = workLocations.find((l) => l.id === emp.workLocationId || l.id === (emp as any).locationId);
                      const dept = orgUnits.find((u) => u.id === emp.departmentId);

                      return (
                        <tr
                          key={emp.id}
                          onClick={() => handleToggleEmployee(emp.id)}
                          className={`cursor-pointer transition-colors ${
                            isSelected
                              ? "bg-primary/5 hover:bg-primary/10"
                              : "hover:bg-muted/40 opacity-70"
                          }`}
                        >
                          <td className="p-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleEmployee(emp.id)}
                              className="rounded border-border h-4 w-4 text-primary focus:ring-primary cursor-pointer"
                            />
                          </td>
                          <td className="p-2.5">
                            <div className="font-bold text-foreground flex items-center gap-1.5">
                              <span>{emp.fullName || `${emp.firstNameAr || ""} ${emp.lastNameAr || ""}`}</span>
                              <Badge variant="outline" className={`text-[10px] px-1 py-0 font-bold ${isSaudi ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-blue-500/10 text-blue-600 border-blue-500/20"}`}>
                                {isSaudi ? "مواطن" : "غير مواطن"}
                              </Badge>
                            </div>
                            <span className="text-[10px] font-mono text-muted-foreground">
                              {emp.employeeNo}
                            </span>
                          </td>
                          <td className="p-2.5">
                            <div className="font-medium text-foreground">{dept?.nameAr || emp.departmentName || "عام"}</div>
                            <div className="text-[10px] text-muted-foreground">{emp.jobTitleAr || "موظف"}</div>
                          </td>
                          <td className="p-2.5">
                            <span className="text-[11px] font-medium text-foreground">
                              {branch ? branch.nameAr : "المقر الرئيسي"}
                            </span>
                          </td>
                          <td className="p-2.5 space-y-1" onClick={event => event.stopPropagation()}>
                            <select aria-label={`نظام الاشتراك ${emp.employeeNo}`} className="w-full rounded-lg border bg-card p-2 text-xs"
                              value={schemeOverrides[emp.id] ?? ""} onChange={event => setSchemeOverrides(current => ({ ...current, [emp.id]: event.target.value }))}>
                              <option value="">من ملف الموظف أو حسب الفئة</option>
                              {activeCountryPolicy ? activeCountryPolicy.policy.schemes.map(scheme => <option key={scheme.code} value={scheme.code}>{scheme.name}</option>) :
                                companyCountry === "SA" && <><option value="legacy">التأمينات — النظام القديم</option><option value="new_1445">التأمينات — نظام 1445هـ</option></>}
                            </select>
                            {activeCountryPolicy?.policy.schemes.some(scheme => scheme.contributions.some(component => component.basis === "registered")) &&
                              <input aria-label={`أجر الاشتراك ${emp.employeeNo}`} type="number" min="0" step="0.001" placeholder="أجر الاشتراك المسجل"
                                className="w-full rounded-lg border bg-card p-2 text-xs" value={registeredWages[emp.id] ?? ""}
                                onChange={event => setRegisteredWages(current => { const next = { ...current }; if (event.target.value === "") delete next[emp.id]; else next[emp.id] = Number(event.target.value); return next; })} />}
                          </td>

                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

            </div>
          )}

          {runWizardStep === 3 && (
            <div className="space-y-4">
          {/* ملاحظات المسير وموجز الإحصاءات */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2 space-y-1.5">
              <label className="text-xs font-bold text-foreground" htmlFor="run-notes-field">
                ملاحظات تشغيل المسير (اختياري)
              </label>
              <input
                id="run-notes-field"
                type="text"
                value={runNotes}
                onChange={(e) => setRunNotes(e.target.value)}
                placeholder="مثال: مسير رواتب دوري مع دفعة إجازة / خاص بفرع الرياض..."
                className="h-10 w-full rounded-xl border border-border/80 bg-muted/30 px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-xs"
              />
            </div>

            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs">
              <span className="font-bold text-foreground">الموظفون المحددون:</span>{" "}
              <span className="text-muted-foreground">{selectedRunStats.count} موظف ({selectedRunStats.saudiCount} مواطن / {selectedRunStats.expatCount} غير مواطن)</span>
            </div>
          </div>

          <div className="rounded-xl border p-4 space-y-3">
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={replaceRunDraft} onChange={event => setReplaceRunDraft(event.target.checked)} />إعادة بناء مسودة المسير بالاختيارات الحالية. يستبدل الموظفون والتفاصيل السابقة في المسودة بنتيجة هذه الاختيارات.</label>
            <Button type="button" variant="outline" onClick={previewNewPayroll} disabled={!isLive || previewPending || selectedRunStats.count === 0}>{previewPending ? "جارٍ فحص الجاهزية والاحتساب..." : "مراجعة المسير قبل الإنشاء"}</Button>
            {previewError && <p role="alert" className="text-sm text-destructive">{previewError}</p>}
            {runPreview && <div role="status" className="text-sm space-y-1">
              <p>{runPreview.policyVersion} — {runPreview.employees} موظف</p>
              {runPreview.excludedEmployees > 0 && <p>المستبعدون وفق الأهلية والفترة — {runPreview.excludedEmployees}</p>}
              <p>صافي المسير {formatPayrollMoney(runPreview.totalNet, runPreview.currency)}</p>
              <p>الاستقطاعات {formatPayrollMoney(runPreview.totalDeductions, runPreview.currency)}، منها ضريبة الدخل {formatPayrollMoney(runPreview.totalTax, runPreview.currency)}</p>
              <p>اشتراكات المنشأة {formatPayrollMoney(runPreview.totalEmployerGosi, runPreview.currency)}</p>
              <p className="text-xs text-muted-foreground">معاينة للفترة والموظفين المختارين. يعاد التحقق والاحتساب عند الحفظ.</p>
            </div>}
          </div>
              </div>
          )}

          <DialogFooter className="mt-4 flex flex-col-reverse sm:flex-row items-center justify-between gap-2 border-t border-border/60 pt-4">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsRunModalOpen(false)} disabled={isRunningPayroll}
              className="h-10 w-full rounded-full text-xs font-bold sm:w-auto">إلغاء</Button>
            <div className="flex w-full gap-2 sm:w-auto">
              {runWizardStep > 1 && (
                <Button type="button" variant="outline" size="sm" onClick={() => setRunWizardStep(runWizardStep === 3 ? 2 : 1)} disabled={isRunningPayroll}
                  className="h-10 flex-1 rounded-full text-xs font-bold sm:flex-none">السابق</Button>
              )}
              {runWizardStep < 3 ? (
                <Button type="button" size="sm" onClick={() => setRunWizardStep(runWizardStep === 1 ? 2 : 3)}
                  disabled={runWizardStep === 2 && selectedRunStats.count === 0}
                  className="h-10 flex-1 rounded-full bg-primary px-6 text-xs font-bold text-primary-foreground sm:flex-none">
                  {runWizardStep === 1 ? "التالي: اختيار الموظفين" : "التالي: مراجعة المسير"}
                </Button>
              ) : (
                <Button type="button" size="sm" onClick={handleRunNewPayroll}
                  disabled={isRunningPayroll || selectedRunStats.count === 0 || !runPreview || previewPending}
                  className="h-10 flex-1 rounded-full bg-primary px-6 text-xs font-bold text-primary-foreground sm:flex-none">
                  {isRunningPayroll ? "جارٍ إنشاء المسير..." : `إنشاء المسير — ${selectedRunStats.count} موظف`}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
