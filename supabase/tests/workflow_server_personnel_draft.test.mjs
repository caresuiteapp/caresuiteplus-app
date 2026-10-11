import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {test} from 'node:test';
const require=createRequire(import.meta.url);const {PGlite}=require('@electric-sql/pglite');
const db=new PGlite();
const sql=readFileSync(new URL('../../docs/workflow-server-personnel-draft.sql',import.meta.url),'utf8');
const metadata=JSON.parse(readFileSync(new URL('../../docs/workflow-server-personnel-metadata-20261011.json',import.meta.url),'utf8'));
const tables=['employee_absences','employee_data_scopes','employee_audit_events','employee_background_checks',
 'employee_permission_overrides','employee_qualifications','employee_role_assignments','employee_work_settings',
 'employee_offboarding_sessions','employee_offboarding_steps','employee_offboarding_checks','employee_access_revocations','employee_final_clearance'];
const t='10000000-0000-0000-0000-000000000001',foreign='10000000-0000-0000-0000-000000000002';
const e='20000000-0000-0000-0000-000000000001',colleague='20000000-0000-0000-0000-000000000002',foreignEmployee='20000000-0000-0000-0000-000000000003';
const uid='30000000-0000-0000-0000-000000000001',profile='40000000-0000-0000-0000-000000000001';
await db.exec(`
CREATE ROLE authenticated;CREATE ROLE anon;CREATE ROLE service_role BYPASSRLS;CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS 'SELECT nullif(current_setting(''fixture.uid'',true),'''')::uuid';
CREATE FUNCTION current_tenant_id() RETURNS uuid LANGUAGE sql STABLE AS 'SELECT current_setting(''fixture.tenant'')::uuid';
CREATE FUNCTION current_role_key() RETURNS text LANGUAGE sql STABLE AS 'SELECT current_setting(''fixture.role'')';
CREATE FUNCTION current_portal_type() RETURNS text LANGUAGE sql STABLE AS 'SELECT nullif(current_setting(''fixture.portal''),'''')';
CREATE FUNCTION resolve_current_employee_id() RETURNS uuid LANGUAGE sql STABLE AS 'SELECT nullif(current_setting(''fixture.employee''),'''')::uuid';
CREATE FUNCTION is_employee_portal_rls_context(uuid) RETURNS boolean LANGUAGE sql STABLE AS
 'SELECT current_portal_type()=''employee'' AND current_role_key()=''employee_portal'' AND $1=current_tenant_id() AND auth.uid() IS NOT NULL';
CREATE FUNCTION has_permission(text) RETURNS boolean LANGUAGE sql STABLE AS
 'SELECT current_role_key() IN (''office'',''owner'') AND $1 IN (''office.employees.view'',''office.employees.edit'')';
CREATE FUNCTION is_tenant_admin() RETURNS boolean LANGUAGE sql STABLE AS 'SELECT current_role_key()=''owner''';
CREATE TABLE employees(id uuid PRIMARY KEY,tenant_id uuid,profile_id uuid,status text);
CREATE TABLE profiles(id uuid PRIMARY KEY,auth_user_id uuid,tenant_id uuid,status text,is_active boolean);
CREATE TABLE employee_documents(id int PRIMARY KEY,tenant_id uuid,employee_id uuid,sensitive boolean,category text,released_to_portal boolean);
ALTER TABLE employee_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY old_document_tenant ON employee_documents FOR ALL TO authenticated USING(tenant_id=current_tenant_id()) WITH CHECK(tenant_id=current_tenant_id());
GRANT USAGE ON SCHEMA public,auth TO authenticated,anon,service_role;
GRANT SELECT ON employees,profiles TO authenticated,service_role;
GRANT ALL ON employee_documents TO authenticated,service_role;
`);
await db.query('INSERT INTO employees VALUES($1,$2,$3,\'active\'),($4,$2,NULL,\'active\'),($5,$6,NULL,\'active\')',[e,t,profile,colleague,foreignEmployee,foreign]);
await db.query('INSERT INTO profiles VALUES($1,$2,$3,\'active\',true)',[profile,uid,t]);
for(const table of tables){
 await db.exec('CREATE TABLE '+table+'(id int PRIMARY KEY,tenant_id uuid,employee_id uuid,notes text);ALTER TABLE '+table+' ENABLE ROW LEVEL SECURITY;CREATE POLICY broad_tenant ON '+table+' FOR ALL TO authenticated USING(tenant_id=current_tenant_id()) WITH CHECK(tenant_id=current_tenant_id());GRANT ALL ON '+table+' TO service_role;');
 const grant=metadata.personnel.find(x=>x.name===table);
 const privileges=['select','insert','update','delete'].filter(k=>grant[k]);
 if(privileges.length)await db.exec('GRANT '+privileges.join(',')+' ON '+table+' TO authenticated;');
 await db.query('INSERT INTO '+table+' VALUES(1,$1,$2,\'own\'),(2,$1,$3,\'colleague\'),(3,$4,$5,\'foreign\')',[t,e,colleague,foreign,foreignEmployee]);
}
await db.query('INSERT INTO employee_documents VALUES(1,$1,$2,false,\'contract\',true),(2,$1,$3,false,\'contract\',true),(3,$1,$2,true,\'warning\',true),(4,$1,$2,false,\'contract\',false)',[t,e,colleague]);
async function actor(role='employee_portal',portal='employee',employee=e,user=uid){
 await db.exec('RESET ROLE');
 await db.query("SELECT set_config('fixture.uid',$1,false),set_config('fixture.tenant',$2,false),set_config('fixture.role',$3,false),set_config('fixture.portal',$4,false),set_config('fixture.employee',$5,false)",[user??'',t,role,portal??'',employee??'']);
 await db.exec('SET ROLE authenticated');
}
const ids=async table=>(await db.query('SELECT id FROM '+table+' ORDER BY id')).rows.map(r=>r.id);
await test('installed grants reproduce foreign personnel read/permission creation; absence already has no grant',async()=>{
 await actor();
 assert.deepEqual(await ids('employee_background_checks'),[1,2]);
 await db.query('INSERT INTO employee_permission_overrides VALUES(9,$1,$2,\'forged permission\')',[t,e]);
 await assert.rejects(db.query('SELECT * FROM employee_absences'),/permission denied/i);
 await db.exec('RESET ROLE');await db.query('DELETE FROM employee_permission_overrides WHERE id=9');
});
await test('draft applies twice without changing grants or synthetic rows',async()=>{
 await db.exec('RESET ROLE');
 const before=(await db.query('SELECT * FROM employee_background_checks ORDER BY id')).rows;
 await db.exec(sql);await db.exec(sql);
 assert.deepEqual((await db.query('SELECT * FROM employee_background_checks ORDER BY id')).rows,before);
 assert.equal((await db.query("SELECT has_table_privilege('authenticated','employee_absences','SELECT') AS ok")).rows[0].ok,false);
});
for(const table of tables.filter(t=>t!=='employee_absences')){
 await test(table+' restricts portal reads and blocks direct writes',async()=>{
  await actor();
  const ownReadable=['employee_data_scopes','employee_permission_overrides','employee_role_assignments','employee_work_settings'].includes(table);
  assert.deepEqual(await ids(table),ownReadable?[1]:[]);
  await assert.rejects(db.query('INSERT INTO '+table+' VALUES(99,$1,$2,\'forged\')',[t,e]),/row-level security/i);
  if(metadata.personnel.find(x=>x.name===table).update)
    assert.deepEqual((await db.query('UPDATE '+table+" SET notes='forged' WHERE id=1 RETURNING id")).rows,[]);
 });
}
await test('client/family actors have no private personnel access',async()=>{
 for(const role of ['client_portal','family_portal']){
  await actor(role,role==='client_portal'?'client':'relative');
  for(const table of ['employee_work_settings','employee_background_checks','employee_data_scopes'])assert.deepEqual(await ids(table),[]);
 }
});
await test('verified legacy employee profile links allow own config and released docs; null or revoked link denies',async()=>{
 await actor('employee',null);
 assert.deepEqual(await ids('employee_work_settings'),[1]);assert.deepEqual(await ids('employee_documents'),[1]);
 await actor('employee',null,e,'30000000-0000-0000-0000-000000000002');
 assert.deepEqual(await ids('employee_work_settings'),[]);
 await actor('employee',null,null);
 assert.deepEqual(await ids('employee_documents'),[]);
 await db.exec('RESET ROLE');await db.query("UPDATE profiles SET status='blocked' WHERE id=$1",[profile]);
 await actor('employee',null);
 assert.deepEqual(await ids('employee_work_settings'),[]);
 await db.exec('RESET ROLE');await db.query("UPDATE profiles SET status='active' WHERE id=$1",[profile]);
});
await test('Office keeps ordinary reads, administrator reads sensitive dossiers and actual owner key',async()=>{
 await actor('office',null);
 assert.deepEqual(await ids('employee_qualifications'),[1,2]);assert.deepEqual(await ids('employee_background_checks'),[]);
 assert.deepEqual(await ids('employee_documents'),[1,2,4]);
 await actor('owner',null);
 assert.deepEqual(await ids('employee_background_checks'),[1,2]);assert.deepEqual(await ids('employee_documents'),[1,2,3,4]);
 assert.deepEqual((await db.query("UPDATE employee_role_assignments SET notes='allowed' WHERE id=1 RETURNING id")).rows,[{id:1}]);
});
await test('Office cannot bind personnel record to an employee from another tenant',async()=>{
 await actor('owner',null);
 await assert.rejects(db.query('INSERT INTO employee_role_assignments VALUES(99,$1,$2,\'forged\')',[t,foreignEmployee]),/tenant mismatch/i);
 await assert.rejects(db.query('UPDATE employee_role_assignments SET employee_id=$1 WHERE id=1',[foreignEmployee]),/tenant mismatch/i);
});
await test('service-role completion and own valid personnel updates remain possible',async()=>{
 await db.exec('RESET ROLE;SET ROLE service_role');
 assert.deepEqual((await db.query("UPDATE employee_background_checks SET notes='confirmed' WHERE id=1 RETURNING id")).rows,[{id:1}]);
 await actor('office',null);
 assert.deepEqual((await db.query("UPDATE employee_qualifications SET notes='confirmed' WHERE id=2 RETURNING id")).rows,[{id:2}]);
});
await db.close();

