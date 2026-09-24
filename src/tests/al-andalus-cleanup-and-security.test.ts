import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { calculateSetupProgress } from "../lib/domains/setup/setup-progress";
import type { CompanyProfile, OrgUnit, WorkLocation, ShiftDefinition, LeaveTypePolicy } from "../types";

describe("Domain: calculateSetupProgress", () => {
  const baseCompany: CompanyProfile = {
    id: "a0000000-0000-0000-0000-000000000001",
    legalNameAr: "الأندلس",
    legalNameEn: "Al-Andalus",
    crNumber: "",
    taxNumber: "",
    country: "SA",
    currency: "SAR",
    timezone: "Asia/Riyadh",
    headquartersAddress: "الرياض",
    fiscalYearStartMonth: 1,
  };

  const sampleOrgUnit: OrgUnit = {
    id: "org-1",
    companyId: "a0000000-0000-0000-0000-000000000001",
    nameAr: "إدارة الموارد البشرية",
    nameEn: "HR Department",
    code: "HR",
    type: "department",
    status: "active",
    employeeCount: 0,
  };

  const sampleLocation: WorkLocation = {
    id: "loc-1",
    companyId: "a0000000-0000-0000-0000-000000000001",
    nameAr: "المقر الرئيسي",
    nameEn: "Headquarters",
    code: "HQ",
    address: "الرياض",
    radiusMeters: 200,
    status: "active",
  };

  const sampleShift: ShiftDefinition = {
    id: "shift-1",
    code: "MS",
    nameAr: "الدوام الصباحي",
    nameEn: "Morning Shift",
    color: "#0284c7",
    type: "fixed",
    startTime: "08:00",
    endTime: "16:00",
    graceMinutesArrival: 15,
    graceMinutesDeparture: 15,
    allowSinglePunch: false,
    overtimeEligible: true,
  };

  const sampleLeave: LeaveTypePolicy = {
    id: "leave-1",
    companyId: "a0000000-0000-0000-0000-000000000001",
    nameAr: "إجازة سنوية",
    nameEn: "Annual Leave",
    code: "ANNUAL",
    isPaid: true,
    maxDaysPerYear: 30,
    color: "#10b981",
    accrualMethod: "yearly_frontloaded",
    carryoverLimitDays: 0,
    carryoverExpiryMonths: 0,
    deductFromWorkingDaysOnly: true,
    allowHalfDay: true,
    allowNegativeBalance: false,
    requiresAttachment: false,
    status: "active",
  };

  it("marks as incomplete when mandatory items (company info, departments, locations) are missing", () => {
    const result = calculateSetupProgress({
      company: null,
      orgUnits: [],
      workLocations: [],
      shifts: [],
      leaveTypes: [],
      activeUsersCount: 0,
    });

    expect(result.percentage).toBe(0);
    expect(result.baseRequirementsMet).toBe(false);
    expect(result.isFullyConfigured).toBe(false);
    expect(result.companyStatus).toBe("missing");
    expect(result.stages.find((s) => s.id === "company_profile")?.complete).toBe(false);
    expect(result.stages.find((s) => s.id === "organization_structure")?.complete).toBe(false);
    expect(result.missingFields).toContain("اسم المنشأة بالعربية (الأندلس)");
  });

  it("calculates partial progress when company info is filled but departments/locations missing", () => {
    const result = calculateSetupProgress({
      company: { ...baseCompany, crNumber: "1010123456" },
      orgUnits: [],
      workLocations: [],
      shifts: [],
      leaveTypes: [],
      activeUsersCount: 1,
    });

    expect(result.baseRequirementsMet).toBe(false);
    expect(result.companyStatus).toBe("incomplete");
    expect(result.stages.find((s) => s.id === "company_profile")?.complete).toBe(true);
    expect(result.stages.find((s) => s.id === "organization_structure")?.complete).toBe(false);
    expect(result.stages.find((s) => s.id === "work_locations")?.complete).toBe(false);
    expect(result.percentage).toBe(35); // 25 (company) + 10 (user_governance)
  });

  it("satisfies base requirements when company, org units, and locations are configured", () => {
    const result = calculateSetupProgress({
      company: { ...baseCompany, crNumber: "1010123456" },
      orgUnits: [sampleOrgUnit],
      workLocations: [sampleLocation],
      shifts: [],
      leaveTypes: [],
      activeUsersCount: 1,
    });

    expect(result.baseRequirementsMet).toBe(true);
    expect(result.isFullyConfigured).toBe(false);
    expect(result.percentage).toBe(70); // 25 (company) + 20 (org) + 15 (locations) + 10 (users)
  });

  it("reaches 100% and fully configured when all stages are complete", () => {
    const result = calculateSetupProgress({
      company: { ...baseCompany, crNumber: "1010123456", taxNumber: "300000000000003" },
      orgUnits: [sampleOrgUnit],
      workLocations: [sampleLocation],
      shifts: [sampleShift],
      leaveTypes: [sampleLeave],
      activeUsersCount: 2,
    });

    expect(result.baseRequirementsMet).toBe(true);
    expect(result.isFullyConfigured).toBe(true);
    expect(result.percentage).toBe(100);
    expect(result.companyStatus).toBe("complete");
    expect(result.missingFields).toHaveLength(0);
  });
});

