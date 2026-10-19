import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Uses the already installed project PGlite dependency. No hosted writes or
// credentials. Actual company access/private notes/forwarding SQL runs unchanged.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageRoot = process.env.OFFICE_INTERNAL_NOTES_PGLITE_ROOT;
const { PGlite } = await import(packageRoot ? pathToFileURL(resolve(packageRoot, 'dist/index.js')).href : '@electric-sql/pglite');
const db = new PGlite();
const ids = Object.fromEntries(['tenant','otherTenant','sender','otherSender','employeeUser','employeeUser2','outsider','otherTenantUser','ownerRole','viewerRole','senderProfile','otherProfile','employeeProfile','viewer','viewerProfile','employee','employee2','inactive','foreignEmployee','account','account2','inactiveAccount','foreignAccount','privateNote'].map(key => [key,randomUUID()]));
let checks = 0, currentUser = ids.sender;
const value = async (sql, params=[]) => (await db.query(sql,params)).rows[0].result;
const denied = async (task, code='42501') => assert.rejects(task,error => { assert.equal(error.code,code,error.message); return true; });
const pass = async (name,task) => { await task(); checks++; console.log(`[office-internal-notes-db] PASS ${name}`); };
async function owner(sql,params=[]) { await db.exec('RESET ROLE'); return db.query(sql,params); }
async function actor({ user=ids.sender, tenant=ids.tenant, portal='business', account=null, role='authenticated', roleKey='owner' }={}) {
  await db.exec('RESET ROLE');
  assert.ok(['authenticated','anon','service_role'].includes(role));
  await db.query("SELECT set_config('test.uid',$1,false),set_config('test.tenant',$2,false),set_config('test.jwt',$3,false)",[
    role==='authenticated'?user:'',tenant,JSON.stringify({app_metadata:{portal_type:portal,portal_account_id:account,role_key:roleKey}})]);
  await db.exec(`SET ROLE ${role}`);
  currentUser=role==='authenticated'?user:null;
}
const employee = () => actor({user:ids.employeeUser,portal:'employee',account:ids.account,roleKey:'employee_portal'});
const employee2 = () => actor({user:ids.employeeUser2,portal:'employee',account:ids.account2,roleKey:'employee_portal'});
const recipients = (query='',limit=100,offset=0) => value('SELECT public.office_internal_note_recipients($1,$2,$3,$4) AS result',[ids.tenant,query,limit,offset]);
const payload = (overrides={}) => ({title:' Selected task ',body:' Only this selected text ',type:'task',priority:'normal',due_date:'2026-11-01',recipient_employee_ids:[ids.employee,ids.employee2],...overrides});
const send = (body=payload(),request=randomUUID(),tenant=ids.tenant,sender=currentUser) => value('SELECT public.office_internal_note_send($1,$2,$3,$4::jsonb) AS result',[tenant,sender,request,JSON.stringify(body)]);
const read = (box='sent',id=null,tenant=ids.tenant,limit=50,offset=0) => value('SELECT public.office_internal_note_read($1,$2,$3,$4,$5) AS result',[tenant,box,id,limit,offset]);
const update = (id,revision,action='read',status=null,response=null) => value('SELECT public.office_internal_note_delivery_update($1,$2,$3,$4,$5,$6) AS result',[ids.tenant,id,revision,action,status,response]);

