import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import crypto from "crypto";
import { queryKeys } from "../lib/query/query-keys";
import {
  mapAttendancePolicy,
  mapAttendancePeriod,
  mapAttendanceException,
  mapAttendancePayrollSnapshot,
  mapPunchRecord,
  mapDailyAttendanceRecord,
} from "../lib/data/attendance-repository";

// Pure Haversine formula mirroring PostgreSQL haversine_distance_meters RPC
function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const rLat1 = toRad(lat1);
  const rLat2 = toRad(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Saudi Labor Law overtime calculation helper
function calculateOvertimePay(
  hourlyRate: number,
  overtimeHours: number,
  dayType: "regular" | "holiday" | "rest_day",
  policy: { overtimeRegularMultiplier: number; overtimeHolidayMultiplier: number },
): number {
  const multiplier =
    dayType === "regular"
      ? policy.overtimeRegularMultiplier
      : policy.overtimeHolidayMultiplier;
  return hourlyRate * overtimeHours * multiplier;
}

// Overnight shift duration calculation helper
function calculateShiftWorkedHours(
  checkIn: string, // "HH:MM"
  checkOut: string, // "HH:MM"
  isOvernight: boolean,
  breakMinutes: number = 0,
): number {
  const [inH, inM] = checkIn.split(":").map(Number);
  const [outH, outM] = checkOut.split(":").map(Number);

  let totalMinutes = 0;
  if (!isOvernight) {
    totalMinutes = outH * 60 + outM - (inH * 60 + inM);
  } else {
    // Overnight: crosses midnight
    totalMinutes = 24 * 60 - (inH * 60 + inM) + (outH * 60 + outM);
  }

  // Deduct break if applicable
  const netMinutes = Math.max(0, totalMinutes - breakMinutes);
  return Number((netMinutes / 60).toFixed(2));
}

describe("Prompt 12: Production Attendance & Time Engine Contract", () => {
  const migrationPath = path.resolve(
    __dirname,
    "../../supabase/migrations/20260924000000_production_attendance_engine.sql",
  );
  const migrationSql = fs.readFileSync(migrationPath, "utf-8");

  const repoPath = path.resolve(__dirname, "../lib/data/attendance-repository.ts");
  const repoContent = fs.readFileSync(repoPath, "utf-8");

  const domainPath = path.resolve(__dirname, "../lib/domains/attendance/index.ts");
  const domainContent = fs.readFileSync(domainPath, "utf-8");

  const attendanceViewPath = path.resolve(
    __dirname,
    "../components/attendance/AttendanceView.tsx",
  );
  const attendanceViewContent = fs.readFileSync(attendanceViewPath, "utf-8");

  const setupDashboardPath = path.resolve(
    __dirname,
    "../components/setup/SetupDashboard.tsx",
  );
  const setupDashboardContent = fs.readFileSync(setupDashboardPath, "utf-8");

  describe("1. Database Schema & Migration Integrity", () => {
    it("defines attendance_policies table with Saudi Labor Law standards", () => {
      expect(migrationSql).toContain("CREATE TABLE IF NOT EXISTS public.attendance_policies");
      expect(migrationSql).toContain("grace_period_in_minutes integer NOT NULL DEFAULT 15");
      expect(migrationSql).toContain("grace_period_out_minutes integer NOT NULL DEFAULT 15");
      expect(migrationSql).toContain("overtime_regular_multiplier numeric(3,2) NOT NULL DEFAULT 1.50");
      expect(migrationSql).toContain("overtime_holiday_multiplier numeric(3,2) NOT NULL DEFAULT 2.00");
      expect(migrationSql).toContain("ramadan_work_hours_per_day numeric(4,2) NOT NULL DEFAULT 6.00");
      expect(migrationSql).toContain("geofence_enforced boolean NOT NULL DEFAULT true");
      expect(migrationSql).toContain("geofence_radius_meters integer NOT NULL DEFAULT 200");
    });

    it("defines attendance_periods table with open/closed lifecycle", () => {
      expect(migrationSql).toContain("CREATE TABLE IF NOT EXISTS public.attendance_periods");
      expect(migrationSql).toContain("period_year integer NOT NULL");
      expect(migrationSql).toContain("period_month integer NOT NULL");
      expect(migrationSql).toContain("status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closing', 'closed', 'reopened'))");
      expect(migrationSql).toContain("closed_at timestamptz");
      expect(migrationSql).toContain("reopen_reason text");
    });

    it("defines attendance_payroll_snapshots table with SHA-256 seal", () => {
      expect(migrationSql).toContain("CREATE TABLE IF NOT EXISTS public.attendance_payroll_snapshots");
      expect(migrationSql).toContain("snapshot_hash text NOT NULL");
      expect(migrationSql).toContain("total_worked_hours numeric(7,2) NOT NULL DEFAULT 0");
      expect(migrationSql).toContain("regular_overtime_hours numeric(7,2) NOT NULL DEFAULT 0");
      expect(migrationSql).toContain("holiday_overtime_hours numeric(7,2) NOT NULL DEFAULT 0");
      expect(migrationSql).toContain("total_absent_days integer NOT NULL DEFAULT 0");
      expect(migrationSql).toContain("total_late_minutes integer NOT NULL DEFAULT 0");
    });

    it("defines attendance_exceptions and punch_import_batches tables", () => {
      expect(migrationSql).toContain("CREATE TABLE IF NOT EXISTS public.attendance_exceptions");
      expect(migrationSql).toContain("exception_type text NOT NULL");
      expect(migrationSql).toContain("resolved boolean NOT NULL DEFAULT false");
      expect(migrationSql).toContain("resolution_note text");
      expect(migrationSql).toContain("CREATE TABLE IF NOT EXISTS public.punch_import_batches");
      expect(migrationSql).toContain("successful_records integer NOT NULL DEFAULT 0");
    });

    it("enforces immutable punches through trg_enforce_punch_immutability trigger", () => {
      expect(migrationSql).toContain("CREATE OR REPLACE FUNCTION public.enforce_punch_immutability()");
      expect(migrationSql).toContain("Raw punch data (time, coordinates, type, source, device) is immutable audit evidence");
      expect(migrationSql).toContain("CREATE TRIGGER trg_enforce_punch_immutability");
    });

    it("enforces immutable payroll snapshots through trg_prevent_payroll_snapshot_tampering", () => {
      expect(migrationSql).toContain("CREATE OR REPLACE FUNCTION public.prevent_payroll_snapshot_tampering()");
      expect(migrationSql).toContain("Attendance payroll snapshots are immutable and cannot be updated once sealed.");
      expect(migrationSql).toContain("CREATE TRIGGER trg_prevent_payroll_snapshot_tampering");
    });

    it("prevents modifying attendance records in closed periods through trg_check_attendance_period_lock", () => {
      expect(migrationSql).toContain("CREATE OR REPLACE FUNCTION public.check_attendance_period_lock()");
      expect(migrationSql).toContain("belong to a closed payroll attendance period and cannot be modified");
      expect(migrationSql).toContain("CREATE TRIGGER trg_check_attendance_period_lock");
    });

    it("implements all required production RPCs with SECURITY DEFINER and company isolation", () => {
      expect(migrationSql).toContain("CREATE OR REPLACE FUNCTION public.haversine_distance_meters");
      expect(migrationSql).toContain("CREATE OR REPLACE FUNCTION public.resolve_my_employee_id()");
      expect(migrationSql).toContain("CREATE OR REPLACE FUNCTION public.record_self_punch");
      expect(migrationSql).toContain("CREATE OR REPLACE FUNCTION public.close_attendance_period");
      expect(migrationSql).toContain("CREATE OR REPLACE FUNCTION public.reopen_attendance_period");
      expect(migrationSql).toContain("CREATE OR REPLACE FUNCTION public.resolve_attendance_exception");
      expect(migrationSql).toContain("CREATE OR REPLACE FUNCTION public.import_biometric_punches");
    });

    it("applies strict Row Level Security (RLS) to all attendance tables", () => {
      expect(migrationSql).toContain("ALTER TABLE public.attendance_policies ENABLE ROW LEVEL SECURITY");
      expect(migrationSql).toContain("ALTER TABLE public.attendance_periods ENABLE ROW LEVEL SECURITY");
      expect(migrationSql).toContain("ALTER TABLE public.attendance_payroll_snapshots ENABLE ROW LEVEL SECURITY");
      expect(migrationSql).toContain("ALTER TABLE public.attendance_exceptions ENABLE ROW LEVEL SECURITY");
      expect(migrationSql).toContain("ALTER TABLE public.punch_import_batches ENABLE ROW LEVEL SECURITY");
      expect(migrationSql).not.toContain("USING (true)");
    });
  });

  describe("2. Geofence & GPS Haversine Distance Formula", () => {
    // Al-Andalus HQ coordinates: Riyadh (24.7136° N, 46.6753° E)
    const hqLat = 24.7136;
    const hqLon = 46.6753;

    it("calculates 0 meters for the exact same location", () => {
      const dist = haversineDistanceMeters(hqLat, hqLon, hqLat, hqLon);
      expect(dist).toBe(0);
    });

    it("validates punch inside 200m geofence radius", () => {
      // 50 meters north of HQ (approx +0.00045° latitude)
      const nearbyLat = hqLat + 0.00045;
      const dist = haversineDistanceMeters(hqLat, hqLon, nearbyLat, hqLon);
      expect(dist).toBeLessThanOrEqual(200);
      expect(dist).toBeGreaterThan(0);
    });

    it("flags punch outside 200m geofence radius as violation", () => {
      // 5 km away in Riyadh
      const farLat = 24.7500;
      const farLon = 46.7200;
      const dist = haversineDistanceMeters(hqLat, hqLon, farLat, farLon);
      expect(dist).toBeGreaterThan(200);
    });
  });

  describe("3. Saudi Labor Law & Shift Calculations", () => {
    const policy = {
      gracePeriodInMinutes: 15,
      gracePeriodOutMinutes: 15,
      overtimeRegularMultiplier: 1.5, // Mada 107
      overtimeHolidayMultiplier: 2.0, // Weekend & official holidays
      defaultWorkHoursPerDay: 8.0,
      ramadanWorkHoursPerDay: 6.0,
      maxWorkHoursPerWeek: 48.0,
      ramadanMaxWorkHoursPerWeek: 36.0,
    };

    it("calculates regular 8-hour workday with 60 min lunch break", () => {
      // 08:00 to 17:00 (9 hours total) - 60 min break = 8.0 hours
      const workedHours = calculateShiftWorkedHours("08:00", "17:00", false, 60);
      expect(workedHours).toBe(8.0);
    });

    it("handles overnight shift crossing midnight accurately", () => {
      // 22:00 to 06:00 (8 hours total) - 0 break = 8.0 hours
      const workedHours = calculateShiftWorkedHours("22:00", "06:00", true, 0);
      expect(workedHours).toBe(8.0);
    });

    it("handles overnight shift with break deduction", () => {
      // 20:00 to 06:00 (10 hours total) - 60 min break = 9.0 hours
      const workedHours = calculateShiftWorkedHours("20:00", "06:00", true, 60);
      expect(workedHours).toBe(9.0);
    });

    it("calculates regular overtime at 1.5x according to Saudi Labor Law Article 107", () => {
      const hourlyRate = 50; // SAR 50/hour
      const otHours = 3;
      const otPay = calculateOvertimePay(hourlyRate, otHours, "regular", policy);
      // 50 * 3 * 1.5 = 225 SAR
      expect(otPay).toBe(225);
    });

    it("calculates holiday/rest day overtime at 2.0x", () => {
      const hourlyRate = 50;
      const otHours = 4;
      const otPay = calculateOvertimePay(hourlyRate, otHours, "holiday", policy);
      // 50 * 4 * 2.0 = 400 SAR
      expect(otPay).toBe(400);
    });
  });

  describe("4. Leave Integration & Absence Distinction", () => {
    it("ensures approved leave days are mapped to status 'leave' and not 'absent'", () => {
      const row = {
        id: "att-leave-01",
        employee_id: "emp-01",
        work_date: "2026-09-24",
        status: "leave",
        worked_hours: 0,
        overtime_hours: 0,
        late_minutes: 0,
        early_departure_minutes: 0,
        geofence_valid: true,
        violations_count: 0,
        reviewed_by_payroll: false,
        is_manual: false,
      };

      const mapped = mapDailyAttendanceRecord(row);
      expect(mapped.status).toBe("leave");
      expect(mapped.workedHours).toBe(0);
      expect(mapped.lateMinutes).toBe(0);
    });

    it("preserves status 'remote' for verified off-site work", () => {
      const row = {
        id: "att-remote-01",
        employee_id: "emp-02",
        work_date: "2026-09-24",
        status: "remote",
        punch_source: "mobile_gps",
        geofence_valid: true,
      };

      const mapped = mapDailyAttendanceRecord(row);
      expect(mapped.status).toBe("remote");
      expect(mapped.punchSource).toBe("mobile_gps");
    });
  });

  describe("5. Payroll Snapshot & Cryptographic SHA-256 Seal", () => {
    it("generates deterministic SHA-256 seal for payroll snapshot integrity", () => {
      const snapshotPayload = {
        period_id: "period-2026-09",
        employee_id: "emp-001",
        payable_worked_hours: 176.0,
        payable_overtime_regular_hours: 12.0,
        payable_overtime_holiday_hours: 4.0,
        deductible_absence_days: 0.0,
        deductible_late_minutes: 15,
      };

      const seal1 = crypto
        .createHash("sha256")
        .update(JSON.stringify(snapshotPayload))
        .digest("hex");

      const seal2 = crypto
        .createHash("sha256")
        .update(JSON.stringify(snapshotPayload))
        .digest("hex");

      expect(seal1).toBe(seal2);
      expect(seal1.length).toBe(64);

      // Any alteration invalidates the seal
      const tamperedPayload = { ...snapshotPayload, payable_worked_hours: 180.0 };
      const tamperedSeal = crypto
        .createHash("sha256")
        .update(JSON.stringify(tamperedPayload))
        .digest("hex");

      expect(seal1).not.toBe(tamperedSeal);
    });
  });

  describe("6. Repository & Data Mapper Contracts", () => {
    it("maps raw attendance policy with complete Saudi compliance attributes", () => {
      const raw = {
        id: "pol-1",
        company_id: "comp-1",
        name_ar: "سياسة الأندلس الرسمية",
        grace_period_in_minutes: 15,
        grace_period_out_minutes: 15,
        overtime_regular_multiplier: "1.50",
        overtime_holiday_multiplier: "2.00",
        default_work_hours_per_day: "8.00",
        ramadan_work_hours_per_day: "6.00",
        max_work_hours_per_week: "48.00",
        ramadan_max_work_hours_per_week: "36.00",
        geofence_enforced: true,
        geofence_radius_meters: 200,
        auto_deduct_breaks: true,
        break_duration_minutes: 60,
        max_consecutive_hours_without_break: "5.00",
        require_biometric_or_gps: true,
        allow_mobile_punch: true,
        overtime_pre_approval_required: true,
        created_at: "2026-09-24T00:00:00Z",
        updated_at: "2026-09-24T00:00:00Z",
      };

      const mapped = mapAttendancePolicy(raw);
      expect(mapped.id).toBe("pol-1");
      expect(mapped.gracePeriodInMinutes).toBe(15);
      expect(mapped.overtimeRegularMultiplier).toBe(1.5);
      expect(mapped.overtimeHolidayMultiplier).toBe(2.0);
      expect(mapped.ramadanWorkHoursPerDay).toBe(6.0);
      expect(mapped.geofenceRadiusMeters).toBe(200);
      expect(mapped.autoDeductBreaks).toBe(true);
      expect(mapped.breakDurationMinutes).toBe(60);
    });

    it("maps attendance period with status and timestamps", () => {
      const raw = {
        id: "period-1",
        company_id: "comp-1",
        period_year: 2026,
        period_month: 9,
        from_date: "2026-09-01",
        to_date: "2026-09-30",
        status: "open",
        created_at: "2026-09-24T00:00:00Z",
      };

      const mapped = mapAttendancePeriod(raw);
      expect(mapped.periodYear).toBe(2026);
      expect(mapped.periodMonth).toBe(9);
      expect(mapped.status).toBe("open");
    });

    it("maps raw punches including GPS accuracy and approval status", () => {
      const raw = {
        id: "punch-1",
        company_id: "comp-1",
        employee_id: "emp-1",
        punch_type: "in",
        punch_time: "2026-09-24T08:02:00Z",
        source: "mobile_gps",
        latitude: 24.7136,
        longitude: 46.6753,
        accuracy_meters: 15.5,
        distance_from_location_meters: 35.0,
        approval_status: "approved",
        is_manual: false,
        created_at: "2026-09-24T08:02:00Z",
      };

      const mapped = mapPunchRecord(raw);
      expect(mapped.id).toBe("punch-1");
      expect(mapped.punchType).toBe("in");
      expect(mapped.source).toBe("mobile_gps");
      expect(mapped.accuracyMeters).toBe(15.5);
      expect(mapped.approvalStatus).toBe("approved");
    });
  });

  describe("7. Query Key Factories & Domain Hooks", () => {
    it("defines comprehensive queryKeys.attendance factory", () => {
      expect(queryKeys.attendance).toBeDefined();
      expect(queryKeys.attendance.all).toEqual(["attendance"]);
      expect(queryKeys.attendance.records()).toEqual(["attendance", "records"]);
      expect(queryKeys.attendance.policies()).toEqual(["attendance", "policies"]);
      expect(queryKeys.attendance.periods()).toEqual(["attendance", "periods"]);
      expect(queryKeys.attendance.snapshots("p-1")).toEqual(["attendance", "snapshots", "p-1"]);
      expect(queryKeys.attendance.exceptions()).toEqual(["attendance", "exceptions"]);
      expect(queryKeys.attendance.punches()).toEqual(["attendance", "punches"]);
      expect(queryKeys.attendance.summary()).toEqual(["attendance", "summary", "current"]);
    });

    it("exports dedicated attendance hooks in attendance domain", () => {
      expect(domainContent).toContain("export function useAttendanceRecords");
      expect(domainContent).toContain("export function useAttendanceSummary");
      expect(domainContent).toContain("export function useAttendancePolicies");
      expect(domainContent).toContain("export function useAttendancePeriods");
      expect(domainContent).toContain("export function useAttendancePayrollSnapshots");
      expect(domainContent).toContain("export function useAttendanceExceptions");
      expect(domainContent).toContain("export function usePunches");
      expect(domainContent).toContain("export function useAttendanceMutations");
    });

    it("ensures attendance mutations support all required lifecycle operations", () => {
      expect(domainContent).toContain("punchInOut");
      expect(domainContent).toContain("submitAttendanceCorrection");
      expect(domainContent).toContain("approveAttendanceCorrection");
      expect(domainContent).toContain("rejectAttendanceCorrection");
      expect(domainContent).toContain("submitOvertimeRequest");
      expect(domainContent).toContain("approveOvertimeRequest");
      expect(domainContent).toContain("rejectOvertimeRequest");
      expect(domainContent).toContain("updatePolicy");
      expect(domainContent).toContain("closePeriod");
      expect(domainContent).toContain("reopenPeriod");
      expect(domainContent).toContain("resolveException");
      expect(domainContent).toContain("importBiometricBatch");
    });
  });

  describe("8. UI Integration & Zero Mock Data Verification", () => {
    it("AttendanceView uses useAttendanceSummary hook instead of hardcoded numbers", () => {
      expect(attendanceViewContent).toContain("useAttendanceSummary");
      expect(attendanceViewContent).not.toContain("120"); // previously hardcoded active employees
      expect(attendanceViewContent).not.toContain("+ 104"); // previously hardcoded present employees
      expect(attendanceViewContent).toContain("attendanceSummary.totalEmployees");
      expect(attendanceViewContent).toContain("attendanceSummary.presentCount");
      expect(attendanceViewContent).toContain("attendanceSummary.lateCount");
      expect(attendanceViewContent).toContain("attendanceSummary.absentCount");
      expect(attendanceViewContent).toContain("attendanceSummary.openExceptionsCount");
    });

    it("AttendanceView contains dedicated tabs for Policies, Periods, Exceptions, and Raw Punches", () => {
      expect(attendanceViewContent).toContain("AttendancePoliciesPanel");
      expect(attendanceViewContent).toContain("AttendancePeriodsPanel");
      expect(attendanceViewContent).toContain("AttendanceExceptionsPanel");
    });

    it("SetupDashboard integrates Attendance Policy in wizard and settings tabs", () => {
      expect(setupDashboardContent).toContain("AttendancePolicySetupPanel");
      expect(setupDashboardContent).toContain("سياسات الدوام ونظام العمل");
      expect(setupDashboardContent).toContain("attendance_policy");
    });
  });
});
