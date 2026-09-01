import type {
  AccountingJournalEntry,
  AppNotification,
  AuditLogEntry,
  Candidate,
  CandidateStage,
  CompanyProfile,
  CompanyDocument,
  Employee,
  EmployeeLeaveBalance,
  EmployeePayrollDetail,
  EvaluationRecord,
  ExpenseCategory,
  ExpenseClaim,
  FinalSettlementRecord,
  HardwareAsset,
  JobOffer,
  JobOpening,
  LoanRecord,
  OrgUnit,
  ApprovalChain,
  PayrollGroup,
  PayrollRun,
  PerformanceCycle,
  ShiftDefinition,
  Subsidiary,
  RoleDefinition,
  WorkLocation,
  WorkforcePlan,
} from "../../types";
import { enterpriseSupabase } from "./enterprise-client";

export interface OperationalSnapshot {
  company: CompanyProfile | null;
  subsidiaries: Subsidiary[];
  workLocations: WorkLocation[];
  roles: RoleDefinition[];
  approvalChains: ApprovalChain[];
  leaveTypes: Array<{
    id: string;
    code: string;
    nameAr: string;
    nameEn: string;
    color: string;
    isPaid: boolean;
    deductFromWorkingDaysOnly: boolean;
    maxDaysPerYear: number;
    allowHalfDay: boolean;
    allowNegativeBalance: boolean;
    requiresAttachment: boolean;
    accrualMethod: "yearly_frontloaded" | "monthly_accrual" | "contract_anniversary";
    carryoverLimitDays: number;
    status: "active" | "inactive";
  }>;
  leaveBalances: EmployeeLeaveBalance[];
  shifts: ShiftDefinition[];
  payrollGroups: PayrollGroup[];
  payrollRuns: PayrollRun[];
  payrollDetails: EmployeePayrollDetail[];
  loans: LoanRecord[];
  settlements: FinalSettlementRecord[];
  expenseCategories: ExpenseCategory[];
  expenseClaims: ExpenseClaim[];
  performanceCycles: PerformanceCycle[];
  evaluations: EvaluationRecord[];
  workforcePlans: WorkforcePlan[];
  jobOpenings: JobOpening[];
  candidates: Candidate[];
  jobOffers: JobOffer[];
  assets: HardwareAsset[];
  companyDocs: CompanyDocument[];
  auditLogs: AuditLogEntry[];
  notifications: AppNotification[];
  accountingJournals: AccountingJournalEntry[];
}

const numberValue = (value: unknown) => Number(value ?? 0);

function employeeName(employee?: Employee) {
  return employee ? `${employee.firstNameAr} ${employee.lastNameAr}` : "موظف";
}

function validCandidateStage(value: string): CandidateStage {
  const stages: CandidateStage[] = [
    "applied",
    "screening",
    "interview",
    "assessment",
    "job_offer",
    "hired",
    "rejected",
    "withdrawn",
  ];
  return stages.includes(value as CandidateStage) ? (value as CandidateStage) : "applied";
}

