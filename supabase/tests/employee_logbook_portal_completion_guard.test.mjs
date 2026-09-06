// Isolated PostgreSQL regression test. Never connects to a Supabase project.
// Install @electric-sql/pglite in a temporary directory, then point
// CARESUITE_PGLITE_MODULE to that directory's node_modules/@electric-sql/pglite.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const { PGlite } = require(process.env.CARESUITE_PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
const migration = (name) => readFileSync(new URL(`../migrations/${name}.sql`, import.meta.url), 'utf8');
const r1 = migration('20260822123000_employee_logbook_live_r1');
const r11 = migration('20260825123000_employee_logbook_automatic_workflow_r11');
const fix = migration('20260906093000_employee_logbook_portal_completion_guard');
const tenant = '10000000-0000-0000-0000-000000000001';
const employee = '20000000-0000-0000-0000-000000000001';
const trip = '40000000-0000-0000-0000-000000000001';
const segment = '50000000-0000-0000-0000-000000000001';
function sqlFunction(source, name) {
  const start = source.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  assert.ok(start >= 0, name);
  const body = source.indexOf('AS $$', start);
  const end = source.indexOf('$$;', body + 5);
  assert.ok(body > start && end > body, name);
  return source.slice(start, end + 3);
}

// Real table definitions, guards and policies; only the surrounding Supabase
// identity resolver is replaced with settings for a synthetic portal account.
await db.exec(`
  CREATE ROLE authenticated;
  CREATE SCHEMA auth;
  CREATE TABLE auth.users (id UUID PRIMARY KEY);
  CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE SQL AS 'SELECT NULL::UUID';
  CREATE TABLE public.tenants (id UUID PRIMARY KEY);
  CREATE TABLE public.employees (id UUID PRIMARY KEY);
  CREATE TABLE public.clients (id UUID PRIMARY KEY);
  CREATE TABLE public.employee_payroll_settings (tenant_id UUID, employee_id UUID, mileage_rate_cents INTEGER);
  CREATE FUNCTION public.current_tenant_id() RETURNS UUID LANGUAGE SQL AS
    'SELECT current_setting(''test.tenant'')::UUID';
  CREATE FUNCTION public.resolve_current_employee_id() RETURNS UUID LANGUAGE SQL AS
    'SELECT current_setting(''test.employee'')::UUID';
  CREATE FUNCTION public.is_employee_portal_rls_context(t UUID) RETURNS BOOLEAN LANGUAGE SQL AS
    'SELECT current_setting(''test.portal'')::BOOLEAN AND t = public.current_tenant_id()';
  CREATE FUNCTION public.employee_logbook_own_employee(t UUID,e UUID) RETURNS BOOLEAN LANGUAGE SQL AS
    'SELECT t = public.current_tenant_id() AND (NOT public.is_employee_portal_rls_context(t) OR e = public.resolve_current_employee_id())';
  SELECT set_config('test.tenant','${tenant}',false), set_config('test.employee','${employee}',false), set_config('test.portal','true',false);
`);
await db.exec(`
    CREATE TABLE assist_visits(id uuid primary key,tenant_id uuid,employee_id uuid,legacy_assignment_id uuid,canonical_status text,planning_status text);
    CREATE TABLE assignments(id uuid,tenant_id uuid,status text);
    CREATE TABLE assist_visit_execution_state(tenant_id uuid,visit_id uuid,finalized_at timestamptz,signature_complete boolean,proof_generated boolean,updated_at timestamptz);
    CREATE TABLE assist_visit_signatures(tenant_id uuid,visit_id uuid,is_valid boolean,invalidated_at timestamptz,invalidation_reason text,updated_at timestamptz);
    CREATE TABLE assist_visit_proofs(tenant_id uuid,visit_id uuid,signature_id uuid,portal_visible boolean,portal_release_status text,updated_at timestamptz);
  `);
