// ============================================================================
// HRMS Enterprise Solution - Domain Types Specification (M01 - M20)
// ============================================================================

// ----------------------------------------------------------------------------
// Common & Core Types
// ----------------------------------------------------------------------------
export type Language = "ar" | "en";
export type Direction = "rtl" | "ltr";

export type UserRole =
  | "super_admin" // مشرف عام للنظام
  | "hr_manager" // مدير الموارد البشرية
  | "payroll_officer" // مسؤول الرواتب
  | "attendance_officer" // مسؤول الحضور
  | "line_manager" // مدير مباشر
  | "recruiter" // مسؤول التوظيف
  | "finance_officer" // مسؤول المالية والمصروفات
  | "performance_lead" // مسؤول الأداء
  | "employee" // موظف
  | "auditor"; // مدقق / قراءة فقط

export type DataScope = "self" | "team" | "department" | "subsidiary" | "all";

export type RequestStatus =
  | "draft"
  | "submitted"
  | "pending_approval"
  | "returned"
  | "approved"
  | "rejected"
  | "in_execution"
  | "completed"
  | "cancelled";

// ----------------------------------------------------------------------------
// M02: Organization & Work Structure
// ----------------------------------------------------------------------------
export interface CompanyProfile {
  id: string;
  legalNameAr: string;
  legalNameEn: string;
  taxNumber: string;
  crNumber: string;
  country: string;
  currency: string;
  timezone: string;
  logoUrl?: string;
  headquartersAddress: string;
  fiscalYearStartMonth: number;
}

export interface Subsidiary {
  id: string;
  companyId: string;
  nameAr: string;
  nameEn: string;
  code: string;
  managerEmployeeId?: string;
  managerName?: string;
  status: "active" | "inactive";
  employeeCount: number;
  crNumber?: string;
}

export interface OrgUnit {
  id: string;
  companyId: string;
  parentId?: string | null;
  nameAr: string;
  nameEn: string;
  code: string;
  type: "division" | "department" | "section" | "unit";
  managerEmployeeId?: string;
  managerName?: string;
  status: "active" | "inactive";
  employeeCount: number;
}

export interface WorkLocation {
  id: string;
  companyId: string;
  nameAr: string;
  nameEn: string;
  code: string;
  address: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  status: "active" | "inactive";
  defaultShiftId?: string;
}

// ----------------------------------------------------------------------------
// M03: Employee Master & 360° Profile
// ----------------------------------------------------------------------------
export type EmployeeStatus =
  "draft" | "preboarding" | "probation" | "active" | "on_leave" | "suspended" | "terminated";

export type ContractType = "full_time" | "part_time" | "contractor" | "seasonal" | "internship";
export type Gender = "male" | "female";
export type MaritalStatus = "single" | "married" | "divorced" | "widowed";

export interface EmployeeDocument {
  id: string;
  employeeId: string;
  type:
    "national_id" | "iqama" | "passport" | "contract" | "degree" | "medical_insurance" | "other";
  titleAr: string;
  titleEn: string;
  documentNumber: string;
  issueDate?: string;
  expiryDate?: string;
  fileUrl: string;
  fileSize?: string;
  status: "valid" | "expiring_soon" | "expired" | "pending_verification";
}

export interface SalaryProfile {
  id: string;
  employeeId: string;
  effectiveFrom: string;
  basicSalary: number;
  housingAllowance: number;
  transportAllowance: number;
  otherAllowances: { name: string; amount: number }[];
  gosiDeductionEmployee: number;
  gosiDeductionEmployer: number;
  bankName: string;
  iban: string;
  payrollGroupId: string;
}

export interface Employee {
  id: string;
  employeeNo: string;
  firstNameAr: string;
  lastNameAr: string;
  firstNameEn: string;
  lastNameEn: string;
  email: string;
  personalEmail?: string;
  phone: string;
  nationalIdOrIqama: string;
  nationality: string;
  gender: Gender;
  birthDate: string;
  maritalStatus: MaritalStatus;
  avatarUrl?: string;

