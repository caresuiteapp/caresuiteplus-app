// Existing PGlite harness, synthetic records only. SQL receipt -> actual app
// decoder contract; no remote auth/JWT validation or production writes claimed.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import ts from 'typescript';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const meta=JSON.parse(read('../../docs/store/android-family-portal-scope-metadata-20261026.json'));
const sql=read('../../docs/store/android-family-portal-scope-review.sql');
const id=n=>`80000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const t=id(1),account=id(2),user=id(3),client=id(4),contact=id(5),permission=id(6);
const db=new PGlite();
await db.exec(`CREATE ROLE authenticated;CREATE ROLE anon;CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('test.uid',true),'')::uuid$$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$SELECT coalesce(nullif(current_setting('test.jwt',true),''),'{}')::jsonb$$;
CREATE FUNCTION current_tenant_id() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('test.tenant',true),'')::uuid$$;
CREATE TABLE client_portal_access(id uuid,auth_user_id uuid,client_id uuid,tenant_id uuid,portal_enabled boolean,status text);
CREATE TABLE client_portal_codes(id uuid,auth_user_id uuid,client_id uuid,tenant_id uuid,status text,expires_at timestamptz);`);
for(const table of ['relative_portal_codes','portal_access_permissions']){
 const columns=meta.columns.filter(c=>c.table_name===table).map(c=>`"${c.column_name}" ${c.data_type==='timestamp with time zone'?'timestamptz':c.data_type}`);
 await db.exec(`CREATE TABLE ${table}(${columns.join(',')});`);
}
for(const helper of meta.helpers)await db.exec(helper.definition+';');
await db.exec('GRANT USAGE ON SCHEMA public,auth TO authenticated,anon;GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public,auth TO authenticated,anon;');
await db.exec(sql);
const module={exports:{}};
new Function('module','exports',ts.transpileModule(read('../../src/lib/portal/familyPortalAccessScope.ts'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(module,module.exports);
const {decodeFamilyPortalAccessScope,familyPortalAllows}=module.exports;
async function actor(change={}){
 await db.exec('RESET ROLE');
 const c={uid:user,tenant:t,portal:'relative',account,...change};
 await db.query("SELECT set_config('test.uid',$1,false),set_config('test.tenant',$2,false),set_config('test.jwt',$3,false)",[c.uid,c.tenant,JSON.stringify({role:'authenticated',app_metadata:{portal_type:c.portal,portal_account_id:c.account},user_metadata:c.user_metadata??{}})]);
 await db.exec('SET ROLE authenticated');
}
async function reset(){
 await db.exec('RESET ROLE;TRUNCATE relative_portal_codes,portal_access_permissions');
 await db.query(`INSERT INTO relative_portal_codes(id,tenant_id,client_id,relative_contact_id,auth_user_id,status,created_at,expires_at)
 VALUES($1,$2,$3,$4,$5,'active',now()-interval '1 day',now()+interval '1 day')`,[account,t,client,contact,user]);
 await db.query(`INSERT INTO portal_access_permissions(id,tenant_id,portal_type,portal_account_id,can_view_appointments,can_view_documents,can_view_messages,can_send_messages,can_view_service_records,can_view_invoices,can_download_documents,can_confirm_appointments,can_sign_records,created_at,updated_at)
 VALUES($1,$2,'relative',$3,true,true,false,false,true,false,false,true,false,now(),now())`,[permission,t,account]);
 await actor();
}
const scope=async()=> (await db.query('SELECT * FROM current_family_portal_access_scope()')).rows;
const mutate=async text=>{await db.exec('RESET ROLE;'+text+';SET ROLE authenticated');};
await test('missing active family scope RPC returns exact Auth account/tenant/client/contact and real capability receipt',async()=>{
 await reset();const [row]=await scope();assert.equal(row.tenant_id,t);assert.equal(row.account_id,account);assert.equal(row.client_id,client);assert.equal(row.relative_contact_id,contact);
 const decoded=decodeFamilyPortalAccessScope(row,{tenantId:t,accountId:account});assert.ok(decoded);assert.equal(decoded.relativeContactId,contact);
 assert.equal(familyPortalAllows(decoded,'appointments'),true);assert.equal(familyPortalAllows(decoded,'documents'),true);assert.equal(familyPortalAllows(decoded,'messages'),false);
 const [{client_id}]= (await db.query('SELECT current_client_id() AS client_id')).rows;assert.equal(client_id,client);
});
await test('family scope denies unlinked, NULL, cross-tenant, wrong account and other portal actors',async()=>{
 for(const change of [{uid:''},{uid:id(80)},{tenant:''},{tenant:id(81)},{account:id(82)},{account:''},{portal:'client'},{portal:'employee'},{portal:'business'},{portal:'',user_metadata:{portal_type:'relative',portal_account_id:account}}]){
  await reset();await actor(change);assert.deepEqual(await scope(),[]);
 }
});
await test('revoked/blocked/expired/future/missing grants fail closed without mutating account or permissions',async()=>{
 for(const mutation of ["UPDATE relative_portal_codes SET status='revoked'","UPDATE relative_portal_codes SET status='blocked'","UPDATE relative_portal_codes SET status='expired'","UPDATE relative_portal_codes SET expires_at=now()-interval '1 second'","UPDATE relative_portal_codes SET created_at=now()+interval '1 day'",'DELETE FROM portal_access_permissions',"UPDATE portal_access_permissions SET portal_type='client'",`UPDATE portal_access_permissions SET tenant_id='${id(81)}'`]){
  await reset();await mutate(mutation);assert.deepEqual(await scope(),[]);
 }
});
await test('current own permissions replace previous ones; a foreign account cannot donate grants',async()=>{
 await reset();await mutate(`INSERT INTO portal_access_permissions(id,tenant_id,portal_type,portal_account_id,can_view_appointments,can_view_documents,updated_at)
 VALUES('${id(9)}','${t}','relative','${account}',false,false,now()+interval '1 second'),('${id(10)}','${t}','relative','${id(20)}',true,true,now()+interval '2 seconds')`);
 const [row]=await scope();assert.equal(row.can_view_documents,false);assert.equal(row.can_view_appointments,false);
 assert.equal(familyPortalAllows(decodeFamilyPortalAccessScope(row,{tenantId:t,accountId:account}),'documents'),false);
});
await test('NULL capabilities, mismatched scope and contact-free receipts never grant app access',async()=>{
 await reset();const [row]=await scope();const decoded=decodeFamilyPortalAccessScope({...row,can_view_documents:null},{tenantId:t,accountId:account});
 assert.equal(familyPortalAllows(decoded,'documents'),false);
 assert.equal(decodeFamilyPortalAccessScope(row,{tenantId:id(81),accountId:account}),null);
 assert.equal(decodeFamilyPortalAccessScope(row,{tenantId:t,accountId:id(82)}),null);
 assert.equal(decodeFamilyPortalAccessScope({...row,relative_contact_id:null},{tenantId:t,accountId:account}),null);
 assert.equal(familyPortalAllows(null,'documents'),false);
});
await test('anonymous cannot call the scope RPC and installation cannot overwrite an existing RPC',async()=>{
 await reset();await db.exec('SET ROLE anon');await assert.rejects(scope,/permission denied/);
 await db.exec('RESET ROLE');await assert.rejects(()=>db.exec(sql),/already exists/);await db.exec('ROLLBACK');
});
await db.close();
