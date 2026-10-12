import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
const securitySql = readFileSync(new URL('../../docs/open-remediation-20261011/profile-and-portal-security.sql', import.meta.url), 'utf8');
const id = n => '00000000-0000-4000-8000-' + String(n).padStart(12,'0');

async function fixture() {
 const db=new PGlite();
 await db.exec([
 "CREATE ROLE authenticated", "CREATE ROLE anon", "CREATE ROLE service_role BYPASSRLS", "CREATE SCHEMA auth", "CREATE SCHEMA storage",
 "CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql AS 'SELECT string_to_array($1,''/'')'",
 "CREATE TABLE storage.objects(name text PRIMARY KEY,bucket_id text)",
 "GRANT USAGE ON SCHEMA storage TO authenticated", "GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO authenticated",
 "ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY", "CREATE POLICY old_storage_tenant_access ON storage.objects TO authenticated USING(true) WITH CHECK(true)",
 "CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS 'SELECT nullif(current_setting(''fixture.uid'',true),'''')::uuid'",
 "CREATE FUNCTION public.current_tenant_id() RETURNS uuid LANGUAGE sql AS 'SELECT nullif(current_setting(''fixture.tenant'',true),'''')::uuid'",
 "CREATE FUNCTION public.current_client_id() RETURNS uuid LANGUAGE sql AS 'SELECT nullif(current_setting(''fixture.client'',true),'''')::uuid'",
 "CREATE FUNCTION public.resolve_current_employee_id() RETURNS uuid LANGUAGE sql AS 'SELECT nullif(current_setting(''fixture.employee'',true),'''')::uuid'",
 "CREATE FUNCTION public.has_permission(text) RETURNS boolean LANGUAGE sql AS 'SELECT false'",
 "CREATE TABLE roles(id uuid PRIMARY KEY,key text,tenant_id uuid,is_admin_role boolean DEFAULT false)",
 "CREATE TABLE profiles(id uuid PRIMARY KEY,auth_user_id uuid,tenant_id uuid,role_id uuid,role_key text,status text,is_active boolean,display_name text,phone text,updated_at timestamptz DEFAULT now())",
 "CREATE TABLE clients(id uuid PRIMARY KEY,tenant_id uuid)", "CREATE TABLE employees(id uuid PRIMARY KEY,tenant_id uuid)",
 "CREATE TABLE assignments(id uuid PRIMARY KEY,tenant_id uuid,client_id uuid,employee_id uuid)",
 "CREATE TABLE assist_visits(id uuid PRIMARY KEY,tenant_id uuid,client_id uuid,employee_id uuid,employee_portal_visible boolean,planning_status text)",
 "CREATE TABLE employee_documents(id uuid PRIMARY KEY,tenant_id uuid,employee_id uuid,released_to_portal boolean,sensitive boolean,title text,storage_path text)",
 "CREATE TABLE client_documents(id uuid PRIMARY KEY,tenant_id uuid,client_id uuid,storage_path text,status text,sensitivity text,portal_visible boolean)",
 "GRANT USAGE ON SCHEMA public,auth TO authenticated", "GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO authenticated"
 ].join(';')+';');
 for(const table of ['profiles','clients','employees','assignments','assist_visits','employee_documents']) await db.exec('ALTER TABLE '+table+' ENABLE ROW LEVEL SECURITY; CREATE POLICY old_broad_policy ON '+table+' TO authenticated USING(tenant_id=public.current_tenant_id()) WITH CHECK(tenant_id=public.current_tenant_id())');
 for(const [role,key,admin] of [[1,'business_admin',true],[2,'employee_portal',false],[3,'client_portal',false]]) await db.query('INSERT INTO roles VALUES($1,$2,$3,$4)',[id(role),key,id(10),admin]);
 for(const [uid,role,key] of [[20,1,'business_admin'],[21,2,'employee_portal'],[22,3,'client_portal']]) await db.query('INSERT INTO profiles VALUES($1,$1,$2,$3,$4,$5,true,$6,$7)',[id(uid),id(10),id(role),key,'active',key,'1']);
 for(const [client,tenant] of [[30,10],[31,10],[32,11]]) await db.query('INSERT INTO clients VALUES($1,$2)',[id(client),id(tenant)]);
 for(const employee of [40,41]) await db.query('INSERT INTO employees VALUES($1,$2)',[id(employee),id(10)]);
 await db.query('INSERT INTO assignments VALUES($1,$2,$3,$4)',[id(50),id(10),id(31),id(40)]);
 for(const [document,employee,released,sensitive] of [[60,40,true,false],[61,40,false,false],[62,40,true,true],[63,41,true,false]]) await db.query('INSERT INTO employee_documents VALUES($1,$2,$3,$4,$5,$6)',[id(document),id(10),id(employee),released,sensitive,'Original']);
 const actor=async(user,employee=null,client=null)=>{
  await db.exec('RESET ROLE');
  await db.query("SELECT set_config('fixture.uid',$1,false),set_config('fixture.tenant',$2,false),set_config('fixture.employee',$3,false),set_config('fixture.client',$4,false)",[id(user),id(10),employee===null?'':id(employee),client===null?'':id(client)]);
  await db.exec('SET ROLE authenticated');
 };
 return {db,actor};
}