  // Organization Placement
  subsidiaryId: string;
  subsidiaryName?: string;
  departmentId: string;
  departmentName?: string;
  jobTitleAr: string;
  jobTitleEn: string;
  managerId?: string | null;
  managerName?: string;
  workLocationId: string;
  workLocationName?: string;

  // Employment Details
  hireDate: string;
  contractType: ContractType;
  probationEndDate?: string;
  status: EmployeeStatus;
  completionScore: number; // 0 to 100%

  // Financial Summary
  basicSalary: number;
  totalSalary: number;
  housingAllowance?: number;
  transportAllowance?: number;
  otherAllowances?: number;
  bankName?: string;
  iban?: string;
  gosiNumber?: string;
  gosiEmployeeDeduction?: number;
  gosiEmployerContribution?: number;

  // Identity & Civil
  passportNo?: string;
  passportExpiry?: string;
  nationalIdExpiry?: string;
  bloodType?: string;
  dependentsCount?: number;

  // National Address & Emergency
  nationalAddress?: {
    buildingNo: string;
    street: string;
    district: string;
    city: string;
    postalCode: string;
    additionalNo: string;
  };
  emergencyContact?: {
    name: string;
    relation: string;
    phone: string;
  };

  // Job Structure & Career
  jobGrade?: string;
  costCenter?: string;
  contractStartDate?: string;
  contractEndDate?: string;
  qiwaContractNo?: string;
  yearsOfService?: number;
  workType?: "on_site" | "hybrid" | "remote";

  // Education & Skills
  educationDegree?: string;
  university?: string;
  graduationYear?: number;
  certifications?: string[];
  languages?: string[];

  // Assigned Assets & Digital Documents
  assignedAssets?: {
    name: string;
    type: string;
    serialNo: string;
    assignedDate: string;
  }[];
  documentsList?: {
    type: string;
    title: string;
    docNo: string;
    expiryDate: string;
    status: "valid" | "expiring" | "expired";
  }[];

  // Custom Fields
  customFields?: Record<string, unknown>;
}

// ----------------------------------------------------------------------------
// M04: RBAC, Roles & Permissions
// ----------------------------------------------------------------------------
export interface AppPermission {
  id: string;
  module: string;
  action: "view" | "create" | "edit" | "delete" | "approve" | "export" | "pay" | "configure";
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
}

export interface RoleDefinition {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  isSystem: boolean;
  userCount: number;
  dataScope?: DataScope;
  permissions: {
    permissionId: string;
    dataScope: DataScope;
  }[];
}

// ----------------------------------------------------------------------------
// M05: Requests, Tasks & Approval Engine
// ----------------------------------------------------------------------------
export type RequestCategory =
  | "leave"
  | "attendance_correction"
  | "expense_claim"
  | "loan_advance"
  | "salary_certificate"
  | "resignation"
  | "asset_request"
  | "general";

export interface ApprovalStep {
  sequence: number;
  resolverType:
    | "direct_manager"
    | "department_head"
    | "hr_manager"
    | "finance_manager"
    | "specific_user"
    | "custom_role";
  resolverValue?: string;
  stepNameAr: string;
  stepNameEn: string;
}

export interface ApprovalChain {
  id: string;
  requestType: RequestCategory;
  nameAr: string;
  nameEn: string;
  scopeType: "all_employees" | "department" | "subsidiary" | "specific_employees";
  scopeValues?: string[];
  steps: ApprovalStep[];
  isDefault: boolean;
  status: "active" | "inactive";
}

export interface RequestTimelineEvent {
  id: string;
  stepNumber: number;
  actorId: string;
  actorName: string;
  actorRole: string;
  action: "submitted" | "approved" | "rejected" | "returned" | "delegated";
  note?: string;
  timestamp: string;
}

