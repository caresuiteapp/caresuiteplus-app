import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const db = new PGlite();
await db.exec(`
 CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
 CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
 CREATE TABLE public.tenants(id uuid PRIMARY KEY);
 CREATE TABLE employee_portal_accounts(id uuid,tenant_id uuid,auth_user_id uuid,employee_id uuid,status text);
 CREATE TABLE client_portal_access(id uuid,tenant_id uuid,auth_user_id uuid,client_id uuid,portal_enabled boolean,status text);
 CREATE TABLE client_portal_codes(id uuid,tenant_id uuid,auth_user_id uuid,client_id uuid,status text,expires_at timestamptz);
 CREATE TABLE portal_push_devices(id uuid PRIMARY KEY,tenant_id uuid,auth_user_id uuid,portal_account_id uuid,portal_type text,employee_id uuid,client_id uuid,expo_push_token text,platform text,enabled boolean DEFAULT true,permission_status text DEFAULT 'granted',invalidated_at timestamptz,last_error text);
 CREATE TABLE assist_visits(id uuid PRIMARY KEY,tenant_id uuid,client_id uuid,employee_id uuid,title text,planned_start_at timestamptz,planned_end_at timestamptz,address_snapshot text,planning_status text DEFAULT 'scheduled',employee_portal_visible boolean DEFAULT true,portal_release_enabled boolean DEFAULT true);
 CREATE TABLE messages(id uuid PRIMARY KEY,tenant_id uuid,thread_id uuid,is_internal_note boolean DEFAULT false,is_system_message boolean DEFAULT false,status text DEFAULT 'sent',read_at timestamptz,sender_profile_id uuid,sender_employee_id uuid,sender_client_id uuid);
 CREATE TABLE message_threads(id uuid PRIMARY KEY,tenant_id uuid,thread_type text,status text DEFAULT 'open',client_id uuid,employee_id uuid);
 CREATE TABLE message_thread_employee_participants(thread_id uuid,tenant_id uuid,employee_id uuid,is_active boolean DEFAULT true,left_at timestamptz);
 CREATE TABLE assist_visit_proofs(id uuid PRIMARY KEY,tenant_id uuid,visit_id uuid,portal_visible boolean DEFAULT false,portal_release_status text DEFAULT 'none');
 CREATE TABLE cs_document_requests(id uuid PRIMARY KEY,owner_tenant_id uuid,portal_visible boolean DEFAULT true,status text DEFAULT 'draft',client_id uuid,employee_id uuid,recipient_scope text);
 CREATE TABLE office_notifications(id uuid PRIMARY KEY,tenant_id uuid,recipient_user_id uuid,recipient_employee_id uuid,is_read boolean DEFAULT false,notification_type text,related_broadcast_id uuid);
 CREATE TABLE notification_broadcasts(id uuid PRIMARY KEY,tenant_id uuid,status text);
`);
await db.exec(readFileSync(new URL('../migrations/20260906160000_portal_automatic_push.sql', import.meta.url), 'utf8'));
const query = async (sql, params=[]) => (await db.query(sql, params)).rows;
await db.exec(`INSERT INTO tenants VALUES('${id(1)}'),('${id(2)}'); INSERT INTO auth.users VALUES('${id(10)}'),('${id(11)}'),('${id(12)}');
INSERT INTO employee_portal_accounts VALUES('${id(20)}','${id(1)}','${id(10)}','${id(30)}','active');
INSERT INTO client_portal_access VALUES('${id(21)}','${id(1)}','${id(11)}','${id(31)}',true,'aktiv'),('${id(22)}','${id(2)}','${id(12)}','${id(32)}',true,'aktiv');
INSERT INTO portal_push_devices(id,tenant_id,auth_user_id,portal_account_id,portal_type,employee_id,client_id,expo_push_token,platform,app_build_version) VALUES
('${id(40)}','${id(1)}','${id(10)}','${id(20)}','employee','${id(30)}',null,'ExpoPushToken[employee]','android',34),
('${id(41)}','${id(1)}','${id(11)}','${id(21)}','client',null,'${id(31)}','ExpoPushToken[client]','android',34),
('${id(42)}','${id(2)}','${id(12)}','${id(22)}','client',null,'${id(32)}','ExpoPushToken[foreign]','android',34);`);
const visit = async (n=50, extras='') => db.exec(`INSERT INTO assist_visits(id,tenant_id,employee_id,client_id,title ${extras ? ',planning_status':''}) VALUES('${id(n)}','${id(1)}','${id(30)}','${id(31)}','Example' ${extras ? `,'${extras}'`:''})`);
const count = async () => Number((await query('SELECT count(*) AS n FROM portal_push_outbox'))[0].n);
await test('PostgreSQL delivery isolation, lifecycle and source triggers', async t => {
 await t.test('source events enqueue only linked accounts and draft changes stay silent', async () => {
  await visit(); assert.equal(await count(),2);
  await visit(51,'draft'); assert.equal(await count(),2);
  await db.exec(`UPDATE assist_visits SET title=title WHERE id='${id(50)}'`); assert.equal(await count(),2);
  await db.exec(`UPDATE assist_visits SET title='Changed' WHERE id='${id(50)}'`); assert.equal(await count(),4);
  assert.equal((await query(`SELECT * FROM portal_push_outbox WHERE tenant_id='${id(2)}'`)).length,0);
 });
 await t.test('dispatcher is disabled until explicitly configured', async () => { assert.equal((await query('SELECT * FROM portal_push_claim()')).length,0); await db.exec('UPDATE portal_push_runtime SET enabled=true'); });
 await t.test('leases prevent parallel double claims and stale acknowledgements', async () => {
  const [first] = await query('SELECT * FROM portal_push_claim(1)'); const [second] = await query('SELECT * FROM portal_push_claim(1)'); assert.notEqual(first.id, second.id);
  assert.equal((await query('SELECT portal_push_finish($1,$2,$3,$4) AS ok',[first.id,id(999),'accepted','ticket']))[0].ok,false);
  assert.equal((await query('SELECT portal_push_finish($1,$2,$3,$4) AS ok',[first.id,first.lease_token,'accepted','ticket-a']))[0].ok,true);
  await query('SELECT portal_push_receipt($1,$2,$3)',[first.id,'ticket-a','ok']); assert.equal((await query('SELECT state FROM portal_push_outbox WHERE id=$1',[first.id]))[0].state,'delivered');
 });
 await t.test('revoked accounts and reassigned devices fail readback even after claiming', async () => {
  await db.exec('TRUNCATE portal_push_outbox'); await visit(52);
  const rows = await query('SELECT * FROM portal_push_claim()'); const client = rows.find(r=>r.device_id===id(41));
  await db.exec(`UPDATE client_portal_access SET portal_enabled=false WHERE id='${id(21)}'`);
  assert.equal((await query('SELECT * FROM portal_push_delivery_target($1,$2)',[client.id,client.lease_token])).length,0);
  await db.exec(`UPDATE client_portal_access SET portal_enabled=true WHERE id='${id(21)}'; UPDATE portal_push_devices SET portal_account_id='${id(22)}' WHERE id='${id(41)}'`);
  assert.equal((await query('SELECT * FROM portal_push_delivery_target($1,$2)',[client.id,client.lease_token])).length,0);
  await db.exec(`UPDATE portal_push_devices SET portal_account_id='${id(21)}' WHERE id='${id(41)}'`);
 });
 await t.test('messages exclude drafts, internal notes, sender and foreign participants', async () => {
  await db.exec('TRUNCATE portal_push_outbox');
  await db.exec(`INSERT INTO message_threads(id,tenant_id,thread_type,client_id) VALUES('${id(60)}','${id(1)}','client','${id(31)}');
  INSERT INTO messages(id,tenant_id,thread_id,sender_profile_id) VALUES('${id(61)}','${id(1)}','${id(60)}','${id(90)}');`);
  assert.equal(await count(),1);
  await db.exec(`INSERT INTO messages(id,tenant_id,thread_id,is_internal_note,sender_profile_id) VALUES('${id(62)}','${id(1)}','${id(60)}',true,'${id(90)}');
  INSERT INTO messages(id,tenant_id,thread_id,sender_client_id) VALUES('${id(63)}','${id(1)}','${id(60)}','${id(31)}');`); assert.equal(await count(),1);
  await db.exec(`INSERT INTO messages(id,tenant_id,thread_id,status,sender_profile_id) VALUES('${id(64)}','${id(1)}','${id(60)}','draft','${id(90)}');`); assert.equal(await count(),1);
  await db.exec(`UPDATE messages SET status='sent' WHERE id='${id(64)}'`); assert.equal(await count(),2);
  const [row] = await query('SELECT * FROM portal_push_claim(1)'); await db.exec(`UPDATE messages SET read_at=now() WHERE id='${row.source_id}'`);
  assert.equal((await query('SELECT * FROM portal_push_delivery_target($1,$2)',[row.id,row.lease_token])).length,0);
 });
 await t.test('proof release and document release work; opening a document does not notify again', async () => {
  await db.exec('TRUNCATE portal_push_outbox');
  await db.exec(`INSERT INTO assist_visit_proofs(id,tenant_id,visit_id) VALUES('${id(70)}','${id(1)}','${id(50)}')`); assert.equal(await count(),0);
  await db.exec(`UPDATE assist_visit_proofs SET portal_visible=true,portal_release_status='pending_client_signature' WHERE id='${id(70)}'`); assert.equal(await count(),1);
  await db.exec(`INSERT INTO cs_document_requests(id,owner_tenant_id,client_id,recipient_scope) VALUES('${id(71)}','${id(1)}','${id(31)}','client'); UPDATE cs_document_requests SET status='sent' WHERE id='${id(71)}'`); assert.equal(await count(),2);
  await db.exec(`UPDATE cs_document_requests SET status='opened' WHERE id='${id(71)}'`); assert.equal(await count(),2);
 });
 await t.test('available app updates target only older Android installations', async () => {
  await db.exec('TRUNCATE portal_push_outbox'); await db.exec(`INSERT INTO portal_app_releases(id,platform,version_code,version_name) VALUES('${id(80)}','android',35,'0.3.6')`); assert.equal(await count(),0);
  await db.exec(`UPDATE portal_push_devices SET app_build_version=35 WHERE id='${id(41)}'; UPDATE portal_app_releases SET available_on_play=true WHERE id='${id(80)}'`); assert.equal(await count(),2);
  assert.equal((await query(`SELECT * FROM portal_push_outbox WHERE device_id='${id(41)}'`)).length,0);
 });
 await t.test('Expo rejection invalidates only the same account and repeated source keys do not resend', async () => {
  await db.exec('TRUNCATE portal_push_outbox'); await visit(53);
  const [row] = await query('SELECT * FROM portal_push_claim(1)');
  await query('SELECT portal_push_finish($1,$2,$3,$4,$5)',[row.id,row.lease_token,'failed',null,'DeviceNotRegistered']);
  assert.equal((await query('SELECT enabled FROM portal_push_devices WHERE id=$1',[row.device_id]))[0].enabled,false);
 });
 await t.test('portal and anonymous roles cannot read queue secrets or call dispatcher RPCs', async () => {
  await db.exec('SET ROLE authenticated');
  await assert.rejects(()=>db.query('SELECT * FROM portal_push_outbox'),/permission denied/);
  await assert.rejects(()=>db.query('SELECT * FROM portal_push_claim()'),/permission denied/);
  await db.exec('RESET ROLE; SET ROLE anon');
  await assert.rejects(()=>db.query("SELECT portal_push_worker_authorized('secret')"),/permission denied/);
  await db.exec('RESET ROLE');
 });
});
await db.close();
