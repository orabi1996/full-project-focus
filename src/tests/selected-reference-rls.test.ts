import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';

const migration = readFileSync(new URL('../../drizzle/migrations/0010_scope_selected_reference_reads.sql', import.meta.url), 'utf8');
const tables: Record<string, string> = {
  role_permissions: 'role_key public.app_role', role_definitions: 'role_key public.app_role',
  companies: '', departments: 'company_id uuid', subsidiaries: 'company_id uuid', work_locations: 'company_id uuid',
  competency_frameworks: 'company_id uuid', competencies: 'company_id uuid', performance_cycles: 'company_id uuid',
  review_templates: 'company_id uuid', performance_criteria: 'cycle_id uuid', review_template_items: 'template_id uuid',
  reference_lists: '', expense_categories: '', approval_chains: '', leave_types: 'company_id uuid', org_settings: '',
  job_openings: '', company_documents: 'status text, visibility_scope text, department_id uuid, subsidiary_id uuid',
  shifts: '', overtime_records: 'employee_id uuid',
};
const ids = { user: '00000000-0000-0000-0000-000000000001', other: '00000000-0000-0000-0000-000000000002',
  employee: '00000000-0000-0000-0000-000000000003', otherEmployee: '00000000-0000-0000-0000-000000000004',
  company: '00000000-0000-0000-0000-000000000005', otherCompany: '00000000-0000-0000-0000-000000000006' };

