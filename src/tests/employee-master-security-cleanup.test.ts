import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migrationSource = readFileSync(
  new URL(
    "../../supabase/migrations/20260915020000_finalize_employee_field_security_and_directory_truthfulness.sql",
    import.meta.url,
  ),
  "utf8",
);
const repoSource = readFileSync(
  new URL("../lib/data/hrms-repository.ts", import.meta.url),
  "utf8",
);
const typesSource = readFileSync(
  new URL("../types/index.ts", import.meta.url),
  "utf8",
);
const enterpriseClientSource = readFileSync(
  new URL("../lib/data/enterprise-client.ts", import.meta.url),
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

describe("Employee Master Final Integrity & Security Cleanup", () => {
  // =========================================================================
  // 1. Cross-Tenant HR Mutation Bypass Elimination
  // =========================================================================
  describe("1. Cross-Tenant HR Mutation Bypass Elimination", () => {
    it("update_employee_hr_profile strictly requires current_user_can_manage_company(v_emp.company_id)", () => {
      expect(migrationSource).toContain("CREATE OR REPLACE FUNCTION public.update_employee_hr_profile");
      expect(migrationSource).toContain("IF NOT public.current_user_can_manage_company(v_emp.company_id) THEN");
      // Must not contain independent global role bypass on the HR profile mutation
      expect(migrationSource).not.toMatch(
        /update_employee_hr_profile[\s\S]*?current_user_has_any_role\(\s*ARRAY\['super_admin',\s*'org_admin',\s*'hr_manager'\]\s*\)/,
      );
    });

    it("update_employee_assignment strictly requires current_user_can_manage_company(v_emp.company_id)", () => {
      expect(migrationSource).toContain("CREATE OR REPLACE FUNCTION public.update_employee_assignment");
      expect(migrationSource).toContain("IF NOT public.current_user_can_manage_company(v_emp.company_id) THEN");
      // Assignment mutation must validate tenant alignment of department and location
      expect(migrationSource).toContain("SELECT 1 FROM public.departments WHERE id = p_department_id AND company_id = v_emp.company_id");
      expect(migrationSource).toContain("SELECT 1 FROM public.work_locations WHERE id = p_work_location_id AND company_id = v_emp.company_id");
    });

    it("update RPCs verify row-affected counts and raise explicit exceptions", () => {
      expect(migrationSource).toContain("IF NOT FOUND THEN");
      expect(migrationSource).toContain("RAISE EXCEPTION 'فشل التحديث: لم يتم العثور على سجل الموظف أو لم يتأثر أي صف.';");
    });

    it("update_employee_hr_profile supports sensitive compliance and identity fields", () => {
      expect(migrationSource).toContain("p_national_id_expiry date DEFAULT NULL");
      expect(migrationSource).toContain("p_passport_no text DEFAULT NULL");
      expect(migrationSource).toContain("p_passport_expiry date DEFAULT NULL");
      expect(migrationSource).toContain("p_blood_type text DEFAULT NULL");
      expect(migrationSource).toContain("p_dependents_count integer DEFAULT NULL");
      expect(migrationSource).toContain("p_job_grade text DEFAULT NULL");
    });
  });

  // =========================================================================
  // 2. Strict Financial Creation Gate in create_employee
  // =========================================================================
  describe("2. Strict Financial Creation Gate in create_employee", () => {
    it("create_employee raises exception when non-financial callers submit non-zero salaries", () => {
      expect(migrationSource).toContain("COALESCE(p_basic_salary, 0) > 0");
      expect(migrationSource).toContain("COALESCE(p_housing_allowance, 0) > 0");
      expect(migrationSource).toContain("IF v_has_financial_input AND NOT v_is_financial THEN");
      expect(migrationSource).toContain("غير مصرح لك بتسجيل بيانات الراتب أو الحساب البنكي للموظف. يتطلب هذا الإجراء صلاحيات مالية معتمدة.");
    });

    it("create_employee raises exception when non-banking callers submit bank account details", () => {
      expect(migrationSource).toContain("OR (p_bank_name IS NOT NULL AND btrim(p_bank_name) <> '')");
      expect(migrationSource).toContain("OR (p_iban IS NOT NULL AND btrim(p_iban) <> '')");
    });

    it("create_employee allocates employee_no transactionally via generate_company_employee_no", () => {
      expect(migrationSource).toContain("generate_company_employee_no(v_company_id)");
    });
  });

  // =========================================================================
  // 3. Strict Metadata-First Storage RLS
  // =========================================================================
  describe("3. Strict Metadata-First Storage RLS", () => {
    it("drops path-based read fallback policy on employee-avatars", () => {
      expect(migrationSource).toContain('DROP POLICY IF EXISTS "employee_avatars_path_read_fallback" ON storage.objects');
      expect(migrationSource).toContain('DROP POLICY IF EXISTS "employee_avatars_tenant_read" ON storage.objects');
    });

    it("requires active file_objects record with matching entity and company for avatar SELECT", () => {
      expect(migrationSource).toContain('CREATE POLICY "employee_avatars_metadata_read" ON storage.objects');
      expect(migrationSource).toContain("fo.entity_type = 'employee_avatar'");
      expect(migrationSource).toContain("fo.status = 'active'");
      expect(migrationSource).toContain("fo.company_id = auth.current_company_id()");
    });
  });

  // =========================================================================
  // 4. Authoritative Directory & KPI Truthfulness
  // =========================================================================
  describe("4. Authoritative Directory & KPI Truthfulness", () => {
    it("get_employee_directory supports server-side gender filter and projects gender", () => {
      expect(migrationSource).toContain("p_gender text DEFAULT NULL");
      expect(migrationSource).toContain("e.gender::text = p_gender");
      expect(migrationSource).toContain("'gender', e.gender");
    });

    it("get_employee_directory implements canonical sort keys including employee_no_desc", () => {
      expect(migrationSource).toContain("p_sort = 'employee_no_desc'");
      expect(migrationSource).toContain("p_sort = 'employee_no_asc'");
      expect(migrationSource).toContain("p_sort = 'hire_date_desc'");
      expect(migrationSource).toContain("p_sort = 'hire_date_asc'");
    });

    it("get_employee_directory resolves expiring documents quick preset via employee_documents", () => {
      expect(migrationSource).toContain("p_quick_preset = 'expiring_docs'");
      expect(migrationSource).toContain("FROM public.employee_documents ed");
      expect(migrationSource).toContain("ed.expiry_date <= (current_date + interval '60 days')");
    });

    it("get_employee_directory_kpis truthfully counts active and employed employees and calculates Saudization", () => {
      expect(migrationSource).toContain("'total_employed', v_total_employed");
      expect(migrationSource).toContain("'active_employees', v_active_employees");
      expect(migrationSource).toContain("'non_saudi_employees', v_non_saudi_employees");
      expect(migrationSource).toContain("'unknown_nationality_count', v_unknown_nationality");
      // Denominator strictly requires known nationalities
      expect(migrationSource).toContain("v_known_nationality_total := v_saudi_employees + v_non_saudi_employees");
      expect(migrationSource).toContain("round((v_saudi_employees::numeric / v_known_nationality_total::numeric) * 100)");
    });

    it("get_employee_directory_kpis enforces HR restriction on sensitive metrics", () => {
      expect(migrationSource).toContain("v_is_hr := v_is_super OR public.current_user_can_manage_company(v_company_id)");
      expect(migrationSource).toContain("'hr_restricted', true");
      expect(migrationSource).toContain("'hr_restricted', false");
      expect(migrationSource).toContain("'probation_count', 0");
      expect(migrationSource).toContain("'probation_count', v_probation_count");
    });
  });

  // =========================================================================
  // 5. Types, Client & Repository Integrity
  // =========================================================================
  describe("5. Types, Client & Repository Integrity", () => {
    it("types/index.ts includes gender and truthful KPI metrics", () => {
      expect(typesSource).toContain("gender?: Gender | null;");
      expect(typesSource).toContain("gender?: string;");
      expect(typesSource).toContain("totalEmployed?: number;");
      expect(typesSource).toContain("nonSaudiEmployees?: number;");
      expect(typesSource).toContain("unknownNationalityCount?: number;");
      expect(typesSource).toContain("hrRestricted?: boolean;");
    });

    it("enterprise-client.ts types p_gender and compliance fields for RPCs", () => {
      expect(enterpriseClientSource).toContain("p_gender?: string | null;");
      expect(enterpriseClientSource).toContain("p_national_id_expiry?: string | null;");
      expect(enterpriseClientSource).toContain("p_passport_no?: string | null;");
      expect(enterpriseClientSource).toContain("p_passport_expiry?: string | null;");
      expect(enterpriseClientSource).toContain("p_blood_type?: string | null;");
      expect(enterpriseClientSource).toContain("p_dependents_count?: number | null;");
      expect(enterpriseClientSource).toContain("p_job_grade?: string | null;");
    });

    it("hrms-repository.ts routes compliance fields to updateEmployeeHrProfileRecord and strips direct updates", () => {
      expect(repoSource).toContain("export async function updateEmployeeHrProfileRecord");
      expect(repoSource).toContain("p_national_id_expiry: payload.nationalIdExpiry || null");
      expect(repoSource).toContain("p_passport_no: payload.passportNo || null");
      expect(repoSource).toContain("p_passport_expiry: payload.passportExpiry || null");
      expect(repoSource).toContain("p_blood_type: payload.bloodType || null");
      expect(repoSource).toContain("p_dependents_count: payload.dependentsCount !== undefined");
      expect(repoSource).toContain("p_job_grade: payload.jobGrade || null");

      // Strips all sensitive, financial, and compliance keys from direct table update
      expect(repoSource).toContain("delete (dbUpdates as Record<string, unknown>).status;");
      expect(repoSource).toContain("delete (dbUpdates as Record<string, unknown>).basic_salary;");
      expect(repoSource).toContain("delete (dbUpdates as Record<string, unknown>).total_salary;");
      expect(repoSource).toContain("delete (dbUpdates as Record<string, unknown>).housing_allowance;");
      expect(repoSource).toContain("delete (dbUpdates as Record<string, unknown>).transport_allowance;");
      expect(repoSource).toContain("delete (dbUpdates as Record<string, unknown>).other_allowances;");
      expect(repoSource).toContain("delete (dbUpdates as Record<string, unknown>).bank_name;");
      expect(repoSource).toContain("delete (dbUpdates as Record<string, unknown>).iban;");
      expect(repoSource).toContain("delete (dbUpdates as Record<string, unknown>).national_id_or_iqama;");
      expect(repoSource).toContain("delete (dbUpdates as Record<string, unknown>).national_id_expiry;");
      expect(repoSource).toContain("delete (dbUpdates as Record<string, unknown>).passport_no;");
      expect(repoSource).toContain("delete (dbUpdates as Record<string, unknown>).passport_expiry;");
      expect(repoSource).toContain("delete (dbUpdates as Record<string, unknown>).blood_type;");
      expect(repoSource).toContain("delete (dbUpdates as Record<string, unknown>).dependents_count;");
      expect(repoSource).toContain("delete (dbUpdates as Record<string, unknown>).job_grade;");
    });
  });

  // =========================================================================
  // 6. UI Truthfulness & Avatar Replacement Saga
  // =========================================================================
  describe("6. UI Truthfulness & Avatar Replacement Saga", () => {
    it("EmployeeAvatar in EmployeesView uses initials fallback without Unsplash images", () => {
      expect(employeesViewSource).not.toContain("https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150");
      expect(employeesViewSource).toContain('const initials = (name || "م").slice(0, 2).trim();');
    });

    it("createEmptyNewEmp has blank unselected values without fake organizational presets", () => {
      expect(employeesViewSource).toContain('gender: "" as unknown as Gender');
      expect(employeesViewSource).toContain('maritalStatus: "" as unknown as MaritalStatus');
      expect(employeesViewSource).toContain('subsidiaryId: ""');
      expect(employeesViewSource).toContain('departmentId: ""');
      expect(employeesViewSource).toContain('workLocationId: ""');
      expect(employeesViewSource).toContain('hireDate: ""');
      expect(employeesViewSource).toContain('contractType: "" as unknown as ContractType');
    });

    it("EmployeesView eliminates client-side EMP fake numbering and copy-Arabic defaults", () => {
      expect(employeesViewSource).not.toMatch(/employeeNo:\s*newEmp\.employeeNo\s*\|\|\s*`EMP-\${Date\.now\(\)/);
      expect(employeesViewSource).not.toContain("firstNameEn: newEmp.firstNameEn || newEmp.firstNameAr");
      expect(employeesViewSource).not.toContain("lastNameEn: newEmp.lastNameEn || newEmp.lastNameAr");
      expect(employeesViewSource).not.toContain("contractStartDate: newEmp.hireDate");
      expect(employeesViewSource).not.toContain("gosiDeductionPercentage: isSaudi ? 9.75 : 0");
      expect(employeesViewSource).not.toContain("isGosiEnrolled: isSaudi");
      expect(employeesViewSource).not.toContain("yearsOfService: 0");
    });

    it("EmployeesView eliminates duplicate employee creation toast", () => {
      expect(employeesViewSource).not.toContain("تم تسجيل وتعيين الموظف (${newEmp.firstNameAr} ${newEmp.lastNameAr}) بنجاح!");
    });

    it("EmployeesView eliminates hardcoded L3 - اختصاصي, كلاسيرا للتقنية, and 90 يوم", () => {
      expect(employeesViewSource).not.toContain("L3 - اختصاصي");
      expect(employeesViewSource).not.toContain("كلاسيرا للتقنية");
      expect(employeesViewSource).not.toContain("تحت التجربة (90 يوم)");
      expect(employeesViewSource).not.toContain("{(emp as unknown as Employee).yearsOfService || 3}");
    });

    it("EmployeesView contains role-aware search placeholder and current CSV export label", () => {
      expect(employeesViewSource).toContain("تصدير النتائج الحالية (CSV)");
      expect(employeesViewSource).toContain("isHrUser");
      expect(employeesViewSource).toContain("بحث بالاسم، الرقم الوظيفي، الهوية/الإقامة، المسمى، أو البريد...");
      expect(employeesViewSource).toContain("بحث بالاسم، الرقم الوظيفي، المسمى، أو البريد...");
    });

    it("EmployeeFullProfileView implements saga rollback and eliminates Unsplash and 90 day labels", () => {
      expect(fullProfileSource).toContain("rollbackUploadedFile");
      expect(fullProfileSource).toContain('reason: "avatar_update_failed"');
      expect(fullProfileSource).toContain('reason: "old_avatar_replaced"');
      expect(fullProfileSource).not.toContain("https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200");
      expect(fullProfileSource).not.toContain("فترة التجربة (90 يوم)");
    });

    it("EmployeeProfileModal eliminates Unsplash fallback, 90 day label, and hardcoded job grade and years", () => {
      expect(modalSource).not.toContain("https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150");
      expect(modalSource).not.toContain("فترة التجربة (90 يوم)");
      expect(modalSource).not.toContain("L4 - اختصاصي");
      expect(modalSource).not.toContain("employee.yearsOfService || 3");
    });
  });
});
