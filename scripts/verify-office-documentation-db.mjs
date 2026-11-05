import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

// All writes stay in this isolated database; no hosted credentials or records.
const db = new PGlite();
const ids = Object.fromEntries(['tenant','foreignTenant','admin','staff','clientUser','profile','role','employee','foreignEmployee','client','foreignClient','account','visit','documentation'].map(k => [k,randomUUID()]));
const sql = readFileSync('supabase/patches/office_documentation_workspace.sql','utf8');
const migration = readFileSync('supabase/migrations/20261105090254_office_documentation_workspace.sql','utf8');
assert.equal(sql,migration);
const result = async (q,params=[]) => (await db.query(q,params)).rows[0]?.result;
const owner = async (q,params=[]) => { await db.exec('RESET ROLE'); return db.query(q,params); };
async function actor(user=ids.admin,portal='business',tenant=ids.tenant) {
  await db.exec('RESET ROLE');
  await db.query("SELECT set_config('test.uid',$1,false),set_config('test.tenant',$2,false),set_config('test.jwt',$3,false)",[user,tenant,JSON.stringify({app_metadata:{portal_type:portal,portal_account_id:portal==='employee'?ids.account:null,role_key:portal==='employee'?'employee_portal':'business_admin'}})]);
  await db.exec('SET ROLE authenticated');
}
const payload = (patch={}) => ({area:'client',clientId:ids.client,employeeId:ids.employee,category:'care',priority:'normal',title:' Freier Bericht ',body:' Beobachtung und Absprache ',occurredAt:'2026-03-31T22:30:00Z',...patch});
const create = (draft=payload(),id=randomUUID(),tenant=ids.tenant) => result('SELECT public.office_documentation_create($1,$2,$3::jsonb) AS result',[tenant,id,JSON.stringify(draft)]);
const list = (filters={},tenant=ids.tenant) => result('SELECT public.office_documentation_workspace($1,$2::jsonb) AS result',[tenant,JSON.stringify(filters)]);
const denied = async (promise,code='42501') => assert.rejects(promise,e=>{assert.equal(e.code,code,e.message);return true;});
let checks=0;
const pass = async(name,fn)=>{await fn();checks++;console.log(`[office-documentation-db] PASS ${name}`);};
try {
  await db.exec(readFileSync('scripts/fixtures/office-internal-notes-test-schema.sql','utf8'));
  await db.exec(`ALTER TABLE public.profiles ADD first_name text,ADD last_name text;
    CREATE TABLE public.clients(id uuid PRIMARY KEY,tenant_id uuid,first_name text,last_name text,status text DEFAULT 'active',deleted_at timestamptz);
    CREATE TABLE public.assist_visits(id uuid PRIMARY KEY,tenant_id uuid,client_id uuid,employee_id uuid,title text,service_name text,actual_end_at timestamptz,execution_status text,canonical_status text);
    CREATE TABLE public.assist_visit_documentation(id uuid PRIMARY KEY,tenant_id uuid,visit_id uuid,short_description text,special_notes text,deviations text,deviation_justification text,referral_required boolean,emergency_or_problem boolean,sis_notes text,vitals_summary text,body_map_notes text,medication_notes text,care_report_notes text,submitted_at timestamptz,submitted_by uuid,created_at timestamptz DEFAULT now());`);
  await db.exec(sql);
  await db.query('INSERT INTO public.tenants(id) VALUES($1),($2)',[ids.tenant,ids.foreignTenant]);
  await db.query('INSERT INTO auth.users(id) VALUES($1),($2),($3)',[ids.admin,ids.staff,ids.clientUser]);
  await db.query("INSERT INTO public.roles(id,key,is_admin_role) VALUES($1,'business_admin',true)",[ids.role]);
  await db.query("INSERT INTO public.profiles(id,auth_user_id,tenant_id,role_id,display_name) VALUES($1,$2,$3,$4,'Office Test')",[ids.profile,ids.admin,ids.tenant,ids.role]);
  await db.query("INSERT INTO public.employees(id,tenant_id,first_name,last_name) VALUES($1,$2,'Team','Test'),($3,$4,'Foreign','Staff')",[ids.employee,ids.tenant,ids.foreignEmployee,ids.foreignTenant]);
  await db.query("INSERT INTO public.clients(id,tenant_id,first_name,last_name) VALUES($1,$2,'Client','Test'),($3,$4,'Foreign','Client')",[ids.client,ids.tenant,ids.foreignClient,ids.foreignTenant]);
  await db.query('INSERT INTO public.employee_portal_accounts(id,tenant_id,employee_id,auth_user_id) VALUES($1,$2,$3,$4)',[ids.account,ids.tenant,ids.employee,ids.staff]);
  await actor(); let receipt;const id=randomUUID();
  await pass('free entry persists without any assignment and retries exactly once',async()=>{
    receipt=await create(payload(),id);assert.equal(receipt.id,id);assert.equal((await list()).total,1);
    assert.deepEqual(await create(payload(),id),receipt);assert.equal((await list()).total,1);
    await denied(create(payload({body:'Changed'}),id),'40001');
    const entry=(await list()).items[0];assert.equal(entry.author_name,'Office Test');assert.equal(entry.body,'Beobachtung und Absprache');assert.equal(entry.source,'manual');
  });
  await pass('entity isolation, required content, future dates and priorities are enforced on server',async()=>{
    for(const patch of [{clientId:ids.foreignClient},{employeeId:ids.foreignEmployee},{title:''},{body:' '},{priority:'fake'},{area:'client',clientId:''},{occurredAt:'2099-01-01T00:00:00Z'}]) await denied(create(payload(patch)),'22023');
    await denied(list({},ids.foreignTenant));assert.equal((await list()).total,1);
  });
  await pass('month boundaries use Berlin summer time and search treats wildcards literally',async()=>{
    assert.equal((await list({month:'2026-04'})).total,1);assert.equal((await list({month:'2026-03'})).total,0);
    assert.equal((await list({query:'BEOBACHTUNG'})).total,1);assert.equal((await list({query:'%'})).total,0);
    assert.equal((await list({clientId:ids.client,employeeId:ids.employee,category:'care',source:'manual'})).total,1);
    await denied(list({month:'2026-13'}),'22023');await denied(list({offset:-1}),'22023');
  });
  await pass('active staff can read the common feed and document without an Office profile',async()=>{
    await actor(ids.staff,'employee');assert.equal((await list()).items[0].id,id);
    const entry=await create(payload({area:'administration',clientId:'',employeeId:'',title:'Team report'}));
    assert.equal((await list()).items.find(i=>i.id===entry.id).author_name,'Team Test');
    await denied(db.query('SELECT * FROM care_security.office_documentation_entries'));
    await denied(db.query('DELETE FROM care_security.office_documentation_entries'));
  });
  await pass('client/family, blocked account, deactivated employee, anonymous and foreign actors are denied',async()=>{
    await actor(ids.clientUser,'client');await denied(list());await denied(create());
    await actor(ids.staff,'family');await denied(list());
    await owner('UPDATE public.employee_portal_accounts SET blocked_at=now() WHERE id=$1',[ids.account]);
    await actor(ids.staff,'employee');await denied(list());
    await owner('UPDATE public.employee_portal_accounts SET blocked_at=NULL WHERE id=$1',[ids.account]);
    await owner("UPDATE public.employees SET status='inactive' WHERE id=$1",[ids.employee]);await actor(ids.staff,'employee');await denied(list());
    await owner("UPDATE public.employees SET status='active' WHERE id=$1",[ids.employee]);
    await db.exec('RESET ROLE; SET ROLE anon');await denied(list());await actor();
  });
  await pass('only submitted finished visit reports appear automatically, once, with late corrections',async()=>{
    await owner("INSERT INTO public.assist_visits(id,tenant_id,client_id,employee_id,title,execution_status,canonical_status,actual_end_at) VALUES($1,$2,$3,$4,'Visit report','in_progress','started','2026-04-01T10:00:00Z')",[ids.visit,ids.tenant,ids.client,ids.employee]);
    await owner("INSERT INTO public.assist_visit_documentation(id,tenant_id,visit_id,short_description,special_notes,submitted_at) VALUES($1,$2,$3,'Original report','Internal observation','2026-04-01T10:30:00Z')",[ids.documentation,ids.tenant,ids.visit]);
    await actor();assert.equal((await list({source:'visit'})).total,0);
    await owner("UPDATE public.assist_visits SET execution_status='completed',canonical_status='completed' WHERE id=$1",[ids.visit]);
    await actor();const feed=await list({source:'visit'});assert.equal(feed.total,1);assert.match(feed.items[0].body,/Internal observation/);assert.equal(feed.items[0].visit_id,ids.visit);
    await owner("UPDATE public.assist_visit_documentation SET short_description='Updated original' WHERE id=$1",[ids.documentation]);
    await actor();assert.equal((await list({source:'visit'})).total,1);assert.match((await list({source:'visit'})).items[0].body,/Updated original/);
    await owner("UPDATE public.assist_visits SET canonical_status='cancelled' WHERE id=$1",[ids.visit]);await actor();assert.equal((await list({source:'visit'})).total,0);
  });
  await pass('pagination has deterministic order and no duplicate items',async()=>{
    for(let i=0;i<51;i++)await create(payload({title:`Entry ${i}`}));
    const first=await list(),second=await list({offset:50});assert.equal(first.total,53);assert.equal(first.items.length,50);assert.equal(second.items.length,3);
    assert.equal(new Set([...first.items,...second.items].map(i=>i.id)).size,53);
  });
  await pass('production company authorization still enforces explicit denials and restricted scopes',async()=>{
    await db.exec('RESET ROLE');
    await db.exec(readFileSync('supabase/migrations/20261015085833_company_access.sql','utf8'));
    await owner('UPDATE public.employees SET profile_id=$1 WHERE id=$2',[ids.profile,ids.employee]);
    await actor();assert.equal((await list()).total,53);
    await owner("INSERT INTO public.employee_permission_overrides(tenant_id,employee_id,permission_key,allowed) VALUES($1,$2,'office.access',false)",[ids.tenant,ids.employee]);
    await actor();await denied(list());await denied(create());
    await owner('DELETE FROM public.employee_permission_overrides');
    await owner("INSERT INTO public.employee_data_scopes(tenant_id,employee_id,module,scope_type,scope_value) VALUES($1,$2,'office','employee',$3)",[ids.tenant,ids.employee,ids.employee]);
    await actor();await denied(list());
  });
  console.log(`[office-documentation-db] ${checks} scenario groups passed.`);
} finally {await db.close();}
