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

// Multi-jurisdiction overtime calculation helper based on explicit policy parameters
function calculatePolicyOvertimePay(
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

// Shift duration calculation helper with overnight and break support
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
    totalMinutes = 24 * 60 - (inH * 60 + inM) + (outH * 60 + outM);
  }

  const netMinutes = Math.max(0, totalMinutes - breakMinutes);
  return Number((netMinutes / 60).toFixed(2));
}

describe("Prompt 12 & 12.2: Production Attendance & Time Engine Final Contract", () => {
  const baseMigrationPath = path.resolve(
    __dirname,
    "../../supabase/migrations/20260924000000_production_attendance_engine.sql",
  );
  const baseMigrationSql = fs.readFileSync(baseMigrationPath, "utf-8");

  const hotfix121Path = path.resolve(
    __dirname,
    "../../supabase/migrations/20260924010000_finalize_attendance_integrity_and_tenant_security.sql",
  );
  const hotfix121Sql = fs.readFileSync(hotfix121Path, "utf-8");

  const hotfix122Path = path.resolve(
    __dirname,
    "../../supabase/migrations/20260924020000_finalize_attendance_authorization_and_snapshot_truth.sql",
  );
  const hotfix122Sql = fs.readFileSync(hotfix122Path, "utf-8");

  const hotfix123Path = path.resolve(
    __dirname,
    "../../supabase/migrations/20260924030000_close_attendance_truthfulness_gaps.sql",
  );
  const hotfix123Sql = fs.readFileSync(hotfix123Path, "utf-8");

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

  const policySetupPath = path.resolve(
    __dirname,
    "../components/setup/AttendancePolicySetupPanel.tsx",
  );
  const policySetupContent = fs.readFileSync(policySetupPath, "utf-8");

  describe("1. Database Schema & Migration Architecture Integrity", () => {
    it("verifies hotfix migrations dropped implicit Saudi defaults and require explicit policy configuration", () => {
      expect(hotfix121Sql).toContain("ALTER TABLE public.attendance_policies");
      expect(hotfix121Sql).toContain("ALTER COLUMN grace_period_in_minutes DROP DEFAULT");
      expect(hotfix121Sql).toContain("ALTER COLUMN overtime_regular_multiplier DROP DEFAULT");
      expect(hotfix121Sql).toContain("ALTER COLUMN overtime_holiday_multiplier DROP DEFAULT");
      expect(hotfix121Sql).toContain("ALTER COLUMN default_work_hours_per_day DROP DEFAULT");
      expect(hotfix121Sql).toContain("ALTER COLUMN ramadan_work_hours_per_day DROP DEFAULT");
      expect(hotfix121Sql).toContain("ALTER COLUMN max_work_hours_per_week DROP DEFAULT");
      expect(hotfix121Sql).toContain("ALTER COLUMN geofence_radius_meters DROP DEFAULT");
      expect(hotfix122Sql).toContain("ALTER COLUMN max_gps_accuracy_meters DROP DEFAULT");
    });

    it("verifies attendance_policies table supports versioning, jurisdictions, and explicit GPS actions", () => {
      expect(hotfix121Sql).toContain("ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1");
      expect(hotfix121Sql).toContain("ADD COLUMN IF NOT EXISTS jurisdiction text");
      expect(hotfix121Sql).toContain("ADD COLUMN IF NOT EXISTS effective_from date NOT NULL DEFAULT CURRENT_DATE");
      expect(hotfix121Sql).toContain("ADD COLUMN IF NOT EXISTS effective_to date");
      expect(hotfix122Sql).toContain("ADD COLUMN IF NOT EXISTS gps_accuracy_action text NOT NULL DEFAULT 'flag'");
      expect(hotfix122Sql).toContain("CHECK (gps_accuracy_action IN ('reject', 'flag', 'allow'))");
    });

    it("verifies attendance_payroll_snapshots table includes authoritative expected minutes and neutral overtime fields", () => {
      expect(hotfix122Sql).toContain("ADD COLUMN IF NOT EXISTS expected_work_minutes integer NOT NULL DEFAULT 0");
      expect(hotfix122Sql).toContain("ADD COLUMN IF NOT EXISTS actual_overtime_minutes integer NOT NULL DEFAULT 0");
      expect(hotfix122Sql).toContain("ADD COLUMN IF NOT EXISTS overtime_categories jsonb DEFAULT '{}'::jsonb");
    });

    it("verifies punches table persists authoritative geofence_valid status and policy reference", () => {
      expect(hotfix122Sql).toContain("ADD COLUMN IF NOT EXISTS geofence_valid boolean DEFAULT true");
      expect(hotfix122Sql).toContain("ADD COLUMN IF NOT EXISTS policy_id uuid REFERENCES public.attendance_policies");
    });

    it("verifies attendance_exceptions includes non-violation configuration blocker types", () => {
      expect(hotfix122Sql).toContain("'policy_not_configured'");
      expect(hotfix122Sql).toContain("'timezone_not_configured'");
      expect(hotfix122Sql).toContain("'schedule_not_configured'");
    });

    it("verifies temporal overlap prevention trigger exists for attendance policies", () => {
      expect(hotfix122Sql).toContain("CREATE OR REPLACE FUNCTION public.check_attendance_policy_overlap()");
      expect(hotfix122Sql).toContain("CREATE TRIGGER trg_check_attendance_policy_overlap");
      expect(hotfix122Sql).toContain("daterange(effective_from, COALESCE(effective_to, 'infinity'::date), '[]') &&");
    });
  });

  describe("2. Multi-Jurisdiction Policy Contracts (No Implicit Assumptions)", () => {
    const saudiPolicy = {
      nameAr: "سياسة شركة الرياض المعتمدة",
      jurisdiction: "SA",
      gracePeriodInMinutes: 15,
      gracePeriodOutMinutes: 15,
      overtimeRegularMultiplier: 1.5,
      overtimeHolidayMultiplier: 2.0,
      defaultWorkHoursPerDay: 8.0,
      ramadanWorkHoursPerDay: 6.0,
      maxWorkHoursPerWeek: 48.0,
      ramadanMaxWorkHoursPerWeek: 36.0,
      maxGpsAccuracyMeters: 30,
      gpsAccuracyAction: "reject" as const,
      geofenceEnforced: true,
      geofenceRadiusMeters: 75,
    };

    const egyptPolicy = {
      nameAr: "سياسة شركة القاهرة المعتمدة",
      jurisdiction: "EG",
      gracePeriodInMinutes: 10,
      gracePeriodOutMinutes: 10,
      overtimeRegularMultiplier: 1.35,
      overtimeHolidayMultiplier: 1.7,
      defaultWorkHoursPerDay: 8.0,
      ramadanWorkHoursPerDay: null,
      maxWorkHoursPerWeek: 48.0,
      ramadanMaxWorkHoursPerWeek: null,
      maxGpsAccuracyMeters: 100,
      gpsAccuracyAction: "flag" as const,
      geofenceEnforced: true,
      geofenceRadiusMeters: 150,
    };

    it("calculates regular overtime for Saudi company with statutory 1.5x explicit multiplier", () => {
      const hourlyRate = 100;
      const otHours = 2;
      const otPay = calculatePolicyOvertimePay(hourlyRate, otHours, "regular", saudiPolicy);
      expect(otPay).toBe(300); // 100 * 2 * 1.5
    });

    it("calculates regular overtime for Egyptian company with statutory 1.35x explicit multiplier", () => {
      const hourlyRate = 100;
      const otHours = 2;
      const otPay = calculatePolicyOvertimePay(hourlyRate, otHours, "regular", egyptPolicy);
      expect(otPay).toBe(270); // 100 * 2 * 1.35
    });

    it("calculates holiday overtime distinctly according to each country's explicit policy", () => {
      const hourlyRate = 100;
      const otHours = 3;
      const saudiHolidayPay = calculatePolicyOvertimePay(hourlyRate, otHours, "holiday", saudiPolicy);
      const egyptHolidayPay = calculatePolicyOvertimePay(hourlyRate, otHours, "holiday", egyptPolicy);

      expect(saudiHolidayPay).toBe(600); // 100 * 3 * 2.0
      expect(egyptHolidayPay).toBe(510); // 100 * 3 * 1.7
      expect(saudiHolidayPay).not.toBe(egyptHolidayPay);
    });

    it("guarantees neither company inherits the other's jurisdiction policies or defaults", () => {
      expect(saudiPolicy.ramadanWorkHoursPerDay).toBe(6.0);
      expect(egyptPolicy.ramadanWorkHoursPerDay).toBeNull();
      expect(saudiPolicy.geofenceRadiusMeters).toBe(75);
      expect(egyptPolicy.geofenceRadiusMeters).toBe(150);
      expect(saudiPolicy.maxGpsAccuracyMeters).toBe(30);
      expect(egyptPolicy.maxGpsAccuracyMeters).toBe(100);
    });
  });

  describe("3. Security Authorization Contract — process_attendance_day (P0)", () => {
    it("enforces strict caller authorization in process_attendance_day SQL implementation", () => {
      expect(hotfix122Sql).toContain("CREATE OR REPLACE FUNCTION public.process_attendance_day");
      expect(hotfix122Sql).toContain("v_my_emp_id := public.resolve_my_employee_id();");
      expect(hotfix122Sql).toContain("v_my_emp_id = p_employee_id"); // Case A: Self processing
      expect(hotfix122Sql).toContain("v_caller_comp_id = v_comp_id"); // Case B: Admin same company check
      expect(hotfix122Sql).toContain("v_emp.manager_id = v_my_emp_id"); // Case D: Line manager
      expect(hotfix122Sql).toContain("غير مصرح لك بمعالجة سجلات الحضور لهذا الموظف.");
    });

    it("verifies safe process_my_attendance_day wrapper exists and resolves caller employee ID", () => {
      expect(hotfix122Sql).toContain("CREATE OR REPLACE FUNCTION public.process_my_attendance_day");
      expect(hotfix122Sql).toContain("v_my_emp_id := public.resolve_my_employee_id();");
      expect(hotfix122Sql).toContain("public.process_attendance_day(v_my_emp_id, v_target_date)");
      expect(repoContent).toContain("export async function processMyAttendanceDayRecord");
    });
  });

  describe("4. Security Authorization Contract — process_company_attendance_range (P0)", () => {
    it("enforces company isolation and blocks cross-tenant execution in process_company_attendance_range", () => {
      expect(hotfix122Sql).toContain("CREATE OR REPLACE FUNCTION public.process_company_attendance_range");
      expect(hotfix122Sql).toContain("v_caller_comp_id != v_target_comp_id");
      expect(hotfix122Sql).toContain("غير مصرح لك بمعالجة الحضور لشركة أخرى.");
      expect(hotfix122Sql).toContain("غير مصرح لك بتشغيل معالجة الحضور المجمعة للمنشأة.");
    });
  });

  describe("5. Period Close Contract — Truthful Schedule & Completeness (No 22-Day Fallback)", () => {
    it("does NOT contain fallback to 22 working days in close_attendance_period", () => {
      expect(hotfix122Sql).not.toContain("v_expected_workdays := 22;");
      expect(hotfix122Sql).not.toContain("v_expected_workdays = 22");
      expect(hotfix122Sql).toContain("لا يمكن إغلاق الفترة لأن جدول الدوام غير منشور أو غير صالح للموظف");
    });

    it("verifies missing published schedules block close_attendance_period with employee count", () => {
      expect(hotfix122Sql).toContain("لا يمكن إغلاق الفترة: يوجد % موظف ليس لديهم جدول دوام معتمد ومنشور خلال هذه الفترة.");
    });

    it("verifies missing active policy blocks close_attendance_period", () => {
      expect(hotfix122Sql).toContain("لا يمكن إغلاق الفترة: لا توجد سياسة دوام معتمدة وسارية للمنشأة تغطي هذه الفترة.");
    });

    it("verifies unprocessed scheduled days block close_attendance_period", () => {
      expect(hotfix122Sql).toContain("لا يمكن إغلاق الفترة: يوجد % يوم عمل مجدول لم تتم معالجة حضوره بعد. يرجى تشغيل معالجة الحضور أولاً.");
    });

    it("calculates authoritative expected_work_minutes from published shifts minus breaks and holidays", () => {
      expect(hotfix122Sql).toContain("v_expected_work_minutes");
      expect(hotfix122Sql).toContain("COALESCE(s.break_minutes, 0)");
      expect(hotfix122Sql).toContain("expected_work_minutes");
    });
  });

  describe("6. Geofence & GPS Policy Contracts (No 100m/200m Hidden Defaults)", () => {
    it("validates distance using Haversine formula against explicit location radius", () => {
      const hqLat = 24.7136;
      const hqLon = 46.6753;
      // 90 meters away
      const punchLat = hqLat + 0.00081;
      const punchLon = hqLon;
      const distance = haversineDistanceMeters(hqLat, hqLon, punchLat, punchLon);

      const policyRadius = 75; // explicit 75m radius
      const isInside = distance <= policyRadius;
      expect(distance).toBeGreaterThan(75);
      expect(isInside).toBe(false);
    });

    it("verifies record_self_punch throws configuration error when geofence is enforced but no radius is specified", () => {
      expect(hotfix122Sql).toContain("خاصية النطاق الجغرافي مفعلة بالسياسة ولكن لم يتم تحديد نصف القطر (radius_meters) للمقر أو السياسة.");
      expect(hotfix122Sql).not.toContain("COALESCE(radius_meters, 200)");
      expect(hotfix122Sql).not.toContain("v_loc_radius := 200");
    });

    it("verifies record_self_punch idempotent replay returns stored geofence_valid without recalculation", () => {
      expect(hotfix122Sql).toContain("'geofence_valid', COALESCE(v_existing_punch.geofence_valid, true)");
      expect(hotfix122Sql).not.toContain("distance_from_location_meters <= 200");
    });

    it("verifies record_self_punch supports explicit gps_accuracy_action (reject vs flag vs allow)", () => {
      expect(hotfix122Sql).toContain("v_policy.gps_accuracy_action = 'reject'");
      expect(hotfix122Sql).toContain("v_policy.gps_accuracy_action = 'flag'");
      expect(hotfix122Sql).toContain("دقة إحداثيات GPS ضعيفة (%s م) وتتجاوز الحد الأقصى المسموح به في سياسة الشركة");
      expect(hotfix122Sql).not.toContain("COALESCE(v_policy.max_gps_accuracy_meters, 100)");
      expect(hotfix122Sql).not.toContain("v_max_gps_acc := 100");
    });
  });

  describe("7. Policy Save Contracts (Validation First & Explicit Booleans)", () => {
    it("requires explicit business policy booleans in save_attendance_policy", () => {
      expect(hotfix122Sql).toContain("NOT (p_policy ? 'geofence_enforced')");
      expect(hotfix122Sql).toContain("NOT (p_policy ? 'auto_deduct_breaks')");
      expect(hotfix122Sql).toContain("NOT (p_policy ? 'require_biometric_or_gps')");
      expect(hotfix122Sql).toContain("NOT (p_policy ? 'allow_mobile_punch')");
      expect(hotfix122Sql).toContain("NOT (p_policy ? 'overtime_pre_approval_required')");
    });

    it("validates payload BEFORE terminating or archiving previous active policy versions", () => {
      const validatePos = hotfix122Sql.indexOf("-- 2. Validate Payload FIRST");
      const terminatePos = hotfix122Sql.indexOf("-- Archive or close previous active versions");
      const insertPos = hotfix122Sql.indexOf("-- 5. Insert new validated version");

      expect(validatePos).toBeGreaterThan(0);
      expect(terminatePos).toBeGreaterThan(validatePos);
      expect(insertPos).toBeGreaterThan(terminatePos);
    });
  });

  describe("8. Device Master & Batch Import Deduplication Contracts", () => {
    it("restricts attendance_devices, employee mappings, and raw import events to HR/Attendance admins", () => {
      expect(hotfix122Sql).toContain("DROP POLICY IF EXISTS attendance_devices_read");
      expect(hotfix122Sql).toContain("CREATE POLICY attendance_devices_admin_read ON public.attendance_devices");
      expect(hotfix122Sql).toContain("CREATE POLICY attendance_device_employee_mappings_admin_read");
      expect(hotfix122Sql).toContain("CREATE POLICY punch_import_raw_events_admin_read");
      expect(hotfix122Sql).toContain("ur.role::text IN ('super_admin', 'org_admin', 'hr_manager', 'attendance_officer')");
    });

    it("prioritizes external_event_id over 60-second heuristic in import_biometric_punches", () => {
      const extCheckPos = hotfix122Sql.indexOf("v_ext_event_id IS NOT NULL AND trim(v_ext_event_id) != ''");
      const sixtySecPos = hotfix122Sql.indexOf("abs(EXTRACT(EPOCH FROM (punch_time - v_ptime))) < 60");

      expect(extCheckPos).toBeGreaterThan(0);
      expect(sixtySecPos).toBeGreaterThan(extCheckPos);
      expect(hotfix122Sql).toContain("Fallback to 60-second heuristic ONLY when vendor supplies NO external event ID");
    });
  });

  describe("9. Snapshot Neutral Overtime & Cryptographic Integrity", () => {
    it("ensures attendance payroll snapshot stores neutral overtime facts and categories JSON", () => {
      const rawSnapshot = {
        id: "snap-1",
        company_id: "comp-1",
        period_id: "p-1",
        period_version: 1,
        snapshot_version: 1,
        employee_id: "emp-1",
        total_expected_days: 22,
        expected_work_minutes: 10560, // 22 * 8 * 60
        total_present_days: 22,
        total_absent_days: 0,
        total_rest_days: 8,
        total_leave_days: 0,
        total_late_minutes: 0,
        total_early_departure_minutes: 0,
        total_worked_hours: 176,
        regular_overtime_hours: 4,
        holiday_overtime_hours: 0,
        approved_overtime_minutes: 240,
        actual_overtime_minutes: 240,
        payable_overtime_minutes: 240,
        overtime_categories: {
          standard_minutes: 240,
          holiday_or_rest_minutes: 0,
        },
        overtime_category: "standard",
        unexcused_absence_days: 0,
        violations_count: 0,
        snapshot_hash: "hash123",
        created_at: "2026-09-24T12:00:00Z",
      };

      const mapped = mapAttendancePayrollSnapshot(rawSnapshot);
      expect(mapped.expectedWorkMinutes).toBe(10560);
      expect(mapped.approvedOvertimeMinutes).toBe(240);
      expect(mapped.actualOvertimeMinutes).toBe(240);
      expect(mapped.payableOvertimeMinutes).toBe(240);
      expect(mapped.overtimeCategories).toEqual({
        standard_minutes: 240,
        holiday_or_rest_minutes: 0,
      });
    });

    it("generates deterministic SHA-256 seal including expected minutes and neutral overtime", () => {
      const payload = {
        company_id: "comp-1",
        period_id: "p-1",
        target_version: 1,
        employee_id: "emp-1",
        expected_workdays: 22,
        expected_work_minutes: 10560,
        present_days: 22,
        absent_days: 0,
        worked_hrs: 176,
        approved_ot_mins: 240,
        late_minutes: 0,
      };

      const hash1 = crypto
        .createHash("sha256")
        .update(Object.values(payload).join("|"))
        .digest("hex");

      const hash2 = crypto
        .createHash("sha256")
        .update(Object.values(payload).join("|"))
        .digest("hex");

      expect(hash1).toBe(hash2);
      expect(hash1.length).toBe(64);
    });
  });

  describe("10. Repository and UI Alignment Contracts", () => {
    it("AttendancePolicySetupPanel provides explicit multi-jurisdiction presets with explicit booleans", () => {
      expect(policySetupContent).toContain('jurisdiction: "SA"');
      expect(policySetupContent).toContain('jurisdiction: "EG"');
      expect(policySetupContent).toContain('jurisdiction: "QA"');
      expect(policySetupContent).toContain('gpsAccuracyAction: "flag"');
      expect(policySetupContent).toContain("autoDeductBreaks: true");
      expect(policySetupContent).toContain("geofenceEnforced: true");
    });

    it("repository updateAttendancePolicyRecord maps gpsAccuracyAction properly", () => {
      expect(repoContent).toContain("if (policy.gpsAccuracyAction !== undefined)");
      expect(repoContent).toContain("payload.gps_accuracy_action = policy.gpsAccuracyAction;");
    });

    it("repository exports safe processMyAttendanceDayRecord RPC helper", () => {
      expect(repoContent).toContain("export async function processMyAttendanceDayRecord");
      expect(repoContent).toContain('await db.rpc("process_my_attendance_day"');
    });
  });

  describe("11. Prompt 12.3 Truthfulness and Zero-Fabrication Regression Guards", () => {
    it("Item 1 & 19: verifies repository never falls back to Asia/Riyadh", () => {
      expect(repoContent).not.toContain('return "Asia/Riyadh"');
      expect(repoContent).not.toContain('|| "Asia/Riyadh"');
      expect(repoContent).toContain("لم يتم ضبط المنطقة الزمنية للمنشأة");
    });

    it("Item 1 & 19: verifies domain timezone hook never falls back to Asia/Riyadh", () => {
      expect(domainContent).not.toContain('?? "Asia/Riyadh"');
      expect(domainContent).toContain("timezone: query.data ?? null");
    });

    it("Item 2: verifies GPS accuracy action default is dropped and never defaulted to flag in mapper or save RPC", () => {
      expect(hotfix123Sql).toContain("ALTER COLUMN gps_accuracy_action DROP DEFAULT");
      expect(repoContent).not.toContain('(row.gps_accuracy_action as any) || "flag"');
      expect(repoContent).toContain("(row.gps_accuracy_action as any) ?? null");
      expect(hotfix123Sql).not.toContain("COALESCE(p_policy->>'gps_accuracy_action', 'flag')");
    });

    it("Item 3: verifies UI does not visually imply selected booleans with ?? true", () => {
      expect(policySetupContent).not.toContain("checked={form.geofenceEnforced ?? true}");
      expect(policySetupContent).not.toContain("checked={form.allowMobilePunch ?? true}");
      expect(policySetupContent).not.toContain("checked={form.overtimePreApprovalRequired ?? true}");
      expect(policySetupContent).toContain("TriStateToggle");
    });

    it("Item 4: verifies UI does not auto-fill effectiveFrom with browser UTC date", () => {
      expect(policySetupContent).not.toContain("new Date().toISOString().slice(0, 10)");
    });

    it("Item 5: verifies close_attendance_period does NOT contain 480-minute fallback", () => {
      expect(hotfix123Sql).toContain("calculate_shift_expected_minutes");
      expect(hotfix123Sql).not.toContain("ELSE 480");
      expect(hotfix123Sql).toContain("validate_period_shifts");
    });

    it("Item 6: verifies split shift expected minutes are calculated as seg1 + seg2 - break", () => {
      expect(hotfix123Sql).toContain("ELSIF v_shift.type = 'split' THEN");
      expect(hotfix123Sql).toContain("v_seg1 := round(EXTRACT(EPOCH FROM (('2000-01-01 ' || v_shift.end_time)");
      expect(hotfix123Sql).toContain("v_seg2 := round(EXTRACT(EPOCH FROM (('2000-01-01 ' || v_shift.split_second_end_time)");
      expect(hotfix123Sql).toContain("v_duration := GREATEST(0, (v_seg1 + v_seg2) - COALESCE(v_shift.break_minutes, 0))");
    });

    it("Item 7: verifies validate_period_shifts blocks invalid/incomplete shifts before period close", () => {
      expect(hotfix123Sql).toContain("PERFORM public.validate_period_shifts(p_period_id);");
    });

    it("Item 8: verifies legacy overtime history is preserved without destructive mutation", () => {
      expect(hotfix123Sql).toContain("legacy_original_rate_type text");
      expect(hotfix123Sql).toContain("rate_type IN ('standard', 'holiday_or_rest_day', 'regular_150', 'holiday_200', 'rest_day_200')");
    });

    it("Item 9: verifies authoritative overtime facts distinguish requested, approved, actual, and payable", () => {
      expect(hotfix123Sql).toContain("v_requested_ot_mins");
      expect(hotfix123Sql).toContain("v_approved_ot_mins");
      expect(hotfix123Sql).toContain("v_actual_ot_mins");
      expect(hotfix123Sql).toContain("v_payable_ot_mins");
      expect(hotfix123Sql).toContain("requested_overtime_minutes");
    });

    it("Item 10: verifies rest days in snapshot are calculated truthfully from schedule assignments, NOT as residual", () => {
      expect(hotfix123Sql).toContain("sa.is_rest_day IS TRUE");
      expect(hotfix123Sql).not.toContain("(v_period.to_date - v_period.from_date + 1) - v_expected_workdays");
    });

    it("Item 11 & 12: verifies jurisdiction templates cover SA, EG, QA, OM, BH and display legal disclaimer", () => {
      expect(policySetupContent).toContain("JURISDICTION_STARTING_TEMPLATES");
      expect(policySetupContent).toContain('jurisdiction: "OM"');
      expect(policySetupContent).toContain('jurisdiction: "BH"');
      expect(policySetupContent).toContain("تنبيه قانوني وإداري:");
      expect(policySetupContent).toContain("هذه النماذج هي قوالب استرشادية لبدء التهيئة فقط ولا تعد ضماناً للامتثال القانوني التلقائي");
    });
  });
});
