import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it, beforeAll } from "vitest";
import fs from "fs";
import path from "path";

describe.sequential("Prompt 16: Production Loans, Employee Separation & End-of-Service Engine", () => {
  // ==========================================================================
  // PART 1: STATIC AST & SOURCE CODE CONTRACT TESTS
  // ==========================================================================
  describe("Static Source Code Contract Tests", () => {
    const payrollViewPath = path.resolve(__dirname, "../components/payroll/PayrollView.tsx");
    const payrollViewSource = fs.readFileSync(payrollViewPath, "utf-8");

    const loansRepoPath = path.resolve(__dirname, "../lib/data/loans-repository.ts");
    const loansRepoSource = fs.readFileSync(loansRepoPath, "utf-8");

    const separationRepoPath = path.resolve(__dirname, "../lib/data/separation-repository.ts");
    const separationRepoSource = fs.readFileSync(separationRepoPath, "utf-8");

    const loansFunctionsPath = path.resolve(__dirname, "../lib/business/loans.functions.ts");
    const loansFunctionsSource = fs.readFileSync(loansFunctionsPath, "utf-8");

    const separationFunctionsPath = path.resolve(__dirname, "../lib/business/separation.functions.ts");
    const separationFunctionsSource = fs.readFileSync(separationFunctionsPath, "utf-8");

    it("1.1 PayrollView MUST contain Separation & Offboarding Tab and Loan Installment Dialog", () => {
      expect(payrollViewSource).toContain('value="separations"');
      expect(payrollViewSource).toContain("حالات إنهاء الخدمة وإخلاء الطرف");
      expect(payrollViewSource).toContain("selectedLoanForSchedule");
      expect(payrollViewSource).toContain("جدول أقساط السلفة");
      expect(payrollViewSource).toContain("isSeparationModalOpen");
      expect(payrollViewSource).toContain("بدء إجراء إنهاء خدمة / استقالة");
      expect(payrollViewSource).toContain("useEmployeeSeparations");
      expect(payrollViewSource).toContain("useClearanceItems");
      expect(payrollViewSource).toContain("useLoanInstallments");
    });

    it("1.2 Loans repository exports typed hooks and mutations", () => {
      expect(loansRepoSource).toContain("useLoanPolicies");
      expect(loansRepoSource).toContain("useLoans");
      expect(loansRepoSource).toContain("useLoanInstallments");
      expect(loansRepoSource).toContain("useLoanMutations");
      expect(loansRepoSource).toContain("validate_loan_eligibility");
      expect(loansRepoSource).toContain("disburse_loan_atomic");
      expect(loansRepoSource).toContain("settle_loan_early_atomic");
    });

    it("1.3 Separation repository exports typed hooks and mutations", () => {
      expect(separationRepoSource).toContain("useEmployeeSeparations");
      expect(separationRepoSource).toContain("useClearanceItems");
      expect(separationRepoSource).toContain("useSeparationMutations");
      expect(separationRepoSource).toContain("submit_resignation_atomic");
      expect(separationRepoSource).toContain("initiate_separation_hr_atomic");
      expect(separationRepoSource).toContain("update_clearance_item_atomic");
      expect(separationRepoSource).toContain("finalize_employee_offboarding_atomic");
    });

    it("1.4 Business functions wire server operations to atomic RPCs", () => {
      expect(loansFunctionsSource).toContain("disburse_loan_atomic");
      expect(loansFunctionsSource).toContain("settle_loan_early_atomic");
      expect(separationFunctionsSource).toContain("submit_resignation_atomic");
      expect(separationFunctionsSource).toContain("initiate_separation_hr_atomic");
      expect(separationFunctionsSource).toContain("update_clearance_item_atomic");
      expect(separationFunctionsSource).toContain("finalize_employee_offboarding_atomic");
    });
  });

  // ==========================================================================
  // PART 2: PGLITE AUTHORITATIVE DATABASE ENGINE & LIFECYCLE TESTS
  // ==========================================================================
  describe("PGlite Authoritative Loans, Separation & Offboarding Engine Tests", () => {
    const db = new PGlite();

    const companyA = "a0000000-0000-0000-0000-000000000001";
    const companyB = "b0000000-0000-0000-0000-000000000002";

    const userHrAdminA = "11111111-aaaa-aaaa-aaaa-111111111111";
    const userPayrollA = "22222222-aaaa-aaaa-aaaa-222222222222";
    const userEmpEligibleA = "33333333-aaaa-aaaa-aaaa-333333333333";
    const userEmpNewA = "44444444-aaaa-aaaa-aaaa-444444444444";
    const userHrB = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

    const empIdHrAdminA = "e0000000-0000-0000-0000-000000000001";
    const empIdPayrollA = "e0000000-0000-0000-0000-000000000002";
    const empIdEligibleA = "e0000000-0000-0000-0000-000000000003";
    const empIdNewA = "e0000000-0000-0000-0000-000000000004";
    const empIdHrB = "e0000000-0000-0000-0000-000000000010";

    const bankAccountA = "ba000000-0000-0000-0000-000000000001";
    const bankAccountB = "ba000000-0000-0000-0000-000000000002";

    async function asUser(userId: string | null, role: string = "authenticated") {
      if (role === "postgres") {
        await db.exec(`
          RESET ROLE;
          SELECT set_config('test.auth_uid', '', false);
          SELECT set_config('test.auth_role', '', false);
        `);
      } else {
        await db.exec(`
          RESET ROLE;
          SELECT set_config('test.auth_uid', '${userId || ""}', false);
          SELECT set_config('test.auth_role', '${role}', false);
          SET ROLE ${role};
        `);
      }
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
          created_at timestamptz DEFAULT now(),
          updated_at timestamptz DEFAULT now()
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

        CREATE TABLE IF NOT EXISTS public.hardware_assets (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
          assigned_to_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
          name text NOT NULL,
          asset_tag text NOT NULL,
          category text NOT NULL DEFAULT 'laptop',
          status text NOT NULL DEFAULT 'assigned',
          serial_number text,
          created_at timestamptz NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.approval_chains (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
          name text NOT NULL,
          request_type text NOT NULL,
          is_active boolean NOT NULL DEFAULT true,
          version integer NOT NULL DEFAULT 1,
          created_at timestamptz NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.approval_steps (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          chain_id uuid REFERENCES public.approval_chains(id) ON DELETE CASCADE,
          step_order integer NOT NULL,
          approver_type text NOT NULL,
          approver_role text,
          created_at timestamptz NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.requests (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
          employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
          type text NOT NULL,
          status text NOT NULL DEFAULT 'submitted',
          title text,
          notes text,
          payload jsonb NOT NULL DEFAULT '{}'::jsonb,
          approval_chain_id uuid REFERENCES public.approval_chains(id) ON DELETE SET NULL,
          current_step integer NOT NULL DEFAULT 1,
          total_steps integer NOT NULL DEFAULT 1,
          created_at timestamptz NOT NULL DEFAULT now()
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

        CREATE TABLE IF NOT EXISTS public.payroll_loan_allocations (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          payroll_run_id uuid REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
          loan_id uuid REFERENCES public.loans(id) ON DELETE CASCADE,
          employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
          amount numeric(12,2) NOT NULL,
          recovered_at timestamptz,
          created_at timestamptz DEFAULT now(),
          UNIQUE (payroll_run_id, loan_id)
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

      // 2. Load Prompt 15 migration (authoritative settlement engine)
      const migration15Sql = fs.readFileSync(
        path.resolve(__dirname, "../../supabase/migrations/20260928010000_authoritative_final_settlement_engine.sql"),
        "utf-8"
      );
      await db.exec(migration15Sql);

      // 3. Load Prompt 16 migration (production loans and offboarding engine)
      const migration16Sql = fs.readFileSync(
        path.resolve(__dirname, "../../supabase/migrations/20260929000000_production_loans_and_offboarding_engine.sql"),
        "utf-8"
      );
      await db.exec(migration16Sql);

      // 4. Grant table and execution privileges to authenticated role
      await db.exec(`
        GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, anon, service_role;
        GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon, service_role;
        GRANT ALL ON ALL ROUTINES IN SCHEMA public TO authenticated, anon, service_role;
      `);

      // 5. Seed Companies, Users, Bank Accounts, Configurations
      await db.exec(`
        INSERT INTO auth.users (id, email) VALUES
          ('${userHrAdminA}', 'hr@companya.com'),
          ('${userPayrollA}', 'payroll@companya.com'),
          ('${userEmpEligibleA}', 'eligible@companya.com'),
          ('${userEmpNewA}', 'new@companya.com'),
          ('${userHrB}', 'hr@companyb.com');

        INSERT INTO public.companies (id, name, cr_number, establishment_number, tax_number) VALUES
          ('${companyA}', 'شركة المستقبل المالي', '1010998877', '7001928374', '310928374600003'),
          ('${companyB}', 'شركة المنافس', '1010554433', '7002938475', '310593847200003');

        INSERT INTO public.company_payroll_configs (company_id, calculation_basis, currency) VALUES
          ('${companyA}', 'fixed_30_days', 'SAR'),
          ('${companyB}', 'actual_days', 'SAR');

        INSERT INTO public.company_bank_accounts (id, company_id, bank_name, account_name, iban, bank_code, current_balance, is_primary) VALUES
          ('${bankAccountA}', '${companyA}', 'مصرف الراجحي', 'حساب الرواتب والقروض', 'SA1280000123456789012345', 'RJHI', 500000.00, true),
          ('${bankAccountB}', '${companyB}', 'البنك الأهلي', 'حساب المنافس', 'SA9810000987654321098765', 'NCBK', 100000.00, true);

        INSERT INTO public.user_roles (user_id, role, company_id) VALUES
          ('${userHrAdminA}', 'hr_manager', '${companyA}'),
          ('${userPayrollA}', 'payroll_officer', '${companyA}'),
          ('${userEmpEligibleA}', 'employee', '${companyA}'),
          ('${userEmpNewA}', 'employee', '${companyA}'),
          ('${userHrB}', 'hr_manager', '${companyB}');

        -- Eligible employee: hired 3 years ago, 10,000 SAR salary
        INSERT INTO public.employees (
          id, company_id, user_id, employee_no, first_name_ar, last_name_ar, hire_date, status,
          basic_salary, housing_allowance, transport_allowance, total_salary, iban
        ) VALUES (
          '${empIdEligibleA}', '${companyA}', '${userEmpEligibleA}', 'EMP-001', 'أحمد', 'الغامدي',
          CURRENT_DATE - INTERVAL '3 years', 'active',
          7000.00, 2000.00, 1000.00, 10000.00, 'SA1111111111111111111111'
        );

        -- New employee: hired 10 days ago (below 90-day minimum service)
        INSERT INTO public.employees (
          id, company_id, user_id, employee_no, first_name_ar, last_name_ar, hire_date, status,
          basic_salary, housing_allowance, transport_allowance, total_salary, iban
        ) VALUES (
          '${empIdNewA}', '${companyA}', '${userEmpNewA}', 'EMP-002', 'محمد', 'الجديد',
          CURRENT_DATE - INTERVAL '10 days', 'active',
          4000.00, 1000.00, 500.00, 5500.00, 'SA2222222222222222222222'
        );

        -- HR Admin employee
        INSERT INTO public.employees (
          id, company_id, user_id, employee_no, first_name_ar, last_name_ar, hire_date, status,
          basic_salary, housing_allowance, transport_allowance, total_salary, iban
        ) VALUES (
          '${empIdHrAdminA}', '${companyA}', '${userHrAdminA}', 'HR-001', 'مدير', 'الموارد',
          CURRENT_DATE - INTERVAL '5 years', 'active',
          15000.00, 3000.00, 1500.00, 19500.00, 'SA3333333333333333333333'
        );

        -- Payroll Officer employee
        INSERT INTO public.employees (
          id, company_id, user_id, employee_no, first_name_ar, last_name_ar, hire_date, status,
          basic_salary, housing_allowance, transport_allowance, total_salary, iban
        ) VALUES (
          '${empIdPayrollA}', '${companyA}', '${userPayrollA}', 'PAY-001', 'مسؤول', 'الرواتب',
          CURRENT_DATE - INTERVAL '3 years', 'active',
          10000.00, 2000.00, 1000.00, 13000.00, 'SA5555555555555555555555'
        );

        -- HR B employee
        INSERT INTO public.employees (
          id, company_id, user_id, employee_no, first_name_ar, last_name_ar, hire_date, status,
          basic_salary, housing_allowance, transport_allowance, total_salary, iban
        ) VALUES (
          '${empIdHrB}', '${companyB}', '${userHrB}', 'HR-B-001', 'مدير', 'الفرع ب',
          CURRENT_DATE - INTERVAL '2 years', 'active',
          12000.00, 2000.00, 1000.00, 15000.00, 'SA4444444444444444444444'
        );

        -- Compensation version and leave balance for eligible employee
        INSERT INTO public.employee_compensation_versions (
          employee_id, company_id, version, effective_from, basic_salary, housing_allowance, transport_allowance, status
        ) VALUES (
          '${empIdEligibleA}', '${companyA}', 1, CURRENT_DATE - INTERVAL '3 years',
          7000.00, 2000.00, 1000.00, 'approved'
        );

        INSERT INTO public.leave_balances (employee_id, accrued_days, carried_over_days, used_days, reserved_days) VALUES
          ('${empIdEligibleA}', 30.00, 10.00, 5.00, 0.00);

        -- Assign a hardware asset to eligible employee
        INSERT INTO public.hardware_assets (
          id, company_id, assigned_to_employee_id, name, asset_tag, category, status
        ) VALUES (
          'fa000000-0000-0000-0000-000000000001', '${companyA}', '${empIdEligibleA}',
          'MacBook Pro 16 M3 Max', 'AST-MBP-001', 'laptop', 'assigned'
        );
      `);
    });

    // ========================================================================
    // 2.1 LOAN ELIGIBILITY VALIDATION ENGINE
    // ========================================================================
    describe("2.1 Loan Eligibility Engine (validate_loan_eligibility)", () => {
      it("blocks loan if employee service is less than min_service_days (90 days)", async () => {
        await asUser(userHrAdminA);
        await expect(
          db.query(`SELECT public.validate_loan_eligibility('${empIdNewA}', 5000, 6, 'personal_advance')`)
        ).rejects.toThrow(/أقل من الحد الأدنى المشترط في سياسة السلف/);
      });

      it("blocks loan if requested amount exceeds policy max_amount", async () => {
        await asUser(userHrAdminA);
        await expect(
          db.query(`SELECT public.validate_loan_eligibility('${empIdEligibleA}', 100000, 12, 'personal_advance')`)
        ).rejects.toThrow(/يتجاوز سقف السلفة/);
      });

      it("blocks loan if requested amount is below policy min_amount", async () => {
        await asUser(userHrAdminA);
        await expect(
          db.query(`SELECT public.validate_loan_eligibility('${empIdEligibleA}', 100, 12, 'personal_advance')`)
        ).rejects.toThrow(/أقل من الحد الأدنى/);
      });

      it("blocks loan if monthly installment exceeds maximum salary capacity (30% of total salary)", async () => {
        await asUser(userHrAdminA);
        // Total salary = 10,000 -> 30% = 3,000 max installment
        // 10,000 / 2 months = 5,000 monthly installment > 3,000
        await expect(
          db.query(`SELECT public.validate_loan_eligibility('${empIdEligibleA}', 10000, 2, 'personal_advance')`)
        ).rejects.toThrow(/يتجاوز الطاقة الاستقطاعية القصوى/);
      });

      it("approves eligibility for compliant loan parameters", async () => {
        await asUser(userHrAdminA);
        // 12,000 / 6 = 2,000 <= 3,000 (30% of 10,000)
        const res = await db.query<{ validate_loan_eligibility: { eligible: boolean; monthly_installment: number } }>(
          `SELECT public.validate_loan_eligibility('${empIdEligibleA}', 12000, 6, 'personal_advance')`
        );
        expect(res.rows[0].validate_loan_eligibility.eligible).toBe(true);
        expect(res.rows[0].validate_loan_eligibility.monthly_installment).toBe(2000);
      });
    });

    // ========================================================================
    // 2.2 LOAN SUBMISSION & ATOMIC DISBURSEMENT
    // ========================================================================
    describe("2.2 Loan Submission & Atomic Disbursement Engine", () => {
      let createdLoanId: string;

      it("submits loan request atomically and places it in pending_approval", async () => {
        await asUser(userEmpEligibleA);
        const res = await db.query<{ submit_loan_request_atomic: { loan_id: string; status: string; request_id: string } }>(
          `SELECT public.submit_loan_request_atomic(
            'personal_advance',
            12000,
            6,
            'سلفة لظروف شخصية طارئة'
          )`
        );
        createdLoanId = res.rows[0].submit_loan_request_atomic.loan_id;
        expect(createdLoanId).toBeDefined();
        expect(res.rows[0].submit_loan_request_atomic.status).toBe("pending_approval");
      });

      it("blocks disbursement if bank account has insufficient balance or wrong company", async () => {
        // Approve loan as admin/system
        await asUser(null, "postgres");
        await db.exec(`UPDATE public.loans SET status = 'approved' WHERE id = '${createdLoanId}';`);

        await asUser(userPayrollA);
        // Attempt disbursement using Company B's bank account
        await expect(
          db.query(`SELECT public.disburse_loan_atomic('${createdLoanId}', '${bankAccountB}')`)
        ).rejects.toThrow(/الحساب البنكي المحدد غير موجود أو لا يتبع لمنشأة السلفة/);
      });

      it("disburses loan atomically: debits bank balance, generates installment schedule, logs audit", async () => {
        await asUser(userPayrollA);
        const res = await db.query<{ disburse_loan_atomic: { status: string; installments_created: number; new_bank_balance: number } }>(
          `SELECT public.disburse_loan_atomic(
            '${createdLoanId}',
            '${bankAccountA}',
            'BANK-REF-LOAN-999',
            'صرف سلفة شخصية معتمدة'
          )`
        );

        expect(res.rows[0].disburse_loan_atomic.status).toBe("active");
        expect(res.rows[0].disburse_loan_atomic.installments_created).toBe(6);
        expect(res.rows[0].disburse_loan_atomic.new_bank_balance).toBe(488000.00); // 500,000 - 12,000

        // Verify installments table contains 6 installments of 2,000 SAR each
        const installments = await db.query<{ installment_number: number; principal_amount: number; status: string }>(
          `SELECT installment_number, principal_amount, status FROM public.loan_installments WHERE loan_id = '${createdLoanId}' ORDER BY installment_number`
        );
        expect(installments.rows.length).toBe(6);
        expect(Number(installments.rows[0].principal_amount)).toBe(2000);
        expect(installments.rows[0].status).toBe("pending");

        // Verify disbursement record
        const disbursement = await db.query(
          `SELECT * FROM public.loan_disbursements WHERE loan_id = '${createdLoanId}'`
        );
        expect(disbursement.rows.length).toBe(1);
      });

      it("blocks submitting a second loan while an active loan exists", async () => {
        await asUser(userEmpEligibleA);
        await expect(
          db.query(`SELECT public.submit_loan_request_atomic('personal_advance', 3000, 3, 'سلفة ثانية')`)
        ).rejects.toThrow(/يوجد سلفة سارية أو قيد الاعتماد بالفعل/);
      });

      it("recovers loan installments idempotently during payroll run", async () => {
        // Query installment #1 to get its actual due period
        const inst1 = await db.query<{ due_payroll_period: string }>(
          `SELECT due_payroll_period FROM public.loan_installments WHERE loan_id = '${createdLoanId}' AND installment_number = 1`
        );
        const [targetYear, targetMonth] = inst1.rows[0].due_payroll_period.split("-").map(Number);
        const testPayrollRunId = "cc000000-0000-0000-0000-000000000001";

        // Create payroll run for target month and link employee
        await asUser(null, "postgres");
        await db.exec(`
          INSERT INTO public.payroll_runs (
            id, company_id, period_year, period_month, status, total_employees, total_net_salary
          ) VALUES (
            '${testPayrollRunId}', '${companyA}', ${targetYear}, ${targetMonth}, 'draft', 1, 8000.00
          );

          INSERT INTO public.payroll_run_employees (
            payroll_run_id, company_id, employee_id, employee_no, employee_name_ar, net_salary, iban
          ) VALUES (
            '${testPayrollRunId}', '${companyA}', '${empIdEligibleA}', 'EMP-001', 'أحمد الغامدي', 8000.00, 'SA1111111111111111111111'
          );
        `);
        await asUser(userPayrollA);

        // Recover installments for this payroll period
        const res = await db.query<{ recover_loan_installments_for_payroll_run: { recovered_count: number; recovered_amount: number } }>(
          `SELECT public.recover_loan_installments_for_payroll_run('${testPayrollRunId}')`
        );

        expect(res.rows[0].recover_loan_installments_for_payroll_run.recovered_count).toBe(1);
        expect(Number(res.rows[0].recover_loan_installments_for_payroll_run.recovered_amount)).toBe(2000.00);

        // Verify remaining loan balance reduced by 2,000 (12,000 -> 10,000)
        const loan = await db.query<{ remaining_balance: number; paid_installments: number }>(
          `SELECT remaining_balance, paid_installments FROM public.loans WHERE id = '${createdLoanId}'`
        );
        expect(Number(loan.rows[0].remaining_balance)).toBe(10000.00);
        expect(loan.rows[0].paid_installments).toBe(1);

        // Re-executing recovery for the same run is strictly idempotent (0 additional recovered)
        const secondRun = await db.query<{ recover_loan_installments_for_payroll_run: { recovered_count: number } }>(
          `SELECT public.recover_loan_installments_for_payroll_run('${testPayrollRunId}')`
        );
        expect(secondRun.rows[0].recover_loan_installments_for_payroll_run.recovered_count).toBe(0);

        // Mark payroll run as approved so it doesn't block final settlement in subsequent tests
        await asUser(null, "postgres");
        await db.exec(`UPDATE public.payroll_runs SET status = 'approved' WHERE id = '${testPayrollRunId}';`);
        await asUser(userPayrollA);
      });

      it("allows early loan payoff without financial penalty", async () => {
        await asUser(userPayrollA);
        const res = await db.query<{ settle_loan_early_atomic: { status: string; settled_amount: number } }>(
          `SELECT public.settle_loan_early_atomic(
            '${createdLoanId}',
            'bank_transfer',
            'REC-EARLY-999',
            'تم السداد المبكر نقداً من الموظف'
          )`
        );

        expect(res.rows[0].settle_loan_early_atomic.status).toBe("closed");
        expect(Number(res.rows[0].settle_loan_early_atomic.settled_amount)).toBe(10000.00);

        // Verify loan status is closed and balance is zero
        const loan = await db.query<{ status: string; remaining_balance: number }>(
          `SELECT status, remaining_balance FROM public.loans WHERE id = '${createdLoanId}'`
        );
        expect(loan.rows[0].status).toBe("closed");
        expect(Number(loan.rows[0].remaining_balance)).toBe(0);

        // Verify all remaining installments are now early_settled
        const pendingInstallments = await db.query(
          `SELECT * FROM public.loan_installments WHERE loan_id = '${createdLoanId}' AND status = 'pending'`
        );
        expect(pendingInstallments.rows.length).toBe(0);
      });
    });

    // ========================================================================
    // 2.3 EMPLOYEE SEPARATION & CLEARANCE ENGINE
    // ========================================================================
    describe("2.3 Employee Separation, Clearance Checklist & Asset Integration", () => {
      let separationId: string;
      const laptopAssetId = "fa000000-0000-0000-0000-000000000001";

      it("rejects resignation with past last working day", async () => {
        await asUser(userEmpEligibleA);
        await expect(
          db.query(`SELECT public.submit_resignation_atomic('2020-01-01'::date, 'رغبة في الانتقال')`)
        ).rejects.toThrow(/سابقاً لتاريخ اليوم/);
      });

      it("initiates administrative separation and automatically generates clearance items including assigned hardware assets", async () => {
        await asUser(userHrAdminA);
        const res = await db.query<{ initiate_separation_hr_atomic: { separation_id: string; clearance_items_count: number } }>(
          `SELECT public.initiate_separation_hr_atomic(
            '${empIdEligibleA}',
            'resignation',
            (CURRENT_DATE + INTERVAL '30 days')::date,
            'استقالة مع إشعار نظامي',
            true
          )`
        );

        separationId = res.rows[0].initiate_separation_hr_atomic.separation_id;
        expect(separationId).toBeDefined();
        expect(res.rows[0].initiate_separation_hr_atomic.clearance_items_count).toBeGreaterThanOrEqual(4);

        // Verify asset clearance item was created and linked to the MacBook
        const assetItem = await db.query<{ id: string; category: string; asset_id: string; status: string }>(
          `SELECT id, category, asset_id, status FROM public.clearance_items WHERE separation_id = '${separationId}' AND asset_id = '${laptopAssetId}'`
        );
        expect(assetItem.rows.length).toBe(1);
        expect(assetItem.rows[0].status).toBe("pending");
      });

      it("blocks final settlement calculation if unreturned hardware assets exist", async () => {
        await asUser(userHrAdminA);
        // Hardware asset is still 'assigned'
        await expect(
          db.query(`SELECT public.calculate_final_settlement_atomic('${empIdEligibleA}', CURRENT_DATE, 'resignation')`)
        ).rejects.toThrow(/لا يمكن احتساب المخالصة لوجود عهد/);
      });

      it("clears hardware asset clearance item and automatically updates hardware_assets status to available", async () => {
        await asUser(userHrAdminA);
        const assetItem = await db.query<{ id: string }>(
          `SELECT id FROM public.clearance_items WHERE separation_id = '${separationId}' AND asset_id = '${laptopAssetId}'`
        );
        const itemId = assetItem.rows[0].id;

        const res = await db.query<{ update_clearance_item_atomic: { status: string } }>(
          `SELECT public.update_clearance_item_atomic('${itemId}', 'cleared', 'تم فحص وتسليم الجهاز بحالة ممتازة')`
        );
        expect(res.rows[0].update_clearance_item_atomic.status).toBe("cleared");

        // Verify hardware asset is now available and unassigned
        const asset = await db.query<{ status: string; assigned_to_employee_id: string | null }>(
          `SELECT status, assigned_to_employee_id FROM public.hardware_assets WHERE id = '${laptopAssetId}'`
        );
        expect(asset.rows[0].status).toBe("available");
        expect(asset.rows[0].assigned_to_employee_id).toBeNull();
      });

      it("calculates final settlement successfully after asset clearance", async () => {
        await asUser(userHrAdminA);
        const res = await db.query<{ calculate_final_settlement_atomic: { ok: boolean; eosb_amount: number; net_settlement_amount: number } }>(
          `SELECT public.calculate_final_settlement_atomic('${empIdEligibleA}', CURRENT_DATE, 'resignation')`
        );
        expect(res.rows[0].calculate_final_settlement_atomic.ok).toBe(true);
        expect(res.rows[0].calculate_final_settlement_atomic.eosb_amount).toBeGreaterThan(0);
      });

      it("blocks offboarding finalization if other clearance items are still pending", async () => {
        await asUser(userHrAdminA);
        await expect(
          db.query(`SELECT public.finalize_employee_offboarding_atomic('${separationId}')`)
        ).rejects.toThrow(/بنود إخلاء طرف غير مكتملة/);
      });

      it("finalizes offboarding when all clearance items are cleared and settlement is approved", async () => {
        // 1. Mark all remaining clearance items as cleared
        await asUser(null, "postgres");
        await db.exec(`
          UPDATE public.clearance_items
          SET status = 'cleared', completed_at = now()
          WHERE separation_id = '${separationId}';

          UPDATE public.employee_separations
          SET clearance_status = 'completed'
          WHERE id = '${separationId}';
        `);

        // 2. Insert and link approved final settlement
        await db.exec(`
          INSERT INTO public.settlements (
            id, employee_id, separation_id, termination_date, service_years, eosb_amount, net_settlement_amount, status
          ) VALUES (
            '90000000-0000-0000-0000-000000000001', '${empIdEligibleA}', '${separationId}', CURRENT_DATE, 3, 10500.00, 10500.00, 'approved'
          );

          UPDATE public.employee_separations
          SET settlement_id = '90000000-0000-0000-0000-000000000001',
              settlement_status = 'approved'
          WHERE id = '${separationId}';
        `);

        await asUser(userHrAdminA);

        // 3. Finalize offboarding
        const res = await db.query<{ finalize_employee_offboarding_atomic: { status: string; employee_status: string; employee_id: string } }>(
          `SELECT public.finalize_employee_offboarding_atomic('${separationId}')`
        );

        expect(res.rows[0].finalize_employee_offboarding_atomic.status).toBe("finalized");
        expect(res.rows[0].finalize_employee_offboarding_atomic.employee_status).toBe("terminated");

        // Verify employee record is preserved in database with status = 'terminated' (NOT deleted)
        const emp = await db.query<{ id: string; status: string }>(
          `SELECT id, status FROM public.employees WHERE id = '${empIdEligibleA}'`
        );
        expect(emp.rows.length).toBe(1);
        expect(emp.rows[0].status).toBe("terminated");

        // Verify separation record is marked finalized
        const sep = await db.query<{ status: string; finalized_at: string }>(
          `SELECT status, finalized_at FROM public.employee_separations WHERE id = '${separationId}'`
        );
        expect(sep.rows[0].status).toBe("finalized");
        expect(sep.rows[0].finalized_at).not.toBeNull();
      });
    });

    // ========================================================================
    // 2.4 CROSS-TENANT RLS ISOLATION TESTS
    // ========================================================================
    describe("2.4 Cross-Tenant RLS Isolation", () => {
      it("Company B user cannot view Company A loans or policies", async () => {
        await asUser(userHrB);

        const policies = await db.query(`SELECT * FROM public.company_loan_policies WHERE company_id = '${companyA}'`);
        expect(policies.rows.length).toBe(0);

        const loans = await db.query(`SELECT * FROM public.loans WHERE company_id = '${companyA}'`);
        expect(loans.rows.length).toBe(0);

        const separations = await db.query(`SELECT * FROM public.employee_separations WHERE company_id = '${companyA}'`);
        expect(separations.rows.length).toBe(0);
      });
    });
  });
});
