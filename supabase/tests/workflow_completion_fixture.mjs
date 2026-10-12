// Synthetic catalogue-shaped PostgreSQL fixture. No Supabase calls or business rows.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const { PGlite }=require('@electric-sql/pglite');
const schema=JSON.parse(readFileSync(new URL('../../docs/workflow-server-schema-metadata-20261011.json',import.meta.url),'utf8'));
const intakeTemplates=JSON.parse(readFileSync(new URL('../../docs/workflow-server-intake-template-metadata-20261011.json',import.meta.url),'utf8'));
const additional=JSON.parse(readFileSync(new URL('../../docs/workflow-server-object-metadata-20261011.json',import.meta.url),'utf8'));
export const fixtureIds={tenant:'10000000-0000-4000-8000-000000000001',otherTenant:'10000000-0000-4000-8000-000000000002',auth:'20000000-0000-4000-8000-000000000001',profile:'30000000-0000-4000-8000-000000000001',otherProfile:'30000000-0000-4000-8000-000000000002',employee:'40000000-0000-4000-8000-000000000001',otherEmployee:'40000000-0000-4000-8000-000000000002',client:'50000000-0000-4000-8000-000000000001',otherClient:'50000000-0000-4000-8000-000000000002',document:'60000000-0000-4000-8000-000000000001',signature:'70000000-0000-4000-8000-000000000001',upload:'80000000-0000-4000-8000-000000000001'};
export const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB';
export const version='2026-10-11T09:00:00.000Z';
const quote=(value)=>"'"+String(value).replaceAll("'","''")+"'";
export async function createCompletionFixture(tables,drafts){
  const db=new PGlite();
  await db.exec(`CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role BYPASSRLS; CREATE SCHEMA auth; CREATE SCHEMA storage;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS 'SELECT nullif(current_setting(''fixture.auth'',true),'''')::uuid';
    CREATE FUNCTION public.current_tenant_id() RETURNS uuid LANGUAGE sql AS 'SELECT nullif(current_setting(''fixture.tenant'',true),'''')::uuid';
    CREATE FUNCTION public.current_role_key() RETURNS text LANGUAGE sql AS 'SELECT current_setting(''fixture.role'',true)';
    CREATE FUNCTION public.resolve_current_profile_id() RETURNS uuid LANGUAGE sql AS 'SELECT nullif(current_setting(''fixture.profile'',true),'''')::uuid';
    CREATE FUNCTION public.resolve_current_employee_id() RETURNS uuid LANGUAGE sql AS 'SELECT nullif(current_setting(''fixture.employee'',true),'''')::uuid';
    CREATE FUNCTION public.current_client_id() RETURNS uuid LANGUAGE sql AS 'SELECT nullif(current_setting(''fixture.client'',true),'''')::uuid';
    CREATE FUNCTION public.is_employee_portal_rls_context(uuid) RETURNS boolean LANGUAGE sql AS 'SELECT public.current_role_key()=''employee_portal'' AND $1=public.current_tenant_id()';
    CREATE FUNCTION public.is_client_portal_rls_context(uuid) RETURNS boolean LANGUAGE sql AS 'SELECT public.current_role_key() IN (''client_portal'',''family_portal'') AND $1=public.current_tenant_id()';
    CREATE FUNCTION public.is_internal_tenant_actor(uuid) RETURNS boolean LANGUAGE sql AS 'SELECT public.current_role_key() IN (''business_admin'',''office_staff'',''caregiver'',''nurse'') AND $1=public.current_tenant_id()';
    CREATE FUNCTION public.is_tenant_admin() RETURNS boolean LANGUAGE sql AS 'SELECT public.current_role_key()=''business_admin''';
    CREATE FUNCTION public.has_permission(text) RETURNS boolean LANGUAGE sql AS 'SELECT public.current_role_key() IN (''business_admin'',''office_staff'') AND $1 IN (''office.documents.signatures.manage'',''office.documents.signatures.view'',''office.documents.upload'',''office.clients.create'',''office.clients.edit'',''office.documents.view'',''office.employees.view'',''office.employees.edit'')';
    GRANT USAGE ON SCHEMA public,auth,storage TO authenticated,anon;
  `);
  const enums=new Map();
  for(const row of additional.enums){ const labels=enums.get(row.type)??[]; labels.push(row.label);enums.set(row.type,labels); }
  for(const [type,labels] of enums)await db.exec('CREATE TYPE public."'+type+'" AS ENUM ('+labels.map(quote).join(',')+');');
  for(const table of tables){
    const full=table.includes('.')?table:'public.'+table;
    const primaryColumns=full.startsWith('public.')?schema.columns.filter(c=>c.table===table.replace('public.','')):[];
    const columns=primaryColumns.length?primaryColumns:[...additional.columns,...intakeTemplates.columns].filter(c=>c.table===full);
    if(!columns.length)throw new Error('No confirmed catalogue columns for '+full);
    const definitions=columns.map(c=>'"'+c.column+'" '+(c.type.startsWith('_')?c.type.slice(1)+'[]':c.type)+(c.default?' DEFAULT '+c.default:'')+(c.column==='id'?' PRIMARY KEY':''));
    await db.exec('CREATE TABLE '+full+'('+definitions.join(',')+');');
    for(const constraint of schema.constraints.filter(c=>c.table===table && /^(UNIQUE|CHECK)/.test(c.definition)))await db.exec('ALTER TABLE '+full+' ADD CONSTRAINT "'+constraint.name+'" '+constraint.definition+';');
    await db.exec('GRANT SELECT,INSERT,UPDATE,DELETE ON '+full+' TO authenticated,service_role;');
    await db.exec('ALTER TABLE '+full+' ENABLE ROW LEVEL SECURITY; CREATE POLICY fixture_broad_tenant_policy ON '+full+' FOR ALL TO authenticated USING(true) WITH CHECK(true);');
  }
  for(const name of drafts)await db.exec(readFileSync(new URL('../../docs/'+name,import.meta.url),'utf8'));
  async function actor(role='employee_portal',overrides={}){
    await db.exec('RESET ROLE;');
    const v={auth:fixtureIds.auth,profile:fixtureIds.profile,tenant:fixtureIds.tenant,employee:fixtureIds.employee,client:fixtureIds.client,role,...overrides};
    await db.exec('SELECT '+Object.entries(v).map(([key,value])=>"set_config('fixture."+key+"',"+quote(value??'')+',false)').join(',')+'; SET ROLE authenticated;');
  }
  return {db,actor};
}
