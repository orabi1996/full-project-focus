import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { queryKeys } from "../lib/query/query-keys";
import {
  canAccessModule,
  canEditHrProfile,
  canEditAssignment,
  canEditPayroll,
  canEditBank,
  canChangeLifecycle,
  canExportEmployees,
} from "../lib/auth/permissions";

const migrationSource = readFileSync(
  new URL("../../supabase/migrations/20260915010000_finalize_employee_directory_detail_and_avatar_security.sql", import.meta.url),
  "utf8",
);
const repoSource = readFileSync(
  new URL("../lib/data/hrms-repository.ts", import.meta.url),
  "utf8",
);
const domainSource = readFileSync(
  new URL("../lib/domains/employees/index.ts", import.meta.url),
  "utf8",
);
const employeesViewSource = readFileSync(
  new URL("../components/employees/EmployeesView.tsx", import.meta.url),
  "utf8",
);
const fullProfileSource = readFileSync(
  new URL("../components/employees/EmployeeFullProfileView.tsx", import.meta.url),
  "utf8",
);
const modalSource = readFileSync(
  new URL("../components/employees/EmployeeProfileModal.tsx", import.meta.url),
  "utf8",
);

describe("Prompt 09 Final Narrow Employee Production Hotfix Contract Tests", () => {
  // =========================================================================
  // 1. Authoritative Employee Directory & Server-Side Pagination
  // =========================================================================
  describe("1. Authoritative Employee Directory & Server-Side Pagination", () => {
    it("migration enhances get_employee_directory with field minimization and advanced filters", () => {
      expect(migrationSource).toContain("FUNCTION public.get_employee_directory");
      expect(migrationSource).toContain("p_contract_type text DEFAULT NULL");
      expect(migrationSource).toContain("p_nationality text DEFAULT NULL");
      expect(migrationSource).toContain("p_quick_preset text DEFAULT NULL");
      expect(migrationSource).toContain("p_min_salary numeric DEFAULT NULL");
      expect(migrationSource).toContain("p_max_salary numeric DEFAULT NULL");
      expect(migrationSource).toContain("v_is_hr :=");
      expect(migrationSource).toContain("v_can_view_payroll :=");
      expect(migrationSource).toContain("REVOKE ALL ON FUNCTION public.get_employee_directory FROM PUBLIC");
      expect(migrationSource).toContain("GRANT EXECUTE ON FUNCTION public.get_employee_directory TO authenticated");
    });

    it("migration provisions get_employee_directory_kpis RPC for truthful aggregate metrics", () => {
      expect(migrationSource).toContain("FUNCTION public.get_employee_directory_kpis");
      expect(migrationSource).toContain("'total_employees', v_total");
      expect(migrationSource).toContain("'saudi_employees', v_saudi");
      expect(migrationSource).toContain("'expat_employees', v_expat");
      expect(migrationSource).toContain("'saudization_rate', v_saudization_rate");
      expect(migrationSource).toContain("'probation_count', v_probation");
      expect(migrationSource).toContain("'on_leave_count', v_on_leave");
      expect(migrationSource).toContain("REVOKE ALL ON FUNCTION public.get_employee_directory_kpis FROM PUBLIC");
      expect(migrationSource).toContain("GRANT EXECUTE ON FUNCTION public.get_employee_directory_kpis TO authenticated");
    });

    it("hrms-repository exports fetchEmployeeDirectoryRecord with enhanced filter mapping", () => {
      expect(repoSource).toContain("export async function fetchEmployeeDirectoryRecord");
      expect(repoSource).toContain("p_contract_type: filters.contractType || null");
      expect(repoSource).toContain("p_nationality: filters.nationality || null");
      expect(repoSource).toContain("p_quick_preset: filters.quickPreset || null");
      expect(repoSource).toContain("p_min_salary: filters.minSalary !== undefined");
      expect(repoSource).toContain("p_max_salary: filters.maxSalary !== undefined");
    });

    it("hrms-repository exports fetchEmployeeDirectoryKpisRecord", () => {
      expect(repoSource).toContain("export async function fetchEmployeeDirectoryKpisRecord");
      expect(repoSource).toContain('enterpriseSupabase.rpc("get_employee_directory_kpis")');
    });

    it("domain module exports useEmployeeDirectory and useEmployeeDirectoryKpis hooks", () => {
      expect(domainSource).toContain("export function useEmployeeDirectory");
      expect(domainSource).toContain("export function useEmployeeDirectoryKpis");
      expect(domainSource).toContain("export function useEmployeeAvatar");
    });

    it("queryKeys includes kpis query key under employees namespace", () => {
      expect(queryKeys.employees.kpis).toBeDefined();
      expect(queryKeys.employees.kpis()).toEqual(["employees", "kpis"]);
    });

    it("EmployeesView is wired directly to useEmployeeDirectory without depending on bootstrap employees", () => {
      expect(employeesViewSource).toContain("useEmployeeDirectory(directoryFilters)");
      expect(employeesViewSource).toContain("useEmployeeDirectoryKpis()");
      expect(employeesViewSource).not.toMatch(/const\s*\{\s*[^}]*\bemployees\b[^}]*\}\s*=\s*useApp\(\)/);
    });

    it("EmployeesView contains UI pagination and sorting controls", () => {
      expect(employeesViewSource).toContain("setPageSize(Number(e.target.value))");
      expect(employeesViewSource).toContain("setCurrentPage((p) => Math.max(1, p - 1))");
      expect(employeesViewSource).toContain("setCurrentPage((p) => Math.min(");
      expect(employeesViewSource).toContain("sortOrder");
      expect(employeesViewSource).toContain("setSortOrder");
    });

    it("EmployeesView displays truthful company totals from aggregate KPIs", () => {
      expect(employeesViewSource).toContain("totalEmployees = kpis?.available ? kpis.totalEmployees");
      expect(employeesViewSource).toContain("saudiEmployees = kpis?.available ? kpis.saudiEmployees");
      expect(employeesViewSource).toContain("saudizationRate = kpis?.available ? kpis.saudizationRate");
    });
  });

  // =========================================================================
  // 2. Trusted Employee Creation RPC & Atomic Number Allocation
  // =========================================================================
  describe("2. Trusted Employee Creation RPC & Atomic Number Allocation", () => {
    it("migration creates create_employee RPC with server-side company verification", () => {
      expect(migrationSource).toContain("FUNCTION public.create_employee");
      expect(migrationSource).toContain("auth.current_company_id()");
      expect(migrationSource).toContain("generate_company_employee_no(v_company_id)");
      expect(migrationSource).toContain("INSERT INTO public.employees");
      expect(migrationSource).toContain("INSERT INTO public.audit_events");
      expect(migrationSource).toContain("REVOKE ALL ON FUNCTION public.create_employee");
      expect(migrationSource).toContain("GRANT EXECUTE ON FUNCTION public.create_employee TO authenticated");
    });

    it("generate_company_employee_no strictly eliminates loose role bypass", () => {
      expect(migrationSource).toContain("FUNCTION public.generate_company_employee_no");
      expect(migrationSource).toContain("public.current_user_can_manage_company(p_company_id)");
      // Must NOT contain the loose bypass: OR public.current_user_role() IN ('super_admin', 'company_admin', ...)
      expect(migrationSource).not.toContain("OR public.current_user_role() IN ('super_admin', 'company_admin'");
    });

    it("createEmployeeRecord calls create_employee RPC and never reads user_metadata.company_id", () => {
      expect(repoSource).toContain('enterpriseSupabase.rpc("create_employee"');
      expect(repoSource).not.toContain("user_metadata.company_id");
    });
  });

  // =========================================================================
  // 3. Employee Detail Security & Colleague Enumeration Prevention
  // =========================================================================
  describe("3. Employee Detail Security & Colleague Enumeration Prevention", () => {
    it("migration hardens get_employee_detail blocking ordinary colleague enumeration", () => {
      expect(migrationSource).toContain("FUNCTION public.get_employee_detail");
      expect(migrationSource).toContain("v_is_self :=");
      expect(migrationSource).toContain("v_is_manager :=");
      expect(migrationSource).toContain("v_is_hr :=");
      expect(migrationSource).toContain("v_can_view_hr :=");
      expect(migrationSource).toContain("غير مصرح لك باستعراض الملف الشخصي الكامل لهذا الموظف");
    });

    it("migration decouples payroll data in get_employee_detail from generic management permission", () => {
      expect(migrationSource).toContain("v_can_view_payroll :=");
      expect(migrationSource).toContain("'payroll_officer', 'finance_officer'");
      // Must NOT grant payroll view to ordinary hr_manager unless super_admin or payroll_officer
      expect(migrationSource).not.toContain("v_can_view_payroll := v_can_manage;");
    });

    it("migration hardens bank details and compensation updates to strict financial roles", () => {
      expect(migrationSource).toContain("FUNCTION public.update_employee_bank_details");
      expect(migrationSource).toContain("FUNCTION public.update_employee_compensation");
      expect(migrationSource).toContain("غير مصرح لك بتعديل الحساب البنكي للموظف");
      expect(migrationSource).toContain("غير مصرح لك بتعديل بيانات الراتب والبدلات للموظف");
    });
  });

  // =========================================================================
  // 4. Controlled Profile Mutations & Bypass Prevention
  // =========================================================================
  describe("4. Controlled Profile Mutations & Bypass Prevention", () => {
    it("updateEmployeeRecord routes sensitive fields to controlled RPCs and strips direct mutation", () => {
      expect(repoSource).toContain("updateEmployeeHrProfileRecord");
      expect(repoSource).toContain("updateEmployeeAssignmentRecord");
      expect(repoSource).toContain("updateEmployeeBankDetailsRecord");
      expect(repoSource).toContain("updateEmployeeCompensationRecord");
      expect(repoSource).toContain("delete (dbUpdates as Record<string, unknown>).status");
      expect(repoSource).toContain("delete (dbUpdates as Record<string, unknown>).basic_salary");
      expect(repoSource).toContain("delete (dbUpdates as Record<string, unknown>).iban");
    });

    it("preserves granular edit permissions across all roles", () => {
      expect(canEditHrProfile("hr_manager")).toBe(true);
      expect(canEditAssignment("hr_manager")).toBe(true);
      expect(canEditPayroll("hr_manager")).toBe(true);
      expect(canEditBank("hr_manager")).toBe(true);

      expect(canEditHrProfile("payroll_officer")).toBe(false);
      expect(canEditAssignment("payroll_officer")).toBe(false);
      expect(canEditPayroll("payroll_officer")).toBe(true);
      expect(canEditBank("payroll_officer")).toBe(true);

      expect(canEditHrProfile("employee")).toBe(false);
      expect(canEditPayroll("employee")).toBe(false);
      expect(canEditBank("employee")).toBe(false);
    });
  });

  // =========================================================================
  // 5. Crash-Safe Avatar Replacement Saga & Storage Security
  // =========================================================================
  describe("5. Crash-Safe Avatar Replacement Saga & Storage Security", () => {
    it("migration hardens employee-avatars storage RLS checking active file_objects records", () => {
      expect(migrationSource).toContain("public.file_objects");
      expect(migrationSource).toContain("bucket_id = 'employee-avatars'");
      expect(migrationSource).toContain("auth.current_company_id()");
      expect(migrationSource).toContain("storage.foldername(name)");
    });

    it("EmployeeFullProfileView executes safe avatar replacement saga in exact order", () => {
      expect(fullProfileSource).toContain("uploadSecureFile({");
      expect(fullProfileSource).toContain("avatarStoragePath: newStoragePath");
      expect(fullProfileSource).toContain("deleteStorageFile(\"employee-avatars\", employee.avatarStoragePath)");
      expect(fullProfileSource).toContain("useEmployeeAvatar");
    });

    it("does not persist temporary signed URLs into avatarUrl on file upload in live mode", () => {
      expect(fullProfileSource).not.toContain("avatarUrl: signed.signedUrl");
      expect(fullProfileSource).toContain("useEmployeeAvatar(");
    });
  });

  // =========================================================================
  // 6. CSV Export & Sensitive Data Scoping
  // =========================================================================
  describe("6. CSV Export & Sensitive Data Scoping", () => {
    it("EmployeesView masks national ID and salary for unauthorized callers during CSV export", () => {
      expect(employeesViewSource).toContain("if (!canExportEmployees(currentRole))");
      expect(employeesViewSource).toContain('const canViewPayroll = canAccessModule(currentRole, "payroll")');
      expect(employeesViewSource).toContain('canViewPayroll ? e.nationalIdOrIqama : "********"');
      expect(employeesViewSource).toContain('if (canViewPayroll) {');
      expect(employeesViewSource).toContain('row["الراتب الأساسي"] = e.basicSalary;');
    });

    it("EmployeesView protects basic salary display in Table and Cards view", () => {
      expect(employeesViewSource).toContain('canAccessModule(currentRole, "payroll") && emp.totalSalary != null');
      expect(employeesViewSource).toContain('نطاق الراتب الأساسي (ر.س)');
    });
  });
});
