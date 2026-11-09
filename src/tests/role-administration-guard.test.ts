import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, expect, it } from 'vitest';
const db = new PGlite();
const hr='10000000-0000-0000-0000-000000000001';
const admin='10000000-0000-0000-0000-000000000002';
const employee='10000000-0000-0000-0000-000000000003';
beforeAll(async()=>{
 await db.exec(`CREATE ROLE authenticated; CREATE SCHEMA auth;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT current_setting('test.uid')::uuid $$;
 GRANT USAGE ON SCHEMA auth TO authenticated;
 CREATE TYPE app_role AS ENUM ('employee','hr_manager','super_admin');
 CREATE TABLE user_roles(user_id uuid,role app_role,PRIMARY KEY(user_id,role));
 INSERT INTO user_roles VALUES('${hr}','hr_manager'),('${admin}','super_admin'),('${admin}','hr_manager'),('${employee}','employee');
 CREATE FUNCTION public.has_role(_user_id uuid,_role app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role) $$;
 ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
 CREATE POLICY read_roles ON user_roles FOR SELECT TO authenticated USING(user_id=auth.uid() OR has_role(auth.uid(),'hr_manager'));
 CREATE POLICY old_hr_write ON user_roles FOR ALL TO authenticated USING(has_role(auth.uid(),'hr_manager')) WITH CHECK(has_role(auth.uid(),'hr_manager'));
 GRANT SELECT,INSERT,UPDATE,DELETE ON user_roles TO authenticated;`);
 await db.exec(readFileSync('supabase/migrations/20261110010000_guard_role_administration.sql','utf8'));
 await db.exec(`SET ROLE authenticated; SELECT set_config('test.uid','${hr}',false);`);
});
afterAll(async()=>{await db.close();});
it('blocks HR from assigning itself super-admin',async()=>{
 await expect(db.exec(`INSERT INTO user_roles VALUES('${hr}','super_admin')`)).rejects.toThrow(/row-level security/);
});
it('blocks HR update escalation and removing an administrator',async()=>{
 expect((await db.query(`UPDATE user_roles SET role='super_admin' WHERE user_id='${employee}' RETURNING *`)).rows).toEqual([]);
 expect((await db.query(`DELETE FROM user_roles WHERE user_id='${admin}' RETURNING *`)).rows).toEqual([]);
});
it('preserves administration for an already authorized system administrator',async()=>{
 await db.exec(`SELECT set_config('test.uid','${admin}',false); INSERT INTO user_roles VALUES('${employee}','hr_manager');`);
 expect((await db.query(`DELETE FROM user_roles WHERE user_id='${employee}' AND role='hr_manager' RETURNING *`)).rows).toHaveLength(1);
});
it('preserves own-role reads without allowing employee assignment',async()=>{
 await db.exec(`SELECT set_config('test.uid','${employee}',false);`);
 expect((await db.query('SELECT * FROM user_roles')).rows).toEqual([{user_id:employee,role:'employee'}]);
 await expect(db.exec(`INSERT INTO user_roles VALUES('${employee}','super_admin')`)).rejects.toThrow(/row-level security/);
});
