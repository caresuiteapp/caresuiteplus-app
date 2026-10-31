// Executes the real patch, original inbox policies/table definitions and the
// existing visit -> assignment mirror in isolated PostgreSQL. Synthetic data
// only; no network or production database writes and no new test dependency.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const patch = read('../migrations/20261026154801_employee_assignment_notifications.sql');
const visitSchema = read('../migrations/0116_assist_visits_disposition.sql');
const inboxSchema = read('../migrations/0152_office_notifications_table.sql');
const mirror = read('../migrations/0198_assist_live_tracking_portal_repair.sql');
const tableSql = (source, table) => {
  const start = source.indexOf('CREATE TABLE IF NOT EXISTS public.' + table + ' (');
  assert.ok(start >= 0);
  return source.slice(start, source.indexOf('\n);', start) + 3);
};
const tenant = '10000000-0000-0000-0000-000000000001';
const otherTenant = '10000000-0000-0000-0000-000000000002';
const employee = '20000000-0000-0000-0000-000000000001';
const colleague = '20000000-0000-0000-0000-000000000002';
const foreignEmployee = '20000000-0000-0000-0000-000000000003';
const client = '30000000-0000-0000-0000-000000000001';
const otherClient = '30000000-0000-0000-0000-000000000002';
const foreignClient = '30000000-0000-0000-0000-000000000003';
await db.exec(`
CREATE ROLE anon; CREATE ROLE authenticated;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('fixture.user',true),'')::uuid $$;
CREATE FUNCTION public.current_tenant_id() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('fixture.tenant',true),'')::uuid $$;
CREATE FUNCTION public.resolve_current_employee_id() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('fixture.employee',true),'')::uuid $$;
CREATE FUNCTION public.has_permission(text) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
CREATE TABLE public.tenants(id uuid PRIMARY KEY);
CREATE TABLE public.employees(id uuid PRIMARY KEY, tenant_id uuid REFERENCES tenants ON DELETE CASCADE);
CREATE TABLE public.clients(id uuid PRIMARY KEY, tenant_id uuid REFERENCES tenants ON DELETE CASCADE);
CREATE TABLE public.profiles(id uuid PRIMARY KEY);
CREATE TABLE public.employee_portal_accounts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid, employee_id uuid, status text);
CREATE TABLE public.notification_broadcasts(id uuid PRIMARY KEY);
CREATE TABLE public.message_threads(id uuid PRIMARY KEY);
CREATE TYPE public.assignment_status AS ENUM ('planned','confirmed','on_the_way','arrived','started','paused','finished','documentation_open','signature_open','completed','cancelled','no_show');
CREATE TYPE public.product_key AS ENUM ('assist');
CREATE TABLE public.assignments(id uuid PRIMARY KEY, tenant_id uuid, client_id uuid, employee_id uuid,
  assignment_date date, planned_start_at timestamptz, planned_end_at timestamptz, title text, description text,
  address_snapshot text, internal_notes text, client_visible_notes text, status assignment_status,
  product_key product_key, created_by uuid, created_at timestamptz, updated_at timestamptz,
  on_the_way_at timestamptz, arrived_at timestamptz, actual_start_at timestamptz, actual_end_at timestamptz, finished_at timestamptz);
`);
await db.exec(tableSql(visitSchema, 'assist_visits'));
await db.exec("ALTER TABLE public.assist_visits ADD COLUMN recurrence_json JSONB NOT NULL DEFAULT '{}'::jsonb");
await db.exec(tableSql(inboxSchema, 'office_notifications'));
// Use the actual existing recipient-scoped policies, not permissive substitutes.
await db.exec(inboxSchema.slice(inboxSchema.indexOf('ALTER TABLE public.office_notifications ENABLE ROW LEVEL SECURITY'), inboxSchema.indexOf('-- notification_attachments: Office-Glocke lesen')));
await db.exec('GRANT USAGE ON SCHEMA public,auth TO authenticated; GRANT SELECT,INSERT,UPDATE ON office_notifications TO authenticated;');
await db.exec(mirror.slice(mirror.indexOf('CREATE OR REPLACE FUNCTION public.sync_assignment_mirror_from_assist_visit()'), mirror.indexOf('-- Portal RLS: client reads tracking')));
await db.query('INSERT INTO tenants VALUES ($1),($2)', [tenant, otherTenant]);
await db.query('INSERT INTO employees VALUES ($1,$4),($2,$4),($3,$5)', [employee, colleague, foreignEmployee, tenant, otherTenant]);
await db.query('INSERT INTO clients VALUES ($1,$4),($2,$4),($3,$5)', [client, otherClient, foreignClient, tenant, otherTenant]);
await db.query("INSERT INTO employee_portal_accounts(tenant_id,employee_id,status) VALUES ($1,$2,'active'),($1,$3,'active'),($4,$5,'active')", [tenant, employee, colleague, otherTenant, foreignEmployee]);

