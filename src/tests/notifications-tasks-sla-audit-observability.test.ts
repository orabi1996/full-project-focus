import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import fs from "fs";
import path from "path";
import {
  maskSensitiveData,
  computeLocalAuditHash,
} from "../lib/domains/audit";
import {
  NOTIFICATION_CATEGORIES_CONFIG,
} from "../lib/domains/notifications";
import {
  TASK_CATEGORY_LABELS,
} from "../lib/domains/tasks";

describe.sequential("Prompt 24: Enterprise Notifications, Task Center, SLA, Audit & Observability", () => {
  // ==========================================================================
  // PART 1: STATIC SOURCE CODE CONTRACT TESTS
  // ==========================================================================
  describe("Static Source Code Contract Tests", () => {
    const auditViewPath = path.resolve(__dirname, "../components/audit/AuditView.tsx");
    const auditViewSource = fs.readFileSync(auditViewPath, "utf-8");

    const notifCenterPath = path.resolve(__dirname, "../components/notifications/NotificationCenter.tsx");
    const notifCenterSource = fs.readFileSync(notifCenterPath, "utf-8");

    const taskCenterPath = path.resolve(__dirname, "../components/tasks/TaskCenter.tsx");
    const taskCenterSource = fs.readFileSync(taskCenterPath, "utf-8");

    const notifRepoPath = path.resolve(__dirname, "../lib/data/notifications-repository.ts");
    const notifRepoSource = fs.readFileSync(notifRepoPath, "utf-8");

    const taskRepoPath = path.resolve(__dirname, "../lib/data/tasks-repository.ts");
    const taskRepoSource = fs.readFileSync(taskRepoPath, "utf-8");

    const auditRepoPath = path.resolve(__dirname, "../lib/data/audit-repository.ts");
    const auditRepoSource = fs.readFileSync(auditRepoPath, "utf-8");

    const migrationPath = path.resolve(
      __dirname,
      "../../supabase/migrations/20261007000000_production_notifications_tasks_sla_audit_observability.sql"
    );
    const migrationSource = fs.readFileSync(migrationPath, "utf-8");

    it("1.1 AuditView MUST integrate full operations control (Audit Trail, Security, Integrity, Tasks, Observability)", () => {
      expect(auditViewSource).toContain("audit_trail");
      expect(auditViewSource).toContain("security_events");
      expect(auditViewSource).toContain("integrity");
      expect(auditViewSource).toContain("task_center");
      expect(auditViewSource).toContain("observability");
      expect(auditViewSource).toContain("useAuditIntegrityCheck");
      expect(auditViewSource).toContain("useBackgroundJobs");
      expect(auditViewSource).toContain("useDeadLetterJobs");
    });

    it("1.2 NotificationCenter MUST support categories, channels, and preferences", () => {
      expect(notifCenterSource).toContain("useNotificationsInbox");
      expect(notifCenterSource).toContain("useUnreadNotificationsCount");
      expect(notifCenterSource).toContain("useNotificationTemplates");
      expect(notifCenterSource).toContain("useNotificationPreferences");
      expect(notifCenterSource).toContain("markAllAsRead");
      expect(notifCenterSource).toContain("archiveNotification");
    });

    it("1.3 TaskCenter MUST support claim, complete, escalation and SLA breach indicators", () => {
      expect(taskCenterSource).toContain("useOperationalTasks");
      expect(taskCenterSource).toContain("useSlaPolicies");
      expect(taskCenterSource).toContain("claimTask");
      expect(taskCenterSource).toContain("completeTask");
      expect(taskCenterSource).toContain("escalateTask");
      expect(taskCenterSource).toContain("evaluateTaskSlasRecord");
    });

    it("1.4 Migration MUST declare authoritative production tables", () => {
      expect(migrationSource).toContain("CREATE TABLE IF NOT EXISTS public.notification_templates");
      expect(migrationSource).toContain("CREATE TABLE IF NOT EXISTS public.notification_deliveries");
      expect(migrationSource).toContain("CREATE TABLE IF NOT EXISTS public.notification_preferences");
      expect(migrationSource).toContain("CREATE TABLE IF NOT EXISTS public.sla_policies");
      expect(migrationSource).toContain("CREATE TABLE IF NOT EXISTS public.operational_tasks");
      expect(migrationSource).toContain("CREATE TABLE IF NOT EXISTS public.task_escalations");
      expect(migrationSource).toContain("CREATE TABLE IF NOT EXISTS public.sla_events");
      expect(migrationSource).toContain("CREATE TABLE IF NOT EXISTS public.background_jobs");
      expect(migrationSource).toContain("CREATE TABLE IF NOT EXISTS public.dead_letter_jobs");
    });

    it("1.5 Migration MUST define authoritative RPCs", () => {
      expect(migrationSource).toContain("FUNCTION public.log_enterprise_audit_event");
      expect(migrationSource).toContain("FUNCTION public.verify_audit_trail_integrity");
      expect(migrationSource).toContain("FUNCTION public.send_enterprise_notification");
      expect(migrationSource).toContain("FUNCTION public.mark_notification_status");
      expect(migrationSource).toContain("FUNCTION public.mark_all_notifications_read");
      expect(migrationSource).toContain("FUNCTION public.create_operational_task");
      expect(migrationSource).toContain("FUNCTION public.claim_operational_task");
      expect(migrationSource).toContain("FUNCTION public.complete_operational_task");
      expect(migrationSource).toContain("FUNCTION public.escalate_operational_task");
      expect(migrationSource).toContain("FUNCTION public.evaluate_task_slas");
      expect(migrationSource).toContain("FUNCTION public.enqueue_background_job");
      expect(migrationSource).toContain("FUNCTION public.retry_dead_letter_job");
      expect(migrationSource).toContain("FUNCTION public.get_operations_health_summary");
    });

    it("1.6 Repositories MUST implement TanStack Query keys correctly", () => {
      expect(notifRepoSource).toContain("notificationQueryKeys");
      expect(taskRepoSource).toContain("taskQueryKeys");
      expect(auditRepoSource).toContain("auditQueryKeys");
    });
  });

  // ==========================================================================
  // PART 2: SENSITIVE DATA MASKING & HASH CHAINING UNIT TESTS
  // ==========================================================================
  describe("Sensitive Data Masking & Hash Chaining Unit Tests", () => {
    it("2.1 maskSensitiveData masks credentials, tokens and national IDs", () => {
      const payload = {
        employeeName: "خالد الشهري",
        password: "SuperSecretPassword123!",
        apiKey: "live_sec_abc123456",
        nationalIdOrIqama: "1098765432",
        basicSalary: 12500,
        department: "تقنية المعلومات",
      };

      const masked = maskSensitiveData(payload);
      expect(masked).toBeDefined();
      expect(masked?.employeeName).toBe("خالد الشهري");
      expect(masked?.department).toBe("تقنية المعلومات");
      expect(masked?.password).toBe("******");
      expect(masked?.apiKey).toBe("***3456");
      expect(masked?.nationalIdOrIqama).toBe("***5432");
      expect(masked?.basicSalary).toBe("[CONFIDENTIAL]");
    });

    it("2.2 maskSensitiveData recursively handles nested records", () => {
      const complex = {
        actor: "admin",
        data: {
          iban: "SA0380000000608010167519",
          token: "jwt_token_here",
          regularInfo: "متاح",
        },
      };

      const masked = maskSensitiveData(complex);
      expect((masked?.data as any).iban).toBe("***7519");
      expect((masked?.data as any).token).toBe("******");
      expect((masked?.data as any).regularInfo).toBe("متاح");
    });

    it("2.3 computeLocalAuditHash computes deterministic hash linked to previous block", () => {
      const prevHash = "GENESIS_ROOT";
      const h1 = computeLocalAuditHash(prevHash, "u1", "login", "user", "u1", "2026-10-06T12:00:00Z");
      const h2 = computeLocalAuditHash(prevHash, "u1", "login", "user", "u1", "2026-10-06T12:00:00Z");
      expect(h1).toBe(h2);

      // Chained block
      const h3 = computeLocalAuditHash(h1, "u1", "update_salary", "employee", "emp-01", "2026-10-06T12:01:00Z");
      expect(h3).not.toBe(h1);
    });

    it("2.4 Catalogs are comprehensively defined", () => {
      expect(Object.keys(NOTIFICATION_CATEGORIES_CONFIG).length).toBe(12);
      expect(Object.keys(TASK_CATEGORY_LABELS).length).toBe(8);
    });
  });

  // ==========================================================================
  // PART 3: PGLITE IN-MEMORY DATABASE TESTS
  // ==========================================================================
  describe("PGlite In-Memory Database Tests", () => {
    let db: PGlite;
    const COMPANY_A = "11111111-1111-4111-a111-111111111111";
    const USER_A = "22222222-2222-4222-a222-222222222222";
    const USER_B = "33333333-3333-4333-a333-333333333333";

    beforeAll(async () => {
      db = new PGlite();

      // Setup roles and auth schema
      await db.exec(`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
            CREATE ROLE authenticated;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
            CREATE ROLE service_role;
          END IF;
        END $$;

        CREATE SCHEMA IF NOT EXISTS auth;
        CREATE TABLE IF NOT EXISTS auth.users (
          id uuid PRIMARY KEY,
          email text,
          created_at timestamptz DEFAULT now()
        );
        INSERT INTO auth.users (id, email) VALUES
          ('${USER_A}', 'admin@andalus.sa'),
          ('${USER_B}', 'manager@andalus.sa')
        ON CONFLICT DO NOTHING;

        CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid AS $$
          SELECT '${USER_A}'::uuid;
        $$ LANGUAGE sql STABLE;

        CREATE TABLE IF NOT EXISTS public.companies (
          id uuid PRIMARY KEY,
          legal_name_ar text NOT NULL,
          legal_name_en text NOT NULL,
          code text
        );
        INSERT INTO public.companies(id, legal_name_ar, legal_name_en, code)
        VALUES ('${COMPANY_A}', 'شركة الأندلس القابضة', 'Al-Andalus Holding', 'ANDALUS')
        ON CONFLICT DO NOTHING;
      `);

      // Apply Prompt 24 Migration
      const migrationFile = path.resolve(
        __dirname,
        "../../supabase/migrations/20261007000000_production_notifications_tasks_sla_audit_observability.sql"
      );
      const sql = fs.readFileSync(migrationFile, "utf-8");
      await db.exec(sql);
    });

    afterAll(async () => {
      await db.close();
    });

    it("3.1 log_enterprise_audit_event appends cryptographic hash chain", async () => {
      const res1 = await db.query<{ event_id: string; event_hash: string; prev_hash: string }>(`
        WITH evt AS (
          SELECT public.log_enterprise_audit_event(
            '${COMPANY_A}'::uuid,
            '${USER_A}'::uuid,
            'أحمد السعيد',
            'super_admin',
            'employee.created',
            'employee',
            'emp-001',
            'خالد العتيبي',
            'info',
            'إضافة موظف جديد',
            NULL,
            '{"status":"active"}'::jsonb,
            '192.168.1.100',
            'Mozilla/5.0',
            false
          ) as data
        )
        SELECT data->>'event_id' as event_id,
               data->>'event_hash' as event_hash,
               data->>'prev_hash' as prev_hash
        FROM evt;
      `);

      expect(res1.rows.length).toBeGreaterThan(0);
      expect(res1.rows[0].event_hash).toBeDefined();

      // Check DB table
      const rows = await db.query<any>(`SELECT * FROM public.audit_events WHERE company_id = '${COMPANY_A}';`);
      expect(rows.rows.length).toBeGreaterThanOrEqual(1);
      expect(rows.rows[0].action).toBe("employee.created");
    });

    it("3.2 verify_audit_trail_integrity confirms untampered cryptographic chain", async () => {
      const verifyRes = await db.query<{ is_valid: boolean; status: string }>(`
        SELECT (public.verify_audit_trail_integrity('${COMPANY_A}'::uuid))->>'is_valid' as is_valid,
               (public.verify_audit_trail_integrity('${COMPANY_A}'::uuid))->>'status' as status;
      `);

      expect(verifyRes.rows.length).toBe(1);
      expect(verifyRes.rows[0].status).toBe("verified");
    });

    it("3.3 send_enterprise_notification dispatches in-app notification and delivery outbox", async () => {
      const sendRes = await db.query<{ notification_id: string }>(`
        SELECT (public.send_enterprise_notification(
          '${COMPANY_A}'::uuid,
          '${USER_A}'::uuid,
          'leave.request_submitted',
          'leave',
          'طلب إجازة جديد',
          'New Leave Request',
          'تم تقديم طلب إجازة سنوية',
          'Annual leave submitted',
          'info',
          'leave_request',
          'lr-101',
          '/?module=leaves'
        ))->>'notification_id' as notification_id;
      `);

      const notifId = sendRes.rows[0].notification_id;
      expect(notifId).toBeDefined();

      // Check delivery record exists
      const deliveries = await db.query<any>(`
        SELECT * FROM public.notification_deliveries WHERE notification_id = '${notifId}'::uuid;
      `);
      expect(deliveries.rows.length).toBe(1);
      expect(deliveries.rows[0].channel).toBe("in_app");
      expect(deliveries.rows[0].status).toBe("delivered");
    });

    it("3.4 mark_notification_status and mark_all_notifications_read update read status truthfully", async () => {
      await db.query(`SELECT public.mark_all_notifications_read('${USER_A}'::uuid);`);

      const unreadCount = await db.query<{ count: string }>(`
        SELECT count(*) as count FROM public.notifications_inbox WHERE recipient_id = '${USER_A}'::uuid AND is_read = false;
      `);
      expect(Number(unreadCount.rows[0].count)).toBe(0);
    });

    it("3.5 create_operational_task generates task number, computes SLA breach deadline and records started event", async () => {
      // Setup SLA Policy first
      await db.query(`
        INSERT INTO public.sla_policies (
          company_id, name_ar, name_en, entity_type, priority, response_time_hours, resolution_time_hours, warning_threshold_pct
        ) VALUES (
          '${COMPANY_A}'::uuid, 'سياسة الإجازات', 'Leave SLA', 'leave_request', 'high', 2.0, 12.0, 75.0
        ) ON CONFLICT DO NOTHING;
      `);

      const taskRes = await db.query<{ task_id: string; task_number: string }>(`
        WITH t AS (
          SELECT public.create_operational_task(
            '${COMPANY_A}'::uuid,
            'اعتماد إجازة الموظف',
            'Approve Leave Request',
            'approvals',
            'high',
            now() + interval '24 hours',
            'leave_request',
            'req-999',
            '${USER_A}'::uuid,
            'hr_manager'
          ) as data
        )
        SELECT data->>'task_id' as task_id,
               data->>'task_number' as task_number
        FROM t;
      `);

      expect(taskRes.rows[0].task_id).toBeDefined();

      const task = await db.query<any>(`
        SELECT * FROM public.operational_tasks WHERE id = '${taskRes.rows[0].task_id}'::uuid;
      `);
      expect(task.rows.length).toBe(1);
      expect(task.rows[0].sla_breach_at).toBeDefined();

      // Check SLA event logged
      const slaEvents = await db.query<any>(`
        SELECT * FROM public.sla_events WHERE task_id = '${taskRes.rows[0].task_id}'::uuid;
      `);
      expect(slaEvents.rows.length).toBeGreaterThanOrEqual(1);
      expect(slaEvents.rows[0].event_type).toBe("started");
    });

    it("3.6 claim_operational_task and complete_operational_task advance task state", async () => {
      const task = (await db.query<any>(`SELECT id FROM public.operational_tasks LIMIT 1;`)).rows[0];

      await db.query(`SELECT public.claim_operational_task('${task.id}'::uuid, '${USER_B}'::uuid);`);
      let updated = (await db.query<any>(`SELECT status, claimed_by FROM public.operational_tasks WHERE id = '${task.id}'::uuid;`)).rows[0];
      expect(updated.status).toBe("in_progress");

      await db.query(`SELECT public.complete_operational_task('${task.id}'::uuid, '${USER_B}'::uuid, 'تم الاعتماد بنجاح');`);
      updated = (await db.query<any>(`SELECT status, resolution_note FROM public.operational_tasks WHERE id = '${task.id}'::uuid;`)).rows[0];
      expect(updated.status).toBe("completed");
      expect(updated.resolution_note).toBe("تم الاعتماد بنجاح");
    });

    it("3.7 escalate_operational_task increments level and records escalation event", async () => {
      // Create new task to escalate
      const tRes = await db.query<{ task_id: string }>(`
        SELECT (public.create_operational_task(
          '${COMPANY_A}'::uuid,
          'مهمة فحص أمني',
          'Security Review',
          'incident',
          'urgent',
          now() + interval '4 hours',
          'security_audit',
          'sec-01'
        ))->>'task_id' as task_id;
      `);
      const tId = tRes.rows[0].task_id;

      await db.query(`
        SELECT public.escalate_operational_task(
          '${tId}'::uuid,
          '${USER_A}'::uuid,
          '${USER_B}'::uuid,
          'super_admin',
          'عدم الاستجابة خلال المدة المحددة'
        );
      `);

      const task = (await db.query<any>(`SELECT status, escalation_level FROM public.operational_tasks WHERE id = '${tId}'::uuid;`)).rows[0];
      expect(task.status).toBe("escalated");
      expect(task.escalation_level).toBe(1);

      const esc = (await db.query<any>(`SELECT * FROM public.task_escalations WHERE task_id = '${tId}'::uuid;`)).rows[0];
      expect(esc.reason).toBe("عدم الاستجابة خلال المدة المحددة");
    });

    it("3.8 evaluate_task_slas flags overdue tasks", async () => {
      // Create a task that already breached SLA
      await db.query(`
        INSERT INTO public.operational_tasks (
          company_id, task_number, title_ar, title_en, category, priority, status, due_date, entity_type, entity_id, sla_breach_at
        ) VALUES (
          '${COMPANY_A}'::uuid, 'TSK-OVERDUE-01', 'مهمة متأخرة', 'Overdue Task', 'compliance', 'urgent', 'pending', now() - interval '2 hours', 'tax', 'tax-01', now() - interval '1 hour'
        );
      `);

      const evalRes = await db.query<{ breached_count: string }>(`
        SELECT (public.evaluate_task_slas('${COMPANY_A}'::uuid))->>'breached_count' as breached_count;
      `);

      expect(Number(evalRes.rows[0].breached_count)).toBeGreaterThanOrEqual(1);

      const overdueTask = (await db.query<any>(`SELECT status, is_sla_breached FROM public.operational_tasks WHERE task_number = 'TSK-OVERDUE-01';`)).rows[0];
      expect(overdueTask.status).toBe("overdue");
      expect(overdueTask.is_sla_breached).toBe(true);
    });

    it("3.9 enqueue_background_job and dead_letter_jobs retry works accurately", async () => {
      const jobRes = await db.query<{ job_id: string }>(`
        SELECT (public.enqueue_background_job(
          '${COMPANY_A}'::uuid,
          'data_sync',
          '{"target":"gosi"}'::jsonb,
          2
        ))->>'job_id' as job_id;
      `);
      expect(jobRes.rows[0].job_id).toBeDefined();

      // Insert mock dead letter job
      const dlRes = await db.query<{ id: string }>(`
        INSERT INTO public.dead_letter_jobs (
          job_id, company_id, job_type, failure_reason, attempts_made
        ) VALUES (
          '${jobRes.rows[0].job_id}'::uuid, '${COMPANY_A}'::uuid, 'data_sync', 'Connection refused', 5
        ) RETURNING id;
      `);

      const retryRes = await db.query<{ ok: string; new_job_id: string }>(`
        SELECT (public.retry_dead_letter_job('${dlRes.rows[0].id}'::uuid))->>'ok' as ok,
               (public.retry_dead_letter_job('${dlRes.rows[0].id}'::uuid))->>'new_job_id' as new_job_id;
      `);

      expect(retryRes.rows[0].ok).toBe("true");

      const dlJob = (await db.query<any>(`SELECT resolved FROM public.dead_letter_jobs WHERE id = '${dlRes.rows[0].id}'::uuid;`)).rows[0];
      expect(dlJob.resolved).toBe(true);
    });

    it("3.10 get_operations_health_summary returns truthful observability metrics", async () => {
      const summaryRes = await db.query<{ pending_tasks: string; sla_compliance_rate: string }>(`
        SELECT (public.get_operations_health_summary('${COMPANY_A}'::uuid))->>'pending_tasks' as pending_tasks,
               (public.get_operations_health_summary('${COMPANY_A}'::uuid))->>'sla_compliance_rate' as sla_compliance_rate;
      `);

      expect(summaryRes.rows[0].pending_tasks).toBeDefined();
      expect(Number(summaryRes.rows[0].sla_compliance_rate)).toBeGreaterThanOrEqual(0);
    });
  });
});
