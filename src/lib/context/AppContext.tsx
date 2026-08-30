import React, { createContext, useContext, useState, useEffect } from 'react';
import type {
  Language,
  Direction,
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
} from '../../types';
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
} from '../mock-data/seed-data';
import { getTranslation } from '../translations';

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
  addEmployee: (emp: Omit<Employee, 'id' | 'completionScore'>) => void;
  updateEmployee: (id: string, updates: Partial<Employee>) => void;
  
  // Requests & Workflow
  submitRequest: (req: { type: any; payload: any }) => void;
  approveRequest: (requestId: string, note?: string) => void;
  rejectRequest: (requestId: string, note?: string) => void;
  returnRequest: (requestId: string, note?: string) => void;

  // Leaves
  applyLeave: (payload: { leaveTypeId: string; startDate: string; endDate: string; totalDays: number; reason: string }) => boolean;

  // Attendance
  punchInOut: (type: 'in' | 'out', coords?: { lat: number; lng: number }) => { success: boolean; message: string; geofenceValid: boolean };
  submitAttendanceCorrection: (payload: { workDate: string; correctIn?: string; correctOut?: string; reason: string }) => void;

  // Payroll & Loans
  processPayrollRun: (groupId: string, year: number, month: number) => void;
  lockAndConfirmPayrollRun: (runId: string) => void;
  markPayrollAsPaid: (runId: string) => void;
  createLoan: (payload: { principalAmount: number; monthlyInstallment: number; totalInstallments: number; reason: string }) => void;
  createSettlement: (settlement: Omit<FinalSettlementRecord, 'id'>) => void;

  // Expenses
  addExpenseClaim: (claim: Omit<ExpenseClaim, 'id' | 'status' | 'policyWarningTriggered'>) => void;

  // ATS / Recruitment
  moveCandidateStage: (candidateId: string, newStage: any) => void;
  sendJobOffer: (offer: Omit<JobOffer, 'id' | 'status'>) => void;

  // Assets & Docs
  assignAsset: (assetId: string, employeeId: string) => void;
  returnAsset: (assetId: string) => void;
  acknowledgeDocument: (docId: string) => void;

  // Notifications & Audit
  markNotificationRead: (id: string) => void;
  logAuditEvent: (action: string, entityType: string, entityId: string, entityName: string, changesSummary: string) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('ar');
  const direction: Direction = language === 'ar' ? 'rtl' : 'ltr';
  const t = getTranslation(language);

  // Sync HTML dir and lang tags
  useEffect(() => {
    document.documentElement.dir = direction;
    document.documentElement.lang = language;
  }, [language, direction]);

  const [currentRole, setCurrentRole] = useState<UserRole>('super_admin');
  
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
  const [leaveBalances, setLeaveBalances] = useState<EmployeeLeaveBalance[]>(mockEmployeeLeaveBalances);
  const [shifts, setShifts] = useState<ShiftDefinition[]>(mockShifts);
  const [attendanceRecords, setAttendanceRecords] = useState<DailyAttendanceRecord[]>(mockAttendanceRecords);
  const [payrollGroups, setPayrollGroups] = useState<PayrollGroup[]>(mockPayrollGroups);
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>(mockPayrollRuns);
  const [payrollDetails, setPayrollDetails] = useState<EmployeePayrollDetail[]>(mockPayrollDetails);
  const [loans, setLoans] = useState<LoanRecord[]>(mockLoans);
  const [settlements, setSettlements] = useState<FinalSettlementRecord[]>(mockSettlements);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>(mockExpenseCategories);
  const [expenseClaims, setExpenseClaims] = useState<ExpenseClaim[]>(mockExpenseClaims);
  const [performanceCycles, setPerformanceCycles] = useState<PerformanceCycle[]>(mockPerformanceCycles);
  const [evaluations, setEvaluations] = useState<EvaluationRecord[]>(mockEvaluations);
  const [workforcePlans, setWorkforcePlans] = useState<WorkforcePlan[]>(mockWorkforcePlans);
  const [jobOpenings, setJobOpenings] = useState<JobOpening[]>(mockJobOpenings);
  const [candidates, setCandidates] = useState<Candidate[]>(mockCandidates);
  const [jobOffers, setJobOffers] = useState<JobOffer[]>(mockJobOffers);
  const [assets, setAssets] = useState<HardwareAsset[]>(mockAssets);
  const [companyDocs, setCompanyDocs] = useState<CompanyDocument[]>(mockCompanyDocs);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(mockAuditLogs);
  const [notifications, setNotifications] = useState<AppNotification[]>(mockNotifications);
  const [accountingJournals, setAccountingJournals] = useState<AccountingJournalEntry[]>(mockAccountingJournals);

  // Active user representation based on role
  const currentUser: Employee = employees.find(e => {
    if (currentRole === 'super_admin' || currentRole === 'hr_manager') return e.id === 'emp-04'; // Sara (HR Lead)
    if (currentRole === 'payroll_officer' || currentRole === 'finance_officer') return e.id === 'emp-02'; // Noura (Finance)
    if (currentRole === 'line_manager') return e.id === 'emp-01'; // Khalid (Engineering Manager)
    return e.id === 'emp-05'; // Mohammed (Employee ESS)
  }) || employees[0];

  const setLanguage = (lang: Language) => setLanguageState(lang);
  const toggleLanguage = () => setLanguageState(prev => (prev === 'ar' ? 'en' : 'ar'));

  const logAuditEvent = (action: string, entityType: string, entityId: string, entityName: string, changesSummary: string) => {
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
    setAuditLogs(prev => [newLog, ...prev]);
  };

  const addEmployee = (empData: Omit<Employee, 'id' | 'completionScore'>) => {
    const newId = `emp-${Date.now()}`;
    const newEmployee: Employee = {
      ...empData,
      id: newId,
      completionScore: 90,
    };
    setEmployees(prev => [newEmployee, ...prev]);
    logAuditEvent('إضافة موظف جديد', 'Employee', newId, `${empData.firstNameAr} ${empData.lastNameAr}`, 'تم تسجيل الموظف الجديد بنجاح في المنظومة');
  };

  const updateEmployee = (id: string, updates: Partial<Employee>) => {
    setEmployees(prev => prev.map(e => (e.id === id ? { ...e, ...updates } : e)));
    logAuditEvent('تحديث بيانات موظف', 'Employee', id, id, 'تم تعديل البيانات الوظيفية أو الشخصية');
  };

  // Workflow Handlers
  const submitRequest = (req: { type: any; payload: any }) => {
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
      status: 'pending_approval',
      currentStepIndex: 1,
      totalSteps: 2,
      currentApproverRole: 'المدير المباشر',
      submittedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      payload: req.payload,
      timeline: [
        {
          id: `tl-${Date.now()}`,
          stepNumber: 1,
          actorId: currentUser.id,
          actorName: `${currentUser.firstNameAr} ${currentUser.lastNameAr}`,
          actorRole: 'مقدم الطلب',
          action: 'submitted',
          note: 'تم إرسال الطلب بنجاح إلى مسار الاعتماد',
          timestamp: new Date().toISOString(),
        },
      ],
    };

    setRequests(prev => [newReq, ...prev]);
    logAuditEvent('تقديم طلب خدمة ذاتية', 'ServiceRequest', newReq.id, ref, `نوع الطلب: ${req.type}`);
  };

  const approveRequest = (requestId: string, note?: string) => {
    setRequests(prev =>
      prev.map(r => {
        if (r.id !== requestId) return r;
        const nextStep = r.currentStepIndex + 1;
        const isComplete = nextStep > r.totalSteps;
        return {
          ...r,
          status: isComplete ? 'approved' : 'pending_approval',
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
              action: 'approved',
              note: note || 'تمت الموافقة من قبل المسؤول',
              timestamp: new Date().toISOString(),
            },
          ],
        };
      })
    );
    logAuditEvent('اعتماد طلب', 'ServiceRequest', requestId, requestId, note || 'موافقة');
  };

  const rejectRequest = (requestId: string, note?: string) => {
    setRequests(prev =>
      prev.map(r => {
        if (r.id !== requestId) return r;
        return {
          ...r,
          status: 'rejected',
          updatedAt: new Date().toISOString(),
          timeline: [
            ...r.timeline,
            {
              id: `tl-${Date.now()}`,
              stepNumber: r.currentStepIndex,
              actorId: currentUser.id,
              actorName: `${currentUser.firstNameAr} ${currentUser.lastNameAr}`,
              actorRole: currentRole,
              action: 'rejected',
              note: note || 'تم رفض الطلب',
              timestamp: new Date().toISOString(),
            },
          ],
        };
      })
    );
    logAuditEvent('رفض طلب', 'ServiceRequest', requestId, requestId, note || 'تم الرفض');
  };

  const returnRequest = (requestId: string, note?: string) => {
    setRequests(prev =>
      prev.map(r => {
        if (r.id !== requestId) return r;
        return {
          ...r,
          status: 'returned',
          updatedAt: new Date().toISOString(),
          timeline: [
            ...r.timeline,
            {
              id: `tl-${Date.now()}`,
              stepNumber: r.currentStepIndex,
              actorId: currentUser.id,
              actorName: `${currentUser.firstNameAr} ${currentUser.lastNameAr}`,
              actorRole: currentRole,
              action: 'returned',
              note: note || 'أعيد للموظف لاستكمال الملاحظات',
              timestamp: new Date().toISOString(),
            },
          ],
        };
      })
    );
    logAuditEvent('إعادة طلب للتصحيح', 'ServiceRequest', requestId, requestId, note || 'إعادة');
  };

  // Leaves
  const applyLeave = (payload: { leaveTypeId: string; startDate: string; endDate: string; totalDays: number; reason: string }): boolean => {
    const balance = leaveBalances.find(b => b.leaveTypeId === payload.leaveTypeId);
    if (!balance || balance.availableBalance < payload.totalDays) {
      return false;
    }

    // Reserve balance
    setLeaveBalances(prev =>
      prev.map(b =>
        b.leaveTypeId === payload.leaveTypeId
          ? {
              ...b,
              reservedDays: b.reservedDays + payload.totalDays,
              availableBalance: b.availableBalance - payload.totalDays,
            }
          : b
      )
    );

    const leaveType = leaveTypes.find(lt => lt.id === payload.leaveTypeId);
    submitRequest({
      type: 'leave',
      payload: {
        ...payload,
        leaveTypeNameAr: leaveType?.nameAr || 'إجازة',
      },
    });
    return true;
  };

  // Attendance Punch
  const punchInOut = (type: 'in' | 'out', coords?: { lat: number; lng: number }) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    
    // Check geofence against Headquarters
    let geofenceValid = true;
    if (coords) {
      // Mock simple distance check
      const hqLat = mockWorkLocations[0].latitude;
      const hqLng = mockWorkLocations[0].longitude;
      const dist = Math.sqrt(Math.pow(coords.lat - hqLat, 2) + Math.pow(coords.lng - hqLng, 2));
      geofenceValid = dist < 0.05;
    }

    setAttendanceRecords(prev => {
      const existing = prev.find(a => a.employeeId === currentUser.id && a.workDate === todayStr);
      if (existing) {
        return prev.map(a =>
          a.id === existing.id
            ? {
                ...a,
                actualOut: type === 'out' ? timeStr : a.actualOut,
                actualIn: type === 'in' ? timeStr : a.actualIn,
                status: 'present',
                geofenceValid,
              }
            : a
        );
      } else {
        const newRecord: DailyAttendanceRecord = {
          id: `att-${Date.now()}`,
          employeeId: currentUser.id,
          employeeNo: currentUser.employeeNo,
          employeeName: `${currentUser.firstNameAr} ${currentUser.lastNameAr}`,
          departmentName: currentUser.departmentName || '',
          workDate: todayStr,
          actualIn: type === 'in' ? timeStr : undefined,
          actualOut: type === 'out' ? timeStr : undefined,
          status: 'present',
          lateMinutes: 0,
          earlyDepartureMinutes: 0,
          workedHours: 8.0,
          overtimeHours: 0,
          punchSource: 'mobile_gps',
          geofenceValid,
          violationsCount: 0,
          reviewedByPayroll: false,
        };
        return [newRecord, ...prev];
      }
    });

    logAuditEvent(
      type === 'in' ? 'تسجيل حضور (Check-in)' : 'تسجيل انصراف (Check-out)',
      'AttendanceRecord',
      currentUser.id,
      `${currentUser.firstNameAr} ${currentUser.lastNameAr}`,
      `الوقت: ${timeStr} | السياج الجغرافي: ${geofenceValid ? 'صحيح داخل النطاق' : 'خارج النطاق'}`
    );

    return {
      success: true,
      message: type === 'in' ? 'تم تسجيل حضورك بنجاح' : 'تم تسجيل انصرافك بنجاح',
      geofenceValid,
    };
  };

  const submitAttendanceCorrection = (payload: { workDate: string; correctIn?: string; correctOut?: string; reason: string }) => {
    submitRequest({
      type: 'attendance_correction',
      payload,
    });
  };

  // Payroll Operations
  const processPayrollRun = (groupId: string, year: number, month: number) => {
    const group = payrollGroups.find(g => g.id === groupId);
    const newRun: PayrollRun = {
      id: `pr-${year}-${String(month).padStart(2, '0')}`,
      payrollGroupId: groupId,
      payrollGroupName: group?.nameAr || 'المجموعة الرئيسية',
      periodYear: year,
      periodMonth: month,
      status: 'ready_for_review',
      totalEmployees: employees.length,
      totalBasicSalary: employees.reduce((sum, e) => sum + e.basicSalary, 0),
      totalAllowances: employees.reduce((sum, e) => sum + (e.totalSalary - e.basicSalary), 0),
      totalOvertimeAmount: 12500,
      totalDeductions: 18400,
      totalNetSalary: employees.reduce((sum, e) => sum + e.totalSalary, 0) + 12500 - 18400,
      totalEmployerGosi: 21500,
    };

    setPayrollRuns(prev => [newRun, ...prev.filter(r => r.id !== newRun.id)]);
    logAuditEvent('تشغيل مسير الرواتب', 'PayrollRun', newRun.id, `مسير ${month}/${year}`, 'تم تجميع بيانات الحضور والسلف والاستحقاقات');
  };

  const lockAndConfirmPayrollRun = (runId: string) => {
    setPayrollRuns(prev =>
      prev.map(r => (r.id === runId ? { ...r, status: 'confirmed_locked', lockedAt: new Date().toISOString() } : r))
    );
    logAuditEvent('قفل وتأكيد مسير الرواتب', 'PayrollRun', runId, runId, 'تم قفل المسير بعد الاعتماد وتوليد قيود اليومية');
  };

  const markPayrollAsPaid = (runId: string) => {
    setPayrollRuns(prev =>
      prev.map(r => (r.id === runId ? { ...r, status: 'paid', paidAt: new Date().toISOString() } : r))
    );
    logAuditEvent('صرف الرواتب وتصدير WPS', 'PayrollRun', runId, runId, 'تم تأكيد تحويل الرواتب لحسابات الموظفين البنكية');
  };

  const createLoan = (payload: { principalAmount: number; monthlyInstallment: number; totalInstallments: number; reason: string }) => {
    const newLoan: LoanRecord = {
      id: `loan-${Date.now()}`,
      employeeId: currentUser.id,
      employeeName: `${currentUser.firstNameAr} ${currentUser.lastNameAr}`,
      loanType: 'personal_advance',
      principalAmount: payload.principalAmount,
      monthlyInstallment: payload.monthlyInstallment,
      totalInstallments: payload.totalInstallments,
      paidInstallments: 0,
      remainingBalance: payload.principalAmount,
      startDate: new Date().toISOString().split('T')[0],
      status: 'active',
    };
    setLoans(prev => [newLoan, ...prev]);
    submitRequest({
      type: 'loan_advance',
      payload,
    });
  };

  const createSettlement = (settlementData: Omit<FinalSettlementRecord, 'id'>) => {
    const newSettlement: FinalSettlementRecord = {
      ...settlementData,
      id: `set-${Date.now()}`,
    };
    setSettlements(prev => [newSettlement, ...prev]);
    logAuditEvent('إنشاء مخالصة نهاية خدمة', 'FinalSettlement', newSettlement.id, newSettlement.employeeName, `صافي المستحق: ${newSettlement.netSettlementAmount} ر.س`);
  };

  // Expenses
  const addExpenseClaim = (claimData: Omit<ExpenseClaim, 'id' | 'status' | 'policyWarningTriggered'>) => {
    const cat = expenseCategories.find(c => c.id === claimData.categoryId);
    const isWarning = cat ? claimData.amount > cat.maxLimitWarning : false;
    const newClaim: ExpenseClaim = {
      ...claimData,
      id: `claim-${Date.now()}`,
      status: 'submitted',
      policyWarningTriggered: isWarning,
    };
    setExpenseClaims(prev => [newClaim, ...prev]);
    submitRequest({
      type: 'expense_claim',
      payload: {
        categoryNameAr: claimData.categoryNameAr,
        amount: claimData.amount,
        merchantName: claimData.merchantName,
        description: claimData.description,
      },
    });
  };

  // ATS
  const moveCandidateStage = (candidateId: string, newStage: any) => {
    setCandidates(prev => prev.map(c => (c.id === candidateId ? { ...c, stage: newStage } : c)));
    const candidate = candidates.find(c => c.id === candidateId);
    logAuditEvent('نقل مرشح لمرحلة جديدة', 'Candidate', candidateId, candidate?.fullName || '', `المرحلة: ${newStage}`);
  };

  const sendJobOffer = (offerData: Omit<JobOffer, 'id' | 'status'>) => {
    const newOffer: JobOffer = {
      ...offerData,
      id: `off-${Date.now()}`,
      status: 'sent_to_candidate',
    };
    setJobOffers(prev => [newOffer, ...prev]);
    moveCandidateStage(offerData.candidateId, 'job_offer');
    logAuditEvent('إصدار عرض عمل رسمي', 'JobOffer', newOffer.id, offerData.candidateName, `الراتب الأساسي: ${offerData.basicSalary} ر.س`);
  };

  // Assets & Docs
  const assignAsset = (assetId: string, employeeId: string) => {
    const emp = employees.find(e => e.id === employeeId);
    setAssets(prev =>
      prev.map(a =>
        a.id === assetId
          ? {
              ...a,
              status: 'assigned',
              assignedToEmployeeId: employeeId,
              assignedToEmployeeName: emp ? `${emp.firstNameAr} ${emp.lastNameAr}` : '',
              assignedDate: new Date().toISOString().split('T')[0],
            }
          : a
      )
    );
  };

  const returnAsset = (assetId: string) => {
    setAssets(prev =>
      prev.map(a =>
        a.id === assetId
          ? {
              ...a,
              status: 'available',
              assignedToEmployeeId: null,
              assignedToEmployeeName: undefined,
              assignedDate: undefined,
            }
          : a
      )
    );
  };

  const acknowledgeDocument = (docId: string) => {
    setCompanyDocs(prev =>
      prev.map(d => (d.id === docId ? { ...d, acknowledgedCount: d.acknowledgedCount + 1 } : d))
    );
  };

  const markNotificationRead = (id: string) => {
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, isRead: true } : n)));
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
        submitRequest,
        approveRequest,
        rejectRequest,
        returnRequest,
        applyLeave,
        punchInOut,
        submitAttendanceCorrection,
        processPayrollRun,
        lockAndConfirmPayrollRun,
        markPayrollAsPaid,
        createLoan,
        createSettlement,
        addExpenseClaim,
        moveCandidateStage,
        sendJobOffer,
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
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
