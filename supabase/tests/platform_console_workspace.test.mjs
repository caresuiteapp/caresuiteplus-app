import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const db = new PGlite();
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const migration = name => readFileSync(new URL(`../migrations/${name}`,import.meta.url),'utf8');
const query = async (sql, values=[]) => (await db.query(sql,values)).rows;
const scalar = async (sql, values=[]) => Object.values((await query(sql,values))[0])[0];
const login = async n => { await db.exec('RESET ROLE'); await query("SELECT set_config('request.jwt.claim.sub',$1,false)",[id(n)]);await db.exec('SET ROLE authenticated'); };
await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;
  CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,deleted_at timestamptz);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  GRANT USAGE ON SCHEMA public,auth TO authenticated,anon;
  GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated,anon;
  CREATE TABLE public.tenants(id uuid PRIMARY KEY,name text,slug text);
`);
for(const name of ['0246_platform_console_foundation_live.sql','0254_platform_2_0a_foundation.sql','0258_platform_console_v2_operations.sql']) {
  try { await db.exec(migration(name)); } catch(error) { console.error('Baseline migration failed:',name,error.message); await db.close(); throw new Error(error.message); }
}
await db.exec(migration('20260912190000_platform_console_workspace.sql'));
await db.exec(`INSERT INTO tenants(id) VALUES('${id(1)}'),('${id(2)}');
 INSERT INTO auth.users VALUES('${id(10)}','owner@example.test',null),('${id(11)}','reader@example.test',null),('${id(12)}','second@example.test',null),('${id(13)}','unassigned@example.test',null);
 INSERT INTO platform_users(user_id,email,role,status) VALUES('${id(10)}','owner@example.test','platform_owner','active'),('${id(11)}','reader@example.test','platform_readonly','active');
 INSERT INTO platform_tenants(tenant_id,tenant_name) VALUES('${id(1)}','Test A'),('${id(2)}','Test B');
 INSERT INTO platform_system_settings(setting_key,value,is_sensitive) VALUES('console_plain','false',false),('console_private','"hidden"',true),('console_nested','{"transport":{"password":"hidden"},"enabled":true}',false);
