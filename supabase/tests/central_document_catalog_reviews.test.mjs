import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, test } from 'node:test';

const db = new PGlite();
after(() => db.close());

const migration = (name) => readFileSync(new URL(`../migrations/${name}.sql`, import.meta.url), 'utf8');
const owner = 'c2763da2-702d-4e48-9ace-608d550d1b4a';
const tenantUser = '3659a712-a472-4195-a4cb-8db28533ccf1';
const tenantId = 'ba54fe4a-3ce3-4772-85c0-42401bd93506';
const documentId = '02150b87-205e-4fa6-b947-c4d4b05249de';
const reviewId = 'e8de7187-dc69-4777-ba03-25d19760f199';
const formerReviewId = '3ebba525-3fbb-4d56-aaa9-db24e94a56bb';
const versionTwoReviewId = '8f4ee124-18ec-4797-b0ae-f27395445f81';
const query = async (sql, params = []) => (await db.query(sql, params)).rows;

await db.exec(`
  CREATE ROLE anon;
  CREATE ROLE authenticated;
  CREATE ROLE service_role BYPASSRLS;
  CREATE SCHEMA auth;
  CREATE SCHEMA storage;
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
    SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  $$;
  GRANT USAGE ON SCHEMA auth TO authenticated, anon, service_role;
  CREATE FUNCTION public.current_tenant_id() RETURNS uuid LANGUAGE sql STABLE AS $$
    SELECT '${tenantId}'::uuid;
  $$;
  CREATE FUNCTION public.has_permission(text) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT true; $$;
  CREATE FUNCTION public.platform_current_role() RETURNS text LANGUAGE sql STABLE AS $$
    SELECT CASE WHEN auth.uid() = '${owner}'::uuid THEN 'platform_owner' END;
  $$;
  CREATE FUNCTION public.platform_assert_capability(text) RETURNS void LANGUAGE plpgsql AS $$
  BEGIN
    IF public.platform_current_role() IS DISTINCT FROM 'platform_owner' THEN
      RAISE EXCEPTION 'platform_forbidden' USING ERRCODE = '42501';
    END IF;
  END;
  $$;
  CREATE TABLE public.tenants (id uuid PRIMARY KEY);
  CREATE TABLE public.profiles (id uuid PRIMARY KEY, tenant_id uuid);
  CREATE TABLE public.clients (id uuid PRIMARY KEY, tenant_id uuid);
  CREATE TABLE public.employees (id uuid PRIMARY KEY, tenant_id uuid);
  CREATE TABLE public.client_documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid, client_id uuid, title text,
    file_name text, storage_path text, status text, mime_type text, category text, sensitivity text, uploaded_by uuid
  );
  CREATE TABLE public.employee_documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid, employee_id uuid, title text,
    file_name text, storage_path text, category text, sensitive boolean, released_to_portal boolean
  );
  CREATE TABLE public.generated_documents (
    id uuid PRIMARY KEY, tenant_id uuid, title text, document_type text, status text, client_id uuid, employee_id uuid,
    template_version integer, document_number text, file_name text, generated_content_json jsonb, autofill_snapshot_json jsonb,
    pdf_path text, created_by uuid
  );
  CREATE TABLE storage.buckets (id text, public boolean);
  CREATE TABLE storage.objects (bucket_id text, name text);
  CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$ SELECT string_to_array($1,'/'); $$;
  INSERT INTO storage.buckets VALUES ('office-documents', false);
  INSERT INTO public.tenants VALUES ('${tenantId}');
  INSERT INTO public.profiles VALUES ('${tenantUser}', '${tenantId}');
  GRANT SELECT ON public.profiles, public.clients, public.employees TO service_role;
  GRANT INSERT ON public.generated_documents, public.client_documents, public.employee_documents TO service_role;
`);

const initialSeed = migration('20261013080727_central_document_catalog_seed');
const completeSeed = migration('20261013081943_central_document_catalog_seed_complete');
await db.exec(migration('20261013080703_central_document_catalog'));
await db.exec(initialSeed);
await db.exec(completeSeed);
await db.exec(migration('20261117080000_central_document_catalog_reviews'));

const exampleKey = 'test_company_protocol';
const historySql = 'SELECT public.platform_get_central_document_catalog_reviews($1, $2) AS history';
const recordSql = 'SELECT public.platform_record_central_document_catalog_review($1,$2,$3,$4,$5,$6,$7,$8,$9) AS review';
const asRole = async (role, actor, run) => {
  await db.exec(`SET ROLE ${role}`);
  try {
    await query("SELECT set_config('request.jwt.claim.sub', $1, false)", [actor]);
    return await run();
  } finally {
    await db.exec('RESET ROLE');
  }
};

await query(`INSERT INTO public.central_document_catalog (template_key,version,title,category_key,target,source_mode,definition_json)
  VALUES ($1,1,'Testprotokoll','einsatz','company','create',$2),($1,2,'Testprotokoll','einsatz','company','create',$3)`, [
  exampleKey,
  { key: exampleKey, version: 1, fields: [] },
  { key: exampleKey, version: 2, fields: [], layout: 'form' },
]);

