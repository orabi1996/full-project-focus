import { supabase } from "../../integrations/supabase/client";
import type { Database } from "../../integrations/supabase/types";
import {
  enterpriseSupabase,
  type DepartmentRow,
  type EmployeeExtendedRow,
  type RequestExtendedRow,
} from "./enterprise-client";
import type {
  DailyAttendanceRecord,
  Employee,
  OrgUnit,
  RequestCategory,
  RequestStatus,
  ServiceRequest,
} from "../../types";

type AttendanceRow = Database["public"]["Tables"]["attendance_records"]["Row"];
type RequestRow = RequestExtendedRow;

export interface CoreSnapshot {
  employees: Employee[];
  orgUnits: OrgUnit[];
  attendanceRecords: DailyAttendanceRecord[];
  requests: ServiceRequest[];
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? fullName,
    lastName: parts.slice(1).join(" ") || "—",
  };
}

function mapEmployee(
  row: EmployeeExtendedRow,
  departments: Map<string, DepartmentRow>,
  subsidiaries: Map<string, { name_ar: string }>,
  locations: Map<string, { name_ar: string }>,
): Employee {
  const name = splitName(row.full_name);
  const department = row.department_id ? departments.get(row.department_id) : undefined;

  return {
    id: row.id,
    employeeNo: row.employee_no,
    firstNameAr: row.first_name_ar ?? name.firstName,
    lastNameAr: row.last_name_ar ?? name.lastName,
    firstNameEn: row.first_name_en ?? name.firstName,
    lastNameEn: row.last_name_en ?? name.lastName,
    email: row.email ?? "",
    personalEmail: row.personal_email ?? undefined,
    phone: row.phone ?? "",
    nationalIdOrIqama: row.national_id_or_iqama ?? "غير مسجل",
    nationality: row.nationality ?? "غير محدد",
    gender: row.gender === "female" ? "female" : "male",
    birthDate: row.birth_date ?? "1990-01-01",
    maritalStatus:
      row.marital_status === "married" ||
      row.marital_status === "divorced" ||
      row.marital_status === "widowed"
        ? row.marital_status
        : "single",
    subsidiaryId: row.subsidiary_id ?? "",
    subsidiaryName: row.subsidiary_id ? subsidiaries.get(row.subsidiary_id)?.name_ar : undefined,
    departmentId: row.department_id ?? "unassigned",
    departmentName: department?.name ?? "غير محدد",
    jobTitleAr: row.job_title,
    jobTitleEn: row.job_title,
    jobPositionId: row.job_position_id,
    managerId: row.manager_id,
    workLocationId: row.work_location_id ?? "",
    workLocationName: row.work_location_id
      ? locations.get(row.work_location_id)?.name_ar
      : undefined,
    hireDate: row.hire_date,
    contractType:
      row.contract_type === "part_time" ||
      row.contract_type === "contractor" ||
      row.contract_type === "seasonal" ||
      row.contract_type === "internship"
        ? row.contract_type
        : "full_time",
    probationEndDate: row.probation_end_date ?? undefined,
    status: row.status as Employee["status"],
    completionScore: row.completion_score,
    basicSalary: Number(row.basic_salary),
    totalSalary: Number(row.total_salary || row.basic_salary),
    customFields: {
      ...(row.metadata && typeof row.metadata === "object" ? row.metadata : {}),
      userId: row.user_id,
    },
  };
}

function mapOrgUnit(row: DepartmentRow): OrgUnit {
  return {
    id: row.id,
    companyId: row.company_id ?? "",
    parentId: row.parent_id,
    subsidiaryId: row.subsidiary_id,
    costCenterId: row.cost_center_id,
    nameAr: row.name,
    nameEn: row.name_en ?? row.name,
    descriptionAr: row.description_ar ?? undefined,
    descriptionEn: row.description_en ?? undefined,
    code: row.code,
    type: row.unit_type as OrgUnit["type"],
    managerEmployeeId: row.manager_employee_id ?? undefined,
    status: row.status === "inactive" ? "inactive" : "active",
    employeeCount: 0,
  };
}

function mapAttendance(
  row: AttendanceRow,
  employees: Map<string, Employee>,
): DailyAttendanceRecord {
  const employee = employees.get(row.employee_id);
  const status =
    row.status === "leave" ? "on_leave" : row.status === "remote" ? "present" : row.status;

  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeNo: employee?.employeeNo ?? "—",
    employeeName: employee ? `${employee.firstNameAr} ${employee.lastNameAr}` : "موظف",
    departmentName: employee?.departmentName ?? "غير محدد",
    workDate: row.work_date,
    actualIn: row.check_in ?? undefined,
    actualOut: row.check_out ?? undefined,
    status,
    lateMinutes: status === "late" ? 15 : 0,
    earlyDepartureMinutes: 0,
    workedHours: Number(row.worked_hours),
    overtimeHours: 0,
    punchSource: "manual_admin",
    geofenceValid: true,
    violationsCount: status === "late" || status === "absent" ? 1 : 0,
    reviewedByPayroll: false,
  };
}

