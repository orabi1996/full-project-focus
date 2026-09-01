import React, { createContext, useCallback, useContext, useState, useEffect } from "react";
import type {
  Language,
  Direction,
  DataScope,
  UserRole,
  CompanyProfile,
  Subsidiary,
  OrgUnit,
  WorkLocation,
  Employee,
  RoleDefinition,
  ApprovalChain,
  ServiceRequest,
  LeaveTypePolicy,
  EmployeeLeaveBalance,
  ShiftDefinition,
  ScheduleAssignment,
  DailyAttendanceRecord,
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
  HardwareAsset,
  CompanyDocument,
  AuditLogEntry,
  AppNotification,
  AccountingJournalEntry,
  CandidateStage,
  RequestCategory,
} from "../../types";
import {
  adjustLeaveBalanceRecord,
  acknowledgeDocumentRecord,
  assignAssetRecord,
  createApprovalChainRecord,
  createAssetRecord,
  createAuditEventRecord,
  createCandidateRecord,
  createCompanyDocumentRecord,
  createEvaluationRecord,
  createExpenseCategoryRecord,
  createExpenseClaimRecord,
  createJobOfferRecord,
  createJobOpeningRecord,
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
  updateCandidateRecord,
  updatePayrollRunStatusRecord,
} from "../data/operational-repository";
import {
  mockCompany,
  mockSubsidiaries,
  mockOrgUnits,
  mockWorkLocations,
  mockEmployees,
  mockRoles,
  mockApprovalChains,
  mockRequests,
  mockLeaveTypes,
  mockEmployeeLeaveBalances,
  mockShifts,
  mockAttendanceRecords,
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
  refreshCoreData: () => Promise<void>;

  // State Collections
  company: CompanyProfile;
  subsidiaries: Subsidiary[];
  orgUnits: OrgUnit[];
  workLocations: WorkLocation[];
  employees: Employee[];
  roles: RoleDefinition[];
  approvalChains: ApprovalChain[];
  requests: ServiceRequest[];
  leaveTypes: LeaveTypePolicy[];
  leaveBalances: EmployeeLeaveBalance[];
  shifts: ShiftDefinition[];
  attendanceRecords: DailyAttendanceRecord[];
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
  addEmployee: (emp: Omit<Employee, "id" | "completionScore">) => void;
  updateEmployee: (id: string, updates: Partial<Employee>) => void;
  addOrgUnit: (unit: Omit<OrgUnit, "id" | "employeeCount">) => void;
  addSubsidiary: (subsidiary: Omit<Subsidiary, "id" | "employeeCount">) => void;
  addWorkLocation: (location: Omit<WorkLocation, "id">) => void;
  addRole: (
    role: Omit<RoleDefinition, "id" | "userCount" | "permissions"> & { dataScope: DataScope },
  ) => RoleDefinition;

  // Requests & Workflow
  submitRequest: (req: { type: RequestCategory; payload: ServiceRequest["payload"] }) => void;
  approveRequest: (requestId: string, note?: string) => void;
  rejectRequest: (requestId: string, note?: string) => void;
  returnRequest: (requestId: string, note?: string) => void;
  addApprovalChain: (chain: Omit<ApprovalChain, "id">) => void;

  // Leaves
  applyLeave: (payload: {
    leaveTypeId: string;
    startDate: string;
    endDate: string;
    totalDays: number;
    reason: string;
  }) => boolean;
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
  ) => { success: boolean; message: string; geofenceValid: boolean };
  submitAttendanceCorrection: (payload: {
    workDate: string;
    correctIn?: string;
    correctOut?: string;
    reason: string;
  }) => void;

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
}