test('existing seed replays and new versions still insert while template edits fail', async () => {
  await db.exec(initialSeed);
  await db.exec(completeSeed);
  assert.equal((await query('SELECT count(*)::int AS count FROM public.central_document_catalog WHERE template_key <> $1', [exampleKey]))[0].count, 450);
  await query('UPDATE public.central_document_catalog SET title=title WHERE template_key=$1', [exampleKey]);
  await asRole('service_role', '', async () => {
    await assert.rejects(query("UPDATE public.central_document_catalog SET title='Geänderter Titel' WHERE template_key=$1", [exampleKey]), { code: '55000' });
    await assert.rejects(query("UPDATE public.central_document_catalog SET review_status='approved' WHERE template_key=$1", [exampleKey]), { code: '55000' });
    await assert.rejects(query('DELETE FROM public.central_document_catalog WHERE template_key=$1', [exampleKey]), { code: '55000' });
  });
  await assert.rejects(db.exec('TRUNCATE public.central_document_catalog CASCADE'), { code: '55000' });
});

test('new catalog versions record attributable history without inventing authors for existing versions', async () => {
  const existingTemplate = (await query('SELECT template_key, version FROM public.central_document_catalog WHERE template_key <> $1 LIMIT 1', [exampleKey]))[0];
  await asRole('service_role', tenantUser, async () => {
    await query(`INSERT INTO public.central_document_catalog (template_key,version,title,category_key,target,source_mode,definition_json)
      VALUES ($1,3,'Testprotokoll','einsatz','company','create',$2)`, [exampleKey, { key: exampleKey, version: 3, fields: [] }]);
    await assert.rejects(query('SELECT * FROM public.central_document_catalog_version_history'), { code: '42501' });
  });
  await asRole('authenticated', owner, async () => {
    const baseline = (await query(historySql, [existingTemplate.template_key, existingTemplate.version]))[0].history;
    assert.ok(baseline.created_at);
    assert.equal(baseline.version_event, null);

    const created = (await query(historySql, [exampleKey, 3]))[0].history;
    assert.equal(created.version_event.definition_hash, created.definition_hash);
    assert.equal(created.version_event.prior_version, 2);
    assert.equal(created.version_event.recorded_actor, null);
    assert.equal(created.version_event.database_publisher, 'service_role');
    assert.ok(created.version_event.recorded_at);

    const original = (await query(historySql, [exampleKey, 1]))[0].history;
    assert.equal(original.version_event.prior_version, null);
    assert.equal(original.version_event.recorded_actor, null);
    assert.ok(original.version_event.database_publisher);
  });
  await assert.rejects(query('DELETE FROM public.central_document_catalog_version_history WHERE template_key=$1', [exampleKey]), { code: '55000' });
});

test('only platform authority can record and inspect evidence tied to the exact template version', async () => {
  const review = [reviewId, exampleKey, 1, '0'.repeat(64), 'design', 'passed', 'A4 Hochformat', 'Druckbild geprüft', ['Druckprobe 17.11.2026']];
  await asRole('anon', '', () => assert.rejects(query(historySql, [exampleKey, 1]), { code: '42501' }));
  await asRole('authenticated', tenantUser, async () => {
    await assert.rejects(query(historySql, [exampleKey, 1]), { code: '42501' });
    await assert.rejects(query(recordSql, review), { code: '42501' });
    await assert.rejects(query('SELECT * FROM public.central_document_catalog_reviews'), { code: '42501' });
    assert.equal((await query('SELECT template_key FROM public.central_document_catalog WHERE template_key=$1 AND version <= 2', [exampleKey])).length, 2);
  });
  await asRole('service_role', '', () => assert.rejects(query('SELECT * FROM public.central_document_catalog_reviews'), { code: '42501' }));

  await asRole('authenticated', owner, async () => {
    const history = (await query(historySql, [exampleKey, 1]))[0].history;
    assert.match(history.definition_hash, /^[a-f0-9]{64}$/);
    assert.deepEqual(history.reviews, []);
    await assert.rejects(query(recordSql, review), { code: '22023' });
    review[3] = history.definition_hash;
    await assert.rejects(query(recordSql, [...review.slice(0, 8), []]), { code: '22023' });

    const saved = (await query(recordSql, review))[0].review;
    assert.equal(saved.recorded_by, owner);
    assert.equal(saved.recorder_platform_role, 'platform_owner');
    assert.ok(saved.recorded_at);
    assert.deepEqual((await query(recordSql, review))[0].review, saved);
    await assert.rejects(query(recordSql, [...review.slice(0, 7), 'Neue Begründung', review[8]]), { code: '23505' });

    const retracted = [...review];
    retracted[0] = formerReviewId;
    retracted[5] = 'withdrawn';
    retracted[7] = 'Erneute Prüfung erforderlich';
    await query(recordSql, retracted);
    const reviews = (await query(historySql, [exampleKey, 1]))[0].history.reviews;
    assert.deepEqual(reviews.map(({ decision }) => decision), ['withdrawn', 'passed']);
    assert.deepEqual((await query(historySql, [exampleKey, 2]))[0].history.reviews, []);
  });

  await assert.rejects(query('DELETE FROM public.central_document_catalog_reviews WHERE id=$1', [reviewId]), { code: '55000' });
  await assert.rejects(query("UPDATE public.central_document_catalog_reviews SET reason='Manipuliert' WHERE id=$1", [reviewId]), { code: '55000' });
});