function mapRequestType(type: RequestRow["type"]): RequestCategory {
  const types: Record<RequestRow["type"], RequestCategory> = {
    leave: "leave",
    attendance_fix: "attendance_correction",
    advance: "loan_advance",
    expense: "expense_claim",
  };
  return types[type];
}

function mapRequestStatus(status: RequestRow["status"]): RequestStatus {
  const statuses: Record<RequestRow["status"], RequestStatus> = {
    draft: "draft",
    pending: "pending_approval",
    approved: "approved",
    rejected: "rejected",
    returned: "returned",
  };
  return statuses[status];
}

function mapRequest(
  row: RequestRow,
  employees: Map<string, Employee>,
  timelineRows: Array<{
    id: string;
    step_number: number;
    actor_id: string | null;
    actor_name: string | null;
    actor_role: string | null;
    action: string;
    note: string | null;
    created_at: string;
  }>,
): ServiceRequest {
  const employee = employees.get(row.employee_id);
  const type = mapRequestType(row.type);

  return {
    id: row.id,
    referenceNo: row.reference,
    type,
    requesterId: row.employee_id,
    requesterName: employee ? `${employee.firstNameAr} ${employee.lastNameAr}` : "موظف",
    requesterJobTitle: employee?.jobTitleAr,
    departmentName: employee?.departmentName,
    status: mapRequestStatus(row.status),
    currentStepIndex: row.current_step_index,
    totalSteps: row.total_steps,
    currentApproverRole:
      row.status === "pending" ? (row.current_approver_role ?? "مدير الموارد البشرية") : undefined,
    submittedAt: row.created_at,
    updatedAt: row.decided_at ?? row.created_at,
    payload: {
      reason: row.reason,
      startDate: row.start_date,
      endDate: row.end_date,
      totalDays: row.days,
      amount: row.amount,
    },
    timeline:
      timelineRows.length > 0
        ? timelineRows.map((event) => ({
            id: event.id,
            stepNumber: event.step_number,
            actorId: event.actor_id ?? row.employee_id,
            actorName: event.actor_name ?? "النظام",
            actorRole: event.actor_role ?? "النظام",
            action: event.action as ServiceRequest["timeline"][number]["action"],
            note: event.note ?? undefined,
            timestamp: event.created_at,
          }))
        : [
            {
              id: `${row.id}-submitted`,
              stepNumber: 1,
              actorId: row.created_by ?? row.employee_id,
              actorName: employee ? `${employee.firstNameAr} ${employee.lastNameAr}` : "موظف",
              actorRole: "مقدم الطلب",
              action: "submitted",
              timestamp: row.created_at,
            },
          ],
  };
}

export async function fetchCoreSnapshot(): Promise<CoreSnapshot> {
  const [
    departmentsResult,
    employeesResult,
    subsidiariesResult,
    locationsResult,
    attendanceResult,
    requestsResult,
    timelineResult,
  ] = await Promise.all([
    enterpriseSupabase.from("departments").select("*").order("name"),
    enterpriseSupabase.from("employees").select("*").order("created_at", { ascending: false }),
    enterpriseSupabase.from("subsidiaries").select("id, name_ar"),
    enterpriseSupabase.from("work_locations").select("id, name_ar"),
    supabase.from("attendance_records").select("*").order("work_date", { ascending: false }),
    enterpriseSupabase.from("requests").select("*").order("created_at", { ascending: false }),
    enterpriseSupabase.from("request_timeline").select("*").order("created_at"),
  ]);

  const firstError = [
    departmentsResult.error,
    employeesResult.error,
    subsidiariesResult.error,
    locationsResult.error,
    attendanceResult.error,
    requestsResult.error,
    timelineResult.error,
  ].find(Boolean);
  if (firstError) throw new Error(firstError.message);

  const departments = new Map((departmentsResult.data ?? []).map((row) => [row.id, row]));
  const subsidiaries = new Map((subsidiariesResult.data ?? []).map((row) => [row.id, row]));
  const locations = new Map((locationsResult.data ?? []).map((row) => [row.id, row]));
  const employees = (employeesResult.data ?? []).map((row) =>
    mapEmployee(row, departments, subsidiaries, locations),
  );
  const employeeMap = new Map(employees.map((employee) => [employee.id, employee]));
  for (const employee of employees) {
    const manager = employee.managerId ? employeeMap.get(employee.managerId) : undefined;
    employee.managerName = manager ? `${manager.firstNameAr} ${manager.lastNameAr}` : undefined;
  }
  const orgUnits = (departmentsResult.data ?? []).map(mapOrgUnit);

  for (const unit of orgUnits) {
    unit.employeeCount = employees.filter((employee) => employee.departmentId === unit.id).length;
    const manager = unit.managerEmployeeId ? employeeMap.get(unit.managerEmployeeId) : undefined;
    unit.managerName = manager ? `${manager.firstNameAr} ${manager.lastNameAr}` : unit.managerName;
  }


  return {
    employees,
    orgUnits,
    attendanceRecords: (attendanceResult.data ?? []).map((row) => mapAttendance(row, employeeMap)),
    requests: (requestsResult.data ?? []).map((row) =>
      mapRequest(
        row,
        employeeMap,
        (timelineResult.data ?? []).filter((event) => event.request_id === row.id),
      ),
    ),
  };
}