export interface ServiceRequest {
  id: string;
  referenceNo: string;
  type: RequestCategory;
  requesterId: string;
  requesterName: string;
  requesterJobTitle?: string;
  requesterAvatar?: string;
  departmentName?: string;
  subjectEmployeeId?: string;
  status: RequestStatus;
  currentStepIndex: number;
  totalSteps: number;
  currentApproverRole?: string;
  submittedAt: string;
  updatedAt: string;
  payload: Record<string, string | number | boolean | null | undefined>;
  timeline: RequestTimelineEvent[];
  attachmentUrls?: string[];
}

// ----------------------------------------------------------------------------
// M06: Leaves & Holidays
// ----------------------------------------------------------------------------
export type LeaveAccrualMethod = "yearly_frontloaded" | "monthly_accrual" | "contract_anniversary";

export interface LeaveTypePolicy {
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
  accrualMethod: LeaveAccrualMethod;
  carryoverLimitDays: number;
  status: "active" | "inactive";
}

export interface EmployeeLeaveBalance {
  leaveTypeId: string;
  leaveTypeNameAr: string;
  leaveTypeNameEn: string;
  color: string;
  annualEntitlement: number;
  accruedDays: number;
  usedDays: number;
  reservedDays: number; // In pending requests
  carriedOverDays: number;
  availableBalance: number;
}

export interface LeaveRequestPayload {
  leaveTypeId: string;
  leaveTypeNameAr: string;
  leaveTypeNameEn: string;
  startDate: string;
  endDate: string;
  isHalfDay: boolean;
  halfDayPeriod?: "morning" | "evening";
  totalDays: number;
  reason: string;
  replacementEmployeeId?: string;
  replacementEmployeeName?: string;
  emergencyContactPhone?: string;
}

// ----------------------------------------------------------------------------
// M07, M08, M09: Time, Shifts & Attendance
// ----------------------------------------------------------------------------
export type AttendanceStatus =
  | "present"
  | "late"
  | "early_departure"
  | "absent"
  | "on_leave"
  | "holiday"
  | "rest_day"
  | "missing_punch";

export interface ShiftDefinition {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  color: string;
  type: "fixed" | "flexible" | "split";
  startTime: string; // "09:00"
  endTime: string; // "17:00"
  flexibleHours?: number; // 8 hours
  splitSecondStartTime?: string;
  splitSecondEndTime?: string;
  graceMinutesArrival: number; // 15 mins
  graceMinutesDeparture: number; // 15 mins
  allowSinglePunch: boolean;
  overtimeEligible: boolean;
}

export interface ScheduleAssignment {
  id: string;
  employeeId: string;
  date: string;
  shiftId: string;
  shiftNameAr: string;
  shiftColor: string;
  isRestDay: boolean;
  status: "draft" | "published";
}

export interface DailyAttendanceRecord {
  id: string;
  employeeId: string;
  employeeNo: string;
  employeeName: string;
  departmentName: string;
  workDate: string;
  scheduledShift?: string;
  scheduledIn?: string;
  scheduledOut?: string;
  actualIn?: string;
  actualOut?: string;
  status: AttendanceStatus;
  lateMinutes: number;
  earlyDepartureMinutes: number;
  workedHours: number;
  overtimeHours: number;
  punchSource: "biometric_device" | "mobile_gps" | "manual_admin" | "correction_request";
  geofenceValid: boolean;
  violationsCount: number;
  reviewedByPayroll: boolean;
}

export interface AttendanceCorrectionPayload {
  originalAttendanceId: string;
  workDate: string;
  correctInTime?: string;
  correctOutTime?: string;
  reason: string;
}

// ----------------------------------------------------------------------------
// M10 & M11: Payroll, Loans & Settlements
// ----------------------------------------------------------------------------
export type PayrollCalculationBasis = "fixed_30_days" | "calendar_days";

export interface PayrollGroup {
  id: string;
  nameAr: string;
  nameEn: string;
  calculationBasis: PayrollCalculationBasis;
  cutoffDay: number; // e.g. 25th of month
  payday: number; // e.g. 28th of month
  currency: string;
  employeeCount: number;
}

