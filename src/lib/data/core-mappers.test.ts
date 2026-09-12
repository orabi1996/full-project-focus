import { describe, expect, it } from "vitest";
import { mapAttendance, mapEmployee } from "./core-mappers";
import type { EmployeeExtendedRow } from "./enterprise-client";
import type { Database } from "../../integrations/supabase/types";

const employeeRow: EmployeeExtendedRow = {
  id: "emp-real",
  user_id: "user-real",
  employee_no: "E-001",
  full_name: "اسم حقيقي",
  first_name_ar: null,
  last_name_ar: null,
  first_name_en: null,
  last_name_en: null,
  email: null,
  personal_email: null,
  phone: null,
  national_id_or_iqama: null,
  nationality: null,
  gender: null,
  birth_date: null,
  marital_status: null,
  company_id: null,
  subsidiary_id: null,
  department_id: null,
  job_title: "",
  manager_id: null,
  work_location_id: null,
  job_position_id: null,
  hire_date: "",
  contract_type: "full_time",
  probation_end_date: null,
  status: "draft",
  basic_salary: 0,
  total_salary: 0,
  completion_score: 0,
  metadata: null,
  created_at: "2026-09-10",
};
const attendanceRow: Database["public"]["Tables"]["attendance_records"]["Row"] = {
  id: "day-real",
  employee_id: "emp-real",
  work_date: "2026-09-10",
  created_at: "2026-09-10",
  check_in: "08:12",
  check_out: "17:42",
  is_manual: false,
  late_minutes: 12,
  overtime_minutes: 90,
  worked_hours: 9.5,
  worked_minutes: 570,
  status: "late",
  note: null,
};
const map = (row: EmployeeExtendedRow) => mapEmployee(row, new Map(), new Map(), new Map());

describe("stored employee and attendance facts", () => {
  it("preserves zero pay and completion without substituting demo values", () => {
    expect(map(employeeRow)).toMatchObject({ basicSalary: 0, totalSalary: 0, completionScore: 0 });
  });
  it("keeps unknown identity, dates and contact fields empty", () => {
    expect(map(employeeRow)).toMatchObject({
      firstNameAr: "اسم",
      lastNameAr: "حقيقي",
      firstNameEn: "",
      phone: "",
      nationalIdOrIqama: "",
      nationality: "",
      birthDate: "",
      hireDate: "",
      jobTitleAr: "",
      workLocationId: "",
      subsidiaryId: "",
    });
  });
  it("uses persisted names, financial details and trusted user linkage", () => {
    expect(
      map({
        ...employeeRow,
        first_name_ar: "محمد",
        last_name_ar: "علي",
        basic_salary: 7000,
        total_salary: 8200,
        bank_name: "بنك",
        iban: "stored-iban",
        metadata: { userId: "spoofed", emergencyContact: "stored" },
      }),
    ).toMatchObject({
      firstNameAr: "محمد",
      lastNameAr: "علي",
      basicSalary: 7000,
      totalSalary: 8200,
      bankName: "بنك",
      iban: "stored-iban",
      customFields: { userId: "user-real", emergencyContact: "stored" },
    });
  });
  it("does not turn missing names into a demo identity", () => {
    expect(map({ ...employeeRow, full_name: "" })).toMatchObject({
      firstNameAr: "",
      lastNameAr: "",
    });
  });
  it("preserves measured lateness and converts stored overtime minutes to hours", () => {
    expect(mapAttendance(attendanceRow, new Map())).toMatchObject({
      lateMinutes: 12,
      workedHours: 9.5,
      overtimeHours: 1.5,
    });
  });
  it("does not claim an unrecorded punch source or geofence verification", () => {
    const record = mapAttendance(attendanceRow, new Map());
    expect(record.punchSource).toBeUndefined();
    expect(record.geofenceValid).toBeUndefined();
    expect(mapAttendance({ ...attendanceRow, is_manual: true }, new Map()).punchSource).toBe(
      "manual_admin",
    );
  });
  it("preserves zero metrics and maps leave status", () => {
    expect(
      mapAttendance(
        {
          ...attendanceRow,
          status: "leave",
          late_minutes: 0,
          overtime_minutes: 0,
          worked_hours: 0,
        },
        new Map(),
      ),
    ).toMatchObject({ status: "on_leave", lateMinutes: 0, overtimeHours: 0, workedHours: 0 });
  });
});
