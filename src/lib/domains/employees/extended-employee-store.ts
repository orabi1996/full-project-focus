// ============================================================================
// EXTENDED EMPLOYEE METADATA, LIVE TABLE FALLBACK & DEMO PERSISTENCE STORE
// Preserves all 5-Step Wizard fields & supports both Live Supabase Table
// fallback (when custom RPCs are not in PostgREST schema cache) and Demo Mode.
// ============================================================================

import type {
  Employee,
  EmployeeDirectoryFilters,
  EmployeeDirectoryItem,
  EmployeeDirectoryKpis,
  EmployeeDirectoryResponse,
  EmployeeStatus,
  ContractType,
  Gender,
} from "../../../types";
import { supabase } from "../../../integrations/supabase/client";

const EXTENDED_STORAGE_KEY = "madarx_employee_extended_fields_v1";
const DEMO_EMPLOYEES_KEY = "madarx_demo_employees_v1";

const memoryExtendedStore = new Map<string, Partial<Employee>>();
const memoryDemoEmployees = new Map<string, Employee>();

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toValidUuidOrNull(val: string | null | undefined): string | null {
  if (!val || typeof val !== "string") return null;
  const trimmed = val.trim();
  return UUID_REGEX.test(trimmed) ? trimmed : null;
}

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
  const meta = (employee.customFields && typeof employee.customFields === "object"
    ? employee.customFields
    : {}) as Partial<Employee>;
  return {
    ...meta,
    ...extByEmail,
    ...extById,
    ...employee,
    housingAllowance:
      employee.housingAllowance || extById.housingAllowance || extByEmail.housingAllowance || Number(meta.housingAllowance || 0),
    transportAllowance:
      employee.transportAllowance || extById.transportAllowance || extByEmail.transportAllowance || Number(meta.transportAllowance || 0),
    otherAllowances:
      employee.otherAllowances || extById.otherAllowances || extByEmail.otherAllowances || Number(meta.otherAllowances || 0),
    workType: employee.workType ?? extById.workType ?? extByEmail.workType ?? meta.workType ?? null,
    jobGrade: employee.jobGrade || extById.jobGrade || extByEmail.jobGrade || meta.jobGrade,
    gosiNumber: employee.gosiNumber || extById.gosiNumber || extByEmail.gosiNumber || meta.gosiNumber,
    qiwaContractNo: employee.qiwaContractNo || extById.qiwaContractNo || extByEmail.qiwaContractNo || meta.qiwaContractNo,
    contractStartDate:
      employee.contractStartDate ?? extById.contractStartDate ?? extByEmail.contractStartDate ?? meta.contractStartDate,
    contractEndDate:
      employee.contractEndDate || extById.contractEndDate || extByEmail.contractEndDate || meta.contractEndDate,
    nationalIdExpiry:
      employee.nationalIdExpiry || extById.nationalIdExpiry || extByEmail.nationalIdExpiry || meta.nationalIdExpiry,
    passportNo: employee.passportNo || extById.passportNo || extByEmail.passportNo || meta.passportNo,
    passportExpiry:
      employee.passportExpiry || extById.passportExpiry || extByEmail.passportExpiry || meta.passportExpiry,
    bloodType: employee.bloodType || extById.bloodType || extByEmail.bloodType || meta.bloodType,
    dependentsCount:
      employee.dependentsCount || extById.dependentsCount || extByEmail.dependentsCount || Number(meta.dependentsCount || 0),
    identityType: extById.identityType ?? extByEmail.identityType ?? meta.identityType ?? employee.identityType,
    biometricId: extById.biometricId ?? extByEmail.biometricId ?? meta.biometricId ?? employee.biometricId,
    religion: extById.religion ?? extByEmail.religion ?? meta.religion ?? employee.religion,
    birthPlace: extById.birthPlace ?? extByEmail.birthPlace ?? meta.birthPlace ?? employee.birthPlace,
    secondaryPhone: extById.secondaryPhone ?? extByEmail.secondaryPhone ?? meta.secondaryPhone ?? employee.secondaryPhone,
    workPhone: extById.workPhone ?? extByEmail.workPhone ?? meta.workPhone ?? employee.workPhone,
    homeCountryAddress:
      extById.homeCountryAddress ?? extByEmail.homeCountryAddress ?? meta.homeCountryAddress ?? employee.homeCountryAddress,
    currentResidenceAddress:
      extById.currentResidenceAddress ??
      extByEmail.currentResidenceAddress ??
      meta.currentResidenceAddress ??
      employee.currentResidenceAddress,
    shortNationalAddress:
      extById.shortNationalAddress ??
      extByEmail.shortNationalAddress ??
      meta.shortNationalAddress ??
      employee.shortNationalAddress,
    nationalAddress:
      extById.nationalAddress ?? extByEmail.nationalAddress ?? meta.nationalAddress ?? employee.nationalAddress,
    emergencyContact:
      extById.emergencyContact ?? extByEmail.emergencyContact ?? meta.emergencyContact ?? employee.emergencyContact,
    region: extById.region ?? extByEmail.region ?? meta.region ?? employee.region,
    mainDepartment:
      extById.mainDepartment ?? extByEmail.mainDepartment ?? meta.mainDepartment ?? employee.mainDepartment,
    careerTrack: extById.careerTrack ?? extByEmail.careerTrack ?? meta.careerTrack ?? employee.careerTrack,
    sector: extById.sector ?? extByEmail.sector ?? meta.sector ?? employee.sector,
    currentRoleName:
      extById.currentRoleName ?? extByEmail.currentRoleName ?? meta.currentRoleName ?? employee.currentRoleName,
    specialization:
      extById.specialization ?? extByEmail.specialization ?? meta.specialization ?? employee.specialization,
    annualLeaveCalculation:
      extById.annualLeaveCalculation ??
      extByEmail.annualLeaveCalculation ??
      meta.annualLeaveCalculation ??
      employee.annualLeaveCalculation,
    experienceYears:
      extById.experienceYears ?? extByEmail.experienceYears ?? meta.experienceYears ?? employee.experienceYears,
    probationDays: extById.probationDays ?? extByEmail.probationDays ?? meta.probationDays ?? employee.probationDays,
    kingdomEntryDate:
      extById.kingdomEntryDate ?? extByEmail.kingdomEntryDate ?? meta.kingdomEntryDate ?? employee.kingdomEntryDate,
    highestQualification:
      extById.highestQualification ??
      extByEmail.highestQualification ??
      meta.highestQualification ??
      employee.highestQualification,
    jobCategory: extById.jobCategory ?? extByEmail.jobCategory ?? meta.jobCategory ?? employee.jobCategory,
    sponsorName: extById.sponsorName ?? extByEmail.sponsorName ?? meta.sponsorName ?? employee.sponsorName,
    paymentMethod: extById.paymentMethod ?? extByEmail.paymentMethod ?? meta.paymentMethod ?? employee.paymentMethod,
    bankCommissionStatus:
      extById.bankCommissionStatus ??
      extByEmail.bankCommissionStatus ??
      meta.bankCommissionStatus ??
      employee.bankCommissionStatus,
    bankAccountNumber:
      extById.bankAccountNumber ?? extByEmail.bankAccountNumber ?? meta.bankAccountNumber ?? employee.bankAccountNumber,
    lockBankData: extById.lockBankData ?? extByEmail.lockBankData ?? meta.lockBankData ?? employee.lockBankData,
    customAllowances:
      extById.customAllowances ?? extByEmail.customAllowances ?? meta.customAllowances ?? employee.customAllowances,
    customDeductions:
      extById.customDeductions ?? extByEmail.customDeductions ?? meta.customDeductions ?? employee.customDeductions,
    contractDurationType:
      extById.contractDurationType ??
      extByEmail.contractDurationType ??
      meta.contractDurationType ??
      employee.contractDurationType,
    contractAnnualLeaveDays:
      extById.contractAnnualLeaveDays ??
      extByEmail.contractAnnualLeaveDays ??
      meta.contractAnnualLeaveDays ??
      employee.contractAnnualLeaveDays,
    annualLeavePolicy:
      extById.annualLeavePolicy ?? extByEmail.annualLeavePolicy ?? meta.annualLeavePolicy ?? employee.annualLeavePolicy,
    contractWorkPattern:
      extById.contractWorkPattern ??
      extByEmail.contractWorkPattern ??
      meta.contractWorkPattern ??
      employee.contractWorkPattern,
    workJurisdiction:
      extById.workJurisdiction ?? extByEmail.workJurisdiction ?? meta.workJurisdiction ?? employee.workJurisdiction,
    weeklyWorkDays:
      extById.weeklyWorkDays ?? extByEmail.weeklyWorkDays ?? meta.weeklyWorkDays ?? employee.weeklyWorkDays,
    workHoursStandard:
      extById.workHoursStandard ?? extByEmail.workHoursStandard ?? meta.workHoursStandard ?? employee.workHoursStandard,
    standardWorkHoursCount:
      extById.standardWorkHoursCount ??
      extByEmail.standardWorkHoursCount ??
      meta.standardWorkHoursCount ??
      employee.standardWorkHoursCount,
    weeklyRestDays:
      extById.weeklyRestDays ?? extByEmail.weeklyRestDays ?? meta.weeklyRestDays ?? employee.weeklyRestDays,
    qiwaContractClauses:
      extById.qiwaContractClauses ??
      extByEmail.qiwaContractClauses ??
      meta.qiwaContractClauses ??
      employee.qiwaContractClauses,
    contractAttachmentName:
      extById.contractAttachmentName ??
      extByEmail.contractAttachmentName ??
      meta.contractAttachmentName ??
      employee.contractAttachmentName,
    contractAttachmentUrl:
      extById.contractAttachmentUrl ??
      extByEmail.contractAttachmentUrl ??
      meta.contractAttachmentUrl ??
      employee.contractAttachmentUrl,
    contractNotes: extById.contractNotes ?? extByEmail.contractNotes ?? meta.contractNotes ?? employee.contractNotes,
    contractAutoRenew:
      extById.contractAutoRenew ?? extByEmail.contractAutoRenew ?? meta.contractAutoRenew ?? employee.contractAutoRenew,
    avatarUrl: employee.avatarUrl || extById.avatarUrl || extByEmail.avatarUrl || meta.avatarUrl,
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

export function isOfflineBrowserFetchError(
  error: { message?: string; code?: string } | null | undefined
): boolean {
  if (!error || typeof window === "undefined") return false;
  // Never intercept in automated unit tests
  if ((import.meta as any).env?.VITEST || (globalThis as any).__vitest_worker__) {
    return false;
  }
  const msg = (error.message || "").toLowerCase();
  const code = (error.code || "").toLowerCase();
  return (
    msg.includes("failed to fetch") ||
    msg.includes("fetch failed") ||
    msg.includes("networkerror") ||
    msg.includes("load failed") ||
    msg.includes("schema cache") ||
    msg.includes("could not find the function") ||
    code === "pgrst202" ||
    code === "42883" ||
    Boolean((import.meta as any).env?.VITE_ENABLE_DEMO_MODE === "true")
  );
}

/**
 * Inserts a newly onboarded employee directly into `public.employees` when the
 * `public.create_employee` RPC is not present in the PostgREST schema cache,
 * falling back to local demo persistence if offline or blocked by RLS.
 */
export async function persistEmployeeWhenRpcUnavailable(
  employee: Employee,
  completionScore: number
): Promise<Employee> {
  const firstName = employee.firstNameAr?.trim() || "";
  const lastName = employee.lastNameAr?.trim() || "";
  const fullName = `${firstName} ${lastName}`.trim();
  const generatedNo =
    employee.employeeNo?.trim() || `MX-${Math.floor(100000 + Math.random() * 900000)}`;

  const basicSalary = Number(employee.basicSalary || 0);
  const housingAllowance = Number(employee.housingAllowance || 0);
  const transportAllowance = Number(employee.transportAllowance || 0);
  const otherAllowances = Number(employee.otherAllowances || 0);
  const totalSalary =
    Number(employee.totalSalary) ||
    basicSalary + housingAllowance + transportAllowance + otherAllowances;

  const validDbStatuses = new Set(["active", "on_leave", "suspended", "terminated", "draft"]);
  const dbStatus = validDbStatuses.has(employee.status) ? employee.status : "active";

  const metadataPayload: Record<string, unknown> = {
    ...(employee.customFields || {}),
    housingAllowance,
    transportAllowance,
    otherAllowances,
    jobTitleEn: employee.jobTitleEn || null,
    jobPositionId: employee.jobPositionId || null,
    costCenterId: employee.costCenterId || null,
    workType: employee.workType || null,
    jobGrade: employee.jobGrade || null,
    gosiNumber: employee.gosiNumber || null,
    qiwaContractNo: employee.qiwaContractNo || null,
    contractStartDate: employee.contractStartDate || null,
    contractEndDate: employee.contractEndDate || null,
    nationalIdExpiry: employee.nationalIdExpiry || null,
    passportNo: employee.passportNo || null,
    passportExpiry: employee.passportExpiry || null,
    bloodType: employee.bloodType || null,
    dependentsCount: employee.dependentsCount ?? 0,
    identityType: employee.identityType || null,
    biometricId: employee.biometricId || null,
    religion: employee.religion || null,
    birthPlace: employee.birthPlace || null,
    secondaryPhone: employee.secondaryPhone || null,
    workPhone: employee.workPhone || null,
    homeCountryAddress: employee.homeCountryAddress || null,
    currentResidenceAddress: employee.currentResidenceAddress || null,
    shortNationalAddress: employee.shortNationalAddress || null,
    nationalAddress: employee.nationalAddress || null,
    emergencyContact: employee.emergencyContact || null,
    region: employee.region || null,
    mainDepartment: employee.mainDepartment || null,
    careerTrack: employee.careerTrack || null,
    sector: employee.sector || null,
    currentRoleName: employee.currentRoleName || null,
    specialization: employee.specialization || null,
    annualLeaveCalculation: employee.annualLeaveCalculation || null,
    experienceYears: employee.experienceYears ?? null,
    probationDays: employee.probationDays ?? null,
    kingdomEntryDate: employee.kingdomEntryDate || null,
    highestQualification: employee.highestQualification || null,
    jobCategory: employee.jobCategory || null,
    sponsorName: employee.sponsorName || null,
    paymentMethod: employee.paymentMethod || null,
    bankCommissionStatus: employee.bankCommissionStatus || null,
    bankAccountNumber: employee.bankAccountNumber || null,
    lockBankData: employee.lockBankData ?? false,
    customAllowances: employee.customAllowances || [],
    customDeductions: employee.customDeductions || [],
    contractDurationType: employee.contractDurationType || null,
    contractAnnualLeaveDays: employee.contractAnnualLeaveDays ?? null,
    annualLeavePolicy: employee.annualLeavePolicy || null,
    contractWorkPattern: employee.contractWorkPattern || null,
    workJurisdiction: employee.workJurisdiction || null,
    weeklyWorkDays: employee.weeklyWorkDays ?? 5,
    workHoursStandard: employee.workHoursStandard || "daily",
    standardWorkHoursCount: employee.standardWorkHoursCount ?? 8,
    weeklyRestDays: employee.weeklyRestDays ?? 2,
    qiwaContractClauses: employee.qiwaContractClauses || null,
    contractAttachmentName: employee.contractAttachmentName || null,
    contractAttachmentUrl: employee.contractAttachmentUrl || null,
    contractNotes: employee.contractNotes || null,
    contractAutoRenew: employee.contractAutoRenew ?? true,
    avatarUrl: employee.avatarUrl || null,
    lifecycleStatus: employee.status || "active",
  };

  const buildRowInsert = (empNo: string) => ({
    employee_no: empNo,
    full_name: fullName,
    first_name_ar: firstName || null,
    last_name_ar: lastName || null,
    first_name_en: employee.firstNameEn || null,
    last_name_en: employee.lastNameEn || null,
    email: employee.email || null,
    personal_email: employee.personalEmail || null,
    work_email: employee.email || null,
    phone: employee.phone || null,
    national_id_or_iqama: employee.nationalIdOrIqama || null,
    nationality: employee.nationality || null,
    gender: employee.gender || null,
    birth_date: employee.birthDate || null,
    marital_status: employee.maritalStatus || null,
    hire_date: employee.hireDate || new Date().toISOString().slice(0, 10),
    probation_end_date: employee.probationEndDate || null,
    contract_type: employee.contractType || "full_time",
    job_title: employee.jobTitleAr || employee.jobTitleEn || "موظف",
    position_title: employee.currentRoleName || employee.jobTitleEn || null,
    department_id: toValidUuidOrNull(employee.departmentId),
    subsidiary_id: toValidUuidOrNull(employee.subsidiaryId),
    work_location_id: toValidUuidOrNull(employee.workLocationId),
    location_id: toValidUuidOrNull(employee.workLocationId),
    manager_id: toValidUuidOrNull(employee.managerId),
    company_id: toValidUuidOrNull(employee.companyId),
    basic_salary: basicSalary,
    total_salary: totalSalary,
    bank_name: employee.bankName || null,
    iban: employee.iban || null,
    status: dbStatus as any,
    completion_score: completionScore,
    metadata: metadataPayload as any,
  });

  try {
    let { data: inserted, error: insertErr } = await supabase
      .from("employees")
      .insert(buildRowInsert(generatedNo) as any)
      .select("*")
      .single();

    // If duplicate employee_no, retry once with a fresh number
    if (insertErr && insertErr.code === "23505") {
      const retryNo = `MX-${Date.now().toString().slice(-6)}`;
      const retryRes = await supabase
        .from("employees")
        .insert(buildRowInsert(retryNo) as any)
        .select("*")
        .single();
      inserted = retryRes.data;
      insertErr = retryRes.error;
    }

    if (!insertErr && inserted && inserted.id) {
      const finalCreated: Employee = {
        ...employee,
        id: String(inserted.id),
        employeeNo: String(inserted.employee_no || generatedNo),
        companyId: inserted.company_id ? String(inserted.company_id) : employee.companyId,
        status: employee.status || (inserted.status as EmployeeStatus) || "active",
        completionScore,
      };
      return saveDemoEmployee(finalCreated);
    }
  } catch {
    // Fallback to local demo store below
  }

  const demoId = employee.id || `emp-demo-${Date.now()}`;
  const demoEmp: Employee = {
    ...employee,
    id: demoId,
    employeeNo: generatedNo,
    status: employee.status || "draft",
    completionScore,
  };
  return saveDemoEmployee(demoEmp);
}

/**
 * Updates an employee row directly in `public.employees` when an update RPC
 * (`update_employee_*` or `change_employee_status`) is missing from the schema cache.
 */
export async function updateEmployeeWhenRpcUnavailable(
  employeeId: string,
  dbColumns: Record<string, unknown>,
  extendedUpdates?: Partial<Employee>
): Promise<{ id: string }> {
  if (extendedUpdates) {
    saveEmployeeExtendedFields(employeeId, extendedUpdates);
    const existingDemo = getDemoEmployeeById(employeeId);
    if (existingDemo) {
      saveDemoEmployee({ ...existingDemo, ...extendedUpdates });
    }
  }

  if (toValidUuidOrNull(employeeId)) {
    try {
      await supabase
        .from("employees")
        .update({
          ...dbColumns,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", employeeId);
    } catch {
      // ignore if offline
    }
  }

  return { id: employeeId };
}

/**
 * Queries `public.employees` directly when `get_employee_directory` RPC is missing from schema cache.
 */
export async function fetchDirectoryWhenRpcUnavailable(
  filters: EmployeeDirectoryFilters = {}
): Promise<EmployeeDirectoryResponse> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.max(1, filters.pageSize ?? 25);

  try {
    let query = supabase.from("employees").select("*", { count: "exact" });

    if (filters.status) {
      query = query.eq("status", filters.status as any);
    }
    if (filters.departmentId && toValidUuidOrNull(filters.departmentId)) {
      query = query.eq("department_id", filters.departmentId);
    }
    if (filters.subsidiaryId && toValidUuidOrNull(filters.subsidiaryId)) {
      query = query.eq("subsidiary_id", filters.subsidiaryId);
    }
    if (filters.locationId && toValidUuidOrNull(filters.locationId)) {
      query = query.eq("work_location_id", filters.locationId);
    }
    if (filters.gender) {
      query = query.eq("gender", filters.gender);
    }
    if (filters.nationality) {
      query = query.eq("nationality", filters.nationality);
    }
    if (filters.contractType) {
      query = query.eq("contract_type", filters.contractType);
    }
    if (filters.search?.trim()) {
      const s = filters.search.trim();
      query = query.or(
        `full_name.ilike.%${s}%,employee_no.ilike.%${s}%,job_title.ilike.%${s}%,email.ilike.%${s}%,national_id_or_iqama.ilike.%${s}%`
      );
    }

    if (filters.sort === "hire_date_desc") {
      query = query.order("hire_date", { ascending: false });
    } else if (filters.sort === "hire_date_asc") {
      query = query.order("hire_date", { ascending: true });
    } else if (filters.sort === "employee_no_desc") {
      query = query.order("employee_no", { ascending: false });
    } else if (filters.sort === "employee_no_asc") {
      query = query.order("employee_no", { ascending: true });
    } else {
      query = query.order("created_at", { ascending: false });
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data, count, error } = await query.range(from, to);

    if (!error && data) {
      const items: EmployeeDirectoryItem[] = data.map((row: any) => {
        const meta = (row.metadata && typeof row.metadata === "object" ? row.metadata : {}) as Record<
          string,
          unknown
        >;
        const ext = getEmployeeExtendedFields(String(row.id));
        const fullName = String(row.full_name || `${row.first_name_ar || ""} ${row.last_name_ar || ""}`).trim();
        const parts = fullName.split(/\s+/);
        return {
          id: String(row.id),
          employeeNo: String(row.employee_no || ""),
          firstNameAr: String(row.first_name_ar || parts[0] || ""),
          lastNameAr: String(row.last_name_ar || parts.slice(1).join(" ") || ""),
          firstNameEn: row.first_name_en ? String(row.first_name_en) : null,
          lastNameEn: row.last_name_en ? String(row.last_name_en) : null,
          fullName,
          email: row.email ? String(row.email) : null,
          phone: row.phone ? String(row.phone) : null,
          jobTitle: String(row.job_title || ""),
          status: ((ext.status || meta.lifecycleStatus || row.status) as EmployeeStatus) || "active",
          hireDate: String(row.hire_date || ""),
          contractType: (row.contract_type as ContractType | null) ?? null,
          workType: (ext.workType || meta.workType ? String(ext.workType || meta.workType) : null),
          departmentId: row.department_id ? String(row.department_id) : null,
          departmentName: null,
          subsidiaryId: row.subsidiary_id ? String(row.subsidiary_id) : null,
          subsidiaryName: null,
          workLocationId: row.work_location_id ? String(row.work_location_id) : null,
          workLocationName: null,
          avatarUrl: (ext.avatarUrl || meta.avatarUrl ? String(ext.avatarUrl || meta.avatarUrl) : null),
          avatarStoragePath: null,
          completionScore: Number(row.completion_score ?? 85),
          nationality: row.nationality ? String(row.nationality) : null,
          qiwaContractNo: (ext.qiwaContractNo || meta.qiwaContractNo ? String(ext.qiwaContractNo || meta.qiwaContractNo) : null),
          gender: (row.gender as Gender | null) ?? null,
          jobGrade: (ext.jobGrade || meta.jobGrade ? String(ext.jobGrade || meta.jobGrade) : null),
        };
      });

      return {
        items,
        totalCount: count ?? items.length,
        page,
        pageSize,
      };
    }
  } catch {
    // Fallback to demo list below
  }

  const demoList = getDemoEmployeesList();
  const items: EmployeeDirectoryItem[] = demoList.map((e) => ({
    id: e.id,
    employeeNo: e.employeeNo,
    firstNameAr: e.firstNameAr,
    lastNameAr: e.lastNameAr,
    firstNameEn: e.firstNameEn || null,
    lastNameEn: e.lastNameEn || null,
    fullName: `${e.firstNameAr} ${e.lastNameAr}`.trim(),
    email: e.email || null,
    phone: e.phone || null,
    jobTitle: e.jobTitleAr || "",
    status: e.status || "active",
    hireDate: e.hireDate || "",
    contractType: e.contractType ?? null,
    workType: e.workType ?? null,
    departmentId: e.departmentId || null,
    departmentName: e.departmentName || null,
    subsidiaryId: e.subsidiaryId || null,
    subsidiaryName: e.subsidiaryName || null,
    workLocationId: e.workLocationId || null,
    workLocationName: e.workLocationName || null,
    avatarUrl: e.avatarUrl || null,
    avatarStoragePath: e.avatarStoragePath ?? null,
    completionScore: e.completionScore ?? 85,
    nationality: e.nationality || null,
    qiwaContractNo: e.qiwaContractNo || null,
    gender: e.gender ?? null,
    jobGrade: e.jobGrade || null,
  }));

  return {
    items,
    totalCount: items.length,
    page,
    pageSize,
  };
}

/**
 * Computes Directory KPIs directly from `public.employees` when `get_employee_directory_kpis` RPC is missing.
 */
export async function fetchDirectoryKpisWhenRpcUnavailable(): Promise<EmployeeDirectoryKpis> {
  try {
    const { data, error } = await supabase
      .from("employees")
      .select("status, nationality, probation_end_date")
      .limit(10000);

    if (!error && data && data.length > 0) {
      const employed = data.filter((r: any) => r.status !== "terminated" && r.status !== "draft");
      const activeCount = data.filter((r: any) => r.status === "active").length;
      const onLeaveCount = data.filter((r: any) => r.status === "on_leave").length;
      const probationCount = data.filter(
        (r: any) =>
          r.status === "probation" ||
          (r.probation_end_date && new Date(r.probation_end_date) >= new Date())
      ).length;
      const saudiCount = employed.filter((r: any) => {
        const nat = String(r.nationality || "").trim().toLowerCase();
        return nat === "سعودي" || nat === "سعودية" || nat === "saudi" || nat === "sa";
      }).length;
      const nonSaudiCount = employed.filter((r: any) => {
        const nat = String(r.nationality || "").trim().toLowerCase();
        return nat !== "" && nat !== "سعودي" && nat !== "سعودية" && nat !== "saudi" && nat !== "sa";
      }).length;
      const knownTotal = saudiCount + nonSaudiCount;

      return {
        available: true,
        totalEmployees: data.length,
        totalEmployed: employed.length,
        activeEmployees: activeCount,
        saudiEmployees: saudiCount,
        expatEmployees: nonSaudiCount,
        nonSaudiEmployees: nonSaudiCount,
        unknownNationalityCount: Math.max(0, employed.length - knownTotal),
        saudizationRate: knownTotal > 0 ? Math.round((saudiCount / knownTotal) * 100) : 0,
        probationCount,
        onLeaveCount,
        expiringDocsCount: 0,
        hrRestricted: false,
      };
    }
  } catch {
    // Fallback to demo list below
  }

  const demoList = getDemoEmployeesList();
  const saudiCount = demoList.filter((e) => e.nationality === "سعودي").length;
  return {
    available: true,
    totalEmployees: demoList.length,
    totalEmployed: demoList.length,
    activeEmployees: demoList.filter((e) => e.status === "active").length,
    saudiEmployees: saudiCount,
    expatEmployees: demoList.length - saudiCount,
    nonSaudiEmployees: demoList.length - saudiCount,
    unknownNationalityCount: 0,
    saudizationRate: demoList.length > 0 ? Math.round((saudiCount / demoList.length) * 100) : 0,
    probationCount: demoList.filter((e) => e.status === "probation").length,
    onLeaveCount: demoList.filter((e) => e.status === "on_leave").length,
    expiringDocsCount: 0,
    hrRestricted: false,
  };
}
