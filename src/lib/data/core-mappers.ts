import type { Database } from "../../integrations/supabase/types";
import type { DailyAttendanceRecord, Employee } from "../../types";
import type { DepartmentRow, EmployeeExtendedRow } from "./enterprise-client";

type AttendanceRow = Database["public"]["Tables"]["attendance_records"]["Row"];

/** Map stored facts without substituting demo identities, salaries or dates. */
export function mapEmployee(
  row: EmployeeExtendedRow,
  departments: Map<string, DepartmentRow>,
  subsidiaries: Map<string, { name_ar: string }>,
  locations: Map<string, { name_ar: string }>,
): Employee {
  const [firstName = "", ...lastName] = row.full_name.trim().split(/\s+/);
  return {
    id: row.id,
    employeeNo: row.employee_no,
    firstNameAr: row.first_name_ar ?? firstName,
    lastNameAr: row.last_name_ar ?? lastName.join(" "),
    firstNameEn: row.first_name_en ?? "",
    lastNameEn: row.last_name_en ?? "",
    email: row.email ?? "",
    personalEmail: row.personal_email ?? undefined,
    phone: row.phone ?? "",
    nationalIdOrIqama: row.national_id_or_iqama ?? "",
    nationality: row.nationality ?? "",
    gender: row.gender === "female" ? "female" : "male",
    birthDate: row.birth_date ?? "",
    maritalStatus: ["married", "divorced", "widowed"].includes(row.marital_status ?? "")
      ? (row.marital_status as Employee["maritalStatus"])
      : "single",
    subsidiaryId: row.subsidiary_id ?? "",
    subsidiaryName: row.subsidiary_id ? subsidiaries.get(row.subsidiary_id)?.name_ar : undefined,
    departmentId: row.department_id ?? "unassigned",
    departmentName: row.department_id ? departments.get(row.department_id)?.name : undefined,
    jobTitleAr: row.job_title,
    jobTitleEn: row.job_title,
    jobPositionId: row.job_position_id,
    managerId: row.manager_id,
    workLocationId: row.work_location_id ?? "",
    workLocationName: row.work_location_id
      ? locations.get(row.work_location_id)?.name_ar
      : undefined,
    hireDate: row.hire_date,
    contractType: ["part_time", "contractor", "seasonal", "internship"].includes(row.contract_type)
      ? (row.contract_type as Employee["contractType"])
      : "full_time",
    probationEndDate: row.probation_end_date ?? undefined,
    status: row.status as Employee["status"],
    completionScore: Number(row.completion_score ?? 0),
    basicSalary: Number(row.basic_salary ?? 0),
    totalSalary: Number(row.total_salary ?? 0),
    bankName: typeof row.bank_name === "string" ? row.bank_name : undefined,
    iban: typeof row.iban === "string" ? row.iban : undefined,
    customFields: {
      ...(row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? row.metadata
        : {}),
      userId: row.user_id,
    },
  };
}

export function mapAttendance(
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
    employeeName: employee ? `${employee.firstNameAr} ${employee.lastNameAr}`.trim() : "موظف",
    departmentName: employee?.departmentName ?? "غير محدد",
    workDate: row.work_date,
    actualIn: row.check_in ?? undefined,
    actualOut: row.check_out ?? undefined,
    status,
    lateMinutes: Number(row.late_minutes ?? 0),
    earlyDepartureMinutes: 0,
    workedHours: Number(row.worked_hours ?? 0),
    overtimeHours: Number(row.overtime_minutes ?? 0) / 60,
    punchSource: row.is_manual ? "manual_admin" : undefined,
    violationsCount: status === "late" || status === "absent" ? 1 : 0,
    reviewedByPayroll: false,
  };
}