export async function fetchOperationalSnapshot(
  employees: Employee[],
  orgUnits: OrgUnit[],
): Promise<OperationalSnapshot> {
  const [
    companiesResult,
    subsidiariesResult,
    locationsResult,
    rolesResult,
    approvalChainsResult,
    leaveTypesResult,
    leaveBalancesResult,
    shiftsResult,
    payrollGroupsResult,
    payrollRunsResult,
    payrollDetailsResult,
    loansResult,
    settlementsResult,
    expenseCategoriesResult,
    expenseClaimsResult,
    performanceCyclesResult,
    evaluationsResult,
    workforcePlansResult,
    jobsResult,
    candidatesResult,
    offersResult,
    assetsResult,
    documentsResult,
    auditResult,
    notificationsResult,
    journalsResult,
  ] = await Promise.all([
    enterpriseSupabase.from("companies").select("*").limit(1),
    enterpriseSupabase.from("subsidiaries").select("*").order("name_ar"),
    enterpriseSupabase.from("work_locations").select("*").order("name_ar"),
    enterpriseSupabase.from("role_definitions").select("*").order("name_ar"),
    enterpriseSupabase
      .from("approval_chains")
      .select("*")
      .order("created_at", { ascending: false }),
    enterpriseSupabase.from("leave_types").select("*").order("name_ar"),
    enterpriseSupabase.from("leave_balances").select("*"),
    enterpriseSupabase.from("shifts").select("*").order("start_time"),
    enterpriseSupabase.from("payroll_groups").select("*"),
    enterpriseSupabase.from("payroll_runs").select("*").order("created_at", { ascending: false }),
    enterpriseSupabase.from("payroll_details").select("*"),
    enterpriseSupabase.from("loans").select("*").order("created_at", { ascending: false }),
    enterpriseSupabase.from("settlements").select("*").order("created_at", { ascending: false }),
    enterpriseSupabase.from("expense_categories").select("*").order("name_ar"),
    enterpriseSupabase.from("expense_claims").select("*").order("created_at", { ascending: false }),
    enterpriseSupabase
      .from("performance_cycles")
      .select("*")
      .order("start_date", { ascending: false }),
    enterpriseSupabase
      .from("evaluation_records")
      .select("*")
      .order("submitted_at", { ascending: false }),
    enterpriseSupabase.from("workforce_plans").select("*").order("plan_year", { ascending: false }),
    enterpriseSupabase.from("job_openings").select("*").order("created_at", { ascending: false }),
    enterpriseSupabase.from("candidates").select("*").order("created_at", { ascending: false }),
    enterpriseSupabase.from("job_offers").select("*").order("created_at", { ascending: false }),
    enterpriseSupabase.from("hardware_assets").select("*").order("asset_tag"),
    enterpriseSupabase
      .from("company_documents")
      .select("*")
      .order("created_at", { ascending: false }),
    enterpriseSupabase
      .from("audit_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500),
    enterpriseSupabase
      .from("notifications_inbox")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100),
    enterpriseSupabase
      .from("accounting_journals")
      .select("*")
      .order("journal_date", { ascending: false }),
  ]);

  const results = [
    companiesResult,
    subsidiariesResult,
    locationsResult,
    rolesResult,
    approvalChainsResult,
    leaveTypesResult,
    leaveBalancesResult,
    shiftsResult,
    payrollGroupsResult,
    payrollRunsResult,
    payrollDetailsResult,
    loansResult,
    settlementsResult,
    expenseCategoriesResult,
    expenseClaimsResult,
    performanceCyclesResult,
    evaluationsResult,
    workforcePlansResult,
    jobsResult,
    candidatesResult,
    offersResult,
    assetsResult,
    documentsResult,
    auditResult,
    notificationsResult,
    journalsResult,
  ];
  const firstError = results.map((result) => result.error).find(Boolean);
  if (firstError) throw new Error(firstError.message);

  const employeeMap = new Map(employees.map((employee) => [employee.id, employee]));
  const unitMap = new Map(orgUnits.map((unit) => [unit.id, unit]));
  const categoryMap = new Map(
    (expenseCategoriesResult.data ?? []).map((category) => [category.id, category]),
  );
  const jobMap = new Map((jobsResult.data ?? []).map((job) => [job.id, job]));
  const candidateMap = new Map(
    (candidatesResult.data ?? []).map((candidate) => [candidate.id, candidate]),
  );
  const payrollGroupMap = new Map(
    (payrollGroupsResult.data ?? []).map((group) => [group.id, group]),
  );
  const locationMap = new Map(
    (locationsResult.data ?? []).map((location) => [location.id, location]),
  );

  const leaveTypes = (leaveTypesResult.data ?? []).map((row) => ({
    id: row.id,
    code: row.code,
    nameAr: row.name_ar,
    nameEn: row.name_en,
    color: row.color ?? "#365F91",
    isPaid: row.is_paid ?? true,
    deductFromWorkingDaysOnly: row.deduct_working_days_only ?? true,
    maxDaysPerYear: row.max_days_per_year ?? 30,
    allowHalfDay: row.allow_half_day ?? true,
    allowNegativeBalance: false,
    requiresAttachment: false,
    accrualMethod: (row.accrual_method === "monthly_accrual" ||
    row.accrual_method === "contract_anniversary"
      ? row.accrual_method
      : "yearly_frontloaded") as OperationalSnapshot["leaveTypes"][number]["accrualMethod"],
    carryoverLimitDays: 0,
    status: row.status === "inactive" ? ("inactive" as const) : ("active" as const),
  }));
  const leaveTypeMap = new Map(leaveTypes.map((type) => [type.id, type]));

  return {
    company: companiesResult.data?.[0]
      ? {
          id: companiesResult.data[0].id,
          legalNameAr: companiesResult.data[0].legal_name_ar,
          legalNameEn: companiesResult.data[0].legal_name_en,
          taxNumber: companiesResult.data[0].tax_number ?? "",
          crNumber: companiesResult.data[0].cr_number ?? "",
          country: "المملكة العربية السعودية",
          currency: companiesResult.data[0].currency,
          timezone: companiesResult.data[0].timezone,
          headquartersAddress: companiesResult.data[0].headquarters_address ?? "",
          fiscalYearStartMonth: 1,
        }
      : null,
    subsidiaries: (subsidiariesResult.data ?? []).map((row) => ({
      id: row.id,
      companyId: row.company_id ?? "",
      nameAr: row.name_ar,
      nameEn: row.name_en,
      code: row.code,
      managerEmployeeId: row.manager_employee_id ?? undefined,
      managerName: row.manager_employee_id
        ? employeeName(employeeMap.get(row.manager_employee_id))
        : undefined,
      status: row.status === "inactive" ? "inactive" : "active",
      employeeCount: employees.filter((employee) => employee.subsidiaryId === row.id).length,
      crNumber: row.cr_number ?? undefined,
    })),
    workLocations: (locationsResult.data ?? []).map((row) => ({
      id: row.id,
      companyId: row.company_id ?? "",
      nameAr: row.name_ar,
      nameEn: row.name_en,
      code: row.code,
      address: row.address ?? "",
      latitude: numberValue(row.latitude),
      longitude: numberValue(row.longitude),
      radiusMeters: row.radius_meters,
      status: row.status === "inactive" ? "inactive" : "active",
      defaultShiftId: row.default_shift_id ?? undefined,
    })),
    roles: (rolesResult.data ?? []).map((row) => ({
      id: row.id,
      code: row.code,
      nameAr: row.name_ar,
      nameEn: row.name_en,
      descriptionAr: row.description_ar,
      descriptionEn: row.description_en,
      isSystem: row.is_system,
      userCount: 0,
      permissions: [],
    })),
    approvalChains: (approvalChainsResult.data ?? []).map((row) => ({
      id: row.id,
      requestType: row.request_type as ApprovalChain["requestType"],
      nameAr: row.name_ar,
      nameEn: row.name_en,
      scopeType: row.scope_type as ApprovalChain["scopeType"],
      scopeValues: Array.isArray(row.scope_values) ? row.scope_values.map(String) : [],
      steps: Array.isArray(row.steps) ? (row.steps as ApprovalChain["steps"]) : [],
      isDefault: row.is_default,
      status: row.status === "inactive" ? "inactive" : "active",
    })),
    leaveTypes,
    leaveBalances: (leaveBalancesResult.data ?? []).map((row) => {
      const type = leaveTypeMap.get(row.leave_type_id);
      const annual = numberValue(row.annual_entitlement);
      const accrued = numberValue(row.accrued_days);
      const used = numberValue(row.used_days);
      const reserved = numberValue(row.reserved_days);
      const carried = numberValue(row.carried_over_days);
      return {
        leaveTypeId: row.leave_type_id,
        leaveTypeNameAr: type?.nameAr ?? "إجازة",
        leaveTypeNameEn: type?.nameEn ?? "Leave",
        color: type?.color ?? "#365F91",
        annualEntitlement: annual,
        accruedDays: accrued,
        usedDays: used,
        reservedDays: reserved,
        carriedOverDays: carried,
        availableBalance: annual + accrued + carried - used - reserved,
      };
    }),
    shifts: (shiftsResult.data ?? []).map((row) => ({
      id: row.id,
      code: row.code,
      nameAr: row.name_ar,
      nameEn: row.name_en,
      color: row.color ?? "#217A4A",
      type: row.type === "flexible" || row.type === "split" ? row.type : "fixed",
      startTime: row.start_time,
      endTime: row.end_time,
      flexibleHours: row.flexible_hours ?? undefined,
      splitSecondStartTime: row.split_second_start_time ?? undefined,
      splitSecondEndTime: row.split_second_end_time ?? undefined,
      graceMinutesArrival: row.grace_minutes_arrival ?? 15,
      graceMinutesDeparture: row.grace_minutes_departure ?? 15,
      allowSinglePunch: row.allow_single_punch,
      overtimeEligible: row.overtime_eligible ?? true,
    })),
    payrollGroups: (payrollGroupsResult.data ?? []).map((row) => ({
      id: row.id,
      nameAr: row.name_ar,
      nameEn: row.name_en,
      calculationBasis:
        row.calculation_basis === "calendar_days" ? "calendar_days" : "fixed_30_days",
      cutoffDay: row.cutoff_day,
      payday: row.payday,
      currency: row.currency,
      employeeCount: employees.length,
    })),
    payrollRuns: (payrollRunsResult.data ?? []).map((row) => ({
      id: row.id,
      payrollGroupId: row.payroll_group_id ?? "",
      payrollGroupName: row.payroll_group_id
        ? (payrollGroupMap.get(row.payroll_group_id)?.name_ar ?? "مجموعة الرواتب")
        : "مجموعة الرواتب",
      periodYear: row.period_year,
      periodMonth: row.period_month,
      status: row.status as PayrollRun["status"],
      totalEmployees: row.total_employees,
      totalBasicSalary: numberValue(row.total_basic_salary),
      totalAllowances: numberValue(row.total_allowances),
      totalOvertimeAmount: numberValue(row.total_overtime_amount),
      totalDeductions: numberValue(row.total_deductions),
      totalNetSalary: numberValue(row.total_net_salary),
      totalEmployerGosi: numberValue(row.total_employer_gosi),
      lockedAt: row.locked_at ?? undefined,
      paidAt: row.paid_at ?? undefined,
    })),
    payrollDetails: (payrollDetailsResult.data ?? []).map((row) => {
      const employee = employeeMap.get(row.employee_id);
      return {
        id: row.id,
        payrollRunId: row.payroll_run_id,
        employeeId: row.employee_id,
        employeeNo: employee?.employeeNo ?? "—",
        employeeName: employeeName(employee),
        jobTitle: employee?.jobTitleAr ?? "—",
        departmentName: employee?.departmentName ?? "—",
        bankName: "غير مسجل",
        iban: "",
        basicSalary: numberValue(row.basic_salary),
        housingAllowance: numberValue(row.housing_allowance),
        transportAllowance: numberValue(row.transport_allowance),
        otherAllowances: numberValue(row.other_allowances),
        overtimeHours: numberValue(row.overtime_hours),
        overtimeAmount: numberValue(row.overtime_amount),
        retroAdjustments: 0,
        bonusAmount: numberValue(row.bonus_amount),
        grossSalary: numberValue(row.gross_salary),
        unpaidLeaveDeduction: numberValue(row.unpaid_leave_deduction),
        absenceLateDeduction: numberValue(row.absence_late_deduction),
        loanInstallmentDeduction: numberValue(row.loan_deduction),
        gosiEmployeeDeduction: numberValue(row.gosi_employee_deduction),
        otherDeductions: numberValue(row.other_deductions),
        totalDeductions: numberValue(row.total_deductions),
        netSalary: numberValue(row.net_salary),
        notes: row.notes ?? undefined,
      };
    }),
    loans: (loansResult.data ?? []).map((row) => ({
      id: row.id,
      employeeId: row.employee_id,
      employeeName: employeeName(employeeMap.get(row.employee_id)),
      loanType:
        row.loan_type === "housing_advance" || row.loan_type === "emergency"
          ? row.loan_type
          : "personal_advance",
      principalAmount: numberValue(row.principal_amount),
      monthlyInstallment: numberValue(row.monthly_installment),
      totalInstallments: row.total_installments,
      paidInstallments: row.paid_installments,
      remainingBalance: numberValue(row.remaining_balance),
      startDate: row.created_at.split("T")[0],
      status: row.status as LoanRecord["status"],
    })),
    settlements: (settlementsResult.data ?? []).map((row) => ({
      id: row.id,
      employeeId: row.employee_id,
      employeeName: employeeName(employeeMap.get(row.employee_id)),
      terminationDate: row.termination_date,
      noticePeriodServed: true,
      serviceYears: row.service_years,
      serviceMonths: row.service_months,
      eosbAmount: numberValue(row.eosb_amount),
      leaveBalancePayoutDays: 0,
      leaveBalancePayoutAmount: numberValue(row.leave_payout_amount),
      pendingSalaryAmount: 0,
      loanDeductionAmount: 0,
      assetClearanceComplete: false,
      netSettlementAmount: numberValue(row.net_settlement_amount),
      status: row.status as FinalSettlementRecord["status"],
    })),
    expenseCategories: (expenseCategoriesResult.data ?? []).map((row) => ({
      id: row.id,
      nameAr: row.name_ar,
      nameEn: row.name_en,
      icon: "Receipt",
      maxLimitWarning: numberValue(row.max_limit_warning),
      maxLimitBlock: numberValue(row.max_limit_block),
      requiresReceipt: row.requires_receipt ?? true,
    })),
    expenseClaims: (expenseClaimsResult.data ?? []).map((row) => {
      const category = row.category_id ? categoryMap.get(row.category_id) : undefined;
      return {
        id: row.id,
        reportId: row.report_id ?? undefined,
        employeeId: row.employee_id,
        categoryId: row.category_id ?? "",
        categoryNameAr: category?.name_ar ?? "مصروفات عامة",
        categoryNameEn: category?.name_en ?? "General expense",
        amount: numberValue(row.amount),
        currency: row.currency,
        spentAt: row.spent_at,
        merchantName: row.merchant_name,
        receiptUrl: row.receipt_url ?? undefined,
        description: row.description ?? "",
        policyWarningTriggered: row.policy_warning_triggered,
        status: row.status as ExpenseClaim["status"],
      };
    }),
    performanceCycles: (performanceCyclesResult.data ?? []).map((row) => ({
      id: row.id,
      titleAr: row.title_ar,
      titleEn: row.title_en,
      periodType: row.period_type as PerformanceCycle["periodType"],
      startDate: row.start_date,
      endDate: row.end_date,
      status: row.status as PerformanceCycle["status"],
      participantsCount: row.participants_count,
      completionRate: numberValue(row.completion_rate),
    })),
    evaluations: (evaluationsResult.data ?? []).map((row) => ({
      id: row.id,
      cycleId: row.cycle_id,
      employeeId: row.employee_id,
      employeeName: employeeName(employeeMap.get(row.employee_id)),
      evaluatorId: row.evaluator_employee_id ?? "",
      evaluatorName: employeeName(
        row.evaluator_employee_id ? employeeMap.get(row.evaluator_employee_id) : undefined,
      ),
      evaluationType: row.evaluation_type as EvaluationRecord["evaluationType"],
      overallScore: numberValue(row.overall_score),
      status: row.status as EvaluationRecord["status"],
      submittedAt: row.submitted_at ?? undefined,
    })),
    workforcePlans: (workforcePlansResult.data ?? []).map((row) => ({
      id: row.id,
      titleAr: row.title_ar,
      titleEn: row.title_en,
      year: row.plan_year,
      departmentId: row.department_id ?? "",
      departmentName: row.department_id ? (unitMap.get(row.department_id)?.nameAr ?? "—") : "—",
      currentHeadcount: row.current_headcount,
      plannedHires: row.planned_hires,
      plannedExits: row.planned_exits,
      targetHeadcount: row.target_headcount,
      currentBudget: numberValue(row.current_budget),
      projectedCost: numberValue(row.projected_cost),
      status: row.status as WorkforcePlan["status"],
    })),
    jobOpenings: (jobsResult.data ?? []).map((row) => ({
      id: row.id,
      titleAr: row.title_ar,
      titleEn: row.title_en,
      departmentId: row.department_id ?? "",
      departmentName: row.department_id ? (unitMap.get(row.department_id)?.nameAr ?? "—") : "—",
      locationId: row.location_id ?? "",
      locationName: row.location_id ? (locationMap.get(row.location_id)?.name_ar ?? "—") : "—",
      employmentType: row.employment_type as JobOpening["employmentType"],
      openingsCount: row.openings_count,
      filledCount: row.filled_count,
      publishedStatus: row.published_status as JobOpening["publishedStatus"],
      salaryMin: row.salary_min ?? undefined,
      salaryMax: row.salary_max ?? undefined,
      descriptionAr: row.description_ar ?? "",
      descriptionEn: row.description_en ?? "",
      requirementsAr: row.requirements_ar ?? "",
      requirementsEn: row.requirements_en ?? "",
      publishedAt: row.published_at ?? undefined,
    })),
    candidates: (candidatesResult.data ?? []).map((row) => ({
      id: row.id,
      jobId: row.job_id ?? "",
      jobTitle: row.job_id ? (jobMap.get(row.job_id)?.title_ar ?? "—") : "—",
      fullName: row.full_name,
      email: row.email,
      phone: row.phone ?? "",
      stage: validCandidateStage(row.stage),
      ratingScore: numberValue(row.rating_score),
      appliedDate: row.created_at.split("T")[0],
      source:
        row.source === "linkedin" || row.source === "referral" || row.source === "agency"
          ? row.source
          : "website",
      cvUrl: row.cv_url ?? undefined,
      notesCount: row.notes_count,
    })),
    jobOffers: (offersResult.data ?? []).map((row) => {
      const candidate = candidateMap.get(row.candidate_id);
      return {
        id: row.id,
        candidateId: row.candidate_id,
        candidateName: candidate?.full_name ?? "مرشح",
        jobTitle: candidate?.job_id ? (jobMap.get(candidate.job_id)?.title_ar ?? "—") : "—",
        basicSalary: numberValue(row.basic_salary),
        housingAllowance: numberValue(row.housing_allowance),
        transportAllowance: numberValue(row.transport_allowance),
        proposedStartDate: row.proposed_start_date,
        status: row.status as JobOffer["status"],
      };
    }),
    assets: (assetsResult.data ?? []).map((row) => ({
      id: row.id,
      assetTag: row.asset_tag,
      nameAr: row.name_ar,
      nameEn: row.name_en,
      category: row.category as HardwareAsset["category"],
      serialNumber: row.serial_number,
      assignedToEmployeeId: row.assigned_to_employee_id,
      assignedToEmployeeName: row.assigned_to_employee_id
        ? employeeName(employeeMap.get(row.assigned_to_employee_id))
        : undefined,
      assignedDate: row.assigned_date ?? undefined,
      status: row.status as HardwareAsset["status"],
    })),
    companyDocs: (documentsResult.data ?? []).map((row) => ({
      id: row.id,
      titleAr: row.title_ar,
      titleEn: row.title_en,
      category: row.category as CompanyDocument["category"],
      version: row.version,
      fileUrl: row.file_url,
      expiryDate: row.expiry_date ?? undefined,
      visibilityScope: row.visibility_scope as CompanyDocument["visibilityScope"],
      requiresAcknowledgment: row.requires_acknowledgment,
      acknowledgedCount: row.acknowledged_count,
    })),
    auditLogs: (auditResult.data ?? []).map((row) => ({
      id: row.id,
      actorId: row.actor_id ?? "system",
      actorName: row.actor_name ?? "النظام",
      actorRole: row.actor_role ?? "system",
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      timestamp: row.created_at,
      changesSummary: row.changes_summary ?? undefined,
    })),
    notifications: (notificationsResult.data ?? []).map((row) => ({
      id: row.id,
      recipientId: row.recipient_id,
      titleAr: row.title_ar,
      titleEn: row.title_en,
      messageAr: row.message_ar,
      messageEn: row.message_en,
      type: row.type as AppNotification["type"],
      isRead: row.is_read,
      createdAt: row.created_at,
    })),
    accountingJournals: (journalsResult.data ?? []).map((row) => ({
      id: row.id,
      journalNo: row.journal_no,
      sourceType: row.source_type as AccountingJournalEntry["sourceType"],
      sourceReference: row.source_reference,
      date: row.journal_date,
      totalDebit: numberValue(row.total_debit),
      totalCredit: numberValue(row.total_credit),
      status: row.status as AccountingJournalEntry["status"],
      erpIntegrationType: (row.erp_integration_type ??
        undefined) as AccountingJournalEntry["erpIntegrationType"],
    })),
  };
}

