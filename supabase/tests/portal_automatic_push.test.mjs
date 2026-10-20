import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
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
await db.exec(
  readFileSync(
    new URL('../migrations/20260906160000_portal_automatic_push.sql', import.meta.url),
    'utf8',
  ),
);
const query = async (sql, params = []) => (await db.query(sql, params)).rows;
await db.exec(`INSERT INTO tenants VALUES('${id(1)}'),('${id(2)}'); INSERT INTO auth.users VALUES('${id(10)}'),('${id(11)}'),('${id(12)}');
INSERT INTO employee_portal_accounts VALUES('${id(20)}','${id(1)}','${id(10)}','${id(30)}','active');
INSERT INTO client_portal_access VALUES('${id(21)}','${id(1)}','${id(11)}','${id(31)}',true,'aktiv'),('${id(22)}','${id(2)}','${id(12)}','${id(32)}',true,'aktiv');
INSERT INTO portal_push_devices(id,tenant_id,auth_user_id,portal_account_id,portal_type,employee_id,client_id,expo_push_token,platform,app_build_version) VALUES
('${id(40)}','${id(1)}','${id(10)}','${id(20)}','employee','${id(30)}',null,'ExpoPushToken[employee]','android',34),
('${id(41)}','${id(1)}','${id(11)}','${id(21)}','client',null,'${id(31)}','ExpoPushToken[client]','android',34),
('${id(42)}','${id(2)}','${id(12)}','${id(22)}','client',null,'${id(32)}','ExpoPushToken[foreign]','android',34);`);
const visit = async (n = 50, extras = '') =>
  db.exec(
    `INSERT INTO assist_visits(id,tenant_id,employee_id,client_id,title ${extras ? ',planning_status' : ''}) VALUES('${id(n)}','${id(1)}','${id(30)}','${id(31)}','Example' ${extras ? `,'${extras}'` : ''})`,
  );
const count = async () =>
  Number((await query('SELECT count(*) AS n FROM portal_push_outbox'))[0].n);