const insert = async (values = {}) => {
  const attrs = {
    tenant_id: tenant, employee_id: employee, client_id: client,
    title: 'Synthetic visit', assignment_date: '2099-01-01',
    planned_start_at: '2099-01-01T09:00:00Z', planned_end_at: '2099-01-01T11:00:00Z',
    planning_status: 'scheduled', canonical_status: 'planned',
    ...values,
  };
  return (await db.query(`INSERT INTO assist_visits(${Object.keys(attrs).join(',')}) VALUES (${Object.keys(attrs).map((_,i)=>'$'+(i+1)).join(',')}) RETURNING id`, Object.values(attrs))).rows[0].id;
};
const notices = async () => (await db.query('SELECT * FROM office_notifications ORDER BY created_at,id')).rows;
const clearNotices = () => db.exec('TRUNCATE office_notifications');
const update = (id, sql, params=[]) => db.query(`UPDATE assist_visits SET ${sql} WHERE id=$${params.length+1}`, [...params,id]);
const policySnapshot = async () => (await db.query("SELECT policyname,cmd,roles,qual,with_check FROM pg_policies WHERE tablename='office_notifications' ORDER BY policyname")).rows;
const policiesBefore = await policySnapshot();

await test('rollout creates one current-plan summary for hundreds of future rows, never old-only/draft/cross-tenant plans', async () => {
  for (let i=0;i<150;i++) await insert();
  await insert({employee_id:colleague, planned_start_at:'2020-01-01T09:00:00Z',planned_end_at:'2020-01-01T11:00:00Z'});
  await insert({employee_id:colleague,planning_status:'draft'});
  const legacyDraft=await insert({employee_id:colleague,planning_status:'draft',canonical_status:'confirmed'});
  await insert({employee_id:foreignEmployee});
  await insert({employee_id:colleague,client_id:foreignClient});
  await db.exec(patch);
  const rows = await notices();
  assert.equal(rows.length,1);
  assert.equal(rows[0].recipient_employee_id,employee);
  assert.equal(rows[0].metadata.changeKind,'current_plan');
  assert.equal(rows[0].metadata.upcomingCount,150);
  assert.equal(rows[0].metadata.visitId,undefined);
  await update(legacyDraft,"description='Maintenance remains possible',canonical_status=canonical_status");
  assert.equal((await db.query('SELECT planning_status,canonical_status FROM assist_visits WHERE id=$1',[legacyDraft])).rows[0].planning_status,'draft');
  assert.equal((await notices()).length,1);
  await db.exec('UPDATE office_notifications SET is_read=true,read_at=now()');
  await db.exec(patch);
  assert.equal((await notices()).length,1);
  assert.equal((await notices())[0].is_read,true);
  assert.deepEqual(await policySnapshot(),policiesBefore);
  await db.exec('TRUNCATE assist_visits,assignments,office_notifications CASCADE');
});

await test('new own assignment is announced exactly once despite real mirror recursion and legacy visibility=false', async () => {
  const id = await insert({employee_portal_visible:false, portal_release_enabled:false});
  const rows = await notices();
  assert.equal(rows.length,1);
  assert.equal(rows[0].metadata.visitId,id);
  assert.equal(rows[0].metadata.changeKind,'created');
  assert.equal(rows[0].notification_type,'appointment');
  assert.equal(rows[0].recipient_user_id,null);
  assert.match(rows[0].body_preview,/01\.01\.2099, 10:00–12:00 Uhr \(Berliner Zeit\)/);
  assert.equal((await db.query('SELECT legacy_assignment_id FROM assist_visits WHERE id=$1',[id])).rows[0].legacy_assignment_id,id);
  assert.equal((await db.query('SELECT id FROM assignments WHERE id=$1',[id])).rows.length,1);
});

await test('draft and unassigned inserts stay silent; draft release produces a new-assignment notice', async () => {
  await clearNotices();
  const id = await insert({planning_status:'draft'});
  await insert({employee_id:null});
  assert.equal((await notices()).length,0);
  await update(id,"planning_status='scheduled'");
  assert.equal((await notices())[0].metadata.changeKind,'created');
});

