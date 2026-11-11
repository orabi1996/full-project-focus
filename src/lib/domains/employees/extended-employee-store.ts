// ============================================================================
// EXTENDED EMPLOYEE METADATA & DEMO PERSISTENCE STORE
// Preserves all 5-Step Wizard fields & supports offline/demo browser sessions
// ============================================================================

import type { Employee } from "../../../types";

const EXTENDED_STORAGE_KEY = "madarx_employee_extended_fields_v1";
const DEMO_EMPLOYEES_KEY = "madarx_demo_employees_v1";

const memoryExtendedStore = new Map<string, Partial<Employee>>();
const memoryDemoEmployees = new Map<string, Employee>();

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function loadExtendedMap(): Record<string, Partial<Employee>> {
  if (!canUseStorage()) return {};
  try {
    const raw = window.localStorage.getItem(EXTENDED_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, Partial<Employee>>) : {};
  } catch {
    return {};
  }
}

function saveExtendedMap(map: Record<string, Partial<Employee>>): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(EXTENDED_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore quota errors
  }
}

export function saveEmployeeExtendedFields(employeeId: string, fields: Partial<Employee>): void {
  if (!employeeId) return;
  const existing = getEmployeeExtendedFields(employeeId);
  const merged = { ...existing, ...fields };
  memoryExtendedStore.set(employeeId, merged);

  const map = loadExtendedMap();
  map[employeeId] = merged;
  saveExtendedMap(map);
}

export function getEmployeeExtendedFields(employeeId: string): Partial<Employee> {
  if (!employeeId) return {};
  const mem = memoryExtendedStore.get(employeeId);
  if (mem) return mem;

  const map = loadExtendedMap();
  return map[employeeId] || {};
}

export function getExtendedEmployee(employeeId: string): Partial<Employee> {
  return getEmployeeExtendedFields(employeeId);
}

export function getAllExtendedEmployees(): Record<string, Partial<Employee>> {
  const map = loadExtendedMap();
  for (const [k, v] of memoryExtendedStore.entries()) {
    map[k] = { ...(map[k] || {}), ...v };
  }
  return map;
}

export function mergeEmployeeWithExtendedFields(employee: Employee): Employee {
  const extById = getEmployeeExtendedFields(employee.id);
  const extByEmail = employee.email ? getEmployeeExtendedFields(employee.email) : {};
  return {
    ...extByEmail,
    ...extById,
    ...employee,
    // Prefer extended values when DB row doesn't have dedicated columns for them
    identityType: extById.identityType ?? extByEmail.identityType ?? employee.identityType,
    biometricId: extById.biometricId ?? extByEmail.biometricId ?? employee.biometricId,
    religion: extById.religion ?? extByEmail.religion ?? employee.religion,
    birthPlace: extById.birthPlace ?? extByEmail.birthPlace ?? employee.birthPlace,
    secondaryPhone: extById.secondaryPhone ?? extByEmail.secondaryPhone ?? employee.secondaryPhone,
    workPhone: extById.workPhone ?? extByEmail.workPhone ?? employee.workPhone,
    homeCountryAddress: extById.homeCountryAddress ?? extByEmail.homeCountryAddress ?? employee.homeCountryAddress,
    currentResidenceAddress:
      extById.currentResidenceAddress ?? extByEmail.currentResidenceAddress ?? employee.currentResidenceAddress,
    shortNationalAddress:
      extById.shortNationalAddress ?? extByEmail.shortNationalAddress ?? employee.shortNationalAddress,
    nationalAddress: extById.nationalAddress ?? extByEmail.nationalAddress ?? employee.nationalAddress,
    emergencyContact: extById.emergencyContact ?? extByEmail.emergencyContact ?? employee.emergencyContact,
    region: extById.region ?? extByEmail.region ?? employee.region,
    mainDepartment: extById.mainDepartment ?? extByEmail.mainDepartment ?? employee.mainDepartment,
    careerTrack: extById.careerTrack ?? extByEmail.careerTrack ?? employee.careerTrack,
    sector: extById.sector ?? extByEmail.sector ?? employee.sector,
    currentRoleName: extById.currentRoleName ?? extByEmail.currentRoleName ?? employee.currentRoleName,
    specialization: extById.specialization ?? extByEmail.specialization ?? employee.specialization,
    annualLeaveCalculation:
      extById.annualLeaveCalculation ?? extByEmail.annualLeaveCalculation ?? employee.annualLeaveCalculation,
    experienceYears: extById.experienceYears ?? extByEmail.experienceYears ?? employee.experienceYears,
    probationDays: extById.probationDays ?? extByEmail.probationDays ?? employee.probationDays,
    kingdomEntryDate: extById.kingdomEntryDate ?? extByEmail.kingdomEntryDate ?? employee.kingdomEntryDate,
    highestQualification:
      extById.highestQualification ?? extByEmail.highestQualification ?? employee.highestQualification,
    jobCategory: extById.jobCategory ?? extByEmail.jobCategory ?? employee.jobCategory,
    sponsorName: extById.sponsorName ?? extByEmail.sponsorName ?? employee.sponsorName,
    paymentMethod: extById.paymentMethod ?? extByEmail.paymentMethod ?? employee.paymentMethod,
    bankCommissionStatus:
      extById.bankCommissionStatus ?? extByEmail.bankCommissionStatus ?? employee.bankCommissionStatus,
    bankAccountNumber: extById.bankAccountNumber ?? extByEmail.bankAccountNumber ?? employee.bankAccountNumber,
    lockBankData: extById.lockBankData ?? extByEmail.lockBankData ?? employee.lockBankData,
    customAllowances: extById.customAllowances ?? extByEmail.customAllowances ?? employee.customAllowances,
    customDeductions: extById.customDeductions ?? extByEmail.customDeductions ?? employee.customDeductions,
    contractDurationType:
      extById.contractDurationType ?? extByEmail.contractDurationType ?? employee.contractDurationType,
    contractAnnualLeaveDays:
      extById.contractAnnualLeaveDays ?? extByEmail.contractAnnualLeaveDays ?? employee.contractAnnualLeaveDays,
    annualLeavePolicy: extById.annualLeavePolicy ?? extByEmail.annualLeavePolicy ?? employee.annualLeavePolicy,
    contractWorkPattern:
      extById.contractWorkPattern ?? extByEmail.contractWorkPattern ?? employee.contractWorkPattern,
    workJurisdiction: extById.workJurisdiction ?? extByEmail.workJurisdiction ?? employee.workJurisdiction,
    weeklyWorkDays: extById.weeklyWorkDays ?? extByEmail.weeklyWorkDays ?? employee.weeklyWorkDays,
    workHoursStandard: extById.workHoursStandard ?? extByEmail.workHoursStandard ?? employee.workHoursStandard,
    standardWorkHoursCount:
      extById.standardWorkHoursCount ?? extByEmail.standardWorkHoursCount ?? employee.standardWorkHoursCount,
    weeklyRestDays: extById.weeklyRestDays ?? extByEmail.weeklyRestDays ?? employee.weeklyRestDays,
    qiwaContractClauses:
      extById.qiwaContractClauses ?? extByEmail.qiwaContractClauses ?? employee.qiwaContractClauses,
    contractAttachmentName:
      extById.contractAttachmentName ?? extByEmail.contractAttachmentName ?? employee.contractAttachmentName,
    contractAttachmentUrl:
      extById.contractAttachmentUrl ?? extByEmail.contractAttachmentUrl ?? employee.contractAttachmentUrl,
    contractNotes: extById.contractNotes ?? extByEmail.contractNotes ?? employee.contractNotes,
    contractAutoRenew: extById.contractAutoRenew ?? extByEmail.contractAutoRenew ?? employee.contractAutoRenew,
    avatarUrl: employee.avatarUrl || extById.avatarUrl || extByEmail.avatarUrl,
  };
}

