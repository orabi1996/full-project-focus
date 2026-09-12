import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type {
  Language,
  Direction,
  DataScope,
  UserRole,
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
  ScheduleAssignment,
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
  CandidateStage,
  RequestCategory,
} from "../../types";
import {
  type PermissionGroup,
  type ScreenActionPermissions,
  INITIAL_ENTERPRISE_GROUPS,
} from "../auth/rbac-definitions";
import {
  adjustLeaveBalanceRecord,
  acknowledgeDocumentRecord,
  assignAssetRecord,
  createApprovalChainRecord,
  createAssetRecord,
  createAuditEventRecord,
  createCandidateRecord,
  createCompanyDocumentRecord,
  createCostCenterRecord,
  createEvaluationRecord,
  createExpenseCategoryRecord,
  createExpenseClaimRecord,
  createJobOfferRecord,
  createJobOpeningRecord,
  createJobPositionRecord,
  createLeaveTypeRecord,
  createOrganizationUnitRecord,
  createPayrollRunWithDetailsRecord,
  createPerformanceCycleRecord,
  createRoleDefinitionRecord,
  createSettlementRecord,
  createShiftRecord,
  createSubsidiaryRecord,
  createWorkLocationRecord,
  fetchOperationalSnapshot,
  markNotificationReadRecord,
  returnAssetRecord,
  deleteCostCenterRecord,
  deleteJobPositionRecord,
  deleteOrganizationUnitRecord,
  deleteSubsidiaryRecord,
  deleteWorkLocationRecord,
  updateCandidateRecord,
  updateCompanyRecord,
  updateCostCenterRecord,
  updateJobPositionRecord,
  updateOrganizationUnitRecord,
  updatePayrollRunStatusRecord,
  updateSubsidiaryRecord,
  updateWorkLocationRecord,
} from "../data/operational-repository";
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
} from "../mock-data/seed-data";
import { getTranslation } from "../translations";
import { useAuth } from "../auth/AuthContext";
import {
  createEmployeeRecord,
  createRequestRecord,
  fetchCoreSnapshot,
  recordAttendance,
  updateEmployeeRecord,
  updateRequestDecision,
} from "../data/hrms-repository";
import { calculateEmployeePayroll } from "../utils/payroll-calculator";
import { runPayrollServer, updatePayrollRunStatusServer } from "../business/payroll.functions";
import { createSettlementServer } from "../business/settlement.functions";
import { actOnRequestServer } from "../business/approvals.functions";
import { processAttendanceServer } from "../business/attendance.functions";
import { accrueLeaveBalancesServer } from "../business/leave.functions";
import { toast } from "sonner";
import { executeReliableMutation } from "../data/reliable-mutation";

interface AppContextType {
  // Localization
  language: Language;
  direction: Direction;
  t: ReturnType<typeof getTranslation>;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;

  // Active User / Role
  currentRole: UserRole;
  setCurrentRole: (role: UserRole) => void;
  currentUser: Employee;
  dataMode: "demo" | "live";
  isDataLoading: boolean;
  dataError: string | null;
  isSaving: boolean;
  pendingMutationCount: number;
  lastSavedAt: string | null;
  refreshCoreData: () => Promise<void>;

  // State Collections
  company: CompanyProfile;
  subsidiaries: Subsidiary[];
  orgUnits: OrgUnit[];
  workLocations: WorkLocation[];
  costCenters: CostCenter[];
  jobPositions: JobPosition[];
  employees: Employee[];
  roles: RoleDefinition[];
  approvalChains: ApprovalChain[];
  delegationRules: DelegationRule[];
  requests: ServiceRequest[];
  leaveTypes: LeaveTypePolicy[];
  leaveBalances: EmployeeLeaveBalance[];
  shifts: ShiftDefinition[];
  attendanceRecords: DailyAttendanceRecord[];
  overtimeRecords: OvertimeRecord[];
  attendanceCorrections: AttendanceCorrectionRequest[];
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

  // Mutators & Operations
  activeEmployeeModalId: string | null;
  openEmployeeProfile: (employeeOrId: string | Employee) => void;
  closeEmployeeProfile: () => void;
  addEmployee: (emp: Omit<Employee, "id" | "completionScore">) => Promise<boolean>;
  updateEmployee: (id: string, updates: Partial<Employee>) => Promise<boolean>;
  updateCompany: (profile: CompanyProfile) => Promise<boolean>;
  addOrgUnit: (unit: Omit<OrgUnit, "id" | "employeeCount">) => Promise<boolean>;
  updateOrgUnit: (id: string, unit: Omit<OrgUnit, "id" | "employeeCount">) => Promise<boolean>;
  deleteOrgUnit: (id: string) => Promise<boolean>;
  addSubsidiary: (subsidiary: Omit<Subsidiary, "id" | "employeeCount">) => Promise<boolean>;
  updateSubsidiary: (
    id: string,
    subsidiary: Omit<Subsidiary, "id" | "employeeCount">,
  ) => Promise<boolean>;
  deleteSubsidiary: (id: string) => Promise<boolean>;
  addWorkLocation: (location: Omit<WorkLocation, "id">) => Promise<boolean>;
  updateWorkLocation: (id: string, location: Omit<WorkLocation, "id">) => Promise<boolean>;
  deleteWorkLocation: (id: string) => Promise<boolean>;
  addCostCenter: (
    center: Omit<CostCenter, "id" | "employeeCount" | "managerName">,
  ) => Promise<boolean>;
  updateCostCenter: (
    id: string,
    center: Omit<CostCenter, "id" | "employeeCount" | "managerName">,
  ) => Promise<boolean>;
  deleteCostCenter: (id: string) => Promise<boolean>;
  addJobPosition: (position: Omit<JobPosition, "id" | "filledHeadcount">) => Promise<boolean>;
  updateJobPosition: (
    id: string,
    position: Omit<JobPosition, "id" | "filledHeadcount">,
  ) => Promise<boolean>;
  deleteJobPosition: (id: string) => Promise<boolean>;
  addRole: (
    role: Omit<RoleDefinition, "id" | "userCount" | "permissions"> & { dataScope: DataScope },
  ) => RoleDefinition;

  // Requests & Workflow
  submitRequest: (req: {
    type: RequestCategory;
    payload: ServiceRequest["payload"];
  }) => Promise<boolean>;
  approveRequest: (requestId: string, note?: string) => Promise<boolean>;
  rejectRequest: (requestId: string, note?: string) => Promise<boolean>;
  returnRequest: (requestId: string, note?: string) => Promise<boolean>;
  addApprovalChain: (chain: Omit<ApprovalChain, "id">) => void;
  deleteApprovalChain: (id: string) => void;
  addDelegationRule: (rule: Omit<DelegationRule, "id" | "createdAt" | "status">) => void;
  revokeDelegationRule: (id: string) => void;

  // Leaves
  applyLeave: (payload: {
    leaveTypeId: string;
    startDate: string;
    endDate: string;
    totalDays: number;
    reason: string;
  }) => Promise<boolean>;
  addLeaveType: (input: { nameAr: string; maxDaysPerYear: number; isPaid: boolean }) => void;
  adjustLeaveBalance: (
    employeeId: string,
    leaveTypeId: string,
    days: number,
    reason: string,
  ) => void;
  addShift: (shift: Omit<ShiftDefinition, "id">) => void;

  // Attendance
  punchInOut: (
    type: "in" | "out",
    coords?: { lat: number; lng: number },
  ) => Promise<{ success: boolean; message: string; geofenceValid: boolean }>;
  submitAttendanceCorrection: (payload: {
    workDate: string;
    correctIn?: string;
    correctOut?: string;
    reason: string;
  }) => void;
  submitOvertimeRequest: (record: Omit<OvertimeRecord, "id" | "status" | "createdAt">) => void;
  approveOvertimeRequest: (id: string) => void;
  rejectOvertimeRequest: (id: string) => void;
  approveAttendanceCorrection: (id: string) => void;
  rejectAttendanceCorrection: (id: string) => void;

  // Payroll & Loans
  processPayrollRun: (groupId: string, year: number, month: number) => void;
  lockAndConfirmPayrollRun: (runId: string) => void;
  markPayrollAsPaid: (runId: string) => void;
  processAttendance: (fromDate: string, toDate: string) => void;
  accrueLeaveBalances: (year: number) => void;
  createLoan: (payload: {
    principalAmount: number;
    monthlyInstallment: number;
    totalInstallments: number;
    reason: string;
  }) => void;
  createSettlement: (settlement: Omit<FinalSettlementRecord, "id">) => void;

  // Expenses
  addExpenseClaim: (claim: Omit<ExpenseClaim, "id" | "status" | "policyWarningTriggered">) => void;
  addExpenseCategory: (input: { nameAr: string; warningLimit: number; blockLimit: number }) => void;

  // Performance
  addPerformanceCycle: (cycle: Omit<PerformanceCycle, "id">) => void;
  addEvaluation: (evaluation: Omit<EvaluationRecord, "id">) => void;

  // ATS / Recruitment
  addJobOpening: (job: Omit<JobOpening, "id">) => void;
  addCandidate: (candidate: Omit<Candidate, "id">) => void;
  updateCandidateScore: (candidateId: string, score: number) => void;
  moveCandidateStage: (candidateId: string, newStage: CandidateStage) => void;
  sendJobOffer: (offer: Omit<JobOffer, "id" | "status">) => void;

  // Assets & Docs
  addAsset: (asset: Omit<HardwareAsset, "id">) => void;
  addCompanyDocument: (document: Omit<CompanyDocument, "id" | "acknowledgedCount">) => void;
  assignAsset: (assetId: string, employeeId: string) => void;
  returnAsset: (assetId: string) => void;
  acknowledgeDocument: (docId: string) => void;

  // Notifications & Audit
  markNotificationRead: (id: string) => void;
  logAuditEvent: (
    action: string,
    entityType: string,
    entityId: string,
    entityName: string,
    changesSummary: string,
  ) => void;

  // RBAC Permission Groups & User Overrides
  permissionGroups: PermissionGroup[];
  userPermissionOverrides: Record<string, Record<string, ScreenActionPermissions>>;
  createPermissionGroup: (group: Omit<PermissionGroup, "id">) => PermissionGroup;
  updatePermissionGroup: (groupId: string, updates: Partial<PermissionGroup>) => void;
  deletePermissionGroup: (groupId: string) => boolean;
  addUsersToGroup: (groupId: string, userIds: string[]) => void;
  removeUserFromGroup: (groupId: string, userId: string) => void;
  updateUserScreenPermissions: (
    userId: string,
    screenId: string,
    actions: Partial<ScreenActionPermissions>,
  ) => void;
  resetUserScreenPermissions: (userId: string) => void;
}

