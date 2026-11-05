// Exact staging column shapes; authentication/Storage are isolated doubles.
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {readFile} from 'node:fs/promises';
import {sourceStatements,monthlyStatements} from '../../scripts/build-gkv-staging-sources.mjs';
const read=p=>readFile(new URL(p,import.meta.url),'utf8');
export async function stagingSourceFixture(){
 const db=new PGlite({extensions:{pgcrypto}});
 await db.exec("CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE SCHEMA auth; CREATE SCHEMA care_security; CREATE SCHEMA extensions; CREATE SCHEMA storage; CREATE EXTENSION pgcrypto WITH SCHEMA extensions;");
 await db.exec(String.raw`
 CREATE TABLE auth.users(id uuid PRIMARY KEY);
 CREATE TABLE auth.sessions(id uuid PRIMARY KEY,user_id uuid,not_after timestamptz);
 CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('test.claims',true),'')::jsonb,'{}'::jsonb) $$;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT (auth.jwt()->>'sub')::uuid $$;
 CREATE FUNCTION public.current_tenant_id() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT (auth.jwt()->>'tenant')::uuid $$;
 CREATE FUNCTION public.current_portal_type() RETURNS text LANGUAGE sql STABLE AS $$ SELECT auth.jwt()->>'portal' $$;
 CREATE FUNCTION public.current_portal_account_id() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT (auth.jwt()->>'account')::uuid $$;
 CREATE FUNCTION public.resolve_current_employee_id() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT (auth.jwt()->>'employee')::uuid $$;
 CREATE FUNCTION public.resolve_current_profile_id() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT auth.uid() $$;
 CREATE FUNCTION care_security.office_actor(t uuid,p text) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT t=public.current_tenant_id() AND public.current_portal_type()='business' $$;
 CREATE FUNCTION care_security.gkv_exchange_actor(t uuid,p text) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT care_security.office_actor(t,p) $$;
 CREATE FUNCTION care_security.generated_pdf_reader(p text) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
 CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text,name text,metadata jsonb);
 CREATE FUNCTION storage.foldername(p text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$ SELECT string_to_array(p,'/') $$;
 GRANT USAGE ON SCHEMA public,care_security,auth,storage TO authenticated,anon,service_role;
 `);
 const meta=JSON.parse(await read('./staging-source-schema.json'));
 for(const [name,labels] of Object.entries(meta.enums))await db.exec("CREATE TYPE "+name+" AS ENUM ("+labels.map(s=>"'"+s+"'").join(',')+");");
 for(const tab of [...new Set(meta.columns.map(c=>c.tab))]){
  const cols=meta.columns.filter(c=>c.tab===tab);
  const definitions=cols.map(c=>'"'+c.col+'" '+c.typ+(c.def!==null?' DEFAULT '+c.def:'')+(c.required?' NOT NULL':''));
  if(cols.some(c=>c.col==='id'))definitions.push('PRIMARY KEY(id)');
  else if(cols.some(c=>c.col==='tenant_id')&&!cols.some(c=>c.col==='role_id'))definitions.push('PRIMARY KEY(tenant_id)');
  await db.exec('CREATE TABLE public.'+tab+'('+definitions.join(',')+');');
 }
 await db.exec("ALTER TABLE invoices ADD CONSTRAINT invoices_status_check CHECK (status=ANY(ARRAY['entwurf'::text,'aktiv'::text,'in_bearbeitung'::text,'abgeschlossen'::text,'archiviert'::text,'fehlerhaft'::text,'gesperrt'::text]));");
 await db.exec(await read('../../docs/gkv/sql/staging-workflow-helpers.sql'));
 const original=await read('../../supabase/migrations/20261013072827_verified_assignment_service_records.sql');
 const start=original.indexOf('CREATE OR REPLACE FUNCTION public.workflow_canonical_json');
 const end=original.indexOf('CREATE OR REPLACE FUNCTION public.workflow_signed_proof_source');
 await db.exec(original.slice(start,end));
 await db.exec(await sourceStatements());
 // These grants already exist on hosted staging and are referenced by its
 // restrictive generated-document Storage policy installed by the bridge.
 await db.exec('ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY; GRANT SELECT ON public.invoices TO authenticated;');
 return {db,monthly:()=>monthlyStatements().then(sql=>db.exec(sql))};
}