export type PayrollRunStatus =
  | "draft"
  | "calculating"
  | "ready_for_review"
  | "pending_approval"
  | "approved"
  | "confirmed_locked"
  | "paid"
  | "closed";

export interface PayrollRun {
  id: string;
  payrollGroupId: string;
  payrollGroupName: string;
  periodYear: number;
  periodMonth: number; // 1 to 12
  status: PayrollRunStatus;
  totalEmployees: number;
  totalBasicSalary: number;
  totalAllowances: number;
  totalOvertimeAmount: number;
  totalDeductions: number;
  totalNetSalary: number;
  totalEmployerGosi: number;
  lockedAt?: string;
  paidAt?: string;
}

export interface EmployeePayrollDetail {
  id: string;
  payrollRunId: string;
  employeeId: string;
  employeeNo: string;
  employeeName: string;
  jobTitle: string;
  departmentName: string;
  bankName: string;
  iban: string;

  // Earnings
  basicSalary: number;
  housingAllowance: number;
  transportAllowance: number;
  otherAllowances: number;
  overtimeHours: number;
  overtimeAmount: number;
  retroAdjustments: number;
  bonusAmount: number;
  grossSalary: number;

  // Deductions
  unpaidLeaveDeduction: number;
  absenceLateDeduction: number;
  loanInstallmentDeduction: number;
  gosiEmployeeDeduction: number;
  otherDeductions: number;
  totalDeductions: number;

  // Net
  netSalary: number;
  notes?: string;
}

export interface LoanRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  loanType: "personal_advance" | "housing_advance" | "emergency";
  principalAmount: number;
  monthlyInstallment: number;
  totalInstallments: number;
  paidInstallments: number;
  remainingBalance: number;
  startDate: string;
  status: "active" | "completed" | "paused" | "cancelled";
}

export interface FinalSettlementRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  terminationDate: string;
  noticePeriodServed: boolean;
  serviceYears: number;
  serviceMonths: number;
  eosbAmount: number; // End of service gratuity
  leaveBalancePayoutDays: number;
  leaveBalancePayoutAmount: number;
  pendingSalaryAmount: number;
  loanDeductionAmount: number;
  assetClearanceComplete: boolean;
  netSettlementAmount: number;
  status: "draft" | "pending_approval" | "approved" | "paid";
}

// ----------------------------------------------------------------------------
// M12: Expense Management
// ----------------------------------------------------------------------------
export interface ExpenseCategory {
  id: string;
  nameAr: string;
  nameEn: string;
  icon: string;
  maxLimitWarning: number;
  maxLimitBlock: number;
  requiresReceipt: boolean;
}

export interface ExpenseClaim {
  id: string;
  reportId?: string;
  employeeId: string;
  categoryId: string;
  categoryNameAr: string;
  categoryNameEn: string;
  amount: number;
  currency: string;
  spentAt: string;
  merchantName: string;
  receiptUrl?: string;
  description: string;
  policyWarningTriggered: boolean;
  status: "draft" | "submitted" | "approved" | "rejected" | "reimbursed";
}

export interface ExpenseReport {
  id: string;
  referenceNo: string;
  employeeId: string;
  employeeName: string;
  title: string;
  claimsCount: number;
  totalAmount: number;
  currency: string;
  status: RequestStatus;
  submittedAt?: string;
  approvedAt?: string;
}

// ----------------------------------------------------------------------------
// M13: Performance Management 360°
// ----------------------------------------------------------------------------
export interface PerformanceCycle {
  id: string;
  titleAr: string;
  titleEn: string;
  periodType: "annual" | "semi_annual" | "quarterly" | "probation";
  startDate: string;
  endDate: string;
  status: "draft" | "active" | "in_review" | "completed";
  participantsCount: number;
  completionRate: number;
}

export interface EvaluationRecord {
  id: string;
  cycleId: string;
  employeeId: string;
  employeeName: string;
  evaluatorId: string;
  evaluatorName: string;
  evaluationType: "self" | "manager" | "peer" | "subordinate";
  overallScore: number; // e.g. 4.2 / 5.0
  status: "pending" | "submitted" | "acknowledged";
  submittedAt?: string;
}

