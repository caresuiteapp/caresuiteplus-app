// Prepared draft contracts only. All tables/identities below are synthetic.
// This deliberately supplies missing prerequisites; it does NOT prove production compatibility.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {PGlite} from '@electric-sql/pglite';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
// The existing CI uses Node20. Compile the actual TS domains with the already
// installed esbuild rather than relying on Node24's native type stripping.
const require=createRequire(import.meta.url);
function domain(relative){const code=buildSync({entryPoints:[new URL(relative,import.meta.url).pathname],bundle:true,write:false,platform:'node',format:'cjs'}).outputFiles[0].text;const module={exports:{}};new Function('require','module','exports',code)(require,module,module.exports);return module.exports;}
const {decodePersonnelReceipt,decodePersonnelContext}=domain('../../src/lib/office/personnelWorkspaceDomain.web.ts');
const {decodeClientFinancingReceipt}=domain('../../src/lib/clients/clientFinancingWorkspaceDomain.web.ts');
const db=new PGlite(),id=n=>`90000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const t=id(1),actor=id(2),employee=id(3),client=id(4),role=id(5),session=id(6),other=id(7);
await db.exec(`CREATE ROLE authenticated;CREATE ROLE anon;CREATE SCHEMA auth;
CREATE FUNCTION auth.uid()RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('test.uid',true),'')::uuid$$;
CREATE FUNCTION auth.jwt()RETURNS jsonb LANGUAGE sql AS $$SELECT jsonb_build_object('exp',extract(epoch from clock_timestamp()+interval '1 hour')::bigint,'session_id','${session}')$$;
CREATE FUNCTION public.current_tenant_id()RETURNS uuid LANGUAGE sql AS $$SELECT '${t}'::uuid$$;
CREATE FUNCTION public.resolve_current_profile_id()RETURNS uuid LANGUAGE sql AS $$SELECT auth.uid()$$;
CREATE FUNCTION public.has_permission(k text)RETURNS boolean LANGUAGE sql AS $$SELECT coalesce(current_setting('test.deny',true),'')<>'true'$$;
CREATE SCHEMA care_security;CREATE FUNCTION care_security.company_actor(t uuid,k text)RETURNS boolean LANGUAGE sql AS $$SELECT coalesce(current_setting('test.scope_limited',true),'')<>'true'$$;
CREATE TABLE auth.sessions(id uuid,user_id uuid,not_after timestamptz);
INSERT INTO auth.sessions VALUES('${session}','${actor}',null);
CREATE TABLE public.profiles(id uuid,tenant_id uuid,auth_user_id uuid,role_id uuid,first_name text,last_name text,display_name text,is_active boolean,status text);
CREATE TABLE public.roles(id uuid,key text);
CREATE TABLE public.user_roles(user_id uuid,tenant_id uuid,role_id uuid);
CREATE TABLE public.role_permissions(role_id uuid,permission_key text);
CREATE TABLE public.role_permission_sets(tenant_id uuid,role_key text,permission_key text);
INSERT INTO profiles VALUES('${actor}','${t}','${actor}','${role}','Test','Person','Test Person',true,'active');
INSERT INTO roles VALUES('${role}','business_admin');INSERT INTO user_roles VALUES('${actor}','${t}','${role}');
INSERT INTO role_permissions SELECT '${role}',unnest(array['office.clients.view','office.clients.view_sensitive','office.documents.view','office.clients.edit']);
CREATE TABLE public.employees(id uuid,tenant_id uuid,profile_id uuid,first_name text,last_name text,role_title text,status text,updated_at timestamptz);
INSERT INTO employees VALUES('${employee}','${t}','${actor}','Synthetic','Employee','employee','active','2026-01-01Z');
CREATE TABLE public.clients(id uuid,tenant_id uuid);INSERT INTO clients VALUES('${client}','${t}');
GRANT USAGE ON SCHEMA auth TO authenticated;GRANT SELECT ON public.employees TO authenticated;
`);
for(const table of ['employee_documents','employee_qualifications','employee_training_records','employee_assignment_eligibility','employee_absences','employee_time_entries','employee_access_revocations','employee_portal_access','employee_hr_documents'])await db.exec(`CREATE TABLE public.${table}(id uuid,tenant_id uuid,employee_id uuid)`);
for(const table of ['client_contracts','client_documents','client_financing_paths','client_financing_approvals','client_tariff_positions','client_budget_entitlement_periods','client_cost_estimates','client_service_combination_rules','client_service_records','pfleger_service_proofs'])await db.exec(`CREATE TABLE public.${table}(id uuid,tenant_id uuid,client_id uuid)`);
await db.exec(readFileSync(new URL('../patches/ambulatory_personnel_workspace.sql',import.meta.url),'utf8'));
await db.exec(readFileSync(new URL('../patches/ambulatory_client_financing_workspace.sql',import.meta.url),'utf8'));
await db.query("SELECT set_config('test.uid',$1,false)",[actor]);
const asAuth=()=>db.exec('SET ROLE authenticated'),asOwner=()=>db.exec('RESET ROLE');
const call=(name,args)=>db.query(`SELECT ${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) AS result`,args);
const scalar=async(name,args)=>(await call(name,args)).rows[0].result;
const copy=x=>structuredClone(x);
const original=(await db.query('SELECT to_jsonb(e) AS row FROM employees e')).rows[0].row;
const personnelCommand=(n=20)=>({version:'2026-10-16.1',requestId:id(n),eventId:id(n+1),tenantId:t,employeeId:employee,actorId:actor,expectedHeadId:null,kind:'employment',occurredAt:'2026-01-01T08:00:00Z',note:'Synthetic review',payload:{employee:{kind:'employee',id:employee,snapshot:original},employmentType:'part-time',location:'Synthetic office',role:'Assistant',validFrom:'2026-01-01',validUntil:null,decision:'Recorded'}});
const financeCommand=(n=40)=>({version:'2026-10-16.1',requestId:id(n),eventId:id(n+1),tenantId:t,clientId:client,actorId:actor,expectedHeadId:null,kind:'calculation',occurredAt:'2026-01-01T08:00:00Z',note:'Synthetic review',payload:{path:null,tariff:null,quantity:'1.25',baseAmount:'20.00',surcharge:'0',totalAmount:'20.00',calculationRule:'Synthetic rule'}});
const sources=[{kind:'financing_path',id:id(100),snapshot:{id:id(100),tenant_id:t,client_id:client}},{kind:'tariff',id:id(101),snapshot:{id:id(101),tenant_id:t,client_id:client}}];
const validateFinance=(cmd,src=sources)=>scalar('client_financing_private.validate_command',[cmd,src]);
await test('prepared personnel wrappers can enter only guarded entrypoints while helper data stays private',async()=>{
 await asAuth();const ctx=await scalar('public.web_personnel_context',[t,actor,employee]);assert.equal(ctx.employeeId,employee);assert.equal(ctx.sources.rows.length,1);assert.equal((await scalar('public.web_personnel_employees',[t,actor])).count,1);
 for(const name of ['care_personnel_private.sources','care_personnel_private.employee_original','care_personnel_private.people','care_personnel_private.history'])await assert.rejects(()=>scalar(name,name.endsWith('people')?[t]:[t,employee]),/permission denied/);
 await asOwner();
});
await test('prepared finance wrappers reject direct helper reads and preserve guarded context',async()=>{
 await asAuth();assert.equal((await scalar('public.web_client_financing_context',[t,client,actor])).clientId,client);
 await assert.rejects(()=>scalar('client_financing_private.sources',[t,client]),/permission denied/);await assert.rejects(()=>scalar('client_financing_private.history',[t,client]),/permission denied/);await asOwner();
});
await test('anonymous has no public or private evidence entrypoint',async()=>{
 await db.exec('SET ROLE anon');for(const[name,args]of[['public.web_personnel_context',[t,actor,employee]],['public.web_commit_personnel_event',[personnelCommand()]],['public.web_client_financing_context',[t,client,actor]]])await assert.rejects(()=>scalar(name,args),/permission denied/);await asOwner();
});
await test('identical personnel commit replay returns the original receipt after its CAS head advances',async()=>{
 await asAuth();const cmd=personnelCommand(),a=await scalar('public.web_commit_personnel_event',[cmd]),b=await scalar('public.web_commit_personnel_event',[cmd]);assert.deepEqual(a,b);assert.deepEqual(decodePersonnelReceipt(a,cmd),a);assert.equal(a.event.sequence,1);await asOwner();assert.equal((await db.query('SELECT count(*)::int n FROM care_personnel_private.events')).rows[0].n,1);
});
await test('personnel collision, missing employee and foreign actor reject without adding events',async()=>{
 await asAuth();const cmd=personnelCommand();const changed=copy(cmd);changed.note='Different request body';await assert.rejects(()=>scalar('public.web_commit_personnel_event',[changed]),/request collision/);
 const missing=personnelCommand(30);missing.employeeId=other;await assert.rejects(()=>scalar('public.web_commit_personnel_event',[missing]),/employee unavailable/);
 await assert.rejects(()=>scalar('public.web_personnel_context',[t,other,employee]),/session mismatch/);await asOwner();assert.equal((await db.query('SELECT count(*)::int n FROM care_personnel_private.events')).rows[0].n,1);
});
await test('malformed personnel command values reject before persisting another event',async()=>{
 for(const mutate of [c=>c.payload.employee=null,c=>c.payload.employmentType=2,c=>c.payload.validFrom='2026-02-30',c=>c.payload.validUntil='2025-01-01',c=>c.payload.extra='unrecognized',c=>c.expectedHeadId=2,c=>delete c.note,c=>c.tenantId=null,c=>c.occurredAt='2026-02-30T12:00:00Z',c=>c.requestId=c.eventId]){
  const cmd=personnelCommand(60);mutate(cmd);await asAuth();await assert.rejects(()=>scalar('public.web_commit_personnel_event',[cmd]));await asOwner();assert.equal((await db.query('SELECT count(*)::int n FROM care_personnel_private.events')).rows[0].n,1);
 }
});
await test('finance validator accepts exact source snapshots with string decimals',async()=>{
 const cmd=financeCommand();cmd.payload.path=sources[0];cmd.payload.tariff=sources[1];await validateFinance(cmd);
});
await test('finance validator rejects null, foreign, wrong-kind and structurally incomplete required sources',async()=>{
 for(const value of [null,2,{},sources[1],{...sources[0],snapshot:{}},{...sources[0],extra:true},{...sources[0],snapshot:{...sources[0].snapshot,client_id:other}}]){
  const cmd=financeCommand();cmd.payload.path=value;cmd.payload.tariff=sources[1];await assert.rejects(()=>validateFinance(cmd));
 }
});
await test('finance rejects negative/numeric/excess precision/nondecimal amounts and quantities',async()=>{
 for(const[key,value]of[['quantity','-1'],['quantity',-1],['quantity','1.00001'],['quantity','NaN'],['baseAmount',0],['totalAmount','-1'],['surcharge','1.001'],['totalAmount','1e3']]){
  const cmd=financeCommand();cmd.payload.path=sources[0];cmd.payload.tariff=sources[1];cmd.payload[key]=value;await assert.rejects(()=>validateFinance(cmd));
 }
});
await test('finance UUID, note, timestamp, expected head and exact payload shape fail closed',async()=>{
 for(const mutate of [c=>c.tenantId=null,c=>c.actorId='nope',c=>c.expectedHeadId=2,c=>delete c.expectedHeadId,c=>c.note=' ',c=>c.occurredAt='not-a-time',c=>c.payload.extra='field',c=>c.kind='unknown']){
  const cmd=financeCommand();cmd.payload.path=sources[0];cmd.payload.tariff=sources[1];mutate(cmd);await assert.rejects(()=>validateFinance(cmd));
 }
});
await test('finance malformed raw public commit rolls back root/events atomically',async()=>{
 const before=(await db.query('SELECT count(*)::int n FROM client_financing_private.roots')).rows[0].n;
 await asAuth();await assert.rejects(()=>scalar('public.web_commit_client_financing_event',[financeCommand()]));await asOwner();assert.equal((await db.query('SELECT count(*)::int n FROM client_financing_private.events')).rows[0].n,0);assert.equal((await db.query('SELECT count(*)::int n FROM client_financing_private.roots')).rows[0].n,before);
});

await test('personnel permission revocation/inactive profile fails closed before replay or mutation',async()=>{
 await db.exec("UPDATE profiles SET is_active=false");await asAuth();await assert.rejects(()=>scalar('public.web_personnel_context',[t,actor,employee]));await asOwner();await db.exec("UPDATE profiles SET is_active=true");
 await db.query("SELECT set_config('test.deny','true',false)");await asAuth();await assert.rejects(()=>scalar('public.web_commit_personnel_event',[personnelCommand()]));await asOwner();await db.query("SELECT set_config('test.deny','',false)");
});
await test('personnel transition checks run on the real public commit, preserving source-bound qualification',async()=>{
 for(const[table,n]of[['employee_documents',110],['employee_qualifications',111],['employee_assignment_eligibility',112],['employee_absences',113]])await db.query(`INSERT INTO ${table} VALUES($1,$2,$3)`,[id(n),t,employee]);
 const src=await scalar('care_personnel_private.sources',[t,employee]),person=(await scalar('care_personnel_private.people',[t]))[0],source=kind=>src.find(x=>x.kind===kind);
 let head=id(21);const command=(n,kind,payload)=>({...personnelCommand(n),expectedHeadId:head,kind,payload});
 const delegation={assignment:source('assignment'),activity:'Synthetic task',validFrom:'2026-01-01T09:00:00Z',validUntil:'2026-01-01T10:00:00Z',assignee:person,qualificationEventId:id(999),decision:'Synthetic decision'};
 await asAuth();await assert.rejects(()=>scalar('public.web_commit_personnel_event',[command(200,'delegation',delegation)]),/qualification/);await asOwner();
 const qualification=command(202,'qualification',{qualification:source('qualification'),document:source('document'),activity:'Synthetic task',validFrom:'2025-01-01',validUntil:'2027-12-31',result:'verified',reviewer:person});
 await asAuth();const q=await scalar('public.web_commit_personnel_event',[qualification]);head=q.event.id;
 await assert.rejects(()=>scalar('public.web_commit_personnel_event',[command(204,'delegation',{...delegation,qualificationEventId:head,activity:'Different task'})]),/qualification/);
 const saved=await scalar('public.web_commit_personnel_event',[command(206,'delegation',{...delegation,qualificationEventId:head})]);head=saved.event.id;assert.equal(saved.event.sequence,3);await asOwner();
});
await test('personnel rejects nonexistent/repeated correction and returns the stored correction receipt',async()=>{
 let head=(await db.query('SELECT head_id FROM care_personnel_private.roots WHERE tenant_id=$1 AND employee_id=$2',[t,employee])).rows[0].head_id;
 const command=(n,targetId)=>({...personnelCommand(n),expectedHeadId:head,kind:'correct',payload:{targetId,reason:'Synthetic correction'}});
 await asAuth();await assert.rejects(()=>scalar('public.web_commit_personnel_event',[command(220,other)]),/uncorrected/);
 const cmd=command(222,id(21)),receipt=await scalar('public.web_commit_personnel_event',[cmd]);head=receipt.event.id;
 assert.deepEqual(await scalar('public.web_commit_personnel_event',[cmd]),receipt);
 await assert.rejects(()=>scalar('public.web_commit_personnel_event',[command(224,id(21))]),/uncorrected/);
 await assert.rejects(()=>scalar('public.web_commit_personnel_event',[command(226,head)]),/uncorrected/);await asOwner();
});
await test('personnel rejects return without a completed original absence; accepts its later matching return',async()=>{
 const src=await scalar('care_personnel_private.sources',[t,employee]),absence=src.find(x=>x.kind==='absence'),person=(await scalar('care_personnel_private.people',[t]))[0];
 let head=(await db.query('SELECT head_id FROM care_personnel_private.roots WHERE tenant_id=$1 AND employee_id=$2',[t,employee])).rows[0].head_id;
 const command=(n,kind,payload)=>({...personnelCommand(n),expectedHeadId:head,kind,payload});
 const ret={absence,decision:'fit',validFrom:'2026-01-03T08:00:00Z',validUntil:'2026-01-04T08:00:00Z',restrictions:'None recorded',reviewer:person};
 await asAuth();await assert.rejects(()=>scalar('public.web_commit_personnel_event',[command(230,'return_decision',ret)]),/completed prior absence/);
 const a=await scalar('public.web_commit_personnel_event',[command(232,'absence',{absence,category:'sick',validFrom:'2026-01-01T08:00:00Z',validUntil:'2026-01-03T12:00:00Z',decision:'Original absence'})]);head=a.event.id;
 await assert.rejects(()=>scalar('public.web_commit_personnel_event',[command(234,'return_decision',ret)]),/completed prior absence/);
 const r=await scalar('public.web_commit_personnel_event',[command(236,'return_decision',{...ret,validFrom:'2026-01-03T13:00:00Z'})]);assert.equal(r.event.previousId,head);await asOwner();
});
await test('finance date/source fields cannot be null, impossible dates or wrong kinds',async()=>{
 const contract={kind:'contract',id:id(300),snapshot:{id:id(300),tenant_id:t,client_id:client}},document={kind:'document',id:id(301),snapshot:{id:id(301),tenant_id:t,client_id:client}};
 const cmd={...financeCommand(300),kind:'contract_basis',payload:{contract,document,partner:'Synthetic partner',serviceBasis:'Synthetic basis',validFrom:'2026-01-01',versionLabel:'v1'}};await validateFinance(cmd,[contract,document]);
 for(const mutate of [c=>c.payload.validFrom=null,c=>c.payload.validFrom='2026-02-30',c=>c.payload.validFrom='2026-1-1',c=>c.payload.contract={...contract,kind:'document'},c=>c.payload.partner=2]){const c=copy(cmd);mutate(c);await assert.rejects(()=>validateFinance(c,[contract,document]));}
});
await test('unmapped limited company actors cannot use the prepared tenant-wide source APIs',async()=>{
 await db.query("SELECT set_config('test.scope_limited','true',false)");await asAuth();
 await assert.rejects(()=>scalar('public.web_personnel_context',[t,actor,employee]));await assert.rejects(()=>scalar('public.web_personnel_employees',[t,actor]));
 await assert.rejects(()=>scalar('public.web_client_financing_context',[t,client,actor]));
 await asOwner();await db.query("SELECT set_config('test.scope_limited','',false)");
});
await test('prepared finance public commit receipt reaches the actual app decoder after JSONB transport',async()=>{
 await db.query('INSERT INTO client_contracts VALUES($1,$2,$3)',[id(400),t,client]);await db.query('INSERT INTO client_documents VALUES($1,$2,$3)',[id(401),t,client]);
 const src=await scalar('client_financing_private.sources',[t,client]),contract=src.find(x=>x.kind==='contract'),document=src.find(x=>x.kind==='document');
 const cmd={...financeCommand(402),kind:'contract_basis',payload:{contract,document,partner:'Synthetic partner',serviceBasis:'Synthetic basis',validFrom:'2026-01-01',versionLabel:'v1'}};
 await asAuth();const receipt=await scalar('public.web_commit_client_financing_event',[cmd]);assert.deepEqual(decodeClientFinancingReceipt(receipt,cmd),receipt);
 assert.throws(()=>decodeClientFinancingReceipt(receipt,{...cmd,extra:undefined}));
 assert.throws(()=>decodeClientFinancingReceipt(receipt,{...cmd,extra:Number.NaN}));
 for(const mutate of [r=>r.command.payload.partner='Changed amount or body',r=>r.event.actorId=other,r=>r.event.clientId=other,r=>r.event.tenantId=other,r=>r.event.previousId=other,r=>r.event.sequence=0,r=>r.event.recordedAt='2020-01-01T00:00:00Z',r=>r.event.command.payload.versionLabel='Changed version']){const changed=copy(receipt);mutate(changed);assert.throws(()=>decodeClientFinancingReceipt(changed,cmd));}
 assert.deepEqual(await scalar('public.web_commit_client_financing_event',[cmd]),receipt);await asOwner();
});
await test('finance calculated amount receipt preserves decimal strings and rejects a changed amount',async()=>{
 await db.query('INSERT INTO client_financing_paths VALUES($1,$2,$3)',[id(100),t,client]);await db.query('INSERT INTO client_tariff_positions VALUES($1,$2,$3)',[id(101),t,client]);
 const src=await scalar('client_financing_private.sources',[t,client]),head=(await db.query('SELECT head_id FROM client_financing_private.roots WHERE tenant_id=$1 AND client_id=$2',[t,client])).rows[0].head_id;
 const cmd=financeCommand(410);cmd.expectedHeadId=head;cmd.payload.path=src.find(x=>x.kind==='financing_path');cmd.payload.tariff=src.find(x=>x.kind==='tariff');
 await asAuth();const receipt=await scalar('public.web_commit_client_financing_event',[cmd]);assert.deepEqual(decodeClientFinancingReceipt(receipt,cmd),receipt);
 const changed=copy(receipt);changed.command.payload.totalAmount='21.00';assert.throws(()=>decodeClientFinancingReceipt(changed,cmd));
 const coerced=copy(receipt);coerced.event.command.payload.totalAmount=20;assert.throws(()=>decodeClientFinancingReceipt(coerced,cmd));await asOwner();
});
await test('personnel UTC-labelled history/context remains correct under a non-UTC database session',async()=>{
 await db.exec("SET TIME ZONE 'Europe/Berlin'");await asAuth();const context=await scalar('public.web_personnel_context',[t,actor,employee]);
 assert.deepEqual(decodePersonnelContext(context,{tenantId:t,employeeId:employee,actorId:actor},Date.now()+1000),context);
 await asOwner();await db.exec("SET TIME ZONE 'UTC'");
});
await db.close();
