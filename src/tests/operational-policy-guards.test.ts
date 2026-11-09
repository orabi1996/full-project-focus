import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, expect, it } from 'vitest';
const db = new PGlite();
const user='10000000-0000-0000-0000-000000000001';
const other='10000000-0000-0000-0000-000000000002';
beforeAll(async()=>{
  await db.exec(`CREATE ROLE authenticated; CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT current_setting('test.uid')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO authenticated;
    CREATE FUNCTION is_hr(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT current_setting('test.hr')='yes' $$;
    CREATE TABLE employees(id uuid, user_id uuid, company_id uuid);
    INSERT INTO employees VALUES ('${user}','${user}','${user}'),('${other}','${other}','${other}');
    CREATE TABLE delegation_rules(id int,delegator_id uuid,delegate_id uuid,created_by uuid);
    CREATE TABLE overtime_records(id int,employee_id uuid,created_by uuid,status text,decided_by uuid,decided_at timestamptz);
    CREATE TABLE file_objects(id int,employee_id uuid,company_id uuid,uploaded_by uuid,created_by uuid);
    INSERT INTO delegation_rules VALUES (1,'${user}','${user}','${other}'),(2,'${other}','${other}','${other}');
    INSERT INTO overtime_records VALUES(1,'${user}','${other}','pending',null,null),(2,'${other}','${other}','pending',null,null);
    INSERT INTO file_objects VALUES(1,'${user}','${user}','${other}',null),(2,'${other}','${other}','${other}',null);
    GRANT SELECT,INSERT ON ALL TABLES IN SCHEMA public TO authenticated;
    ALTER TABLE delegation_rules ENABLE ROW LEVEL SECURITY; ALTER TABLE overtime_records ENABLE ROW LEVEL SECURITY; ALTER TABLE file_objects ENABLE ROW LEVEL SECURITY;
    CREATE POLICY old_allow ON delegation_rules FOR ALL TO authenticated USING(true) WITH CHECK(true);
    CREATE POLICY old_allow ON overtime_records FOR ALL TO authenticated USING(true) WITH CHECK(true);
    CREATE POLICY old_allow ON file_objects FOR ALL TO authenticated USING(true) WITH CHECK(true);`);
  await db.exec(readFileSync('supabase/migrations/20261110000000_restrict_operational_table_access.sql','utf8'));
  await db.exec(`SET ROLE authenticated; SELECT set_config('test.uid','${user}',false),set_config('test.hr','no',false);`);
});
afterAll(async()=>{await db.close();});
it('restricts reads despite existing permissive true policies',async()=>{
 for(const table of ['delegation_rules','overtime_records','file_objects']) {
  expect((await db.query(`SELECT id FROM ${table}`)).rows).toEqual([{id:1}]);
 }
});
it('denies self-appointed delegation and priced overtime from ordinary accounts',async()=>{
 await expect(db.exec(`INSERT INTO delegation_rules VALUES(3,'${user}','${other}','${user}')`)).rejects.toThrow(/row-level security/);
 await expect(db.exec(`INSERT INTO overtime_records VALUES(3,'${user}','${user}','pending',null,null)`)).rejects.toThrow(/row-level security/);
});
it('allows owned file metadata but rejects forged uploader and other tenant scope',async()=>{
 await db.exec(`INSERT INTO file_objects VALUES(3,'${user}','${user}','${user}',null)`);
 await expect(db.exec(`INSERT INTO file_objects VALUES(4,'${user}','${user}','${other}',null)`)).rejects.toThrow(/row-level security/);
 await expect(db.exec(`INSERT INTO file_objects VALUES(4,'${other}','${other}','${user}',null)`)).rejects.toThrow(/row-level security/);
});
it('preserves HR creation but rejects actor spoofing and preapproved overtime',async()=>{
 await db.exec("SELECT set_config('test.hr','yes',false)");
 await db.exec(`INSERT INTO delegation_rules VALUES(3,'${user}','${other}','${user}'); INSERT INTO overtime_records VALUES(3,'${other}','${user}','pending',null,null)`);
 await expect(db.exec(`INSERT INTO delegation_rules VALUES(4,'${user}','${other}','${other}')`)).rejects.toThrow(/row-level security/);
 await expect(db.exec(`INSERT INTO overtime_records VALUES(4,'${other}','${user}','approved','${user}',now())`)).rejects.toThrow(/row-level security/);
});