const AppContext = createContext<AppContextType | null>(null);

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
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  // State variables
  const [company, setCompany] = useState<CompanyProfile>(mockCompany);
  const [subsidiaries, setSubsidiaries] = useState<Subsidiary[]>(mockSubsidiaries);
  const [orgUnits, setOrgUnits] = useState<OrgUnit[]>(mockOrgUnits);
  const [workLocations, setWorkLocations] = useState<WorkLocation[]>(mockWorkLocations);
  const [employees, setEmployees] = useState<Employee[]>(mockEmployees);
  const [roles, setRoles] = useState<RoleDefinition[]>(mockRoles);
  const [approvalChains, setApprovalChains] = useState<ApprovalChain[]>(mockApprovalChains);
  const [requests, setRequests] = useState<ServiceRequest[]>(mockRequests);
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypePolicy[]>(mockLeaveTypes);
  const [leaveBalances, setLeaveBalances] =
    useState<EmployeeLeaveBalance[]>(mockEmployeeLeaveBalances);
  const [shifts, setShifts] = useState<ShiftDefinition[]>(mockShifts);
  const [attendanceRecords, setAttendanceRecords] =
    useState<DailyAttendanceRecord[]>(mockAttendanceRecords);
  const [payrollGroups, setPayrollGroups] = useState<PayrollGroup[]>(mockPayrollGroups);
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>(mockPayrollRuns);
  const [payrollDetails, setPayrollDetails] = useState<EmployeePayrollDetail[]>(mockPayrollDetails);
  const [loans, setLoans] = useState<LoanRecord[]>(mockLoans);
  const [settlements, setSettlements] = useState<FinalSettlementRecord[]>(mockSettlements);
  const [expenseCategories, setExpenseCategories] =
    useState<ExpenseCategory[]>(mockExpenseCategories);
  const [expenseClaims, setExpenseClaims] = useState<ExpenseClaim[]>(mockExpenseClaims);
  const [performanceCycles, setPerformanceCycles] =
    useState<PerformanceCycle[]>(mockPerformanceCycles);
  const [evaluations, setEvaluations] = useState<EvaluationRecord[]>(mockEvaluations);
  const [workforcePlans, setWorkforcePlans] = useState<WorkforcePlan[]>(mockWorkforcePlans);
  const [jobOpenings, setJobOpenings] = useState<JobOpening[]>(mockJobOpenings);
  const [candidates, setCandidates] = useState<Candidate[]>(mockCandidates);
  const [jobOffers, setJobOffers] = useState<JobOffer[]>(mockJobOffers);
  const [assets, setAssets] = useState<HardwareAsset[]>(mockAssets);
  const [companyDocs, setCompanyDocs] = useState<CompanyDocument[]>(mockCompanyDocs);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(mockAuditLogs);
  const [notifications, setNotifications] = useState<AppNotification[]>(mockNotifications);
  const [accountingJournals, setAccountingJournals] =
    useState<AccountingJournalEntry[]>(mockAccountingJournals);

  const refreshCoreData = useCallback(async () => {
    if (!session || isDemo) return;
    setIsDataLoading(true);
    setDataError(null);
    try {
      const snapshot = await fetchCoreSnapshot();
      setEmployees(snapshot.employees);
      setOrgUnits(snapshot.orgUnits);
      setAttendanceRecords(snapshot.attendanceRecords);
      setRequests(snapshot.requests);
      const operational = await fetchOperationalSnapshot(snapshot.employees, snapshot.orgUnits);
      if (operational.company) setCompany(operational.company);
      setSubsidiaries(operational.subsidiaries);
      setWorkLocations(operational.workLocations);
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
      setDataError(error instanceof Error ? error.message : "تعذر تحميل بيانات النظام");
    } finally {
      setIsDataLoading(false);
    }
  }, [session, isDemo]);

  useEffect(() => {
    if (dataMode === "live") {
      void refreshCoreData();
      return;
    }
    setEmployees(mockEmployees);
    setCompany(mockCompany);
    setSubsidiaries(mockSubsidiaries);
    setOrgUnits(mockOrgUnits);
    setWorkLocations(mockWorkLocations);
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
  }, [dataMode, refreshCoreData]);

  // Active user representation based on role
  const currentUser: Employee =
    (dataMode === "live"
      ? employees.find((e) => e.customFields?.userId === session?.user.id)
      : employees.find((e) => {
          if (currentRole === "super_admin" || currentRole === "hr_manager")
            return e.id === "emp-04"; // Sara (HR Lead)
          if (currentRole === "payroll_officer" || currentRole === "finance_officer")
            return e.id === "emp-02"; // Noura (Finance)
          if (currentRole === "line_manager") return e.id === "emp-01"; // Khalid (Engineering Manager)
          return e.id === "emp-05"; // Mohammed (Employee ESS)
        })) ||
    employees[0] ||
    mockEmployees[0];

  const setLanguage = (lang: Language) => setLanguageState(lang);
  const toggleLanguage = () => setLanguageState((prev) => (prev === "ar" ? "en" : "ar"));

  const persistLiveChange = (operation: () => Promise<void>) => {
    if (dataMode !== "live") return;
    setDataError(null);
    void operation()
      .then(refreshCoreData)
      .catch((error) =>
        setDataError(error instanceof Error ? error.message : "تعذر حفظ التغييرات"),
      );
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
    persistLiveChange(() => createEmployeeRecord(newEmployee));
    logAuditEvent(
      "إضافة موظف جديد",
      "Employee",
      newId,
      `${empData.firstNameAr} ${empData.lastNameAr}`,
      "تم تسجيل الموظف الجديد بنجاح في المنظومة",
    );
  };

  const updateEmployee = (id: string, updates: Partial<Employee>) => {
    setEmployees((prev) => prev.map((e) => (e.id === id ? { ...e, ...updates } : e)));
    persistLiveChange(() => updateEmployeeRecord(id, updates));
    logAuditEvent("تحديث بيانات موظف", "Employee", id, id, "تم تعديل البيانات الوظيفية أو الشخصية");
  };

  const addOrgUnit = (unit: Omit<OrgUnit, "id" | "employeeCount">) => {
    const newUnit: OrgUnit = { ...unit, id: `dept-${Date.now()}`, employeeCount: 0 };
    setOrgUnits((prev) => [newUnit, ...prev]);
    persistLiveChange(() => createOrganizationUnitRecord(unit));
    logAuditEvent(
      "إضافة وحدة تنظيمية",
      "OrgUnit",
      newUnit.id,
      newUnit.nameAr,
      "تم تحديث الهيكل التنظيمي",
    );
  };

  const addSubsidiary = (subsidiary: Omit<Subsidiary, "id" | "employeeCount">) => {
    const newSubsidiary: Subsidiary = { ...subsidiary, id: `sub-${Date.now()}`, employeeCount: 0 };
    setSubsidiaries((prev) => [newSubsidiary, ...prev]);
    persistLiveChange(() => createSubsidiaryRecord(subsidiary));
    logAuditEvent(
      "إضافة شركة فرعية",
      "Subsidiary",
      newSubsidiary.id,
      newSubsidiary.nameAr,
      "تم إنشاء الشركة الفرعية",
    );
  };

  const addWorkLocation = (location: Omit<WorkLocation, "id">) => {
    const newLocation: WorkLocation = { ...location, id: `loc-${Date.now()}` };
    setWorkLocations((prev) => [newLocation, ...prev]);
    persistLiveChange(() => createWorkLocationRecord(location));
    logAuditEvent(
      "إضافة موقع عمل",
      "WorkLocation",
      newLocation.id,
      newLocation.nameAr,
      "تم إعداد الموقع والسياج الجغرافي",
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

  // Workflow Handlers
  const submitRequest = (req: { type: RequestCategory; payload: ServiceRequest["payload"] }) => {
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
    persistLiveChange(() => createRequestRecord(currentUser.id, req.type, req.payload));
    logAuditEvent(
      "تقديم طلب خدمة ذاتية",
      "ServiceRequest",
      newReq.id,
      ref,
      `نوع الطلب: ${req.type}`,
    );
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
    persistLiveChange(async () => {
      await actOnRequestServer({ data: { requestId, decision: "approved", note } });
    });
    logAuditEvent("اعتماد طلب", "ServiceRequest", requestId, requestId, note || "موافقة");
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
    persistLiveChange(async () => {
      await actOnRequestServer({ data: { requestId, decision: "rejected", note } });
    });
    logAuditEvent("رفض طلب", "ServiceRequest", requestId, requestId, note || "تم الرفض");
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
    persistLiveChange(async () => {
      await actOnRequestServer({ data: { requestId, decision: "returned", note } });
    });
    logAuditEvent("إعادة طلب للتصحيح", "ServiceRequest", requestId, requestId, note || "إعادة");
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

  // Leaves
  const applyLeave = (payload: {
    leaveTypeId: string;
    startDate: string;
    endDate: string;
    totalDays: number;
    reason: string;
  }): boolean => {
    const balance = leaveBalances.find((b) => b.leaveTypeId === payload.leaveTypeId);
    if (!balance || balance.availableBalance < payload.totalDays) {
      return false;
    }

    // Reserve balance
    setLeaveBalances((prev) =>
      prev.map((b) =>
        b.leaveTypeId === payload.leaveTypeId
          ? {
              ...b,
              reservedDays: b.reservedDays + payload.totalDays,
              availableBalance: b.availableBalance - payload.totalDays,
            }
          : b,
      ),
    );

    const leaveType = leaveTypes.find((lt) => lt.id === payload.leaveTypeId);
    submitRequest({
      type: "leave",
      payload: {
        ...payload,
        leaveTypeNameAr: leaveType?.nameAr || "إجازة",
      },
    });
    return true;
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
  const punchInOut = (type: "in" | "out", coords?: { lat: number; lng: number }) => {
    const todayStr = new Date().toISOString().split("T")[0];
    const timeStr = new Date().toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    // Check geofence against Headquarters
    let geofenceValid = true;
    if (coords) {
      // Mock simple distance check
      const hqLat = mockWorkLocations[0].latitude;
      const hqLng = mockWorkLocations[0].longitude;
      const dist = Math.sqrt(Math.pow(coords.lat - hqLat, 2) + Math.pow(coords.lng - hqLng, 2));
      geofenceValid = dist < 0.05;
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

    persistLiveChange(() => recordAttendance(currentUser.id, type, todayStr, timeStr));

    logAuditEvent(
      type === "in" ? "تسجيل حضور (Check-in)" : "تسجيل انصراف (Check-out)",
      "AttendanceRecord",
      currentUser.id,
      `${currentUser.firstNameAr} ${currentUser.lastNameAr}`,
      `الوقت: ${timeStr} | السياج الجغرافي: ${geofenceValid ? "صحيح داخل النطاق" : "خارج النطاق"}`,
    );

    return {
      success: true,
      message: type === "in" ? "تم تسجيل حضورك بنجاح" : "تم تسجيل انصرافك بنجاح",
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
      const lateMinutes = attendance.reduce((sum, record) => sum + record.lateMinutes, 0);
      const overtimeHours = attendance.reduce((sum, record) => sum + record.overtimeHours, 0);
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
      const calculation = calculateEmployeePayroll({
        basicSalary: employee.basicSalary,
        housingAllowance,
        transportAllowance,
        otherAllowances,
        calculationBasis: group?.calculationBasis ?? "fixed_30_days",
        daysInMonth,
        absenceDays,
        lateMinutes,
        overtimeHours,
        loanInstallment,
        isSaudiNational:
          employee.nationality.includes("سعود") ||
          employee.nationality.toLowerCase().includes("saudi"),
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
        overtimeHours,
        overtimeAmount: calculation.overtimeAmount,
        retroAdjustments: 0,
        bonusAmount: 0,
        grossSalary: calculation.grossSalary,
        unpaidLeaveDeduction: calculation.unpaidLeaveDeduction,
        absenceLateDeduction: calculation.absenceDeduction + calculation.lateDeduction,
        loanInstallmentDeduction: calculation.loanDeduction,
        gosiEmployeeDeduction: calculation.gosiEmployee,
        otherDeductions: 0,
        totalDeductions: calculation.totalDeductions,
        netSalary: calculation.netSalary,
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
        if (
          !employee ||
          (!employee.nationality.includes("سعود") &&
            !employee.nationality.toLowerCase().includes("saudi"))
        )
          return sum + Math.min(detail.basicSalary + detail.housingAllowance, 45000) * 0.02;
        const pensionRate =
          employee.customFields?.gosiScheme === "new_1445"
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
      await runPayrollServer({ data: { year, month, payrollGroupId: groupId } });
    });
    logAuditEvent(
      "تشغيل مسير الرواتب",
      "PayrollRun",
      newRun.id,
      `مسير ${month}/${year}`,
      "تم تجميع بيانات الحضور والسلف والاستحقاقات",
    );
  };

  const lockAndConfirmPayrollRun = (runId: string) => {
    setPayrollRuns((prev) =>
      prev.map((r) =>
        r.id === runId
          ? { ...r, status: "confirmed_locked", lockedAt: new Date().toISOString() }
          : r,
      ),
    );
    persistLiveChange(async () => {
      await updatePayrollRunStatusServer({ data: { runId, status: "locked" } });
    });
    logAuditEvent(
      "قفل وتأكيد مسير الرواتب",
      "PayrollRun",
      runId,
      runId,
      "تم قفل المسير بعد الاعتماد وتوليد قيود اليومية",
    );
  };

  const markPayrollAsPaid = (runId: string) => {
    setPayrollRuns((prev) =>
      prev.map((r) =>
        r.id === runId ? { ...r, status: "paid", paidAt: new Date().toISOString() } : r,
      ),
    );
    persistLiveChange(async () => {
      await updatePayrollRunStatusServer({ data: { runId, status: "paid" } });
    });
    logAuditEvent(
      "صرف الرواتب وتصدير WPS",
      "PayrollRun",
      runId,
      runId,
      "تم تأكيد تحويل الرواتب لحسابات الموظفين البنكية",
    );
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
        refreshCoreData,
        company,
        subsidiaries,
        orgUnits,
        workLocations,
        employees,
        roles,
        approvalChains,
        requests,
        leaveTypes,
        leaveBalances,
        shifts,
        attendanceRecords,
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
        addEmployee,
        updateEmployee,
        addOrgUnit,
        addSubsidiary,
        addWorkLocation,
        addRole,
        submitRequest,
        approveRequest,
        rejectRequest,
        returnRequest,
        addApprovalChain,
        applyLeave,
        addLeaveType,
        adjustLeaveBalance,
        addShift,
        punchInOut,
        submitAttendanceCorrection,
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