describe.sequential('selected reference-data RLS', () => {
  let db: PGlite;
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE SCHEMA auth; CREATE SCHEMA private_sec;
      GRANT USAGE ON SCHEMA public, auth, private_sec TO authenticated;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.user', true), '')::uuid $$;
      CREATE TYPE public.app_role AS ENUM ('employee','org_admin','hr_manager','super_admin','recruiter','auditor','attendance_officer','line_manager');
      CREATE TABLE public.user_roles (user_id uuid, role public.app_role);
      CREATE TABLE public.employees (id uuid, user_id uuid, company_id uuid, department_id uuid, subsidiary_id uuid);
      CREATE TABLE public.schedule_assignments (employee_id uuid, shift_id uuid);
      GRANT SELECT ON public.employees, public.schedule_assignments TO authenticated;
      CREATE FUNCTION private_sec.current_user_has_role(r public.app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role=r) $$;
      CREATE FUNCTION private_sec.current_user_is_hr() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT private_sec.current_user_has_role('hr_manager') OR private_sec.current_user_has_role('org_admin') $$;
      CREATE FUNCTION private_sec.current_employee_id() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT id FROM public.employees WHERE user_id=auth.uid() LIMIT 1 $$;
      CREATE FUNCTION public.can_access_core_company(c uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT auth.uid() IS NOT NULL AND (private_sec.current_user_has_role('super_admin') OR EXISTS(SELECT 1 FROM public.employees WHERE user_id=auth.uid() AND company_id=c)) $$;
      INSERT INTO public.employees VALUES ('${ids.employee}','${ids.user}',NULL,'${ids.company}','${ids.company}'), ('${ids.otherEmployee}','${ids.other}','${ids.otherCompany}',NULL,NULL);
      INSERT INTO public.user_roles VALUES ('${ids.user}','employee');
    `);
    for (const [table, columns] of Object.entries(tables)) {
      const policy = migration.match(new RegExp(`ALTER POLICY (\\w+) ON public\\.${table} TO`))![1];
      await db.exec(`CREATE TABLE public.${table}(id uuid ${columns ? ', ' + columns : ''});
        GRANT SELECT ON public.${table} TO authenticated;
        ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;
        CREATE POLICY ${policy} ON public.${table} FOR SELECT TO authenticated USING (true);`);
      const names = columns.split(',').filter(Boolean).map(c => c.trim().split(' ')[0]);
      const values = names.map(n => n === 'role_key' ? "'employee'" : n === 'status' ? "'active'" : n === 'visibility_scope' ? "'all'" : `'${ids.company}'`);
      await db.exec(`INSERT INTO public.${table} VALUES ('${ids.company}'${values.length ? ',' + values.join(',') : ''});`);
    }
    await db.exec(migration);
  }, 30000);
  afterAll(async () => { await db?.close(); });

  async function visible(table: string) {
    await db.exec(`SET ROLE authenticated; SELECT set_config('test.user','${ids.user}',false);`);
    try { return (await db.query(`SELECT * FROM public.${table}`)).rows.length; }
    finally { await db.exec('RESET ROLE'); }
  }

  it('denies all selected data to a new unassigned signup, even with an employee role and employee row', async () => {
    for (const table of Object.keys(tables)) expect(await visible(table), table).toBe(0);
  });

  it('allows company references and own permissions, but not other companies or privileged settings', async () => {
    await db.exec(`UPDATE public.employees SET company_id='${ids.company}' WHERE user_id='${ids.user}';
      INSERT INTO public.companies VALUES ('${ids.otherCompany}');
      INSERT INTO public.performance_cycles VALUES ('${ids.otherCompany}','${ids.otherCompany}');
      INSERT INTO public.role_permissions VALUES ('${ids.otherCompany}','super_admin');
      INSERT INTO public.role_definitions VALUES ('${ids.otherCompany}','super_admin');`);
    for (const table of Object.keys(tables).filter(t => !['org_settings','job_openings','shifts','overtime_records'].includes(t))) {
      expect(await visible(table), table).toBe(1);
    }
    expect(await visible('org_settings')).toBe(0);
    expect(await visible('job_openings')).toBe(0);
  });

  it('scopes company-specific leave types and performance child records', async () => {
    await db.exec(`INSERT INTO public.leave_types VALUES ('${ids.otherCompany}','${ids.otherCompany}'), ('${ids.employee}',NULL);
      INSERT INTO public.review_templates VALUES ('${ids.otherCompany}','${ids.otherCompany}');
      INSERT INTO public.performance_criteria VALUES ('${ids.otherCompany}','${ids.otherCompany}');
      INSERT INTO public.review_template_items VALUES ('${ids.otherCompany}','${ids.otherCompany}');`);
    expect(await visible('leave_types')).toBe(2);
    expect(await visible('performance_criteria')).toBe(1);
    expect(await visible('review_template_items')).toBe(1);
  });

  it('honors document department/subsidiary scope and does not share restricted or archived documents', async () => {
    await db.exec(`INSERT INTO public.company_documents VALUES
      ('${ids.employee}','active','department','${ids.company}',NULL),
      ('${ids.otherEmployee}','active','subsidiary',NULL,'${ids.company}'),
      ('${ids.otherCompany}','active','department','${ids.otherCompany}',NULL),
      ('${ids.user}','active','hr_only',NULL,NULL),
      ('${ids.other}','archived','all',NULL,NULL);`);
    expect(await visible('company_documents')).toBe(3);
  });

  it('shows only own overtime and assigned shifts', async () => {
    await db.exec(`INSERT INTO public.overtime_records VALUES ('${ids.employee}','${ids.employee}'), ('${ids.otherEmployee}','${ids.otherEmployee}');
      INSERT INTO public.shifts VALUES ('${ids.otherCompany}');
      INSERT INTO public.schedule_assignments VALUES ('${ids.employee}','${ids.company}'), ('${ids.otherEmployee}','${ids.otherCompany}');`);
    expect(await visible('overtime_records')).toBe(1);
    expect(await visible('shifts')).toBe(1);
  });

  it('retains protected HR reads and specialized recruitment access', async () => {
    await db.exec(`INSERT INTO public.user_roles VALUES ('${ids.user}','recruiter');`);
    expect(await visible('job_openings')).toBe(1);
    expect(await visible('org_settings')).toBe(0);
    await db.exec(`INSERT INTO public.user_roles VALUES ('${ids.user}','hr_manager');`);
    expect(await visible('org_settings')).toBe(1);
    expect(await visible('role_permissions')).toBe(2);
    expect(await visible('role_definitions')).toBe(2);
    expect(await visible('company_documents')).toBe(6);
    expect(await visible('shifts')).toBe(2);
  });

  it('changes only the 21 selected policies and preserves existing write/tenant guards', () => {
    expect(migration.match(/ALTER POLICY /g)).toHaveLength(21);
    expect(migration).not.toMatch(/DROP POLICY|FOR (INSERT|UPDATE|DELETE|ALL)|ALTER TABLE/);
    expect(migration).toContain('REVOKE ALL ON FUNCTION private_sec.current_user_is_org_member() FROM PUBLIC, anon');
  });
});