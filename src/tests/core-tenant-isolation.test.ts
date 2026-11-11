import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll,afterAll,expect,it } from 'vitest';
const db=new PGlite();
const a='10000000-0000-0000-0000-000000000001',b='10000000-0000-0000-0000-000000000002';
beforeAll(async()=>{
 await db.exec(`CREATE ROLE authenticated; CREATE ROLE anon; CREATE SCHEMA auth;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
 GRANT USAGE ON SCHEMA auth TO authenticated;
 CREATE TYPE app_role AS ENUM ('employee','hr_manager','super_admin');
 CREATE TABLE user_roles(user_id uuid,role app_role); INSERT INTO user_roles VALUES('${a}','employee');
 CREATE FUNCTION has_role(uuid,app_role) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM user_roles WHERE user_id=$1 AND role=$2) $$;
 CREATE FUNCTION is_hr(uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT has_role($1,'hr_manager') $$;
 CREATE TABLE employees(id uuid,user_id uuid,company_id uuid,phone text,personal_email text,updated_at timestamptz,basic_salary numeric);
 INSERT INTO employees VALUES('${a}','${a}','${a}','old','old',null,5000),('${b}','${b}','${b}','other','other',null,6000);
 CREATE TABLE companies(id uuid); INSERT INTO companies VALUES('${a}'),('${b}');
 CREATE TABLE departments(id uuid,company_id uuid); INSERT INTO departments VALUES('${a}','${a}'),('${b}','${b}');
 CREATE TABLE subsidiaries(LIKE departments); INSERT INTO subsidiaries SELECT * FROM departments;
 CREATE TABLE work_locations(LIKE departments); INSERT INTO work_locations SELECT * FROM departments;
 GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO authenticated;`);
 for(const table of ['employees','companies','departments','subsidiaries','work_locations']){
  await db.exec(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY; CREATE POLICY baseline ON ${table} FOR ALL TO authenticated USING(true) WITH CHECK(true);`);
 }
 await db.exec(readFileSync('supabase/migrations/20261110020000_guard_core_tenant_scope.sql','utf8'));
 await db.exec(`SET ROLE authenticated; SELECT set_config('test.uid','${a}',false);`);
});
afterAll(async()=>{await db.close();});
it('isolates reads across all core tables without recursive RLS',async()=>{
 for(const table of ['employees','companies','departments','subsidiaries','work_locations']){
  expect((await db.query(`SELECT id FROM ${table}`)).rows).toEqual([{id:a}]);
 }
});
it('allows contact changes but denies self-service salary, account and tenant changes',async()=>{
 await db.exec(`UPDATE employees SET phone='new',personal_email='new' WHERE id='${a}'`);
 for(const update of ["basic_salary=99999",`user_id='${b}'`,`company_id='${b}'`]){
  await expect(db.exec(`UPDATE employees SET ${update} WHERE id='${a}'`)).rejects.toThrow(/Self-service/);
 }
});
it('blocks cross-company inserts and updates even for HR',async()=>{
 await db.exec(`RESET ROLE; INSERT INTO user_roles VALUES('${a}','hr_manager'); SET ROLE authenticated;`);
 await expect(db.exec(`INSERT INTO departments VALUES(null,'${b}')`)).rejects.toThrow(/row-level security/);
 expect((await db.query(`UPDATE employees SET basic_salary=1 WHERE id='${b}' RETURNING id`)).rows).toEqual([]);
 await db.exec(`UPDATE employees SET basic_salary=5100 WHERE id='${a}'`);
});
it('retains global visibility for existing system administrators',async()=>{
 await db.exec(`RESET ROLE; INSERT INTO user_roles VALUES('${a}','super_admin'); SET ROLE authenticated;`);
 expect((await db.query('SELECT id FROM employees')).rows).toHaveLength(2);
});
it('fails closed for missing user context',async()=>{
 await db.exec("SELECT set_config('test.uid','',false)");
 expect((await db.query('SELECT id FROM departments')).rows).toEqual([]);
});
