import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
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
} from "../auth/rbac-definitions";
import { getTranslation } from "../translations";
import { useAuth } from "../auth/AuthContext";
import { toast } from "sonner";
import { executeReliableMutation } from "../data/reliable-mutation";

// Domain Hooks
import { useBootstrapData } from "../domains/bootstrap/use-bootstrap";
import { useCreateEmployee, useUpdateEmployee } from "../domains/employees";
import { useOrganizationMutations } from "../domains/organization";
import { usePayrollMutations } from "../domains/payroll";
import { useAttendanceMutations } from "../domains/attendance";
import { useWorkflowMutations } from "../domains/workflow";
import { useLeaveMutations } from "../domains/leaves";
import { useShiftMutations } from "../domains/shifts";
import { useExpenseMutations } from "../domains/expenses";
import { usePerformanceMutations } from "../domains/performance";
import { useRecruitmentMutations } from "../domains/recruitment";
import { useAssetMutations } from "../domains/assets";
import { useDocumentMutations } from "../domains/documents";
import { useAuditMutations } from "../domains/audit";
import { useNotificationMutations } from "../domains/notifications";
import { useRbac, useRbacMutations } from "../domains/rbac";

export interface AppContextType {
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
  ) => Promise<RoleDefinition> | RoleDefinition;

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

const globalScope = globalThis as unknown as {
  __hrmsAppContext?: React.Context<AppContextType | null>;
};
const AppContext: React.Context<AppContextType | null> =
  globalScope.__hrmsAppContext ?? createContext<AppContextType | null>(null);
