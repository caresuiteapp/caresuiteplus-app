/** Real PDF/PNG bytes, encrypted SQLite and the reviewed PostgreSQL functions.
 * Office source/identity resolution is a contract double. No deployed worker,
 * browser capture, Supabase Storage or real patient signature is asserted. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { PNG } from 'pngjs';
import { PGlite } from '@electric-sql/pglite';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { inspectMonthlySignature, pngCrc } from '../../services/gkv/monthly-signature-png.mjs';
import { renderMonthlyOriginal } from '../../services/gkv/monthly-original-pdf.mjs';
import { MonthlyOriginalStore } from '../../services/gkv/monthly-original-store.mjs';
import { MonthlyOriginalVerifier, monthlyOriginalDatabase } from '../../services/gkv/monthly-original-verifier.mjs';
import { fixture } from './monthly-fixtures.mjs';
import { readMonthlyProof } from '../../src/lib/gkvExchange/monthlyProof.ts';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function signature({ variant = 0, filterType = 4, deflateLevel = 9, margin = 0, blank = false, colorType = 6 } = {}) {
  const png = new PNG({ width: 160 + 2 * margin, height: 70 + 2 * margin }); png.data.fill(255);
  if (!blank) for (let x = 20; x < 140; x++) {
    const y = 24 + Math.round(10 * Math.sin((x + variant * 7) / (8 + variant)) + x / 9);
    for (let dy = 0; dy < 2; dy++) {
      const offset = ((y + dy + margin) * png.width + x + margin) * 4;
      png.data.fill(24, offset, offset + 3);
    }
  }
  return PNG.sync.write(png, { filterType, deflateLevel, colorType });
}
function chunk(kind, body) {
  const out = Buffer.alloc(body.length + 12); out.writeUInt32BE(body.length); out.write(kind, 4); body.copy(out, 8);
  out.writeUInt32BE(pngCrc(out.subarray(4, out.length - 4)), out.length - 4); return out;
}
test('signature reads independently encoded PNG pixels and binds byte and appearance hashes', () => {
  const a = signature(), b = signature({ filterType: 0, deflateLevel: 1 }), padded = signature({ margin: 20 });
  assert.notEqual(hash(a), hash(b));
  const read = inspectMonthlySignature(a); assert.equal(read.sha256, hash(a)); assert.equal(read.width, 160);
  assert.equal(read.inkSha256, inspectMonthlySignature(b).inkSha256);
  assert.equal(read.inkSha256, inspectMonthlySignature(padded).inkSha256);
  assert.equal(read.inkSha256, inspectMonthlySignature(signature({ colorType: 2 })).inkSha256);
  for (const filterType of [0, 1, 2, 3, 4]) assert.equal(read.inkSha256, inspectMonthlySignature(signature({ filterType })).inkSha256);
  const metadata = Buffer.concat([a.subarray(0, -12), chunk('tEXt', Buffer.from('Comment\0changed encoding')), a.subarray(-12)]);
  assert.equal(read.inkSha256, inspectMonthlySignature(metadata).inkSha256);
  assert.notEqual(read.inkSha256, inspectMonthlySignature(signature({ variant: 3 })).inkSha256);
});
test('blank, corrupt, truncated, animated, oversized and extra-trailing PNG data are rejected', () => {
  const a = signature(), crc = Buffer.from(a); crc[45] ^= 1;
  const huge = Buffer.from(a); huge.writeUInt32BE(100000, 16); huge.writeUInt32BE(pngCrc(huge.subarray(12, 29)), 29);
  const animated = Buffer.concat([a.subarray(0, 33), chunk('acTL', Buffer.alloc(8)), a.subarray(33)]);
  const highBitAlias = Buffer.from(a); highBitAlias[12] |= 128; highBitAlias.writeUInt32BE(pngCrc(highBitAlias.subarray(12, 29)), 29);
  const metadata = [chunk('pHYs', Buffer.from([0,0,0,1,0,0,0,1,2])), chunk('gAMA', Buffer.alloc(4)),
    chunk('tEXt', Buffer.from('Invalid  keyword\0text')), Buffer.concat([chunk('sRGB', Buffer.from([0])), chunk('sRGB', Buffer.from([0]))])]
    .map(data => Buffer.concat([a.subarray(0, 33), data, a.subarray(33)]));
  for (const bytes of [signature({ blank: true }), crc, a.subarray(0, -1), Buffer.concat([a, Buffer.from([0])]),
    Buffer.from('<svg/>'), Buffer.alloc(2 * 1024 * 1024 + 1), huge, animated, highBitAlias, ...metadata]) assert.throws(() => inspectMonthlySignature(bytes), /MONTHLY_SIGNATURE_PNG/);
});
test('visual PDF retains all descriptions, care workers and tasks across pages with an embedded font', async () => {
  const proof = fixture(); proof.payload.clientName = 'Erika Müller-Schönfeld';
  const template = proof.payload.records[0];
  proof.payload.records = Array.from({ length: 12 }, (_, i) => ({ ...structuredClone(template), recordId: randomUUID(),
    employeeName: i % 2 ? 'Gül Özdemir' : 'Jörg Schäfer', description: `LEISTUNG_${i} ` + 'Vollständige Unterstützung bei der Körperpflege. '.repeat(14),
    tasks: [{ id: randomUUID(), title: `AUFGABE_${i}`, status: 'done', completionNote: `HINWEIS_${i}` }] }));
  const input = { proof, captureId: randomUUID(), preparedAt: '2026-10-29T10:00:00Z' };
  const bytes = renderMonthlyOriginal(input); assert.deepEqual(renderMonthlyOriginal(input), bytes);
  const loading = getDocument({ data: new Uint8Array(bytes), isEvalSupported: false, useSystemFonts: false, disableFontFace: true, verbosity: 0 });
  try {
    const pdf = await loading.promise; assert.ok(pdf.numPages >= 3);
    let text = ''; for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n); text += (await page.getTextContent()).items.map(item => item.str).join(' ');
    }
    for (const name of ['Erika Müller-Schönfeld', 'Gül Özdemir', 'Jörg Schäfer', 'Noch nicht bestätigt', 'Erledigt']) assert.ok(text.includes(name), name);
    for (let i = 0; i < 12; i++) for (const key of ['LEISTUNG_', 'AUFGABE_', 'HINWEIS_']) assert.ok(text.includes(key + i), key + i);
    assert.ok(text.includes(proof.content_sha256)); assert.ok(text.includes(input.captureId));
  } finally { await loading.destroy(); }
  proof.payload.clientName = 'Name\u202e'; assert.throws(() => renderMonthlyOriginal(input), /UNSUPPORTED_TEXT/);
});

test('private original-byte verifier, persistent archive and PostgreSQL receipt consumption', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'gkv-monthly-originals-')), path = join(dir, 'originals.sqlite'), key = randomBytes(32);
  const db = new PGlite(), tenant = randomUUID(), foreign = randomUUID(), actorId = randomUUID(), otherActor = randomUUID(), employee = randomUUID();
  let store = new MonthlyOriginalStore({ path, key }), queue = Promise.resolve(), count = 0;
  const actor = async (overrides = {}) => {
    await db.exec('RESET ROLE');
    for (const [k, v] of Object.entries({ user: actorId, tenant, portal: 'business', permissions: 'office.invoices.view,office.invoices.create', ...overrides })) {
      await db.query('SELECT set_config($1,$2,false)', ['test.' + k, v]);
    }
    await db.exec('SET ROLE authenticated');
  };
  const admin = async (sql, args = []) => { await db.exec('RESET ROLE'); try { return await db.query(sql, args); } finally { await db.exec('SET ROLE authenticated'); } };
  // Serialize fixture identity setup together with its SQL query. PGlite does
  // not prove independent PostgreSQL connections or production worker credentials.
  const query = (sql, args) => { const result = queue.then(() => admin(sql, args)); queue = result.catch(() => {}); return result; };
  const database = monthlyOriginalDatabase(query);
  const worker = () => new MonthlyOriginalVerifier({ database, store });
  const command = async (action, input) => (await db.query('SELECT public.gkv_monthly_proof_command($1,$2,$3,$4::jsonb) v', [tenant, randomUUID(), action, JSON.stringify(input)])).rows[0].v;
  async function proof() {
    const client = randomUUID(), record = randomUUID(), original = randomUUID(), task = randomUUID();
    await admin("INSERT INTO clients VALUES($1,$2,'Fiktive','Person')", [client, tenant]);
    const receipt = { tenant_id: tenant, client_id: client, employee_id: employee, proof_id: original, proof_payload_hash: 'sha256:' + 'a'.repeat(64), visit_id: original };
    await admin("INSERT INTO service_records VALUES($1,$2,$3,$4,'2026-10-03T12:00Z','2026-10-03','approved',45,$5,true)", [record, tenant, client, employee, JSON.stringify(receipt)]);
    await admin('INSERT INTO assist_visit_proofs VALUES($1,$2,$1,$3,$4)', [original, tenant, receipt.proof_payload_hash, JSON.stringify({ documentationNote: 'Körperpflege vollständig durchgeführt.', tasks: [{ id: task, title: 'Unterstützung beim Waschen', status: 'done', note: 'Wie vereinbart' }] })]);
    const p = await command('create', { new_id: randomUUID(), client_id: client, month: '2026-10', service_type: '01', source_ids: [record] });
    return { p, input: { tenantId: tenant, proofId: p.id, revision: p.revision, captureId: randomUUID() } };
  }
  async function prepared() { const value = await proof(); value.original = await worker().prepare(value.input); return value; }
  async function ready() { const value = await prepared(); await worker().acknowledge(value.input, value.original.originalSha256); return value; }
  const receiptCount = async () => (await admin('SELECT count(*)::int n FROM care_security.gkv_monthly_confirmation_receipts')).rows[0].n;
  try {
    await db.exec(`CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role BYPASSRLS;
      CREATE SCHEMA auth; CREATE SCHEMA care_security;
      GRANT USAGE ON SCHEMA public,auth,care_security TO authenticated,anon,service_role;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.user',true),'')::uuid $$;
      CREATE FUNCTION care_security.gkv_exchange_actor(t uuid,p text) RETURNS boolean LANGUAGE sql STABLE AS $$
        SELECT coalesce(auth.uid() IS NOT NULL AND t::text=current_setting('test.tenant',true) AND current_setting('test.portal',true)='business'
          AND p=ANY(string_to_array(current_setting('test.permissions',true),',')),false) $$;
      CREATE TABLE tenants(id uuid PRIMARY KEY); CREATE TABLE clients(id uuid PRIMARY KEY,tenant_id uuid,first_name text,last_name text);
      CREATE TABLE employees(id uuid PRIMARY KEY,tenant_id uuid,first_name text,last_name text);
      CREATE TABLE service_records(id uuid PRIMARY KEY,tenant_id uuid,client_id uuid,employee_id uuid,updated_at timestamptz,service_date date,status text,actual_minutes integer,source_receipt jsonb,verified_fixture boolean);
      CREATE TABLE assist_visit_proofs(id uuid PRIMARY KEY,tenant_id uuid,visit_id uuid,payload_hash text,payload_snapshot jsonb);
      CREATE FUNCTION care_security.office_invoice_assert_source(s public.service_records,b boolean) RETURNS void LANGUAGE plpgsql AS $$
        BEGIN IF s.verified_fixture IS DISTINCT FROM true OR b IS DISTINCT FROM true THEN RAISE EXCEPTION 'Source verifier rejected'; END IF; END $$;`);
    await db.query('INSERT INTO tenants VALUES($1),($2)', [tenant, foreign]);
    await db.query("INSERT INTO employees VALUES($1,$2,'Test','Pflegekraft')", [employee, tenant]);
    for (const file of ['monthly-proofs-draft.sql', 'monthly-original-verifier-draft.sql','monthly-authorities-draft.sql']) await db.exec(await readFile(new URL('../../docs/gkv/sql/' + file, import.meta.url), 'utf8'));
    await db.query("INSERT INTO care_security.gkv_monthly_responsibilities VALUES($1,$2,now()+interval '1 day',NULL,$2,'Fiktive PDL-Beauftragung'),($1,$3,now()+interval '1 day',NULL,$2,'Fiktive Vertretung')", [tenant, actorId, otherActor]);
    await actor();
    await t.test('original bytes survive restart unchanged; archive contains no plaintext PDF or patient name', async () => {
      const value = await prepared(); assert.equal(value.original.acknowledged, false); assert.ok(value.original.bytes.subarray(0, 5).equals(Buffer.from('%PDF-')));
      assert.equal(value.original.originalSha256, hash(value.original.bytes));
      store.close(); store = new MonthlyOriginalStore({ path, key });
      const after = await worker().readOriginal(value.input); assert.deepEqual(after, value.original);
      assert.deepEqual(await worker().prepare(value.input), value.original);
      for (const file of [path, path + '-wal']) { const data = await readFile(file).catch(() => Buffer.alloc(0)); assert.equal(data.includes(Buffer.from('Fiktive Person')), false); assert.equal(data.includes(Buffer.from('%PDF-')), false); }
    });
    await t.test('acknowledgment must name the exact original; no receipt is issued for unread or blank capture', async () => {
      const value = await prepared(), before = await receiptCount();
      await assert.rejects(worker().verify(value.input, signature()), /ACKNOWLEDGMENT/);
      await assert.rejects(worker().acknowledge(value.input, 'a'.repeat(64)), /ACKNOWLEDGMENT/);
      await worker().acknowledge(value.input, value.original.originalSha256);
      await assert.rejects(worker().verify(value.input, signature({ blank: true })), /SIGNATURE_PNG/);
      assert.equal(await receiptCount(), before);
    });
    await t.test('actual stored PDF and PNG issue a private receipt consumed by the existing confirmation command', async () => {
      const value = await ready(), bytes = signature({ variant: ++count });
      const receipt = await worker().verify(value.input, bytes), stored = store.get(tenant, value.input.captureId);
      assert.equal(receipt.originalSha256, hash(stored.original)); assert.equal(receipt.signatureSha256, hash(stored.signature));
      assert.deepEqual(stored.signature, bytes); assert.equal(receipt.actorId, actorId);
      const final = readMonthlyProof(await command('confirm', { id: value.p.id, revision: value.p.revision, content_sha256: value.p.content_sha256, receipt_id: receipt.receiptId }), tenant);
      assert.equal(final.status, 'final'); assert.equal(final.confirmation.receiptId, receipt.receiptId); assert.equal(final.confirmation.originalSha256, hash(stored.original));
      await assert.rejects(worker().verify(value.input, bytes), e => e.code === '40001');
      const archived = { tenantId: tenant, proofId: value.p.id, captureId: value.input.captureId };
      assert.equal((await worker().readArchivedOriginal(archived)).status, 'final');
      const successor = await command('correct', { id: final.id, revision: final.revision, new_id: randomUUID(), reason: 'Fachliche Berichtigung mit neuer Bestätigung' });
      const next = { tenantId: tenant, proofId: successor.id, revision: successor.revision, captureId: randomUUID() };
      const original = await worker().prepare(next); await worker().acknowledge(next, original.originalSha256);
      await assert.rejects(worker().verify(next, bytes), /SIGNATURE_REUSED/);
      const fresh = await worker().verify(next, signature({ variant: ++count }));
      assert.notEqual(fresh.contentSha256, receipt.contentSha256);
      const corrected = await command('confirm', { id: successor.id, revision: successor.revision, content_sha256: successor.content_sha256, receipt_id: fresh.receiptId });
      assert.equal(corrected.status, 'final'); assert.equal(corrected.version, 2);
      await actor({ user: otherActor, permissions: 'office.invoices.view' });
      const old = await worker().readArchivedOriginal(archived); assert.equal(old.status, 'invalidated'); assert.deepEqual(old.bytes, value.original.bytes);
      assert.equal(Object.hasOwn(old, 'signatureBytes'), false);
      await assert.rejects(worker().readArchivedOriginal({ ...archived, captureId: next.captureId }), /ARCHIVE_BINDING/);
      await actor({ permissions: '' }); await assert.rejects(worker().readArchivedOriginal(archived), e => e.code === '42501');
      await actor();
    });
    await t.test('raw or re-encoded signature reuse fails across captures and independent worker archives', async () => {
      const first = await ready(), bytes = signature({ variant: ++count }); await worker().verify(first.input, bytes);
      const second = await ready(), reencoded = signature({ variant: count, filterType: 0, deflateLevel: 1, margin: 8 });
      await assert.rejects(worker().verify(second.input, reencoded), /SIGNATURE_REUSED/);
      const other = new MonthlyOriginalStore({ path: join(dir, 'independent.sqlite'), key });
      try {
        const isolated = new MonthlyOriginalVerifier({ database, store: other }); const original = await isolated.prepare(second.input);
        await isolated.acknowledge(second.input, original.originalSha256);
        await assert.rejects(isolated.verify(second.input, reencoded), e => e.code === '23505');
      } finally { other.close(); }
    });
    await t.test('capture is bound to tenant, personal actor, proof and current source revision', async () => {
      const value = await ready();
      await actor({ user: otherActor }); await assert.rejects(worker().readOriginal(value.input), /CONTEXT_CHANGED/); await actor();
      await actor({ tenant: foreign }); await assert.rejects(worker().readOriginal(value.input), e => e.code === '42501'); await actor();
      const other = await proof(); await assert.rejects(worker().readOriginal({ ...value.input, proofId: other.p.id }), /CONTEXT_CHANGED/);
      await command('replace_sources', { id: value.p.id, revision: value.p.revision, source_ids: value.p.payload.records.map(r => r.recordId), reason: 'Erneuter fachlicher Abgleich' });
      await assert.rejects(worker().verify(value.input, signature({ variant: ++count })), e => e.code === '40001');
    });
    await t.test('portal, revoked delegation and changed canonical descriptions fail before receipt issuance', async () => {
      const value = await ready(), before = await receiptCount();
      await actor({ portal: 'client' }); await assert.rejects(worker().verify(value.input, signature()), e => e.code === '42501'); await actor();
      await admin('UPDATE care_security.gkv_monthly_responsibilities SET revoked_at=now() WHERE actor_id=$1', [actorId]);
      await assert.rejects(worker().readOriginal(value.input), e => e.code === '42501');
      await admin('UPDATE care_security.gkv_monthly_responsibilities SET revoked_at=NULL WHERE actor_id=$1', [actorId]);
      await admin("UPDATE assist_visit_proofs SET payload_snapshot=jsonb_set(payload_snapshot,'{documentationNote}',to_jsonb('Geänderter Originaltext'::text)) WHERE id=$1", [value.p.payload.records[0].sourceReceipt.proof_id]);
      await assert.rejects(worker().verify(value.input, signature()), e => e.code === '40001'); assert.equal(await receiptCount(), before);
    });
    await t.test('expired or future capture context is rejected without replacing the original', async () => {
      const value = await ready(), real = await database.context(value.input);
      for (const offset of [-3_600_000, 3_600_000]) {
        const altered = new MonthlyOriginalVerifier({ store, database: { ...database, context: async () => ({ ...real, checkedAt: new Date(Date.parse(real.checkedAt) + offset).toISOString() }) } });
        await assert.rejects(altered.readOriginal(value.input), /CONTEXT|EXPIRED/);
      }
      assert.equal((await worker().readOriginal(value.input)).originalSha256, value.original.originalSha256);
    });
    await t.test('lost or misbound database response retains the same receipt and never automatically retries', async () => {
      const value = await ready(), bytes = signature({ variant: ++count }), before = await receiptCount(); let calls = 0;
      const uncertain = new MonthlyOriginalVerifier({ store, database: { ...database, issue: async r => { calls++; await database.issue(r); throw Error('lost response'); } } });
      await assert.rejects(uncertain.verify(value.input, bytes), /lost response/); assert.equal(calls, 1);
      const id = store.get(tenant, value.input.captureId).receipt.id; assert.equal(await receiptCount(), before + 1);
      store.close(); store = new MonthlyOriginalStore({ path, key });
      const wrong = new MonthlyOriginalVerifier({ store, database: { ...database, issue: async r => ({ ...await database.issue(r), receiptId: randomUUID() }) } });
      await assert.rejects(wrong.verify(value.input, bytes), /VERIFIER_RECEIPT/);
      assert.equal((await worker().verify(value.input, bytes)).receiptId, id); assert.equal(await receiptCount(), before + 1);
      await assert.rejects(worker().verify(value.input, signature({ variant: ++count })), /CAPTURE_CONFLICT/);
    });
    await t.test('parallel duplicate capture verification shares one immutable receipt', async () => {
      const value = await ready(), bytes = signature({ variant: ++count }), before = await receiptCount();
      const [a, b] = await Promise.all([worker().verify(value.input, bytes), worker().verify(value.input, bytes)]);
      assert.deepEqual(a, b); assert.equal(await receiptCount(), before + 1);
    });
    await t.test('caller mutation during a database wait cannot replace the retained signature bytes', async () => {
      const value = await ready(), bytes = signature({ variant: ++count }), expectedHash = hash(bytes);
      let release, first = true; const gate = new Promise(resolve => { release = resolve; });
      const waiting = new MonthlyOriginalVerifier({ store, database: { ...database, context: async input => {
        if (first) { first = false; await gate; } return database.context(input);
      } } });
      const result = waiting.verify(value.input, bytes); bytes.fill(0); release();
      assert.equal((await result).signatureSha256, expectedHash);
    });
    await t.test('a changed source in the final database transaction prevents receipt creation', async () => {
      const value = await ready(), before = await receiptCount();
      const changed = new MonthlyOriginalVerifier({ store, database: { ...database, issue: async r => {
        await admin('UPDATE service_records SET actual_minutes=actual_minutes+1 WHERE id=$1', [value.p.payload.records[0].recordId]); return database.issue(r);
      } } });
      await assert.rejects(changed.verify(value.input, signature({ variant: ++count })), e => e.code === '40001');
      assert.equal(await receiptCount(), before);
    });
    await t.test('changes after byte verification are checked again inside the receipt transaction', async () => {
      const value = await ready(), before = await receiptCount();
      const revoked = new MonthlyOriginalVerifier({ store, database: { ...database, issue: async r => {
        await admin('UPDATE care_security.gkv_monthly_responsibilities SET revoked_at=now() WHERE actor_id=$1', [actorId]); return database.issue(r);
      } } });
      await assert.rejects(revoked.verify(value.input, signature({ variant: ++count })), e => e.code === '42501');
      await admin('UPDATE care_security.gkv_monthly_responsibilities SET revoked_at=NULL WHERE actor_id=$1', [actorId]); assert.equal(await receiptCount(), before);
    });
    await t.test('browser roles cannot read/issue private receipts, including service_role with RLS bypass', async () => {
      const value = await ready();
      for (const role of ['authenticated','anon','service_role']) {
        await db.exec('RESET ROLE; SET ROLE ' + role);
        await assert.rejects(db.query('SELECT care_security.gkv_monthly_verifier_context($1,$2,$3)', [tenant,value.p.id,1]), e => e.code === '42501');
        await assert.rejects(db.query("SELECT care_security.gkv_monthly_accept_verified_receipt('{}')"), e => e.code === '42501');
        await assert.rejects(db.query('SELECT care_security.gkv_monthly_original_read_context($1,$2)', [tenant,value.p.id]), e => e.code === '42501');
        await assert.rejects(db.query('SELECT * FROM care_security.gkv_monthly_confirmation_receipts'), e => e.code === '42501');
      }
      await actor();
      const functions = (await admin("SELECT n.nspname,p.prosecdef,p.proconfig,has_function_privilege('authenticated',p.oid,'EXECUTE') browser FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.proname IN ('gkv_monthly_verifier_context','gkv_monthly_accept_verified_receipt','gkv_monthly_original_read_context')")).rows;
      assert.equal(functions.length, 3);
      for (const f of functions) { assert.equal(f.nspname, 'care_security'); assert.equal(f.prosecdef, true); assert.equal(f.browser, false); assert.deepEqual(f.proconfig, ['search_path=pg_catalog']); }
    });
    await t.test('even the private issuer rejects spoofed signer/actor, changed hashes, paths and future dates', async () => {
      const value = await ready(), bytes = signature({ variant: ++count }); await worker().verify(value.input, bytes);
      const receipt = store.get(tenant, value.input.captureId).receipt, before = await receiptCount();
      for (const patch of [{ actor_id: otherActor }, { signer_name: 'Fremde Person' }, { signer_role: 'representative', authority_reference: 'Ungeprüfte Vollmacht' },
        { content_sha256: 'b'.repeat(64) }, { original_path: 'tenant/foreign/original.pdf' }, { captured_at: '2099-01-01T00:00:00Z', verified_at: '2099-01-01T00:00:01Z' },
        { consumed_at: null }, { proof_revision: true }, { original_version: '-'.repeat(36) }]) await assert.rejects(database.issue({ ...receipt, id: randomUUID(), ...patch }));
      assert.equal(await receiptCount(), before);
    });
    await t.test('tampered encrypted bytes and a wrong vault key cannot produce an original or receipt', async () => {
      const value = await prepared(); const raw = new DatabaseSync(path);
      try { raw.prepare('UPDATE monthly_originals SET original=randomblob(length(original)) WHERE tenant=? AND capture=?').run(tenant, value.input.captureId); } finally { raw.close(); }
      await assert.rejects(worker().readOriginal(value.input), /STORE_/);
      const wrong = new MonthlyOriginalStore({ path, key: randomBytes(32) });
      try { assert.throws(() => wrong.get(tenant, value.input.captureId), /STORE_/); } finally { wrong.close(); }
    });
    await t.test('quota and unknown capture inputs fail without a partially stored original', async () => {
      const limited = new MonthlyOriginalStore({ path: join(dir, 'limited.sqlite'), key, maxTenantBytes: 1024 });
      try {
        const value = await proof(), service = new MonthlyOriginalVerifier({ database, store: limited });
        await assert.rejects(service.prepare(value.input), /STORE_QUOTA/); assert.equal(limited.get(tenant, value.input.captureId), null);
        await assert.rejects(service.prepare({ ...value.input, signerRole: 'representative' }), /VERIFIER_REQUEST/);
      } finally { limited.close(); }
      // Existing encrypted receipts count toward later writes as well. A limit
      // equal to retained BLOB bytes permits reads, but cannot add an original.
      const cappedPath = join(dir, 'capped.sqlite');
      let capped = new MonthlyOriginalStore({ path: cappedPath, key });
      try {
        const value = await proof(); let service = new MonthlyOriginalVerifier({ database, store: capped });
        const original = await service.prepare(value.input); await service.acknowledge(value.input, original.originalSha256);
        const issued = await service.verify(value.input, signature({ variant: ++count }));
        const pending = await proof(), pendingOriginal = await service.prepare(pending.input);
        const raw = new DatabaseSync(cappedPath);
        let retained; try {
          retained = raw.prepare('SELECT sum(length(original)+length(snapshot)+coalesce(length(acknowledgment),0)+coalesce(length(signature),0)+coalesce(length(receipt),0)) n FROM monthly_originals').get().n;
        } finally { raw.close(); }
        capped.close(); capped = new MonthlyOriginalStore({ path: cappedPath, key, maxTenantBytes: retained });
        service = new MonthlyOriginalVerifier({ database, store: capped });
        assert.equal((await service.readOriginal(value.input)).originalSha256, original.originalSha256);
        assert.equal((await service.verify(value.input, signature({ variant: count }))).receiptId, issued.receiptId);
        await assert.rejects(service.acknowledge(pending.input, pendingOriginal.originalSha256), /STORE_QUOTA/);
        assert.equal(capped.get(tenant, pending.input.captureId).acknowledgedAt, null);
        const next = await proof(); await assert.rejects(service.prepare(next.input), /STORE_QUOTA/);
        assert.equal(capped.get(tenant, next.input.captureId), null);
        assert.equal(capped.get(tenant, value.input.captureId).receipt.id, issued.receiptId);
      } finally { capped.close(); }
    });
  } finally { store.close(); await db.close(); await rm(dir, { recursive: true, force: true }); }
});