test('removes table and explicit column grants for identity fields, retaining contact updates',async()=>{
 const {db,actor}=await fixture();try{
  assert.equal((await db.query("SELECT has_column_privilege('authenticated','profiles','role_id','UPDATE') AS allowed")).rows[0].allowed,true);
  await db.exec('GRANT UPDATE(role_key) ON profiles TO authenticated'); await db.exec(securitySql); await actor(21,40);
  for(const column of ['id','tenant_id','role_id','role_key','auth_user_id','status','is_active']){
   assert.equal((await db.query("SELECT has_column_privilege('authenticated','profiles',$1,'UPDATE') AS allowed",[column])).rows[0].allowed,false,column);
   await assert.rejects(db.exec('UPDATE profiles SET '+column+'='+column),/permission denied/);
  }
  assert.equal((await db.query("UPDATE profiles SET phone='2' WHERE id=$1 RETURNING phone",[id(21)])).rows[0].phone,'2');
 }finally{await db.close();}
});
test('restricts employee and client reads despite permissive tenant rules',async()=>{
 const {db,actor}=await fixture();try{
  await db.exec(securitySql);await actor(21,40);
  assert.deepEqual((await db.query('SELECT id FROM clients ORDER BY id')).rows.map(x=>x.id),[id(31)]);
  assert.deepEqual((await db.query('SELECT id FROM employees ORDER BY id')).rows.map(x=>x.id),[id(40)]);
  await actor(22,null,30);
  assert.deepEqual((await db.query('SELECT id FROM clients ORDER BY id')).rows.map(x=>x.id),[id(30)]);
  assert.equal((await db.query('SELECT id FROM employees')).rows.length,0);
 }finally{await db.close();}
});
test('employees see only their released non-sensitive files and cannot modify any',async()=>{
 const {db,actor}=await fixture();try{
  await db.exec(securitySql);await actor(21,40);
  assert.deepEqual((await db.query('SELECT id FROM employee_documents ORDER BY id')).rows.map(x=>x.id),[id(60)]);
  assert.equal((await db.query("UPDATE employee_documents SET title='Changed' RETURNING id")).rows.length,0);
  assert.equal((await db.query('DELETE FROM employee_documents RETURNING id')).rows.length,0);
  await assert.rejects(db.query('INSERT INTO employee_documents(id,tenant_id,employee_id,released_to_portal,sensitive) VALUES($1,$2,$3,true,false)',[id(70),id(10),id(40)]),/row-level security/);
 }finally{await db.close();}
});
test('verified administration retains tenant access while another tenant stays hidden',async()=>{
 const {db,actor}=await fixture();try{
  await db.exec(securitySql);await actor(20);
  assert.deepEqual((await db.query('SELECT id FROM clients ORDER BY id')).rows.map(x=>x.id),[id(30),id(31)]);
  assert.equal((await db.query('SELECT id FROM employee_documents')).rows.length,4);
  assert.equal((await db.query("UPDATE employee_documents SET title='Checked' RETURNING id")).rows.length,4);
 }finally{await db.close();}
});
test('inactive profiles, mismatched role scopes and forged legacy id links do not obtain Office rights',async()=>{
 const {db,actor}=await fixture();try{
  await db.exec(securitySql);
  await db.query('UPDATE profiles SET is_active=false WHERE id=$1',[id(20)]);await actor(20);
  assert.equal((await db.query('SELECT id FROM clients')).rows.length,0);
  await db.exec('RESET ROLE');await db.query('UPDATE profiles SET is_active=true,auth_user_id=$1 WHERE id=$2',[id(99),id(20)]);await actor(20);
  assert.equal((await db.query('SELECT id FROM clients')).rows.length,0);
  await db.exec('RESET ROLE');await db.exec('UPDATE profiles SET auth_user_id=id');await db.query('UPDATE roles SET tenant_id=$1 WHERE id=$2',[id(11),id(1)]);await actor(20);
  assert.equal((await db.query('SELECT id FROM clients')).rows.length,0);
 }finally{await db.close();}
});
test('supports the staged global-role schema without roles.tenant_id',async()=>{
 const {db,actor}=await fixture();try{
  await db.exec('ALTER TABLE roles DROP COLUMN tenant_id');await db.exec(securitySql);await actor(20);
  assert.equal((await db.query('SELECT id FROM clients')).rows.length,2);
 }finally{await db.close();}
});
test('the role RPC permits verified administration and refuses portal and foreign-tenant mutations',async()=>{
 const {db,actor}=await fixture();try{
  await db.query('INSERT INTO roles VALUES($1,$2,$3,false)',[id(4),'billing',id(11)]);
  await db.query('INSERT INTO profiles(id,auth_user_id,tenant_id,role_id,status,is_active) VALUES($1,$1,$2,$3,$4,true)',[id(23),id(11),id(4),'active']);
  await db.exec(securitySql);await actor(21,40);
  await assert.rejects(db.query('SELECT care_security_set_profile_role($1,$2,$3)',[id(10),id(21),id(1)]),/Role administration denied/);
  await actor(20);
  await assert.rejects(db.query('SELECT care_security_set_profile_role($1,$2,$3)',[id(10),id(21),id(4)]),/Role scope mismatch/);
  await assert.rejects(db.query('SELECT care_security_set_profile_role($1,$2,$3)',[id(10),id(23),id(2)]),/Profile scope mismatch/);
  const receipt=(await db.query('SELECT care_security_set_profile_role($1,$2,$3) AS receipt',[id(10),id(21),id(2)])).rows[0].receipt;
  assert.deepEqual(receipt,{tenant_id:id(10),profile_id:id(21),role_id:id(2)});
 }finally{await db.close();}
});
test('generated PDF access follows confirmed release and ownership despite a broad old storage policy',async()=>{
 const {db,actor}=await fixture();try{
  const paths=[1,2,3,4].map(n=>`tenant/${id(10)}/generated/${id(80+n)}/original.pdf`);
  for(const name of paths) await db.query('INSERT INTO storage.objects VALUES($1,$2)',[name,'office-documents']);
  for(const [index,client,released,sensitivity] of [[0,30,true,'care'],[1,30,false,'care'],[2,31,true,'care'],[3,30,true,'restricted']]) {
   await db.query('INSERT INTO client_documents VALUES($1,$2,$3,$4,$5,$6,$7)',[id(81+index),id(10),id(client),paths[index],'aktiv',sensitivity,released]);
  }
  await db.exec(securitySql);await actor(22,null,30);
  assert.deepEqual((await db.query('SELECT name FROM storage.objects ORDER BY name')).rows.map(r=>r.name),[paths[0]]);
  await actor(20);assert.equal((await db.query('SELECT name FROM storage.objects')).rows.length,4);
  assert.equal((await db.query("UPDATE storage.objects SET name=name RETURNING name")).rows.length,0);
  assert.equal((await db.query('DELETE FROM storage.objects RETURNING name')).rows.length,0);
  await assert.rejects(db.query('INSERT INTO storage.objects VALUES($1,$2)',[`tenant/${id(10)}/generated/${id(90)}/forged.pdf`,'office-documents']),/row-level security/);
 }finally{await db.close();}
});
test('generated personnel and payroll PDFs remain scoped to the linked employee and confirmed records',async()=>{
 const {db,actor}=await fixture();try{
  const own=`tenant/${id(10)}/generated/${id(91)}/original.pdf`,foreign=`tenant/${id(10)}/generated/${id(92)}/original.pdf`;
  await db.query('UPDATE employee_documents SET storage_path=$1 WHERE id=$2',[own,id(60)]);
  await db.query('UPDATE employee_documents SET storage_path=$1 WHERE id=$2',[foreign,id(63)]);
  await db.query("INSERT INTO storage.objects VALUES($1,'office-documents'),($2,'office-documents')",[own,foreign]);
  await db.exec(securitySql);await actor(21,40);
  assert.deepEqual((await db.query('SELECT name FROM storage.objects')).rows.map(r=>r.name),[own]);
  await db.exec('RESET ROLE');await db.exec('CREATE TABLE payroll_month_statements(tenant_id uuid,employee_id uuid,pdf_path text)');
  await db.query('INSERT INTO payroll_month_statements VALUES($1,$2,$3)',[id(10),id(40),foreign]);
  await actor(21,40);assert.equal((await db.query('SELECT name FROM storage.objects')).rows.length,2);
 }finally{await db.close();}
});
test('PDF readiness is true only while the applied identity and storage protections remain intact',async()=>{
 const {db,actor}=await fixture();try{
  await db.exec(securitySql);await actor(20);
  assert.equal((await db.query('SELECT care_security_pdf_upload_ready() AS ready')).rows[0].ready,true);
  await db.exec('RESET ROLE; GRANT UPDATE(role_id) ON profiles TO authenticated');await actor(20);
  assert.equal((await db.query('SELECT care_security_pdf_upload_ready() AS ready')).rows[0].ready,false);
  await db.exec('RESET ROLE; REVOKE UPDATE(role_id) ON profiles FROM authenticated; DROP POLICY care_security_generated_pdf_read ON storage.objects');await actor(20);
  assert.equal((await db.query('SELECT care_security_pdf_upload_ready() AS ready')).rows[0].ready,false);
 }finally{await db.close();}
});