export async function createEmployeeRecord(employee: Employee) {
  const { error } = await enterpriseSupabase.from("employees").insert({
    employee_no: employee.employeeNo,
    full_name: `${employee.firstNameAr} ${employee.lastNameAr}`.trim(),
    first_name_ar: employee.firstNameAr,
    last_name_ar: employee.lastNameAr,
    first_name_en: employee.firstNameEn,
    last_name_en: employee.lastNameEn,
    department_id: employee.departmentId === "unassigned" ? null : employee.departmentId,
    subsidiary_id: employee.subsidiaryId || null,
    manager_id: employee.managerId ?? null,
    work_location_id: employee.workLocationId || null,
    job_position_id: employee.jobPositionId ?? null,
    job_title: employee.jobTitleAr,
    email: employee.email || null,
    personal_email: employee.personalEmail ?? null,
    phone: employee.phone || null,
    national_id_or_iqama: employee.nationalIdOrIqama || null,
    nationality: employee.nationality || null,
    gender: employee.gender,
    birth_date: employee.birthDate,
    marital_status: employee.maritalStatus,
    hire_date: employee.hireDate,
    contract_type: employee.contractType,
    probation_end_date: employee.probationEndDate ?? null,
    basic_salary: employee.basicSalary,
    total_salary: employee.totalSalary,
    completion_score: employee.completionScore,
    metadata: employee.customFields ?? {},
    status:
      employee.status === "probation" ||
      employee.status === "preboarding" ||
      employee.status === "draft"
        ? "active"
        : employee.status,
  });
  if (error) throw new Error(error.message);
}

