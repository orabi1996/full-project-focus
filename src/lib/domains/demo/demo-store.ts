import {
  mockCompany,
  mockCostCenters,
  mockSubsidiaries,
  mockOrgUnits,
  mockWorkLocations,
  mockEmployees,
  mockRoles,
  mockApprovalChains,
  mockDelegationRules,
  mockRequests,
  mockLeaveTypes,
  mockEmployeeLeaveBalances,
  mockShifts,
  mockAttendanceRecords,
  mockOvertimeRecords,
  mockAttendanceCorrectionRequests,
  mockPayrollGroups,
  mockPayrollRuns,
  mockPayrollDetails,
  mockLoans,
  mockSettlements,
  mockExpenseCategories,
  mockExpenseClaims,
  mockPerformanceCycles,
  mockEvaluations,
  mockWorkforcePlans,
  mockJobOpenings,
  mockCandidates,
  mockJobOffers,
  mockJobPositions,
  mockAssets,
  mockCompanyDocs,
  mockAuditLogs,
  mockNotifications,
  mockAccountingJournals,
} from "../../mock-data/seed-data";
import type {
  CompanyProfile,
  CostCenter,
  Subsidiary,
  OrgUnit,
  WorkLocation,
  Employee,
  RoleDefinition,
  ApprovalChain,
  DelegationRule,
  ServiceRequest,
  LeaveTypePolicy,
  EmployeeLeaveBalance,
  ShiftDefinition,
  DailyAttendanceRecord,
  OvertimeRecord,
  AttendanceCorrectionRequest,
  PayrollGroup,
  PayrollRun,
  EmployeePayrollDetail,
  LoanRecord,
  FinalSettlementRecord,
  ExpenseCategory,
  ExpenseClaim,
  PerformanceCycle,
  EvaluationRecord,
  WorkforcePlan,
  JobOpening,
  Candidate,
  JobOffer,
  JobPosition,
  HardwareAsset,
  CompanyDocument,
  AuditLogEntry,
  AppNotification,
  AccountingJournalEntry,
} from "../../../types";

type Listener = () => void;

class DemoStore {
  company: CompanyProfile = { ...mockCompany };
  costCenters: CostCenter[] = [...mockCostCenters];
  subsidiaries: Subsidiary[] = [...mockSubsidiaries];
  orgUnits: OrgUnit[] = [...mockOrgUnits];
  workLocations: WorkLocation[] = [...mockWorkLocations];
  employees: Employee[] = [...mockEmployees];
  roles: RoleDefinition[] = [...mockRoles];
  approvalChains: ApprovalChain[] = [...mockApprovalChains];
  delegationRules: DelegationRule[] = [...mockDelegationRules];
  requests: ServiceRequest[] = [...mockRequests];
  leaveTypes: LeaveTypePolicy[] = [...mockLeaveTypes];
  leaveBalances: EmployeeLeaveBalance[] = [...mockEmployeeLeaveBalances];
  shifts: ShiftDefinition[] = [...mockShifts];
  attendanceRecords: DailyAttendanceRecord[] = [...mockAttendanceRecords];
  overtimeRecords: OvertimeRecord[] = [...mockOvertimeRecords];
  attendanceCorrections: AttendanceCorrectionRequest[] = [...mockAttendanceCorrectionRequests];
  payrollGroups: PayrollGroup[] = [...mockPayrollGroups];
  payrollRuns: PayrollRun[] = [...mockPayrollRuns];
  payrollDetails: EmployeePayrollDetail[] = [...mockPayrollDetails];
  loans: LoanRecord[] = [...mockLoans];
  settlements: FinalSettlementRecord[] = [...mockSettlements];
  expenseCategories: ExpenseCategory[] = [...mockExpenseCategories];
  expenseClaims: ExpenseClaim[] = [...mockExpenseClaims];
  performanceCycles: PerformanceCycle[] = [...mockPerformanceCycles];
  evaluations: EvaluationRecord[] = [...mockEvaluations];
  workforcePlans: WorkforcePlan[] = [...mockWorkforcePlans];
  jobOpenings: JobOpening[] = [...mockJobOpenings];
  candidates: Candidate[] = [...mockCandidates];
  jobOffers: JobOffer[] = [...mockJobOffers];
  jobPositions: JobPosition[] = [...mockJobPositions];
  assets: HardwareAsset[] = [...mockAssets];
  companyDocs: CompanyDocument[] = [...mockCompanyDocs];
  auditLogs: AuditLogEntry[] = [...mockAuditLogs];
  notifications: AppNotification[] = [...mockNotifications];
  accountingJournals: AccountingJournalEntry[] = [...mockAccountingJournals];

  private listeners: Set<Listener> = new Set();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    this.listeners.forEach((listener) => listener());
  }

  reset() {
    this.company = { ...mockCompany };
    this.costCenters = [...mockCostCenters];
    this.subsidiaries = [...mockSubsidiaries];
    this.orgUnits = [...mockOrgUnits];
    this.workLocations = [...mockWorkLocations];
    this.employees = [...mockEmployees];
    this.roles = [...mockRoles];
    this.approvalChains = [...mockApprovalChains];
    this.delegationRules = [...mockDelegationRules];
    this.requests = [...mockRequests];
    this.leaveTypes = [...mockLeaveTypes];
    this.leaveBalances = [...mockEmployeeLeaveBalances];
    this.shifts = [...mockShifts];
    this.attendanceRecords = [...mockAttendanceRecords];
    this.overtimeRecords = [...mockOvertimeRecords];
    this.attendanceCorrections = [...mockAttendanceCorrectionRequests];
    this.payrollGroups = [...mockPayrollGroups];
    this.payrollRuns = [...mockPayrollRuns];
    this.payrollDetails = [...mockPayrollDetails];
    this.loans = [...mockLoans];
    this.settlements = [...mockSettlements];
    this.expenseCategories = [...mockExpenseCategories];
    this.expenseClaims = [...mockExpenseClaims];
    this.performanceCycles = [...mockPerformanceCycles];
    this.evaluations = [...mockEvaluations];
    this.workforcePlans = [...mockWorkforcePlans];
    this.jobOpenings = [...mockJobOpenings];
    this.candidates = [...mockCandidates];
    this.jobOffers = [...mockJobOffers];
    this.jobPositions = [...mockJobPositions];
    this.assets = [...mockAssets];
    this.companyDocs = [...mockCompanyDocs];
    this.auditLogs = [...mockAuditLogs];
    this.notifications = [...mockNotifications];
    this.accountingJournals = [...mockAccountingJournals];
    this.notify();
  }
}

export const demoStore = new DemoStore();

import { useSyncExternalStore } from "react";

export function useDemoStore<T>(selector: (store: DemoStore) => T): T {
  return useSyncExternalStore(
    (onStoreChange) => demoStore.subscribe(onStoreChange),
    () => selector(demoStore),
    () => selector(demoStore),
  );
}
