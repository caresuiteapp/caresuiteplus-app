// Isolated PostgreSQL only. No production connection or employee records.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
const db = new PGlite();
const t = '10000000-0000-4000-8000-000000000001';
const e = '20000000-0000-4000-8000-000000000001';
const other = '20000000-0000-4000-8000-000000000002';
const u = '30000000-0000-4000-8000-000000000001';
await db.exec(`
CREATE ROLE authenticated; CREATE ROLE anon; CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.uid'),'')::uuid $$;
CREATE FUNCTION current_tenant_id() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.tenant'),'')::uuid $$;
CREATE FUNCTION current_portal_type() RETURNS text LANGUAGE sql AS $$ SELECT nullif(current_setting('test.portal'),'') $$;
CREATE FUNCTION has_permission(text) RETURNS boolean LANGUAGE sql AS $$ SELECT $1=ANY(string_to_array(current_setting('test.permissions'),',')) $$;
CREATE FUNCTION is_tenant_admin() RETURNS boolean LANGUAGE sql AS $$ SELECT current_setting('test.admin')::boolean $$;
CREATE TABLE employees(id uuid PRIMARY KEY,tenant_id uuid);
CREATE TABLE employee_portal_accounts(auth_user_id uuid,tenant_id uuid,employee_id uuid,status text);
CREATE FUNCTION resolve_current_employee_id() RETURNS uuid LANGUAGE sql AS $$
 SELECT employee_id FROM employee_portal_accounts WHERE auth_user_id=auth.uid() AND tenant_id=current_tenant_id() LIMIT 1 $$;
CREATE FUNCTION is_employee_portal_rls_context(uuid) RETURNS boolean LANGUAGE sql AS $$
 SELECT current_portal_type()='employee' AND EXISTS (SELECT 1 FROM employee_portal_accounts
 WHERE auth_user_id=auth.uid() AND tenant_id=$1 AND status='active') $$;
CREATE TABLE workforce_work_sessions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,employee_id uuid,user_id uuid,work_date date,
 status text,work_mode text,display_status text,started_at timestamptz,ended_at timestamptz,last_event_at timestamptz,is_online boolean,
 pause_minutes integer DEFAULT 0,gross_minutes integer DEFAULT 0,net_minutes integer DEFAULT 0,updated_at timestamptz,
 UNIQUE(tenant_id,employee_id,work_date));
CREATE TABLE workforce_time_events(id uuid DEFAULT gen_random_uuid(),tenant_id uuid,employee_id uuid,user_id uuid,event_type text,
 work_mode text,source text,occurred_at timestamptz,session_id uuid,created_by uuid,metadata jsonb);
INSERT INTO employees VALUES('${e}','${t}'),('${other}','${t}');
INSERT INTO employee_portal_accounts VALUES('${u}','${t}','${e}','active');
SELECT set_config('test.uid','${u}',false),set_config('test.tenant','${t}',false),
 set_config('test.portal','employee',false),set_config('test.permissions','',false),set_config('test.admin','false',false);
`);
await db.exec(readFileSync(new URL('../fixes/wfm_portal_clock_authorization.sql', import.meta.url), 'utf8'));
const clock = async (action = 'clock_in', time = '08:00', overrides = {}) => {
  const event = { clock_in: 'office_check_in', pause: 'pause_start', resume: 'pause_end', switch: 'office_check_in', clock_out: 'clock_out' }[action];
  return db.query('SELECT wfm_apply_clock_action($1,$2,$3,$4,$5,$6,$7,$8,$9) AS result',
    [overrides.tenant ?? t, overrides.employee ?? e, action, 'office', 'office', 'buero', event, overrides.source ?? 'portal', `2026-09-18 ${time}Z`]);
};
const rows = async q => (await db.query(q)).rows;
await test('active portal employee without an Office profile completes all five clock actions', async () => {
  await db.exec('SET ROLE authenticated');
  assert.equal((await clock()).rows[0].result.ok, true);
  await assert.rejects(() => clock(), /bereits ein Arbeitstag/);
  await clock('pause', '08:30'); await clock('resume', '08:45'); await clock('switch', '09:00'); await clock('clock_out', '10:00');
  await db.exec('RESET ROLE');
  assert.deepEqual((await rows('SELECT status,gross_minutes,pause_minutes,net_minutes FROM workforce_work_sessions'))[0],
    { status: 'ended', gross_minutes: 120, pause_minutes: 15, net_minutes: 105 });
  assert.equal((await rows('SELECT count(*)::int AS n FROM workforce_time_events'))[0].n, 5);
});
await test('other employee, tenant, and falsified source are rejected without writes', async () => {
  for (const override of [{ employee: other }, { tenant: other }, { source: 'office' }, { source: 'system' }]) {
    await assert.rejects(() => clock('clock_in', '11:00', override), /Berechtigung|zuordnung|Mandant/);
  }
  assert.equal((await rows('SELECT count(*)::int AS n FROM workforce_time_events'))[0].n, 5);
});
await test('disabled or unrelated portal accounts cannot stamp even with Office permissions', async () => {
  await db.exec("UPDATE employee_portal_accounts SET status='disabled'");
  await assert.rejects(() => clock(), /Berechtigung/);
  await db.exec("UPDATE employee_portal_accounts SET status='active'; SELECT set_config('test.portal','client',false),set_config('test.admin','true',false)");
  await assert.rejects(() => clock(), /Berechtigung/);
  await db.exec("SELECT set_config('test.portal','employee',false),set_config('test.admin','false',false)");
});
await test('missing auth identity or null employee resolution never bypass authorization', async () => {
  await db.exec("SELECT set_config('test.uid','',false)"); await assert.rejects(() => clock(), /Anmeldung/);
  await db.exec(`SELECT set_config('test.uid','${other}',false)`); await assert.rejects(() => clock(), /Berechtigung/);
  await db.exec(`SELECT set_config('test.uid','${u}',false)`);
  await assert.rejects(() => clock(null), /Unbekannte Arbeitszeitaktion/);
});
await test('Office keeps explicit own-action permissions and admin correction access', async () => {
  await db.exec("SELECT set_config('test.portal','',false)");
  await assert.rejects(() => clock(), /Berechtigung/);
  await db.exec("SELECT set_config('test.permissions','time.tracking.own.start',false)");
  assert.equal((await clock('clock_in', '11:00')).rows[0].result.ok, true);
  await assert.rejects(() => clock('pause', '11:05'), /Berechtigung/);
  await db.exec("SELECT set_config('test.permissions','time.tracking.admin.correct',false)");
  assert.equal((await clock('pause', '11:10', { source: 'office' })).rows[0].result.ok, true);
});
await test('anonymous callers have no execute privilege', async () => {
  await db.exec('SET ROLE anon'); await assert.rejects(() => clock(), /permission denied/); await db.exec('RESET ROLE');
});
await db.close();