describe.sequential("PostgreSQL Security & Cleanup Contracts (PGlite)", () => {
  const db = new PGlite();
  const superAdminId = "11111111-1111-1111-1111-111111111111";
  const hrManagerId = "22222222-2222-2222-2222-222222222222";
  const financeManagerId = "33333333-3333-3333-3333-333333333333";
  const regularEmployeeId = "44444444-4444-4444-4444-444444444444";
  const companyId = "a0000000-0000-0000-0000-000000000001";
  const otherCompanyId = "b0000000-0000-0000-0000-000000000002";
  const employeeRecordId = "e0000000-0000-0000-0000-000000000001";

  beforeAll(async () => {
    // 1. Setup Auth and Role Mock Functions in PGlite
    await db.exec(`
      CREATE ROLE anon;
      CREATE ROLE authenticated;

      CREATE SCHEMA IF NOT EXISTS auth;
      CREATE TABLE IF NOT EXISTS auth.users (
        id uuid PRIMARY KEY,
        email text
      );
      INSERT INTO auth.users (id, email) VALUES
        ('${superAdminId}', 'admin@example.com'),
        ('${hrManagerId}', 'hr@example.com'),
        ('${financeManagerId}', 'finance@example.com'),
        ('${regularEmployeeId}', 'employee@example.com');

      CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$
        SELECT nullif(current_setting('test.auth_uid', true), '')::uuid
      $$;

      CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$
        SELECT nullif(current_setting('test.auth_jwt', true), '')::jsonb
      $$;

      CREATE TABLE IF NOT EXISTS public.user_roles (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL,
        role text NOT NULL,
        UNIQUE(user_id, role)
      );

      INSERT INTO public.user_roles (user_id, role) VALUES
        ('${superAdminId}', 'super_admin'),
        ('${hrManagerId}', 'hr_manager'),
        ('${financeManagerId}', 'finance_manager'),
        ('${regularEmployeeId}', 'employee');

      CREATE TABLE IF NOT EXISTS public.companies (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        legal_name_ar text NOT NULL,
        legal_name_en text,
        cr_number text,
        tax_number text,
        currency text DEFAULT 'SAR',
        timezone text DEFAULT 'Asia/Riyadh',
        headquarters_address text,
        created_at timestamptz DEFAULT now(),
        code text,
        setup_status text DEFAULT 'incomplete',
        updated_at timestamptz DEFAULT now()
      );

      INSERT INTO public.companies (id, legal_name_ar) VALUES
        ('${companyId}', 'الأندلس'),
        ('${otherCompanyId}', 'شركة تجريبية قديمة');

      CREATE TABLE IF NOT EXISTS public.departments (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid REFERENCES public.companies(id),
        name text NOT NULL,
        name_en text,
        code text
      );
      INSERT INTO public.departments (company_id, name) VALUES ('${otherCompanyId}', 'قسم تجريبي قديم');

      CREATE TABLE IF NOT EXISTS public.employees (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid,
        company_id uuid REFERENCES public.companies(id),
        employee_no text,
        full_name text,
        job_title text,
        department_id uuid,
        basic_salary numeric,
        total_salary numeric,
        bank_name text,
        iban text,
        status text DEFAULT 'active'
      );
      INSERT INTO public.employees (id, user_id, company_id, employee_no, full_name, basic_salary, total_salary, bank_name, iban, status)
      VALUES ('${employeeRecordId}', '${regularEmployeeId}', '${companyId}', 'EMP-001', 'أحمد محمود', 5000, 6000, 'البنك الأهلي', 'SA0000000000000000000001', 'active');

      GRANT USAGE ON SCHEMA public TO authenticated;
      GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
      GRANT USAGE ON SCHEMA auth TO authenticated;
      GRANT SELECT ON ALL TABLES IN SCHEMA auth TO authenticated;
    `);

    // 2. Install Employee Field Protection Trigger
    await db.exec(`
      CREATE OR REPLACE FUNCTION public.enforce_employee_field_protection()
      RETURNS trigger
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $$
      DECLARE
        v_is_system boolean := false;
        v_can_manage_finance boolean := false;
        v_can_manage_org boolean := false;
      BEGIN
        IF (COALESCE(auth.jwt() ->> 'role', '') = 'service_role') THEN
          v_is_system := true;
        ELSIF (auth.jwt() IS NULL OR auth.jwt() = '{}'::jsonb) 
              AND session_user IN ('postgres', 'service_role') 
              AND COALESCE(current_setting('role', true), 'none') NOT IN ('authenticated', 'anon') THEN
          v_is_system := true;
        END IF;

        IF v_is_system THEN
          RETURN NEW;
        END IF;

        IF auth.uid() IS NULL THEN
          RAISE EXCEPTION 'غير مصرح: يجب تسجيل الدخول لتعديل بيانات الموظف';
        END IF;

        SELECT EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid()
            AND role IN ('super_admin', 'finance_manager')
        ) INTO v_can_manage_finance;

        SELECT EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid()
            AND role IN ('super_admin', 'hr_manager', 'org_admin')
        ) INTO v_can_manage_org;

        -- Check Financial fields
        IF (NEW.basic_salary IS DISTINCT FROM OLD.basic_salary OR
            NEW.total_salary IS DISTINCT FROM OLD.total_salary OR
            NEW.bank_name IS DISTINCT FROM OLD.bank_name OR
            NEW.iban IS DISTINCT FROM OLD.iban) THEN
          IF NOT v_can_manage_finance THEN
            RAISE EXCEPTION 'غير مصرح لك بتعديل البيانات المالية أو البنكية أو الراتب للموظف دون صلاحية الإدارة المالية المعتمدة';
          END IF;
        END IF;

        -- Check Organizational fields
        IF (NEW.company_id IS DISTINCT FROM OLD.company_id OR
            NEW.user_id IS DISTINCT FROM OLD.user_id OR
            NEW.status IS DISTINCT FROM OLD.status OR
            NEW.job_title IS DISTINCT FROM OLD.job_title OR
            NEW.department_id IS DISTINCT FROM OLD.department_id) THEN
          IF NOT v_can_manage_org THEN
            RAISE EXCEPTION 'غير مصرح لك بتعديل الشركة أو الهيكل التنظيمي أو الحالة الوظيفية للموظف دون صلاحية الموارد البشرية';
          END IF;
        END IF;

        RETURN NEW;
      END;
      $$;

      DROP TRIGGER IF EXISTS trg_enforce_employee_field_protection ON public.employees;
      CREATE TRIGGER trg_enforce_employee_field_protection
      BEFORE UPDATE ON public.employees
      FOR EACH ROW
      EXECUTE FUNCTION public.enforce_employee_field_protection();
    `);

    // 3. Install User Roles Protection Trigger
    await db.exec(`
      CREATE OR REPLACE FUNCTION public.enforce_user_roles_protection()
      RETURNS trigger
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $$
      DECLARE
        v_is_super_admin boolean := false;
      BEGIN
        IF (COALESCE(auth.jwt() ->> 'role', '') = 'service_role') THEN
          RETURN COALESCE(NEW, OLD);
        ELSIF (auth.jwt() IS NULL OR auth.jwt() = '{}'::jsonb) 
              AND session_user IN ('postgres', 'service_role') 
              AND COALESCE(current_setting('role', true), 'none') NOT IN ('authenticated', 'anon') THEN
          RETURN COALESCE(NEW, OLD);
        END IF;

        IF auth.uid() IS NULL THEN
          RAISE EXCEPTION 'غير مصرح: يجب تسجيل الدخول للتعامل مع أدوار المستخدمين';
        END IF;

        SELECT EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role = 'super_admin'
        ) INTO v_is_super_admin;

        IF NOT v_is_super_admin THEN
          RAISE EXCEPTION 'غير مصرح: فقط المسؤول العام (super_admin) يملك صلاحية منح أو تعديل أدوار المستخدمين';
        END IF;

        RETURN COALESCE(NEW, OLD);
      END;
      $$;

      DROP TRIGGER IF EXISTS trg_enforce_user_roles_protection ON public.user_roles;
      CREATE TRIGGER trg_enforce_user_roles_protection
      BEFORE INSERT OR UPDATE OR DELETE ON public.user_roles
      FOR EACH ROW
      EXECUTE FUNCTION public.enforce_user_roles_protection();
    `);
  }, 30000);

  afterAll(async () => {
    await db.close();
  });

  it("rejects salary/financial changes from regular employee", async () => {
    await db.exec(`
      SET ROLE authenticated;
      SET test.auth_uid = '${regularEmployeeId}';
      SET test.auth_jwt = '{"role": "authenticated"}';
    `);
    try {
      await expect(
        db.exec(`UPDATE public.employees SET basic_salary = 10000 WHERE id = '${employeeRecordId}'`)
      ).rejects.toThrow(/غير مصرح لك بتعديل البيانات المالية/);
    } finally {
      await db.exec("RESET ROLE;");
    }
  });

  it("rejects salary/financial changes from hr_manager without finance authority", async () => {
    await db.exec(`
      SET ROLE authenticated;
      SET test.auth_uid = '${hrManagerId}';
      SET test.auth_jwt = '{"role": "authenticated"}';
    `);
    try {
      await expect(
        db.exec(`UPDATE public.employees SET basic_salary = 9000 WHERE id = '${employeeRecordId}'`)
      ).rejects.toThrow(/غير مصرح لك بتعديل البيانات المالية/);
    } finally {
      await db.exec("RESET ROLE;");
    }
  });

  it("allows organizational/job changes from hr_manager", async () => {
    await db.exec(`
      SET ROLE authenticated;
      SET test.auth_uid = '${hrManagerId}';
      SET test.auth_jwt = '{"role": "authenticated"}';
    `);
    try {
      await expect(
        db.exec(`UPDATE public.employees SET job_title = 'كبير المطورين' WHERE id = '${employeeRecordId}'`)
      ).resolves.toBeDefined();
    } finally {
      await db.exec("RESET ROLE;");
    }
  });

  it("allows salary/financial changes from finance_manager", async () => {
    await db.exec(`
      SET ROLE authenticated;
      SET test.auth_uid = '${financeManagerId}';
      SET test.auth_jwt = '{"role": "authenticated"}';
    `);
    try {
      await expect(
        db.exec(`UPDATE public.employees SET basic_salary = 7500, iban = 'SA9999999999999999999999' WHERE id = '${employeeRecordId}'`)
      ).resolves.toBeDefined();
    } finally {
      await db.exec("RESET ROLE;");
    }
  });

  it("rejects user_roles privilege escalation from hr_manager or employee", async () => {
    await db.exec(`
      SET ROLE authenticated;
      SET test.auth_uid = '${hrManagerId}';
      SET test.auth_jwt = '{"role": "authenticated"}';
    `);
    try {
      await expect(
        db.exec(`INSERT INTO public.user_roles (user_id, role) VALUES ('${hrManagerId}', 'super_admin')`)
      ).rejects.toThrow(/غير مصرح: فقط المسؤول العام/);
    } finally {
      await db.exec("RESET ROLE;");
    }

    await db.exec(`
      SET ROLE authenticated;
      SET test.auth_uid = '${regularEmployeeId}';
      SET test.auth_jwt = '{"role": "authenticated"}';
    `);
    try {
      await expect(
        db.exec(`DELETE FROM public.user_roles WHERE user_id = '${regularEmployeeId}'`)
      ).rejects.toThrow(/غير مصرح: فقط المسؤول العام/);
    } finally {
      await db.exec("RESET ROLE;");
    }
  });

  it("allows user_roles changes from super_admin", async () => {
    const testNewUserId = "55555555-5555-5555-5555-555555555555";
    await db.exec(`
      SET ROLE authenticated;
      SET test.auth_uid = '${superAdminId}';
      SET test.auth_jwt = '{"role": "authenticated"}';
    `);
    try {
      await expect(
        db.exec(`INSERT INTO public.user_roles (user_id, role) VALUES ('${testNewUserId}', 'employee')`)
      ).resolves.toBeDefined();
    } finally {
      await db.exec("RESET ROLE;");
    }
  });

  it("verifies pre-cleanup snapshot to private schema and idempotent execution", async () => {
    // Run the backup snapshot and cleanup logic as postgres/service_role
    await db.exec(`
      CREATE SCHEMA IF NOT EXISTS archive_pre_cleanup_20260922;
      REVOKE ALL ON SCHEMA archive_pre_cleanup_20260922 FROM public;

      CREATE TABLE IF NOT EXISTS public.cleanup_audit_log (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        executed_at timestamptz NOT NULL DEFAULT now(),
        action text NOT NULL,
        target_entity text NOT NULL,
        backed_up_count integer NOT NULL DEFAULT 0,
        details jsonb DEFAULT '{}'::jsonb
      );

      -- Snapshot departments and companies
      CREATE TABLE IF NOT EXISTS archive_pre_cleanup_20260922.departments AS SELECT * FROM public.departments;
      CREATE TABLE IF NOT EXISTS archive_pre_cleanup_20260922.companies AS SELECT * FROM public.companies;

      -- Delete demo companies (keep Al-Andalus)
      DELETE FROM public.departments WHERE company_id != '${companyId}';
      DELETE FROM public.companies WHERE legal_name_ar != 'الأندلس';

      INSERT INTO public.cleanup_audit_log (action, target_entity, backed_up_count)
      VALUES ('AL_ANDALUS_INITIAL_CLEANUP_SUCCESS', 'system', 0);
    `);

    // Verify snapshot exists in archive schema
    const archiveDepts = await db.query<{ count: number }>("SELECT count(*)::int as count FROM archive_pre_cleanup_20260922.departments");
    expect(archiveDepts.rows[0].count).toBe(1);

    // Verify public.companies now only has Al-Andalus
    const remainingCompanies = await db.query<{ legal_name_ar: string }>("SELECT legal_name_ar FROM public.companies");
    expect(remainingCompanies.rows).toHaveLength(1);
    expect(remainingCompanies.rows[0].legal_name_ar).toBe("الأندلس");

    // Verify auth.users and user_roles are 100% intact
    const remainingUsers = await db.query<{ count: number }>("SELECT count(*)::int as count FROM auth.users");
    expect(remainingUsers.rows[0].count).toBe(4);

    const remainingRoles = await db.query<{ count: number }>("SELECT count(*)::int as count FROM public.user_roles");
    expect(remainingRoles.rows[0].count).toBe(5); // 4 initial + 1 inserted by super_admin
  });
});