await db.exec(r1.slice(0, r1.indexOf('CREATE INDEX IF NOT EXISTS')) + '\nCOMMIT;');
await db.exec(migration('20260826123000_live_tracking_google_route_fallback_r12'));
await db.exec(migration('20260901183000_employee_logbook_car_confirmation_r18_5'));
await db.exec(`
  ${sqlFunction(r1, 'prepare_employee_logbook_trip')}
  ${sqlFunction(r1, 'audit_employee_logbook_trip')}
  ${sqlFunction(r11, 'protect_employee_logbook_completed_trip')}
  ${sqlFunction(r11, 'protect_employee_logbook_segment')}
  CREATE TRIGGER employee_logbook_prepare_trip BEFORE INSERT OR UPDATE OF ended_at, route_type, distance_final_km, employee_id
    ON public.employee_logbook_trips FOR EACH ROW EXECUTE FUNCTION public.prepare_employee_logbook_trip();
  CREATE TRIGGER employee_logbook_protect_completed_trip BEFORE UPDATE ON public.employee_logbook_trips
    FOR EACH ROW EXECUTE FUNCTION public.protect_employee_logbook_completed_trip();
  CREATE TRIGGER employee_logbook_protect_segment BEFORE UPDATE ON public.employee_logbook_segments
    FOR EACH ROW EXECUTE FUNCTION public.protect_employee_logbook_segment();
  CREATE TRIGGER employee_logbook_audit_trip AFTER INSERT OR UPDATE ON public.employee_logbook_trips
    FOR EACH ROW EXECUTE FUNCTION public.audit_employee_logbook_trip();
  ALTER TABLE public.employee_logbook_trips ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.employee_logbook_segments ENABLE ROW LEVEL SECURITY;
  ${r11.slice(r11.indexOf('DROP POLICY IF EXISTS employee_logbook_trips_access'), r11.indexOf('CREATE OR REPLACE FUNCTION public.protect_employee_logbook_segment'))}
  GRANT USAGE ON SCHEMA public TO authenticated;
  GRANT SELECT, INSERT, UPDATE ON public.employee_logbook_trips, public.employee_logbook_segments TO authenticated;
  INSERT INTO public.tenants VALUES ('${tenant}'), ('10000000-0000-0000-0000-000000000002');
  INSERT INTO public.employees VALUES ('${employee}'), ('20000000-0000-0000-0000-000000000002');
`);

async function seed(status = 'recording') {
  await db.exec(`RESET ROLE; SELECT set_config('test.portal','true',false);
    TRUNCATE public.employee_logbook_trips CASCADE;
    INSERT INTO public.employee_logbook_trips(id,tenant_id,employee_id,assignment_id,route_type,purpose,status,started_at,ended_at,distance_final_km,distance_gps_km)
    VALUES ('${trip}','${tenant}','${employee}','60000000-0000-0000-0000-000000000001','home_to_client','Testanfahrt','${status}',NOW()-INTERVAL '10 minutes',${status === 'recording' ? 'NULL' : 'NOW()'},1.2,1.2);
    INSERT INTO public.employee_logbook_segments(id,tenant_id,employee_id,trip_id,sequence_no,label,started_at)
    VALUES ('${segment}','${tenant}','${employee}','${trip}',1,'Testanfahrt',NOW()-INTERVAL '10 minutes');
    SET ROLE authenticated;`);
}
const end = () => db.exec(`UPDATE public.employee_logbook_trips SET status='confirmation_required',ended_at=NOW(),distance_final_km=1.2 WHERE id='${trip}'`);
const closeSegment = () => db.query(`UPDATE public.employee_logbook_segments SET ended_at=NOW(),end_address='Testziel' WHERE id='${segment}' AND ended_at IS NULL RETURNING id`);
const confirm = (extra = '') => db.exec(`UPDATE public.employee_logbook_trips SET status='confirmed',employee_confirmed_at=NOW() ${extra} WHERE id='${trip}'`);
const row = async () => (await db.query(`SELECT * FROM public.employee_logbook_trips WHERE id='${trip}'`)).rows[0];