await test('GPS/workflow/documentation/client-release/no-op changes do not notify', async () => {
  const id = await insert(); await clearNotices();
  await update(id,"execution_status='in_progress',canonical_status='started',actual_start_at=now(),on_the_way_at=now(),arrived_at=now(),documentation_status='open',proof_status='pending',internal_notes='Internal only',portal_release_enabled=true,employee_portal_visible=false,updated_at=now()");
  await update(id,"canonical_status='completed',execution_status='completed',finished_at=now(),actual_end_at=now()");
  await update(id,'title=title');
  assert.equal((await notices()).length,0);
});

await test('recurrence rule, end, weekdays and skipped dates notify; materialization bookkeeping stays silent',async()=>{
  const id=await insert({recurrence_json:{pattern:'weekly',weekdays:['mon']}}); await clearNotices();
  await update(id,"recurrence_json=recurrence_json||$1::jsonb",[JSON.stringify({endDate:'2099-06-01'})]);
  assert.equal((await notices()).length,1); await clearNotices();
  await update(id,"recurrence_json=recurrence_json||$1::jsonb",[JSON.stringify({weekdays:['tue']})]);
  assert.equal((await notices()).length,1); await clearNotices();
  await update(id,"recurrence_json=recurrence_json||$1::jsonb",[JSON.stringify({pattern:'biweekly',occurrenceCount:4})]);
  assert.equal((await notices()).length,1); await clearNotices();
  await update(id,"recurrence_json=recurrence_json||$1::jsonb",[JSON.stringify({detachedOccurrenceDates:['2099-01-08'],materializedOccurrences:{'2099-01-08':'40000000-0000-0000-0000-000000000001'}})]);
  assert.equal((await notices()).length,0);
  await insert({recurrence_json:{pattern:'none',parentSeriesId:id,sourceOccurrenceDate:'2099-01-08'}});
  assert.equal((await notices()).length,0);
  await update(id,"recurrence_json=recurrence_json||$1::jsonb",[JSON.stringify({detachedOccurrenceDates:['2099-01-08','2099-01-15']})]);
  assert.equal((await notices()).length,1);
});

await test('completed recurring master still reports future series-rule changes, while completion itself is silent',async()=>{
  const id=await insert({recurrence_json:{pattern:'weekly'}}); await clearNotices();
  await update(id,"canonical_status='completed',execution_status='completed'");
  assert.equal((await notices()).length,0);
  await update(id,"recurrence_json=recurrence_json||'{\"endDate\":\"2099-12-31\"}'::jsonb");
  assert.equal((await notices()).length,1);
});

await test('failed occurrence materialization cleanup stays silent while the parent still supplies that occurrence',async()=>{
  const parent=await insert({recurrence_json:{pattern:'weekly'}}); await clearNotices();
  const child=await insert({recurrence_json:{pattern:'none',parentSeriesId:parent,sourceOccurrenceDate:'2099-01-08'}});
  await db.query('DELETE FROM assist_visits WHERE id=$1',[child]);
  assert.equal((await notices()).length,0);
  const detached=await insert({recurrence_json:{pattern:'none',parentSeriesId:parent,sourceOccurrenceDate:'2099-01-15'}});
  await update(parent,"recurrence_json=recurrence_json||$1::jsonb",[JSON.stringify({detachedOccurrenceDates:['2099-01-15'],materializedOccurrences:{'2099-01-15':detached}})]);
  await clearNotices();
  await db.query('DELETE FROM assist_visits WHERE id=$1',[detached]);
  assert.equal((await notices()).length,1);
  assert.equal((await notices())[0].metadata.changeKind,'removed');
});

await test('reopening a completed non-series assignment creates a new planning notice',async()=>{
  const id=await insert({canonical_status:'completed'}); await clearNotices();
  await update(id,"canonical_status='confirmed'");
  assert.equal((await notices()).length,1); assert.equal((await notices())[0].metadata.changeKind,'created');
});

for (const [label, sql, params] of [
  ['date',"assignment_date='2099-01-02'",[]],
  ['start time',"planned_start_at='2099-01-01T10:00:00Z'",[]],
  ['end time',"planned_end_at='2099-01-01T12:00:00Z'",[]],
  ['address',"address_snapshot='New synthetic address'",[]],
  ['title',"title='Changed synthetic title'",[]],
  ['client','client_id=$1',[otherClient]],
  ['description',"description='New instructions'",[]],
  ['service',"service_name='Changed service'",[]],
  ['location notes',"location_notes='Ring the bell'",[]],
  ['confirmation',"canonical_status='confirmed'",[]],
]) await test(label+' changes notify even when updated_at never changes', async () => {
  const id = await insert({updated_at:'2020-01-01T00:00:00Z'}); await clearNotices();
  await update(id,sql,params);
  const rows=await notices(); assert.equal(rows.length,1); assert.equal(rows[0].metadata.changeKind,'changed');
  assert.equal(rows[0].recipient_employee_id,employee);
});