`);
await test('Platform Console database integration',async t=>{
  await t.test('migration installs against the existing platform schema and can be reapplied',async()=>{
    await db.exec(migration('20260912190000_platform_console_workspace.sql'));
    assert.equal(await scalar("SELECT has_function_privilege('anon','public.platform_record_console_finance(uuid,text,jsonb,text)','EXECUTE')"),false);
    assert.equal(await scalar("SELECT has_table_privilege('authenticated','public.platform_console_requests','SELECT')"),false);
  });
  await t.test('unassigned and readonly users cannot mutate the catalog',async()=>{
    for(const actor of [13,11]){await login(actor);await assert.rejects(query("SELECT platform_save_module_catalog('test_new','Test','','','available','Test record')"),/platform_forbidden/);}
  });
  await t.test('catalog saves are audited and core functions and removed Bodymap stay protected',async()=>{
    await login(10);const result=await scalar("SELECT platform_save_module_catalog('test_new','Test function','A description','Operations','beta','Test record')");
    assert.equal(result.is_beta,true);assert.equal(result.status,'beta');
    assert.equal(Number(await scalar("SELECT count(*) FROM platform_audit_log WHERE action='module.catalog_saved' AND target_id=$1",[result.id])),1);
    await assert.rejects(query("SELECT platform_save_module_catalog('healthos','HealthOS','','','disabled','Test record')"),/core_module_protected/);
    await assert.rejects(query("SELECT platform_save_module_catalog('bodymap_3d','Bodymap','','','available','Test record')"),/invalid_module_key/);
  });
  await t.test('settings never expose top-level or nested secrets and preserve value types',async()=>{
    await login(10);const settings=await scalar('SELECT platform_list_console_settings()');
    assert.equal(settings.find(row=>row.setting_key==='console_private').value,'[geschützt]');
    assert.equal(settings.find(row=>row.setting_key==='console_nested').value,'[geschützt]');
    assert.equal(settings.find(row=>row.setting_key==='console_nested').is_sensitive,true);
    await assert.rejects(query("SELECT * FROM platform_system_settings"),/permission denied/);
    await assert.rejects(query("SELECT platform_update_system_setting('console_plain','1','Test record')"),/setting_type_mismatch/);
    await assert.rejects(query("SELECT platform_update_system_setting('console_nested','{}','Test record')"),/protected_setting/);
    const updated=await scalar("SELECT platform_update_system_setting('console_plain','true','Test record')");assert.equal(updated.value,true);
  });
  await t.test('feature scope and rollout validation applies to direct database calls',async()=>{
    await login(10);
    for(const [scope,tenant,rollout]of [['tenant',null,100],['global',id(1),100],['user',id(1),100],['global',null,101],['global',null,-1]])
      await assert.rejects(query('SELECT platform_set_feature_flag($1,true,$2,$3,$4,$5)',['console_feature','Test record',scope,tenant,rollout]),/invalid_flag_scope_or_rollout/);
    const a=await scalar("SELECT platform_set_feature_flag('console_feature',true,'Test record','tenant',$1,50)",[id(1)]);
    const b=await scalar("SELECT platform_set_feature_flag('console_feature',false,'Test record','tenant',$1,0)",[id(1)]);
    assert.equal(a.id,b.id);assert.equal(b.enabled,false);
  });
  let invoice;let payment;
  await t.test('invoice and payment retries create one record and audit entry',async()=>{
    await login(10);
    const payload={tenant_id:id(1),amount_cents:10000,tax_cents:1900,due_date:'2026-09-01'};
    invoice=await scalar('SELECT platform_record_console_finance($1,$2,$3,$4)',[id(100),'invoice',payload,'Test invoice']);
    const retry=await scalar('SELECT platform_record_console_finance($1,$2,$3,$4)',[id(100),'invoice',payload,'Test invoice']);assert.equal(invoice.id,retry.id);
    const pay={tenant_id:id(1),invoice_id:invoice.id,amount_cents:2500,payment_method:'bank_transfer'};
    payment=await scalar('SELECT platform_record_console_finance($1,$2,$3,$4)',[id(101),'payment',pay,'Test payment']);
    const duplicate=await scalar('SELECT platform_record_console_finance($1,$2,$3,$4)',[id(101),'payment',pay,'Test payment']);assert.equal(payment.id,duplicate.id);
    assert.equal(Number(await scalar("SELECT count(*) FROM platform_payments WHERE invoice_id=$1",[invoice.id])),1);
    assert.equal(await scalar('SELECT status FROM platform_invoices WHERE id=$1',[invoice.id]),'partially_paid');
    await assert.rejects(query('SELECT platform_record_console_finance($1,$2,$3,$4)',[id(101),'payment',{...pay,amount_cents:9999},'Test payment']),/request_payload_changed/);
  });
  await t.test('wrong-tenant payments and manual paid flags are rejected without changing the balance',async()=>{
    await login(10);await assert.rejects(query('SELECT platform_record_manual_payment($1,$2,1000,$3,$4,$5)',[id(2),invoice.id,'succeeded','Test payment','manual']),/invoice_tenant_mismatch/);
    await assert.rejects(query('SELECT platform_update_invoice_status($1,$2,$3)',[invoice.id,'paid','Test status']),/invoice_status_payment_managed/);
    await assert.rejects(query('SELECT platform_update_invoice_status($1,$2,$3)',[invoice.id,'cancelled','Test status']),/invoice_status_payment_managed/);
    assert.equal(Number(await scalar('SELECT count(*) FROM platform_payments WHERE invoice_id=$1',[invoice.id])),1);
  });
  await t.test('reversing or completing payments reconciles the invoice within the transaction',async()=>{
    await login(10);await query('SELECT platform_update_payment_status($1,$2,$3)',[payment.id,'failed','Test correction']);
    assert.equal(await scalar('SELECT status FROM platform_invoices WHERE id=$1',[invoice.id]),'past_due');
    await query('SELECT platform_update_payment_status($1,$2,$3)',[payment.id,'succeeded','Test correction']);
    await query('SELECT platform_record_manual_payment($1,$2,7500,$3,$4,$5)',[id(1),invoice.id,'succeeded','Test balance','bank_transfer']);
    assert.equal(await scalar('SELECT status FROM platform_invoices WHERE id=$1',[invoice.id]),'paid');
    assert.ok(await scalar('SELECT paid_at FROM platform_invoices WHERE id=$1',[invoice.id]));
  });
  await t.test('provider-managed invoices and payments cannot be overwritten by manual correction',async()=>{
    await db.exec('RESET ROLE');await query("UPDATE platform_invoices SET provider='stripe',status='open' WHERE id=$1",[invoice.id]);await query("UPDATE platform_payments SET provider='stripe' WHERE id=$1",[payment.id]);await login(10);
    await assert.rejects(query('SELECT platform_update_invoice_status($1,$2,$3)',[invoice.id,'cancelled','Test status']),/provider_invoice_readonly/);
    await assert.rejects(query('SELECT platform_update_payment_status($1,$2,$3)',[payment.id,'failed','Test status']),/provider_payment_readonly/);
  });
  await t.test('audit filters run before pagination and nested values are redacted',async()=>{
    await db.exec('RESET ROLE');await db.exec(`INSERT INTO platform_audit_log(actor_role,action,target_type,tenant_id,"before","after",reason,created_at)
      SELECT 'platform_owner','console_test','test','${id(1)}','{"password":"hidden"}','{"setting_key":"api_key","value":"hidden"}','Search needle', '2026-09-10T12:00:00Z'::timestamptz+make_interval(secs=>n) FROM generate_series(1,65) n;`);
    await login(10);const first=await scalar('SELECT platform_list_console_audit($1,$2,$3,$4,$5)',[id(1),'Search needle','2026-09-10','2026-09-10',0]);
    const second=await scalar('SELECT platform_list_console_audit($1,$2,$3,$4,$5)',[id(1),'Search needle','2026-09-10','2026-09-10',50]);
    assert.equal(first.items.length,51);assert.equal(second.items.length,15);assert.equal(first.items[0].before.password,'[geschützt]');assert.equal(first.items[0].after.value,'[geschützt]');
    assert.equal((await scalar('SELECT platform_list_console_audit($1,$2,$3,$4,$5)',[id(2),'Search needle',null,null,0])).items.length,0);
    await assert.rejects(query('SELECT platform_list_console_audit(null,null,$1,$2,0)',['2026-09-12','2026-09-01']),/invalid_date_range/);
  });
  await t.test('release history can find an older matching release outside the first page',async()=>{
    await db.exec('RESET ROLE');await db.exec("INSERT INTO platform_release_deployments(environment,version_label,status,deployed_at) SELECT 'preview','console-'||n,'ready','2026-09-01T12:00:00Z'::timestamptz+make_interval(secs=>n) FROM generate_series(1,230) n;");await login(10);
    const result=await scalar("SELECT platform_list_console_releases('console-1','ready','2026-09-01','2026-09-01',0)");assert.equal(result.items.length,51);
    const last=await scalar("SELECT platform_list_console_releases('console-230','ready',null,null,0)");assert.equal(last.items.length,1);
  });
  await t.test('last active owner is protected and only existing accounts can be granted a role',async()=>{
    await login(10);const owner=await scalar('SELECT id FROM platform_users WHERE user_id=$1',[id(10)]);
    await assert.rejects(query('SELECT platform_update_operator_user($1,$2,$3,$4)',[owner,'platform_readonly','active','Test change']),/last_platform_owner_protected/);
    await assert.rejects(query("SELECT platform_add_operator_user('missing@example.test','platform_readonly','Test addition')"),/existing_auth_user_required/);
    const added=await scalar("SELECT platform_add_operator_user('second@example.test','platform_owner','Test addition')");assert.ok(added.id);
    await query('SELECT platform_update_operator_user($1,$2,$3,$4)',[owner,'platform_readonly','active','Test change']);
    await login(12);await assert.rejects(query('SELECT platform_update_operator_user($1,$2,$3,$4)',[added.id,'platform_readonly','active','Test change']),/last_platform_owner_protected/);
  });
});
await db.close();
