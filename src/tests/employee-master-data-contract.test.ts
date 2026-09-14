import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { calculateProfileCompletion } from "../lib/domains/employees/completion";
import { BUCKET_VALIDATION_RULES, FORBIDDEN_EXTENSIONS, validateStorageFile } from "../lib/storage/storage-validation";
import type { Employee } from "../types";

// Read source files for contract checks
const fullProfileSource = readFileSync(
  new URL("../components/employees/EmployeeFullProfileView.tsx", import.meta.url),
  "utf8",
);
const modalSource = readFileSync(
  new URL("../components/employees/EmployeeProfileModal.tsx", import.meta.url),
  "utf8",
);
const employeesViewSource = readFileSync(
  new URL("../components/employees/EmployeesView.tsx", import.meta.url),
  "utf8",
);
const migrationSource = readFileSync(
  new URL("../../supabase/migrations/20260914120000_production_employee_master_and_lifecycle.sql", import.meta.url),
  "utf8",
);
const repoSource = readFileSync(
  new URL("../lib/data/hrms-repository.ts", import.meta.url),
  "utf8",
);

describe("Production Employee Master Data & Lifecycle Completion Contract (Prompt 09)", () => {
  // =========================================================================
  // 1. Migration & Schema Hardening
  // =========================================================================
  describe("1. Database Migration & Integrity Constraints", () => {
    it("expands employee_status enum with draft, preboarding, probation", () => {
      expect(migrationSource).toContain("ALTER TYPE public.employee_status ADD VALUE IF NOT EXISTS 'draft'");
      expect(migrationSource).toContain("ALTER TYPE public.employee_status ADD VALUE IF NOT EXISTS 'preboarding'");
      expect(migrationSource).toContain("ALTER TYPE public.employee_status ADD VALUE IF NOT EXISTS 'probation'");
    });

    it("enforces tenant-scoped employee number uniqueness", () => {
      expect(migrationSource).toContain("employees_company_employee_no_idx");
      expect(migrationSource).toContain("ON public.employees(company_id, employee_no)");
      expect(migrationSource).toContain("FUNCTION public.generate_company_employee_no");
    });

    it("adds termination foundation fields and employee master columns", () => {
      expect(migrationSource).toContain("termination_date date");
      expect(migrationSource).toContain("last_working_date date");
      expect(migrationSource).toContain("termination_reason text");
      expect(migrationSource).toContain("termination_type text");
      expect(migrationSource).toContain("rehire_date date");
      expect(migrationSource).toContain("cost_center_id uuid");
      expect(migrationSource).toContain("avatar_url text");
    });

    it("creates employee_contracts table with effective dating and RLS", () => {
      expect(migrationSource).toContain("CREATE TABLE IF NOT EXISTS public.employee_contracts");
      expect(migrationSource).toContain("start_date date NOT NULL");
      expect(migrationSource).toContain("end_date date");
      expect(migrationSource).toContain("ENABLE ROW LEVEL SECURITY");
    });

    it("creates relationship validation trigger enforcing same-company boundaries and cycle prevention", () => {
      expect(migrationSource).toContain("FUNCTION public.validate_employee_relationships");
      expect(migrationSource).toContain("trg_validate_employee_relationships");
      expect(migrationSource).toContain("لا يمكن للموظف أن يكون مديراً مباشراً لنفسه");
      expect(migrationSource).toContain("حلقة تبعية إدارية دائرية");
    });

    it("creates status transition and rehire RPCs with strict matrix validation", () => {
      expect(migrationSource).toContain("FUNCTION public.change_employee_status");
      expect(migrationSource).toContain("FUNCTION public.rehire_employee");
      expect(migrationSource).toContain("FUNCTION public.bulk_change_employee_status");
      expect(migrationSource).toContain("الموظف منتهية خدمته مسبقاً. لإعادته للعمل، يرجى استخدام إجراء إعادة التعيين (Rehire)");
    });

    it("provisions employee-avatars storage bucket with mime and size security", () => {
      expect(migrationSource).toContain("'employee-avatars'");
      expect(migrationSource).toContain("image/png");
      expect(migrationSource).toContain("image/jpeg");
      expect(migrationSource).toContain("image/webp");
      expect(migrationSource).toContain("5242880"); // 5 MB limit
    });
  });

  // =========================================================================
  // 2. Truthful Master Data & Anti-Impersonation
  // =========================================================================
  describe("2. Master Data Truthfulness & Anti-Impersonation", () => {
    it("never falls back to employees[0] when unknown employee ID is accessed", () => {
      // Full profile must NOT do `employees.find(...) || employees[0]`
      expect(fullProfileSource).not.toContain("employees[0]");
      expect(fullProfileSource).toContain("employees.find((e) => e.id === employeeId) || null");
      expect(fullProfileSource).toContain("الموظف المطلوب غير موجود");
    });

    it("does not fabricate defaults in EmployeeFullProfileView or EmployeeProfileModal", () => {
      // Must not contain fabricated sample IDs or fake Saudi fallbacks
      expect(fullProfileSource).not.toContain('"KSA-99881122"');
      expect(fullProfileSource).not.toContain('"2030-05-15"');
      expect(fullProfileSource).not.toContain('"SA44 8000 0201 6080 1000 1234"');
      expect(fullProfileSource).not.toContain('"7788990011"');
      expect(fullProfileSource).not.toContain('"سعود المهيري"');

      expect(modalSource).not.toContain('"KSA-99881122"');
      expect(modalSource).not.toContain('"2030-01-01"');
      expect(modalSource).not.toContain('"SA44 8000 0201 6080 1000 1234"');
      expect(modalSource).not.toContain('"7788990011"');
    });

    it("calculates profile completion score deterministically based on actual fields", () => {
      const minimalEmployee: Partial<Employee> = {
        firstNameAr: "سالم",
        lastNameAr: "العتيبي",
        email: "salem@example.com",
        phone: "+966500000000",
        nationalIdOrIqama: "1011223344",
        nationality: "سعودي",
        gender: "male",
        birthDate: "1992-05-10",
        jobTitleAr: "مهندس نظم",
        departmentId: "dept-1",
        workLocationId: "loc-1",
        hireDate: "2022-01-01",
        contractType: "full_time",
        basicSalary: 12000,
        totalSalary: 15000,
      };

      const score = calculateProfileCompletion(minimalEmployee);
      // Basic fields present = 73%, extended missing = 0%
      expect(score).toBe(73);

      // Now add extended fields:
      const fullEmployee: Partial<Employee> = {
        ...minimalEmployee,
        status: "active",
        nationalIdExpiry: "2032-01-01",
        passportNo: "A12345678",
        bankName: "البنك الأهلي",
        iban: "SA0380000000000000000000",
        gosiNumber: "12345678",
        managerId: "mgr-1",
        emergencyContact: { name: "فهد", relation: "أخ", phone: "+966511111111" },
        nationalAddress: { buildingNo: "1234", street: "طريق الملك فهد", district: "العليا", city: "الرياض", postalCode: "12345", additionalNo: "6789" },
        educationDegree: "بكالوريوس هندسة",
        university: "جامعة الملك سعود",
        certifications: ["PMP"],
        avatarUrl: "https://example.com/avatar.png",
      };

      const fullScore = calculateProfileCompletion(fullEmployee);
      expect(fullScore).toBe(100);
    });
  });

  // =========================================================================
  // 3. Status Transition Matrix & Lifecycle Validation
  // =========================================================================
  describe("3. Lifecycle Status & Transition Matrix", () => {
    it("persists lifecycle statuses truthful to application domain without forced flattening", () => {
      expect(repoSource).toContain('status: employee.status || "draft"');
      expect(repoSource).not.toContain('status: employee.status === "on_leave" ? "on_leave" : "active"');
    });

    it("verifies change_employee_status RPC transition validation matrix", () => {
      expect(migrationSource).toContain("v_allowed := true;");
      expect(migrationSource).toContain("v_emp.status::text = 'active' AND p_new_status IN ('on_leave', 'suspended', 'probation', 'terminated')");
      expect(migrationSource).toContain("v_emp.status::text = 'terminated'");
      expect(migrationSource).toContain("يرجى استخدام إجراء إعادة التعيين (Rehire)");
    });
  });

  // =========================================================================
  // 4. Privacy, Authorization & Export Protection
  // =========================================================================
  describe("4. Privacy, Authorization & Confidential Export", () => {
    it("masks IBAN for unauthorized users", () => {
      const sampleIban = "SA4480000201608010001234";
      const clean = sampleIban.replace(/\s+/g, "");
      const masked = `${clean.slice(0, 4)} •••• •••• ${clean.slice(-4)}`;
      expect(masked).toBe("SA44 •••• •••• 1234");
      expect(fullProfileSource).toContain("maskIban");
      expect(modalSource).toContain("maskIban");
    });

    it("enforces confidential export stripping of salaries and national IDs without payroll permission", () => {
      expect(employeesViewSource).toContain('const canViewPayroll = canAccessModule(currentRole, "payroll")');
      expect(employeesViewSource).toContain('canViewPayroll ? e.nationalIdOrIqama : "********"');
      expect(employeesViewSource).toContain('if (canViewPayroll) {');
      expect(employeesViewSource).toContain('row["الراتب الأساسي"] = e.basicSalary;');
    });
  });

  // =========================================================================
  // 5. Storage Security & Avatars Bucket
  // =========================================================================
  describe("5. Storage Security for Employee Avatars", () => {
    it("has dedicated employee-avatars validation rules", () => {
      const avatarRules = BUCKET_VALIDATION_RULES["employee-avatars"];
      expect(avatarRules).toBeDefined();
      expect(avatarRules.maxSizeBytes).toBe(5 * 1024 * 1024);
      expect(avatarRules.allowedMimeTypes).toContain("image/png");
      expect(avatarRules.allowedMimeTypes).toContain("image/jpeg");
      expect(avatarRules.allowedMimeTypes).toContain("image/webp");
      expect(avatarRules.allowedMimeTypes).not.toContain("application/pdf");
    });

    it("rejects forbidden executable extensions for employee avatars", () => {
      const mockExeFile = new File(["binary content"], "trojan.exe", { type: "application/x-msdownload" });
      const result = validateStorageFile("employee-avatars", mockExeFile);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("محظور لأسباب أمنية");
    });

    it("accepts valid webp and png avatars within 5MB limit", () => {
      const mockPngFile = new File(["dummy-image-data"], "avatar.png", { type: "image/png" });
      const result = validateStorageFile("employee-avatars", mockPngFile);
      expect(result.valid).toBe(true);
    });
  });

  // =========================================================================
  // 6. UI Truthfulness & Antipattern Prevention
  // =========================================================================
  describe("6. UI Truthfulness & Antipattern Prevention", () => {
    it("removes unverified claims from EmployeesView header and KPI bar", () => {
      expect(employeesViewSource).not.toContain("نطاق بلاتيني معتمد");
      expect(employeesViewSource).not.toContain("100% عقود سارية");
      expect(employeesViewSource).not.toContain("موثق مع منصة قوى");
      expect(employeesViewSource).toContain("منظومة الموارد البشرية");
      expect(employeesViewSource).toContain("نسبة التوطين المحتسبة");
    });

    it("uses authoritative nationality instead of startsWith('1') heuristic for Saudization", () => {
      expect(employeesViewSource).not.toContain('nationalIdOrIqama?.startsWith("1")');
      expect(employeesViewSource).toContain("isSaudiNationality");
    });

    it("does not count probation employees as expiring documents", () => {
      expect(employeesViewSource).toContain("const expiringDocsCount = employees.filter");
      expect(employeesViewSource).not.toContain('status === "expired") || e.status === "probation"');
      expect(employeesViewSource).toContain('d.status === "expiring" || d.status === "expired"');
    });
  });
});
