import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migrationSource = readFileSync(
  new URL(
    "../../supabase/migrations/20260922200000_production_attendance_engine.sql",
    import.meta.url,
  ),
  "utf8",
);
const attendanceBusinessSource = readFileSync(
  new URL("../lib/business/attendance.functions.ts", import.meta.url),
  "utf8",
);
const attendanceDomainSource = readFileSync(
  new URL("../lib/domains/attendance/index.ts", import.meta.url),
  "utf8",
);
const attendanceViewSource = readFileSync(
  new URL("../components/attendance/AttendanceView.tsx", import.meta.url),
  "utf8",
);
const terminalSource = readFileSync(
  new URL("../components/attendance/BiometricTerminalPanel.tsx", import.meta.url),
  "utf8",
);
const devicesSource = readFileSync(
  new URL("../components/attendance/BiometricDevicesPanel.tsx", import.meta.url),
  "utf8",
);
const setupSource = readFileSync(
  new URL("../components/setup/SetupDashboard.tsx", import.meta.url),
  "utf8",
);
const setupProgressSource = readFileSync(
  new URL("../lib/domains/setup/setup-progress.ts", import.meta.url),
  "utf8",
);
const repositorySource = readFileSync(
  new URL("../lib/data/operational-repository.ts", import.meta.url),
  "utf8",
);