try {
  for (const file of ['scripts/fixtures/office-internal-notes-test-schema.sql','supabase/migrations/20261015085833_company_access.sql','supabase/migrations/20261017060524_office_private_notes.sql','supabase/migrations/20261019003023_office_internal_notes.sql','scripts/sql/office-internal-notes-access.sql']) await db.exec(readFileSync(resolve(root,file),'utf8'));
  for (const id of [ids.sender,ids.otherSender,ids.employeeUser,ids.employeeUser2,ids.outsider,ids.otherTenantUser,ids.viewer]) await db.query('INSERT INTO auth.users(id) VALUES($1)',[id]);
  await db.query('INSERT INTO public.tenants VALUES($1),($2)',[ids.tenant,ids.otherTenant]);
  await db.query("INSERT INTO public.roles(id,key,is_admin_role) VALUES($1,'owner',true),($2,'viewer',false)",[ids.ownerRole,ids.viewerRole]);
  await db.query("INSERT INTO public.profiles(id,auth_user_id,tenant_id,role_id,display_name) VALUES($1,$2,$3,$4,'Sending office'),($5,$6,$3,$4,'Other administrator'),($7,$8,$3,$4,'Employee business profile'),($9,$10,$3,$11,'Read-only office')",[ids.senderProfile,ids.sender,ids.tenant,ids.ownerRole,ids.otherProfile,ids.otherSender,ids.employeeProfile,ids.employeeUser,ids.viewerProfile,ids.viewer,ids.viewerRole]);
  await db.query("INSERT INTO public.role_permissions(role_id,permission_key) VALUES($1,'office.access')",[ids.viewerRole]);
  await db.query("INSERT INTO public.employees(id,tenant_id,profile_id,first_name,last_name,status) VALUES($1,$2,$3,'First','Employee','aktiv'),($4,$2,NULL,'Second','Employee','active'),($5,$2,NULL,'Inactive','Employee','gesperrt'),($6,$7,NULL,'Other','Tenant','aktiv')",[ids.employee,ids.tenant,ids.employeeProfile,ids.employee2,ids.inactive,ids.foreignEmployee,ids.otherTenant]);
  await db.query('INSERT INTO public.employee_portal_accounts(id,tenant_id,employee_id,auth_user_id) VALUES($1,$2,$3,$4),($5,$2,$6,$7),($8,$2,$9,$10),($11,$12,$13,$14)',[ids.account,ids.tenant,ids.employee,ids.employeeUser,ids.account2,ids.employee2,ids.employeeUser2,ids.inactiveAccount,ids.inactive,ids.outsider,ids.foreignAccount,ids.otherTenant,ids.foreignEmployee,ids.otherTenantUser]);
  await actor();
  let receipt, dispatch, first, second; const request=randomUUID();
  await pass('directory only exposes active same-tenant recipients, supports literal search and pagination',async()=>{
    const list=await recipients(); assert.equal(list.total,2); assert.equal(list.items.length,2);
    assert.deepEqual(Object.keys(list.items[0]).sort(),['display_name','employee_id']);
    assert.equal((await recipients('%')).total,0); assert.equal((await recipients('FIRST')).total,1);
    assert.equal((await recipients('',1,1)).items.length,1); await denied(recipients('',101),'22023');
  });
  await pass('copies only explicit selected text, preserves private note isolation and immutable snapshot',async()=>{
    const content={text:'PRIVATE full original body never forwarded',cues:'PRIVATE cues',summary:'PRIVATE summary',fields:[],tasks:[],sources:[],nodes:[],strokes:[]};
    await db.query('INSERT INTO public.office_private_notes(id,tenant_id,owner_user_id,title,content) VALUES($1,$2,$3,$4,$5::jsonb)',[ids.privateNote,ids.tenant,ids.sender,'Private title',JSON.stringify(content)]);
    receipt=await send(payload(),request); dispatch=(await read('sent',receipt.dispatch_id)).items[0];
    assert.equal(receipt.sender_user_id,ids.sender); assert.equal(receipt.tenant_id,ids.tenant);
    assert.equal(dispatch.body,'Only this selected text'); assert.equal(dispatch.title,'Selected task');
    assert.equal(dispatch.deliveries.length,2); assert.equal(dispatch.sender_user_id,ids.sender); assert.equal(dispatch.tenant_id,ids.tenant);
    first=dispatch.deliveries.find(d=>d.employee_id===ids.employee); second=dispatch.deliveries.find(d=>d.employee_id===ids.employee2);
    assert.equal(first.recipient_user_id,ids.employeeUser); assert.equal(first.revision,1); assert.equal(first.read_at,null);
    assert.ok(!JSON.stringify(dispatch).includes('PRIVATE')); assert.ok(!JSON.stringify(dispatch).includes(ids.privateNote));
    await db.query("UPDATE public.office_private_notes SET title='Changed private title',revision=revision+1 WHERE id=$1",[ids.privateNote]);
    assert.equal((await read('sent',receipt.dispatch_id)).items[0].title,'Selected task');
    assert.equal((await db.query('SELECT content FROM public.office_private_notes WHERE id=$1',[ids.privateNote])).rows[0].content.text,content.text);
  });
  await pass('send retry is canonical/idempotent; changed payload with same request cannot deliver twice',async()=>{
    assert.deepEqual(await send(payload({recipient_employee_ids:[ids.employee2,ids.employee],title:'\tSelected task\n',body:'\u00a0Only this selected text\ufeff'}),request),receipt);
    await denied(send(payload({body:'Changed selected text'}),request),'22023'); assert.equal((await read()).total,1);
  });
  await pass('invalid or unavailable recipient rejects entire send with no partial delivery',async()=>{
    for (const body of [payload({recipient_employee_ids:[]}),payload({recipient_employee_ids:[ids.employee,ids.employee]}),payload({recipient_employee_ids:[ids.employee,null]}),payload({recipient_employee_ids:[ids.employee,ids.inactive]}),payload({recipient_employee_ids:[ids.employee,ids.foreignEmployee]}),payload({recipient_employee_ids:Array.from({length:26},()=>randomUUID())}),payload({recipient_employee_ids:['not-a-uuid']})]) await denied(send(body),'22023');
    assert.equal((await read()).total,1);
  });
  await pass('strict content/date/type/size contract rejects extra source note fields',async()=>{
    for(const body of [payload({title:''}),payload({title:'x'.repeat(241)}),payload({body:' '}),payload({body:'\n\t\u00a0\ufeff'}),payload({body:'x'.repeat(20001)}),payload({body:{text:'wrong'}}),payload({type:'anything'}),payload({priority:'urgent'}),payload({due_date:'2026-02-30'}),payload({due_date:'tomorrow'}),payload({due_date:{}}),payload({source_note_id:ids.privateNote}),payload({sender_user_id:ids.otherSender})]) await denied(send(body),'22023');
    assert.equal((await read()).total,1);
  });
  await pass('another administrator cannot read the outgoing snapshot or original note',async()=>{
    await actor({user:ids.otherSender}); assert.equal((await read()).total,0); await denied(read('sent',receipt.dispatch_id),'P0002');
    assert.equal((await db.query('SELECT id FROM public.office_private_notes')).rows.length,0);
    await denied(update(first.id,1));
  });
  await pass('session change after client review cannot send as a different same-tenant user',async()=>{
    await actor({user:ids.otherSender}); await denied(send(payload(),randomUUID(),ids.tenant,ids.sender)); assert.equal((await read()).total,0);
    await actor(); await denied(send(payload(),randomUUID(),ids.tenant,ids.otherSender));
    await denied(send(payload(),randomUUID(),ids.tenant,null)); assert.equal((await read()).total,1);
  });
  await pass('employee inbox reveals only own delivery; no other recipients or personal notes',async()=>{
    await employee(); const inbox=await read('inbox'); assert.equal(inbox.total,1); assert.equal(inbox.items[0].deliveries.length,1);
    assert.equal(inbox.items[0].deliveries[0].employee_id,ids.employee); assert.ok(!JSON.stringify(inbox).includes(ids.employeeUser2));
    assert.equal((await db.query('SELECT id FROM public.office_private_notes')).rows.length,0);
    await denied(read('sent')); await denied(recipients()); await denied(send()); await denied(update(second.id,1),'P0002');
  });
  await pass('recipient marks read, in progress and done; server revision and read receipt are monotonic',async()=>{
    first=await update(first.id,1); assert.equal(first.revision,2); assert.ok(first.read_at); assert.equal(first.status,'open');
    assert.deepEqual(await update(first.id,2),first); const readAt=first.read_at;
    await denied(update(first.id,1),'40001');
    first=await update(first.id,2,'status','in_progress',' Work started '); assert.equal(first.revision,3); assert.equal(first.response,'Work started');
    assert.deepEqual(await update(first.id,3,'status','in_progress','Work started'),first);
    first=await update(first.id,3,'status','done',null); assert.equal(first.revision,4); assert.equal(first.response,'Work started'); assert.equal(first.read_at,readAt);
    for(const args of [[4,'read','done',null],[4,'status','invalid',null],[4,'status','done','x'.repeat(2001)]]) await denied(update(first.id,...args),'22023');
    await employee2(); let own=(await read('inbox')).items[0].deliveries[0]; assert.equal(own.status,'open'); assert.equal(own.read_at,null); assert.equal(own.revision,1);
    own=await update(own.id,1,'status','done','Completed directly'); assert.ok(own.read_at); assert.equal(own.revision,2);
    await actor(); const outgoing=(await read()).items[0]; assert.deepEqual(outgoing.deliveries.map(d=>d.status),['done','done']);
    await denied(update(first.id,4));
  });
  await pass('active linked business employee can receive; arbitrary business identity cannot',async()=>{
    await actor({user:ids.employeeUser}); assert.equal((await read('inbox')).total,1);
    first=await update(first.id,4,'status','open',''); assert.equal(first.response,''); assert.equal(first.revision,5);
    await actor({user:ids.outsider}); await denied(read('inbox'));
  });
  await pass('portal claims, tenant mismatches and anon/service direct calls fail closed',async()=>{
    for(const params of [{user:ids.employeeUser,portal:'client',account:ids.account},{user:ids.employeeUser,portal:'employee',account:ids.account2},{user:ids.outsider,portal:'employee',account:ids.account},{user:ids.employeeUser,portal:'employee',account:ids.account,tenant:ids.otherTenant}]) { await actor(params); await denied(read('inbox')); }
    await actor(); await denied(send(payload(),randomUUID(),ids.otherTenant)); await denied(read('sent',null,ids.otherTenant));
    for(const role of ['anon','service_role']) { await actor({role}); await denied(read()); await denied(send()); }
  });
  await pass('private tables and helper functions are not callable by application roles',async()=>{
    await actor(); for(const sql of ['SELECT * FROM care_security.office_internal_notes','SELECT * FROM care_security.office_internal_note_deliveries',"SELECT care_security.internal_note_recipients('"+ids.tenant+"')",'DELETE FROM care_security.office_internal_notes']) await denied(db.query(sql));
  });
  await pass('recipient account deactivation blocks fresh send and access but preserves successful retry receipt',async()=>{
    await owner("UPDATE public.employee_portal_accounts SET status='blocked' WHERE id=$1",[ids.account]); await actor();
    assert.equal((await recipients()).total,1); await denied(send(),'22023'); assert.deepEqual(await send(payload(),request),receipt); assert.equal((await read()).total,1);
    await employee(); await denied(read('inbox')); await denied(update(first.id,5,'status','done'));
    await owner("UPDATE public.employee_portal_accounts SET status='active' WHERE id=$1",[ids.account]);
  });
  await pass('account reassignment cannot reveal past deliveries to a different auth user',async()=>{
    const reassigned=randomUUID(); await owner('INSERT INTO auth.users(id) VALUES($1)',[reassigned]);
    await owner('UPDATE public.employee_portal_accounts SET auth_user_id=$1 WHERE id=$2',[reassigned,ids.account]);
    await actor({user:reassigned,portal:'employee',account:ids.account}); assert.equal((await read('inbox')).total,0); await denied(update(first.id,5),'P0002');
    await employee(); await denied(read('inbox'));
    await owner('UPDATE public.employee_portal_accounts SET auth_user_id=$1 WHERE id=$2',[ids.employeeUser,ids.account]);
  });
  await pass('ambiguous auth mappings and blocked employees are excluded',async()=>{
    const duplicate=randomUUID(); await owner('INSERT INTO public.employee_portal_accounts(id,tenant_id,employee_id,auth_user_id) VALUES($1,$2,$3,$4)',[duplicate,ids.tenant,ids.employee2,ids.employeeUser]);
    await actor(); assert.equal((await recipients()).total,0); await denied(send(),'22023'); await employee(); await denied(read('inbox'));
    await owner('DELETE FROM public.employee_portal_accounts WHERE id=$1',[duplicate]);
    await owner("UPDATE public.employees SET status='gesperrt' WHERE id=$1",[ids.employee]); await employee(); await denied(read('inbox'));
    await owner("UPDATE public.employees SET status='aktiv' WHERE id=$1",[ids.employee]);
  });
  await pass('actual company permission sets/active profile/scope checks are authoritative',async()=>{
    await actor({user:ids.viewer}); assert.equal((await read()).total,0); await denied(send()); await denied(recipients());
    await owner("UPDATE public.profiles SET is_active=false WHERE id=$1",[ids.senderProfile]); await actor(); await denied(read()); await denied(send());
    await owner("UPDATE public.profiles SET is_active=true WHERE id=$1",[ids.senderProfile]);
    await owner("INSERT INTO public.role_permission_sets(tenant_id,role_key,permission_key) VALUES($1,'owner','office.access')",[ids.tenant]); await actor(); assert.equal((await read()).total,1); await denied(send());
    await owner('DELETE FROM public.role_permission_sets');
    await owner("INSERT INTO public.employee_data_scopes(tenant_id,employee_id,module,scope_type,scope_value) VALUES($1,$2,'office','location','other')",[ids.tenant,ids.employee]);
    await actor({user:ids.employeeUser}); await denied(send());
  });
  await pass('deleted or banned auth users and inactive recipient profiles revoke access immediately',async()=>{
    for(const column of ['deleted_at','banned_until']) {
      await owner(`UPDATE auth.users SET ${column}=now()+interval '1 day' WHERE id=$1`,[ids.employeeUser]);
      await employee(); await denied(read('inbox')); await denied(update(first.id,5));
      await actor(); assert.equal((await recipients()).total,1); await denied(send(),'22023');
      await owner(`UPDATE auth.users SET ${column}=NULL WHERE id=$1`,[ids.employeeUser]);
      await owner(`UPDATE auth.users SET ${column}=now()+interval '1 day' WHERE id=$1`,[ids.sender]);
      await actor(); await denied(read()); await denied(send()); await denied(recipients());
      await owner(`UPDATE auth.users SET ${column}=NULL WHERE id=$1`,[ids.sender]);
    }
    await owner('UPDATE public.profiles SET is_active=false WHERE id=$1',[ids.employeeProfile]);
    await employee(); await denied(read('inbox')); await actor(); assert.equal((await recipients()).total,1);
    await owner('UPDATE public.profiles SET is_active=true WHERE id=$1',[ids.employeeProfile]);
    await owner('UPDATE public.employees SET deleted_at=now() WHERE id=$1',[ids.employee]);
    await employee(); await denied(read('inbox')); await actor(); assert.equal((await recipients()).total,1);
  });
  await pass('public RPCs are invokers and table privileges stay absent',async()=>{
    const result=await owner("SELECT n.nspname,p.proname,p.prosecdef FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.proname LIKE 'office_internal_note_%' AND n.nspname='public'");
    assert.equal(result.rows.length,4); assert.ok(result.rows.every(row=>row.prosecdef===false));
    const grants=await owner("SELECT has_table_privilege('authenticated','care_security.office_internal_notes','SELECT') AS reads,has_table_privilege('authenticated','care_security.office_internal_note_deliveries','UPDATE') AS writes");
    assert.equal(grants.rows[0].reads,false); assert.equal(grants.rows[0].writes,false);
  });
  await pass('legacy messages.can_create grants recipient selection and sending without changing company permissions',async()=>{
    // Actual older production roles contain an explicit Office grant and a
    // coarse messages grant, but no exact communication.send_message row.
    await owner("INSERT INTO public.role_permissions(role_id,permission_key,can_create) VALUES($1,'office.access',false),($1,'messages',true)",[ids.ownerRole]);
    await actor();
    assert.equal(await value("SELECT care_security.company_actor($1,'communication.send_message') AS result",[ids.tenant]),false);
    assert.equal((await recipients()).total,1);
    const legacyReceipt=await send(payload({recipient_employee_ids:[ids.employee2]}));
    assert.equal((await read('sent',legacyReceipt.dispatch_id)).items[0].deliveries.length,1);
    await owner("UPDATE public.role_permissions SET can_create=false WHERE role_id=$1 AND permission_key='messages'",[ids.ownerRole]);
    await actor(); await denied(recipients()); await denied(send(payload({recipient_employee_ids:[ids.employee2]})));
    await owner("UPDATE public.role_permissions SET can_create=true,tenant_id=$1 WHERE role_id=$2 AND permission_key='messages'",[ids.otherTenant,ids.ownerRole]);
    await actor(); await denied(recipients());
    await owner("UPDATE public.role_permissions SET tenant_id=NULL WHERE role_id=$1 AND permission_key='messages'",[ids.ownerRole]);
    await actor(); assert.equal((await recipients()).total,1);
  });
  await pass('legacy sending cannot bypass tenant replacement sets, explicit employee denial, scope or inactive identity',async()=>{
    await owner("INSERT INTO public.role_permission_sets(tenant_id,role_key,permission_key) VALUES($1,'owner','office.access')",[ids.tenant]);
    await actor(); await denied(recipients()); await denied(send(payload({recipient_employee_ids:[ids.employee2]})));
    await owner('DELETE FROM public.role_permission_sets');
    const senderEmployee=randomUUID();
    await owner("INSERT INTO public.employees(id,tenant_id,profile_id,first_name,last_name,status) VALUES($1,$2,$3,'Sending','Employee','active')",[senderEmployee,ids.tenant,ids.senderProfile]);
    for (const permission of ['communication.send_message','messages']) {
      await owner("INSERT INTO public.employee_permission_overrides(tenant_id,employee_id,permission_key,allowed) VALUES($1,$2,$3,false)",[ids.tenant,senderEmployee,permission]);
      await actor(); await denied(recipients()); await denied(send(payload({recipient_employee_ids:[ids.employee2]})));
      await owner('DELETE FROM public.employee_permission_overrides WHERE employee_id=$1',[senderEmployee]);
    }
    // Exact grants retain their existing precedence; the coarse legacy deny
    // only disables the legacy fallback, not an explicitly granted action.
    await owner("INSERT INTO public.role_permissions(role_id,permission_key) VALUES($1,'communication.send_message')",[ids.ownerRole]);
    await owner("INSERT INTO public.employee_permission_overrides(tenant_id,employee_id,permission_key,allowed) VALUES($1,$2,'messages',false)",[ids.tenant,senderEmployee]);
    await actor(); assert.equal((await recipients()).total,1);
    await owner("INSERT INTO public.employee_permission_overrides(tenant_id,employee_id,permission_key,allowed) VALUES($1,$2,'communication.send_message',false)",[ids.tenant,senderEmployee]);
    await actor(); await denied(recipients()); await denied(send(payload({recipient_employee_ids:[ids.employee2]})));
    await owner('DELETE FROM public.employee_permission_overrides WHERE employee_id=$1',[senderEmployee]);
    await owner("DELETE FROM public.role_permissions WHERE role_id=$1 AND permission_key='communication.send_message'",[ids.ownerRole]);
    await owner("INSERT INTO public.employee_data_scopes(tenant_id,employee_id,module,scope_type,scope_value) VALUES($1,$2,'office','location','other')",[ids.tenant,senderEmployee]);
    await actor(); await denied(recipients());
    await owner('DELETE FROM public.employee_data_scopes WHERE employee_id=$1',[senderEmployee]);
    await owner('UPDATE public.profiles SET is_active=false WHERE id=$1',[ids.senderProfile]);
    await actor(); await denied(recipients());
    await owner('UPDATE public.profiles SET is_active=true WHERE id=$1',[ids.senderProfile]);
    await actor(); assert.equal((await recipients()).total,1);
    await denied(db.query('SELECT care_security.internal_note_can_send($1)',[ids.tenant]));
  });
  console.log(`[office-internal-notes-db] ${checks} isolated PostgreSQL checks passed; no hosted data accessed.`);
} catch(error) { console.error(`[office-internal-notes-db] FAIL ${error.code??''}: ${error.message}${error.where?' ('+error.where+')':''}`); process.exitCode=1;
} finally { await db.close(); }
