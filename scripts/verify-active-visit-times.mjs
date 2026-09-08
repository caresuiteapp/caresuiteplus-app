// Isolated PostgreSQL regression checks; synthetic rows, no remote connection.
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { randomUUID as uuid } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const migration = name => fs.readFileSync(path.join(root, 'supabase/migrations', name), 'utf8');
const db = new PGlite();
const fields = ['on_the_way_at', 'arrived_at', 'actual_start_at', 'actual_end_at', 'finished_at'];
const recorded = ['07:00', '07:20', '07:25', '09:25', '09:30'].map(t => `2026-08-01T${t}:00.000Z`);
let passed = 0;
async function test(name, run) { await run(); console.log(`PASS ${name}`); passed++; }
async function rows(id) {
  const a = (await db.query('SELECT * FROM assignments WHERE id=$1', [id])).rows[0];
  const v = (await db.query('SELECT * FROM assist_visits WHERE id=$1', [id])).rows[0];
  return { a, v };
}
function times(row) { return fields.map(f => row[f]?.toISOString?.() ?? row[f] ?? null); }
async function seed(status = 'arrived', mismatch = null) {
  const id = uuid(), tenant = uuid(), client = uuid(), employee = uuid();
  await db.query(`INSERT INTO assist_visits(id,tenant_id,client_id,employee_id,legacy_assignment_id,planning_status,canonical_status,execution_status)
    VALUES($1,$2,$3,$4,$1,'confirmed',$5,$5)`, [id, tenant, client, employee, status]);
  await db.query(`UPDATE assignments SET ${fields.map((f,i)=>`${f}=$${i+2}`).join(',')} WHERE id=$1`, [id, ...recorded]);
  if (mismatch) await db.query(`UPDATE assignments SET ${mismatch}=$2 WHERE id=$1`, [id, uuid()]);
  return id;
}
try {
  await db.exec(`CREATE TYPE assignment_status AS ENUM('planned','confirmed','on_the_way','arrived','started','paused','finished','documentation_open','signature_open','completed','cancelled','no_show');
    CREATE TYPE product_key AS ENUM('assist');
    CREATE TABLE assignments(id uuid PRIMARY KEY,tenant_id uuid,client_id uuid,employee_id uuid,
      assignment_date date,planned_start_at timestamptz,planned_end_at timestamptz,title text,description text,
      address_snapshot text,internal_notes text,client_visible_notes text,status assignment_status,product_key product_key,
      created_by uuid,created_at timestamptz,updated_at timestamptz,${fields.map(f=>`${f} timestamptz`).join(',')});
    CREATE TABLE assist_visits(LIKE assignments INCLUDING DEFAULTS,legacy_assignment_id uuid,planning_status text,
      canonical_status text,execution_status text,PRIMARY KEY(id));`);
  const source = migration('0198_assist_live_tracking_portal_repair.sql');
  const begin = source.indexOf('CREATE OR REPLACE FUNCTION public.sync_assignment_mirror_from_assist_visit()');
  const end = source.indexOf('EXECUTE FUNCTION public.sync_assignment_mirror_from_assist_visit();', begin);
  assert(begin >= 0 && end > begin, 'Existing production mirror must be exercised');
  await db.exec(source.slice(begin, end + 'EXECUTE FUNCTION public.sync_assignment_mirror_from_assist_visit();'.length));
  await db.exec(migration('20260907141000_preserve_recorded_visit_times.sql'));
  await test('reproduces the previous loss during an arrival mirror', async () => {
    const id = await seed();
    await db.query("UPDATE assist_visits SET canonical_status='arrived' WHERE id=$1", [id]);
    assert.deepEqual(times((await rows(id)).a), fields.map(()=>null));
  });
  await db.exec(migration('20260908100000_preserve_active_visit_times.sql'));
  for (const status of ['on_the_way','arrived','started','paused','finished','completed']) {
    await test(`preserves recorded times when mirroring ${status}`, async () => {
      const id = await seed(status);
      await db.query('UPDATE assist_visits SET canonical_status=$2 WHERE id=$1', [id, status]);
      const { a, v } = await rows(id);
      assert.deepEqual(times(a), recorded); assert.deepEqual(times(v), recorded);
    });
  }
  await test('does not fabricate a start or end when only arrival was recorded', async () => {
    const id = await seed();
    await db.query('UPDATE assignments SET actual_start_at=null,actual_end_at=null,finished_at=null WHERE id=$1', [id]);
    await db.query("UPDATE assist_visits SET canonical_status='arrived' WHERE id=$1", [id]);
    assert.deepEqual(times((await rows(id)).v), [recorded[0],recorded[1],null,null,null]);
  });
  await test('retains an explicit correction and an explicit clearing of an existing field', async () => {
    const id = await seed();
    await db.query("UPDATE assist_visits SET canonical_status='arrived' WHERE id=$1", [id]);
    const corrected = '2026-08-01T07:22:00.000Z';
    await db.query('UPDATE assist_visits SET arrived_at=$2,actual_end_at=null WHERE id=$1', [id, corrected]);
    const { a, v } = await rows(id);
    assert.equal(times(a)[1], corrected); assert.equal(times(v)[1], corrected);
    assert.equal(a.actual_end_at, null); assert.equal(v.actual_end_at, null);
  });
  for (const scope of ['tenant_id','client_id','employee_id']) {
    await test(`does not inherit another ${scope}`, async () => {
      const id = await seed('arrived', scope);
      await db.query("UPDATE assist_visits SET canonical_status='arrived' WHERE id=$1", [id]);
      assert.deepEqual(times((await rows(id)).v), fields.map(()=>null));
    });
  }
  await test('keeps the guard as SECURITY INVOKER', async () => {
    const result = await db.query("SELECT prosecdef FROM pg_proc WHERE oid='public.preserve_recorded_assist_visit_times()'::regprocedure");
    assert.equal(result.rows[0].prosecdef, false);
  });
  console.log(`${passed} PostgreSQL checks passed`);
} finally { await db.close(); }