// ----------------------------------------------------------------------------
// M14: Workforce Planning
// ----------------------------------------------------------------------------
export interface WorkforcePlan {
  id: string;
  titleAr: string;
  titleEn: string;
  year: number;
  departmentId: string;
  departmentName: string;
  currentHeadcount: number;
  plannedHires: number;
  plannedExits: number;
  targetHeadcount: number;
  currentBudget: number;
  projectedCost: number;
  status: "draft" | "pending_approval" | "approved";
}

// ----------------------------------------------------------------------------
// M15: ATS & Recruitment
// ----------------------------------------------------------------------------
export type CandidateStage =
  | "applied"
  | "screening"
  | "interview"
  | "assessment"
  | "job_offer"
  | "hired"
  | "rejected"
  | "withdrawn";

export interface JobOpening {
  id: string;
  titleAr: string;
  titleEn: string;
  departmentId: string;
  departmentName: string;
  locationId: string;
  locationName: string;
  employmentType: ContractType;
  openingsCount: number;
  filledCount: number;
  publishedStatus: "draft" | "published" | "closed";
  salaryMin?: number;
  salaryMax?: number;
  descriptionAr: string;
  descriptionEn: string;
  requirementsAr: string;
  requirementsEn: string;
  publishedAt?: string;
}

export interface Candidate {
  id: string;
  jobId: string;
  jobTitle: string;
  fullName: string;
  email: string;
  phone: string;
  stage: CandidateStage;
  ratingScore: number; // 1 to 5
  cvUrl?: string;
  appliedDate: string;
  source: "website" | "linkedin" | "referral" | "agency";
  notesCount: number;
}

export interface JobOffer {
  id: string;
  candidateId: string;
  candidateName: string;
  jobTitle: string;
  basicSalary: number;
  housingAllowance: number;
  transportAllowance: number;
  proposedStartDate: string;
  status: "draft" | "pending_approval" | "sent_to_candidate" | "accepted" | "declined";
}

// ----------------------------------------------------------------------------
// M16: Assets & Company Documents
// ----------------------------------------------------------------------------
export interface HardwareAsset {
  id: string;
  assetTag: string;
  nameAr: string;
  nameEn: string;
  category: "laptop" | "phone" | "vehicle" | "security_card" | "access_key" | "other";
  serialNumber: string;
  assignedToEmployeeId?: string | null;
  assignedToEmployeeName?: string;
  assignedDate?: string;
  status: "available" | "assigned" | "under_maintenance" | "retired";
}

export interface CompanyDocument {
  id: string;
  titleAr: string;
  titleEn: string;
  category: "policy" | "regulation" | "handbook" | "form" | "announcement";
  version: string;
  expiryDate?: string;
  fileUrl: string;
  visibilityScope: "all" | "subsidiary" | "department";
  requiresAcknowledgment: boolean;
  acknowledgedCount: number;
}

// ----------------------------------------------------------------------------
// M17, M18, M19: Reports, Accounting, Audit & Notifications
// ----------------------------------------------------------------------------
export interface AuditLogEntry {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  entityName?: string;
  timestamp: string;
  ipAddress?: string;
  changesSummary?: string;
}

export interface AppNotification {
  id: string;
  recipientId: string;
  titleAr: string;
  titleEn: string;
  messageAr: string;
  messageEn: string;
  type: "request" | "leave" | "attendance" | "payroll" | "document" | "general";
  actionUrl?: string;
  isRead: boolean;
  createdAt: string;
}

export interface AccountingJournalEntry {
  id: string;
  journalNo: string;
  sourceType: "payroll_run" | "expense_report" | "eosb_settlement";
  sourceReference: string;
  date: string;
  totalDebit: number;
  totalCredit: number;
  status: "draft" | "posted" | "failed" | "synced_to_erp";
  erpIntegrationType?: "odoo" | "sap" | "zoho" | "quickbooks";
}
