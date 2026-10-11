// Captured production bodies in isolated synthetic Postgres. No remote writes,
// outbound dispatch, PDF generation, Auth accounts or real customer identities.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
const require = createRequire(import.meta.url);
const { PGlite } = require('@electric-sql/pglite');
const db = new PGlite();
const metadata = JSON.parse(readFileSync(new URL('../../docs/workflow-server-write-rpc-metadata-20261011.json', import.meta.url), 'utf8'));
const draft = readFileSync(new URL('../../docs/workflow-server-unused-rpc-draft.sql', import.meta.url), 'utf8');
const tenant = '10000000-0000-0000-0000-000000000001';
const foreignTenant = '10000000-0000-0000-0000-000000000002';
const user = '20000000-0000-0000-0000-000000000001';
const profile = '30000000-0000-0000-0000-000000000001';
const foreignProfile = '30000000-0000-0000-0000-000000000002';
const employee = '40000000-0000-0000-0000-000000000001';
const foreignEmployee = '40000000-0000-0000-0000-000000000002';
const foreignClient = '50000000-0000-0000-0000-000000000002';
const foreignThread = '60000000-0000-0000-0000-000000000002';
const foreignAssignment = '70000000-0000-0000-0000-000000000002';
const foreignTemplate = '80000000-0000-0000-0000-000000000002';
const foreignInvoice = '90000000-0000-0000-0000-000000000002';
const writers = [
  {name:'send_thread_message',signature:'send_thread_message(uuid,text,uuid,uuid,uuid,boolean)',
    sql:'SELECT send_thread_message($1,$2,$3,$4,$5,$6) AS id',
    args:[foreignThread,'Synthetic foreign internal note',foreignProfile,foreignEmployee,foreignClient,true],table:'messages'},
  {name:'enqueue_outbound_message',signature:'enqueue_outbound_message(uuid,public.outbox_channel,text,text,text,text,text,jsonb,text,uuid)',
    sql:'SELECT enqueue_outbound_message($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) AS id',
    args:[foreignTenant,'email','synthetic-recipient@example.invalid','Synthetic subject','Synthetic body',null,null,{},'clients',foreignClient],table:'outbound_messages'},
  {name:'enqueue_pdf_generation_job',signature:'enqueue_pdf_generation_job(uuid,text,text,text,uuid,jsonb)',
    sql:'SELECT enqueue_pdf_generation_job($1,$2,$3,$4,$5,$6) AS id',
    args:[foreignTenant,'Synthetic PDF job','synthetic-template','clients',foreignClient,{synthetic:true}],table:'pdf_generation_jobs'},
  {name:'create_care_report',signature:'create_care_report(uuid,uuid,uuid,text,text,text,boolean)',
    sql:'SELECT create_care_report($1,$2,$3,$4,$5,$6,$7) AS id',
    args:[foreignClient,employee,foreignAssignment,'synthetic-category','Synthetic title','Synthetic care report',true],table:'care_reports'},
];
const additionalWriters = [
  {name:'create_dunning_case_for_invoice',signature:'create_dunning_case_for_invoice(uuid,integer)',
    sql:'SELECT create_dunning_case_for_invoice($1,1) AS id',args:[foreignInvoice]},
  {name:'generate_invoice_number',signature:'generate_invoice_number(uuid)',
    sql:'SELECT generate_invoice_number($1) AS result',args:[foreignTenant]},
  {name:'seed_tenant_billing_handoff_defaults',signature:'seed_tenant_billing_handoff_defaults(uuid)',
    sql:'SELECT seed_tenant_billing_handoff_defaults($1)',args:[foreignTenant]},
];
const billingTables=['invoices','tenant_billing_settings','dunning_cases','tenant_client_billing_handoff_settings','tenant_service_type_billing_rules'];
await db.exec(`
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
 'SELECT nullif(current_setting(''fixture.uid'',true),'''')::uuid';
CREATE FUNCTION current_tenant_id() RETURNS uuid LANGUAGE sql STABLE AS
 'SELECT nullif(current_setting(''fixture.tenant'',true),'''')::uuid';
CREATE TYPE outbox_channel AS ENUM('email','sms');
CREATE TABLE profiles(id uuid PRIMARY KEY,auth_user_id uuid,tenant_id uuid);
CREATE FUNCTION current_profile_id() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS
 'SELECT id FROM profiles WHERE auth_user_id=auth.uid() LIMIT 1';
CREATE TABLE employees(id uuid PRIMARY KEY,tenant_id uuid);
CREATE TABLE clients(id uuid PRIMARY KEY,tenant_id uuid);
CREATE TABLE assignments(id uuid PRIMARY KEY,tenant_id uuid);
CREATE TABLE message_threads(id uuid PRIMARY KEY,tenant_id uuid,last_message_at timestamptz,
 last_message_preview text,updated_at timestamptz);
CREATE TABLE messages(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,
 thread_id uuid REFERENCES message_threads(id),sender_profile_id uuid REFERENCES profiles(id),
 sender_employee_id uuid REFERENCES employees(id),sender_client_id uuid REFERENCES clients(id),
 body text,status text,sent_at timestamptz,is_internal_note boolean);
CREATE TABLE outbound_messages(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,
 channel outbox_channel,status text,recipient_address text,subject text,body_text text,body_html text,
 template_key text,placeholder_values jsonb,related_table text,related_record_id uuid,
 created_by uuid REFERENCES profiles(id));
CREATE TABLE system_templates(id uuid PRIMARY KEY,tenant_id uuid,template_key text);
CREATE TABLE pdf_generation_jobs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,
 status text,title text,template_key text,template_id uuid REFERENCES system_templates(id),
 target_table text,target_record_id uuid,input_payload jsonb,created_by uuid REFERENCES profiles(id));
CREATE TABLE care_reports(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,
 client_id uuid REFERENCES clients(id),employee_id uuid REFERENCES employees(id),
 assignment_id uuid REFERENCES assignments(id),category text,title text,report_text text,
 is_critical boolean,requires_follow_up boolean);
CREATE TABLE invoices(id uuid PRIMARY KEY,tenant_id uuid,client_id uuid,open_amount numeric,status text);
CREATE TABLE tenant_billing_settings(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,
 invoice_prefix text,next_invoice_number integer,dunning_fee numeric);
CREATE TABLE dunning_cases(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,invoice_id uuid,
 client_id uuid,level integer,status text,due_date date,fee_amount numeric,open_amount_at_creation numeric,
 title text,message text,created_by uuid,notes text);
CREATE TABLE tenant_client_service_types(id uuid PRIMARY KEY,tenant_id uuid);
CREATE TABLE tenant_client_billing_handoff_settings(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid UNIQUE,default_currency text,default_unit text,default_invoice_mode text,
 require_signature boolean,require_approval boolean,allow_self_payer_fallback boolean);
CREATE TABLE tenant_service_type_billing_rules(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,
 service_type_id uuid,default_unit text,default_billing_target_type text,require_budget boolean,
 require_signature boolean,require_approval boolean,is_active boolean,UNIQUE(tenant_id,service_type_id));
GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
GRANT USAGE ON TYPE outbox_channel TO anon,authenticated,service_role;
`);
for (const table of ['message_threads','messages','outbound_messages','system_templates','care_reports','clients','pdf_generation_jobs',...billingTables]) {
  await db.exec(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;
    GRANT SELECT,INSERT,UPDATE,DELETE ON ${table} TO authenticated;
    CREATE POLICY own_tenant ON ${table} TO authenticated USING(tenant_id=current_tenant_id()) WITH CHECK(tenant_id=current_tenant_id());`);
}
await db.query('INSERT INTO profiles VALUES($1,$2,$3),($4,NULL,$5)',[profile,user,tenant,foreignProfile,foreignTenant]);
await db.query('INSERT INTO employees VALUES($1,$2),($3,$4)',[employee,tenant,foreignEmployee,foreignTenant]);
await db.query('INSERT INTO clients VALUES($1,$2)',[foreignClient,foreignTenant]);
await db.query('INSERT INTO assignments VALUES($1,$2)',[foreignAssignment,foreignTenant]);
await db.query('INSERT INTO message_threads(id,tenant_id) VALUES($1,$2)',[foreignThread,foreignTenant]);
await db.query('INSERT INTO system_templates VALUES($1,$2,$3)',[foreignTemplate,foreignTenant,'synthetic-template']);
await db.query("INSERT INTO invoices VALUES($1,$2,$3,123.45,'draft')",[foreignInvoice,foreignTenant,foreignClient]);
await db.query("INSERT INTO tenant_billing_settings(tenant_id,invoice_prefix,next_invoice_number,dunning_fee) VALUES($1,'SYN',7,10)",[foreignTenant]);
await db.query('INSERT INTO tenant_client_service_types VALUES($1,$2)',[foreignTemplate,foreignTenant]);
for (const writer of [...writers,...additionalWriters]) {
  const captured = metadata.functions.find(f => f.name === writer.name);
  assert.ok(captured,'captured metadata required: ' + writer.name);
  await db.exec(captured.definition);
  await db.exec(`REVOKE EXECUTE ON FUNCTION ${writer.signature} FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION ${writer.signature} TO service_role;`);
  if (captured.auth) await db.exec(`GRANT EXECUTE ON FUNCTION ${writer.signature} TO authenticated;`);
  if (captured.anon) await db.exec(`GRANT EXECUTE ON FUNCTION ${writer.signature} TO anon;`);
}
async function actor(role='authenticated') {
  await db.exec('RESET ROLE');
  await db.query("SELECT set_config('fixture.uid',$1,false),set_config('fixture.tenant',$2,false)",[role==='authenticated'?user:'',role==='authenticated'?tenant:'']);
  await db.exec('SET ROLE ' + role);
}
async function snapshot() {
  await db.exec('RESET ROLE');
  const result = {};
  for (const table of ['message_threads',...writers.map(writer => writer.table),...billingTables]) {
    result[table] = (await db.query('SELECT * FROM '+table+' ORDER BY id')).rows;
  }
  return result;
}
for (const writer of writers) {
  await test('captured ' + writer.name + ' writes a foreign tenant despite the caller/table RLS scope',async () => {
    await actor();
    // The untrusted actor cannot access or write the foreign row directly.
    assert.equal((await db.query('SELECT id FROM clients WHERE id=$1',[foreignClient])).rows.length,0);
    const id = (await db.query(writer.sql,writer.args)).rows[0].id;
    await db.exec('RESET ROLE');
    const row = (await db.query('SELECT * FROM '+writer.table+' WHERE id=$1',[id])).rows[0];
    assert.equal(row.tenant_id,foreignTenant);
    if (writer.name==='send_thread_message') {
      assert.equal(row.sender_profile_id,foreignProfile);
      assert.equal(row.sender_employee_id,foreignEmployee);
      assert.equal(row.is_internal_note,true);
      const thread=(await db.query('SELECT last_message_preview FROM message_threads WHERE id=$1',[foreignThread])).rows[0];
      assert.equal(thread.last_message_preview,'Synthetic foreign internal note');
    } else if (writer.name==='enqueue_outbound_message') {
      assert.equal(row.recipient_address,'synthetic-recipient@example.invalid');
      assert.equal(row.created_by,profile);
      assert.equal(row.status,'queued');
    } else if (writer.name==='enqueue_pdf_generation_job') {
      assert.equal(row.target_record_id,foreignClient);
      assert.equal(row.template_id,foreignTemplate);
      assert.equal(row.created_by,profile);
    } else {
      assert.equal(row.client_id,foreignClient);
      assert.equal(row.employee_id,employee);
      assert.equal(row.requires_follow_up,true);
    }
  });
}
for (const writer of additionalWriters) {
  await test('captured '+writer.name+' mutates foreign billing data without an actor/tenant guard',async()=>{
    const before=await snapshot();
    await actor(writer.name==='seed_tenant_billing_handoff_defaults'?'anon':'authenticated');
    await db.query(writer.sql,writer.args);
    const after=await snapshot();
    assert.notDeepEqual(after,before);
    if(writer.name==='create_dunning_case_for_invoice'){
      assert.equal(after.dunning_cases.length,before.dunning_cases.length+1);
      assert.equal(after.invoices[0].status,'overdue');
    }else if(writer.name==='generate_invoice_number'){
      assert.equal(after.tenant_billing_settings[0].next_invoice_number,before.tenant_billing_settings[0].next_invoice_number+1);
    }else{
      assert.equal(after.tenant_client_billing_handoff_settings.length,1);
      assert.equal(after.tenant_service_type_billing_rules.length,1);
    }
  });
}
await test('draft applies twice without touching existing messages/jobs/reports/thread previews',async () => {
  const before=await snapshot();
  await db.exec(draft);await db.exec(draft);
  assert.deepEqual(await snapshot(),before);
});
for (const role of ['anon','authenticated']) {
  for (const writer of [...writers,...additionalWriters]) {
    await test(role+' cannot call '+writer.name+' and produces no new or changed rows',async () => {
      const before=await snapshot();
      await actor(role);
      await assert.rejects(db.query(writer.sql,writer.args),/permission denied/i);
      assert.deepEqual(await snapshot(),before);
    });
  }
}
await test('PUBLIC/anon/authenticated execution is revoked while service execution remains granted',async () => {
  await db.exec('RESET ROLE');
  for (const writer of [...writers,...additionalWriters]) {
    const row=(await db.query(`SELECT has_function_privilege('anon',$1,'EXECUTE') AS anon,
      has_function_privilege('authenticated',$1,'EXECUTE') AS authenticated,
      has_function_privilege('service_role',$1,'EXECUTE') AS service`,[writer.signature])).rows[0];
    assert.deepEqual(row,{anon:false,authenticated:false,service:true});
  }
});
for (const writer of writers) {
  await test('trusted service role can still use '+writer.name+' without a browser identity',async () => {
    const before=await snapshot();
    await actor('service_role');
    const id=(await db.query(writer.sql,writer.args)).rows[0].id;
    const after=await snapshot();
    assert.equal(after[writer.table].length,before[writer.table].length+1);
    assert.equal(after[writer.table].find(row=>row.id===id)?.tenant_id,foreignTenant);
  });
}
for(const writer of additionalWriters){
  await test('trusted service retains '+writer.name+' billing maintenance',async()=>{
    const before=await snapshot();
    await actor('service_role');
    await db.query(writer.sql,writer.args);
    const after=await snapshot();
    if(writer.name==='create_dunning_case_for_invoice')assert.equal(after.dunning_cases.length,before.dunning_cases.length+1);
    else if(writer.name==='generate_invoice_number')assert.equal(after.tenant_billing_settings[0].next_invoice_number,before.tenant_billing_settings[0].next_invoice_number+1);
    else assert.deepEqual(after,before); // Existing custom handoff rules are preserved.
  });
}
await db.close();
