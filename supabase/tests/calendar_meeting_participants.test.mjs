import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const id = value => `00000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
const tenant = id(1), otherTenant = id(2), first = id(11), second = id(12), foreign = id(21);
let db;
const migration = readFileSync(new URL('../migrations/20261022055937_calendar_meeting_participants.sql', import.meta.url), 'utf8');

before(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE authenticated NOLOGIN;
    CREATE TABLE public.tenants(id uuid PRIMARY KEY);
    CREATE TABLE public.profiles(id uuid PRIMARY KEY);
    CREATE TABLE public.clients(id uuid PRIMARY KEY);
    CREATE TABLE public.employees(id uuid PRIMARY KEY, tenant_id uuid NOT NULL);
    CREATE FUNCTION public.current_tenant_id() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('fixture.tenant_id', true), '')::uuid $$;
    CREATE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql AS
      $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
    ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
    CREATE POLICY own_employees ON public.employees FOR SELECT TO authenticated
      USING (tenant_id = public.current_tenant_id());
    GRANT USAGE ON SCHEMA public TO authenticated;
    GRANT SELECT ON public.employees TO authenticated;
  `);
  await db.query('INSERT INTO tenants VALUES ($1),($2)', [tenant, otherTenant]);
  await db.query('INSERT INTO employees VALUES ($1,$3),($2,$3),($4,$5)', [first, second, tenant, foreign, otherTenant]);
  await db.exec(readFileSync(new URL('../migrations/0117_calendar_events.sql', import.meta.url), 'utf8'));
  await db.exec(migration);
  await db.exec(migration); // Safe when deployment retries the migration.
  await db.exec('SET ROLE authenticated');
  await db.query("SELECT set_config('fixture.tenant_id', $1, false)", [tenant]);
});
after(async () => { await db?.close(); });

async function insert(source, participants, employee = first) {
  return db.query(`INSERT INTO calendar_events(tenant_id,source_type,source_id,title,start_at,end_at,related_employee_id,participant_employee_ids,is_employee_portal_visible)
    VALUES ($1,'custom_event',$2,'Synthetisches Teammeeting','2026-10-23 08:00Z','2026-10-23 09:00Z',$3,$4,true) RETURNING *`,
  [tenant, id(source), employee, participants]);
}

test('stores one meeting with all participants, preserving selection order and removing duplicates', async () => {
  const result = await insert(101, [first, second, first]);
  assert.deepEqual(result.rows[0].participant_employee_ids, [first, second]);
  const members = await db.query('SELECT id FROM calendar_events WHERE tenant_id=$1 AND (related_employee_id=$2 OR participant_employee_ids @> ARRAY[$2]::uuid[])', [tenant, second]);
  assert.equal(members.rows.length, 1);
  assert.equal(members.rows[0].id, result.rows[0].id);
});

test('editing, clearing and source status updates do not create additional meetings', async () => {
  const saved = (await insert(102, [first, second])).rows[0];
  await db.query('UPDATE calendar_events SET status=$2 WHERE id=$1', [saved.id, 'abgeschlossen']);
  let row = (await db.query('SELECT * FROM calendar_events WHERE id=$1', [saved.id])).rows[0];
  assert.deepEqual(row.participant_employee_ids, [first, second]);
  // Older source synchronizers omit the new column in their upsert payload.
  await db.query(`INSERT INTO calendar_events(tenant_id,source_type,source_id,title,start_at,end_at,related_employee_id)
    VALUES ($1,'custom_event',$2,'Aktualisierte Quelle','2026-10-23 08:00Z','2026-10-23 09:00Z',$3)
    ON CONFLICT (tenant_id,source_type,source_id) DO UPDATE SET tenant_id=excluded.tenant_id,title=excluded.title,related_employee_id=excluded.related_employee_id`, [tenant, id(102), first]);
  assert.deepEqual((await db.query('SELECT participant_employee_ids FROM calendar_events WHERE id=$1', [saved.id])).rows[0].participant_employee_ids, [first, second]);
  await db.query('UPDATE calendar_events SET participant_employee_ids=$2,related_employee_id=$3 WHERE id=$1', [saved.id, [second], second]);
  row = (await db.query('SELECT * FROM calendar_events WHERE source_id=$1', [id(102)])).rows[0];
  assert.deepEqual(row.participant_employee_ids, [second]);
  await db.query('UPDATE calendar_events SET participant_employee_ids=$2,related_employee_id=null,is_employee_portal_visible=false WHERE id=$1', [saved.id, []]);
  const cleared = await db.query('SELECT * FROM calendar_events WHERE source_id=$1', [id(102)]);
  assert.equal(cleared.rows.length, 1);
  assert.deepEqual(cleared.rows[0].participant_employee_ids, []);
});

test('rejects unknown, null and other-tenant employees at the database boundary', async () => {
  for (const [index, participants] of [[0, [first, foreign]], [1, [id(99)]], [2, [null]]]) {
    await assert.rejects(insert(110 + index, participants), error => error.code === '23514');
  }
  assert.equal((await db.query('SELECT id FROM calendar_events WHERE source_id=ANY($1::uuid[])', [[id(110), id(111), id(112)]])).rows.length, 0);
});

test('retains tenant RLS for reads and writes', async () => {
  await db.query("SELECT set_config('fixture.tenant_id', $1, false)", [otherTenant]);
  try {
    assert.equal((await db.query('SELECT id FROM calendar_events')).rows.length, 0);
    await assert.rejects(insert(120, []), error => error.code === '42501');
  } finally { await db.query("SELECT set_config('fixture.tenant_id', $1, false)", [tenant]); }
});

test('accepts existing singular sources without requiring a participant array', async () => {
  const result = await db.query(`INSERT INTO calendar_events(tenant_id,source_type,source_id,title,start_at,end_at,related_employee_id)
    VALUES ($1,'custom_event',$2,'Bestehender Termin','2026-10-23 10:00Z','2026-10-23 11:00Z',$3) RETURNING *`, [tenant, id(130), first]);
  assert.equal(result.rows[0].related_employee_id, first);
  assert.deepEqual(result.rows[0].participant_employee_ids, []);
});