globalScope.__hrmsAppContext = AppContext;

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

  // Domain bootstrap hook (replaces 2,000 lines of local useState cache)
  const bootstrap = useBootstrapData();

  // Mutation and saving state coordination
  const [pendingMutationCount, setPendingMutationCount] = useState(0);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);
  const activeMutationKeys = useRef(new Set<string>());
  const isSaving = pendingMutationCount > 0;

  // Reliable mutation coordinator integration
  const persistLiveChange = useCallback(
    (operation: () => Promise<void>, mutationKey?: string) => {
      if (bootstrap.dataMode === "live" && mutationKey && activeMutationKeys.current.has(mutationKey)) {
        const error = new Error("عملية حفظ مماثلة قيد التنفيذ");
        toast.info("عملية الحفظ نفسها قيد التنفيذ بالفعل");
        return Promise.resolve({ ok: false, error });
      }

      if (bootstrap.dataMode === "live" && mutationKey) activeMutationKeys.current.add(mutationKey);
      setDataError(null);
      return executeReliableMutation({
        mode: bootstrap.dataMode,
        operation,
        refresh: bootstrap.refreshCoreData,
        onPendingChange: (pending) =>
          setPendingMutationCount((count) => Math.max(0, count + (pending ? 1 : -1))),
        onCommitted: () => {
          if (bootstrap.dataMode === "live") setLastSavedAt(new Date().toISOString());
        },
        onRejected: (error) => {
          setDataError(error.message);
          toast.error("تعذر حفظ التغييرات. تمت استعادة آخر بيانات مؤكدة من الخادم.");
        },
      }).finally(() => {
        if (mutationKey) activeMutationKeys.current.delete(mutationKey);
      });
    },
    [bootstrap.dataMode, bootstrap.refreshCoreData],
  );

  // Active employee modal navigation
  const [activeEmployeeModalId, setActiveEmployeeModalId] = useState<string | null>(null);
  const openEmployeeProfile = useCallback((employeeOrId: string | Employee) => {
    const id = typeof employeeOrId === "string" ? employeeOrId : employeeOrId.id;
    setActiveEmployeeModalId(id);
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/employees")) {
      window.history.pushState(null, "", `/employees/${id}`);
    }
  }, []);

  const closeEmployeeProfile = useCallback(() => {
    setActiveEmployeeModalId(null);
  }, []);

  // Domain mutation delegates
  const { createEmployee } = useCreateEmployee();
  const { updateEmployee } = useUpdateEmployee();
  const orgMutations = useOrganizationMutations();
  const payrollMutations = usePayrollMutations();
  const attendanceMutations = useAttendanceMutations();
  const workflowMutations = useWorkflowMutations();
  const leaveMutations = useLeaveMutations();
  const shiftMutations = useShiftMutations();
  const expenseMutations = useExpenseMutations();
  const performanceMutations = usePerformanceMutations();
  const recruitmentMutations = useRecruitmentMutations();
  const assetMutations = useAssetMutations();
  const documentMutations = useDocumentMutations();
  const auditMutations = useAuditMutations();
  const notificationMutations = useNotificationMutations();
  const rbacData = useRbac();
  const rbacMutations = useRbacMutations(
    rbacData.setPermissionGroups,
    rbacData.setUserPermissionOverrides,
  );

  // Derive Current User Representation
  const currentUser: Employee = useMemo(() => {
    const emps = bootstrap.employees;
    if (bootstrap.dataMode === "live") {
      const match = emps.find(
        (e) =>
          (session?.user?.id && e.customFields?.userId === session.user.id) ||
          (session?.user?.email &&
            e.email &&
            e.email.toLowerCase() === session.user.email.toLowerCase()),
      );
      if (match) return match;
    } else {
      const match = emps.find((e) => {
        if (
          session?.user?.email &&
          e.email &&
          e.email.toLowerCase() === session.user.email.toLowerCase()
        ) {
          return true;
        }
        if (currentRole === "super_admin" || currentRole === "hr_manager") return e.id === "emp-04";
        if (currentRole === "payroll_officer" || currentRole === "finance_officer")
          return e.id === "emp-02";
        if (currentRole === "line_manager") return e.id === "emp-01";
        return e.id === "emp-05";
      });
      if (match) return match;
    }

    if (bootstrap.dataMode === "demo" && emps[0]) return emps[0];

    return {
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
    };
  }, [bootstrap.employees, bootstrap.dataMode, session, currentRole]);

  const value: AppContextType = useMemo(
    () => ({
      // Localization
      language,
      direction,
      t,
      setLanguage: (lang: Language) => setLanguageState(lang),
      toggleLanguage: () => setLanguageState((prev) => (prev === "ar" ? "en" : "ar")),

      // User & Security Status
      currentRole,
      setCurrentRole,
      currentUser,
      dataMode: bootstrap.dataMode,
      isDataLoading: bootstrap.isLoading,
      dataError: dataError || bootstrap.error,
      isSaving,
      pendingMutationCount,
      lastSavedAt,
      refreshCoreData: bootstrap.refreshCoreData,

      // Collections Sourced from Server State
      company: bootstrap.company,
      subsidiaries: bootstrap.subsidiaries,
      orgUnits: bootstrap.orgUnits,
      workLocations: bootstrap.workLocations,
      costCenters: bootstrap.costCenters,
      jobPositions: bootstrap.jobPositions,
      employees: bootstrap.employees,
      roles: rbacData.roles,
      approvalChains: bootstrap.approvalChains,
      delegationRules: bootstrap.delegationRules,
      requests: bootstrap.requests,
      leaveTypes: bootstrap.leaveTypes,
      leaveBalances: bootstrap.leaveBalances,
      shifts: bootstrap.shifts,
      attendanceRecords: bootstrap.attendanceRecords,
      overtimeRecords: bootstrap.overtimeRecords,
      attendanceCorrections: bootstrap.attendanceCorrections,
      payrollGroups: bootstrap.payrollGroups,
      payrollRuns: bootstrap.payrollRuns,
      payrollDetails: bootstrap.payrollDetails,
      loans: bootstrap.loans,
      settlements: bootstrap.settlements,
      expenseCategories: bootstrap.expenseCategories,
      expenseClaims: bootstrap.expenseClaims,
      performanceCycles: bootstrap.performanceCycles,
      evaluations: bootstrap.evaluations,
      workforcePlans: bootstrap.workforcePlans,
      jobOpenings: bootstrap.jobOpenings,
      candidates: bootstrap.candidates,
      jobOffers: bootstrap.jobOffers,
      assets: bootstrap.assets,
      companyDocs: bootstrap.companyDocs,
      auditLogs: bootstrap.auditLogs,
      notifications: bootstrap.notifications,
      accountingJournals: bootstrap.accountingJournals,

      // UI States
      activeEmployeeModalId,
      openEmployeeProfile,
      closeEmployeeProfile,

      // Mutators (delegating to domain hooks & keeping compatibility)
      addEmployee: (emp) =>
        persistLiveChange(() => createEmployee(emp).then(() => undefined), "addEmployee").then(
          (res) => res.ok,
        ),
      updateEmployee: (id, updates) =>
        persistLiveChange(
          () => updateEmployee(id, updates).then(() => undefined),
          `updateEmployee-${id}`,
        ).then((res) => res.ok),
      updateCompany: (prof) =>
        persistLiveChange(() => orgMutations.updateCompany(prof).then(() => undefined)).then(
          (res) => res.ok,
        ),
      addOrgUnit: (unit) =>
        persistLiveChange(() => orgMutations.addOrgUnit(unit).then(() => undefined)).then(
          (res) => res.ok,
        ),
      updateOrgUnit: (id, unit) =>
        persistLiveChange(() => orgMutations.updateOrgUnit(id, unit).then(() => undefined)).then(
          (res) => res.ok,
        ),
      deleteOrgUnit: (id) =>
        persistLiveChange(() => orgMutations.deleteOrgUnit(id).then(() => undefined)).then(
          (res) => res.ok,
        ),
      addSubsidiary: (sub) =>
        persistLiveChange(() => orgMutations.addSubsidiary(sub).then(() => undefined)).then(
          (res) => res.ok,
        ),
      updateSubsidiary: (id, sub) =>
        persistLiveChange(() => orgMutations.updateSubsidiary(id, sub).then(() => undefined)).then(
          (res) => res.ok,
        ),
      deleteSubsidiary: (id) =>
        persistLiveChange(() => orgMutations.deleteSubsidiary(id).then(() => undefined)).then(
          (res) => res.ok,
        ),
      addWorkLocation: (loc) =>
        persistLiveChange(() => orgMutations.addWorkLocation(loc).then(() => undefined)).then(
          (res) => res.ok,
        ),
      updateWorkLocation: (id, loc) =>
        persistLiveChange(() => orgMutations.updateWorkLocation(id, loc).then(() => undefined)).then(
          (res) => res.ok,
        ),
      deleteWorkLocation: (id) =>
        persistLiveChange(() => orgMutations.deleteWorkLocation(id).then(() => undefined)).then(
          (res) => res.ok,
        ),
      addCostCenter: (cc) =>
        persistLiveChange(() => orgMutations.addCostCenter(cc).then(() => undefined)).then(
          (res) => res.ok,
        ),
      updateCostCenter: (id, cc) =>
        persistLiveChange(() => orgMutations.updateCostCenter(id, cc).then(() => undefined)).then(
          (res) => res.ok,
        ),
      deleteCostCenter: (id) =>
        persistLiveChange(() => orgMutations.deleteCostCenter(id).then(() => undefined)).then(
          (res) => res.ok,
        ),
      addJobPosition: (pos) =>
        persistLiveChange(() => orgMutations.addJobPosition(pos).then(() => undefined)).then(
          (res) => res.ok,
        ),
      updateJobPosition: (id, pos) =>
        persistLiveChange(() => orgMutations.updateJobPosition(id, pos).then(() => undefined)).then(
          (res) => res.ok,
        ),
      deleteJobPosition: (id) =>
        persistLiveChange(() => orgMutations.deleteJobPosition(id).then(() => undefined)).then(
          (res) => res.ok,
        ),
      addRole: rbacMutations.addRole,

      // Workflow Mutators
      submitRequest: (req) =>
        persistLiveChange(
          () => workflowMutations.submitRequest(req, currentUser.id).then(() => undefined),
          "submitRequest",
        ).then((res) => res.ok),
      approveRequest: (id, note) =>
        persistLiveChange(() => workflowMutations.approveRequest(id, note).then(() => undefined)).then(
          (res) => res.ok,
        ),
      rejectRequest: (id, note) =>
        persistLiveChange(() => workflowMutations.rejectRequest(id, note).then(() => undefined)).then(
          (res) => res.ok,
        ),
      returnRequest: (id, note) =>
        persistLiveChange(() => workflowMutations.returnRequest(id, note).then(() => undefined)).then(
          (res) => res.ok,
        ),
      addApprovalChain: (chain) => void workflowMutations.addApprovalChain(chain),
      deleteApprovalChain: (id) => void workflowMutations.deleteApprovalChain(id),
      addDelegationRule: (rule) => void workflowMutations.addDelegationRule(rule),
      revokeDelegationRule: (id) => void workflowMutations.revokeDelegationRule(id),

      // Leaves Mutators
      applyLeave: (payload) =>
        persistLiveChange(
          () => leaveMutations.applyLeave(payload, currentUser.id).then(() => undefined),
          "applyLeave",
        ).then((res) => res.ok),
      addLeaveType: (input) => void leaveMutations.addLeaveType(input),
      adjustLeaveBalance: (empId, typeId, days, reason) =>
        void leaveMutations.adjustLeaveBalance(empId, typeId, days, reason),
      addShift: (shift) => void shiftMutations.addShift(shift),

      // Attendance Mutators
      punchInOut: (type, coords) => attendanceMutations.punchInOut(type, coords, currentUser.id),
      submitAttendanceCorrection: (payload) =>
        void attendanceMutations.submitAttendanceCorrection({
          ...payload,
          employeeId: currentUser.id,
        }),
      submitOvertimeRequest: (record) => void attendanceMutations.submitOvertimeRequest(record),
      approveOvertimeRequest: (id) => void attendanceMutations.approveOvertimeRequest(id),
      rejectOvertimeRequest: (id) => void attendanceMutations.rejectOvertimeRequest(id),
      approveAttendanceCorrection: (id) => void attendanceMutations.approveAttendanceCorrection(id),
      rejectAttendanceCorrection: (id) => void attendanceMutations.rejectAttendanceCorrection(id),

      // Payroll Mutators
      processPayrollRun: (groupId, year, month) =>
        void payrollMutations.processPayrollRun(groupId, year, month),
      lockAndConfirmPayrollRun: (runId) => void payrollMutations.lockAndConfirmPayrollRun(runId),
      markPayrollAsPaid: (runId) => void payrollMutations.markPayrollAsPaid(runId),
      processAttendance: (fromDate, toDate) =>
        void attendanceMutations.processAttendance(fromDate, toDate),
      accrueLeaveBalances: (year) => void leaveMutations.accrueLeaveBalances(year),
      createLoan: (payload) =>
        void payrollMutations.createLoan({ ...payload, employeeId: currentUser.id }),
      createSettlement: (settlement) => void payrollMutations.createSettlement(settlement),

      // Expenses Mutators
      addExpenseClaim: (claim) => void expenseMutations.addExpenseClaim(claim),
      addExpenseCategory: (input) => void expenseMutations.addExpenseCategory(input),

      // Performance Mutators
      addPerformanceCycle: (cycle) => void performanceMutations.addPerformanceCycle(cycle),
      addEvaluation: (evaluation) => void performanceMutations.addEvaluation(evaluation),

      // ATS Mutators
      addJobOpening: (job) => void recruitmentMutations.addJobOpening(job),
      addCandidate: (candidate) => void recruitmentMutations.addCandidate(candidate),
      updateCandidateScore: (id, score) =>
        void recruitmentMutations.updateCandidateScore(id, score),
      moveCandidateStage: (id, stage) =>
        void recruitmentMutations.moveCandidateStage(id, stage),
      sendJobOffer: (offer) => void recruitmentMutations.sendJobOffer(offer),

      // Assets & Docs Mutators
      addAsset: (asset) => void assetMutations.addAsset(asset),
      addCompanyDocument: (doc) => void documentMutations.addCompanyDocument(doc),
      assignAsset: (assetId, empId) => void assetMutations.assignAsset(assetId, empId),
      returnAsset: (assetId) => void assetMutations.returnAsset(assetId),
      acknowledgeDocument: (docId) => void documentMutations.acknowledgeDocument(docId),

      // Audit & Notification Mutators
      markNotificationRead: (id) => void notificationMutations.markNotificationRead(id),
      logAuditEvent: (action, entityType, entityId, entityName, changesSummary) =>
        void auditMutations.logAuditEvent(action, entityType, entityId, entityName, changesSummary, {
          id: currentUser.id,
          name: `${currentUser.firstNameAr} ${currentUser.lastNameAr}`,
          role: currentRole,
        }),

      // RBAC Mutators & Overrides
      permissionGroups: rbacData.permissionGroups,
      userPermissionOverrides: rbacData.userPermissionOverrides,
      createPermissionGroup: rbacMutations.createPermissionGroup,
      updatePermissionGroup: rbacMutations.updatePermissionGroup,
      deletePermissionGroup: rbacMutations.deletePermissionGroup,
      addUsersToGroup: rbacMutations.addUsersToGroup,
      removeUserFromGroup: rbacMutations.removeUserFromGroup,
      updateUserScreenPermissions: rbacMutations.updateUserScreenPermissions,
      resetUserScreenPermissions: rbacMutations.resetUserScreenPermissions,
    }),
    [
      language,
      direction,
      t,
      currentRole,
      setCurrentRole,
      currentUser,
      bootstrap,
      dataError,
      isSaving,
      pendingMutationCount,
      lastSavedAt,
      activeEmployeeModalId,
      openEmployeeProfile,
      closeEmployeeProfile,
      createEmployee,
      updateEmployee,
      persistLiveChange,
      orgMutations,
      payrollMutations,
      attendanceMutations,
      workflowMutations,
      leaveMutations,
      shiftMutations,
      expenseMutations,
      performanceMutations,
      recruitmentMutations,
      assetMutations,
      documentMutations,
      auditMutations,
      notificationMutations,
      rbacData,
      rbacMutations,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export function useApp(): AppContextType {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}
