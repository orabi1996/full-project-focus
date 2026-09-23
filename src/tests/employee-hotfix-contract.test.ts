import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  canEditHrProfile,
  canEditAssignment,
  canEditPayroll,
  canEditBank,
  canChangeLifecycle,
  canManageDocuments,
  canExportEmployees,
} from "../lib/auth/permissions";
import { queryKeys } from "../lib/query/query-keys";

const migrationSource = readFileSync(
  new URL("../../supabase/migrations/20260915000000_finalize_employee_security_queries_and_avatar_integrity.sql", import.meta.url),
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

describe("Production Employee Security, Query Architecture & Storage Integrity Hotfix Contract (Prompt 09 Hotfix)", () => {
  // =========================================================================
  // 1. Direct Status Mutation Safeguard & Lifecycle Enforcement
  // =========================================================================
  describe("1. Direct Status Mutation Safeguard & Lifecycle Enforcement", () => {
    it("migration creates status safeguard trigger checking app.in_lifecycle_rpc session variable", () => {
      expect(migrationSource).toContain("FUNCTION public.prevent_direct_employee_status_update()");
      expect(migrationSource).toContain("TRIGGER trg_prevent_direct_employee_status_update");
      expect(migrationSource).toContain("current_setting('app.in_lifecycle_rpc', true)");
      expect(migrationSource).toContain("لا يمكن تغيير حالة الموظف التعاقدية مباشرة عبر التحديث العام");
    });

    it("lifecycle RPCs set transaction-local app.in_lifecycle_rpc setting", () => {
      expect(migrationSource).toContain("set_config('app.in_lifecycle_rpc', 'true', true)");
    });

    it("updateEmployeeRecord removes status completely from generic update payload", () => {
      expect(repoSource).toContain("delete (dbUpdates as Record<string, unknown>).status");
      expect(repoSource).not.toContain("dbUpdates.status = updates.status");
    });

    it("EmployeesView eliminates bulk status double-write updateEmployee loop", () => {
      expect(employeesViewSource).not.toContain(
        "selectedIds.map((id) => updateEmployee(id, { status: newStatus }))",
      );
      expect(employeesViewSource).toContain("bulkChangeStatus");
    });
  });

  // =========================================================================
  // 2. Company Isolation & Atomic Employee Number Concurrency
  // =========================================================================
  describe("2. Company Isolation & Atomic Employee Number Sequence", () => {
    it("createEmployeeRecord never falls back to arbitrary companies.select limit(1)", () => {
      expect(repoSource).not.toContain('from("companies").select("id").limit(1)');
      expect(repoSource).toContain("تعذر تحديد منشأة الموظف المعتمدة بصورة آمنة وموثوقة");
    });

    it("migration creates company_employee_number_counters table with atomic counter", () => {
      expect(migrationSource).toContain("CREATE TABLE IF NOT EXISTS public.company_employee_number_counters");
      expect(migrationSource).toContain("company_id uuid PRIMARY KEY REFERENCES public.companies(id)");
      expect(migrationSource).toContain("next_value bigint NOT NULL DEFAULT 1");
      expect(migrationSource).toContain("ENABLE ROW LEVEL SECURITY");
    });

    it("generate_company_employee_no verifies authentication and management authorization", () => {
      expect(migrationSource).toContain("FUNCTION public.generate_company_employee_no");
      expect(migrationSource).toContain("auth.uid()");
      expect(migrationSource).toContain("public.current_user_can_manage_company(p_company_id)");
      expect(migrationSource).toContain("REVOKE ALL ON FUNCTION public.generate_company_employee_no(uuid) FROM PUBLIC");
    });

    it("createEmployeeRecord does not catch generation failures silently", () => {
      // Must not have a silent try/catch around generate_company_employee_no that swallows the error
      expect(repoSource).toContain('enterpriseSupabase.rpc("generate_company_employee_no"');
      expect(repoSource).not.toContain('// Fallback manual if RPC not deployed yet');
    });

    it("strictly requires Arabic first and last name without fabricating موظف جديد", () => {
      expect(repoSource).not.toContain('"موظف جديد"');
      expect(repoSource).toContain("الاسم الأول واسم العائلة باللغة العربية إلزاميان للتوثيق المالي والقانوني");
    });
  });

  // =========================================================================
  // 3. Field-Minimized Directory RPC & Server-Side Pagination
  // =========================================================================
  describe("3. Field-Minimized Directory RPC & Server-Side Pagination", () => {
    it("migration defines get_employee_directory RPC with pagination and safe filters", () => {
      expect(migrationSource).toContain("FUNCTION public.get_employee_directory");
      expect(migrationSource).toContain("p_page integer DEFAULT 1");
      expect(migrationSource).toContain("p_page_size integer DEFAULT 25");
      expect(migrationSource).toContain("p_sort text DEFAULT 'name_asc'");
      expect(migrationSource).toContain("REVOKE ALL ON FUNCTION public.get_employee_directory FROM PUBLIC");
    });

    it("directory RPC excludes sensitive financial data and protects national ID search", () => {
      // get_employee_directory SELECT projection must NOT expose basic_salary or iban
      expect(migrationSource).toContain("v_can_search_sensitive :=");
      expect(migrationSource).toContain("v_can_search_sensitive AND e.national_id_or_iqama ILIKE");
    });

    it("repository exports fetchEmployeeDirectoryRecord", () => {
      expect(repoSource).toContain("export async function fetchEmployeeDirectoryRecord");
      expect(repoSource).toContain('enterpriseSupabase.rpc("get_employee_directory"');
    });

    it("query keys include hierarchical directory factory", () => {
      expect(queryKeys.employees.directory).toBeDefined();
      expect(queryKeys.employees.directory()).toEqual(["employees", "directory"]);
      expect(queryKeys.employees.directory({ page: 2 })).toEqual(["employees", "directory", { page: 2 }]);
    });

    it("domains employee module exports useEmployeeDirectory hook", () => {
      expect(domainSource).toContain("export function useEmployeeDirectory");
      expect(domainSource).toContain("fetchEmployeeDirectoryRecord");
    });
  });

  // =========================================================================
  // 4. Dedicated Live Employee Detail & Permission-Aware Projection
  // =========================================================================
  describe("4. Dedicated Live Employee Detail & Sensitive Projection", () => {
    it("migration defines get_employee_detail RPC with conditional payroll projection", () => {
      expect(migrationSource).toContain("FUNCTION public.get_employee_detail");
      expect(migrationSource).toContain("v_can_view_payroll OR v_is_self");
      expect(migrationSource).toContain("'basic_salary', v_emp.basic_salary");
      expect(migrationSource).toContain("'iban', v_emp.iban");
      expect(migrationSource).toContain("REVOKE ALL ON FUNCTION public.get_employee_detail FROM PUBLIC");
    });

    it("repository exports fetchEmployeeDetailRecord calling get_employee_detail", () => {
      expect(repoSource).toContain("export async function fetchEmployeeDetailRecord");
      expect(repoSource).toContain('enterpriseSupabase.rpc("get_employee_detail"');
    });

    it("useEmployee queries fetchEmployeeDetailRecord and does not fall back to list in live mode", () => {
      expect(domainSource).toContain("fetchEmployeeDetailRecord(id)");
      expect(domainSource).toContain("return query.data ?? null");
    });

    it("EmployeeFullProfileView uses useEmployee directly without employees.find fallback", () => {
      expect(fullProfileSource).toContain("useEmployee(employeeId)");
      expect(fullProfileSource).not.toContain("const employee = employees.find((e) => e.id === employeeId) || null;");
    });

    it("EmployeeProfileModal uses useEmployee directly without employees.find fallback", () => {
      expect(modalSource).toContain("useEmployee(activeEmployeeModalId)");
      expect(modalSource).not.toContain("const employee = employees.find((e) => e.id === activeEmployeeModalId) || null;");
    });
  });

  // =========================================================================
  // 5. Granular Edit Permissions & Role Enforcement
  // =========================================================================
  describe("5. Granular Edit Permissions & Role Enforcement", () => {
    it("provides distinct permission checkers for each domain area", () => {
      expect(typeof canEditHrProfile).toBe("function");
      expect(typeof canEditAssignment).toBe("function");
      expect(typeof canEditPayroll).toBe("function");
      expect(typeof canEditBank).toBe("function");
      expect(typeof canChangeLifecycle).toBe("function");
      expect(typeof canManageDocuments).toBe("function");
      expect(typeof canExportEmployees).toBe("function");
    });

    it("strictly forbids payroll_officer from editing HR profiles and assignments", () => {
      expect(canEditHrProfile("payroll_officer")).toBe(false);
      expect(canEditAssignment("payroll_officer")).toBe(false);
      expect(canChangeLifecycle("payroll_officer")).toBe(false);
      expect(canManageDocuments("payroll_officer")).toBe(false);
      expect(canEditPayroll("payroll_officer")).toBe(true);
      expect(canEditBank("payroll_officer")).toBe(true);
    });

    it("allows hr_manager to edit HR profiles, assignments, documents, and change lifecycle", () => {
      expect(canEditHrProfile("hr_manager")).toBe(true);
      expect(canEditAssignment("hr_manager")).toBe(true);
      expect(canChangeLifecycle("hr_manager")).toBe(true);
      expect(canManageDocuments("hr_manager")).toBe(true);
      expect(canExportEmployees("hr_manager")).toBe(true);
    });

    it("allows auditor only export access", () => {
      expect(canExportEmployees("auditor")).toBe(true);
      expect(canEditHrProfile("auditor")).toBe(false);
      expect(canEditAssignment("auditor")).toBe(false);
      expect(canChangeLifecycle("auditor")).toBe(false);
    });

    it("repository exports controlled profile mutation RPC wrappers", () => {
      expect(repoSource).toContain("export async function updateEmployeeHrProfileRecord");
      expect(repoSource).toContain("export async function updateEmployeeAssignmentRecord");
      expect(repoSource).toContain("export async function updateEmployeeBankDetailsRecord");
      expect(repoSource).toContain("export async function updateEmployeeCompensationRecord");
    });

    it("domain module exports controlled profile mutation hooks", () => {
      expect(domainSource).toContain("export function useUpdateEmployeeHrProfile");
      expect(domainSource).toContain("export function useUpdateEmployeeAssignment");
      expect(domainSource).toContain("export function useUpdateEmployeeBankDetails");
      expect(domainSource).toContain("export function useUpdateEmployeeCompensation");
    });
  });

  // =========================================================================
  // 6. Avatar Storage, Stable References & Cleanup
  // =========================================================================
  describe("6. Avatar Storage, Stable References & Cleanup", () => {
    it("migration adds avatar_storage_path column to public.employees", () => {
      expect(migrationSource).toContain("ADD COLUMN IF NOT EXISTS avatar_storage_path text");
    });

    it("migration hardens employee-avatars storage RLS policies with tenant isolation", () => {
      expect(migrationSource).toContain('POLICY "employee_avatars_tenant_read" ON storage.objects');
      expect(migrationSource).toContain('POLICY "employee_avatars_tenant_insert" ON storage.objects');
      expect(migrationSource).toContain('POLICY "employee_avatars_tenant_update" ON storage.objects');
      expect(migrationSource).toContain('POLICY "employee_avatars_tenant_delete" ON storage.objects');
      expect(migrationSource).toMatch(/(?:auth|public)\.current_company_id\(\)/);
    });

    it("EmployeeFullProfileView cleans up old storage file on avatar replacement", () => {
      expect(fullProfileSource).toContain("deleteStorageFile");
      expect(fullProfileSource).toContain("deleteStorageFile(\"employee-avatars\", employee.avatarStoragePath)");
      expect(fullProfileSource).toContain("avatarStoragePath: newStoragePath");
    });

    it("hides external Unsplash preset avatars and custom URL in Live mode", () => {
      expect(fullProfileSource).toContain("{isStorageInDemoMode() && (");
      expect(fullProfileSource).toContain("وضع العرض التجريبي فقط");
    });
  });

  // =========================================================================
  // 7. Creation Defaults & Qiwa Truthfulness
  // =========================================================================
  describe("7. Creation Defaults & Qiwa Truthfulness", () => {
    it("creation form defaults to blank nationality and draft status", () => {
      expect(employeesViewSource).toContain('nationality: ""');
      expect(employeesViewSource).toContain('status: "draft"');
      expect(employeesViewSource).not.toContain('nationality: "سعودي"');
    });

    it("requires nationality selection upon creation", () => {
      expect(employeesViewSource).toContain("!newEmp.nationality.trim()");
      expect(employeesViewSource).toContain("الجنسية *");
    });

    it("displays غير مربوط for missing Qiwa contracts in CSV export instead of fabricated text", () => {
      expect(employeesViewSource).toContain('e.qiwaContractNo || "غير مربوط"');
      expect(employeesViewSource).not.toContain('"سجل نظامي"');
    });

    it("restricts CSV export strictly to canExportEmployees role", () => {
      expect(employeesViewSource).toContain("if (!canExportEmployees(currentRole))");
    });

    it("hides salary range filters from users without payroll permission", () => {
      expect(employeesViewSource).toContain('{canAccessModule(currentRole, "payroll") && (');
      expect(employeesViewSource).toContain("نطاق الراتب الأساسي (ر.س)");
    });

    it("guards floating bulk action bar with lifecycle and export permissions", () => {
      expect(employeesViewSource).toContain("canChangeLifecycle(currentRole) || canExportEmployees(currentRole)");
      expect(employeesViewSource).toContain("canChangeLifecycle(currentRole)");
    });
  });
});