export async function createLeaveTypeRecord(input: {
  nameAr: string;
  maxDaysPerYear: number;
  isPaid: boolean;
}) {
  const { error } = await enterpriseSupabase.from("leave_types").insert({
    code: `LT-${Date.now().toString().slice(-6)}`,
    name_ar: input.nameAr,
    name_en: input.nameAr,
    color: "#365F91",
    is_paid: input.isPaid,
    deduct_working_days_only: true,
    max_days_per_year: input.maxDaysPerYear,
    allow_half_day: true,
    accrual_method: "yearly_frontloaded",
    status: "active",
  });
  if (error) throw new Error(error.message);
}

export async function createExpenseCategoryRecord(input: {
  nameAr: string;
  warningLimit: number;
  blockLimit: number;
}) {
  const { error } = await enterpriseSupabase.from("expense_categories").insert({
    name_ar: input.nameAr,
    name_en: input.nameAr,
    max_limit_warning: input.warningLimit,
    max_limit_block: input.blockLimit,
    requires_receipt: true,
  });
  if (error) throw new Error(error.message);
}

export async function adjustLeaveBalanceRecord(
  employeeId: string,
  leaveTypeId: string,
  days: number,
) {
  const { data: existing, error: readError } = await enterpriseSupabase
    .from("leave_balances")
    .select("id, accrued_days")
    .eq("employee_id", employeeId)
    .eq("leave_type_id", leaveTypeId)
    .maybeSingle();
  if (readError) throw new Error(readError.message);

  if (existing) {
    const { error } = await enterpriseSupabase
      .from("leave_balances")
      .update({
        accrued_days: numberValue(existing.accrued_days) + days,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await enterpriseSupabase.from("leave_balances").insert({
    employee_id: employeeId,
    leave_type_id: leaveTypeId,
    annual_entitlement: 0,
    accrued_days: days,
    used_days: 0,
    reserved_days: 0,
    carried_over_days: 0,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

export async function createExpenseClaimRecord(
  claim: Omit<ExpenseClaim, "id" | "status" | "policyWarningTriggered">,
) {
  const { error } = await enterpriseSupabase.from("expense_claims").insert({
    employee_id: claim.employeeId,
    category_id: claim.categoryId,
    amount: claim.amount,
    currency: claim.currency,
    spent_at: claim.spentAt,
    merchant_name: claim.merchantName,
    receipt_url: claim.receiptUrl ?? null,
    description: claim.description,
    status: "submitted",
  });
  if (error) throw new Error(error.message);
}

export async function markNotificationReadRecord(id: string) {
  const { error } = await enterpriseSupabase
    .from("notifications_inbox")
    .update({ is_read: true })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function createOrganizationUnitRecord(unit: Omit<OrgUnit, "id" | "employeeCount">) {
  const { error } = await enterpriseSupabase.from("departments").insert({
    company_id: unit.companyId || null,
    parent_id: unit.parentId ?? null,
    name: unit.nameAr,
    name_en: unit.nameEn,
    code: unit.code,
    unit_type: unit.type,
    manager_employee_id: unit.managerEmployeeId ?? null,
    status: unit.status,
  });
  if (error) throw new Error(error.message);
}

export async function createSubsidiaryRecord(subsidiary: Omit<Subsidiary, "id" | "employeeCount">) {
  const { error } = await enterpriseSupabase.from("subsidiaries").insert({
    company_id: subsidiary.companyId || null,
    name_ar: subsidiary.nameAr,
    name_en: subsidiary.nameEn,
    code: subsidiary.code,
    cr_number: subsidiary.crNumber ?? null,
    manager_employee_id: subsidiary.managerEmployeeId ?? null,
    status: subsidiary.status,
  });
  if (error) throw new Error(error.message);
}

export async function createWorkLocationRecord(location: Omit<WorkLocation, "id">) {
  const { error } = await enterpriseSupabase.from("work_locations").insert({
    company_id: location.companyId || null,
    name_ar: location.nameAr,
    name_en: location.nameEn,
    code: location.code,
    address: location.address,
    latitude: location.latitude,
    longitude: location.longitude,
    radius_meters: location.radiusMeters,
    default_shift_id: location.defaultShiftId ?? null,
    status: location.status,
  });
  if (error) throw new Error(error.message);
}

export async function createRoleDefinitionRecord(
  role: Omit<RoleDefinition, "id" | "userCount" | "permissions"> & { dataScope: string },
) {
  const { error } = await enterpriseSupabase.from("role_definitions").insert({
    code: role.code,
    name_ar: role.nameAr,
    name_en: role.nameEn,
    description_ar: role.descriptionAr,
    description_en: role.descriptionEn,
    is_system: role.isSystem,
    data_scope: role.dataScope,
  });
  if (error) throw new Error(error.message);
}

export async function createApprovalChainRecord(chain: Omit<ApprovalChain, "id">) {
  const { error } = await enterpriseSupabase.from("approval_chains").insert({
    request_type: chain.requestType,
    name_ar: chain.nameAr,
    name_en: chain.nameEn,
    scope_type: chain.scopeType,
    scope_values: chain.scopeValues ?? [],
    steps: chain.steps,
    is_default: chain.isDefault,
    status: chain.status,
  });
  if (error) throw new Error(error.message);
}

export async function createShiftRecord(shift: Omit<ShiftDefinition, "id">) {
  const { error } = await enterpriseSupabase.from("shifts").insert({
    code: shift.code,
    name_ar: shift.nameAr,
    name_en: shift.nameEn,
    color: shift.color,
    type: shift.type,
    start_time: shift.startTime,
    end_time: shift.endTime,
    grace_minutes_arrival: shift.graceMinutesArrival,
    grace_minutes_departure: shift.graceMinutesDeparture,
    flexible_hours: shift.flexibleHours ?? null,
    split_second_start_time: shift.splitSecondStartTime ?? null,
    split_second_end_time: shift.splitSecondEndTime ?? null,
    allow_single_punch: shift.allowSinglePunch,
    overtime_eligible: shift.overtimeEligible,
  });
  if (error) throw new Error(error.message);
}

export async function createPayrollRunRecord(run: PayrollRun) {
  const { data, error } = await enterpriseSupabase
    .from("payroll_runs")
    .upsert(
      {
        payroll_group_id: run.payrollGroupId || null,
        period_year: run.periodYear,
        period_month: run.periodMonth,
        status: run.status,
        total_employees: run.totalEmployees,
        total_basic_salary: run.totalBasicSalary,
        total_allowances: run.totalAllowances,
        total_overtime_amount: run.totalOvertimeAmount,
        total_deductions: run.totalDeductions,
        total_net_salary: run.totalNetSalary,
        total_employer_gosi: run.totalEmployerGosi,
      },
      { onConflict: "payroll_group_id,period_year,period_month" },
    )
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}

export async function createPayrollRunWithDetailsRecord(
  run: PayrollRun,
  details: EmployeePayrollDetail[],
) {
  const runId = await createPayrollRunRecord(run);
  const { error: deleteError } = await enterpriseSupabase
    .from("payroll_details")
    .delete()
    .eq("payroll_run_id", runId);
  if (deleteError) throw new Error(deleteError.message);
  if (details.length === 0) return;
  const { error } = await enterpriseSupabase.from("payroll_details").insert(
    details.map((detail) => ({
      payroll_run_id: runId,
      employee_id: detail.employeeId,
      basic_salary: detail.basicSalary,
      housing_allowance: detail.housingAllowance,
      transport_allowance: detail.transportAllowance,
      other_allowances: detail.otherAllowances,
      overtime_hours: detail.overtimeHours,
      overtime_amount: detail.overtimeAmount,
      bonus_amount: detail.bonusAmount,
      unpaid_leave_deduction: detail.unpaidLeaveDeduction,
      absence_late_deduction: detail.absenceLateDeduction,
      loan_deduction: detail.loanInstallmentDeduction,
      gosi_employee_deduction: detail.gosiEmployeeDeduction,
      other_deductions: detail.otherDeductions,
      gross_salary: detail.grossSalary,
      total_deductions: detail.totalDeductions,
      net_salary: detail.netSalary,
      notes: detail.notes ?? null,
    })),
  );
  if (error) throw new Error(error.message);
}

export async function updatePayrollRunStatusRecord(id: string, status: PayrollRun["status"]) {
  const now = new Date().toISOString();
  const { error } = await enterpriseSupabase
    .from("payroll_runs")
    .update({
      status,
      locked_at: status === "confirmed_locked" ? now : undefined,
      paid_at: status === "paid" ? now : undefined,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function createSettlementRecord(settlement: Omit<FinalSettlementRecord, "id">) {
  const { error } = await enterpriseSupabase.from("settlements").insert({
    employee_id: settlement.employeeId,
    termination_date: settlement.terminationDate,
    service_years: settlement.serviceYears,
    service_months: settlement.serviceMonths,
    eosb_amount: settlement.eosbAmount,
    leave_payout_amount: settlement.leaveBalancePayoutAmount,
    net_settlement_amount: settlement.netSettlementAmount,
    status: settlement.status,
  });
  if (error) throw new Error(error.message);
}

export async function createPerformanceCycleRecord(cycle: Omit<PerformanceCycle, "id">) {
  const { error } = await enterpriseSupabase.from("performance_cycles").insert({
    title_ar: cycle.titleAr,
    title_en: cycle.titleEn,
    period_type: cycle.periodType,
    start_date: cycle.startDate,
    end_date: cycle.endDate,
    status: cycle.status,
    participants_count: cycle.participantsCount,
    completion_rate: cycle.completionRate,
  });
  if (error) throw new Error(error.message);
}

export async function createEvaluationRecord(evaluation: Omit<EvaluationRecord, "id">) {
  const { error } = await enterpriseSupabase.from("evaluation_records").insert({
    cycle_id: evaluation.cycleId,
    employee_id: evaluation.employeeId,
    evaluator_employee_id: evaluation.evaluatorId || null,
    evaluation_type: evaluation.evaluationType,
    competency_scores: {},
    overall_score: evaluation.overallScore,
    status: evaluation.status,
    submitted_at: evaluation.submittedAt ?? new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

export async function createJobOpeningRecord(job: Omit<JobOpening, "id">) {
  const { error } = await enterpriseSupabase.from("job_openings").insert({
    title_ar: job.titleAr,
    title_en: job.titleEn,
    department_id: job.departmentId || null,
    location_id: job.locationId || null,
    employment_type: job.employmentType,
    openings_count: job.openingsCount,
    filled_count: job.filledCount,
    published_status: job.publishedStatus,
    salary_min: job.salaryMin ?? null,
    salary_max: job.salaryMax ?? null,
    description_ar: job.descriptionAr,
    description_en: job.descriptionEn,
    requirements_ar: job.requirementsAr,
    requirements_en: job.requirementsEn,
    published_at: job.publishedAt ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function createCandidateRecord(candidate: Omit<Candidate, "id">) {
  const { error } = await enterpriseSupabase.from("candidates").insert({
    job_id: candidate.jobId || null,
    full_name: candidate.fullName,
    email: candidate.email,
    phone: candidate.phone,
    stage: candidate.stage,
    rating_score: candidate.ratingScore,
    source: candidate.source,
    cv_url: candidate.cvUrl ?? null,
    notes_count: candidate.notesCount,
  });
  if (error) throw new Error(error.message);
}

export async function updateCandidateRecord(
  candidateId: string,
  updates: { stage?: CandidateStage; ratingScore?: number },
) {
  const { error } = await enterpriseSupabase
    .from("candidates")
    .update({
      stage: updates.stage,
      rating_score: updates.ratingScore,
    })
    .eq("id", candidateId);
  if (error) throw new Error(error.message);
}

export async function createJobOfferRecord(offer: Omit<JobOffer, "id" | "status">) {
  const { error } = await enterpriseSupabase.from("job_offers").insert({
    candidate_id: offer.candidateId,
    basic_salary: offer.basicSalary,
    housing_allowance: offer.housingAllowance,
    transport_allowance: offer.transportAllowance,
    proposed_start_date: offer.proposedStartDate,
    status: "sent_to_candidate",
  });
  if (error) throw new Error(error.message);
}

export async function createAssetRecord(asset: Omit<HardwareAsset, "id">) {
  const { error } = await enterpriseSupabase.from("hardware_assets").insert({
    asset_tag: asset.assetTag,
    name_ar: asset.nameAr,
    name_en: asset.nameEn,
    category: asset.category,
    serial_number: asset.serialNumber,
    assigned_to_employee_id: asset.assignedToEmployeeId ?? null,
    assigned_date: asset.assignedDate ?? null,
    status: asset.status,
  });
  if (error) throw new Error(error.message);
}

export async function assignAssetRecord(assetId: string, employeeId: string) {
  const today = new Date().toISOString().split("T")[0];
  const [{ error: assetError }, { error: assignmentError }] = await Promise.all([
    enterpriseSupabase
      .from("hardware_assets")
      .update({ assigned_to_employee_id: employeeId, assigned_date: today, status: "assigned" })
      .eq("id", assetId),
    enterpriseSupabase
      .from("asset_assignments")
      .insert({ asset_id: assetId, employee_id: employeeId }),
  ]);
  if (assetError || assignmentError)
    throw new Error((assetError ?? assignmentError)?.message ?? "تعذر تسليم العهدة");
}

export async function returnAssetRecord(assetId: string) {
  const now = new Date().toISOString();
  const { error: assetError } = await enterpriseSupabase
    .from("hardware_assets")
    .update({ assigned_to_employee_id: null, assigned_date: null, status: "available" })
    .eq("id", assetId);
  if (assetError) throw new Error(assetError.message);
  const { error } = await enterpriseSupabase
    .from("asset_assignments")
    .update({ returned_at: now })
    .eq("asset_id", assetId)
    .is("returned_at", null);
  if (error) throw new Error(error.message);
}

export async function createCompanyDocumentRecord(
  document: Omit<CompanyDocument, "id" | "acknowledgedCount">,
) {
  const { error } = await enterpriseSupabase.from("company_documents").insert({
    title_ar: document.titleAr,
    title_en: document.titleEn,
    category: document.category,
    version: document.version,
    expiry_date: document.expiryDate ?? null,
    file_url: document.fileUrl,
    visibility_scope: document.visibilityScope,
    requires_acknowledgment: document.requiresAcknowledgment,
    acknowledged_count: 0,
  });
  if (error) throw new Error(error.message);
}

export async function acknowledgeDocumentRecord(documentId: string, employeeId: string) {
  const { error } = await enterpriseSupabase.from("document_acknowledgements").upsert(
    {
      document_id: documentId,
      employee_id: employeeId,
      acknowledged_at: new Date().toISOString(),
    },
    { onConflict: "document_id,employee_id", ignoreDuplicates: true },
  );
  if (error) throw new Error(error.message);
}

export async function createAuditEventRecord(entry: AuditLogEntry) {
  const { data } = await enterpriseSupabase.auth.getUser();
  const { error } = await enterpriseSupabase.from("audit_events").insert({
    actor_id: data.user?.id ?? null,
    actor_name: entry.actorName,
    actor_role: entry.actorRole,
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: entry.entityId,
    changes_summary: entry.changesSummary ?? null,
  });
  if (error) throw new Error(error.message);
}