export function saveDemoEmployee(employee: Employee): Employee {
  memoryDemoEmployees.set(employee.id, employee);
  if (canUseStorage()) {
    try {
      const list = getDemoEmployeesList();
      const idx = list.findIndex((e) => e.id === employee.id);
      if (idx >= 0) {
        list[idx] = employee;
      } else {
        list.unshift(employee);
      }
      window.localStorage.setItem(DEMO_EMPLOYEES_KEY, JSON.stringify(list));
    } catch {
      // ignore
    }
  }
  saveEmployeeExtendedFields(employee.id, employee);
  if (employee.email) {
    saveEmployeeExtendedFields(employee.email, employee);
  }
  return employee;
}

export function getDemoEmployeesList(): Employee[] {
  if (!canUseStorage()) {
    return Array.from(memoryDemoEmployees.values());
  }
  try {
    const raw = window.localStorage.getItem(DEMO_EMPLOYEES_KEY);
    const parsed = raw ? (JSON.parse(raw) as Employee[]) : [];
    return parsed.map((e) => mergeEmployeeWithExtendedFields(e));
  } catch {
    return Array.from(memoryDemoEmployees.values());
  }
}

export function getDemoEmployeeById(id: string): Employee | null {
  const fromMem = memoryDemoEmployees.get(id);
  if (fromMem) return mergeEmployeeWithExtendedFields(fromMem);
  const list = getDemoEmployeesList();
  const found = list.find((e) => e.id === id);
  return found ? mergeEmployeeWithExtendedFields(found) : null;
}

export function isOfflineBrowserFetchError(error: { message?: string } | null | undefined): boolean {
  if (!error || typeof window === "undefined") return false;
  // Never intercept in automated unit tests
  if ((import.meta as any).env?.VITEST || (globalThis as any).__vitest_worker__) {
    return false;
  }
  const msg = (error.message || "").toLowerCase();
  return (
    msg.includes("failed to fetch") ||
    msg.includes("fetch failed") ||
    msg.includes("networkerror") ||
    msg.includes("load failed") ||
    Boolean((import.meta as any).env?.VITE_ENABLE_DEMO_MODE === "true")
  );
}