await test('reproduces the reported R11 rejection before the fix', async () => {
  await seed();
  await assert.rejects(end, /Dieser Fahrtenbuchstatus darf im Mitarbeitendenportal nicht gesetzt werden/);
  assert.equal((await row()).status, 'recording');
});
await test('reproduces the silent segment RLS rejection after a pending trip', async () => {
  await seed('confirmation_required');
  assert.equal((await closeSegment()).rows.length, 0);
});
await test('migration changes no existing trip data and can be applied twice', async () => {
  const before = await row();
  await db.exec('RESET ROLE;');
  await db.exec(fix);
  await db.exec(fix);
  await db.exec('SET ROLE authenticated;');
  assert.deepEqual(await row(), before);
});
await test('employee can end approach, close segment and confirm kilometres', async () => {
  await seed(); await end();
  assert.equal((await row()).status, 'confirmation_required');
  assert.equal((await closeSegment()).rows.length, 1);
  await confirm();
  const saved = await row();
  assert.equal(saved.status, 'confirmed');
  assert.ok(saved.employee_confirmed_at);
  assert.equal(Number(saved.distance_final_km), 1.2);
  assert.equal(saved.mileage_amount_cents, 36);
  await db.exec('RESET ROLE;');
  const audit = await db.query(`SELECT new_values->>'status' AS status FROM public.employee_logbook_audit_events WHERE trip_id='${trip}' ORDER BY id`);
  assert.deepEqual(audit.rows.map((r) => r.status), ['recording','confirmation_required','confirmed']);
});
await test('confirmation remains blocked until interrupted segment close is repaired', async () => {
  await seed(); await end();
  await assert.rejects(confirm, /offenen Teilstrecken/);
  await closeSegment(); await confirm();
});
await test('correction needs a reason and stores server-derived evidence and amount', async () => {
  await seed(); await end(); await closeSegment();
  await assert.rejects(() => confirm(',distance_final_km=1.5'), /begründen/);
  await confirm(",distance_final_km=1.5,employee_confirmation_reason=' Umleitung ',previous_values='{}',mileage_rate_cents=900,mileage_amount_cents=90000");
  const saved = await row();
  assert.equal(saved.employee_confirmation_reason, 'Umleitung');
  assert.equal(saved.distance_source, 'manual');
  assert.deepEqual(saved.previous_values, { distance_final_km: 1.2, status: 'confirmation_required' });
  assert.equal(saved.mileage_rate_cents, 30);
  assert.equal(saved.mileage_amount_cents, 45);
});
await test('direct completion cannot bypass kilometre confirmation', async () => {
  await seed();
  for (const status of ['completed','confirmed','corrected','review_required']) {
    await assert.rejects(() => db.exec(`UPDATE public.employee_logbook_trips SET status='${status}' WHERE id='${trip}'`), /zuerst beendet/);
  }
});
await test('missing end or confirmation timestamp is rejected', async () => {
  await seed();
  await assert.rejects(() => db.exec(`UPDATE public.employee_logbook_trips SET status='confirmation_required' WHERE id='${trip}'`), /gültiges Fahrtende/);
  await end(); await closeSegment();
  await assert.rejects(() => db.exec(`UPDATE public.employee_logbook_trips SET status='confirmed' WHERE id='${trip}'`), /unvollständig/);
});
await test('negative kilometres cannot be confirmed', async () => {
  await seed(); await end(); await closeSegment();
  await assert.rejects(() => confirm(',distance_final_km=-1'));
  assert.equal((await row()).status, 'confirmation_required');
});
await test('pending confirmation cannot rewrite GPS, address or office decisions', async () => {
  await seed(); await end(); await closeSegment();
  for (const change of ["distance_gps_km=42", "end_address='Anderes Ziel'", "notes='Manipuliert'", "correction_reason='Verwaltung'", "counts_as_work_time=true"]) {
    await assert.rejects(() => confirm(',' + change), /nur Kilometer/);
  }
});
await test('tenant, employee, visit and source stay immutable', async () => {
  await seed();
  for (const change of ["tenant_id='10000000-0000-0000-0000-000000000002'", "employee_id='20000000-0000-0000-0000-000000000002'", "assignment_id='60000000-0000-0000-0000-000000000002'", "source='office_manual'", "purpose='Anderer Zweck'"]) {
    await assert.rejects(() => db.exec(`UPDATE public.employee_logbook_trips SET ${change} WHERE id='${trip}'`), /Zuordnung/);
  }
});
await test('another employee cannot read or close this trip or its segment', async () => {
  await seed();
  await db.exec("SELECT set_config('test.employee','20000000-0000-0000-0000-000000000002',false);");
  assert.equal(await row(), undefined);
  assert.equal((await db.query(`UPDATE public.employee_logbook_trips SET ended_at=NOW(),status='confirmation_required' WHERE id='${trip}' RETURNING id`)).rows.length, 0);
  assert.equal((await closeSegment()).rows.length, 0);
  await db.exec(`SELECT set_config('test.employee','${employee}',false);`);
});
await test('another tenant cannot read or update this trip', async () => {
  await seed();
  await db.exec("SELECT set_config('test.tenant','10000000-0000-0000-0000-000000000002',false);");
  assert.equal(await row(), undefined);
  assert.equal((await closeSegment()).rows.length, 0);
  await db.exec(`SELECT set_config('test.tenant','${tenant}',false);`);
});
await test('a closed segment cannot be closed a second time', async () => {
  await seed(); await end(); await closeSegment();
  await assert.rejects(() => db.exec(`UPDATE public.employee_logbook_segments SET ended_at=NOW() WHERE id='${segment}'`), /nur einmal/);
});
await test('confirmed trips remain locked against later employee changes', async () => {
  await seed(); await end(); await closeSegment(); await confirm();
  for (const change of ["status='recording'", "distance_final_km=20", "notes='Nachtrag'"]) {
    await assert.rejects(() => db.exec(`UPDATE public.employee_logbook_trips SET ${change} WHERE id='${trip}'`), /nur die Verwaltung/);
  }
});
await test('office corrections retain their existing access path', async () => {
  await seed(); await end(); await closeSegment(); await confirm();
  await db.exec("SELECT set_config('test.portal','false',false);");
  await db.exec(`UPDATE public.employee_logbook_trips SET status='corrected',distance_final_km=2,correction_reason='Verwaltungskorrektur' WHERE id='${trip}'`);
  assert.equal((await row()).status, 'corrected');
});
await test('kilometres remain editable only while the assigned visit is open', async () => {
  await seed(); await end(); await closeSegment(); await confirm();
  const visit='60000000-0000-0000-0000-000000000001';
  await db.exec(`RESET ROLE;
    INSERT INTO assist_visits VALUES('${visit}','${tenant}','${employee}',NULL,'documentation_open','confirmed');
    SELECT set_config('test.portal','false',false);
    UPDATE employee_logbook_trips SET assignment_id='${visit}' WHERE id='${trip}';
    INSERT INTO assist_visit_signatures(tenant_id,visit_id,is_valid) VALUES('${tenant}','${visit}',true);
    SELECT set_config('test.portal','true',false);
    SET ROLE authenticated;
  `);
  await db.exec(`UPDATE employee_logbook_trips SET distance_final_km=1.5,employee_confirmation_reason='Strecke korrigiert' WHERE id='${trip}'`);
  assert.equal(Number((await row()).distance_final_km),1.5);
  await db.exec(`RESET ROLE`);
  assert.equal((await db.query('SELECT is_valid FROM assist_visit_signatures')).rows[0].is_valid,false);
  await db.exec(`UPDATE assist_visits SET canonical_status='completed' WHERE id='${visit}'; SET ROLE authenticated;`);
  await assert.rejects(() => db.exec(`UPDATE employee_logbook_trips SET distance_final_km=2,employee_confirmation_reason='Nach Abschluss' WHERE id='${trip}'`), /abgeschlossen/);
});
await test('legacy completed and office-corrected trips remain editable only for the own open visit',async()=>{
  for(const status of ['completed','corrected']) {
    await seed(); await end(); await closeSegment();
    const visit='60000000-0000-0000-0000-000000000003';
    await db.exec(`RESET ROLE; SELECT set_config('test.portal','false',false);
      INSERT INTO assist_visits VALUES('${visit}','${tenant}','${employee}',NULL,'documentation_open','confirmed');
      UPDATE employee_logbook_trips SET assignment_id='${visit}',status='${status}' WHERE id='${trip}';
      SELECT set_config('test.portal','true',false); SET ROLE authenticated;`);
    await db.exec(`UPDATE employee_logbook_trips SET status='confirmed',distance_final_km=2,employee_confirmed_at=now(),employee_confirmation_reason='Tatsächliche Strecke' WHERE id='${trip}'`);
    assert.equal(Number((await row()).distance_final_km),2);
    await db.exec(`RESET ROLE; DELETE FROM assist_visits WHERE id='${visit}';`);
  }
});
await db.close();
