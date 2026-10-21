import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { companyFixture, id } from './company_access_fixture.mjs';
export { id };
export async function consultationFixture({ extensions = true } = {}){
 const f=await companyFixture();const {db,owner,actor}=f;await owner();
 await db.exec(`CREATE TABLE public.clients(id uuid PRIMARY KEY,tenant_id uuid,full_name text,first_name text,last_name text,street text,house_number text,postal_code text,city text,mobile text,phone text,care_level text,insurance_name text,insurance_number text,access_notes text,visible_notes_for_employee text,deleted_at timestamptz);
 CREATE TABLE public.employee_portal_accounts(id uuid PRIMARY KEY,tenant_id uuid,employee_id uuid,auth_user_id uuid,status text);
 CREATE FUNCTION public.current_role_key() RETURNS text LANGUAGE sql AS 'SELECT auth.jwt()->''app_metadata''->>''role_key''';
 CREATE FUNCTION public.current_portal_account_id() RETURNS uuid LANGUAGE sql AS 'SELECT (auth.jwt()->''app_metadata''->>''portal_account_id'')::uuid';
 CREATE FUNCTION public.tenant_has_platform_module(text,uuid) RETURNS boolean LANGUAGE sql AS 'SELECT CASE WHEN $1=''consulting'' THEN coalesce(nullif(current_setting(''fixture.module_enabled'',true),''''),''true'')::boolean ELSE NULL END';`);
 await db.query("INSERT INTO clients(id,tenant_id,full_name,care_level,street,house_number,postal_code,city,insurance_name) VALUES($1,$2,'Erika Sommer','3','Musterstraße','12','10115','Berlin','Beispiel-Pflegekasse'),($3,$4,'Andere Organisation','4','Beispielweg','2','20095','Hamburg','Testkasse')",[id(50),id(10),id(51),id(11)]);
 await db.query("UPDATE employees SET first_name='Mara',last_name='Becker' WHERE id=$1",[id(41)]);
 await db.query("INSERT INTO employee_portal_accounts VALUES($1,$2,$3,$4,'active')",[id(60),id(10),id(41),id(122)]);
 await db.exec(readFileSync(new URL('../migrations/20261019202713_consultation_workspace.sql',import.meta.url),'utf8'));
 if(extensions) {
  await db.exec(readFileSync(new URL('../migrations/20261021063230_consultation_followups_templates.sql',import.meta.url),'utf8'));
  await db.exec(readFileSync(new URL('../changes/consultation_central_contact.sql',import.meta.url),'utf8'));
 }
 const portal=()=>actor(22,10,{app_metadata:{role_key:'employee_portal',portal_account_id:id(60)}});
 const load=async(employee=false,caseId=null,tenant=id(10))=>(await db.query('SELECT public.consultation_workspace_load($1,$2,$3) AS r',[tenant,employee,caseId])).rows[0].r;
 const mutate=async(action,data={},e=null,request=randomUUID(),tenant=id(10))=>(await db.query('SELECT public.consultation_workspace_mutate($1,$2,$3,$4,$5,$6) AS r',[tenant,action,request,e?.encounter_id??e?.id??null,e?.version??null,JSON.stringify(data)])).rows[0].r;
 await actor();return {...f,portal,load,mutate};
}