describe("Prompt 12 — Production Attendance Contract", () => {
  describe("tenant scope and policy", () => {
    it("adds company-scoped attendance policy and close lifecycle", () => {
      expect(migrationSource).toContain("CREATE TABLE IF NOT EXISTS public.attendance_policies");
      expect(migrationSource).toContain("CREATE TABLE IF NOT EXISTS public.attendance_periods");
      expect(migrationSource).toContain("company_id uuid");
      expect(migrationSource).toContain("close_attendance_period");
    });

    it("requires explicit attendance policy instead of hidden UI assumptions", () => {
      expect(migrationSource).toContain("get_attendance_policy");
      expect(migrationSource).toContain("upsert_attendance_policy");
      expect(setupSource).toContain("AttendancePolicySetupPanel");
      expect(setupProgressSource).toContain("attendancePolicyConfigured");
    });

    it("does not claim setup is complete without attendance policy", () => {
      expect(setupProgressSource).toContain('id: "attendance_policy"');
      expect(setupProgressSource).toContain("complete: isAttendancePolicyComplete");
    });
  });

  describe("mobile GPS and geofence", () => {
    it("uses Haversine distance and server-resolved employee identity", () => {
      expect(migrationSource).toContain("attendance_distance_meters");
      expect(migrationSource).toContain("record_mobile_attendance_punch");
      expect(migrationSource).toContain("WHERE user_id = auth.uid()");
      expect(migrationSource).toContain("max_location_accuracy_meters");
    });

    it("passes browser GPS accuracy to the authoritative RPC", () => {
      expect(attendanceViewSource).toContain("accuracy: pos.coords.accuracy");
      expect(repositorySource).toContain("p_accuracy_meters: input.accuracyMeters");
    });

    it("does not silently bypass required geofence when location is unavailable", () => {
      expect(attendanceViewSource).toContain(
        "لا يمكن تسجيل الحضور بدون موقع جغرافي لأن السياج الجغرافي إلزامي",
      );
    });
  });

  describe("biometric ingestion security", () => {
    it("stores hashed device token and returns raw token only through RPC", () => {
      expect(migrationSource).toContain("device_token_hash");
      expect(migrationSource).toContain("digest(v_token, 'sha256')");
      expect(migrationSource).toContain("rotate_biometric_device_token");
      expect(migrationSource).toContain("device_token = NULL");
    });

    it("uses external event idempotency for physical device ingestion", () => {
      expect(migrationSource).toContain("uq_punches_company_external_event");
      expect(migrationSource).toContain("ingest_biometric_punch");
      expect(migrationSource).toContain("p_external_event_id");
    });

    it("does not ship a fake terminal device id", () => {
      expect(terminalSource).not.toContain("FP-TERMINAL-01");
      expect(terminalSource).not.toContain("FP-TERMINAL-02");
    });

    it("does not couple biometric UI copy to payroll settlement", () => {
      expect(devicesSource).not.toContain("تنعكس على الحضور ثم على تسوية الرواتب");
    });
  });

  describe("attendance processing truthfulness", () => {
    it("requires company timezone and company-scoped processing", () => {
      expect(attendanceBusinessSource).toContain('"current_user_company_id"');
      expect(attendanceBusinessSource).toContain("company.timezone");
      expect(attendanceBusinessSource).toContain('.eq("company_id", companyId)');
    });

    it("uses approved punches and published schedules", () => {
      expect(attendanceBusinessSource).toContain('.eq("approval_status", "approved")');
      expect(attendanceBusinessSource).toContain('.eq("status", "published")');
      expect(attendanceBusinessSource).toContain("require_published_schedule");
    });

    it("has no legacy eight-hour fallback calculator", () => {
      expect(attendanceBusinessSource).not.toContain("let expectedMinutes = 8 * 60");
      expect(attendanceBusinessSource).not.toContain("expectedMinutes = 8 * 60");
      expect(attendanceBusinessSource).not.toContain("recomputeDay(");
    });

    it("supports overnight schedules and explicit attendance exception statuses", () => {
      expect(attendanceBusinessSource).toContain("const overnight");
      expect(migrationSource).toContain("'early_departure'");
      expect(migrationSource).toContain("'holiday'");
      expect(migrationSource).toContain("'rest_day'");
      expect(migrationSource).toContain("'missing_punch'");
    });

    it("uses approved leave and company holidays in processing", () => {
      expect(attendanceBusinessSource).toContain('.eq("type", "leave")');
      expect(attendanceBusinessSource).toContain('.eq("status", "approved")');
      expect(attendanceBusinessSource).toContain('.from("company_holidays")');
    });
  });

  describe("attendance is decoupled from payroll", () => {
    it("does not calculate or lock payroll from attendance server functions", () => {
      expect(attendanceBusinessSource).not.toContain("computePayrollRun");
      expect(attendanceBusinessSource).not.toContain("settleAttendancePeriodServer");
      expect(attendanceBusinessSource).toContain("closeAttendancePeriodServer");
    });

    it("close operation explicitly calls attendance period RPC only", () => {
      expect(attendanceBusinessSource).toContain('"close_attendance_period"');
      expect(terminalSource).toContain("لم يتم تشغيل أو قفل الرواتب");
    });

    it("blocks closing unresolved attendance operations", () => {
      expect(migrationSource).toContain("v_pending_punches");
      expect(migrationSource).toContain("v_missing_records");
      expect(migrationSource).toContain("v_unprocessed_schedules");
      expect(migrationSource).toContain("v_pending_corrections");
      expect(migrationSource).toContain("v_pending_overtime");
    });
  });

  describe("overtime duration vs payroll pricing", () => {
    it("attendance stores unpriced overtime and leaves money to payroll", () => {
      expect(migrationSource).toContain("'pending_payroll_rule'");
      expect(migrationSource).toContain("rate_multiplier >= 0");
      expect(attendanceViewSource).toContain("التسعير المالي يتم داخل دورة الرواتب");
    });

    it("client no longer computes salary/rate multipliers for overtime", () => {
      expect(attendanceViewSource).not.toContain("calculatedHourlyRate");
      expect(attendanceViewSource).not.toContain("calculatedOtTotal");
      expect(attendanceViewSource).not.toContain("otMultiplier");
      expect(attendanceViewSource).not.toContain("basicSalary || 6000");
    });

    it("approval does not add assigned overtime hours into attendance record", () => {
      const finalApproveStart = migrationSource.lastIndexOf(
        "CREATE OR REPLACE FUNCTION public.approve_overtime_request",
      );
      const finalApproveEnd = migrationSource.indexOf(
        "CREATE OR REPLACE FUNCTION public.reject_overtime_request",
        finalApproveStart,
      );
      const approveBody = migrationSource.slice(finalApproveStart, finalApproveEnd);
      expect(approveBody).not.toContain("UPDATE public.attendance_records");
      expect(approveBody).not.toContain("INSERT INTO public.attendance_records");
    });
  });

  describe("attendance correction integrity", () => {
    it("self-service correction resolves employee from authenticated account", () => {
      expect(migrationSource).toContain("submit_attendance_correction");
      expect(migrationSource).toContain("WHERE user_id = auth.uid()");
    });

    it("final correction approval does not fabricate 08:00 or 17:00", () => {
      const finalApprovalStart = migrationSource.lastIndexOf(
        "CREATE OR REPLACE FUNCTION public.approve_attendance_correction",
      );
      const finalApprovalEnd = migrationSource.indexOf(
        "CREATE OR REPLACE FUNCTION public.reject_attendance_correction",
        finalApprovalStart,
      );
      const body = migrationSource.slice(finalApprovalStart, finalApprovalEnd);
      expect(body).not.toContain("'08:00'::time");
      expect(body).not.toContain("'17:00'::time");
      expect(body).toContain("v_att.check_in");
      expect(body).toContain("v_att.check_out");
    });

    it("UI starts corrected times blank", () => {
      expect(attendanceViewSource).toContain('setCorrectInTime] = useState("")');
      expect(attendanceViewSource).toContain('setCorrectOutTime] = useState("")');
    });
  });

  describe("dedicated live queries and privacy", () => {
    it("uses dedicated self/company attendance records", () => {
      expect(attendanceDomainSource).toContain("fetchMyAttendanceRecordsRecord");
      expect(attendanceDomainSource).toContain("fetchCompanyAttendanceRecordsRecord");
    });

    it("uses dedicated scoped overtime and correction queries", () => {
      expect(attendanceDomainSource).toContain("fetchScopedOvertimeRecordsRecord");
      expect(attendanceDomainSource).toContain("fetchScopedAttendanceCorrectionsRecord");
      expect(attendanceDomainSource).not.toContain("bootstrap.overtimeRecords");
      expect(attendanceDomainSource).not.toContain("bootstrap.attendanceCorrections");
    });

    it("uses secure employee directory rather than useApp employee array for overtime picker", () => {
      expect(attendanceViewSource).toContain("useEmployeeDirectory");
      expect(attendanceViewSource).not.toMatch(/const\s*\{[\s\S]{0,300}\bemployees\b[\s\S]{0,300}\}\s*=\s*useApp\(\)/);
    });
  });

  describe("UI truthfulness", () => {
    it("contains no fixed 120/+104 KPI fabrication", () => {
      expect(attendanceViewSource).not.toContain("totalEmployeesCount = 120");
      expect(attendanceViewSource).not.toContain("+ 104");
    });

    it("contains no hardcoded Saudi legal article or fake city coordinates", () => {
      expect(attendanceViewSource).not.toContain("المادة 107");
      expect(attendanceViewSource).not.toContain("24.7136");
      expect(attendanceViewSource).not.toContain("46.6753");
      expect(attendanceViewSource).not.toContain("مقر الرياض");
    });

    it("shows configuration state rather than silently guessing timezone/policy", () => {
      expect(attendanceViewSource).toContain("الحضور يحتاج تهيئة تشغيل مكتملة");
      expect(attendanceViewSource).toContain("timezoneConfigured");
      expect(attendanceViewSource).toContain("attendancePolicy?.configured");
    });
  });
});
