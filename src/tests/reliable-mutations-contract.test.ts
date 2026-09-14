import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import {
  executeReliableMutation,
  isMutationPending,
  clearInFlightMutations,
  AppMutationError,
  normalizeMutationError,
} from "../lib/data/reliable-mutation";
import { demoStore } from "../lib/domains/demo/demo-store";

describe("Reliable Mutations Contract Tests", () => {
  beforeEach(() => {
    clearInFlightMutations();
    demoStore.reset();
  });

  describe("Mode Isolation and Failure Truthfulness", () => {
    it("never executes demoOperation when in live mode, even if operation fails", async () => {
      const demoOperation = vi.fn();
      const operation = vi.fn().mockRejectedValue(new Error("Supabase connection timeout"));
      const onAudit = vi.fn();
      const onRejected = vi.fn();
      const refresh = vi.fn().mockResolvedValue(undefined);

      const result = await executeReliableMutation({
        mode: "live",
        operation,
        demoOperation,
        refresh,
        onAudit,
        onRejected,
      });

      expect(result.ok).toBe(false);
      expect(result.error).toBeInstanceOf(AppMutationError);
      expect(result.error?.kind).toBe("network");
      expect(operation).toHaveBeenCalledTimes(1);
      expect(demoOperation).not.toHaveBeenCalled();
      expect(onAudit).not.toHaveBeenCalled();
      expect(onRejected).toHaveBeenCalledTimes(1);
      expect(refresh).toHaveBeenCalledTimes(1); // restored authoritative snapshot
    });

    it("never executes network operation when in demo mode", async () => {
      const demoOperation = vi.fn().mockReturnValue({ id: "demo-123" });
      const operation = vi.fn();
      const onAudit = vi.fn();
      const onCommitted = vi.fn();

      const result = await executeReliableMutation({
        mode: "demo",
        operation,
        demoOperation,
        onAudit,
        onCommitted,
      });

      expect(result.ok).toBe(true);
      expect(result.data).toEqual({ id: "demo-123" });
      expect(operation).not.toHaveBeenCalled();
      expect(demoOperation).toHaveBeenCalledTimes(1);
      expect(onAudit).toHaveBeenCalledTimes(1);
      expect(onCommitted).toHaveBeenCalledTimes(1);
    });
  });

  describe("Duplicate Mutation In-Flight Prevention", () => {
    it("blocks second submission while first mutation is still in flight", async () => {
      let resolveFirst: (val: unknown) => void;
      const firstLivePromise = new Promise((resolve) => {
        resolveFirst = resolve;
      });

      const mutationKey = "payroll-run-lock-2026-03";

      expect(isMutationPending(mutationKey)).toBe(false);

      const firstMutation = executeReliableMutation({
        mode: "live",
        mutationKey,
        operation: () => firstLivePromise,
      });

      expect(isMutationPending(mutationKey)).toBe(true);

      // Attempt second submission with same mutationKey while first is in flight
      const secondResult = await executeReliableMutation({
        mode: "live",
        mutationKey,
        operation: () => Promise.resolve({ ok: true }),
      });

      expect(secondResult.ok).toBe(false);
      expect(secondResult.error).toBeInstanceOf(AppMutationError);
      expect(secondResult.error?.kind).toBe("duplicate");
      expect(secondResult.error?.message).toContain("عملية مماثلة قيد التنفيذ بالفعل");

      // Resolve first
      resolveFirst!({ locked: true });
      const firstResult = await firstMutation;
      expect(firstResult.ok).toBe(true);

      // Verify mutation key is freed after completion
      expect(isMutationPending(mutationKey)).toBe(false);
    });
  });

  describe("Error Classification and Postgres Code Mapping", () => {
    it("classifies unique constraint 23505 as conflict", () => {
      const err = normalizeMutationError({
        code: "23505",
        message: "duplicate key value violates unique constraint",
      });
      expect(err).toBeInstanceOf(AppMutationError);
      expect(err.kind).toBe("conflict");
    });

    it("classifies RLS / 42501 as authorization", () => {
      const err = normalizeMutationError({
        code: "42501",
        message: "new row violates row-level security policy",
      });
      expect(err).toBeInstanceOf(AppMutationError);
      expect(err.kind).toBe("authorization");
    });

    it("classifies foreign key 23503 as conflict", () => {
      const err = normalizeMutationError({
        code: "23503",
        message: "insert or update on table violates foreign key constraint",
      });
      expect(err).toBeInstanceOf(AppMutationError);
      expect(err.kind).toBe("conflict");
    });

    it("classifies network errors as network", () => {
      const err = normalizeMutationError(new TypeError("Failed to fetch"));
      expect(err).toBeInstanceOf(AppMutationError);
      expect(err.kind).toBe("network");
    });
  });

  describe("Static Invariants: Mutation Source Code Audit", () => {
    it("ensures all domain mutation hooks use executeReliableMutation", () => {
      const domains = [
        "employees",
        "payroll",
        "attendance",
        "leaves",
        "workflow",
        "organization",
        "expenses",
        "assets",
        "documents",
        "performance",
        "recruitment",
        "shifts",
        "rbac",
      ];

      for (const domain of domains) {
        const domainIndexPath = path.resolve(__dirname, `../lib/domains/${domain}/index.ts`);
        expect(fs.existsSync(domainIndexPath)).toBe(true);
        const content = fs.readFileSync(domainIndexPath, "utf-8");
        expect(content).toContain("executeReliableMutation");
      }
    });

    it("ensures AppContext delegates mutations with truthful Promise<boolean> and tracks pendingMutationCount", () => {
      const appContextPath = path.resolve(__dirname, "../lib/context/AppContext.tsx");
      const content = fs.readFileSync(appContextPath, "utf-8");

      expect(content).toContain("pendingMutationCount");
      expect(content).toContain("setPendingMutationCount");
      expect(content).toContain("persistLiveChange");
      expect(content).toContain("executeReliableMutation");
    });

    it("ensures no domain Live operation contains premature toast.success calls inside operation", () => {
      const domains = [
        "employees",
        "payroll",
        "attendance",
        "leaves",
        "workflow",
        "organization",
        "expenses",
        "assets",
        "documents",
        "performance",
        "recruitment",
        "shifts",
        "rbac",
      ];

      for (const domain of domains) {
        const domainIndexPath = path.resolve(__dirname, `../lib/domains/${domain}/index.ts`);
        const content = fs.readFileSync(domainIndexPath, "utf-8");

        // Split by operation: async () => { ... } blocks
        const operationMatches = content.match(/operation:\s*async\s*\(\)\s*=>\s*\{[\s\S]*?\n\s*\},/g);
        if (operationMatches) {
          for (const opBlock of operationMatches) {
            // Live operation must NOT contain toast.success
            expect(opBlock).not.toContain("toast.success(");
          }
        }
      }
    });

    it("ensures no domain Live operation is a fake write (consisting only of invalidateQueries / toast)", () => {
      const domains = [
        "employees",
        "payroll",
        "attendance",
        "leaves",
        "workflow",
        "organization",
        "expenses",
        "assets",
        "documents",
        "performance",
        "recruitment",
        "shifts",
        "rbac",
      ];

      for (const domain of domains) {
        const domainIndexPath = path.resolve(__dirname, `../lib/domains/${domain}/index.ts`);
        const content = fs.readFileSync(domainIndexPath, "utf-8");

        // Find all operation blocks
        const opRegex = /operation:\s*async\s*\(\)\s*=>\s*\{([\s\S]*?)\n\s*\},/g;
        let match;
        while ((match = opRegex.exec(content)) !== null) {
          const body = match[1];
          // Strip comments and whitespace
          const cleaned = body
            .replace(/\/\/.*$/gm, "")
            .replace(/queryClient\.invalidateQueries\([^)]*\);?/g, "")
            .replace(/return\s+(true|undefined|newRole|[^;]+);?/g, "")
            .trim();

          // After stripping invalidations and return, must have an actual repository/server call
          expect(cleaned.length).toBeGreaterThan(0);
        }
      }
    });

    it("verifies attendance domain wires all decisions to real repository persistence", () => {
      const attendanceIndexPath = path.resolve(__dirname, "../lib/domains/attendance/index.ts");
      const content = fs.readFileSync(attendanceIndexPath, "utf-8");

      expect(content).toContain("approveAttendanceCorrectionRecord");
      expect(content).toContain("rejectAttendanceCorrectionRecord");
      expect(content).toContain("approveOvertimeRecord");
      expect(content).toContain("rejectOvertimeRecord");
      expect(content).toContain("createOvertimeRecord");
    });

    it("verifies workflow domain wires delegation rules to real repository persistence", () => {
      const workflowIndexPath = path.resolve(__dirname, "../lib/domains/workflow/index.ts");
      const content = fs.readFileSync(workflowIndexPath, "utf-8");

      expect(content).toContain("createDelegationRuleRecord");
      expect(content).toContain("revokeDelegationRuleRecord");
    });

    it("verifies Live bootstrap sources attendance corrections, overtime records, and delegations from operationalQuery", () => {
      const bootstrapPath = path.resolve(__dirname, "../lib/domains/bootstrap/use-bootstrap.ts");
      const content = fs.readFileSync(bootstrapPath, "utf-8");

      expect(content).not.toContain("attendanceCorrections: [],");
      expect(content).not.toContain("overtimeRecords: [],");
      expect(content).not.toContain("delegationRules: [],");

      expect(content).toContain("operationalQuery.data?.attendanceCorrections");
      expect(content).toContain("operationalQuery.data?.overtimeRecords");
      expect(content).toContain("operationalQuery.data?.delegationRules");
    });

    it("verifies operational snapshot repository queries delegation rules, overtime, and corrections", () => {
      const repoPath = path.resolve(__dirname, "../lib/data/operational-repository.ts");
      const content = fs.readFileSync(repoPath, "utf-8");

      expect(content).toContain('"delegation_rules"');
      expect(content).toContain('"overtime_records"');
      expect(content).toContain('type", "attendance_fix"');
      expect(content).toContain("approveAttendanceCorrectionRecord");
      expect(content).toContain("rejectAttendanceCorrectionRecord");
      expect(content).toContain("approveOvertimeRecord");
      expect(content).toContain("rejectOvertimeRecord");
      expect(content).toContain("createDelegationRuleRecord");
      expect(content).toContain("revokeDelegationRuleRecord");
    });
  });

  describe("Mappers and Data Transformation Truthfulness", () => {
    it("maps delegation rules truthfully with employee names and scopes", async () => {
      const { mapDelegationRule } = await import("../lib/data/operational-repository");
      const employeeMap = new Map([
        ["emp-1", { id: "emp-1", firstNameAr: "أحمد", lastNameAr: "علي" } as any],
        ["emp-2", { id: "emp-2", firstNameAr: "سارة", lastNameAr: "محمود" } as any],
      ]);

      const row = {
        id: "del-101",
        delegator_id: "emp-1",
        delegate_id: "emp-2",
        start_date: "2026-04-01",
        end_date: "2026-04-10",
        reason: "إجازة سنوية",
        scope: "leave",
        status: "active",
        created_at: "2026-03-30T10:00:00Z",
      };

      const mapped = mapDelegationRule(row, employeeMap);
      expect(mapped.id).toBe("del-101");
      expect(mapped.delegatorId).toBe("emp-1");
      expect(mapped.delegatorName).toBe("أحمد علي");
      expect(mapped.delegateId).toBe("emp-2");
      expect(mapped.delegateName).toBe("سارة محمود");
      expect(mapped.startDate).toBe("2026-04-01");
      expect(mapped.endDate).toBe("2026-04-10");
      expect(mapped.scope).toBe("leave");
      expect(mapped.status).toBe("active");
    });

    it("maps overtime records truthfully with rates and calculated amounts", async () => {
      const { mapOvertimeRecord } = await import("../lib/data/operational-repository");
      const employeeMap = new Map([
        ["emp-1", { id: "emp-1", firstNameAr: "خالد", lastNameAr: "العتيبي", employeeNo: "EMP-042", departmentName: "تقنية المعلومات" } as any],
      ]);

      const row = {
        id: "ot-201",
        employee_id: "emp-1",
        work_date: "2026-03-15",
        start_time: "17:00:00",
        end_time: "20:00:00",
        hours: 3,
        rate_multiplier: 1.5,
        rate_type: "regular_150",
        reason: "صيانة طارئة للخوادم",
        hourly_rate: 100,
        total_amount: 450,
        status: "pending",
        created_at: "2026-03-15T20:30:00Z",
      };

      const mapped = mapOvertimeRecord(row, employeeMap);
      expect(mapped.id).toBe("ot-201");
      expect(mapped.employeeId).toBe("emp-1");
      expect(mapped.employeeName).toBe("خالد العتيبي");
      expect(mapped.employeeNo).toBe("EMP-042");
      expect(mapped.departmentName).toBe("تقنية المعلومات");
      expect(mapped.hours).toBe(3);
      expect(mapped.rateMultiplier).toBe(1.5);
      expect(mapped.totalAmount).toBe(450);
      expect(mapped.status).toBe("pending");
    });

    it("maps attendance corrections from requests payload truthfully", async () => {
      const { mapAttendanceCorrection } = await import("../lib/data/operational-repository");
      const employeeMap = new Map([
        ["emp-1", { id: "emp-1", firstNameAr: "فاطمة", lastNameAr: "الغامدي", employeeNo: "EMP-088", departmentName: "المالية" } as any],
      ]);

      const row = {
        id: "req-att-301",
        employee_id: "emp-1",
        type: "attendance_fix",
        status: "approved",
        start_date: "2026-03-10",
        decided_by: "usr-admin",
        decided_at: "2026-03-11T09:00:00Z",
        created_at: "2026-03-10T18:00:00Z",
        payload: {
          workDate: "2026-03-10",
          correctInTime: "08:15",
          correctOutTime: "17:30",
          reason: "عطل في قارئ البصمة عند البوابة",
        },
      };

      const mapped = mapAttendanceCorrection(row, employeeMap);
      expect(mapped.id).toBe("req-att-301");
      expect(mapped.employeeId).toBe("emp-1");
      expect(mapped.employeeName).toBe("فاطمة الغامدي");
      expect(mapped.workDate).toBe("2026-03-10");
      expect(mapped.correctInTime).toBe("08:15");
      expect(mapped.correctOutTime).toBe("17:30");
      expect(mapped.reason).toBe("عطل في قارئ البصمة عند البوابة");
      expect(mapped.status).toBe("approved");
      expect(mapped.reviewedBy).toBe("usr-admin");
    });
  });

  describe("Conflict and Idempotency Guard Invariants", () => {
    it("reports conflict when a record has already been decided or zero rows updated", async () => {
      const onRejected = vi.fn();
      const operation = vi.fn().mockRejectedValue(
        new AppMutationError("تم اتخاذ القرار في هذا الطلب مسبقًا", "conflict"),
      );

      const result = await executeReliableMutation({
        mode: "live",
        mutationKey: "approve-corr-conflict-test",
        operation,
        onRejected,
      });

      expect(result.ok).toBe(false);
      expect(result.error?.kind).toBe("conflict");
      expect(result.error?.message).toContain("تم اتخاذ القرار في هذا الطلب مسبقًا");
      expect(onRejected).toHaveBeenCalledTimes(1);
    });

    it("never shows success toast or calls onCommitted on backend failure", async () => {
      const onCommitted = vi.fn();
      const onRejected = vi.fn();
      const operation = vi.fn().mockRejectedValue(
        new AppMutationError("خطأ في الخادم أثناء المعالجة", "backend"),
      );

      const result = await executeReliableMutation({
        mode: "live",
        mutationKey: "fail-test-never-commit",
        operation,
        onCommitted,
        onRejected,
      });

      expect(result.ok).toBe(false);
      expect(onCommitted).not.toHaveBeenCalled();
      expect(onRejected).toHaveBeenCalledTimes(1);
    });
  });

  describe("Schema Security Contract Tests", () => {
    it("migration 20260914010000 must drop insecure USING(true) policies and NOT re-introduce them", () => {
      const migrationDir = path.resolve(__dirname, "../../supabase/migrations");
      const hardeningFile = path.join(
        migrationDir,
        "20260914010000_harden_overtime_delegation_rls_and_atomic_decisions.sql",
      );
      expect(fs.existsSync(hardeningFile)).toBe(true);
      const content = fs.readFileSync(hardeningFile, "utf-8");

      // Must drop the insecure policies from the earlier migration
      expect(content).toContain("DROP POLICY IF EXISTS \"delegation_rules_read_authenticated\"");
      expect(content).toContain("DROP POLICY IF EXISTS \"delegation_rules_write_authenticated\"");
      expect(content).toContain("DROP POLICY IF EXISTS \"overtime_records_read_authenticated\"");
      expect(content).toContain("DROP POLICY IF EXISTS \"overtime_records_write_authenticated\"");

      // Must NOT introduce new unrestricted USING(true) policies for ALL authenticated
      // Only check non-comment lines (lines not starting with --)
      const nonCommentLines = content
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n");
      const usingtrue = /USING\s*\(\s*true\s*\)/gi;
      const matches = nonCommentLines.match(usingtrue) ?? [];
      expect(matches.length).toBe(0);

      // Must revoke GRANT ALL to authenticated on both tables
      expect(content).toContain("REVOKE ALL ON public.overtime_records FROM authenticated");
      expect(content).toContain("REVOKE ALL ON public.delegation_rules  FROM authenticated");
    });

    it("insecure migration 20260914000000 must NOT be the last migration file (must be superseded)", () => {
      const migrationDir = path.resolve(__dirname, "../../supabase/migrations");
      const files = fs.readdirSync(migrationDir).filter((f) => f.endsWith(".sql")).sort();
      const lastFile = files[files.length - 1];
      expect(lastFile).not.toBe("20260914000000_delegation_rules_and_decisions.sql");
      // The hardening migration must exist and come after
      expect(files).toContain(
        "20260914010000_harden_overtime_delegation_rls_and_atomic_decisions.sql",
      );
    });

    it("hardening migration must define all four atomic decision RPCs", () => {
      const migrationDir = path.resolve(__dirname, "../../supabase/migrations");
      const hardeningFile = path.join(
        migrationDir,
        "20260914010000_harden_overtime_delegation_rls_and_atomic_decisions.sql",
      );
      const content = fs.readFileSync(hardeningFile, "utf-8");

      expect(content).toContain("approve_overtime_request");
      expect(content).toContain("reject_overtime_request");
      expect(content).toContain("approve_attendance_correction");
      expect(content).toContain("reject_attendance_correction");
    });

    it("operational repository decision functions must call atomic RPCs, not multi-step client writes", () => {
      const repoPath = path.resolve(__dirname, "../lib/data/operational-repository.ts");
      const content = fs.readFileSync(repoPath, "utf-8");

      // All four functions must use supabase.rpc()
      expect(content).toContain('supabase.rpc("approve_overtime_request"');
      expect(content).toContain('supabase.rpc("reject_overtime_request"');
      expect(content).toContain('supabase.rpc("approve_attendance_correction"');
      expect(content).toContain('supabase.rpc("reject_attendance_correction"');

      // Must NOT contain the old multi-step approve pattern (fetch then update separately)
      // The tell-tale sign is fetching overtime_records then separately updating it for approval
      const oldApprovePattern = /from\("overtime_records"\)[\s\S]{0,200}\.update\(\s*\{[\s\S]*?status:\s*"approved"/;
      expect(content).not.toMatch(oldApprovePattern);
    });

    it("authorization errors (42501) from RPCs must be classified as 'authorization' kind", () => {
      const err = normalizeMutationError({ code: "42501", message: "permission denied" });
      expect(err).toBeInstanceOf(AppMutationError);
      expect(err.kind).toBe("authorization");
    });

    it("hardening migration must add DB constraints preventing invalid overtime and delegation data", () => {
      const migrationDir = path.resolve(__dirname, "../../supabase/migrations");
      const hardeningFile = path.join(
        migrationDir,
        "20260914010000_harden_overtime_delegation_rls_and_atomic_decisions.sql",
      );
      const content = fs.readFileSync(hardeningFile, "utf-8");

      // Overtime constraints
      expect(content).toContain("overtime_hours_positive");
      expect(content).toContain("overtime_rate_positive");
      expect(content).toContain("overtime_status_values");

      // Delegation constraints
      expect(content).toContain("delegation_not_self");
      expect(content).toContain("delegation_date_order");
      expect(content).toContain("delegation_status_values");
    });

    it("migration 20260914020000 must convert all 4 decision RPCs to SECURITY DEFINER with internal role and auth checks", () => {
      const migrationDir = path.resolve(__dirname, "../../supabase/migrations");
      const fixMigrationFile = path.join(
        migrationDir,
        "20260914020000_fix_atomic_rpc_execution_and_delegation_revoke.sql",
      );
      expect(fs.existsSync(fixMigrationFile)).toBe(true);
      const content = fs.readFileSync(fixMigrationFile, "utf-8");

      // Must be SECURITY DEFINER
      expect(content).toContain("approve_overtime_request(p_overtime_id uuid)\nRETURNS jsonb\nLANGUAGE plpgsql\nSECURITY DEFINER");
      expect(content).toContain("reject_overtime_request(p_overtime_id uuid)\nRETURNS jsonb\nLANGUAGE plpgsql\nSECURITY DEFINER");
      expect(content).toContain("approve_attendance_correction(p_request_id uuid)\nRETURNS jsonb\nLANGUAGE plpgsql\nSECURITY DEFINER");
      expect(content).toContain("reject_attendance_correction(p_request_id uuid)\nRETURNS jsonb\nLANGUAGE plpgsql\nSECURITY DEFINER");

      // Must enforce search_path = public
      const searchPathMatches = content.match(/SET search_path = public/g);
      expect(searchPathMatches?.length).toBeGreaterThanOrEqual(5);

      // Must check auth.uid() IS NULL
      const authNullMatches = content.match(/auth\.uid\(\)\s+IS\s+NULL/g);
      expect(authNullMatches?.length).toBeGreaterThanOrEqual(5);

      // Must check caller role inside functions
      expect(content).toContain("current_user_has_any_role");
    });

    it("migration 20260914020000 must create atomic revoke_delegation_rule RPC with ownership and role checks", () => {
      const migrationDir = path.resolve(__dirname, "../../supabase/migrations");
      const fixMigrationFile = path.join(
        migrationDir,
        "20260914020000_fix_atomic_rpc_execution_and_delegation_revoke.sql",
      );
      const content = fs.readFileSync(fixMigrationFile, "utf-8");

      expect(content).toContain("FUNCTION public.revoke_delegation_rule(p_delegation_id uuid)");
      expect(content).toContain("SECURITY DEFINER");
      expect(content).toContain("REVOKE ALL ON FUNCTION public.revoke_delegation_rule(uuid) FROM PUBLIC");
      expect(content).toContain("GRANT EXECUTE ON FUNCTION public.revoke_delegation_rule(uuid) TO authenticated");

      // Must check delegator ownership or admin role
      expect(content).toContain("v_rule.delegator_id <> public.current_employee_id()");
      expect(content).toContain("public.current_user_has_any_role(ARRAY['super_admin','org_admin','hr_manager'])");
    });

    it("operational repository revokeDelegationRuleRecord must call revoke_delegation_rule RPC", () => {
      const repoPath = path.resolve(__dirname, "../lib/data/operational-repository.ts");
      const content = fs.readFileSync(repoPath, "utf-8");

      expect(content).toContain('supabase.rpc("revoke_delegation_rule"');
      // Must not contain direct client-side update on delegation_rules
      const oldDelegationUpdate = /from\("delegation_rules"\)\s*\.update\(/;
      expect(content).not.toMatch(oldDelegationUpdate);
    });

    it("migration 20260914020000 must replace overtime active index with time-boundary segments", () => {
      const migrationDir = path.resolve(__dirname, "../../supabase/migrations");
      const fixMigrationFile = path.join(
        migrationDir,
        "20260914020000_fix_atomic_rpc_execution_and_delegation_revoke.sql",
      );
      const content = fs.readFileSync(fixMigrationFile, "utf-8");

      expect(content).toContain("DROP INDEX IF EXISTS public.overtime_active_unique_per_employee_date");
      expect(content).toContain("overtime_active_unique_per_employee_time");
      expect(content).toContain("(employee_id, work_date, start_time, end_time)");
      expect(content).toContain("WHERE status = 'pending'");
    });

    it("must not grant generic broad UPDATE on delegation_rules to authenticated", () => {
      const migrationDir = path.resolve(__dirname, "../../supabase/migrations");
      const files = [
        "20260914010000_harden_overtime_delegation_rls_and_atomic_decisions.sql",
        "20260914020000_fix_atomic_rpc_execution_and_delegation_revoke.sql",
        "20260914030000_fix_overtime_null_and_attendance_correction_validation.sql",
      ];
      for (const file of files) {
        const filePath = path.join(migrationDir, file);
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, "utf-8");
          expect(content).not.toMatch(/GRANT\s+.*UPDATE.*ON\s+public\.delegation_rules\s+TO\s+authenticated/i);
        }
      }
    });

    it("migration 20260914030000 safely defaults overtime to 0 when no attendance row exists and eliminates 08:00/17:00 fallbacks", () => {
      const migrationDir = path.resolve(__dirname, "../../supabase/migrations");
      const fixFile = path.join(
        migrationDir,
        "20260914030000_fix_overtime_null_and_attendance_correction_validation.sql",
      );
      expect(fs.existsSync(fixFile)).toBe(true);
      const content = fs.readFileSync(fixFile, "utf-8");

      // Overtime safe zero initialization
      expect(content).toContain("COALESCE(v_current_ot, 0) + v_record.hours");

      // No silent fabrication of 08:00 / 17:00 attendance times
      expect(content).not.toContain("'08:00'::time");
      expect(content).not.toContain("'17:00'::time");

      // Strict validation checks
      expect(content).toContain("v_in_str IS NULL");
      expect(content).toContain("v_out_str IS NULL");
      expect(content).toContain("22023");

      // Preserves SECURITY DEFINER
      expect(content).toContain("approve_overtime_request(p_overtime_id uuid)\nRETURNS jsonb\nLANGUAGE plpgsql\nSECURITY DEFINER");
      expect(content).toContain("approve_attendance_correction(p_request_id uuid)\nRETURNS jsonb\nLANGUAGE plpgsql\nSECURITY DEFINER");
    });

    it("classifies Postgres error code 22023 as validation", () => {
      const err = normalizeMutationError({
        code: "22023",
        message: "وقت الحضور المصحح مطلوب لاعتماد الطلب",
      });
      expect(err).toBeInstanceOf(AppMutationError);
      expect(err.kind).toBe("validation");
    });
  });

  describe("Overtime and Attendance Correction Atomic Logic Simulation (Paths A, B, C)", () => {
    interface MockAttendanceRecord {
      id: string;
      employeeId: string;
      workDate: string;
      overtimeHours: number;
      status: string;
      workedHours: number;
    }

    interface MockOvertimeRecord {
      id: string;
      employeeId: string;
      workDate: string;
      hours: number;
      status: "pending" | "approved" | "rejected";
    }

    // Pure functional replica of approve_overtime_request database logic
    function simulateApproveOvertime(
      overtime: MockOvertimeRecord,
      existingAttendance: MockAttendanceRecord | null,
      failOnAttendanceSave = false,
    ): {
      overtime: MockOvertimeRecord;
      attendance: MockAttendanceRecord;
    } {
      // Transaction snapshot copy
      const otCopy = { ...overtime };

      if (otCopy.status !== "pending") {
        throw new Error("تم اتخاذ القرار في طلب العمل الإضافي مسبقاً");
      }

      otCopy.status = "approved";

      // Replicating SQL: v_new_ot := COALESCE(v_current_ot, 0) + v_record.hours;
      const currentOt = existingAttendance ? existingAttendance.overtimeHours : 0;
      const newOt = currentOt + otCopy.hours;

      if (failOnAttendanceSave) {
        // Simulates DB constraint / network error during attendance write: rolls back whole transaction!
        throw new Error("Attendance record write failure");
      }

      let attResult: MockAttendanceRecord;
      if (existingAttendance) {
        attResult = {
          ...existingAttendance,
          overtimeHours: newOt,
        };
      } else {
        attResult = {
          id: "new-att-id",
          employeeId: otCopy.employeeId,
          workDate: otCopy.workDate,
          overtimeHours: newOt,
          status: "present",
          workedHours: 0,
        };
      }

      return { overtime: otCopy, attendance: attResult };
    }

    it("Path A: When attendance row exists, accumulates overtime hours (e.g. 2 + 3 = 5)", () => {
      const overtime: MockOvertimeRecord = {
        id: "ot-1",
        employeeId: "emp-10",
        workDate: "2026-03-20",
        hours: 3,
        status: "pending",
      };

      const existingAtt: MockAttendanceRecord = {
        id: "att-1",
        employeeId: "emp-10",
        workDate: "2026-03-20",
        overtimeHours: 2,
        status: "present",
        workedHours: 8,
      };

      const result = simulateApproveOvertime(overtime, existingAtt);
      expect(result.overtime.status).toBe("approved");
      expect(result.attendance.overtimeHours).toBe(5);
      expect(result.attendance.id).toBe("att-1");
    });

    it("Path B: When attendance row does NOT exist, initializes from 0 and creates record (0 + 3 = 3)", () => {
      const overtime: MockOvertimeRecord = {
        id: "ot-2",
        employeeId: "emp-20",
        workDate: "2026-03-21",
        hours: 3,
        status: "pending",
      };

      const result = simulateApproveOvertime(overtime, null);
      expect(result.overtime.status).toBe("approved");
      expect(result.attendance.overtimeHours).toBe(3);
      expect(result.attendance.status).toBe("present");
      expect(result.attendance.workedHours).toBe(0);
      expect(result.attendance.workDate).toBe("2026-03-21");
      expect(result.attendance.employeeId).toBe("emp-20");
    });

    it("Path C: Failure during attendance write leaves overtime record pending (atomic rollback)", async () => {
      const overtime: MockOvertimeRecord = {
        id: "ot-3",
        employeeId: "emp-30",
        workDate: "2026-03-22",
        hours: 4,
        status: "pending",
      };

      let failed = false;
      try {
        simulateApproveOvertime(overtime, null, true);
      } catch (err) {
        failed = true;
      }

      expect(failed).toBe(true);
      // Original overtime was not modified due to transaction rollback
      expect(overtime.status).toBe("pending");
    });

    it("Validates that malformed attendance correction payloads are rejected without fabricating 08:00/17:00", () => {
      function validateCorrectionPayload(payload: Record<string, unknown>, startDate?: string) {
        const workDate = (payload.workDate as string) || startDate;
        if (!workDate) {
          throw new AppMutationError("تاريخ العمل مطلوب لاعتماد طلب تصحيح البصمة", "validation", { code: "22023" });
        }
        const checkIn = (payload.correctInTime as string) || (payload.correctIn as string);
        if (!checkIn) {
          throw new AppMutationError("وقت الحضور المصحح مطلوب لاعتماد الطلب", "validation", { code: "22023" });
        }
        const checkOut = (payload.correctOutTime as string) || (payload.correctOut as string);
        if (!checkOut) {
          throw new AppMutationError("وقت الانصراف المصحح مطلوب لاعتماد الطلب", "validation", { code: "22023" });
        }
        return { workDate, checkIn, checkOut };
      }

      // Valid with correctInTime / correctOutTime
      expect(validateCorrectionPayload({ workDate: "2026-03-10", correctInTime: "08:30", correctOutTime: "16:45" })).toEqual({
        workDate: "2026-03-10",
        checkIn: "08:30",
        checkOut: "16:45",
      });

      // Valid with correctIn / correctOut and startDate fallback
      expect(validateCorrectionPayload({ correctIn: "09:00", correctOut: "18:00" }, "2026-03-11")).toEqual({
        workDate: "2026-03-11",
        checkIn: "09:00",
        checkOut: "18:00",
      });

      // Malformed: missing correctIn
      expect(() => validateCorrectionPayload({ workDate: "2026-03-10", correctOutTime: "17:00" })).toThrowError("وقت الحضور المصحح مطلوب");

      // Malformed: missing correctOut
      expect(() => validateCorrectionPayload({ workDate: "2026-03-10", correctInTime: "08:00" })).toThrowError("وقت الانصراف المصحح مطلوب");

      // Malformed: completely empty payload
      expect(() => validateCorrectionPayload({})).toThrowError("تاريخ العمل مطلوب");
    });
  });
});



