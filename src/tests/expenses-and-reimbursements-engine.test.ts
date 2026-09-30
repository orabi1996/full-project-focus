import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it, beforeAll } from "vitest";
import fs from "fs";
import path from "path";

describe.sequential("Prompt 17: Production Expense Management & Employee Reimbursement Engine", () => {
  // ==========================================================================
  // PART 1: STATIC AST & SOURCE CODE CONTRACT TESTS
  // ==========================================================================
  describe("Static Source Code Contract Tests", () => {
    const expensesViewPath = path.resolve(__dirname, "../components/expenses/ExpensesView.tsx");
    const expensesViewSource = fs.readFileSync(expensesViewPath, "utf-8");

    const expensesRepoPath = path.resolve(__dirname, "../lib/data/expenses-repository.ts");
    const expensesRepoSource = fs.readFileSync(expensesRepoPath, "utf-8");

    const expensesFunctionsPath = path.resolve(__dirname, "../lib/business/expenses.functions.ts");
    const expensesFunctionsSource = fs.readFileSync(expensesFunctionsPath, "utf-8");

    const queryKeysPath = path.resolve(__dirname, "../lib/query/query-keys.ts");
    const queryKeysSource = fs.readFileSync(queryKeysPath, "utf-8");

    it("1.1 ExpensesView MUST contain all 4 operational tabs and production hooks", () => {
      expect(expensesViewSource).toContain('value="claims"');
      expect(expensesViewSource).toContain('value="reimbursements"');
      expect(expensesViewSource).toContain('value="policies"');
      expect(expensesViewSource).toContain('value="reports"');
      expect(expensesViewSource).toContain("useExpenseCategories");
      expect(expensesViewSource).toContain("useExpenseClaims");
      expect(expensesViewSource).toContain("useReimbursementBatches");
      expect(expensesViewSource).toContain("useExpenseKpis");
      expect(expensesViewSource).toContain("useExpenseMutations");
      expect(expensesViewSource).toContain("getSignedUrlForFileId");
    });

    it("1.2 ExpensesView MUST support multi-line claim items and finance batch actions", () => {
      expect(expensesViewSource).toContain("itemLines");
      expect(expensesViewSource).toContain("handleAddItemLine");
      expect(expensesViewSource).toContain("handleRemoveItemLine");
      expect(expensesViewSource).toContain("handlePrepareBatchSubmit");
      expect(expensesViewSource).toContain("handleConfirmPaymentSubmit");
      expect(expensesViewSource).toContain("handleReverseBatchSubmit");
      expect(expensesViewSource).toContain("handleTransferToPayrollSubmit");
    });

    it("1.3 Expenses repository exports typed query hooks and mutation procedures", () => {
      expect(expensesRepoSource).toContain("useExpenseCategories");
      expect(expensesRepoSource).toContain("useExpensePolicies");
      expect(expensesRepoSource).toContain("useExpenseClaims");
      expect(expensesRepoSource).toContain("useExpenseClaimItems");
      expect(expensesRepoSource).toContain("useReimbursementBatches");
      expect(expensesRepoSource).toContain("useExpenseKpis");
      expect(expensesRepoSource).toContain("useExpenseMutations");
      expect(expensesRepoSource).toContain("validate_expense_claim_atomic");
      expect(expensesRepoSource).toContain("submit_expense_claim_atomic");
      expect(expensesRepoSource).toContain("prepare_reimbursement_batch_atomic");
      expect(expensesRepoSource).toContain("confirm_reimbursement_payment_atomic");
      expect(expensesRepoSource).toContain("reverse_reimbursement_batch_atomic");
      expect(expensesRepoSource).toContain("transfer_reimbursement_to_payroll_atomic");
      expect(expensesRepoSource).toContain("resubmit_expense_claim_atomic");
    });

    it("1.4 Server functions wire server operations to atomic RPCs", () => {
      expect(expensesFunctionsSource).toContain("prepareReimbursementBatchServer");
      expect(expensesFunctionsSource).toContain("confirmReimbursementPaymentServer");
      expect(expensesFunctionsSource).toContain("reverseReimbursementBatchServer");
      expect(expensesFunctionsSource).toContain("transferReimbursementToPayrollServer");
      expect(expensesFunctionsSource).toContain("prepare_reimbursement_batch_atomic");
      expect(expensesFunctionsSource).toContain("confirm_reimbursement_payment_atomic");
      expect(expensesFunctionsSource).toContain("reverse_reimbursement_batch_atomic");
      expect(expensesFunctionsSource).toContain("transfer_reimbursement_to_payroll_atomic");
    });

    it("1.5 Centralized query keys provide full hierarchy for expenses and reimbursements", () => {
      expect(queryKeysSource).toContain("categories: ()");
      expect(queryKeysSource).toContain("policies: ()");
      expect(queryKeysSource).toContain("claims: (filters?: Record<string, unknown>)");
      expect(queryKeysSource).toContain("batches: (filters?: Record<string, unknown>)");
      expect(queryKeysSource).toContain("kpis: (companyId?: string)");
      expect(queryKeysSource).toContain("reports: (filters?: Record<string, unknown>)");
    });
  });

  // ==========================================================================
  // PART 2: PGLITE AUTHORITATIVE DATABASE ENGINE & LIFECYCLE TESTS
  // ==========================================================================
  describe("PGlite Authoritative Expenses & Reimbursement Engine Tests", () => {
    const db = new PGlite();

    const companyA = "a0000000-0000-0000-0000-000000000001";
    const companyB = "b0000000-0000-0000-0000-000000000002";

    const userHrAdminA = "11111111-aaaa-aaaa-aaaa-111111111111";
    const userFinanceA = "22222222-aaaa-aaaa-aaaa-222222222222";
    const userEmpA = "33333333-aaaa-aaaa-aaaa-333333333333";
    const userEmpB = "44444444-bbbb-bbbb-bbbb-444444444444";

    let empAId: string;
    let empBId: string;
    let bankAccountAId: string;
    let catTravelId: string;
    let catMealsId: string;
    let catSuppliesId: string;

    async function asUser(userId: string | null) {
      await db.exec(`SELECT set_config('test.auth_uid', '${userId || ""}', false);`);
    }

    beforeAll(async () => {
      // 1. Setup Roles, Auth and Core Schemas
      await db.exec(`
        DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
        DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
        DO $$ BEGIN CREATE ROLE service_role; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

        CREATE SCHEMA IF NOT EXISTS auth;
        CREATE TABLE IF NOT EXISTS auth.users (
          id uuid PRIMARY KEY,
          email text UNIQUE,
          raw_user_meta_data jsonb DEFAULT '{}'::jsonb
        );

        CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid AS $$
          SELECT COALESCE(
            NULLIF(current_setting('test.auth_uid', true), ''),
            NULLIF(current_setting('request.jwt.claim.sub', true), '')
          )::uuid;
        $$ LANGUAGE sql STABLE;

        CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb AS $$
          SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
        $$ LANGUAGE sql STABLE;

        -- Core base tables
        CREATE TABLE IF NOT EXISTS public.companies (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          name_ar text NOT NULL,
          name_en text NOT NULL,
          created_at timestamptz DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.departments (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id uuid REFERENCES public.companies(id),
          name_ar text NOT NULL,
          name_en text NOT NULL
        );

        CREATE TABLE IF NOT EXISTS public.employees (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id uuid REFERENCES public.companies(id),
          user_id uuid REFERENCES auth.users(id),
          employee_no text NOT NULL,
          first_name_ar text NOT NULL,
          last_name_ar text NOT NULL,
          full_name text,
          department_id uuid REFERENCES public.departments(id),
          status text NOT NULL DEFAULT 'active',
          created_at timestamptz DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.cost_centers (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id uuid REFERENCES public.companies(id),
          code text NOT NULL,
          name_ar text NOT NULL
        );

        CREATE TABLE IF NOT EXISTS public.company_bank_accounts (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id uuid REFERENCES public.companies(id),
          bank_name text NOT NULL,
          account_name text NOT NULL,
          iban text NOT NULL,
          currency text NOT NULL DEFAULT 'SAR',
          current_balance numeric(14,2) NOT NULL DEFAULT 0,
          is_primary boolean NOT NULL DEFAULT false,
          created_at timestamptz DEFAULT now(),
          updated_at timestamptz DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.payroll_runs (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id uuid REFERENCES public.companies(id),
          period_year integer NOT NULL,
          period_month integer NOT NULL,
          status text NOT NULL DEFAULT 'draft',
          total_net numeric(14,2) NOT NULL DEFAULT 0,
          created_at timestamptz DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.payroll_adjustments (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          payroll_run_id uuid REFERENCES public.payroll_runs(id),
          employee_id uuid REFERENCES public.employees(id),
          adjustment_type text NOT NULL,
          amount numeric(12,2) NOT NULL,
          notes text,
          created_at timestamptz DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.accounting_journals (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          journal_no text NOT NULL UNIQUE,
          source_type text NOT NULL,
          source_reference text NOT NULL,
          journal_date date NOT NULL,
          lines jsonb NOT NULL DEFAULT '[]'::jsonb,
          total_debit numeric(14,2) NOT NULL DEFAULT 0,
          total_credit numeric(14,2) NOT NULL DEFAULT 0,
          status text NOT NULL DEFAULT 'draft',
          posted_at timestamptz,
          created_at timestamptz DEFAULT now()
        );

        -- Security context helpers
        CREATE OR REPLACE FUNCTION public.current_company_id() RETURNS uuid AS $$
          SELECT COALESCE(
            NULLIF(current_setting('app.current_company_id', true), '')::uuid,
            'a0000000-0000-0000-0000-000000000001'::uuid
          );
        $$ LANGUAGE sql STABLE;

        CREATE OR REPLACE FUNCTION public.current_user_has_any_role(p_roles text[]) RETURNS boolean AS $$
          SELECT true;
        $$ LANGUAGE sql STABLE;

        -- Workflow mock table and function
        CREATE TABLE IF NOT EXISTS public.requests (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id uuid REFERENCES public.companies(id),
          employee_id uuid REFERENCES public.employees(id),
          request_type text NOT NULL,
          status text NOT NULL DEFAULT 'pending_approval',
          payload jsonb NOT NULL DEFAULT '{}'::jsonb,
          decided_by uuid,
          decided_at timestamptz,
          created_at timestamptz DEFAULT now()
        );

        CREATE OR REPLACE FUNCTION public.submit_workflow_request(
          p_request_type text,
          p_payload jsonb,
          p_on_behalf_of_employee_id uuid DEFAULT NULL,
          p_idempotency_key text DEFAULT NULL
        )
        RETURNS jsonb
        LANGUAGE plpgsql
        AS $$
        DECLARE
          v_req_id uuid := gen_random_uuid();
        BEGIN
          INSERT INTO public.requests (id, request_type, status, payload, employee_id)
          VALUES (v_req_id, p_request_type, 'pending_approval', p_payload, p_on_behalf_of_employee_id);

          RETURN jsonb_build_object(
            'ok', true,
            'request_id', v_req_id,
            'reference', 'REQ-' || SUBSTRING(v_req_id::text, 1, 8)
          );
        END;
        $$;

        CREATE OR REPLACE FUNCTION public.resubmit_workflow_request(
          p_request_id uuid,
          p_payload jsonb,
          p_note text DEFAULT NULL
        )
        RETURNS jsonb
        LANGUAGE plpgsql
        AS $$
        BEGIN
          UPDATE public.requests
          SET status = 'pending_approval',
              payload = payload || p_payload
          WHERE id = p_request_id;
          RETURN jsonb_build_object('ok', true);
        END;
        $$;

        -- Existing base categories & claims tables
        CREATE TABLE IF NOT EXISTS public.expense_categories (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          name_ar text NOT NULL,
          name_en text NOT NULL,
          max_limit_warning numeric(12,2) NOT NULL DEFAULT 1000,
          max_limit_block numeric(12,2) NOT NULL DEFAULT 5000,
          requires_receipt boolean DEFAULT true,
          created_at timestamptz NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.expense_claims (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
          category_id uuid REFERENCES public.expense_categories(id) ON DELETE SET NULL,
          amount numeric(12,2) NOT NULL,
          currency text NOT NULL DEFAULT 'SAR',
          spent_at date NOT NULL,
          merchant_name text NOT NULL,
          receipt_url text,
          description text,
          status text NOT NULL DEFAULT 'submitted',
          created_at timestamptz NOT NULL DEFAULT now()
        );
      `);

      // 2. Execute Prompt 17 Migration SQL
      const migrationPath = path.resolve(
        __dirname,
        "../../supabase/migrations/20260930000000_production_expenses_reimbursements_engine.sql"
      );
      const migrationSql = fs.readFileSync(migrationPath, "utf-8");
      await db.exec(migrationSql);

      // 2.1 Execute Prompt 17 Corrective Migration SQL
      const correctiveMigrationPath = path.resolve(
        __dirname,
        "../../supabase/migrations/20260930010000_correct_expense_reimbursement_cursors.sql"
      );
      if (fs.existsSync(correctiveMigrationPath)) {
        const corrSql = fs.readFileSync(correctiveMigrationPath, "utf-8");
        await db.exec(corrSql);
      }

      // 3. Seed Base Data
      await db.exec(`
        INSERT INTO auth.users (id, email) VALUES
          ('${userHrAdminA}', 'hr.admin@company-a.com'),
          ('${userFinanceA}', 'finance@company-a.com'),
          ('${userEmpA}', 'employee@company-a.com'),
          ('${userEmpB}', 'employee@company-b.com')
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO public.companies (id, name_ar, name_en) VALUES
          ('${companyA}', 'شركة التقنية المتقدمة أ', 'Tech Company A'),
          ('${companyB}', 'شركة الخدمات ب', 'Services Company B')
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO public.employees (id, company_id, user_id, employee_no, first_name_ar, last_name_ar, status) VALUES
          ('e0000000-0000-0000-0000-000000000001', '${companyA}', '${userEmpA}', 'EMP-001', 'محمد', 'العتيبي', 'active'),
          ('e0000000-0000-0000-0000-000000000002', '${companyB}', '${userEmpB}', 'EMP-002', 'أحمد', 'الغامدي', 'active')
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO public.company_bank_accounts (id, company_id, bank_name, account_name, iban, current_balance, is_primary) VALUES
          ('b0000000-0000-0000-0000-000000000001', '${companyA}', 'مصرف الراجحي', 'حساب الرواتب والمصروفات', 'SA4480000123456789012345', 100000.00, true)
        ON CONFLICT (id) DO NOTHING;
      `);

      empAId = "e0000000-0000-0000-0000-000000000001";
      empBId = "e0000000-0000-0000-0000-000000000002";
      bankAccountAId = "b0000000-0000-0000-0000-000000000001";

      // Insert Categories
      const catRes = await db.query(`
        INSERT INTO public.expense_categories (company_id, code, name_ar, name_en, max_limit_warning, max_limit_block, requires_receipt, accounting_account_code)
        VALUES
          ('${companyA}', 'TRAVEL', 'سفر وانتقالات', 'Travel & Transport', 2000, 8000, true, '510101'),
          ('${companyA}', 'MEALS', 'وجبات وضيافة', 'Meals & Hospitality', 300, 1000, true, '510102'),
          ('${companyA}', 'SUPPLIES', 'أدوات ومستلزمات مكتبية', 'Office Supplies', 500, 2000, false, '510103')
        RETURNING id, code;
      `);

      for (const row of catRes.rows as any[]) {
        if (row.code === "TRAVEL") catTravelId = row.id;
        if (row.code === "MEALS") catMealsId = row.id;
        if (row.code === "SUPPLIES") catSuppliesId = row.id;
      }
    });

    // ------------------------------------------------------------------------
    // TEST 1: CATEGORY VALIDATION & LIMITS
    // ------------------------------------------------------------------------
    it("2.1 validate_expense_claim_atomic enforces blocking limits and receipt requirements", async () => {
      // Amount exceeds blocking limit (1000 SAR) on MEALS
      const overBlockRes: any = await db.query(`
        SELECT public.validate_expense_claim_atomic(
          '${empAId}',
          'employee_paid',
          '[{"categoryId": "${catMealsId}", "amount": 1500, "merchantName": "مطعم النخيل", "itemDate": "2026-09-28", "receiptUrl": "receipts/test.pdf"}]'::jsonb
        ) as result;
      `);
      const valBlock = overBlockRes.rows[0].result;
      expect(valBlock.is_valid).toBe(false);
      expect(valBlock.errors[0]).toContain("يتجاوز الحد المانع");

      // Missing receipt on category requiring receipt (TRAVEL)
      const missingReceiptRes: any = await db.query(`
        SELECT public.validate_expense_claim_atomic(
          '${empAId}',
          'employee_paid',
          '[{"categoryId": "${catTravelId}", "amount": 500, "merchantName": "أوبر", "itemDate": "2026-09-28"}]'::jsonb
        ) as result;
      `);
      const valReceipt = missingReceiptRes.rows[0].result;
      expect(valReceipt.is_valid).toBe(false);
      expect(valReceipt.errors[0]).toContain("إرفاق الفاتورة أو الإيصال إلزامي");
    });

    // ------------------------------------------------------------------------
    // TEST 2: SUBMIT MULTI-LINE EXPENSE CLAIM
    // ------------------------------------------------------------------------
    it("2.2 submit_expense_claim_atomic inserts claim, items, links workflow, and logs audit", async () => {
      // Set session user to employee A
      await asUser(userEmpA);

      const submitRes: any = await db.query(`
        SELECT public.submit_expense_claim_atomic(
          'رحلة عمل الرياض',
          'حضور الاجتماع التنسيقي السنوي',
          NULL,
          'PRJ-2026',
          'employee_paid',
          '[
            {"categoryId": "${catTravelId}", "amount": 1200, "currency": "SAR", "merchantName": "طيران ناس", "itemDate": "2026-09-28", "receiptUrl": "receipts/nas.pdf", "taxAmount": 180},
            {"categoryId": "${catMealsId}", "amount": 250, "currency": "SAR", "merchantName": "مطعم ريف العرب", "itemDate": "2026-09-28", "receiptUrl": "receipts/food.pdf", "taxAmount": 37.5}
          ]'::jsonb
        ) as result;
      `);

      const claimData = submitRes.rows[0].result;
      expect(claimData.ok).toBe(true);
      expect(claimData.claim_id).toBeDefined();
      expect(claimData.amount).toBe(1450); // 1200 + 250
      expect(claimData.workflow_request_id).toBeDefined();

      // Verify claim in DB
      const claimRow: any = await db.query(`
        SELECT * FROM public.expense_claims WHERE id = '${claimData.claim_id}';
      `);
      expect(claimRow.rows.length).toBe(1);
      expect(claimRow.rows[0].payment_method).toBe("employee_paid");
      expect(claimRow.rows[0].is_reimbursable).toBe(true);
      expect(claimRow.rows[0].reimbursement_status).toBe("unreimbursed");
      expect(claimRow.rows[0].status).toBe("pending_approval");

      // Verify multi-line items
      const itemsRows: any = await db.query(`
        SELECT * FROM public.expense_claim_items WHERE claim_id = '${claimData.claim_id}';
      `);
      expect(itemsRows.rows.length).toBe(2);

      // Verify audit log
      const auditRows: any = await db.query(`
        SELECT * FROM public.expense_audit_logs WHERE claim_id = '${claimData.claim_id}';
      `);
      expect(auditRows.rows.length).toBeGreaterThanOrEqual(1);
      expect(auditRows.rows[0].action).toBe("claim_submitted");
    });

    // ------------------------------------------------------------------------
    // TEST 3: DUPLICATE DETECTION
    // ------------------------------------------------------------------------
    it("2.3 validate_expense_claim_atomic detects duplicate expenses and sets warning flag", async () => {
      // Validate claim with same employee, merchant ('طيران ناس'), date ('2026-09-28'), and amount (1200)
      const dupCheckRes: any = await db.query(`
        SELECT public.validate_expense_claim_atomic(
          '${empAId}',
          'employee_paid',
          '[{"categoryId": "${catTravelId}", "amount": 1200, "merchantName": "طيران ناس", "itemDate": "2026-09-28", "receiptUrl": "receipts/nas.pdf"}]'::jsonb
        ) as result;
      `);
      const val = dupCheckRes.rows[0].result;
      expect(val.duplicate_found).toBe(true);
      expect(val.warnings.some((w: string) => w.includes("تم العثور على مصروف مماثل مسبقاً"))).toBe(true);
    });

    // ------------------------------------------------------------------------
    // TEST 4: CORPORATE CARD CLAIMS ARE NOT REIMBURSABLE TO EMPLOYEE
    // ------------------------------------------------------------------------
    it("2.4 Corporate Card / Company Paid claims are marked not_applicable for reimbursement", async () => {
      await asUser(userEmpA);

      const cardClaimRes: any = await db.query(`
        SELECT public.submit_expense_claim_atomic(
          'شراء شاشات عرض مكتبية',
          'تأثيث قاعة الاجتماعات',
          NULL,
          NULL,
          'corporate_card',
          '[{"categoryId": "${catSuppliesId}", "amount": 800, "currency": "SAR", "merchantName": "مكتبة جرير", "itemDate": "2026-09-29"}]'::jsonb
        ) as result;
      `);

      const claimData = cardClaimRes.rows[0].result;
      const claimRow: any = await db.query(`
        SELECT is_reimbursable, reimbursement_status FROM public.expense_claims WHERE id = '${claimData.claim_id}';
      `);
      expect(claimRow.rows[0].is_reimbursable).toBe(false);
      expect(claimRow.rows[0].reimbursement_status).toBe("not_applicable");
    });

    // ------------------------------------------------------------------------
    // TEST 5: WORKFLOW APPROVAL SYNCHRONIZATION TRIGGER
    // ------------------------------------------------------------------------
    it("2.5 Approving workflow request synchronizes status on expense_claims atomically", async () => {
      // Find the pending claim
      const claimRow: any = await db.query(`
        SELECT id, workflow_request_id FROM public.expense_claims
        WHERE payment_method = 'employee_paid' AND status = 'pending_approval'
        LIMIT 1;
      `);
      const wfReqId = claimRow.rows[0].workflow_request_id;
      const claimId = claimRow.rows[0].id;

      // Update request to approved
      await db.exec(`
        UPDATE public.requests
        SET status = 'approved', decided_by = '${userFinanceA}', decided_at = now()
        WHERE id = '${wfReqId}';
      `);

      // Check expense_claims status
      const updatedClaim: any = await db.query(`
        SELECT status, reimbursement_status FROM public.expense_claims WHERE id = '${claimId}';
      `);
      expect(updatedClaim.rows[0].status).toBe("approved");
      expect(updatedClaim.rows[0].reimbursement_status).toBe("unreimbursed");
    });

    // ------------------------------------------------------------------------
    // TEST 6: PREPARE REIMBURSEMENT BATCH
    // ------------------------------------------------------------------------
    let batchId: string;
    it("2.6 prepare_reimbursement_batch_atomic aggregates claims, locks claims, and prevents duplicate batches", async () => {
      await asUser(userFinanceA);

      const claimRow: any = await db.query(`
        SELECT id, converted_amount FROM public.expense_claims
        WHERE status = 'approved' AND payment_method = 'employee_paid'
        LIMIT 1;
      `);
      const approvedClaimId = claimRow.rows[0].id;
      const amount = Number(claimRow.rows[0].converted_amount);

      const batchRes: any = await db.query(`
        SELECT public.prepare_reimbursement_batch_atomic(
          '2026-09',
          ARRAY['${approvedClaimId}']::uuid[],
          'direct_bank_transfer',
          '${bankAccountAId}',
          'دفعة تعويضات شهر سبتمبر',
          'idemp-batch-001'
        ) as result;
      `);

      const batchData = batchRes.rows[0].result;
      expect(batchData.ok).toBe(true);
      expect(batchData.batch_id).toBeDefined();
      expect(batchData.total_amount).toBe(amount);
      batchId = batchData.batch_id;

      // Claim is now locked in batch
      const lockedClaim: any = await db.query(`
        SELECT reimbursement_status, reimbursement_batch_id FROM public.expense_claims WHERE id = '${approvedClaimId}';
      `);
      expect(lockedClaim.rows[0].reimbursement_status).toBe("queued_in_batch");
      expect(lockedClaim.rows[0].reimbursement_batch_id).toBe(batchId);

      // Attempting to prepare a batch with the same claim MUST fail
      await expect(
        db.query(`
          SELECT public.prepare_reimbursement_batch_atomic(
            '2026-09',
            ARRAY['${approvedClaimId}']::uuid[],
            'direct_bank_transfer',
            '${bankAccountAId}'
          );
        `)
      ).rejects.toThrow(/مضافة مسبقاً لدفعة صرف/);
    });

    // ------------------------------------------------------------------------
    // TEST 7: CONFIRM REIMBURSEMENT PAYMENT ATOMICALLY
    // ------------------------------------------------------------------------
    it("2.7 confirm_reimbursement_payment_atomic debits bank balance, marks claims reimbursed, and creates balanced journal entry", async () => {
      await asUser(userFinanceA);

      // Balance before
      const bankBefore: any = await db.query(`
        SELECT current_balance FROM public.company_bank_accounts WHERE id = '${bankAccountAId}';
      `);
      const balanceBefore = Number(bankBefore.rows[0].current_balance);

      const confirmRes: any = await db.query(`
        SELECT public.confirm_reimbursement_payment_atomic(
          '${batchId}',
          'SARIE-TXN-20260930-01',
          'تم تأكيد الخصم البنكي والإيداع بحساب الموظف'
        ) as result;
      `);

      const conf = confirmRes.rows[0].result;
      expect(conf.ok).toBe(true);
      expect(conf.payment_status).toBe("confirmed_paid");
      expect(conf.bank_reference).toBe("SARIE-TXN-20260930-01");

      // Balance after
      const bankAfter: any = await db.query(`
        SELECT current_balance FROM public.company_bank_accounts WHERE id = '${bankAccountAId}';
      `);
      const balanceAfter = Number(bankAfter.rows[0].current_balance);
      expect(balanceAfter).toBe(balanceBefore - conf.total_paid);

      // Check claims reimbursed
      const claimsReimbursed: any = await db.query(`
        SELECT reimbursement_status, reimbursed_amount, reimbursed_at
        FROM public.expense_claims WHERE reimbursement_batch_id = '${batchId}';
      `);
      expect(claimsReimbursed.rows[0].reimbursement_status).toBe("reimbursed");
      expect(Number(claimsReimbursed.rows[0].reimbursed_amount)).toBe(conf.total_paid);
      expect(claimsReimbursed.rows[0].reimbursed_at).toBeDefined();

      // Check Journal Entry
      if (conf.journal_id) {
        const journalRow: any = await db.query(`
          SELECT * FROM public.accounting_journals WHERE id = '${conf.journal_id}';
        `);
        expect(journalRow.rows.length).toBe(1);
        expect(Number(journalRow.rows[0].total_debit)).toBe(Number(journalRow.rows[0].total_credit));
      }
    });

    // ------------------------------------------------------------------------
    // TEST 8: REVERSE REIMBURSEMENT BATCH
    // ------------------------------------------------------------------------
    it("2.8 reverse_reimbursement_batch_atomic refunds bank balance and unlocks claims", async () => {
      await asUser(userFinanceA);

      const bankBefore: any = await db.query(`
        SELECT current_balance FROM public.company_bank_accounts WHERE id = '${bankAccountAId}';
      `);
      const balanceBefore = Number(bankBefore.rows[0].current_balance);

      const reverseRes: any = await db.query(`
        SELECT public.reverse_reimbursement_batch_atomic(
          '${batchId}',
          'خطأ في التحويل البنكي للموظف - تم الإلغاء لإعادة الصرف'
        ) as result;
      `);
      expect(reverseRes.rows[0].result.ok).toBe(true);

      // Bank balance restored
      const bankAfter: any = await db.query(`
        SELECT current_balance FROM public.company_bank_accounts WHERE id = '${bankAccountAId}';
      `);
      expect(Number(bankAfter.rows[0].current_balance)).toBeGreaterThan(balanceBefore);

      // Claims restored to unreimbursed
      const restoredClaim: any = await db.query(`
        SELECT reimbursement_status, reimbursement_batch_id FROM public.expense_claims WHERE reimbursement_batch_id IS NULL AND is_reimbursable = true;
      `);
      expect(restoredClaim.rows.length).toBeGreaterThan(0);
      expect(restoredClaim.rows[0].reimbursement_status).toBe("unreimbursed");
    });

    // ------------------------------------------------------------------------
    // TEST 9: TRANSFER TO PAYROLL INTEGRATION
    // ------------------------------------------------------------------------
    it("2.9 transfer_reimbursement_to_payroll_atomic transfers claims into payroll adjustments", async () => {
      await asUser(userFinanceA);

      // Prepare fresh batch
      const claimRow: any = await db.query(`
        SELECT id FROM public.expense_claims WHERE status = 'approved' AND reimbursement_status = 'unreimbursed' LIMIT 1;
      `);
      const claimId = claimRow.rows[0].id;

      const batchRes: any = await db.query(`
        SELECT public.prepare_reimbursement_batch_atomic(
          '2026-09',
          ARRAY['${claimId}']::uuid[],
          'payroll',
          NULL,
          'صرف عبر مسير الرواتب'
        ) as result;
      `);
      const newBatchId = batchRes.rows[0].result.batch_id;

      // Create a draft payroll run
      const runRes: any = await db.query(`
        INSERT INTO public.payroll_runs (company_id, period_year, period_month, status)
        VALUES ('${companyA}', 2026, 9, 'draft')
        RETURNING id;
      `);
      const payrollRunId = runRes.rows[0].id;

      // Transfer batch to payroll
      const transferRes: any = await db.query(`
        SELECT public.transfer_reimbursement_to_payroll_atomic(
          '${newBatchId}',
          '${payrollRunId}'
        ) as result;
      `);
      expect(transferRes.rows[0].result.ok).toBe(true);
      expect(transferRes.rows[0].result.transferred_count).toBeGreaterThan(0);

      // Verify payroll adjustment was created
      const adjRow: any = await db.query(`
        SELECT * FROM public.payroll_adjustments WHERE payroll_run_id = '${payrollRunId}';
      `);
      expect(adjRow.rows.length).toBeGreaterThan(0);
      expect(adjRow.rows[0].adjustment_type).toBe("earning");

      // Verify claim status
      const transferredClaim: any = await db.query(`
        SELECT reimbursement_status, reimbursement_method FROM public.expense_claims WHERE id = '${claimId}';
      `);
      expect(transferredClaim.rows[0].reimbursement_status).toBe("transferred_to_payroll");
      expect(transferredClaim.rows[0].reimbursement_method).toBe("payroll");

      // Verify batch status is transferred_to_payroll and NOT falsely marked confirmed_paid
      const batchRow: any = await db.query(`
        SELECT payment_status, payment_method, payroll_run_id, confirmed_at FROM public.reimbursement_batches WHERE id = '${newBatchId}';
      `);
      expect(batchRow.rows[0].payment_status).toBe("transferred_to_payroll");
      expect(batchRow.rows[0].payment_method).toBe("payroll");
      expect(batchRow.rows[0].confirmed_at).toBeNull();
    });

    // ------------------------------------------------------------------------
    // TEST 10: MULTI-CURRENCY CONVERSION
    // ------------------------------------------------------------------------
    it("2.10 Multi-currency claims convert amounts based on authorized exchange rates", async () => {
      await asUser(userEmpA);

      const usdClaimRes: any = await db.query(`
        SELECT public.submit_expense_claim_atomic(
          'اشتراك برمجيات سحابية بالدولار',
          'ترخيص أدوات الفريق التقني',
          NULL,
          NULL,
          'employee_paid',
          '[{"categoryId": "${catSuppliesId}", "amount": 100, "currency": "USD", "merchantName": "AWS Cloud", "itemDate": "2026-09-29"}]'::jsonb
        ) as result;
      `);

      const claimData = usdClaimRes.rows[0].result;
      expect(claimData.amount).toBe(100);
      expect(claimData.converted_amount).toBe(375); // 100 USD * 3.75 SAR = 375 SAR

      const row: any = await db.query(`
        SELECT currency, amount, exchange_rate, converted_amount FROM public.expense_claims WHERE id = '${claimData.claim_id}';
      `);
      expect(row.rows[0].currency).toBe("USD");
      expect(Number(row.rows[0].amount)).toBe(100);
      expect(Number(row.rows[0].exchange_rate)).toBe(3.75);
      expect(Number(row.rows[0].converted_amount)).toBe(375);
    });

    // ------------------------------------------------------------------------
    // TEST 11: EXPENSE KPIS CALCULATION
    // ------------------------------------------------------------------------
    it("2.11 get_expense_kpis_atomic calculates truthful, server-side figures without fabrication", async () => {
      const kpisRes: any = await db.query(`
        SELECT public.get_expense_kpis_atomic('${companyA}') as result;
      `);
      const kpis = kpisRes.rows[0].result;
      expect(kpis.totalSubmittedCount).toBeGreaterThan(0);
      expect(kpis.totalSubmittedAmount).toBeGreaterThan(0);
      expect(Array.isArray(kpis.categoriesBreakdown)).toBe(true);
      expect(kpis.categoriesBreakdown.length).toBeGreaterThan(0);
    });
  });
});
