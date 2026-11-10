import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll,afterAll,expect,it } from 'vitest';
const db=new PGlite();
const a='10000000-0000-0000-0000-000000000001',b='10000000-0000-0000-0000-000000000002';
const direct=['calibration_sessions','competencies','competency_frameworks','development_plans','performance_cycle_participants','performance_cycles','performance_goals','performance_improvement_plans','performance_review_assignments','potential_assessments','review_templates'];
const linked: Record<string,string>={calibration_adjustments:'session_id',development_plan_items:'plan_id',goal_progress_history:'goal_id',performance_criteria:'cycle_id',review_template_items:'template_id'};
beforeAll(async()=>{
 await db.exec(`CREATE ROLE authenticated; CREATE FUNCTION can_access_core_company(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT $1::text=current_setting('test.company') $$;`);
 for(const table of direct){await db.exec(`CREATE TABLE ${table}(id uuid,company_id uuid); INSERT INTO ${table} VALUES('${a}','${a}'),('${b}','${b}');`);}
 for(const [table,fk] of Object.entries(linked)){await db.exec(`CREATE TABLE ${table}(id uuid,${fk} uuid); INSERT INTO ${table} VALUES('${a}','${a}'),('${b}','${b}');`);}
 for(const table of [...direct,...Object.keys(linked)]){await db.exec(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY; CREATE POLICY old_allow ON ${table} FOR ALL TO authenticated USING(true) WITH CHECK(true); GRANT SELECT,INSERT,UPDATE,DELETE ON ${table} TO authenticated;`);}
 await db.exec(readFileSync('supabase/migrations/20261110030000_scope_performance_tenants.sql','utf8'));
 await db.exec(`SET ROLE authenticated; SELECT set_config('test.company','${a}',false);`);
});
afterAll(async()=>{await db.close();});
it('isolates all direct and parent-linked reads despite permissive policies',async()=>{
 for(const table of [...direct,...Object.keys(linked)]){expect((await db.query(`SELECT id FROM ${table}`)).rows).toEqual([{id:a}]);}
});
it('blocks cross-tenant writes and allows in-scope inserts on each direct table',async()=>{
 for(const table of direct){
  await expect(db.exec(`INSERT INTO ${table} VALUES(null,'${b}')`)).rejects.toThrow(/row-level security/);
  await db.exec(`INSERT INTO ${table} VALUES(null,'${a}')`);
  await expect(db.exec(`UPDATE ${table} SET company_id='${b}' WHERE id='${a}'`)).rejects.toThrow(/row-level security/);
 }
});
it('rejects foreign or missing parents, preserving valid child inserts',async()=>{
 for(const [table,fk] of Object.entries(linked)){
  await expect(db.exec(`INSERT INTO ${table} VALUES(null,'${b}')`)).rejects.toThrow(/row-level security/);
  await expect(db.exec(`INSERT INTO ${table} VALUES(null,null)`)).rejects.toThrow(/row-level security/);
  await db.exec(`INSERT INTO ${table} VALUES(null,'${a}')`);
  await expect(db.exec(`UPDATE ${table} SET ${fk}='${b}' WHERE id='${a}'`)).rejects.toThrow(/row-level security/);
 }
});
it('prevents deleting records outside the tenant',async()=>{
 for(const table of [...direct,...Object.keys(linked)]){expect((await db.query(`DELETE FROM ${table} WHERE id='${b}' RETURNING id`)).rows).toEqual([]);}
});
