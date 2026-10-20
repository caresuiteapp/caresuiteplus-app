// Isolated PostgreSQL policy validation with synthetic rows. No remote writes.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
const require = createRequire(import.meta.url);
const { PGlite } = require('@electric-sql/pglite');
const db = new PGlite();
const draft = readFileSync(new URL('../../docs/employee-portal-release-gates.sql', import.meta.url), 'utf8');
const tenant = '10000000-0000-0000-0000-000000000001';
const otherTenant = '10000000-0000-0000-0000-000000000002';
const employee = '20000000-0000-0000-0000-000000000001';
const colleague = '20000000-0000-0000-0000-000000000002';
const prefix = 'tenant/' + tenant + '/employees/';

await db.exec(`
CREATE ROLE authenticated;
CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA storage;
CREATE FUNCTION current_tenant_id() RETURNS uuid LANGUAGE sql AS
  'SELECT current_setting(''fixture.tenant'')::uuid';
CREATE FUNCTION resolve_current_employee_id() RETURNS uuid LANGUAGE sql AS
  'SELECT nullif(current_setting(''fixture.employee''),'''')::uuid';
CREATE FUNCTION current_role_key() RETURNS text LANGUAGE sql AS
  'SELECT current_setting(''fixture.role'')';
CREATE FUNCTION is_employee_portal_rls_context(uuid) RETURNS boolean LANGUAGE sql AS
  'SELECT current_role_key()=''employee_portal'' AND $1=current_tenant_id()';
CREATE FUNCTION is_internal_tenant_actor(uuid) RETURNS boolean LANGUAGE sql AS
  'SELECT current_role_key() IN (''business_admin'',''business_manager'',''office_staff'') AND $1=current_tenant_id()';
CREATE FUNCTION has_permission(text) RETURNS boolean LANGUAGE sql AS
  'SELECT current_role_key() IN (''business_admin'',''business_manager'',''office_staff'') AND $1 IN (''office.employees.view'',''office.employees.edit'')';
CREATE FUNCTION is_tenant_admin() RETURNS boolean LANGUAGE sql AS
  'SELECT current_role_key()=''business_admin''';
CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql AS
  'SELECT string_to_array($1,''/'')';
CREATE TABLE employee_documents(id int primary key,tenant_id uuid,employee_id uuid,category text,sensitive boolean,released_to_portal boolean,storage_path text,title text);
CREATE TABLE employee_portal_accounts(id int primary key,tenant_id uuid,employee_id uuid,status text,password_hash text);
CREATE TABLE storage.objects(id int primary key,bucket_id text,name text);
ALTER TABLE employee_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_portal_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
CREATE POLICY employee_documents_tenant ON employee_documents FOR ALL TO authenticated
  USING(tenant_id=current_tenant_id()) WITH CHECK(tenant_id=current_tenant_id());
CREATE POLICY employee_portal_accounts_insert ON employee_portal_accounts FOR INSERT TO public
  WITH CHECK(tenant_id=current_tenant_id());
CREATE POLICY employee_portal_accounts_update ON employee_portal_accounts FOR UPDATE TO public
  USING(tenant_id=current_tenant_id()) WITH CHECK(tenant_id=current_tenant_id());
CREATE POLICY account_read_fixture ON employee_portal_accounts FOR SELECT TO authenticated
  USING(tenant_id=current_tenant_id() AND (employee_id=resolve_current_employee_id() OR is_internal_tenant_actor(tenant_id)));
CREATE POLICY office_docs_select ON storage.objects FOR SELECT TO authenticated
  USING(bucket_id='office-documents' AND (storage.foldername(name))[1]='tenant' AND (storage.foldername(name))[2]=current_tenant_id()::text);
CREATE POLICY office_docs_update ON storage.objects FOR UPDATE TO authenticated
  USING(bucket_id='office-documents' AND (storage.foldername(name))[1]='tenant' AND (storage.foldername(name))[2]=current_tenant_id()::text)
  WITH CHECK(bucket_id='office-documents' AND (storage.foldername(name))[1]='tenant' AND (storage.foldername(name))[2]=current_tenant_id()::text);
CREATE POLICY storage_insert_fixture ON storage.objects FOR INSERT TO authenticated
  WITH CHECK(bucket_id='office-documents' AND (storage.foldername(name))[2]=current_tenant_id()::text);
GRANT USAGE ON SCHEMA public,storage TO authenticated,service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON employee_documents,storage.objects TO authenticated,service_role;
GRANT INSERT,UPDATE ON employee_portal_accounts TO authenticated;
GRANT SELECT(id,tenant_id,employee_id,status) ON employee_portal_accounts TO authenticated;
GRANT ALL ON employee_portal_accounts TO service_role;
`);
const quote = (value) => "'" + value.replaceAll("'", "''") + "'";
await db.exec('SELECT set_config(\'fixture.tenant\',' + quote(tenant) + ',false),set_config(\'fixture.employee\',' + quote(employee) + ',false),set_config(\'fixture.role\',\'employee_portal\',false);');
const docs = [
  [1,tenant,employee,'contract',false,true],
  [2,tenant,colleague,'contract',false,true],
  [3,tenant,employee,'qualification',true,true],
  [4,tenant,employee,'contract',false,false],
  [5,tenant,employee,'warning',false,true],
  [6,tenant,employee,'termination',false,true],
  [7,otherTenant,employee,'contract',false,true],
];
for (const [id,t,e,category,sensitive,released] of docs) {
  const path = 'tenant/' + t + '/employees/' + e + '/doc-' + id + '/original.pdf';
  await db.query('INSERT INTO employee_documents VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[id,t,e,category,sensitive,released,path,'document-'+id]);
  await db.query('INSERT INTO storage.objects VALUES($1,$2,$3)',[id,'office-documents',path]);
}
await db.query('INSERT INTO employee_portal_accounts VALUES(1,$1,$2,\'active\',\'synthetic\')',[tenant,employee]);
await db.query('INSERT INTO storage.objects VALUES(8,\'office-documents\',$1),(9,\'office-documents\',$2),(10,\'office-documents\',$3)',[
  prefix+employee+'/portal-uploads/upload-a/file.pdf',
  prefix+colleague+'/portal-uploads/upload-b/file.pdf',
  'tenant/'+tenant+'/assist/visits/visit-a/proofs/complete.pdf',
]);
const asRole = (role) => db.exec('RESET ROLE; SELECT set_config(\'fixture.role\','+quote(role)+',false); SET ROLE authenticated;');
const ids = async (table) => (await db.query('SELECT id FROM '+table+' ORDER BY id')).rows.map(r=>r.id);
const insertDoc = () => db.query('INSERT INTO employee_documents VALUES(99,$1,$2,\'contract\',false,true,null,\'forged\')',[tenant,employee]);

await test('reproduces tenant-wide foreign and unreleased personal reads before draft',async()=>{
  await asRole('employee_portal');
  assert.deepEqual(await ids('employee_documents'),[1,2,3,4,5,6]);
  const changed=await db.query("UPDATE employee_documents SET title='changed by colleague' WHERE id=2 RETURNING id");
  assert.deepEqual(changed.rows,[{id:2}]);
});
await test('reproduces raw foreign personal Storage reads and direct account INSERT before draft',async()=>{
  assert.deepEqual(await ids('storage.objects'),[1,2,3,4,5,6,8,9,10]);
  await db.query('INSERT INTO employee_portal_accounts VALUES(2,$1,$2,\'active\',\'synthetic-other\')',[tenant,colleague]);
  assert.equal((await db.query("SELECT has_table_privilege('authenticated','employee_portal_accounts','SELECT') AS allowed")).rows[0].allowed,false);
});
await test('draft is idempotent and does not change personal data',async()=>{
  await db.exec('RESET ROLE;');
  const before=(await db.query('SELECT * FROM employee_documents ORDER BY id')).rows;
  await db.exec(draft); await db.exec(draft);
  assert.deepEqual((await db.query('SELECT * FROM employee_documents ORDER BY id')).rows,before);
  await asRole('employee_portal');
});
await test('own released non-sensitive document alone is visible',async()=>{
  assert.deepEqual(await ids('employee_documents'),[1]);
});
await test('raw own hidden, sensitive and foreign personal files are inaccessible',async()=>{
  assert.deepEqual(await ids('storage.objects'),[1,8,10]);
});
await test('client and family portals cannot read personal documents or private employee files',async()=>{
  for(const role of ['client_portal','family_portal']){
    await asRole(role);
    assert.deepEqual(await ids('employee_documents'),[]);
    assert.deepEqual(await ids('storage.objects'),[10]);
  }
  await asRole('employee_portal');
});
await test('employee cannot insert self-released documents; legacy archive still needs server RPC',async()=>{
  await assert.rejects(insertDoc,/row-level security/i);
});
await test('employee cannot update or delete personal metadata after release',async()=>{
  assert.deepEqual((await db.query("UPDATE employee_documents SET title='forged' WHERE id=1 RETURNING id")).rows,[]);
  assert.deepEqual((await db.query('DELETE FROM employee_documents WHERE id=1 RETURNING id')).rows,[]);
  assert.deepEqual(await ids('employee_documents'),[1]);
});
await test('employee and client cannot create or alter portal account records',async()=>{
  for(const role of ['employee_portal','client_portal']){
    await asRole(role);
    await assert.rejects(db.query('INSERT INTO employee_portal_accounts VALUES(99,$1,$2,\'active\',\'synthetic\')',[tenant,colleague]),/row-level security/i);
    assert.deepEqual((await db.query("UPDATE employee_portal_accounts SET status='blocked' WHERE id=1 RETURNING id")).rows,[]);
  }
});
await test('Office keeps authorized personal reads including explicit admin-sensitive categories',async()=>{
  await asRole('business_admin');
  assert.deepEqual(await ids('employee_documents'),[1,2,3,4,5,6]);
  await asRole('office_staff');
  assert.deepEqual(await ids('employee_documents'),[1,2,4]);
  assert.deepEqual(await ids('storage.objects'),[1,2,4,8,9,10]);
});
await test('authorized Office account edits and personal archive writes remain available',async()=>{
  await asRole('business_admin');
  assert.deepEqual((await db.query("UPDATE employee_portal_accounts SET status='blocked' WHERE id=1 RETURNING id")).rows,[{id:1}]);
  await insertDoc();
  assert.deepEqual((await db.query('DELETE FROM employee_documents WHERE id=99 RETURNING id')).rows,[{id:99}]);
});
await test('employee uploads require the own upload directory and cannot overwrite personal files',async()=>{
  await asRole('employee_portal');
  await db.query('INSERT INTO storage.objects VALUES(99,\'office-documents\',$1)',[prefix+employee+'/portal-uploads/new/file.pdf']);
  await assert.rejects(db.query('INSERT INTO storage.objects VALUES(100,\'office-documents\',$1)',[prefix+colleague+'/portal-uploads/new/file.pdf']),/row-level security/i);
  await assert.rejects(db.query('INSERT INTO storage.objects VALUES(101,\'office-documents\',$1)',[prefix+employee+'/new/original.pdf']),/row-level security/i);
  assert.deepEqual((await db.query("UPDATE storage.objects SET name=name||'.changed' WHERE id=1 RETURNING id")).rows,[]);
});
await test('service role completion and first-login writes bypass authenticated ceilings',async()=>{
  await db.exec('RESET ROLE; SET ROLE service_role;');
  assert.deepEqual((await db.query("UPDATE employee_portal_accounts SET status='active' WHERE id=1 RETURNING id")).rows,[{id:1}]);
  await insertDoc();
  await db.query('DELETE FROM employee_documents WHERE id=99');
});
await test('other Storage path families are unchanged and therefore not declared repaired',async()=>{
  await asRole('employee_portal');
  assert.deepEqual((await db.query('SELECT id FROM storage.objects WHERE id=10')).rows,[{id:10}]);
});
await db.close();
