import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, expect, it } from 'vitest';
const db = new PGlite();
const hr='10000000-0000-0000-0000-000000000001';
const admin='10000000-0000-0000-0000-000000000002';
const employee='10000000-0000-0000-0000-000000000003';
const tables=['role_definitions','role_permissions'];
beforeAll(async()=>{
 await db.exec(`CREATE ROLE authenticated; CREATE SCHEMA auth;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT NULLIF(current_setting('test.uid',true),'')::uuid $$;
 GRANT USAGE ON SCHEMA auth TO authenticated;
 CREATE TYPE app_role AS ENUM ('employee','hr_manager','super_admin');
 CREATE TABLE user_roles(user_id uuid,role app_role);
 INSERT INTO user_roles VALUES('${hr}','hr_manager'),('${admin}','super_admin'),('${admin}','hr_manager'),('${employee}','employee');
 CREATE FUNCTION public.has_role(_user_id uuid,_role app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role) $$;`);
 for(const table of tables) await db.exec(`CREATE TABLE ${table}(id integer PRIMARY KEY, value text);
 INSERT INTO ${table} VALUES(1,'existing');
 ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;
 CREATE POLICY old_read ON ${table} FOR SELECT TO authenticated USING(true);
 CREATE POLICY old_hr_write ON ${table} FOR ALL TO authenticated USING(has_role(auth.uid(),'hr_manager')) WITH CHECK(has_role(auth.uid(),'hr_manager'));
 GRANT SELECT,INSERT,UPDATE,DELETE ON ${table} TO authenticated;`);
 await db.exec(readFileSync('supabase/migrations/20261110050000_guard_permission_administration.sql','utf8'));
 await db.exec('SET ROLE authenticated');
});
afterAll(async()=>{await db.close();});
beforeEach(async()=>{await db.exec(`SELECT set_config('test.uid','${hr}',false)`);});
it.each(tables)('blocks HR-only permission mutations in %s',async(table)=>{
 await expect(db.exec(`INSERT INTO ${table} VALUES(2,'escalated')`)).rejects.toThrow(/row-level security/);
 expect((await db.query(`UPDATE ${table} SET value='escalated' WHERE id=1 RETURNING *`)).rows).toEqual([]);
 expect((await db.query(`DELETE FROM ${table} WHERE id=1 RETURNING *`)).rows).toEqual([]);
 expect((await db.query(`SELECT * FROM ${table}`)).rows).toEqual([{id:1,value:'existing'}]);
});
it.each(tables)('preserves authorized administrator writes in %s',async(table)=>{
 await db.exec(`SELECT set_config('test.uid','${admin}',false); INSERT INTO ${table} VALUES(2,'temporary')`);
 expect((await db.query(`UPDATE ${table} SET value='changed' WHERE id=2 RETURNING *`)).rows).toEqual([{id:2,value:'changed'}]);
 expect((await db.query(`DELETE FROM ${table} WHERE id=2 RETURNING *`)).rows).toHaveLength(1);
});
it.each([employee,''])('rejects employee or missing identity writes (%s)',async(uid)=>{
 await db.exec(`SELECT set_config('test.uid','${uid}',false)`);
 for(const table of tables) await expect(db.exec(`INSERT INTO ${table} VALUES(3,'denied')`)).rejects.toThrow(/row-level security/);
});