await test('PostgreSQL delivery isolation, lifecycle and source triggers', async (t) => {
  await t.test(
    'source events enqueue only linked accounts and draft changes stay silent',
    async () => {
      await visit();
      assert.equal(await count(), 2);
      await visit(51, 'draft');
      assert.equal(await count(), 2);
      await db.exec(`UPDATE assist_visits SET title=title WHERE id='${id(50)}'`);
      assert.equal(await count(), 2);
      await db.exec(`UPDATE assist_visits SET title='Changed' WHERE id='${id(50)}'`);
      assert.equal(await count(), 4);
      assert.equal(
        (await query(`SELECT * FROM portal_push_outbox WHERE tenant_id='${id(2)}'`)).length,
        0,
      );
    },
  );
  await t.test('dispatcher is disabled until explicitly configured', async () => {
    assert.equal((await query('SELECT * FROM portal_push_claim()')).length, 0);
    await db.exec('UPDATE portal_push_runtime SET enabled=true');
  });
  await t.test('leases prevent parallel double claims and stale acknowledgements', async () => {
    const [first] = await query('SELECT * FROM portal_push_claim(1)');
    const [second] = await query('SELECT * FROM portal_push_claim(1)');
    assert.notEqual(first.id, second.id);
    assert.equal(
      (
        await query('SELECT portal_push_finish($1,$2,$3,$4) AS ok', [
          first.id,
          id(999),
          'accepted',
          'ticket',
        ])
      )[0].ok,
      false,
    );
    assert.equal(
      (
        await query('SELECT portal_push_finish($1,$2,$3,$4) AS ok', [
          first.id,
          first.lease_token,
          'accepted',
          'ticket-a',
        ])
      )[0].ok,
      true,
    );
    await query('SELECT portal_push_receipt($1,$2,$3)', [first.id, 'ticket-a', 'ok']);
    assert.equal(
      (await query('SELECT state FROM portal_push_outbox WHERE id=$1', [first.id]))[0].state,
      'delivered',
    );
  });
  await t.test(
    'revoked accounts and reassigned devices fail readback even after claiming',
    async () => {
      await db.exec('TRUNCATE portal_push_outbox');
      await visit(52);
      const rows = await query('SELECT * FROM portal_push_claim()');
      const client = rows.find((r) => r.device_id === id(41));
      await db.exec(`UPDATE client_portal_access SET portal_enabled=false WHERE id='${id(21)}'`);
      assert.equal(
        (
          await query('SELECT * FROM portal_push_delivery_target($1,$2)', [
            client.id,
            client.lease_token,
          ])
        ).length,
        0,
      );
      await db.exec(
        `UPDATE client_portal_access SET portal_enabled=true WHERE id='${id(21)}'; UPDATE portal_push_devices SET portal_account_id='${id(22)}' WHERE id='${id(41)}'`,
      );
      assert.equal(
        (
          await query('SELECT * FROM portal_push_delivery_target($1,$2)', [
            client.id,
            client.lease_token,
          ])
        ).length,
        0,
      );
      await db.exec(
        `UPDATE portal_push_devices SET portal_account_id='${id(21)}' WHERE id='${id(41)}'`,
      );
    },
  );
  await t.test(
    'messages exclude drafts, internal notes, sender and foreign participants',
    async () => {
      await db.exec('TRUNCATE portal_push_outbox');
      await db.exec(`INSERT INTO message_threads(id,tenant_id,thread_type,client_id) VALUES('${id(60)}','${id(1)}','client','${id(31)}');
  INSERT INTO messages(id,tenant_id,thread_id,sender_profile_id) VALUES('${id(61)}','${id(1)}','${id(60)}','${id(90)}');`);
      assert.equal(await count(), 1);
      await db.exec(`INSERT INTO messages(id,tenant_id,thread_id,is_internal_note,sender_profile_id) VALUES('${id(62)}','${id(1)}','${id(60)}',true,'${id(90)}');
  INSERT INTO messages(id,tenant_id,thread_id,sender_client_id) VALUES('${id(63)}','${id(1)}','${id(60)}','${id(31)}');`);
      assert.equal(await count(), 1);
      await db.exec(
        `INSERT INTO messages(id,tenant_id,thread_id,status,sender_profile_id) VALUES('${id(64)}','${id(1)}','${id(60)}','draft','${id(90)}');`,
      );
      assert.equal(await count(), 1);
      await db.exec(`UPDATE messages SET status='sent' WHERE id='${id(64)}'`);
      assert.equal(await count(), 2);
      const [row] = await query('SELECT * FROM portal_push_claim(1)');
      await db.exec(`UPDATE messages SET read_at=now() WHERE id='${row.source_id}'`);
      assert.equal(
        (await query('SELECT * FROM portal_push_delivery_target($1,$2)', [row.id, row.lease_token]))
          .length,
        0,
      );
    },
  );
  await t.test(
    'proof release and document release work; opening a document does not notify again',
    async () => {
      await db.exec('TRUNCATE portal_push_outbox');
      await db.exec(
        `INSERT INTO assist_visit_proofs(id,tenant_id,visit_id) VALUES('${id(70)}','${id(1)}','${id(50)}')`,
      );
      assert.equal(await count(), 0);
      await db.exec(
        `UPDATE assist_visit_proofs SET portal_visible=true,portal_release_status='pending_client_signature' WHERE id='${id(70)}'`,
      );
      assert.equal(await count(), 1);
      await db.exec(
        `INSERT INTO cs_document_requests(id,owner_tenant_id,client_id,recipient_scope) VALUES('${id(71)}','${id(1)}','${id(31)}','client'); UPDATE cs_document_requests SET status='sent' WHERE id='${id(71)}'`,
      );
      assert.equal(await count(), 2);
      await db.exec(`UPDATE cs_document_requests SET status='opened' WHERE id='${id(71)}'`);
      assert.equal(await count(), 2);
    },
  );
  await t.test('available app updates target only older Android installations', async () => {
    await db.exec('TRUNCATE portal_push_outbox');
    await db.exec(
      `INSERT INTO portal_app_releases(id,platform,version_code,version_name) VALUES('${id(80)}','android',35,'0.3.6')`,
    );
    assert.equal(await count(), 0);
    await db.exec(
      `UPDATE portal_push_devices SET app_build_version=35 WHERE id='${id(41)}'; UPDATE portal_app_releases SET available_on_play=true WHERE id='${id(80)}'`,
    );
    assert.equal(await count(), 2);
    assert.equal(
      (await query(`SELECT * FROM portal_push_outbox WHERE device_id='${id(41)}'`)).length,
      0,
    );
  });
  await t.test(
    'Expo rejection invalidates only the same account and repeated source keys do not resend',
    async () => {
      await db.exec('TRUNCATE portal_push_outbox');
      await visit(53);
      const [row] = await query('SELECT * FROM portal_push_claim(1)');
      await query('SELECT portal_push_finish($1,$2,$3,$4,$5)', [
        row.id,
        row.lease_token,
        'failed',
        null,
        'DeviceNotRegistered',
      ]);
      assert.equal(
        (await query('SELECT enabled FROM portal_push_devices WHERE id=$1', [row.device_id]))[0]
          .enabled,
        false,
      );
    },
  );
  await t.test(
    'portal and anonymous roles cannot read queue secrets or call dispatcher RPCs',
    async () => {
      await db.exec('SET ROLE authenticated');
      await assert.rejects(() => db.query('SELECT * FROM portal_push_outbox'), /permission denied/);
      await assert.rejects(
        () => db.query('SELECT * FROM portal_push_claim()'),
        /permission denied/,
      );
      await db.exec('RESET ROLE; SET ROLE anon');
      await assert.rejects(
        () => db.query("SELECT portal_push_worker_authorized('secret')"),
        /permission denied/,
      );
      await db.exec('RESET ROLE');
    },
  );
});
// Use the same isolated PostgreSQL engine for the additive production migration.
await db.exec(`
 ALTER TABLE assist_visits ADD COLUMN actual_start_at timestamptz, ADD COLUMN actual_end_at timestamptz,
   ADD COLUMN finished_at timestamptz, ADD COLUMN legacy_assignment_id uuid,
   ADD COLUMN canonical_status text DEFAULT 'planned', ADD COLUMN execution_status text DEFAULT 'pending';
 ALTER TABLE assist_visit_proofs ADD COLUMN signature_id uuid;
 CREATE TABLE assist_visit_signatures(id uuid PRIMARY KEY,tenant_id uuid,visit_id uuid,is_valid boolean,signer_role text);
 CREATE TABLE assist_time_events(tenant_id uuid,visit_id uuid,event_type text);
 CREATE TABLE assist_visit_execution_state(tenant_id uuid,visit_id uuid,service_started_at timestamptz,service_ended_at timestamptz,
   finalized_at timestamptz,assignment_status text,current_step text);
 CREATE TABLE assignments(id uuid,tenant_id uuid,status text);
 CREATE TABLE tenant_notification_settings(tenant_id uuid PRIMARY KEY,push_notifications_enabled boolean,
   notify_assignment_changes boolean DEFAULT true,notify_new_message boolean DEFAULT true,
   notify_signature_required boolean DEFAULT true,notify_service_record_ready boolean DEFAULT true);
 INSERT INTO tenant_notification_settings(tenant_id,push_notifications_enabled) VALUES('${id(1)}',false),('${id(2)}',true);
`);
await db.exec(readFileSync(new URL('../migrations/20261002132149_portal_assignment_push_reminders.sql', import.meta.url), 'utf8'));
const clearQueue = () => db.exec('TRUNCATE portal_push_outbox');
const reminders = async () => Number((await query('SELECT portal_push_queue_assignment_reminders() AS n'))[0].n);
const futureVisit = async (n, offset = 10, extra = {}) => {
  await db.query(`INSERT INTO assist_visits(id,tenant_id,employee_id,client_id,title,planned_start_at,planned_end_at,planning_status,canonical_status,execution_status,actual_start_at)
    VALUES($1,$2,$3,$4,'Example',now()+make_interval(mins=>$5),now()+make_interval(mins=>$5+60),$6,$7,$8,$9)`,
    [id(n),id(1),id(30),id(31),offset,extra.planning ?? 'scheduled',extra.canonical ?? 'planned',extra.execution ?? 'pending',extra.started ?? null]);
};
await test('Future assignment and signature push safety', async (t) => {
  await t.test('migration preserves opt-outs and keeps reminders disabled until activation', async () => {
    assert.equal((await query('SELECT push_notifications_enabled FROM tenant_notification_settings WHERE tenant_id=$1',[id(1)]))[0].push_notifications_enabled,false);
    assert.equal((await query('SELECT reminders_enabled FROM portal_push_runtime'))[0].reminders_enabled,false);
    await db.exec('UPDATE portal_push_devices SET enabled=true; UPDATE portal_push_runtime SET enabled=true,reminders_enabled=true,reminders_started_at=now()-interval \'10 minutes\'');
    await clearQueue();
    await futureVisit(100);
    assert.equal(await count(),0);
    assert.equal(await reminders(),0);
    await db.exec(`UPDATE tenant_notification_settings SET push_notifications_enabled=true WHERE tenant_id='${id(1)}'`);
  });
  await t.test('upcoming reminder is employee-only, scoped and idempotent per planned start', async () => {
    await clearQueue();
    assert.equal(await reminders(),1);
    const [row] = await query('SELECT * FROM portal_push_outbox');
    assert.equal(row.device_id,id(40));
    assert.equal(row.event_kind,'visit_reminder');
    assert.equal(row.tenant_id,id(1));
    assert.equal(row.route,`/portal/employee/assignments/${id(100)}/execute`);
    assert.equal(await reminders(),0);
    const [claimed] = await query('SELECT * FROM portal_push_claim()');
    assert.equal((await query('SELECT * FROM portal_push_delivery_target($1,$2)',[claimed.id,claimed.lease_token])).length,1);
  });
  await t.test('rescheduling invalidates a queued reminder and permits one new planned-start reminder', async () => {
    const [old] = await query("SELECT * FROM portal_push_outbox WHERE event_kind='visit_reminder'");
    await db.exec(`UPDATE assist_visits SET planned_start_at=now()+interval '12 minutes' WHERE id='${id(100)}'`);
    assert.equal((await query('SELECT * FROM portal_push_delivery_target($1,$2)',[old.id,old.lease_token])).length,0);
    assert.equal(await reminders(),1);
    assert.equal(await reminders(),0);
  });
  await t.test('overdue reminder starts after five minutes, excludes old backlog and expires with the assignment', async () => {
    await futureVisit(101,-6);
    await futureVisit(102,-3);
    await futureVisit(103,-20);
    await futureVisit(104,50);
    await clearQueue();
    assert.equal(await reminders(),2); // one upcoming assignment and one overdue assignment
    const rows = await query("SELECT * FROM portal_push_outbox WHERE event_kind='visit_overdue'");
    assert.equal(rows.length,1);
    assert.equal(rows[0].source_id,id(101));
    assert.equal(rows[0].device_id,id(40));
    assert.equal(await reminders(),0);
  });
  await t.test('draft, cancelled, started, completed and paused assignments never get start reminders', async () => {
    const cases=[{planning:'draft'},{planning:'cancelled'},{canonical:'completed'},{canonical:'cancelled'},{canonical:'paused'},{canonical:'started'},
      {execution:'in_progress'},{execution:'completed'},{started:new Date().toISOString()}];
    for(let i=0;i<cases.length;i++) await futureVisit(110+i,10,cases[i]);
    await clearQueue();
    await reminders();
    assert.equal((await query('SELECT * FROM portal_push_outbox WHERE source_id=ANY($1::uuid[])',[cases.map((_,i)=>id(110+i))])).length,0);
  });
  await t.test('persisted start/end events and workflow mirrors suppress stale planning reminders', async () => {
    for(const n of [120,121,122,123]) await futureVisit(n,10);
    await db.exec(`INSERT INTO assist_time_events VALUES('${id(1)}','${id(120)}','service_start'),('${id(1)}','${id(121)}','service_end');
      INSERT INTO assist_visit_execution_state(tenant_id,visit_id,current_step,service_started_at) VALUES('${id(1)}','${id(122)}','in_service',now());
      INSERT INTO assignments VALUES('${id(123)}','${id(1)}','completed');`);
    await clearQueue();
    await reminders();
    assert.equal((await query('SELECT * FROM portal_push_outbox WHERE source_id=ANY($1::uuid[])',[[120,121,122,123].map(id)])).length,0);
  });
  await t.test('start completion after claim suppresses an overdue reminder before provider send', async () => {
    await clearQueue();
    await reminders();
    const [row]=await query("SELECT * FROM portal_push_claim() WHERE event_kind='visit_overdue'");
    await db.exec(`UPDATE assist_visits SET actual_start_at=now() WHERE id='${id(101)}'`);
    assert.equal((await query('SELECT * FROM portal_push_delivery_target($1,$2)',[row.id,row.lease_token])).length,0);
  });
  await t.test('tenant event opt-out and device logout are respected after enqueue', async () => {
    await clearQueue(); await reminders();
    const [row]=await query('SELECT * FROM portal_push_claim()');
    await db.exec(`UPDATE tenant_notification_settings SET notify_assignment_changes=false WHERE tenant_id='${id(1)}'`);
    assert.equal((await query('SELECT * FROM portal_push_delivery_target($1,$2)',[row.id,row.lease_token])).length,0);
    await clearQueue(); assert.equal(await reminders(),0);
    await db.exec(`UPDATE tenant_notification_settings SET notify_assignment_changes=true WHERE tenant_id='${id(1)}'`);
    await reminders(); const [next]=await query('SELECT * FROM portal_push_claim()');
    await db.exec(`UPDATE portal_push_devices SET enabled=false WHERE id='${id(40)}'`);
    assert.equal((await query('SELECT * FROM portal_push_delivery_target($1,$2)',[next.id,next.lease_token])).length,0);
    await db.exec(`UPDATE portal_push_devices SET enabled=true WHERE id='${id(40)}'`);
  });
  await t.test('pending signature is explicit and completion cancels its outstanding request', async () => {
    await clearQueue();
    await db.exec(`INSERT INTO assist_visit_proofs(id,tenant_id,visit_id,portal_visible,portal_release_status)
      VALUES('${id(130)}','${id(1)}','${id(100)}',true,'pending_client_signature')`);
    const [request]=await query('SELECT * FROM portal_push_claim()');
    assert.equal(request.event_kind,'proof_signature'); assert.equal(request.device_id,id(41));
    await db.exec(`UPDATE assist_visit_proofs SET portal_release_status='released' WHERE id='${id(130)}'`);
    assert.equal((await query("SELECT * FROM portal_push_outbox WHERE event_kind='proof_signed'")).length,0);
    assert.equal((await query('SELECT * FROM portal_push_delivery_target($1,$2)',[request.id,request.lease_token])).length,0);
    assert.equal((await query("SELECT * FROM portal_push_outbox WHERE event_kind='proof'")).length,1); // administrative release announces availability, never a false signature
  });
  await t.test('employee signature receipt requires a valid client signature for the same tenant and visit', async () => {
    await clearQueue();
    await db.exec(`UPDATE assist_visit_proofs SET portal_release_status='pending_client_signature' WHERE id='${id(130)}';
      INSERT INTO assist_visit_signatures VALUES('${id(131)}','${id(1)}','${id(100)}',true,'client');
      UPDATE assist_visit_proofs SET signature_id='${id(131)}',portal_release_status='released' WHERE id='${id(130)}'`);
    const [receipt]=await query("SELECT * FROM portal_push_claim() WHERE event_kind='proof_signed'");
    assert.equal((await query("SELECT * FROM portal_push_outbox WHERE event_kind='proof'")).length,0); // genuine signing does not create another client request
    assert.equal(receipt.device_id,id(40));
    assert.equal((await query('SELECT * FROM portal_push_delivery_target($1,$2)',[receipt.id,receipt.lease_token])).length,1);
    await db.exec(`UPDATE assist_visit_signatures SET is_valid=false WHERE id='${id(131)}'`);
    assert.equal((await query('SELECT * FROM portal_push_delivery_target($1,$2)',[receipt.id,receipt.lease_token])).length,0);
  });
  await t.test('old past-assignment edits stay silent for employee and client', async () => {
    await clearQueue();
    await futureVisit(140,-180);
    assert.equal(await count(),0);
    await db.exec(`UPDATE assist_visits SET title='Changed old assignment' WHERE id='${id(140)}'`);
    assert.equal(await count(),0);
  });
  await t.test('cancelling a future visible visit announces the plan change without a start reminder', async () => {
    await futureVisit(141,10);
    await clearQueue();
    await db.exec(`UPDATE assist_visits SET planning_status='cancelled',canonical_status='cancelled' WHERE id='${id(141)}'`);
    const rows=await query('SELECT * FROM portal_push_outbox WHERE source_id=$1',[id(141)]);
    assert.equal(rows.length,2);
    assert.deepEqual(new Set(rows.map(row=>row.event_kind)),new Set(['visit']));
    await reminders();
    assert.equal((await query("SELECT * FROM portal_push_outbox WHERE source_id=$1 AND event_kind IN ('visit_reminder','visit_overdue')",[id(141)])).length,0);
  });
  await t.test('exact start, planned end and two-hour cutoff never emit stale reminders', async () => {
    await db.exec('BEGIN');
    try {
      await futureVisit(142,0);
      await futureVisit(143,-6);
      await db.exec(`UPDATE assist_visits SET planned_end_at=now() WHERE id='${id(143)}';
        UPDATE portal_push_runtime SET reminders_started_at=now()-interval '5 hours'`);
      await futureVisit(144,-121);
      await db.exec(`UPDATE assist_visits SET planned_end_at=now()+interval '1 hour' WHERE id='${id(144)}'`);
      await clearQueue(); await reminders();
      assert.equal((await query('SELECT * FROM portal_push_outbox WHERE source_id=ANY($1::uuid[])',[[142,143,144].map(id)])).length,0);
    } finally { await db.exec('ROLLBACK'); }
  });
  await t.test('message, signature and service-record preferences each suppress only their channel', async () => {
    await clearQueue();
    await db.exec(`UPDATE tenant_notification_settings SET notify_new_message=false,notify_signature_required=false,notify_service_record_ready=false WHERE tenant_id='${id(1)}';
      INSERT INTO messages(id,tenant_id,thread_id,sender_profile_id) VALUES('${id(150)}','${id(1)}','${id(60)}','${id(90)}');
      INSERT INTO assist_visit_proofs(id,tenant_id,visit_id,portal_visible,portal_release_status) VALUES
        ('${id(151)}','${id(1)}','${id(100)}',true,'pending_client_signature'),
        ('${id(152)}','${id(1)}','${id(100)}',true,'released');
      INSERT INTO cs_document_requests(id,owner_tenant_id,client_id,recipient_scope,status) VALUES('${id(153)}','${id(1)}','${id(31)}','client','sent');`);
    assert.equal(await count(),0);
    await db.exec(`UPDATE tenant_notification_settings SET notify_new_message=true,notify_signature_required=true,notify_service_record_ready=true WHERE tenant_id='${id(1)}';
      INSERT INTO messages(id,tenant_id,thread_id,sender_profile_id) VALUES('${id(154)}','${id(1)}','${id(60)}','${id(90)}');
      INSERT INTO assist_visit_proofs(id,tenant_id,visit_id,portal_visible,portal_release_status) VALUES
        ('${id(155)}','${id(1)}','${id(100)}',true,'pending_client_signature'),
        ('${id(156)}','${id(1)}','${id(100)}',true,'released');
      INSERT INTO cs_document_requests(id,owner_tenant_id,client_id,recipient_scope,status) VALUES('${id(157)}','${id(1)}','${id(31)}','client','sent');`);
    assert.deepEqual(new Set((await query('SELECT event_kind FROM portal_push_outbox')).map(row=>row.event_kind)),new Set(['message','proof_signature','proof','document']));
  });
  await t.test('portal and anonymous roles cannot schedule reminders or inspect internal status predicates', async () => {
    for(const role of ['authenticated','anon']) {
      await db.exec(`SET ROLE ${role}`);
      await assert.rejects(()=>db.query('SELECT portal_push_queue_assignment_reminders()'),/permission denied/);
      await assert.rejects(()=>db.query('SELECT portal_push_kind_enabled($1,$2)',[id(1),'visit']),/permission denied/);
      await db.exec('RESET ROLE');
    }
  });
});
// Opaque push identifiers resolve only inside the authenticated Supabase API.
await db.exec(`
 CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT (auth.jwt()->>'sub')::uuid $$;
 GRANT USAGE ON SCHEMA auth TO authenticated;
`);
await db.exec(readFileSync(new URL('../migrations/20261002134559_portal_push_opaque_navigation.sql',import.meta.url),'utf8'));
const claimsFor = (user=11,account=21,tenant=1,type='client') => ({sub:id(user),app_metadata:{portal_account_id:id(account),tenant_id:id(tenant),portal_type:type}});
const resolveAs = async (claims,notification,account) => {
  await db.query("SELECT set_config('request.jwt.claims',$1,false)",[JSON.stringify(claims)]);
  await db.exec('SET ROLE authenticated');
  try { return await query('SELECT * FROM portal_push_resolve_destination($1,$2)',[notification,account]); }
  finally { await db.exec('RESET ROLE'); }
};
let clientNotice,employeeNotice,foreignNotice,otherAccountNotice;
await test('Opaque notification destinations stay within the authenticated account', async(t)=>{
  await t.test('accepted own notifications resolve for client and employee inside Supabase',async()=>{
    await clearQueue(); await futureVisit(160,30);
    await db.exec(`INSERT INTO assist_visits(id,tenant_id,employee_id,client_id,title,planned_start_at,planned_end_at)
      VALUES('${id(161)}','${id(2)}',null,'${id(32)}','Example',now()+interval '30 minutes',now()+interval '90 minutes')`);
    const rows=await query('SELECT * FROM portal_push_claim()');
    clientNotice=rows.find(row=>row.account_id===id(21));
    employeeNotice=rows.find(row=>row.account_id===id(20));
    foreignNotice=rows.find(row=>row.account_id===id(22));
    await db.exec("UPDATE portal_push_outbox SET state='accepted',expo_ticket_id='local-fixture-ticket'");
    assert.deepEqual(await resolveAs(claimsFor(),clientNotice.id,id(21)),[{route:`/portal/client/appointments/${id(160)}`,account_id:id(21),tenant_id:id(1)}]);
    assert.deepEqual(await resolveAs(claimsFor(10,20,1,'employee'),employeeNotice.id,id(20)),[{route:`/portal/employee/assignments/${id(160)}/execute`,account_id:id(20),tenant_id:id(1)}]);
  });
  await t.test('unknown identifiers, another recipient and wrong expected account disclose nothing',async()=>{
    assert.deepEqual(await resolveAs(claimsFor(),id(99999),id(21)),[]);
    assert.deepEqual(await resolveAs(claimsFor(),foreignNotice.id,id(22)),[]);
    assert.deepEqual(await resolveAs(claimsFor(),clientNotice.id,id(20)),[]);
    assert.deepEqual(await resolveAs(claimsFor(),employeeNotice.id,id(20)),[]);
  });
  await t.test('server-owned account, tenant and portal claims must all match; editable metadata is ignored',async()=>{
    for(const claims of [{}, {sub:id(11)}, {sub:id(11),user_metadata:claimsFor().app_metadata},
      claimsFor(11,22),claimsFor(11,21,2),claimsFor(11,21,1,'employee')])
      assert.deepEqual(await resolveAs(claims,clientNotice.id,id(21)),[]);
    assert.equal((await resolveAs({...claimsFor(),user_metadata:{portal_account_id:id(22)}},clientNotice.id,id(21))).length,1);
  });
  await t.test('shared auth user cannot switch to a second account by changing the RPC argument',async()=>{
    await db.exec(`INSERT INTO client_portal_access VALUES('${id(45)}','${id(1)}','${id(11)}','${id(31)}',true,'aktiv');
      INSERT INTO portal_push_devices(id,tenant_id,auth_user_id,portal_account_id,portal_type,client_id,expo_push_token,platform)
      VALUES('${id(46)}','${id(1)}','${id(11)}','${id(45)}','client','${id(31)}','ExpoPushToken[other-account]','android');`);
    await futureVisit(162,30);
    [otherAccountNotice]=await query('SELECT * FROM portal_push_outbox WHERE account_id=$1',[id(45)]);
    await query("UPDATE portal_push_outbox SET state='accepted' WHERE id=$1",[otherAccountNotice.id]);
    assert.deepEqual(await resolveAs(claimsFor(),otherAccountNotice.id,id(45)),[]);
    assert.equal((await resolveAs(claimsFor(11,45),otherAccountNotice.id,id(45))).length,1);
  });
  await t.test('device reassignment and logout invalidate a previously delivered reference',async()=>{
    await db.exec(`UPDATE portal_push_devices SET portal_account_id='${id(45)}' WHERE id='${id(41)}'`);
    assert.deepEqual(await resolveAs(claimsFor(),clientNotice.id,id(21)),[]);
    await db.exec(`UPDATE portal_push_devices SET portal_account_id='${id(21)}',enabled=false WHERE id='${id(41)}'`);
    assert.deepEqual(await resolveAs(claimsFor(),clientNotice.id,id(21)),[]);
    await db.exec(`UPDATE portal_push_devices SET enabled=true WHERE id='${id(41)}'`);
  });
  await t.test('revoked accounts and hidden or reassigned source records cannot resolve',async()=>{
    await db.exec(`UPDATE client_portal_access SET portal_enabled=false WHERE id='${id(21)}'`);
    assert.deepEqual(await resolveAs(claimsFor(),clientNotice.id,id(21)),[]);
    await db.exec(`UPDATE client_portal_access SET portal_enabled=true WHERE id='${id(21)}';
      UPDATE assist_visits SET portal_release_enabled=false WHERE id='${id(160)}'`);
    assert.deepEqual(await resolveAs(claimsFor(),clientNotice.id,id(21)),[]);
    await db.exec(`UPDATE assist_visits SET portal_release_enabled=true,client_id='${id(32)}' WHERE id='${id(160)}'`);
    assert.deepEqual(await resolveAs(claimsFor(),clientNotice.id,id(21)),[]);
    await db.exec(`UPDATE assist_visits SET client_id='${id(31)}' WHERE id='${id(160)}'`);
  });
  await t.test('tenant opt-out and event preference changes are rechecked at tap time',async()=>{
    await db.exec(`UPDATE tenant_notification_settings SET push_notifications_enabled=false WHERE tenant_id='${id(1)}'`);
    assert.deepEqual(await resolveAs(claimsFor(),clientNotice.id,id(21)),[]);
    await db.exec(`UPDATE tenant_notification_settings SET push_notifications_enabled=true,notify_assignment_changes=false WHERE tenant_id='${id(1)}'`);
    assert.deepEqual(await resolveAs(claimsFor(),clientNotice.id,id(21)),[]);
    await db.exec(`UPDATE tenant_notification_settings SET notify_assignment_changes=true WHERE tenant_id='${id(1)}'`);
  });
  await t.test('pending, cancelled and expired references cannot resolve; processing permits send-to-ack race',async()=>{
    for(const state of ['pending','cancelled','failed']) {
      await query('UPDATE portal_push_outbox SET state=$1 WHERE id=$2',[state,clientNotice.id]);
      assert.deepEqual(await resolveAs(claimsFor(),clientNotice.id,id(21)),[]);
    }
    await query("UPDATE portal_push_outbox SET state='processing' WHERE id=$1",[clientNotice.id]);
    assert.equal((await resolveAs(claimsFor(),clientNotice.id,id(21))).length,1);
    await query("UPDATE portal_push_outbox SET state='delivered',expires_at=now()-interval '1 second' WHERE id=$1",[clientNotice.id]);
    assert.deepEqual(await resolveAs(claimsFor(),clientNotice.id,id(21)),[]);
    await query("UPDATE portal_push_outbox SET expires_at=now()+interval '1 hour' WHERE id=$1",[clientNotice.id]);
  });
  await t.test('destination is derived from the authorized source and ignores stored route substitution',async()=>{
    await query("UPDATE portal_push_outbox SET route='https://untrusted.invalid/other-account' WHERE id=$1",[clientNotice.id]);
    const [row]=await resolveAs(claimsFor(),clientNotice.id,id(21));
    assert.equal(row.route,`/portal/client/appointments/${id(160)}`);
  });
  await t.test('anonymous callers cannot execute the resolver or read the outbox',async()=>{
    await db.exec('SET ROLE anon');
    await assert.rejects(()=>db.query('SELECT * FROM portal_push_resolve_destination($1,$2)',[clientNotice.id,id(21)]),/permission denied/);
    await assert.rejects(()=>db.query('SELECT * FROM portal_push_outbox'),/permission denied/);
    await db.exec('RESET ROLE');
  });
});
await db.close();