test('a documented review leaves the existing document registration in draft', async () => {
  await asRole('authenticated', owner, async () => {
    const { definition_hash: hash } = (await query(historySql, [exampleKey, 2]))[0].history;
    await query(recordSql, [versionTwoReviewId, exampleKey, 2, hash, 'legal', 'passed', 'Testfall', 'Prüfvermerk erfasst', ['Beispielbeleg 1']]);
  });
  const definition = (await query(`SELECT definition_json FROM public.central_document_catalog
    WHERE template_key=$1 AND version=2 AND review_status='draft'`, [exampleKey]))[0].definition_json;
  const snapshot = { documentId, definition, revision: 1, context: { tenantId, entityId: tenantId, target: 'company' }, values: {} };
  const pdfPath = `tenant/${tenantId}/central-documents/${documentId}/draft.pdf`;
  const hash = '0'.repeat(64);
  const result = await asRole('service_role', '', () => query('SELECT public.register_central_document($1,$2,$3,$4,$5) AS record', [
    snapshot, tenantUser, pdfPath, hash, hash,
  ]));
  assert.equal(result[0].record.state, 'draft');
  assert.equal(result[0].record.template_version, 2);
});

test('content review appends exactly the current catalog revisions and safely retries', async () => {
  const contentReview = migration('20261117094500_central_catalog_content_review');
  const countVersions = async () => (await query(`SELECT count(*)::int AS count
    FROM public.central_document_catalog WHERE template_key <> $1`, [exampleKey]))[0].count;
  const beforeEdition = await countVersions();
  await assert.rejects(db.exec(contentReview), /weicht von der geprüften Ausgangsversion ab/);
  await db.exec('ROLLBACK');
  assert.equal(await countVersions(), beforeEdition);

  // The 2027 migration also sets up a separate intake registry. Reuse its catalog seed.
  const edition = migration('20261021060408_client_contracts_consents_prepared_2027');
  const editionStart = edition.indexOf('\nINSERT INTO public.central_document_catalog(');
  const editionEnd = edition.lastIndexOf('\nCOMMIT;');
  assert.ok(editionStart >= 0 && editionEnd > editionStart);
  await db.exec(edition.slice(editionStart, editionEnd));
  const original = (await query(`SELECT definition_json FROM public.central_document_catalog
    WHERE template_key = 'csdc_aufnahme_002' AND version = 1`))[0].definition_json;
  const beforeReview = await countVersions();
  await db.exec(contentReview);
  assert.equal(await countVersions(), beforeReview + 115);
  assert.deepEqual((await query(`SELECT definition_json FROM public.central_document_catalog
    WHERE template_key = 'csdc_aufnahme_002' AND version = 1`))[0].definition_json, original);

  const expectedSeed = readFileSync(new URL('../schema/central_document_catalog_seed.sql', import.meta.url), 'utf8');
  const catalogInsert = 'INSERT INTO public.central_document_catalog(';
  assert.ok(expectedSeed.includes(catalogInsert));
  await db.exec('CREATE TEMP TABLE expected_catalog_seed (LIKE public.central_document_catalog INCLUDING ALL)');
  await db.exec(expectedSeed.replace(catalogInsert, 'INSERT INTO expected_catalog_seed('));
  const latest = await query(`SELECT DISTINCT ON (template_key) template_key, version, title,
    category_key, target, source_mode, review_status, definition_json
    FROM public.central_document_catalog WHERE template_key <> $1 ORDER BY template_key, version DESC`, [exampleKey]);
  const expected = await query(`SELECT template_key, version, title, category_key, target, source_mode,
    review_status, definition_json FROM expected_catalog_seed ORDER BY template_key`);
  assert.equal(latest.length, 450);
  assert.deepEqual(latest, expected);
  assert.ok(latest.every(row => row.review_status === 'draft'));
  const event = (await query(`SELECT prior_version FROM public.central_document_catalog_version_history
    WHERE template_key = 'csdc_aufnahme_002' AND template_version = 2`))[0];
  assert.equal(event.prior_version, 1);

  await db.exec(contentReview);
  assert.equal(await countVersions(), beforeReview + 115);
  await db.exec('DROP TABLE expected_catalog_seed');
});