export async function updateEmployeeRecord(id: string, updates: Partial<Employee>) {
  const dbUpdates: Partial<EmployeeExtendedRow> = {};
  if (updates.employeeNo !== undefined) dbUpdates.employee_no = updates.employeeNo;
  if (updates.firstNameAr !== undefined || updates.lastNameAr !== undefined) {
    dbUpdates.full_name = `${updates.firstNameAr ?? ""} ${updates.lastNameAr ?? ""}`.trim();
  }
  if (updates.firstNameAr !== undefined) dbUpdates.first_name_ar = updates.firstNameAr;
  if (updates.lastNameAr !== undefined) dbUpdates.last_name_ar = updates.lastNameAr;
  if (updates.firstNameEn !== undefined) dbUpdates.first_name_en = updates.firstNameEn;
  if (updates.lastNameEn !== undefined) dbUpdates.last_name_en = updates.lastNameEn;
  if (updates.departmentId !== undefined) dbUpdates.department_id = updates.departmentId;
  if (updates.subsidiaryId !== undefined) dbUpdates.subsidiary_id = updates.subsidiaryId || null;
  if (updates.managerId !== undefined) dbUpdates.manager_id = updates.managerId;
  if (updates.workLocationId !== undefined)
    dbUpdates.work_location_id = updates.workLocationId || null;
  if (updates.jobTitleAr !== undefined) dbUpdates.job_title = updates.jobTitleAr;
  if (updates.jobPositionId !== undefined) dbUpdates.job_position_id = updates.jobPositionId;
  if (updates.email !== undefined) dbUpdates.email = updates.email;
  if (updates.personalEmail !== undefined) dbUpdates.personal_email = updates.personalEmail;
  if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
  if (updates.nationalIdOrIqama !== undefined)
    dbUpdates.national_id_or_iqama = updates.nationalIdOrIqama;
  if (updates.nationality !== undefined) dbUpdates.nationality = updates.nationality;
  if (updates.gender !== undefined) dbUpdates.gender = updates.gender;
  if (updates.birthDate !== undefined) dbUpdates.birth_date = updates.birthDate;
  if (updates.maritalStatus !== undefined) dbUpdates.marital_status = updates.maritalStatus;
  if (updates.hireDate !== undefined) dbUpdates.hire_date = updates.hireDate;
  if (updates.contractType !== undefined) dbUpdates.contract_type = updates.contractType;
  if (updates.probationEndDate !== undefined)
    dbUpdates.probation_end_date = updates.probationEndDate;
  if (updates.basicSalary !== undefined) dbUpdates.basic_salary = updates.basicSalary;
  if (updates.totalSalary !== undefined) dbUpdates.total_salary = updates.totalSalary;
  if (updates.completionScore !== undefined) dbUpdates.completion_score = updates.completionScore;
  if (updates.customFields !== undefined) dbUpdates.metadata = updates.customFields;
  if (
    updates.status === "active" ||
    updates.status === "on_leave" ||
    updates.status === "suspended" ||
    updates.status === "terminated"
  ) {
    dbUpdates.status = updates.status;
  }
  const { error } = await enterpriseSupabase.from("employees").update(dbUpdates).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function updateRequestDecision(
  requestId: string,
  status: "approved" | "rejected" | "returned",
  note?: string,
  nextStep?: number,
  isFinalApproval = true,
) {
  const { data: userData } = await supabase.auth.getUser();
  const persistedStatus = status === "approved" && !isFinalApproval ? "pending" : status;
  const { error } = await enterpriseSupabase
    .from("requests")
    .update({
      status: persistedStatus,
      decision_note: note ?? null,
      decided_by: userData.user?.id ?? null,
      decided_at: new Date().toISOString(),
      current_step_index: nextStep,
      current_approver_role: persistedStatus === "pending" ? "المعتمد التالي" : null,
    })
    .eq("id", requestId);
  if (error) throw new Error(error.message);
  const { error: timelineError } = await enterpriseSupabase.from("request_timeline").insert({
    request_id: requestId,
    step_number: 1,
    actor_id: userData.user?.id ?? null,
    actor_name: String(userData.user?.user_metadata?.full_name ?? userData.user?.email ?? "مستخدم"),
    actor_role: "approver",
    action: status,
    note: note ?? null,
  });
  if (timelineError) throw new Error(timelineError.message);
}

export async function createRequestRecord(
  employeeId: string,
  type: RequestCategory,
  payload: Record<string, unknown>,
) {
  const dbType: Database["public"]["Enums"]["request_type"] =
    type === "attendance_correction"
      ? "attendance_fix"
      : type === "loan_advance"
        ? "advance"
        : type === "expense_claim"
          ? "expense"
          : "leave";
  const { data: userData } = await supabase.auth.getUser();
  const { data: request, error } = await enterpriseSupabase
    .from("requests")
    .insert({
      employee_id: employeeId,
      type: dbType,
      status: "pending",
      start_date: typeof payload.startDate === "string" ? payload.startDate : null,
      end_date: typeof payload.endDate === "string" ? payload.endDate : null,
      days: typeof payload.totalDays === "number" ? payload.totalDays : null,
      amount: typeof payload.amount === "number" ? payload.amount : null,
      reason: typeof payload.reason === "string" ? payload.reason : null,
      created_by: userData.user?.id ?? null,
      current_step_index: 1,
      total_steps: 2,
      current_approver_role: "المدير المباشر",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const { error: timelineError } = await enterpriseSupabase.from("request_timeline").insert({
    request_id: request.id,
    step_number: 1,
    actor_id: userData.user?.id ?? null,
    actor_name: String(userData.user?.user_metadata?.full_name ?? userData.user?.email ?? "موظف"),
    actor_role: "employee",
    action: "submitted",
    note: "تم إرسال الطلب لمسار الاعتماد",
  });
  if (timelineError) throw new Error(timelineError.message);
}

export async function recordAttendance(
  employeeId: string,
  type: "in" | "out",
  date: string,
  time: string,
) {
  const { data: existing, error: readError } = await supabase
    .from("attendance_records")
    .select("id, check_in, check_out")
    .eq("employee_id", employeeId)
    .eq("work_date", date)
    .maybeSingle();
  if (readError) throw new Error(readError.message);

  if (existing) {
    const { error } = await supabase
      .from("attendance_records")
      .update(
        type === "in"
          ? { check_in: time, status: "present" }
          : { check_out: time, status: "present" },
      )
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await supabase.from("attendance_records").insert({
    employee_id: employeeId,
    work_date: date,
    check_in: type === "in" ? time : null,
    check_out: type === "out" ? time : null,
    status: "present",
    worked_hours: 0,
  });
  if (error) throw new Error(error.message);
}
