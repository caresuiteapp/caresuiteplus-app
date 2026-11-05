// Hosted staging ONLY. No application test ever substitutes a fabricated JWT.
// Config holds random test passwords/tokens outside the repository, mode 0600.
import {readFile,writeFile,access} from 'node:fs/promises';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
const file=new URL('../../gkv-stage-run.json',import.meta.url);
const publicConfig=new URL('../../gkv-stage-public.json',import.meta.url);
const save=s=>writeFile(file,JSON.stringify(s,null,2),{mode:0o600});
const q=s=>"'"+s.replaceAll("'","''")+"'";
const mode=process.argv[2];
let s;
if(mode==='--init'){
 let exists=false;try{await access(file);exists=true}catch(e){if(e.code!=='ENOENT')throw e}if(exists)throw Error('Existing staging run must be retired and archived first');
 const p=JSON.parse(await readFile(publicConfig,'utf8'));
 if(p.url!=='https://shwpweerzsfkqaivmaoc.supabase.co')throw Error('Staging only');
 s={...p,runId:randomUUID(),tenant:randomUUID(),role:randomUUID(),employee:randomUUID(),client:randomUUID(),otherClient:randomUUID(),createdAt:new Date().toISOString(),checks:[],users:{}};
 const db=new PGlite({extensions:{pgcrypto}});await db.exec('CREATE EXTENSION pgcrypto;');
 try{for(const name of ['office','employee','client','otherClient']){
  const id=randomUUID(),password=randomBytes(32).toString('base64url');
  const passwordHash=(await db.query("SELECT crypt($1,gen_salt('bf',10)) h",[password])).rows[0].h;
  s.users[name]={id,password,passwordHash,email:'gkv-qa-'+id+'@example.invalid',account:randomUUID()};
 }}finally{await db.close()}
 await save(s);console.log(JSON.stringify({created:s.runId,tenant:s.tenant,accounts:4}));
}else{
 s=JSON.parse(await readFile(file,'utf8'));
 if(s.url!=='https://shwpweerzsfkqaivmaoc.supabase.co')throw Error('Staging only');
}
export async function api(who,path,body,method=body===undefined?'GET':'POST'){
 const user=s.users[who];const headers={apikey:s.key,'Content-Type':'application/json',Prefer:'return=representation'};
 if(user?.token)headers.Authorization='Bearer '+user.token;
 let r;try{r=await fetch(s.url+path,{method,headers,signal:AbortSignal.timeout(45000),body:body===undefined?undefined:JSON.stringify(body)});}catch(e){throw Error(method+' '+path+': '+e.name,{cause:e});}
 const text=await r.text();let data;try{data=JSON.parse(text)}catch{data=text}
 return {status:r.status,ok:r.ok,data};
}
export async function must(who,path,body,method){
 const r=await api(who,path,body,method);if(!r.ok)throw Error(JSON.stringify({who,path,status:r.status,error:r.data}).slice(0,1500));return r.data;
}
export const rpc=(who,name,args)=>must(who,'/rest/v1/rpc/'+name,args);
if(mode==='--seed-sql'){
 let sql="BEGIN; SET LOCAL lock_timeout='3s'; SET LOCAL statement_timeout='30s';\n"+
 "DO $$ BEGIN IF to_regprocedure('public.gkv_assist_amend_description(uuid,uuid,uuid,jsonb)') IS NULL OR NOT EXISTS(SELECT FROM supabase_migrations.schema_migrations WHERE name='gkv_staging_canonical_sources_and_invoice_bridge') THEN RAISE EXCEPTION 'Wrong staging target'; END IF; END $$;\n";
 sql+="INSERT INTO public.tenants(id,name,legal_name,street,house_number,postal_code,city,country,tax_number) VALUES("+q(s.tenant)+",'GKV TEST "+s.runId+"','Synthetische GKV-Testeinrichtung','Testweg','1','10115','Berlin','Deutschland','TEST-KEINE-STEUERNUMMER');\n";
 sql+="INSERT INTO public.roles(id,key,name,is_admin_role) VALUES("+q(s.role)+",'gkv_test_"+s.runId+"','Befristete GKV Testrolle',false);\n";
 const permissions=['office.invoices.view','office.invoices.create','office.invoices.status_change','office.clients.view','office.clients.edit','office.employees.view','office.employees.edit','assist.records.create'];
 for(const p of permissions)sql+="INSERT INTO public.role_permissions(role_id,permission_key,can_view,can_create,can_update) VALUES("+q(s.role)+","+q(p)+",true,true,true);\n";
 for(const [who,u] of Object.entries(s.users)){
  const portal=who==='office'?'business':who==='employee'?'employee':'client';
  const role=portal==='business'?'gkv_test_'+s.runId:portal+'_portal';
  const meta={provider:'email',providers:['email'],portal_type:portal,role_key:role,...(portal!=='business'?{portal_account_id:u.account}:{})};
  sql+="INSERT INTO auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change) VALUES('00000000-0000-0000-0000-000000000000',"+q(u.id)+",'authenticated','authenticated',"+q(u.email)+","+q(u.passwordHash)+",clock_timestamp(),"+q(JSON.stringify(meta))+"::jsonb,'{\"display_name\":\"Synthetisches GKV Testkonto\"}'::jsonb,now(),now(),'','','','');\n";
  sql+="INSERT INTO auth.identities(provider_id,user_id,identity_data,provider,created_at,updated_at) VALUES("+q(u.id)+","+q(u.id)+","+q(JSON.stringify({sub:u.id,email:u.email,email_verified:true}))+"::jsonb,'email',now(),now());\n";
  sql+="UPDATE public.profiles SET tenant_id="+q(s.tenant)+",auth_user_id="+q(u.id)+",role_id="+(portal==='business'?q(s.role):"(SELECT id FROM public.roles WHERE key="+q(role)+")")+",role_key="+q(role)+",is_active=true,status='active' WHERE id="+q(u.id)+";\n";
 }
 sql+="INSERT INTO public.employees(id,tenant_id,profile_id,first_name,last_name,employee_number) VALUES("+[s.employee,s.tenant,s.users.employee.id,'Test','Pflegekraft','QA-'+s.runId].map(q).join(',')+");\n";
 sql+="INSERT INTO public.employee_portal_accounts(id,tenant_id,employee_id,username,auth_user_id,status,must_change_password,first_login_completed) VALUES("+[s.users.employee.account,s.tenant,s.employee,'gkv_qa_'+s.runId,s.users.employee.id,'active'].map(q).join(',')+",false,true);\n";
 for(const who of ['client','otherClient']){
  sql+="INSERT INTO public.clients(id,tenant_id,first_name,last_name,insurance_number,street,house_number,postal_code,city,country) VALUES("+[s[who],s.tenant,'Test',who==='client'?'Klient':'Anderer Klient','A123456789','Testweg','2','10115','Berlin','Deutschland'].map(q).join(',')+");\n";
  sql+="INSERT INTO public.client_portal_access(id,tenant_id,client_id,portal_enabled,status,auth_user_id) VALUES("+[s.users[who].account,s.tenant,s[who]].map(q).join(',')+",true,'aktiv',"+q(s.users[who].id)+");\n";
 }
 sql+="INSERT INTO care_security.gkv_monthly_responsibilities VALUES("+q(s.tenant)+","+q(s.users.office.id)+",now()+interval '6 hours',NULL,"+q(s.users.office.id)+",'Ausschließlich synthetische Stagingprüfung');\n";
 sql+="COMMIT;";await writeFile(new URL('../../gkv-stage-seed.sql',import.meta.url),sql,{mode:0o600});console.log(JSON.stringify({seedPrepared:true,run:s.runId}));
}
if(mode==='--login'){
 for(const [who,u] of Object.entries(s.users)){
  const data=await must(who,'/auth/v1/token?grant_type=password',{email:u.email,password:u.password});
  if(data.user.id!==u.id||!data.access_token)throw Error('Unexpected authenticated identity');
  u.token=data.access_token;u.refresh=data.refresh_token;await save(s);
  const me=await must(who,'/auth/v1/user');if(me.id!==u.id)throw Error('Wrong live identity');
  s.checks.push({check:'real_auth_'+who,at:new Date().toISOString(),passed:true});
  console.log(JSON.stringify({authenticated:who,identityVerified:true}));
 }
 await save(s);
}
if(mode==='--retire-sql'){
 if(!s.invoiceId||!s.monthlyFinal||!s.checks.some(c=>c.check==='final_hosted_invoice_monthly_source_and_original_chain_agree'))throw Error('Complete and verify this run first');
 const ids=Object.values(s.users).map(u=>q(u.id)).join(',');
 const sql="BEGIN; SET LOCAL lock_timeout='3s'; SET LOCAL statement_timeout='20s';\n"+
 "DO $$ BEGIN IF NOT EXISTS(SELECT FROM public.tenants WHERE id="+q(s.tenant)+" AND name="+q('GKV TEST '+s.runId)+") OR (SELECT count(*) FROM public.profiles WHERE tenant_id="+q(s.tenant)+" AND id IN ("+ids+"))<>4 THEN RAISE EXCEPTION 'Synthetic test scope changed'; END IF; END $$;\n"+
 "UPDATE public.profiles SET is_active=false WHERE tenant_id="+q(s.tenant)+" AND id IN ("+ids+");\n"+
 "UPDATE public.employee_portal_accounts SET status='blocked' WHERE tenant_id="+q(s.tenant)+" AND auth_user_id IN ("+ids+");\n"+
 "UPDATE public.client_portal_access SET portal_enabled=false WHERE tenant_id="+q(s.tenant)+" AND auth_user_id IN ("+ids+");\n"+
 "UPDATE care_security.gkv_monthly_responsibilities SET revoked_at=clock_timestamp() WHERE tenant_id="+q(s.tenant)+" AND actor_id IN ("+ids+");\n"+
 "UPDATE care_security.gkv_monthly_worker_keys SET revoked_at=clock_timestamp() WHERE tenant_id="+q(s.tenant)+" AND key_id="+q(s.monthlyHost.keyId)+";\n"+
 "UPDATE auth.users SET banned_until=now()+interval '100 years',updated_at=now() WHERE id IN ("+ids+");\n"+
 "DELETE FROM auth.sessions WHERE user_id IN ("+ids+");\nCOMMIT;";
 await writeFile(new URL('../../gkv-stage-retire.sql',import.meta.url),sql,{mode:0o600});console.log('Prepared retirement of this run only');
}
if(mode==='--retired-check'){
 for(const [who,u] of Object.entries(s.users)){
  const r=await api(who,'/auth/v1/token?grant_type=password',{email:u.email,password:u.password});
  if(r.ok||r.data?.error_code!=='user_banned')throw Error('Expected explicit banned test user: '+who);
 }
 const r=await api('client','/rest/v1/assist_visit_proofs?id=eq.'+s.visit.proof+'&select=id');
 if(r.ok&&r.data.length!==0)throw Error('Retired client still reads the source');
 s.retiredAt=new Date().toISOString();s.checks.push({check:'four_test_users_banned_and_old_client_session_denied',passed:true,at:s.retiredAt});await save(s);console.log('All four test logins and old client source access denied');
}
export {s,save,q};