// Keep a single context instance across HMR module re-evaluations, otherwise a
// hot-reloaded provider and an older consumer end up on two different contexts
// and `useApp` throws "must be used within an AppProvider".
const globalScope = globalThis as unknown as {
  __hrmsAppContext?: React.Context<AppContextType | null>;
};
const AppContext: React.Context<AppContextType | null> =
  globalScope.__hrmsAppContext ?? createContext<AppContextType | null>(null);
globalScope.__hrmsAppContext = AppContext;

const EMPTY_COMPANY: CompanyProfile = {
  id: "",
  legalNameAr: "",
  legalNameEn: "",
  taxNumber: "",
  crNumber: "",
  country: "",
  currency: "SAR",
  timezone: "Asia/Riyadh",
  headquartersAddress: "",
  fiscalYearStartMonth: 1,
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, role: authenticatedRole, isDemo } = useAuth();
  const [language, setLanguageState] = useState<Language>("ar");
  const direction: Direction = language === "ar" ? "rtl" : "ltr";
  const t = getTranslation(language);

  // Sync HTML dir and lang tags
  useEffect(() => {
    document.documentElement.dir = direction;
    document.documentElement.lang = language;
  }, [language, direction]);

  const [simulatedRole, setSimulatedRole] = useState<UserRole>("super_admin");
  const mappedAuthenticatedRole: UserRole =
    authenticatedRole === "org_admin" ? "super_admin" : authenticatedRole;
  const currentRole = isDemo ? simulatedRole : mappedAuthenticatedRole;
  const setCurrentRole = (role: UserRole) => {
    if (isDemo) setSimulatedRole(role);
  };
  const dataMode: "demo" | "live" = session && !isDemo ? "live" : "demo";
  const [isDataLoading, setIsDataLoading] = useState(!isDemo);
  const [dataError, setDataError] = useState<string | null>(null);
  const [pendingMutationCount, setPendingMutationCount] = useState(0);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const activeMutationKeys = useRef(new Set<string>());
  const isSaving = pendingMutationCount > 0;

  const permissionStorageScope = isDemo ? "demo" : (session?.user.id ?? "signed-out");

  // State variables
  const [company, setCompany] = useState<CompanyProfile>(isDemo ? mockCompany : EMPTY_COMPANY);
  const [subsidiaries, setSubsidiaries] = useState<Subsidiary[]>(isDemo ? mockSubsidiaries : []);
  const [orgUnits, setOrgUnits] = useState<OrgUnit[]>(isDemo ? mockOrgUnits : []);
  const [workLocations, setWorkLocations] = useState<WorkLocation[]>(
    isDemo ? mockWorkLocations : [],
  );
  const [costCenters, setCostCenters] = useState<CostCenter[]>(isDemo ? mockCostCenters : []);
  const [jobPositions, setJobPositions] = useState<JobPosition[]>(isDemo ? mockJobPositions : []);
  const [employees, setEmployees] = useState<Employee[]>(isDemo ? mockEmployees : []);
  const [roles, setRoles] = useState<RoleDefinition[]>(isDemo ? mockRoles : []);
  const [permissionGroups, setPermissionGroups] = useState<PermissionGroup[]>(() => {
    try {
      const stored = localStorage.getItem(`focus_hrms_permission_groups:${permissionStorageScope}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // Storage may be unavailable or contain an invalid cached value.
    }
    return INITIAL_ENTERPRISE_GROUPS;
  });

  const [userPermissionOverrides, setUserPermissionOverrides] = useState<
    Record<string, Record<string, ScreenActionPermissions>>
  >(() => {
    try {
      const stored = localStorage.getItem(
        `focus_hrms_user_perm_overrides:${permissionStorageScope}`,
      );
      if (stored) return JSON.parse(stored);
    } catch {
      // Storage may be unavailable or contain an invalid cached value.
    }
    return {};
  });

  useEffect(() => {
    try {
      localStorage.setItem(
        `focus_hrms_permission_groups:${permissionStorageScope}`,
        JSON.stringify(permissionGroups),
      );
    } catch {
      // Storage may be unavailable or contain an invalid cached value.
    }
  }, [permissionGroups, permissionStorageScope]);

  useEffect(() => {
    try {
      localStorage.setItem(
        `focus_hrms_user_perm_overrides:${permissionStorageScope}`,
        JSON.stringify(userPermissionOverrides),
      );
    } catch {
      // Storage may be unavailable or contain an invalid cached value.
    }
  }, [userPermissionOverrides, permissionStorageScope]);
  const [approvalChains, setApprovalChains] = useState<ApprovalChain[]>(
    isDemo ? mockApprovalChains : [],
  );
  const [delegationRules, setDelegationRules] = useState<DelegationRule[]>(
    isDemo ? mockDelegationRules : [],
  );
  const [requests, setRequests] = useState<ServiceRequest[]>(isDemo ? mockRequests : []);
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypePolicy[]>(isDemo ? mockLeaveTypes : []);
  const [leaveBalances, setLeaveBalances] = useState<EmployeeLeaveBalance[]>(
    isDemo ? mockEmployeeLeaveBalances : [],
  );
  const [shifts, setShifts] = useState<ShiftDefinition[]>(isDemo ? mockShifts : []);
  const [attendanceRecords, setAttendanceRecords] = useState<DailyAttendanceRecord[]>(
    isDemo ? mockAttendanceRecords : [],
  );
  const [overtimeRecords, setOvertimeRecords] = useState<OvertimeRecord[]>(
    isDemo ? mockOvertimeRecords : [],
  );
  const [attendanceCorrections, setAttendanceCorrections] = useState<AttendanceCorrectionRequest[]>(
    isDemo ? mockAttendanceCorrectionRequests : [],
  );
  const [payrollGroups, setPayrollGroups] = useState<PayrollGroup[]>(
    isDemo ? mockPayrollGroups : [],
  );
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>(isDemo ? mockPayrollRuns : []);
  const [payrollDetails, setPayrollDetails] = useState<EmployeePayrollDetail[]>(
    isDemo ? mockPayrollDetails : [],
  );
  const [loans, setLoans] = useState<LoanRecord[]>(isDemo ? mockLoans : []);
  const [settlements, setSettlements] = useState<FinalSettlementRecord[]>(
    isDemo ? mockSettlements : [],
  );
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>(
    isDemo ? mockExpenseCategories : [],
  );
  const [expenseClaims, setExpenseClaims] = useState<ExpenseClaim[]>(
    isDemo ? mockExpenseClaims : [],
  );
  const [performanceCycles, setPerformanceCycles] = useState<PerformanceCycle[]>(
    isDemo ? mockPerformanceCycles : [],
  );
  const [evaluations, setEvaluations] = useState<EvaluationRecord[]>(isDemo ? mockEvaluations : []);
  const [workforcePlans, setWorkforcePlans] = useState<WorkforcePlan[]>(
    isDemo ? mockWorkforcePlans : [],
  );
  const [jobOpenings, setJobOpenings] = useState<JobOpening[]>(isDemo ? mockJobOpenings : []);
  const [candidates, setCandidates] = useState<Candidate[]>(isDemo ? mockCandidates : []);
  const [jobOffers, setJobOffers] = useState<JobOffer[]>(isDemo ? mockJobOffers : []);
  const [assets, setAssets] = useState<HardwareAsset[]>(isDemo ? mockAssets : []);
  const [companyDocs, setCompanyDocs] = useState<CompanyDocument[]>(isDemo ? mockCompanyDocs : []);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(isDemo ? mockAuditLogs : []);
  const [notifications, setNotifications] = useState<AppNotification[]>(
    isDemo ? mockNotifications : [],
  );
  const [accountingJournals, setAccountingJournals] = useState<AccountingJournalEntry[]>(
    isDemo ? mockAccountingJournals : [],
  );
  const [activeEmployeeModalId, setActiveEmployeeModalId] = useState<string | null>(null);

  const openEmployeeProfile = useCallback((employeeOrId: string | Employee) => {
    const id = typeof employeeOrId === "string" ? employeeOrId : employeeOrId.id;
    setActiveEmployeeModalId(id);
    if (typeof window !== "undefined" && window.location.hash !== "#employees") {
      window.location.hash = "#employees";
    }
  }, []);

  const closeEmployeeProfile = useCallback(() => {
    setActiveEmployeeModalId(null);
  }, []);

  const refreshVersion = useRef(0);
  useEffect(
    () => () => {
      refreshVersion.current += 1;
    },
    [],
  );

  const refreshCoreData = useCallback(async () => {
    if (!session || isDemo) return;
    const version = ++refreshVersion.current;
    setIsDataLoading(true);
    setDataError(null);
    try {
      const snapshot = await fetchCoreSnapshot();
      const operational = await fetchOperationalSnapshot(snapshot.employees, snapshot.orgUnits);
      if (version !== refreshVersion.current) return;
      setEmployees(snapshot.employees);
      setOrgUnits(snapshot.orgUnits);
      setAttendanceRecords(snapshot.attendanceRecords);
      setRequests(snapshot.requests);
      setCompany(operational.company ?? EMPTY_COMPANY);
      setSubsidiaries(operational.subsidiaries);
      setWorkLocations(operational.workLocations);
      setCostCenters(operational.costCenters);
      setJobPositions(operational.jobPositions);
      setRoles(operational.roles);
      setApprovalChains(operational.approvalChains);
      setLeaveTypes(operational.leaveTypes);
      setLeaveBalances(operational.leaveBalances);
      setShifts(operational.shifts);
      setPayrollGroups(operational.payrollGroups);
      setPayrollRuns(operational.payrollRuns);
      setPayrollDetails(operational.payrollDetails);
      setLoans(operational.loans);
      setSettlements(operational.settlements);
      setExpenseCategories(operational.expenseCategories);
      setExpenseClaims(operational.expenseClaims);
      setPerformanceCycles(operational.performanceCycles);
      setEvaluations(operational.evaluations);
      setWorkforcePlans(operational.workforcePlans);
      setJobOpenings(operational.jobOpenings);
      setCandidates(operational.candidates);
      setJobOffers(operational.jobOffers);
      setAssets(operational.assets);
      setCompanyDocs(operational.companyDocs);
      setAuditLogs(operational.auditLogs);
      setNotifications(operational.notifications);
      setAccountingJournals(operational.accountingJournals);
    } catch (error) {
      const normalizedError =
        error instanceof Error ? error : new Error("تعذر تحميل بيانات النظام");
      if (version === refreshVersion.current) setDataError(normalizedError.message);
      throw normalizedError;
    } finally {
      if (version === refreshVersion.current) setIsDataLoading(false);
    }
  }, [session, isDemo]);

  useEffect(() => {
    if (dataMode === "live") {
      void refreshCoreData().catch(() => undefined);
      return;
    }
    if (!isDemo) return;
    setEmployees(mockEmployees);
    setCompany(mockCompany);
    setSubsidiaries(mockSubsidiaries);
    setOrgUnits(mockOrgUnits);
    setWorkLocations(mockWorkLocations);
    setCostCenters(mockCostCenters);
    setJobPositions(mockJobPositions);
    setRoles(mockRoles);
    setApprovalChains(mockApprovalChains);
    setAttendanceRecords(mockAttendanceRecords);
    setRequests(mockRequests);
    setLeaveTypes(mockLeaveTypes);
    setLeaveBalances(mockEmployeeLeaveBalances);
    setShifts(mockShifts);
    setPayrollGroups(mockPayrollGroups);
    setPayrollRuns(mockPayrollRuns);
    setPayrollDetails(mockPayrollDetails);
    setLoans(mockLoans);
    setSettlements(mockSettlements);
    setExpenseCategories(mockExpenseCategories);
    setExpenseClaims(mockExpenseClaims);
    setPerformanceCycles(mockPerformanceCycles);
    setEvaluations(mockEvaluations);
    setWorkforcePlans(mockWorkforcePlans);
    setJobOpenings(mockJobOpenings);
    setCandidates(mockCandidates);
    setJobOffers(mockJobOffers);
    setAssets(mockAssets);
    setCompanyDocs(mockCompanyDocs);
    setAuditLogs(mockAuditLogs);
    setNotifications(mockNotifications);
    setAccountingJournals(mockAccountingJournals);
    setDataError(null);
  }, [dataMode, refreshCoreData, isDemo]);

  // Active user representation based on role and auth identity
  const currentUser: Employee =
    (dataMode === "live"
      ? employees.find((e) => session?.user?.id && e.customFields?.userId === session.user.id)
      : employees.find((e) => {
          if (
            session?.user?.email &&
            e.email &&
            e.email.toLowerCase() === session.user.email.toLowerCase()
          ) {
            return true;
          }
          if (currentRole === "super_admin" || currentRole === "hr_manager")
            return e.id === "emp-04"; // Sara (HR Lead)
          if (currentRole === "payroll_officer" || currentRole === "finance_officer")
            return e.id === "emp-02"; // Noura (Finance)
          if (currentRole === "line_manager") return e.id === "emp-01"; // Khalid (Engineering Manager)
          return e.id === "emp-05"; // Mohammed (Employee ESS)
        })) ||
    (dataMode === "demo"
      ? employees[0] || mockEmployees[0]
      : {
          id: "",
          employeeNo: "",
          firstNameAr: "حساب غير مرتبط بموظف",
          lastNameAr: "",
          firstNameEn: "Unlinked account",
          lastNameEn: "",
          email: session?.user?.email ?? "",
          phone: "",
          nationalIdOrIqama: "",
          nationality: "",
          gender: "male",
          birthDate: "",
          maritalStatus: "single",
          subsidiaryId: "",
          departmentId: "",
          jobTitleAr: "",
          jobTitleEn: "",
          workLocationId: "",
          hireDate: "",
          contractType: "full_time",
          status: "draft",
          completionScore: 0,
          basicSalary: 0,
          totalSalary: 0,
        });

  const setLanguage = (lang: Language) => setLanguageState(lang);
  const toggleLanguage = () => setLanguageState((prev) => (prev === "ar" ? "en" : "ar"));

  const persistLiveChange = (operation: () => Promise<void>, mutationKey?: string) => {
    if (dataMode === "live" && mutationKey && activeMutationKeys.current.has(mutationKey)) {
      const error = new Error("عملية حفظ مماثلة قيد التنفيذ");
      toast.info("عملية الحفظ نفسها قيد التنفيذ بالفعل");
      return Promise.resolve({ ok: false, error });
    }

    if (dataMode === "live" && mutationKey) activeMutationKeys.current.add(mutationKey);
    setDataError(null);
    return executeReliableMutation({
      mode: dataMode,
      operation,
      refresh: refreshCoreData,
      onPendingChange: (pending) =>
        setPendingMutationCount((count) => Math.max(0, count + (pending ? 1 : -1))),
      onCommitted: () => {
        if (dataMode === "live") setLastSavedAt(new Date().toISOString());
      },
      onRejected: (error) => {
        setDataError(error.message);
        toast.error("تعذر حفظ التغييرات. تمت استعادة آخر بيانات مؤكدة من الخادم.");
      },
    }).finally(() => {
      if (mutationKey) activeMutationKeys.current.delete(mutationKey);
    });
  };

  const logAuditEvent = (
    action: string,
    entityType: string,
    entityId: string,
    entityName: string,
    changesSummary: string,
  ) => {
    const newLog: AuditLogEntry = {
      id: `aud-${Date.now()}`,
      actorId: currentUser.id,
      actorName: `${currentUser.firstNameAr} ${currentUser.lastNameAr}`,
      actorRole: currentRole,
      action,
      entityType,
      entityId,
      entityName,
      timestamp: new Date().toISOString(),
      changesSummary,
    };
    setAuditLogs((prev) => [newLog, ...prev]);
    if (dataMode === "live") {
      void createAuditEventRecord(newLog).catch((error) =>
        setDataError(error instanceof Error ? error.message : "تعذر تسجيل حدث التدقيق"),
      );
    }
  };

  const addEmployee = (empData: Omit<Employee, "id" | "completionScore">) => {
    const newId = `emp-${Date.now()}`;
    const newEmployee: Employee = {
      ...empData,
      id: newId,
      completionScore: 90,
    };
    setEmployees((prev) => [newEmployee, ...prev]);
    return persistLiveChange(
      () => createEmployeeRecord(newEmployee),
      `employee:create:${newEmployee.email.toLowerCase()}`,
    ).then(({ ok }) => {
      if (ok) {
        logAuditEvent(
          "إضافة موظف جديد",
          "Employee",
          newId,
          `${empData.firstNameAr} ${empData.lastNameAr}`,
          "تم تسجيل الموظف الجديد بنجاح في المنظومة",
        );
      }
      return ok;
    });
  };

  const updateEmployee = (id: string, updates: Partial<Employee>) => {
    setEmployees((prev) => prev.map((e) => (e.id === id ? { ...e, ...updates } : e)));
    return persistLiveChange(() => updateEmployeeRecord(id, updates), `employee:update:${id}`).then(
      ({ ok }) => {
        if (ok) {
          logAuditEvent(
            "تحديث بيانات موظف",
            "Employee",
            id,
            id,
            "تم تعديل البيانات الوظيفية أو الشخصية",
          );
        }
        return ok;
      },
    );
  };

  const updateCompany = (profile: CompanyProfile) => {
    setCompany(profile);
    return persistLiveChange(
      () => updateCompanyRecord(profile),
      `company:update:${profile.id}`,
    ).then(({ ok }) => {
      if (ok) {
        logAuditEvent(
          "تحديث بيانات المنشأة",
          "Company",
          profile.id,
          profile.legalNameAr,
          "تم تحديث الملف النظامي وبيانات التواصل للمنشأة",
        );
      }
      return ok;
    });
  };

  const addOrgUnit = (unit: Omit<OrgUnit, "id" | "employeeCount">) => {
    const newUnit: OrgUnit = { ...unit, id: `dept-${Date.now()}`, employeeCount: 0 };
    setOrgUnits((prev) => [newUnit, ...prev]);
    return persistLiveChange(
      () => createOrganizationUnitRecord(unit),
      `org-unit:create:${unit.code}`,
    ).then(({ ok }) => {
      if (ok) {
        logAuditEvent(
          "إضافة وحدة تنظيمية",
          "OrgUnit",
          newUnit.id,
          newUnit.nameAr,
          "تم تحديث الهيكل التنظيمي",
        );
      }
      return ok;
    });
  };

  const updateOrgUnit = (id: string, unit: Omit<OrgUnit, "id" | "employeeCount">) => {
    setOrgUnits((prev) => prev.map((item) => (item.id === id ? { ...item, ...unit } : item)));
    return persistLiveChange(
      () => updateOrganizationUnitRecord(id, unit),
      `org-unit:update:${id}`,
    ).then(({ ok }) => {
      if (ok) {
        logAuditEvent(
          "تحديث وحدة تنظيمية",
          "OrgUnit",
          id,
          unit.nameAr,
          "تم تعديل الوحدة في الهيكل التنظيمي",
        );
      }
      return ok;
    });
  };

  const deleteOrgUnit = (id: string) => {
    const target = orgUnits.find((u) => u.id === id);
    // Unassign employees belonging to this department
    setEmployees((prev) =>
      prev.map((emp) => (emp.departmentId === id ? { ...emp, departmentId: "" } : emp)),
    );
    // Reparent child org units
    setOrgUnits((prev) =>
      prev
        .filter((u) => u.id !== id)
        .map((u) => (u.parentId === id ? { ...u, parentId: target?.parentId ?? null } : u)),
    );
    return persistLiveChange(() => deleteOrganizationUnitRecord(id), `org-unit:delete:${id}`).then(
      ({ ok }) => {
        if (ok && target) {
          logAuditEvent(
            "حذف وحدة تنظيمية",
            "OrgUnit",
            id,
            target.nameAr,
            "تم إزالة الوحدة من الهيكل التنظيمي وإعادة ربط التبعيات",
          );
        }
        return ok;
      },
    );
  };

  const addSubsidiary = (subsidiary: Omit<Subsidiary, "id" | "employeeCount">) => {
    const newSubsidiary: Subsidiary = { ...subsidiary, id: `sub-${Date.now()}`, employeeCount: 0 };
    setSubsidiaries((prev) => [newSubsidiary, ...prev]);
    return persistLiveChange(
      () => createSubsidiaryRecord(subsidiary),
      `subsidiary:create:${subsidiary.code}`,
    ).then(({ ok }) => {
      if (ok) {
        logAuditEvent(
          "إضافة شركة فرعية",
          "Subsidiary",
          newSubsidiary.id,
          newSubsidiary.nameAr,
          "تم إنشاء الشركة الفرعية",
        );
      }
      return ok;
    });
  };

  const updateSubsidiary = (id: string, subsidiary: Omit<Subsidiary, "id" | "employeeCount">) => {
    setSubsidiaries((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...subsidiary } : item)),
    );
    return persistLiveChange(
      () => updateSubsidiaryRecord(id, subsidiary),
      `subsidiary:update:${id}`,
    ).then(({ ok }) => {
      if (ok) {
        logAuditEvent(
          "تحديث شركة تابعة",
          "Subsidiary",
          id,
          subsidiary.nameAr,
          "تم تعديل بيانات الكيان التابع",
        );
      }
      return ok;
    });
  };

  const deleteSubsidiary = (id: string) => {
    const target = subsidiaries.find((s) => s.id === id);
    // Unassign employees
    setEmployees((prev) =>
      prev.map((emp) => (emp.subsidiaryId === id ? { ...emp, subsidiaryId: "" } : emp)),
    );
    // Unassign org units
    setOrgUnits((prev) =>
      prev.map((u) => (u.subsidiaryId === id ? { ...u, subsidiaryId: null } : u)),
    );
    setSubsidiaries((prev) => prev.filter((s) => s.id !== id));
    return persistLiveChange(() => deleteSubsidiaryRecord(id), `subsidiary:delete:${id}`).then(
      ({ ok }) => {
        if (ok && target) {
          logAuditEvent(
            "حذف شركة تابعة",
            "Subsidiary",
            id,
            target.nameAr,
            "تم إزالة الكيان التابع وتحديث بيانات المنسوبين",
          );
        }
        return ok;
      },
    );
  };

  const addWorkLocation = (location: Omit<WorkLocation, "id">) => {
    const newLocation: WorkLocation = { ...location, id: `loc-${Date.now()}` };
    setWorkLocations((prev) => [newLocation, ...prev]);
    return persistLiveChange(
      () => createWorkLocationRecord(location),
      `work-location:create:${location.code}`,
    ).then(({ ok }) => {
      if (ok) {
        logAuditEvent(
          "إضافة موقع عمل",
          "WorkLocation",
          newLocation.id,
          newLocation.nameAr,
          "تم إعداد الموقع والسياج الجغرافي",
        );
      }
      return ok;
    });
  };

  const updateWorkLocation = (id: string, location: Omit<WorkLocation, "id">) => {
    setWorkLocations((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...location } : item)),
    );
    return persistLiveChange(
      () => updateWorkLocationRecord(id, location),
      `work-location:update:${id}`,
    ).then(({ ok }) => {
      if (ok) {
        logAuditEvent(
          "تحديث موقع عمل",
          "WorkLocation",
          id,
          location.nameAr,
          "تم تعديل بيانات الموقع والسياج الجغرافي",
        );
      }
      return ok;
    });
  };

  const deleteWorkLocation = (id: string) => {
    const target = workLocations.find((l) => l.id === id);
    const fallbackLocationId = workLocations.find((l) => l.id !== id)?.id || "";
    // Reassign employees to fallback location
    setEmployees((prev) =>
      prev.map((emp) =>
        emp.workLocationId === id ? { ...emp, workLocationId: fallbackLocationId } : emp,
      ),
    );
    setWorkLocations((prev) => prev.filter((l) => l.id !== id));
    return persistLiveChange(() => deleteWorkLocationRecord(id), `work-location:delete:${id}`).then(
      ({ ok }) => {
        if (ok && target) {
          logAuditEvent(
            "حذف موقع عمل",
            "WorkLocation",
            id,
            target.nameAr,
            "تم إزالة الموقع الجغرافي وإعادة توجيه الموظفين",
          );
        }
        return ok;
      },
    );
  };

  const addCostCenter = (center: Omit<CostCenter, "id" | "employeeCount" | "managerName">) => {
    const manager = employees.find((employee) => employee.id === center.managerEmployeeId);
    const newCenter: CostCenter = {
      ...center,
      id: `cost-${Date.now()}`,
      employeeCount: 0,
      managerName: manager ? `${manager.firstNameAr} ${manager.lastNameAr}` : undefined,
    };
    setCostCenters((prev) => [newCenter, ...prev]);
    return persistLiveChange(
      () => createCostCenterRecord(center),
      `cost-center:create:${center.code}`,
    ).then(({ ok }) => {
      if (ok) {
        logAuditEvent(
          "إضافة مركز تكلفة",
          "CostCenter",
          newCenter.id,
          center.nameAr,
          "تم إنشاء مركز تكلفة تنظيمي",
        );
      }
      return ok;
    });
  };

  const updateCostCenter = (
    id: string,
    center: Omit<CostCenter, "id" | "employeeCount" | "managerName">,
  ) => {
    const manager = employees.find((employee) => employee.id === center.managerEmployeeId);
    setCostCenters((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              ...center,
              managerName: manager ? `${manager.firstNameAr} ${manager.lastNameAr}` : undefined,
            }
          : item,
      ),
    );
    return persistLiveChange(
      () => updateCostCenterRecord(id, center),
      `cost-center:update:${id}`,
    ).then(({ ok }) => {
      if (ok) {
        logAuditEvent("تحديث مركز تكلفة", "CostCenter", id, center.nameAr, "تم تعديل مركز التكلفة");
      }
      return ok;
    });
  };

  const deleteCostCenter = (id: string) => {
    const target = costCenters.find((c) => c.id === id);
    // Unassign org units referencing this cost center
    setOrgUnits((prev) =>
      prev.map((u) => (u.costCenterId === id ? { ...u, costCenterId: null } : u)),
    );
    setCostCenters((prev) => prev.filter((c) => c.id !== id));
    return persistLiveChange(() => deleteCostCenterRecord(id), `cost-center:delete:${id}`).then(
      ({ ok }) => {
        if (ok && target) {
          logAuditEvent(
            "حذف مركز تكلفة",
            "CostCenter",
            id,
            target.nameAr,
            "تم حذف مركز التكلفة من المنظومة",
          );
        }
        return ok;
      },
    );
  };

  const addJobPosition = (position: Omit<JobPosition, "id" | "filledHeadcount">) => {
    const newPosition: JobPosition = {
      ...position,
      id: `position-${Date.now()}`,
      filledHeadcount: 0,
    };
    setJobPositions((prev) => [newPosition, ...prev]);
    return persistLiveChange(
      () => createJobPositionRecord(position),
      `job-position:create:${position.code}`,
    ).then(({ ok }) => {
      if (ok) {
        logAuditEvent(
          "إضافة منصب وظيفي",
          "JobPosition",
          newPosition.id,
          position.titleAr,
          "تم إنشاء منصب داخل الهيكل",
        );
      }
      return ok;
    });
  };

  const updateJobPosition = (id: string, position: Omit<JobPosition, "id" | "filledHeadcount">) => {
    setJobPositions((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...position } : item)),
    );
    return persistLiveChange(
      () => updateJobPositionRecord(id, position),
      `job-position:update:${id}`,
    ).then(({ ok }) => {
      if (ok) {
        logAuditEvent(
          "تحديث منصب وظيفي",
          "JobPosition",
          id,
          position.titleAr,
          "تم تعديل المنصب والعدد المخطط",
        );
      }
      return ok;
    });
  };

  const deleteJobPosition = (id: string) => {
    const target = jobPositions.find((p) => p.id === id);
    setJobPositions((prev) => prev.filter((p) => p.id !== id));
    return persistLiveChange(() => deleteJobPositionRecord(id), `job-position:delete:${id}`).then(
      ({ ok }) => {
        if (ok && target) {
          logAuditEvent(
            "حذف منصب وظيفي",
            "JobPosition",
            id,
            target.titleAr,
            "تم إزالة المنصب من الهيكل التنظيمي",
          );
        }
        return ok;
      },
    );
  };

  const addRole = (
    role: Omit<RoleDefinition, "id" | "userCount" | "permissions"> & { dataScope: DataScope },
  ) => {
    const newRole: RoleDefinition = {
      ...role,
      id: `role-${Date.now()}`,
      userCount: 0,
      permissions: [],
    };
    setRoles((prev) => [newRole, ...prev]);
    persistLiveChange(() => createRoleDefinitionRecord(role));
    logAuditEvent(
      "إنشاء دور مخصص",
      "RoleDefinition",
      newRole.id,
      newRole.nameAr,
      `نطاق البيانات: ${role.dataScope}`,
    );
    return newRole;
  };

  // RBAC Permission Groups & User Overrides Handlers
  const createPermissionGroup = (groupData: Omit<PermissionGroup, "id">) => {
    const newGroup: PermissionGroup = {
      ...groupData,
      id: `grp-${Date.now()}`,
    };
    setPermissionGroups((prev) => [newGroup, ...prev]);
    logAuditEvent(
      "إنشاء مجموعة صلاحيات",
      "PermissionGroup",
      newGroup.id,
      newGroup.nameAr,
      `تم إنشاء المجموعة بنطاق بيانات: ${newGroup.dataScope}`,
    );
    toast.success(`تم إنشاء المجموعة (${newGroup.nameAr}) بنجاح!`);
    return newGroup;
  };

  const updatePermissionGroup = (groupId: string, updates: Partial<PermissionGroup>) => {
    setPermissionGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, ...updates } : g)));
    logAuditEvent(
      "تحديث مجموعة صلاحيات",
      "PermissionGroup",
      groupId,
      updates.nameAr || groupId,
      "تم تحديث إعدادات أو مصفوفة صلاحيات المجموعة",
    );
  };

  const deletePermissionGroup = (groupId: string): boolean => {
    const target = permissionGroups.find((g) => g.id === groupId);
    if (!target) return false;
    if (target.isSystem && target.code === "super_admin") {
      toast.error("لا يمكن حذف مجموعة مشرف النظام الأساسية (System Super Admin).");
      return false;
    }
    setPermissionGroups((prev) => prev.filter((g) => g.id !== groupId));
    logAuditEvent(
      "حذف مجموعة صلاحيات",
      "PermissionGroup",
      groupId,
      target.nameAr,
      "تم حذف المجموعة وإلغاء ارتباط أعضائها",
    );
    toast.success(`تم حذف المجموعة (${target.nameAr}) بنجاح.`);
    return true;
  };

  const addUsersToGroup = (groupId: string, userIds: string[]) => {
    setPermissionGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        const currentSet = new Set(g.memberUserIds);
        userIds.forEach((id) => currentSet.add(id));
        return { ...g, memberUserIds: Array.from(currentSet) };
      }),
    );
    logAuditEvent(
      "تعيين أعضاء في مجموعة",
      "PermissionGroup",
      groupId,
      groupId,
      `تم تعيين ${userIds.length} مستخدم في المجموعة`,
    );
    toast.success(`تم إضافة ${userIds.length} مستخدم إلى المجموعة بنجاح.`);
  };

  const removeUserFromGroup = (groupId: string, userId: string) => {
    setPermissionGroups((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? { ...g, memberUserIds: g.memberUserIds.filter((id) => id !== userId) }
          : g,
      ),
    );
    logAuditEvent(
      "إزالة مستخدم من مجموعة",
      "PermissionGroup",
      groupId,
      groupId,
      `تم استبعاد المستخدم ${userId} من المجموعة`,
    );
    toast.info("تم استبعاد المستخدم من المجموعة بنجاح.");
  };

  const updateUserScreenPermissions = (
    userId: string,
    screenId: string,
    actions: Partial<ScreenActionPermissions>,
  ) => {
    setUserPermissionOverrides((prev) => {
      const userScreens = prev[userId] || {};
      const current = userScreens[screenId] || {
        view: false,
        create: false,
        edit: false,
        delete: false,
        approveExport: false,
      };
      return {
        ...prev,
        [userId]: {
          ...userScreens,
          [screenId]: { ...current, ...actions },
        },
      };
    });
    logAuditEvent(
      "تخصيص صلاحيات شاشة لمستخدم",
      "UserPermission",
      userId,
      userId,
      `تعديل صلاحيات الشاشة: ${screenId}`,
    );
  };

  const resetUserScreenPermissions = (userId: string) => {
    setUserPermissionOverrides((prev) => {
      const copy = { ...prev };
      delete copy[userId];
      return copy;
    });
    logAuditEvent(
      "استعادة الصلاحيات الافتراضية لمستخدم",
      "UserPermission",
      userId,
      userId,
      "تم حذف الاستثناءات المباشرة واستعادة صلاحيات المجموعات الموروثة",
    );
    toast.success("تمت استعادة الصلاحيات الافتراضية الموروثة بنجاح.");
  };

  // Workflow Handlers
  const submitRequest = (req: { type: RequestCategory; payload: ServiceRequest["payload"] }) => {
    if (dataMode === "live" && !currentUser.id) {
      toast.error("يجب ربط الحساب بسجل موظف قبل تقديم الطلبات");
      return Promise.resolve(false);
    }
    const ref = `REQ-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const newReq: ServiceRequest = {
      id: `req-${Date.now()}`,
      referenceNo: ref,
      type: req.type,
      requesterId: currentUser.id,
      requesterName: `${currentUser.firstNameAr} ${currentUser.lastNameAr}`,
      requesterJobTitle: currentUser.jobTitleAr,
      requesterAvatar: currentUser.avatarUrl,
      departmentName: currentUser.departmentName,
      status: "pending_approval",
      currentStepIndex: 1,
      totalSteps: 2,
      currentApproverRole: "المدير المباشر",
      submittedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      payload: req.payload,
      timeline: [
        {
          id: `tl-${Date.now()}`,
          stepNumber: 1,
          actorId: currentUser.id,
          actorName: `${currentUser.firstNameAr} ${currentUser.lastNameAr}`,
          actorRole: "مقدم الطلب",
          action: "submitted",
          note: "تم إرسال الطلب بنجاح إلى مسار الاعتماد",
          timestamp: new Date().toISOString(),
        },
      ],
    };

    setRequests((prev) => [newReq, ...prev]);
    return persistLiveChange(
      () => createRequestRecord(currentUser.id, req.type, req.payload),
      `request:create:${currentUser.id}:${req.type}`,
    ).then(({ ok }) => {
      if (ok) {
        logAuditEvent(
          "تقديم طلب خدمة ذاتية",
          "ServiceRequest",
          newReq.id,
          ref,
          `نوع الطلب: ${req.type}`,
        );
      }
      return ok;
    });
  };

  const approveRequest = (requestId: string, note?: string) => {
    const request = requests.find((item) => item.id === requestId);
    const nextStep = (request?.currentStepIndex ?? 1) + 1;
    const isComplete = nextStep > (request?.totalSteps ?? 1);
    setRequests((prev) =>
      prev.map((r) => {
        if (r.id !== requestId) return r;
        const nextStep = r.currentStepIndex + 1;
        const isComplete = nextStep > r.totalSteps;
        return {
          ...r,
          status: isComplete ? "approved" : "pending_approval",
          currentStepIndex: isComplete ? r.totalSteps : nextStep,
          updatedAt: new Date().toISOString(),
          timeline: [
            ...r.timeline,
            {
              id: `tl-${Date.now()}`,
              stepNumber: r.currentStepIndex,
              actorId: currentUser.id,
              actorName: `${currentUser.firstNameAr} ${currentUser.lastNameAr}`,
              actorRole: currentRole,
              action: "approved",
              note: note || "تمت الموافقة من قبل المسؤول",
              timestamp: new Date().toISOString(),
            },
          ],
        };
      }),
    );
    return persistLiveChange(async () => {
      await actOnRequestServer({ data: { requestId, decision: "approved", note } });
    }, `request:decision:${requestId}`).then(({ ok }) => {
      if (ok) {
        logAuditEvent("اعتماد طلب", "ServiceRequest", requestId, requestId, note || "موافقة");
      }
      return ok;
    });
  };

  const rejectRequest = (requestId: string, note?: string) => {
    setRequests((prev) =>
      prev.map((r) => {
        if (r.id !== requestId) return r;
        return {
          ...r,
          status: "rejected",
          updatedAt: new Date().toISOString(),
          timeline: [
            ...r.timeline,
            {
              id: `tl-${Date.now()}`,
              stepNumber: r.currentStepIndex,
              actorId: currentUser.id,
              actorName: `${currentUser.firstNameAr} ${currentUser.lastNameAr}`,
              actorRole: currentRole,
              action: "rejected",
              note: note || "تم رفض الطلب",
              timestamp: new Date().toISOString(),
            },
          ],
        };
      }),
    );
    return persistLiveChange(async () => {
      await actOnRequestServer({ data: { requestId, decision: "rejected", note } });
    }, `request:decision:${requestId}`).then(({ ok }) => {
      if (ok) logAuditEvent("رفض طلب", "ServiceRequest", requestId, requestId, note || "تم الرفض");
      return ok;
    });
  };

  const returnRequest = (requestId: string, note?: string) => {
    setRequests((prev) =>
      prev.map((r) => {
        if (r.id !== requestId) return r;
        return {
          ...r,
          status: "returned",
          updatedAt: new Date().toISOString(),
          timeline: [
            ...r.timeline,
            {
              id: `tl-${Date.now()}`,
              stepNumber: r.currentStepIndex,
              actorId: currentUser.id,
              actorName: `${currentUser.firstNameAr} ${currentUser.lastNameAr}`,
              actorRole: currentRole,
              action: "returned",
              note: note || "أعيد للموظف لاستكمال الملاحظات",
              timestamp: new Date().toISOString(),
            },
          ],
        };
      }),
    );
    return persistLiveChange(async () => {
      await actOnRequestServer({ data: { requestId, decision: "returned", note } });
    }, `request:decision:${requestId}`).then(({ ok }) => {
      if (ok) {
        logAuditEvent("إعادة طلب للتصحيح", "ServiceRequest", requestId, requestId, note || "إعادة");
      }
      return ok;
    });
  };

  const addApprovalChain = (chain: Omit<ApprovalChain, "id">) => {
    const newChain: ApprovalChain = { ...chain, id: `chain-${Date.now()}` };
    setApprovalChains((prev) => [newChain, ...prev]);
    persistLiveChange(() => createApprovalChainRecord(chain));
    logAuditEvent(
      "إنشاء مسار موافقات",
      "ApprovalChain",
      newChain.id,
      newChain.nameAr,
      `نوع الطلب: ${newChain.requestType}`,
    );
  };

  const deleteApprovalChain = (id: string) => {
    setApprovalChains((prev) => prev.filter((c) => c.id !== id));
    toast.success("تم حذف مسار الاعتماد بنجاح");
  };

  const addDelegationRule = (rule: Omit<DelegationRule, "id" | "createdAt" | "status">) => {
    const newRule: DelegationRule = {
      ...rule,
      id: `del-${Date.now()}`,
      status: "active",
      createdAt: new Date().toISOString(),
    };
    setDelegationRules((prev) => [newRule, ...prev]);
    toast.success(`تم تفعيل تفويض الصلاحيات لـ (${rule.delegateName}) بنجاح`);
    logAuditEvent(
      "تفعيل تفويض صلاحيات",
      "DelegationRule",
      newRule.id,
      rule.delegatorName,
      `المفوض له: ${rule.delegateName} | الفترة: ${rule.startDate} إلى ${rule.endDate}`,
    );
  };

  const revokeDelegationRule = (id: string) => {
    setDelegationRules((prev) => prev.map((r) => (r.id === id ? { ...r, status: "revoked" } : r)));
    toast.info("تم إلغاء التفويض بنجاح");
  };

  // Leaves
  const applyLeave = async (payload: {
    leaveTypeId: string;
    startDate: string;
    endDate: string;
    totalDays: number;
    reason: string;
  }): Promise<boolean> => {
    if (
      !Number.isFinite(payload.totalDays) ||
      payload.totalDays <= 0 ||
      payload.endDate < payload.startDate
    )
      return false;
    const ownsBalance = (b: EmployeeLeaveBalance) =>
      b.leaveTypeId === payload.leaveTypeId &&
      (b.employeeId === currentUser.id || (dataMode === "demo" && !b.employeeId));
    const balance = leaveBalances.find(ownsBalance);
    if (!balance || balance.availableBalance < payload.totalDays) {
      return false;
    }

    // Reserve balance
    setLeaveBalances((prev) =>
      prev.map((b) =>
        ownsBalance(b)
          ? {
              ...b,
              reservedDays: b.reservedDays + payload.totalDays,
              availableBalance: b.availableBalance - payload.totalDays,
            }
          : b,
      ),
    );

    const leaveType = leaveTypes.find((lt) => lt.id === payload.leaveTypeId);
    return submitRequest({
      type: "leave",
      payload: {
        ...payload,
        leaveTypeNameAr: leaveType?.nameAr || "إجازة",
      },
    });
  };

  const addLeaveType = (input: { nameAr: string; maxDaysPerYear: number; isPaid: boolean }) => {
    const newType: LeaveTypePolicy = {
      id: `lt-${Date.now()}`,
      code: `LT-${Date.now().toString().slice(-6)}`,
      nameAr: input.nameAr,
      nameEn: input.nameAr,
      color: "#365F91",
      isPaid: input.isPaid,
      deductFromWorkingDaysOnly: true,
      maxDaysPerYear: input.maxDaysPerYear,
      allowHalfDay: true,
      allowNegativeBalance: false,
      requiresAttachment: false,
      accrualMethod: "yearly_frontloaded",
      carryoverLimitDays: 0,
      status: "active",
    };
    setLeaveTypes((prev) => [newType, ...prev]);
    persistLiveChange(() => createLeaveTypeRecord(input));
    logAuditEvent(
      "إضافة نوع إجازة",
      "LeaveType",
      newType.id,
      newType.nameAr,
      "تم إنشاء سياسة إجازة جديدة",
    );
  };

  const adjustLeaveBalance = (
    employeeId: string,
    leaveTypeId: string,
    days: number,
    reason: string,
  ) => {
    setLeaveBalances((prev) =>
      prev.map((balance) =>
        balance.leaveTypeId === leaveTypeId
          ? {
              ...balance,
              accruedDays: balance.accruedDays + days,
              availableBalance: balance.availableBalance + days,
            }
          : balance,
      ),
    );
    persistLiveChange(() => adjustLeaveBalanceRecord(employeeId, leaveTypeId, days));
    logAuditEvent(
      "تعديل رصيد إجازة",
      "LeaveBalance",
      `${employeeId}:${leaveTypeId}`,
      employeeId,
      `${days} يوم • ${reason}`,
    );
  };

  const addShift = (shift: Omit<ShiftDefinition, "id">) => {
    const newShift: ShiftDefinition = { ...shift, id: `shift-${Date.now()}` };
    setShifts((prev) => [newShift, ...prev]);
    persistLiveChange(() => createShiftRecord(shift));
    logAuditEvent(
      "إضافة وردية",
      "Shift",
      newShift.id,
      newShift.nameAr,
      `${newShift.startTime} - ${newShift.endTime}`,
    );
  };

  // Attendance Punch
  const punchInOut = async (type: "in" | "out", coords?: { lat: number; lng: number }) => {
    const todayStr = new Date().toISOString().split("T")[0];
    const timeStr = new Date().toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    // Check geofence against assigned work location or headquarters
    let geofenceValid = true;
    if (coords) {
      const assignedLoc =
        workLocations.find((l) => l.id === currentUser.workLocationId) ||
        workLocations[0] ||
        mockWorkLocations[0];
      if (assignedLoc) {
        // Haversine formula for exact distance in meters
        const R = 6371e3;
        const φ1 = (coords.lat * Math.PI) / 180;
        const φ2 = (assignedLoc.latitude * Math.PI) / 180;
        const Δφ = ((assignedLoc.latitude - coords.lat) * Math.PI) / 180;
        const Δλ = ((assignedLoc.longitude - coords.lng) * Math.PI) / 180;
        const a =
          Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
          Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distanceMeters = R * c;
        geofenceValid = distanceMeters <= assignedLoc.radiusMeters;
      }
    }

    setAttendanceRecords((prev) => {
      const existing = prev.find((a) => a.employeeId === currentUser.id && a.workDate === todayStr);
      if (existing) {
        return prev.map((a) =>
          a.id === existing.id
            ? {
                ...a,
                actualOut: type === "out" ? timeStr : a.actualOut,
                actualIn: type === "in" ? timeStr : a.actualIn,
                status: "present",
                geofenceValid,
              }
            : a,
        );
      } else {
        const newRecord: DailyAttendanceRecord = {
          id: `att-${Date.now()}`,
          employeeId: currentUser.id,
          employeeNo: currentUser.employeeNo,
          employeeName: `${currentUser.firstNameAr} ${currentUser.lastNameAr}`,
          departmentName: currentUser.departmentName || "",
          workDate: todayStr,
          actualIn: type === "in" ? timeStr : undefined,
          actualOut: type === "out" ? timeStr : undefined,
          status: "present",
          lateMinutes: 0,
          earlyDepartureMinutes: 0,
          workedHours: 8.0,
          overtimeHours: 0,
          punchSource: "mobile_gps",
          geofenceValid,
          violationsCount: 0,
          reviewedByPayroll: false,
        };
        return [newRecord, ...prev];
      }
    });

    const { ok } = await persistLiveChange(
      () => recordAttendance(currentUser.id, type, todayStr, timeStr),
      `attendance:punch:${currentUser.id}:${todayStr}:${type}`,
    );

    if (ok) {
      logAuditEvent(
        type === "in" ? "تسجيل حضور (Check-in)" : "تسجيل انصراف (Check-out)",
        "AttendanceRecord",
        currentUser.id,
        `${currentUser.firstNameAr} ${currentUser.lastNameAr}`,
        `الوقت: ${timeStr} | السياج الجغرافي: ${geofenceValid ? "صحيح داخل النطاق" : "خارج النطاق"}`,
      );
    }

    return {
      success: ok,
      message: ok
        ? type === "in"
          ? "تم تسجيل حضورك بنجاح"
          : "تم تسجيل انصرافك بنجاح"
        : "تعذر تأكيد عملية الحضور على الخادم",
      geofenceValid,
    };
  };

  const submitAttendanceCorrection = (payload: {
    workDate: string;
    correctIn?: string;
    correctOut?: string;
    reason: string;
  }) => {
    submitRequest({
      type: "attendance_correction",
      payload,
    });
    const newReq: AttendanceCorrectionRequest = {
      id: `cor-${Date.now()}`,
      employeeId: currentUser.id,
      employeeNo: currentUser.employeeNo,
      employeeName: `${currentUser.firstNameAr} ${currentUser.lastNameAr}`,
      departmentName: currentUser.departmentName || "الموارد البشرية",
      workDate: payload.workDate,
      correctInTime: payload.correctIn || "08:00",
      correctOutTime: payload.correctOut || "17:00",
      reason: payload.reason,
      status: "pending",
      submittedAt: new Date().toISOString(),
    };
    setAttendanceCorrections((prev) => [newReq, ...prev]);
    toast.success("تم تقديم طلب تصحيح البصمة بنجاح وإرساله للمدير المباشر للاعتماد");
  };

  const approveAttendanceCorrection = (id: string) => {
    const correction = attendanceCorrections.find((c) => c.id === id);
    if (!correction) return;

    setAttendanceCorrections((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              status: "approved",
              reviewedBy: `${currentUser.firstNameAr} ${currentUser.lastNameAr}`,
              reviewedAt: new Date().toISOString(),
            }
          : c,
      ),
    );

    // Update daily attendance record with corrected times
    setAttendanceRecords((prev) => {
      const existing = prev.find(
        (att) =>
          att.id === correction.originalAttendanceId ||
          (att.employeeId === correction.employeeId && att.workDate === correction.workDate),
      );
      if (existing) {
        return prev.map((att) =>
          att.id === existing.id
            ? {
                ...att,
                actualIn: correction.correctInTime,
                actualOut: correction.correctOutTime,
                status: "present",
                lateMinutes: 0,
                earlyDepartureMinutes: 0,
                workedHours: 8.0,
                punchSource: "correction_request",
              }
            : att,
        );
      } else {
        const newRecord: DailyAttendanceRecord = {
          id: `att-${Date.now()}`,
          employeeId: correction.employeeId,
          employeeNo: correction.employeeNo,
          employeeName: correction.employeeName,
          departmentName: correction.departmentName,
          workDate: correction.workDate,
          scheduledShift: "الدوام الرسمي المعتمد",
          scheduledIn: "08:00",
          scheduledOut: "17:00",
          actualIn: correction.correctInTime,
          actualOut: correction.correctOutTime,
          status: "present",
          lateMinutes: 0,
          earlyDepartureMinutes: 0,
          workedHours: 8.0,
          overtimeHours: 0,
          punchSource: "correction_request",
          geofenceValid: true,
          violationsCount: 0,
          reviewedByPayroll: false,
        };
        return [newRecord, ...prev];
      }
    });

    toast.success(`تم اعتماد تصحيح البصمة للموظف (${correction.employeeName}) بنجاح`);
  };

  const rejectAttendanceCorrection = (id: string) => {
    setAttendanceCorrections((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: "rejected" } : c)),
    );
    toast.info("تم رفض طلب تصحيح البصمة");
  };

  const submitOvertimeRequest = (record: Omit<OvertimeRecord, "id" | "status" | "createdAt">) => {
    const newRecord: OvertimeRecord = {
      ...record,
      id: `ot-${Date.now()}`,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    setOvertimeRecords((prev) => [newRecord, ...prev]);
    toast.success(`تم تقديم طلب العمل الإضافي (${record.hours} ساعات) بنجاح وإحالته للاعتماد`);
  };

  const approveOvertimeRequest = (id: string) => {
    const target = overtimeRecords.find((r) => r.id === id);
    if (!target) return;

    setOvertimeRecords((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              status: "approved",
              approvedBy: `${currentUser.firstNameAr} ${currentUser.lastNameAr}`,
              approvedAt: new Date().toISOString(),
            }
          : r,
      ),
    );

    // Update DailyAttendanceRecord overtimeHours so payroll includes it
    setAttendanceRecords((prev) =>
      prev.map((att) =>
        att.employeeId === target.employeeId && att.workDate === target.workDate
          ? { ...att, overtimeHours: Number((att.overtimeHours + target.hours).toFixed(2)) }
          : att,
      ),
    );

    toast.success(
      `تم اعتماد ساعات العمل الإضافي للموظف (${target.employeeName}) بمبلغ ${target.totalAmount.toLocaleString()} ر.س واحتسابها ضمن الرواتب`,
    );
  };

  const rejectOvertimeRequest = (id: string) => {
    setOvertimeRecords((prev) => prev.map((r) => (r.id === id ? { ...r, status: "rejected" } : r)));
    toast.info("تم رفض طلب العمل الإضافي");
  };

  // Payroll Operations
  const processPayrollRun = (groupId: string, year: number, month: number) => {
    const group = payrollGroups.find((g) => g.id === groupId);
    const payrollEmployees = employees.filter((employee) =>
      ["active", "on_leave", "probation"].includes(employee.status),
    );
    const periodPrefix = `${year}-${String(month).padStart(2, "0")}`;
    const daysInMonth = new Date(year, month, 0).getDate();
    const runId = `pr-${groupId}-${year}-${String(month).padStart(2, "0")}`;

    const detailRows: EmployeePayrollDetail[] = payrollEmployees.map((employee) => {
      const attendance = attendanceRecords.filter(
        (record) => record.employeeId === employee.id && record.workDate.startsWith(periodPrefix),
      );
      const absenceDays = attendance.filter((record) => record.status === "absent").length;
      const lateMinutes = attendance.reduce((sum, record) => sum + (record.lateMinutes || 0), 0);
      const earlyDepartureMinutes = attendance.reduce(
        (sum, record) => sum + (record.earlyDepartureMinutes || 0),
        0,
      );
      const biometricOvertime = attendance.reduce(
        (sum, record) => sum + (record.overtimeHours || 0),
        0,
      );
      const violationsCount = attendance.reduce(
        (sum, record) => sum + (record.violationsCount || 0),
        0,
      );

      // Approved leaves aggregation for this month
      const approvedLeaves = requests.filter(
        (req) =>
          req.type === "leave" &&
          req.status === "approved" &&
          (req.requesterId === employee.id || req.subjectEmployeeId === employee.id),
      );
      let unpaidLeaveDays = 0;
      let sickLeaveDays = 0;
      for (const req of approvedLeaves) {
        const p = req.payload;
        const typeId = String(p.leaveTypeId || "");
        const typeName = String(p.leaveTypeNameAr || "");
        const days = Number(p.totalDays || 1);
        const startDate = String(p.startDate || "");
        if (startDate.startsWith(periodPrefix) || !startDate) {
          if (
            typeId === "leave-unpaid" ||
            typeName.includes("بدون راتب") ||
            typeName.includes("غير مدفوع")
          ) {
            unpaidLeaveDays += days;
          } else if (typeId === "leave-sick" || typeName.includes("مرضية")) {
            sickLeaveDays += days;
          }
        }
      }

      // Approved overtime records aggregation
      const approvedOvertimeList = overtimeRecords.filter(
        (ot) =>
          ot.employeeId === employee.id &&
          ot.status === "approved" &&
          (!ot.workDate || ot.workDate.startsWith(periodPrefix)),
      );
      const recordOvertimeHours = approvedOvertimeList.reduce(
        (sum, ot) => sum + Number(ot.hours || 0),
        0,
      );
      const totalOvertimeHours = biometricOvertime + recordOvertimeHours;

      const transportAllowance = Number(employee.customFields?.transportAllowance ?? 0);
      const otherAllowances = Number(employee.customFields?.otherAllowances ?? 0);
      const housingAllowance = Math.max(
        0,
        Number(
          employee.customFields?.housingAllowance ??
            employee.totalSalary - employee.basicSalary - transportAllowance - otherAllowances,
        ),
      );
      const loanInstallment = loans
        .filter((loan) => loan.employeeId === employee.id && loan.status === "active")
        .reduce((sum, loan) => sum + loan.monthlyInstallment, 0);

      // Penalties / disciplinary fines calculation (e.g. 50 SAR or half-day wage per violation)
      const penaltiesAmount =
        violationsCount > 0
          ? Number(
              (
                violationsCount * Math.max(50, Math.round((employee.basicSalary / 240) * 4))
              ).toFixed(2),
            )
          : 0;

      const nationalityStr = (employee.nationality || "").toLowerCase();
      const isSaudi =
        nationalityStr.includes("سعود") ||
        nationalityStr.includes("saudi") ||
        nationalityStr === "sa";

      const calculation = calculateEmployeePayroll({
        basicSalary: employee.basicSalary,
        housingAllowance,
        transportAllowance,
        otherAllowances,
        calculationBasis: group?.calculationBasis ?? "fixed_30_days",
        daysInMonth,
        unpaidLeaveDays,
        sickLeaveDays,
        absenceDays,
        lateMinutes,
        earlyDepartureMinutes,
        penaltiesAmount,
        overtimeHours: totalOvertimeHours,
        loanInstallment,
        isSaudiNational: isSaudi,
        gosiScheme: employee.customFields?.gosiScheme === "new_1445" ? "new_1445" : "legacy",
        payrollDate: `${periodPrefix}-01`,
      });

      return {
        id: `${runId}:${employee.id}`,
        payrollRunId: runId,
        employeeId: employee.id,
        employeeNo: employee.employeeNo,
        employeeName: `${employee.firstNameAr} ${employee.lastNameAr}`,
        jobTitle: employee.jobTitleAr,
        departmentName: employee.departmentName ?? "—",
        bankName: String(employee.customFields?.bankName ?? "غير مسجل"),
        iban: String(employee.customFields?.iban ?? ""),
        basicSalary: employee.basicSalary,
        housingAllowance,
        transportAllowance,
        otherAllowances,
        overtimeHours: totalOvertimeHours,
        overtimeAmount: calculation.overtimeAmount,
        retroAdjustments: 0,
        bonusAmount: 0,
        grossSalary: calculation.grossSalary,
        unpaidLeaveDeduction: calculation.unpaidLeaveDeduction + calculation.sickLeaveDeduction,
        absenceLateDeduction: Number(
          (
            calculation.absenceDeduction +
            calculation.lateDeduction +
            calculation.earlyDepartureDeduction
          ).toFixed(2),
        ),
        loanInstallmentDeduction: calculation.loanDeduction,
        gosiEmployeeDeduction: calculation.gosiEmployee,
        otherDeductions: calculation.penaltiesDeduction,
        totalDeductions: calculation.totalDeductions,
        netSalary: calculation.netSalary,
        absenceDays,
        lateMinutes,
        earlyDepartureMinutes,
        earlyDepartureDeduction: calculation.earlyDepartureDeduction,
        unpaidLeaveDays,
        sickLeaveDays,
        sickLeaveDeduction: calculation.sickLeaveDeduction,
        penaltiesAmount: calculation.penaltiesDeduction,
      };
    });

    const newRun: PayrollRun = {
      id: runId,
      payrollGroupId: groupId,
      payrollGroupName: group?.nameAr || "المجموعة الرئيسية",
      periodYear: year,
      periodMonth: month,
      status: "ready_for_review",
      totalEmployees: detailRows.length,
      totalBasicSalary: detailRows.reduce((sum, detail) => sum + detail.basicSalary, 0),
      totalAllowances: detailRows.reduce(
        (sum, detail) =>
          sum + detail.housingAllowance + detail.transportAllowance + detail.otherAllowances,
        0,
      ),
      totalOvertimeAmount: detailRows.reduce((sum, detail) => sum + detail.overtimeAmount, 0),
      totalDeductions: detailRows.reduce((sum, detail) => sum + detail.totalDeductions, 0),
      totalNetSalary: detailRows.reduce((sum, detail) => sum + detail.netSalary, 0),
      totalEmployerGosi: detailRows.reduce((sum, detail) => {
        const employee = payrollEmployees.find((item) => item.id === detail.employeeId);
        const nationalityStr = (employee?.nationality || "").toLowerCase();
        const isSaudi =
          nationalityStr.includes("سعود") ||
          nationalityStr.includes("saudi") ||
          nationalityStr === "sa";
        if (!isSaudi) {
          return sum + Math.min(detail.basicSalary + detail.housingAllowance, 45000) * 0.02;
        }
        const pensionRate =
          employee?.customFields?.gosiScheme === "new_1445"
            ? year > 2028 || (year === 2028 && month >= 7)
              ? 0.11
              : year > 2027 || (year === 2027 && month >= 7)
                ? 0.105
                : year > 2026 || (year === 2026 && month >= 7)
                  ? 0.1
                  : year > 2025 || (year === 2025 && month >= 7)
                    ? 0.095
                    : 0.09
            : 0.09;
        return (
          sum +
          Math.min(detail.basicSalary + detail.housingAllowance, 45000) * (pensionRate + 0.0275)
        );
      }, 0),
    };

    setPayrollRuns((prev) => [newRun, ...prev.filter((r) => r.id !== newRun.id)]);
    setPayrollDetails((prev) => [
      ...detailRows,
      ...prev.filter((detail) => detail.payrollRunId !== runId),
    ]);

    persistLiveChange(async () => {
      try {
        await runPayrollServer({ data: { year, month, payrollGroupId: groupId } });
      } catch (err) {
        // Keep local calculations fully active and responsive
        console.warn("Server payroll sync notice (local payroll computed):", err);
      }
    });

    logAuditEvent(
      "تشغيل مسير الرواتب",
      "PayrollRun",
      newRun.id,
      `مسير ${month}/${year}`,
      "تم تجميع بيانات الحضور والبصمة والإجازات والجزاءات والسلف والاستحقاقات",
    );
  };

  const lockAndConfirmPayrollRun = async (runId: string) => {
    const { ok } = await persistLiveChange(async () => {
      await updatePayrollRunStatusServer({ data: { runId, status: "locked" } });
    }, `payroll:lock:${runId}`);
    if (!ok) return;
    if (dataMode === "demo")
      setPayrollRuns((prev) =>
        prev.map((run) =>
          run.id === runId
            ? { ...run, status: "confirmed_locked", lockedAt: new Date().toISOString() }
            : run,
        ),
      );
    logAuditEvent("قفل وتأكيد مسير الرواتب", "PayrollRun", runId, runId, "تم تأكيد قفل المسيّر");
  };

  const markPayrollAsPaid = (_runId: string) => {
    toast.info("افتح شاشة دفعات الرواتب، ثم أدخل مرجع التحويل المنفّذ لدى البنك لتسجيل التأكيد");
  };

  const processAttendance = (fromDate: string, toDate: string) => {
    persistLiveChange(async () => {
      await processAttendanceServer({ data: { fromDate, toDate } });
    });
    logAuditEvent(
      "معالجة البصمات",
      "Attendance",
      `${fromDate}..${toDate}`,
      "احتساب الحضور",
      "تم تحويل البصمات إلى سجلات حضور وساعات عمل وتأخير وإضافي",
    );
  };

  const accrueLeaveBalances = (year: number) => {
    persistLiveChange(async () => {
      await accrueLeaveBalancesServer({ data: { year } });
    });
    logAuditEvent(
      "ترحيل استحقاق الإجازات",
      "LeaveBalance",
      String(year),
      `سنة ${year}`,
      "تم إضافة الاستحقاق الشهري لأرصدة الإجازات",
    );
  };

  const createLoan = (payload: {
    principalAmount: number;
    monthlyInstallment: number;
    totalInstallments: number;
    reason: string;
  }) => {
    const newLoan: LoanRecord = {
      id: `loan-${Date.now()}`,
      employeeId: currentUser.id,
      employeeName: `${currentUser.firstNameAr} ${currentUser.lastNameAr}`,
      loanType: "personal_advance",
      principalAmount: payload.principalAmount,
      monthlyInstallment: payload.monthlyInstallment,
      totalInstallments: payload.totalInstallments,
      paidInstallments: 0,
      remainingBalance: payload.principalAmount,
      startDate: new Date().toISOString().split("T")[0],
      reason: payload.reason,
      status: "active",
    };
    if (dataMode === "demo") setLoans((prev) => [newLoan, ...prev]);
    submitRequest({
      type: "loan_advance",
      payload,
    });
  };

  const createSettlement = (settlementData: Omit<FinalSettlementRecord, "id">) => {
    const newSettlement: FinalSettlementRecord = {
      ...settlementData,
      id: `set-${Date.now()}`,
    };
    setSettlements((prev) => [newSettlement, ...prev]);
    persistLiveChange(async () => {
      await createSettlementServer({
        data: {
          employeeId: settlementData.employeeId,
          terminationDate: settlementData.terminationDate,
          separationType: "termination_by_employer",
        },
      });
    });
    logAuditEvent(
      "إنشاء مخالصة نهاية خدمة",
      "FinalSettlement",
      newSettlement.id,
      newSettlement.employeeName,
      `صافي المستحق: ${newSettlement.netSettlementAmount} ر.س`,
    );
  };

  // Expenses
  const addExpenseClaim = (
    claimData: Omit<ExpenseClaim, "id" | "status" | "policyWarningTriggered">,
  ) => {
    const cat = expenseCategories.find((c) => c.id === claimData.categoryId);
    const isWarning = cat ? claimData.amount > cat.maxLimitWarning : false;
    const newClaim: ExpenseClaim = {
      ...claimData,
      id: `claim-${Date.now()}`,
      status: "submitted",
      policyWarningTriggered: isWarning,
    };
    setExpenseClaims((prev) => [newClaim, ...prev]);
    persistLiveChange(() => createExpenseClaimRecord(claimData));
    submitRequest({
      type: "expense_claim",
      payload: {
        categoryNameAr: claimData.categoryNameAr,
        amount: claimData.amount,
        merchantName: claimData.merchantName,
        description: claimData.description,
      },
    });
  };

  const addExpenseCategory = (input: {
    nameAr: string;
    warningLimit: number;
    blockLimit: number;
  }) => {
    const newCategory: ExpenseCategory = {
      id: `cat-${Date.now()}`,
      nameAr: input.nameAr,
      nameEn: input.nameAr,
      maxLimitWarning: input.warningLimit,
      maxLimitBlock: input.blockLimit,
      requiresReceipt: true,
      icon: "Receipt",
    };
    setExpenseCategories((prev) => [newCategory, ...prev]);
    persistLiveChange(() => createExpenseCategoryRecord(input));
    logAuditEvent(
      "إضافة سياسة مصروفات",
      "ExpenseCategory",
      newCategory.id,
      input.nameAr,
      "تم إنشاء فئة مصروفات جديدة",
    );
  };

  const addPerformanceCycle = (cycle: Omit<PerformanceCycle, "id">) => {
    const newCycle: PerformanceCycle = { ...cycle, id: `cyc-${Date.now()}` };
    setPerformanceCycles((prev) => [newCycle, ...prev]);
    persistLiveChange(() => createPerformanceCycleRecord(cycle));
    logAuditEvent(
      "بدء دورة تقييم",
      "PerformanceCycle",
      newCycle.id,
      newCycle.titleAr,
      `${newCycle.startDate} - ${newCycle.endDate}`,
    );
  };

  const addEvaluation = (evaluation: Omit<EvaluationRecord, "id">) => {
    const newEvaluation: EvaluationRecord = { ...evaluation, id: `ev-${Date.now()}` };
    setEvaluations((prev) => [newEvaluation, ...prev]);
    persistLiveChange(() => createEvaluationRecord(evaluation));
    logAuditEvent(
      "إرسال تقييم أداء",
      "Evaluation",
      newEvaluation.id,
      newEvaluation.employeeName,
      `النتيجة: ${newEvaluation.overallScore}`,
    );
  };

  // ATS
  const addJobOpening = (job: Omit<JobOpening, "id">) => {
    const newJob: JobOpening = { ...job, id: `job-${Date.now()}` };
    setJobOpenings((prev) => [newJob, ...prev]);
    persistLiveChange(() => createJobOpeningRecord(job));
    logAuditEvent(
      "إنشاء شاغر وظيفي",
      "JobOpening",
      newJob.id,
      newJob.titleAr,
      `عدد الشواغر: ${newJob.openingsCount}`,
    );
  };

  const addCandidate = (candidate: Omit<Candidate, "id">) => {
    const newCandidate: Candidate = { ...candidate, id: `cand-${Date.now()}` };
    setCandidates((prev) => [newCandidate, ...prev]);
    persistLiveChange(() => createCandidateRecord(candidate));
    logAuditEvent(
      "إضافة مرشح",
      "Candidate",
      newCandidate.id,
      newCandidate.fullName,
      `الوظيفة: ${newCandidate.jobTitle}`,
    );
  };

  const updateCandidateScore = (candidateId: string, score: number) => {
    setCandidates((prev) =>
      prev.map((candidate) =>
        candidate.id === candidateId ? { ...candidate, ratingScore: score } : candidate,
      ),
    );
    persistLiveChange(() => updateCandidateRecord(candidateId, { ratingScore: score }));
    logAuditEvent("تحديث تقييم مرشح", "Candidate", candidateId, candidateId, `النتيجة: ${score}`);
  };

  const moveCandidateStage = (candidateId: string, newStage: CandidateStage) => {
    setCandidates((prev) =>
      prev.map((c) => (c.id === candidateId ? { ...c, stage: newStage } : c)),
    );
    persistLiveChange(() => updateCandidateRecord(candidateId, { stage: newStage }));
    const candidate = candidates.find((c) => c.id === candidateId);
    logAuditEvent(
      "نقل مرشح لمرحلة جديدة",
      "Candidate",
      candidateId,
      candidate?.fullName || "",
      `المرحلة: ${newStage}`,
    );
  };

  const sendJobOffer = (offerData: Omit<JobOffer, "id" | "status">) => {
    const newOffer: JobOffer = {
      ...offerData,
      id: `off-${Date.now()}`,
      status: "sent_to_candidate",
    };
    setJobOffers((prev) => [newOffer, ...prev]);
    persistLiveChange(() => createJobOfferRecord(offerData));
    moveCandidateStage(offerData.candidateId, "job_offer");
    logAuditEvent(
      "إصدار عرض عمل رسمي",
      "JobOffer",
      newOffer.id,
      offerData.candidateName,
      `الراتب الأساسي: ${offerData.basicSalary} ر.س`,
    );
  };

  // Assets & Docs
  const addAsset = (asset: Omit<HardwareAsset, "id">) => {
    const newAsset: HardwareAsset = { ...asset, id: `ast-${Date.now()}` };
    setAssets((prev) => [newAsset, ...prev]);
    persistLiveChange(() => createAssetRecord(asset));
    logAuditEvent(
      "إضافة عهدة",
      "HardwareAsset",
      newAsset.id,
      newAsset.nameAr,
      `الرقم التسلسلي: ${newAsset.serialNumber}`,
    );
  };

  const addCompanyDocument = (document: Omit<CompanyDocument, "id" | "acknowledgedCount">) => {
    const newDocument: CompanyDocument = {
      ...document,
      id: `doc-${Date.now()}`,
      acknowledgedCount: 0,
    };
    setCompanyDocs((prev) => [newDocument, ...prev]);
    persistLiveChange(() => createCompanyDocumentRecord(document));
    logAuditEvent(
      "نشر وثيقة منشأة",
      "CompanyDocument",
      newDocument.id,
      newDocument.titleAr,
      `الإصدار: ${newDocument.version}`,
    );
  };

  const assignAsset = (assetId: string, employeeId: string) => {
    const emp = employees.find((e) => e.id === employeeId);
    setAssets((prev) =>
      prev.map((a) =>
        a.id === assetId
          ? {
              ...a,
              status: "assigned",
              assignedToEmployeeId: employeeId,
              assignedToEmployeeName: emp ? `${emp.firstNameAr} ${emp.lastNameAr}` : "",
              assignedDate: new Date().toISOString().split("T")[0],
            }
          : a,
      ),
    );
    persistLiveChange(() => assignAssetRecord(assetId, employeeId));
  };

  const returnAsset = (assetId: string) => {
    setAssets((prev) =>
      prev.map((a) =>
        a.id === assetId
          ? {
              ...a,
              status: "available",
              assignedToEmployeeId: null,
              assignedToEmployeeName: undefined,
              assignedDate: undefined,
            }
          : a,
      ),
    );
    persistLiveChange(() => returnAssetRecord(assetId));
  };

  const acknowledgeDocument = (docId: string) => {
    setCompanyDocs((prev) =>
      prev.map((d) => (d.id === docId ? { ...d, acknowledgedCount: d.acknowledgedCount + 1 } : d)),
    );
    persistLiveChange(() => acknowledgeDocumentRecord(docId, currentUser.id));
  };

  const markNotificationRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    persistLiveChange(() => markNotificationReadRecord(id));
  };

  return (
    <AppContext.Provider
      value={{
        language,
        direction,
        t,
        setLanguage,
        toggleLanguage,
        currentRole,
        setCurrentRole,
        currentUser,
        dataMode,
        isDataLoading,
        dataError,
        isSaving,
        pendingMutationCount,
        lastSavedAt,
        refreshCoreData,
        company,
        subsidiaries,
        orgUnits,
        workLocations,
        costCenters,
        jobPositions,
        employees,
        roles,
        approvalChains,
        delegationRules,
        requests,
        leaveTypes,
        leaveBalances,
        shifts,
        attendanceRecords,
        overtimeRecords,
        attendanceCorrections,
        payrollGroups,
        payrollRuns,
        payrollDetails,
        loans,
        settlements,
        expenseCategories,
        expenseClaims,
        performanceCycles,
        evaluations,
        workforcePlans,
        jobOpenings,
        candidates,
        jobOffers,
        assets,
        companyDocs,
        auditLogs,
        notifications,
        accountingJournals,
        activeEmployeeModalId,
        openEmployeeProfile,
        closeEmployeeProfile,
        addEmployee,
        updateEmployee,
        updateCompany,
        addOrgUnit,
        updateOrgUnit,
        deleteOrgUnit,
        addSubsidiary,
        updateSubsidiary,
        deleteSubsidiary,
        addWorkLocation,
        updateWorkLocation,
        deleteWorkLocation,
        addCostCenter,
        updateCostCenter,
        deleteCostCenter,
        addJobPosition,
        updateJobPosition,
        deleteJobPosition,
        addRole,
        submitRequest,
        approveRequest,
        rejectRequest,
        returnRequest,
        addApprovalChain,
        deleteApprovalChain,
        addDelegationRule,
        revokeDelegationRule,
        applyLeave,
        addLeaveType,
        adjustLeaveBalance,
        addShift,
        punchInOut,
        submitAttendanceCorrection,
        submitOvertimeRequest,
        approveOvertimeRequest,
        rejectOvertimeRequest,
        approveAttendanceCorrection,
        rejectAttendanceCorrection,
        processPayrollRun,
        lockAndConfirmPayrollRun,
        markPayrollAsPaid,
        processAttendance,
        accrueLeaveBalances,
        createLoan,
        createSettlement,
        addExpenseClaim,
        addExpenseCategory,
        addPerformanceCycle,
        addEvaluation,
        addJobOpening,
        addCandidate,
        updateCandidateScore,
        moveCandidateStage,
        sendJobOffer,
        addAsset,
        addCompanyDocument,
        assignAsset,
        returnAsset,
        acknowledgeDocument,
        markNotificationRead,
        logAuditEvent,
        permissionGroups,
        userPermissionOverrides,
        createPermissionGroup,
        updatePermissionGroup,
        deletePermissionGroup,
        addUsersToGroup,
        removeUserFromGroup,
        updateUserScreenPermissions,
        resetUserScreenPermissions,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
};