await test('reassignment uses two scoped notices; old recipient sees only old time, no new employee/client details', async () => {
  const id = await insert(); await clearNotices();
  await update(id,"employee_id=$1,client_id=$2,planned_start_at='2099-01-02T09:00:00Z',title='PRIVATE NEW TITLE',address_snapshot='PRIVATE NEW ADDRESS'",[colleague,otherClient]);
  const rows=await notices(); assert.equal(rows.length,2);
  const old=rows.find(r=>r.recipient_employee_id===employee);
  const next=rows.find(r=>r.recipient_employee_id===colleague);
  assert.equal(old.metadata.changeKind,'removed'); assert.match(old.metadata.plannedStartAt,/2099-01-01/);
  assert.equal(next.metadata.changeKind,'created'); assert.match(next.metadata.plannedStartAt,/2099-01-02/);
  for(const value of [colleague,otherClient,'PRIVATE NEW TITLE','PRIVATE NEW ADDRESS']) assert.ok(!JSON.stringify(old).includes(value));
});

for (const [kind, sql] of [['cancelled',"planning_status='cancelled'"],['cancelled',"canonical_status='cancelled'"],['cancelled',"canonical_status='no_show'"],['removed','employee_id=NULL']]) {
  await test(sql+' communicates withdrawal to the old assignee',async()=>{
    const id=await insert(); await clearNotices(); await update(id,sql);
    const rows=await notices(); assert.equal(rows.length,1); assert.equal(rows[0].metadata.changeKind,kind);
  });
}

await test('published plans cannot disappear into draft; failed writes change neither plan nor notifications',async()=>{
  const id=await insert(); await clearNotices();
  await assert.rejects(update(id,"planning_status='draft'"),error=>error.code==='23514' && /veröffentlicht/.test(error.message));
  assert.equal((await db.query('SELECT planning_status FROM assist_visits WHERE id=$1',[id])).rows[0].planning_status,'scheduled');
  assert.equal((await notices()).length,0);
});

await test('draft confirmation/execution is blocked atomically on direct visit writes and legacy assignment writes',async()=>{
  const id=await insert({planning_status:'draft'}); await clearNotices();
  await db.query("INSERT INTO assignments(id,tenant_id,status) VALUES($1,$2,'planned')",[id,tenant]);
  for(const state of ['confirmed','on_the_way','arrived','started','completed']) {
    await assert.rejects(update(id,'canonical_status=$1',[state]),error=>error.code==='23514');
    await assert.rejects(db.query('UPDATE assignments SET status=$1::assignment_status WHERE id=$2',[state,id]),error=>error.code==='23514');
  }
  await assert.rejects(insert({planning_status:'draft',canonical_status:'confirmed'}),error=>error.code==='23514');
  // Linking via the legacy ID is protected too, not only identical visit IDs.
  const legacy='50000000-0000-0000-0000-000000000001';
  await db.query("INSERT INTO assignments(id,tenant_id,status) VALUES($1,$2,'planned')",[legacy,tenant]);
  await insert({planning_status:'draft',legacy_assignment_id:legacy});
  await assert.rejects(db.query("UPDATE assignments SET status='confirmed' WHERE id=$1",[legacy]),error=>error.code==='23514');
  assert.equal((await notices()).length,0);
  // The explicit publish write remains available and produces exactly one info.
  await update(id,"planning_status='scheduled',canonical_status='confirmed'");
  assert.equal((await notices()).length,1); assert.equal((await notices())[0].metadata.changeKind,'created');
  assert.equal((await db.query('SELECT status FROM assignments WHERE id=$1',[id])).rows[0].status,'confirmed');
});

await test('deleting an assigned visit leaves a generic removal notice',async()=>{
  const id=await insert(); await clearNotices(); await db.query('DELETE FROM assist_visits WHERE id=$1',[id]);
  assert.equal((await notices())[0].metadata.changeKind,'removed');
});

