/* Run with Node and @electric-sql/pglite available in NODE_PATH.
 * Uses only an in-memory PostgreSQL instance; never connects to the live database.
 */
const { PGlite } = require('@electric-sql/pglite');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const tenant = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const client = '33333333-3333-4333-8333-333333333333';
const actor = '44444444-4444-4444-8444-444444444444';
const visit = '55555555-5555-4555-8555-555555555555';
const proof = '66666666-6666-4666-8666-666666666666';
let count = 0;

(async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated;
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS
        $$ SELECT nullif(current_setting('test.actor', true), '')::uuid $$;
      CREATE FUNCTION public.current_tenant_id() RETURNS uuid LANGUAGE sql AS
        $$ SELECT nullif(current_setting('test.tenant', true), '')::uuid $$;
      CREATE FUNCTION public.resolve_current_profile_id() RETURNS uuid LANGUAGE sql AS
        $$ SELECT nullif(current_setting('test.profile', true), '')::uuid $$;
      CREATE FUNCTION public.is_tenant_admin() RETURNS boolean LANGUAGE sql AS
        $$ SELECT current_setting('test.admin', true) = 'yes' $$;
      CREATE FUNCTION public.has_permission(text) RETURNS boolean LANGUAGE sql AS
        $$ SELECT current_setting('test.permission', true) = 'yes' $$;
      CREATE TABLE public.profiles (id uuid PRIMARY KEY);
      CREATE TABLE public.assist_visits (id uuid PRIMARY KEY, tenant_id uuid, client_id uuid);
      CREATE TABLE public.assist_visit_proofs (
        id uuid PRIMARY KEY, tenant_id uuid, visit_id uuid REFERENCES assist_visits(id),
        signature_id uuid, status text DEFAULT 'draft', payload_snapshot jsonb DEFAULT '{}',
        payload_hash text, portal_visible boolean DEFAULT false,
        portal_release_status text DEFAULT 'none' CHECK (portal_release_status IN ('none','pending_client_signature','released','revoked')),
        released_to_portal_at timestamptz, updated_by uuid REFERENCES profiles(id), updated_at timestamptz DEFAULT now()
      );
      CREATE TABLE public.client_documents (
        id uuid PRIMARY KEY, tenant_id uuid, client_id uuid, title text, file_name text,
        mime_type text, category text, storage_path text, portal_visible boolean,
        status text, sensitivity text, source text, uploaded_by uuid REFERENCES profiles(id),
        signed_at timestamptz, signature_required boolean, updated_at timestamptz
      );
      INSERT INTO profiles VALUES ('${actor}');
      INSERT INTO assist_visits VALUES ('${visit}','${tenant}','${client}');
    `);
    await db.exec(readFileSync(path.join(__dirname, '../supabase/migrations/20260907140000_admin_atomic_deferred_signature.sql'), 'utf8'));
    async function context(overrides = {}) {
      for (const [key, value] of Object.entries({ actor, profile: actor, tenant, admin: 'yes', permission: 'no', ...overrides })) {
        await db.query("SELECT set_config($1,$2,false)", ['test.' + key, value]);
      }
    }
    async function reset() {
      await db.exec('RESET ROLE; TRUNCATE client_documents, assist_visit_proofs;');
      await db.query('INSERT INTO assist_visit_proofs (id,tenant_id,visit_id,payload_hash) VALUES ($1,$2,$3,$4)', [proof,tenant,visit,'original']);
      await context();
    }
    async function release(overrides = {}) {
      const values = { tenant, proof, client, title: 'Test-Einsatz', snapshot: { title: 'Test-Einsatz' }, hash: 'new-hash', ...overrides };
      await db.exec('SET ROLE authenticated');
      try {
        return await db.query('SELECT public.admin_release_deferred_signature($1,$2,$3,$4,$5,$6) AS id', Object.values(values));
      } finally { await db.exec('RESET ROLE'); }
    }
    async function proofRow() { return (await db.query('SELECT * FROM assist_visit_proofs WHERE id=$1',[proof])).rows[0]; }
    async function test(name, fn) {
      await reset(); await fn(); count++; process.stdout.write('PASS ' + name + '\n');
    }
    await test('commits proof and document together with resolved actor', async () => {
      assert.equal((await release()).rows[0].id,proof);
      assert.equal((await proofRow()).portal_release_status,'pending_client_signature');
      const doc = (await db.query('SELECT * FROM client_documents')).rows[0];
      assert.equal(doc.client_id,client); assert.equal(doc.uploaded_by,actor); assert.equal(doc.signature_required,true);
    });
    await test('retries preserve original snapshot and release time', async () => {
      await release(); const before = await proofRow();
      await release({ snapshot: { stale: true }, hash: 'stale-hash' });
      assert.deepEqual(await proofRow(),before);
      assert.equal((await db.query('SELECT count(*)::int AS n FROM client_documents')).rows[0].n,1);
    });
    await test('document conflict rolls back proof publication', async () => {
      await db.query('INSERT INTO client_documents (id,tenant_id,client_id,source) VALUES ($1,$2,$3,$4)',[proof,other,client,'other']);
      const before = await proofRow();
      await assert.rejects(release(), /nicht eindeutig/);
      assert.deepEqual(await proofRow(),before);
    });
    await test('repairs existing partial request without replacing its snapshot', async () => {
      await db.exec("UPDATE assist_visit_proofs SET portal_visible=true, portal_release_status='pending_client_signature'");
      await release();
      assert.equal((await proofRow()).payload_hash,'original');
      assert.equal((await db.query('SELECT count(*)::int AS n FROM client_documents')).rows[0].n,1);
    });
    await test('signed proof is preserved', async () => {
      await db.query('UPDATE assist_visit_proofs SET signature_id=$1',[actor]);
      const before = await proofRow();
      await assert.rejects(release(), /bereits unterschrieben/);
      assert.deepEqual(await proofRow(),before);
    });
    await test('approved proof is preserved', async () => {
      await db.exec("UPDATE assist_visit_proofs SET status='approved'");
      await assert.rejects(release(), /freigegeben/);
    });
    await test('signed client document cannot be reset', async () => {
      await db.query("INSERT INTO client_documents (id,tenant_id,client_id,source,signed_at) VALUES ($1,$2,$3,'assist_visit_proof',now())",[proof,tenant,client]);
      const before = await proofRow();
      await assert.rejects(release(), /bereits unterschrieben/);
      assert.deepEqual(await proofRow(),before);
    });
    await test('requires authenticated session', async () => {
      await context({ actor: '' }); await assert.rejects(release(), /Anmeldung/);
    });
    await test('requires administration permission', async () => {
      await context({ admin: 'no' }); await assert.rejects(release(), /Berechtigung/);
    });
    await test('requires matching tenant and client', async () => {
      await assert.rejects(release({ tenant: other }), /Mandant/);
      await assert.rejects(release({ client: other }), /Klienten/);
    });
    await test('requires server-resolved profile', async () => {
      await context({ profile: '' }); await assert.rejects(release(), /Verwaltungsprofil/);
    });
    await test('permits explicitly granted execution management', async () => {
      await context({ admin: 'no', permission: 'yes' }); assert.equal((await release()).rows[0].id,proof);
    });
    await test('does not grant anonymous execution', async () => {
      await db.exec('SET ROLE anon');
      await assert.rejects(db.query('SELECT public.admin_release_deferred_signature($1,$2,$3,$4,$5,$6)',[tenant,proof,client,'Test',{},'hash']), /permission denied/);
      await db.exec('RESET ROLE');
    });
    await db.exec(`
      ALTER TABLE assist_visits
        ADD legacy_assignment_id uuid, ADD employee_id uuid,
        ADD execution_status text DEFAULT 'completed', ADD canonical_status text,
        ADD actual_start_at timestamptz, ADD actual_end_at timestamptz,
        ADD on_the_way_at timestamptz, ADD arrived_at timestamptz, ADD finished_at timestamptz;
      CREATE TABLE assignments (
        id uuid PRIMARY KEY, tenant_id uuid, client_id uuid, employee_id uuid,
        actual_start_at timestamptz, actual_end_at timestamptz,
        on_the_way_at timestamptz, arrived_at timestamptz, finished_at timestamptz
      );
      CREATE FUNCTION test_visit_mirror() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        UPDATE assignments SET actual_start_at=NEW.actual_start_at, actual_end_at=NEW.actual_end_at
        WHERE id=NEW.id AND tenant_id=NEW.tenant_id;
        RETURN NEW;
      END; $$;
      CREATE TRIGGER test_visit_mirror AFTER UPDATE ON assist_visits
      FOR EACH ROW EXECUTE FUNCTION test_visit_mirror();
    `);
    await db.exec(readFileSync(path.join(__dirname, '../supabase/migrations/20260907141000_preserve_recorded_visit_times.sql'), 'utf8'));
    async function timeTest(name, fn) {
      await db.exec("TRUNCATE assignments; UPDATE assist_visits SET execution_status='completed', employee_id=NULL, actual_start_at=NULL, actual_end_at=NULL;");
      await db.query("INSERT INTO assignments (id,tenant_id,client_id,actual_start_at,actual_end_at) VALUES ($1,$2,$3,'2026-09-07T07:00:00Z','2026-09-07T09:00:00Z')",[visit,tenant,client]);
      await fn(); count++; process.stdout.write('PASS ' + name + '\n');
    }
    async function visitEnd() { return (await db.query('SELECT actual_end_at FROM assist_visits WHERE id=$1',[visit])).rows[0].actual_end_at; }
    await timeTest('status refresh preserves recorded assignment time through the mirror', async () => {
      await db.exec("UPDATE assist_visits SET canonical_status='finished'");
      assert.equal(new Date(await visitEnd()).toISOString(),'2026-09-07T09:00:00.000Z');
      const a=(await db.query('SELECT actual_end_at FROM assignments')).rows[0];
      assert.equal(new Date(a.actual_end_at).toISOString(),'2026-09-07T09:00:00.000Z');
    });
    await timeTest('does not override an explicit correction or clear', async () => {
      await db.exec("UPDATE assist_visits SET actual_end_at='2026-09-07T09:15:00Z'");
      assert.equal(new Date(await visitEnd()).toISOString(),'2026-09-07T09:15:00.000Z');
      await db.exec('UPDATE assist_visits SET actual_end_at=NULL');
      assert.equal(await visitEnd(),null);
    });
    await timeTest('does not copy times across tenant or employee boundaries', async () => {
      await db.query('UPDATE assignments SET tenant_id=$1',[other]);
      await db.exec("UPDATE assist_visits SET canonical_status='finished'");
      assert.equal(await visitEnd(),null);
      await db.query('UPDATE assignments SET tenant_id=$1, employee_id=$2',[tenant,actor]);
      await db.exec("UPDATE assist_visits SET canonical_status='finished'");
      assert.equal(await visitEnd(),null);
    });
    await timeTest('never invents a missing time', async () => {
      await db.exec("UPDATE assignments SET actual_end_at=NULL; UPDATE assist_visits SET canonical_status='finished'");
      assert.equal(await visitEnd(),null);
    });
    process.stdout.write(`${count} PostgreSQL transaction tests passed.\n`);
  } finally { await db.close(); }
})().catch(error => { process.stderr.write(String(error) + '\n'); process.exitCode=1; });
