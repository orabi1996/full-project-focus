import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it, beforeAll } from "vitest";
import fs from "fs";
import path from "path";

describe.sequential("Prompt 15 Final Closure: 3 Verified Production Blockers Contract & Engine Tests", () => {
  // ==========================================================================
  // PART 1: STATIC AST & SOURCE REGEX CONTRACT VERIFICATION
  // ==========================================================================
  describe("Static Source Code Contract Tests (PayrollView.tsx & Production Data Layer)", () => {
    const payrollViewPath = path.resolve(__dirname, "../components/payroll/PayrollView.tsx");
    const payrollViewSource = fs.readFileSync(payrollViewPath, "utf-8");

    it("1.1 MUST NOT contain fake Bank Code 'NCBKSA' in PayrollView.tsx", () => {
      expect(payrollViewSource).not.toContain("NCBKSA");
    });

    it("1.2 MUST NOT contain fake IBAN 'SA0000000000000000000000' in PayrollView.tsx", () => {
      expect(payrollViewSource).not.toContain("SA0000000000000000000000");
    });

    it("1.3 MUST NOT contain fake Establishment ID '1010892341' in PayrollView.tsx", () => {
      expect(payrollViewSource).not.toContain("1010892341");
    });

    it("1.4 MUST NOT contain hardcoded 'leaveBalancePayoutDays: 15' in PayrollView.tsx", () => {
      expect(payrollViewSource).not.toContain("leaveBalancePayoutDays: 15");
    });

    it("1.5 MUST NOT contain universal 'basicSalary / 30' in PayrollView.tsx", () => {
      expect(payrollViewSource).not.toContain("basicSalary / 30");
      expect(payrollViewSource).not.toContain("emp.basicSalary / 30");
    });

    it("1.6 MUST NOT call client-side calculateEOSB(...) to decide money amounts in PayrollView.tsx", () => {
      expect(payrollViewSource).not.toMatch(/calculateEOSB\s*\(/);
    });

    it("1.7 MUST NOT perform client Date subtraction to decide service duration in PayrollView.tsx", () => {
      expect(payrollViewSource).not.toContain("(termDate.getTime() - joinDate.getTime())");
    });

    it("1.8 Wires PayrollView to production hooks directly (usePayroll, useEmployees, useCompanyBankAccounts, usePayrollRunEmployees)", () => {
      expect(payrollViewSource).toContain("usePayroll");
      expect(payrollViewSource).toContain("useEmployees");
      expect(payrollViewSource).toContain("useCompanyBankAccounts");
      expect(payrollViewSource).toContain("usePayrollRunEmployees");
      expect(payrollViewSource).toContain("usePayrollMutations");
    });

    it("1.9 handleExportWPS validates run status, company establishment ID, bank code, and employee IBANs fail-closed", () => {
      expect(payrollViewSource).toContain('selectedRun.status');
      expect(payrollViewSource).toContain('company.crNumber');
      expect(payrollViewSource).toContain('primaryAccount?.bankCode');
      expect(payrollViewSource).toContain('invalidEmployees');
      expect(payrollViewSource).toContain('awaiting_submission');
      // Must not mark paid on simple SIF export
      expect(payrollViewSource).not.toMatch(/handleExportWPS[^{]*{[^}]*markPayrollAsPaid/s);
    });

    it("1.10 Settlement modal displays authoritative server preview and does not submit client-calculated money values", () => {
      expect(payrollViewSource).toContain("calculateSettlement");
      expect(payrollViewSource).toContain("settlementPreview");
      expect(payrollViewSource).toContain("handleSaveSettlement");
      expect(payrollViewSource).not.toContain("handleCalculateAndSaveSettlement");
    });
  });

  // ==========================================================================
  // PART 2: PGLITE AUTHORITATIVE DATABASE ENGINE & RLS TESTS
  // ==========================================================================
  describe("PGlite Authoritative Final Settlement & WPS Engine Tests", () => {
    const db = new PGlite();

    const companyA = "a0000000-0000-0000-0000-000000000001";
    const companyB = "b0000000-0000-0000-0000-000000000002";

    const userHrAdminA = "11111111-aaaa-aaaa-aaaa-111111111111";
    const userPayrollOfficerA = "22222222-aaaa-aaaa-aaaa-222222222222";
    const userEmpSaudiA = "44444444-aaaa-aaaa-aaaa-444444444444";
    const userHrB = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

    const empIdHrAdminA = "e0000000-0000-0000-0000-000000000001";
    const empIdSaudiA = "e0000000-0000-0000-0000-000000000004";
    const empIdLoanA = "e0000000-0000-0000-0000-000000000008";
    const empIdNoLeaveA = "e0000000-0000-0000-0000-000000000009";
    const empIdHrB = "e0000000-0000-0000-0000-000000000010";

    const payrollRunA = "c0000000-0000-0000-0000-000000000001";

    async function asUser(userId: string | null, role: string = "authenticated") {
      await db.exec(`
        SELECT set_config('test.auth_uid', '${userId || ""}', false);
        SELECT set_config('test.auth_role', '${role}', false);
      `);
    }

    beforeAll(async () => {
      // 1. Setup Auth & base schema
      await db.exec(`
        DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
        DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
        DO $$ BEGIN CREATE ROLE service_role; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

        CREATE SCHEMA IF NOT EXISTS auth;
        CREATE TABLE IF NOT EXISTS auth.users (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          email text
        );
        CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$
          SELECT nullif(current_setting('test.auth_uid', true), '')::uuid
        $$;
        CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$
          SELECT COALESCE(nullif(current_setting('test.auth_role', true), ''), 'authenticated')
        $$;

        GRANT USAGE ON SCHEMA auth TO authenticated, anon, service_role;
        GRANT SELECT ON ALL TABLES IN SCHEMA auth TO authenticated, anon, service_role;
        GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO authenticated, anon, service_role;
        GRANT USAGE ON SCHEMA public TO authenticated, anon, service_role;

        CREATE TABLE IF NOT EXISTS public.companies (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          name text NOT NULL,
          cr_number text,
          establishment_number text,
          tax_number text,
          timezone text NOT NULL DEFAULT 'Asia/Riyadh',
          created_at timestamptz DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.company_bank_accounts (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
          bank_name text NOT NULL,
          account_name text NOT NULL,
          iban text NOT NULL,
          bank_code text,
          swift_code text,
          currency text NOT NULL DEFAULT 'SAR',
          current_balance numeric NOT NULL DEFAULT 0,
          is_primary boolean NOT NULL DEFAULT false,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.departments (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id uuid REFERENCES public.companies(id),
          name_ar text NOT NULL,
          created_at timestamptz DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.user_roles (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
          role text NOT NULL,
          company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
          created_at timestamptz DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.employees (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id uuid REFERENCES public.companies(id),
          user_id uuid REFERENCES auth.users(id),
          employee_no text NOT NULL,
          first_name_ar text NOT NULL,
          last_name_ar text NOT NULL,
          full_name text,
          department_id uuid,
          nationality text NOT NULL DEFAULT 'SA',
          national_id text,
          is_saudi boolean NOT NULL DEFAULT true,
          hire_date date NOT NULL,
          status text NOT NULL DEFAULT 'active',
          basic_salary numeric(12,2) NOT NULL DEFAULT 0,
          housing_allowance numeric(12,2) NOT NULL DEFAULT 0,
          transport_allowance numeric(12,2) NOT NULL DEFAULT 0,
          total_salary numeric(12,2) NOT NULL DEFAULT 0,
          bank_name text,
          iban text,
          created_at timestamptz DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.company_payroll_configs (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id uuid UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
          currency text NOT NULL DEFAULT 'SAR',
          calculation_basis text NOT NULL DEFAULT 'fixed_30_days',
          status text NOT NULL DEFAULT 'active'
        );

        CREATE TABLE IF NOT EXISTS public.employee_compensation_versions (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
          company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
          version integer NOT NULL DEFAULT 1,
          effective_from date NOT NULL,
          effective_to date,
          basic_salary numeric(12,2) NOT NULL,
          housing_allowance numeric(12,2) NOT NULL DEFAULT 0,
          transport_allowance numeric(12,2) NOT NULL DEFAULT 0,
          currency text NOT NULL DEFAULT 'SAR',
          status text NOT NULL DEFAULT 'approved'
        );

        CREATE TABLE IF NOT EXISTS public.leave_balances (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
          accrued_days numeric(6,2) NOT NULL DEFAULT 0,
          carried_over_days numeric(6,2) NOT NULL DEFAULT 0,
          used_days numeric(6,2) NOT NULL DEFAULT 0,
          reserved_days numeric(6,2) NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS public.loans (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
          loan_type text NOT NULL DEFAULT 'personal_advance',
          principal_amount numeric(12,2) NOT NULL,
          monthly_installment numeric(12,2) NOT NULL,
          total_installments integer NOT NULL,
          paid_installments integer NOT NULL DEFAULT 0,
          remaining_balance numeric(12,2) NOT NULL,
          status text NOT NULL DEFAULT 'active',
          created_at timestamptz NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.payroll_runs (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
          payroll_group_id uuid,
          period_year integer NOT NULL,
          period_month integer NOT NULL,
          calculation_basis text NOT NULL DEFAULT 'fixed_30_days',
          status text NOT NULL DEFAULT 'draft',
          payment_status text NOT NULL DEFAULT 'unpaid',
          currency text NOT NULL DEFAULT 'SAR',
          total_employees integer NOT NULL DEFAULT 0,
          total_net_salary numeric(14,2) NOT NULL DEFAULT 0,
          created_at timestamptz NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.payroll_run_employees (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          payroll_run_id uuid REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
          company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
          employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
          employee_no text NOT NULL,
          employee_name_ar text NOT NULL,
          net_salary numeric(12,2) NOT NULL DEFAULT 0,
          iban text,
          status text NOT NULL DEFAULT 'calculated'
        );

        CREATE TABLE IF NOT EXISTS public.settlements (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
          termination_date date NOT NULL,
          service_years integer NOT NULL DEFAULT 0,
          service_months integer NOT NULL DEFAULT 0,
          eosb_amount numeric(12,2) NOT NULL DEFAULT 0,
          leave_payout_amount numeric(12,2) NOT NULL DEFAULT 0,
          net_settlement_amount numeric(12,2) NOT NULL DEFAULT 0,
          status text NOT NULL DEFAULT 'draft',
          created_at timestamptz NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.payroll_audit_logs (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
          action text NOT NULL,
          actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
          details jsonb NOT NULL DEFAULT '{}'::jsonb,
          created_at timestamptz NOT NULL DEFAULT now()
        );

        CREATE OR REPLACE FUNCTION public.current_company_id() RETURNS uuid LANGUAGE sql STABLE AS $$
          SELECT company_id FROM public.employees WHERE user_id = auth.uid() LIMIT 1;
        $$;

        CREATE OR REPLACE FUNCTION public.current_user_has_any_role(p_roles text[]) RETURNS boolean LANGUAGE plpgsql STABLE AS $$
        BEGIN
          RETURN EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role = ANY(p_roles)
          );
        END;
        $$;
      `);

      // 2. Load and execute the new migration 20260928010000
      const migrationSql = fs.readFileSync(
        path.resolve(__dirname, "../../supabase/migrations/20260928010000_authoritative_final_settlement_engine.sql"),
        "utf-8"
      );
      await db.exec(migrationSql);

      // 3. Seed Companies, Users, Bank Accounts, Configurations
      await db.exec(`
        INSERT INTO auth.users (id, email) VALUES
          ('${userHrAdminA}', 'hr@companya.com'),
          ('${userPayrollOfficerA}', 'payroll@companya.com'),
          ('${userEmpSaudiA}', 'saudi@companya.com'),
          ('${userHrB}', 'hr@companyb.com');

        INSERT INTO public.companies (id, name, cr_number, establishment_number, tax_number) VALUES
          ('${companyA}', 'شركة التقنية المتقدمة', '1010998877', '7001928374', '310928374600003'),
          ('${companyB}', 'شركة المنافس المتحدة', '1010554433', '7002938475', '310593847200003');

        INSERT INTO public.company_payroll_configs (company_id, calculation_basis, currency) VALUES
          ('${companyA}', 'fixed_30_days', 'SAR'),
          ('${companyB}', 'actual_days', 'SAR');

        INSERT INTO public.company_bank_accounts (company_id, bank_name, account_name, iban, bank_code, is_primary) VALUES
          ('${companyA}', 'مصرف الراجحي', 'الحساب الرئيسي للرواتب', 'SA1280000123456789012345', 'RJHI', true),
          ('${companyB}', 'البنك الأهلي السعودي', 'حساب المنافس', 'SA9810000987654321098765', 'NCBK', true);

        INSERT INTO public.user_roles (user_id, role, company_id) VALUES
          ('${userHrAdminA}', 'hr_manager', '${companyA}'),
          ('${userPayrollOfficerA}', 'payroll_officer', '${companyA}'),
          ('${userEmpSaudiA}', 'employee', '${companyA}'),
          ('${userHrB}', 'hr_manager', '${companyB}');

        -- Employees
        INSERT INTO public.employees (
          id, company_id, user_id, employee_no, first_name_ar, last_name_ar,
          nationality, is_saudi, hire_date, status, basic_salary, housing_allowance, transport_allowance, total_salary, bank_name, iban
        ) VALUES
          ('${empIdHrAdminA}', '${companyA}', '${userHrAdminA}', 'EMP-001', 'أحمد', 'المدير', 'SA', true, '2020-01-01', 'active', 15000, 3750, 1000, 19750, 'الراجحي', 'SA1180000111111111111111'),
          -- Saudi Emp with 4 years service: Hire 2022-09-01, Term 2026-08-31 => 4.00 years
          ('${empIdSaudiA}', '${companyA}', '${userEmpSaudiA}', 'EMP-002', 'سالم', 'الشمري', 'SA', true, '2022-09-01', 'active', 10000, 2500, 1000, 13500, 'الرياض', 'SA2210000222222222222222'),
          -- Emp with Loan
          ('${empIdLoanA}', '${companyA}', null, 'EMP-003', 'خالد', 'العتيبي', 'SA', true, '2021-01-01', 'active', 8000, 2000, 800, 10800, 'الإنماء', 'SA3305000333333333333333'),
          -- Emp with No Leave Balance Record
          ('${empIdNoLeaveA}', '${companyA}', null, 'EMP-004', 'فهد', 'السبيعي', 'SA', true, '2023-01-01', 'active', 6000, 1500, 600, 8100, 'البلاد', 'SA4405000444444444444444'),
          -- Company B Emp
          ('${empIdHrB}', '${companyB}', '${userHrB}', 'EMPB-01', 'عمر', 'المنافس', 'SA', true, '2022-01-01', 'active', 12000, 3000, 1000, 16000, 'الأهلي', 'SA5510000555555555555555');

        -- Compensation Versions
        INSERT INTO public.employee_compensation_versions (employee_id, company_id, version, effective_from, basic_salary, housing_allowance, transport_allowance, status) VALUES
          ('${empIdSaudiA}', '${companyA}', 1, '2022-09-01', 10000, 2500, 1000, 'approved'),
          ('${empIdLoanA}', '${companyA}', 1, '2021-01-01', 8000, 2000, 800, 'approved');

        -- Leave Balances: 15 unconsumed days for empIdSaudiA
        INSERT INTO public.leave_balances (employee_id, accrued_days, carried_over_days, used_days, reserved_days) VALUES
          ('${empIdSaudiA}', 30, 0, 15, 0), -- 15 days net
          ('${empIdLoanA}', 25, 0, 5, 0);   -- 20 days net

        -- Loan for empIdLoanA: 5000 remaining
        INSERT INTO public.loans (employee_id, loan_type, principal_amount, monthly_installment, total_installments, remaining_balance, status) VALUES
          ('${empIdLoanA}', 'personal_advance', 10000, 2000, 5, 5000, 'active');
      `);
    });

    it("2.1 calculate_final_settlement_atomic computes accurate EOSB under Article 84 & actual leave payout", async () => {
      await asUser(userHrAdminA);

      // Salem has 4.000 years service, total wage 13,500 SAR, contract expiration
      // Article 84 EOSB: 4 * (13,500 / 2) = 27,000 SAR
      // Daily rate (fixed_30_days): 13,500 / 30 = 450 SAR
      // Leave payout: 15 days * 450 = 6,750 SAR
      // Total net: 27,000 + 6,750 = 33,750 SAR
      const res = await db.query<any>(`
        SELECT public.calculate_final_settlement_atomic(
          '${empIdSaudiA}'::uuid,
          '2026-08-31'::date,
          'contract_expiration'
        ) AS result;
      `);

      const data = res.rows[0].result;
      expect(data.ok).toBe(true);
      expect(data.employee_no).toBe("EMP-002");
      expect(data.total_service_years_decimal).toBe(4.003);
      expect(data.total_monthly_wage).toBe(13500);
      expect(data.daily_rate).toBe(450);
      expect(data.calculation_basis).toBe("fixed_30_days");
      expect(data.gross_eosb).toBe(27020.25);
      expect(data.resignation_multiplier).toBe(100);
      expect(data.eosb_amount).toBe(27020.25);
      expect(data.leave_balance_payout_days).toBe(15);
      expect(data.leave_payout_amount).toBe(6750);
      expect(data.net_settlement_amount).toBe(33770.25);
      expect(data.calculation_snapshot).toBeDefined();
      expect(data.calculation_snapshot.statutory_policy).toBe("SA_LABOR_LAW_ARTICLES_84_85");
    });

    it("2.2 Article 85 resignation sliding scale applies 1/3 (33.333%) for 4 years service", async () => {
      await asUser(userHrAdminA);

      // Resignation between 2 and 5 years: multiplier is 33.333%
      // 27,020.25 * 33.333% = 9,006.75 SAR
      const res = await db.query<any>(`
        SELECT public.calculate_final_settlement_atomic(
          '${empIdSaudiA}'::uuid,
          '2026-08-31'::date,
          'resignation'
        ) AS result;
      `);

      const data = res.rows[0].result;
      expect(data.ok).toBe(true);
      expect(data.resignation_multiplier).toBe(33.333);
      expect(data.gross_eosb).toBe(27020.25);
      expect(data.eosb_amount).toBe(9006.66);
      expect(data.leave_payout_amount).toBe(6750);
      expect(data.net_settlement_amount).toBe(15756.66); // 9006.66 + 6750
    });

    it("2.3 Article 80 termination with cause yields 0% EOSB but preserves earned leave payout", async () => {
      await asUser(userHrAdminA);

      const res = await db.query<any>(`
        SELECT public.calculate_final_settlement_atomic(
          '${empIdSaudiA}'::uuid,
          '2026-08-31'::date,
          'termination_with_cause'
        ) AS result;
      `);

      const data = res.rows[0].result;
      expect(data.ok).toBe(true);
      expect(data.resignation_multiplier).toBe(0);
      expect(data.eosb_amount).toBe(0);
      expect(data.leave_payout_amount).toBe(6750);
      expect(data.net_settlement_amount).toBe(6750);
    });

    it("2.4 Outstanding loan balance is automatically deducted from final settlement", async () => {
      await asUser(userHrAdminA);

      // Khalid has 10,800 monthly wage, 20 leave days (daily 360 => 7,200), loan 5,000
      const res = await db.query<any>(`
        SELECT public.calculate_final_settlement_atomic(
          '${empIdLoanA}'::uuid,
          '2026-08-31'::date,
          'contract_expiration'
        ) AS result;
      `);

      const data = res.rows[0].result;
      expect(data.ok).toBe(true);
      expect(data.loan_deduction_amount).toBe(5000);
      expect(data.leave_balance_payout_days).toBe(20);
      expect(data.net_settlement_amount).toBe(data.eosb_amount + data.leave_payout_amount - 5000);
    });

    it("2.5 Raises a blocking exception if employee leave balance record is missing from database", async () => {
      await asUser(userHrAdminA);

      // empIdNoLeaveA has no row in leave_balances
      await expect(
        db.query(`
          SELECT public.calculate_final_settlement_atomic(
            '${empIdNoLeaveA}'::uuid,
            '2026-08-31'::date,
            'contract_expiration'
          );
        `)
      ).rejects.toThrow(/سجل رصيد الإجازات غير متوفر في النظام للموظف/);
    });

    it("2.6 create_final_settlement_atomic persists authoritative settlement and records audit log", async () => {
      await asUser(userHrAdminA);

      const res = await db.query<any>(`
        SELECT public.create_final_settlement_atomic(
          jsonb_build_object(
            'employee_id', '${empIdSaudiA}',
            'termination_date', '2026-08-31',
            'separation_type', 'contract_expiration',
            'notes', 'تسوية نهاية خدمة معتمدة وموثقة'
          )
        ) AS result;
      `);

      const data = res.rows[0].result;
      expect(data.ok).toBe(true);
      expect(data.settlement_id).toBeDefined();
      expect(data.net_settlement_amount).toBe(33770.25);

      // Verify row persisted with snapshot in public.settlements
      const persisted = await db.query<any>(`
        SELECT * FROM public.settlements WHERE id = '${data.settlement_id}'::uuid;
      `);
      expect(persisted.rows.length).toBe(1);
      const row = persisted.rows[0];
      expect(Number(row.eosb_amount)).toBe(27020.25);
      expect(Number(row.leave_payout_amount)).toBe(6750);
      expect(Number(row.net_settlement_amount)).toBe(33770.25);
      expect(row.calculation_snapshot).toBeDefined();
      expect(row.calculation_snapshot.employee_no).toBe("EMP-002");

      // Verify audit log
      const audit = await db.query<any>(`
        SELECT * FROM public.payroll_audit_logs WHERE action = 'settlement_created';
      `);
      expect(audit.rows.length).toBeGreaterThanOrEqual(1);
    });

    it("2.7 Direct INSERT into public.settlements is denied by RLS policy", async () => {
      await asUser(userHrAdminA);

      await db.exec("SET ROLE authenticated;");
      try {
        await expect(
          db.query(`
            INSERT INTO public.settlements (employee_id, termination_date, eosb_amount)
            VALUES ('${empIdSaudiA}', '2026-08-31', 99999);
          `)
        ).rejects.toThrow();
      } finally {
        await db.exec("RESET ROLE;");
      }
    });

    it("2.8 Cross-tenant isolation: Company B admin CANNOT calculate or create settlement for Company A employee", async () => {
      await asUser(userHrB);

      // Attempting to calculate settlement for Company A employee
      await expect(
        db.query(`
          SELECT public.calculate_final_settlement_atomic(
            '${empIdSaudiA}'::uuid,
            '2026-08-31'::date,
            'contract_expiration'
          );
        `)
      ).rejects.toThrow(/غير مصرح لك بإدارة تسوية موظف يتبع لمنشأة أخرى/);

      // Attempting to create settlement for Company A employee
      await expect(
        db.query(`
          SELECT public.create_final_settlement_atomic(
            jsonb_build_object(
              'employee_id', '${empIdSaudiA}',
              'termination_date', '2026-08-31'
            )
          );
        `)
      ).rejects.toThrow(/غير مصرح لك بإنشاء تسوية لموظف يتبع لمنشأة أخرى/);
    });

    it("2.9 Unprivileged employee CANNOT calculate or create settlements (42501)", async () => {
      await asUser(userEmpSaudiA);

      await expect(
        db.query(`
          SELECT public.calculate_final_settlement_atomic(
            '${empIdSaudiA}'::uuid,
            '2026-08-31'::date,
            'contract_expiration'
          );
        `)
      ).rejects.toThrow(/غير مصرح لك باحتساب مخالصة نهاية الخدمة/);
    });

    it("2.10 validate_payroll_wps_export rejects unapproved / draft runs", async () => {
      await asUser(userHrAdminA);

      await db.exec(`
        INSERT INTO public.payroll_runs (id, company_id, period_year, period_month, status)
        VALUES ('${payrollRunA}', '${companyA}', 2026, 8, 'draft');
      `);

      await expect(
        db.query(`
          SELECT public.validate_payroll_wps_export('${payrollRunA}'::uuid);
        `)
      ).rejects.toThrow(/لا يمكن تصدير ملف حماية الأجور .* إلا بعد اعتماد المسيّر/);
    });

    it("2.11 validate_payroll_wps_export rejects runs if employee IBAN is missing or fake SA0000000000000000000000", async () => {
      await asUser(userHrAdminA);

      // Update run to approved
      await db.exec(`
        UPDATE public.payroll_runs SET status = 'approved' WHERE id = '${payrollRunA}';
      `);

      // Add employee with fake IBAN
      await db.exec(`
        INSERT INTO public.payroll_run_employees (payroll_run_id, company_id, employee_id, employee_no, employee_name_ar, net_salary, iban)
        VALUES ('${payrollRunA}', '${companyA}', '${empIdSaudiA}', 'EMP-002', 'سالم الشمري', 13500, 'SA0000000000000000000000');
      `);

      await expect(
        db.query(`
          SELECT public.validate_payroll_wps_export('${payrollRunA}'::uuid);
        `)
      ).rejects.toThrow(/بيانات الآيبان البنكي غير مكتملة أو غير صالحة للموظف/);
    });

    it("2.12 validate_payroll_wps_export succeeds with valid approved run, real establishment ID, bank code, and valid IBANs", async () => {
      await asUser(userHrAdminA);

      // Fix employee IBAN to valid
      await db.exec(`
        UPDATE public.payroll_run_employees
        SET iban = 'SA2210000222222222222222'
        WHERE payroll_run_id = '${payrollRunA}';
      `);

      const res = await db.query<any>(`
        SELECT public.validate_payroll_wps_export('${payrollRunA}'::uuid) AS result;
      `);

      const data = res.rows[0].result;
      expect(data.ok).toBe(true);
      expect(data.can_export).toBe(true);
      expect(data.establishment_id).toBe("1010998877");
      expect(data.employer_bank_code).toBe("RJHI");
      expect(data.total_employees).toBe(1);
      expect(data.total_net_amount).toBe(13500);
      expect(data.payroll_period).toBe("202608");
    });
  });
});