await test('same-transaction edits coalesce, separate changes retain new IDs, rollback delivers nothing',async()=>{
  const id=await insert(); await clearNotices();
  await db.exec('BEGIN'); await update(id,"title='First'"); await update(id,"title='Final',planned_end_at='2099-01-01T12:00:00Z'"); await db.exec('COMMIT');
  let rows=await notices(); assert.equal(rows.length,1); assert.match(rows[0].metadata.plannedEndAt,/12:00:00/);
  const firstId=rows[0].id;
  await db.exec('UPDATE office_notifications SET is_read=true,read_at=now()');
  await update(id,"title='Next committed revision'");
  rows=await notices(); assert.equal(rows.length,2); assert.equal(rows.find(r=>r.id===firstId).is_read,true); assert.equal(rows.filter(r=>!r.is_read).length,1);
  await db.exec('BEGIN'); await update(id,"title='Rolled back'"); await db.exec('ROLLBACK');
  assert.equal((await notices()).length,2);
});

await test('inconsistent cross-tenant recipients or clients cannot obtain appointment notices',async()=>{
  await clearNotices(); await insert({employee_id:foreignEmployee}); await insert({client_id:foreignClient});
  assert.equal((await notices()).length,0);
  await insert({tenant_id:otherTenant,employee_id:foreignEmployee,client_id:foreignClient});
  assert.equal((await notices()).length,1); assert.equal((await notices())[0].tenant_id,otherTenant);
});

await test('existing RLS permits own read/ack only; no public/authenticated privileged notification RPC',async()=>{
  await clearNotices(); await insert(); await insert({employee_id:colleague});
  await insert({tenant_id:otherTenant,employee_id:foreignEmployee,client_id:foreignClient});
  const own=(await notices()).find(r=>r.recipient_employee_id===employee);
  const foreign=(await notices()).find(r=>r.recipient_employee_id===colleague);
  for (const role of ['anon','authenticated']) {
    for(const fn of ['notify_employee_assignment_change','guard_assist_visit_publication','guard_assignment_draft_publication']) {
      assert.equal((await db.query('SELECT has_function_privilege($1,$2,\'EXECUTE\') AS allowed',[role,'public.'+fn+'()'])).rows[0].allowed,false);
    }
  }
  await db.query("SELECT set_config('fixture.tenant',$1,false),set_config('fixture.employee',$2,false)",[tenant,employee]);
  await db.exec('SET ROLE authenticated');
  assert.deepEqual((await notices()).map(r=>r.id),[own.id]);
  assert.equal((await db.query('UPDATE office_notifications SET is_read=true,read_at=now() WHERE id=$1 RETURNING id',[foreign.id])).rows.length,0);
  assert.equal((await db.query('UPDATE office_notifications SET is_read=true,read_at=now() WHERE id=$1 RETURNING id',[own.id])).rows.length,1);
  await assert.rejects(db.query('UPDATE office_notifications SET recipient_employee_id=$1 WHERE id=$2',[colleague,own.id]),/row-level security/i);
  await assert.rejects(db.query("INSERT INTO office_notifications(tenant_id,recipient_employee_id,notification_type,title) VALUES($1,$2,'appointment','Forged')",[tenant,employee]),/row-level security/i);
  await assert.rejects(db.query('SELECT public.notify_employee_assignment_change()'),/permission denied/i);
  await db.exec('RESET ROLE');
  assert.deepEqual(await policySnapshot(),policiesBefore);
});

await test('tenant cascade deletion cannot resurrect notices or block data removal',async()=>{
  // Ensure the assist_visits tenant cascade runs before employee/client
  // cascades: their RI triggers are dropped/recreated later than the visit FK.
  await db.exec('ALTER TABLE employees DROP CONSTRAINT employees_tenant_id_fkey; ALTER TABLE clients DROP CONSTRAINT clients_tenant_id_fkey; ALTER TABLE employees ADD CONSTRAINT employees_tenant_id_fkey FOREIGN KEY(tenant_id) REFERENCES tenants ON DELETE CASCADE; ALTER TABLE clients ADD CONSTRAINT clients_tenant_id_fkey FOREIGN KEY(tenant_id) REFERENCES tenants ON DELETE CASCADE;');
  await db.query('DELETE FROM tenants WHERE id=$1',[otherTenant]);
  assert.equal((await db.query('SELECT id FROM assist_visits WHERE tenant_id=$1',[otherTenant])).rows.length,0);
  assert.equal((await db.query('SELECT id FROM office_notifications WHERE tenant_id=$1',[otherTenant])).rows.length,0);
});

await db.close();
