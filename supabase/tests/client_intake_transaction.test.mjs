// Synthetic local contract tests. Reconstructed after the workspace reset from
// the previously passing 22-test suite; not a byte-identical recovery.
// Schema metadata retains real NOT NULL, CHECK, UNIQUE and FK definitions.
// Auth/session helpers are explicit local stubs, not an Auth/Edge E2E proof.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const { PGlite } = require('@electric-sql/pglite');
const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const catalogue = JSON.parse(read('../../docs/client-intake-schema-metadata-20261014.json'));
const quote = (value) => "'" + String(value).replaceAll("'", "''") + "'";
const identifier = (value) => '"' + value.replaceAll('"', '""') + '"';
const id = {
  tenant: '10000000-0000-4000-8000-000000000001', otherTenant: '10000000-0000-4000-8000-000000000002',
  auth: '20000000-0000-4000-8000-000000000001', otherAuth: '20000000-0000-4000-8000-000000000002',
  profile: '30000000-0000-4000-8000-000000000001', otherProfile: '30000000-0000-4000-8000-000000000002',
  role: '40000000-0000-4000-8000-000000000001',
  client: '50000000-0000-4000-8000-000000000001', otherClient: '50000000-0000-4000-8000-000000000002',
  privacy: '60000000-0000-4000-8000-000000000001', contract: '60000000-0000-4000-8000-000000000002',
  operation: '70000000-0000-4000-8000-000000000001', nextOperation: '70000000-0000-4000-8000-000000000002',
};
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB';
const sourceTables = [...new Set(catalogue.columns.map((column) => column.table_name))];

async function createFixture() {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE SCHEMA care_security;
    GRANT USAGE ON SCHEMA care_security TO authenticated;
    CREATE FUNCTION care_security.fixture_existing_capability() RETURNS boolean LANGUAGE sql AS 'SELECT true';
    GRANT EXECUTE ON FUNCTION care_security.fixture_existing_capability() TO authenticated;
    CREATE TABLE public.service_records(id uuid PRIMARY KEY);
    CREATE TABLE public.document_templates(id uuid PRIMARY KEY);
    CREATE TABLE public.document_template_versions(id uuid PRIMARY KEY);
    CREATE TABLE public.employees(id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS
      'SELECT nullif(current_setting(''fixture.auth'',true),'''')::uuid';
    CREATE FUNCTION public.current_tenant_id() RETURNS uuid LANGUAGE sql AS
      'SELECT nullif(current_setting(''fixture.tenant'',true),'''')::uuid';
    CREATE FUNCTION public.current_role_key() RETURNS text LANGUAGE sql AS
      'SELECT current_setting(''fixture.role'',true)';
    CREATE FUNCTION public.current_portal_type() RETURNS text LANGUAGE sql AS
      'SELECT CASE WHEN public.current_role_key()=''client_portal'' THEN ''client'' ELSE ''business'' END';
    CREATE FUNCTION public.resolve_current_profile_id() RETURNS uuid LANGUAGE sql AS
      'SELECT nullif(current_setting(''fixture.profile'',true),'''')::uuid';
    CREATE FUNCTION public.is_internal_tenant_actor(uuid) RETURNS boolean LANGUAGE sql AS
      'SELECT public.current_role_key() IN (''business_admin'',''office_staff'') AND $1=public.current_tenant_id()';
    CREATE FUNCTION public.has_permission(text) RETURNS boolean LANGUAGE sql AS
      'SELECT public.current_role_key() IN (''business_admin'',''office_staff'') AND $1 IS DISTINCT FROM current_setting(''fixture.denied'',true) AND $1 IN (''office.clients.create'',''office.clients.edit'',''office.clients.view'',''office.clients.view_sensitive'',''office.clients.delete'',''office.appointments.view'',''office.appointments.edit'')';
    CREATE FUNCTION public.is_tenant_admin() RETURNS boolean LANGUAGE sql AS
      'SELECT public.current_role_key()=''business_admin''';
    GRANT USAGE ON SCHEMA public,auth TO authenticated,anon,service_role;
  `);
  const enums = new Map();
  for (const row of catalogue.enums) {
    const labels = enums.get(row.name) ?? [];
    labels.push(row.label); enums.set(row.name, labels);
  }
  for (const [name, labels] of enums) await db.exec('CREATE TYPE public.' + identifier(name) + ' AS ENUM (' + labels.map(quote).join(',') + ')');
  for (const table of sourceTables) {
    const definitions = catalogue.columns.filter((column) => column.table_name === table).map((column) =>
      identifier(column.column_name) + ' ' + (column.udt_name.startsWith('_') ? column.udt_name.slice(1) + '[]' : column.udt_name)
      + (column.column_default ? ' DEFAULT ' + column.column_default : '') + (column.is_nullable === 'NO' ? ' NOT NULL' : ''));
    await db.exec('CREATE TABLE public.' + identifier(table) + '(' + definitions.join(',') + ')');
  }
  const constraints = new Map();
  for (const row of catalogue.constraints) if (sourceTables.includes(row.table)) constraints.set(row.table + '.' + row.name, row);
  for (const foreign of [false, true]) for (const row of constraints.values()) {
    if (row.definition.startsWith('FOREIGN KEY') === foreign) await db.exec('ALTER TABLE public.' + identifier(row.table)
      + ' ADD CONSTRAINT ' + identifier(row.name) + ' ' + row.definition);
  }
  // Preserve the real partial uniqueness used by budget account/ledger writes.
  const indexedTables = new Set(['tenant_budget_years', 'client_care_entitlement', 'client_budget_accounts',
    'budget_template_catalog', 'client_billing_audit_log', 'client_budget_transactions',
    'tenant_service_intake_sections', 'tenant_client_portal_defaults', 'tenant_service_type_budget_rules']);
  for (const index of catalogue.indexes ?? []) if (indexedTables.has(index.table) && !constraints.has(index.table + '.' + index.name)) await db.exec(index.definition);
  for (const [path, pattern] of [
    ['../migrations/0246_platform_console_foundation_live.sql', /CREATE TABLE IF NOT EXISTS public\.platform_tenants \([\s\S]*?\n\);/],
    ['../migrations/20261007112708_platform_tenant_access_controls.sql', /CREATE TABLE public\.platform_account_access_states \([\s\S]*?\n\);/],
  ]) {
    const definition = read(path).match(pattern)?.[0];
    assert.ok(definition, 'Original platform schema must exist: ' + path);
    await db.exec(definition);
  }
  // Deliberately permissive baseline: the reviewed transaction must enforce
  // its own ceilings even where pre-existing tenant write policies allow CRUD.
  for (const table of sourceTables) await db.exec('GRANT SELECT,INSERT,UPDATE,DELETE ON public.' + identifier(table) + ' TO authenticated,service_role;'
    + 'ALTER TABLE public.' + identifier(table) + ' ENABLE ROW LEVEL SECURITY;'
    + 'CREATE POLICY fixture_tenant_policy ON public.' + identifier(table) + ' FOR ALL TO authenticated USING(true) WITH CHECK(true);');
  const seedDefinition = read('../migrations/0159_client_core_service_budget_portal_settings.sql')
    .match(/CREATE OR REPLACE FUNCTION public\.seed_tenant_client_core_templates\(p_tenant_id UUID\)[\s\S]*?\n\$\$;/)?.[0];
  assert.ok(seedDefinition, 'The original tenant seed function must exist');
  await db.exec(seedDefinition);
  await db.exec(read('../migrations/20261014225620_client_intake_server_completion_v1.sql'));
  const calendarTable = read('../migrations/0117_calendar_events.sql').match(/CREATE TABLE IF NOT EXISTS public\.calendar_events \([\s\S]*?\n\);/)[0];
  await db.exec(calendarTable);
  await db.exec('ALTER TABLE public.calendar_events ADD CONSTRAINT calendar_events_source_unique UNIQUE(tenant_id,source_type,source_id)');
  await db.exec(read('../migrations/0117_calendar_events.sql').match(/ALTER TABLE public\.calendar_events ENABLE ROW LEVEL SECURITY;[\s\S]*?GRANT SELECT, INSERT, UPDATE ON public\.calendar_events TO authenticated;/)[0]);
  await db.exec(read('../migrations/20261021034849_client_intake_first_contact.sql'));
  await db.exec(read('../migrations/20261021040127_intake_first_appointment_access.sql'));
  return db;
}

const db = await createFixture();
async function actor(role = 'office_staff', overrides = {}) {
  await db.exec('RESET ROLE');
  const values = { auth: id.auth, tenant: id.tenant, profile: id.profile, role, ...overrides };
  await db.exec('SELECT ' + Object.entries(values).map(([key, value]) =>
    "set_config('fixture." + key + "'," + quote(value ?? '') + ',false)').join(','));
  await db.exec('SET ROLE ' + (role === 'service_role' ? 'service_role' : 'authenticated'));
}
const renderedAt = new Date(Date.now() - 60_000).toISOString();
const originalHtml = '<h1>Geprüfte Aufnahme</h1><p>Maria Beispiel</p><img src="' + png + '"/>';
const contentHash = 'sha256:' + createHash('sha256').update(originalHtml).digest('hex');
let templateSnapshots = new Map();
let tenantDisplaySnapshot;
function document(templateKey, documentType) {
  return {
    templateKey, documentType, title: 'Geprüfte Aufnahme', isRequired: true,
    status: 'finalized', source: 'system', tenantTemplateId: null, version: 1,
    missingPlaceholders: [], unresolvedKeys: [], previewHtml: originalHtml,
    finalizedHtml: originalHtml, renderedPdfPath: null, previewOpenedAt: renderedAt,
    finalizedAt: renderedAt, renderVersion: 'intake-html-v1', renderedAt,
    signatures: { client: { role: 'client', dataUrl: png, signedAt: renderedAt, signerName: 'Maria Beispiel' } },
  };
}
function form(overrides = {}) {
  return {
    careContexts: ['daily_assistance'], firstName: 'Maria', lastName: 'Beispiel',
    salutation: 'frau', gender: 'female', dateOfBirth: '1950-03-14', status: 'in_aufnahme',
    admissionDate: '2026-10-14', serviceStart: '2026-11-01', street: 'Musterstraße', houseNumber: '12',
    zip: '10115', city: 'Berlin', addressExtra: 'Hinterhaus', phone: '0301234567', mobile: '01701234567',
    email: 'maria@example.invalid', preferredContact: 'phone', housingForm: 'alleinlebend', specialNotes: 'Tür bitte langsam öffnen.',
    careLevel: 'kein', careLevelStatus: 'bestaetigt', careLevelValidFrom: '2026-01-01',
    fundingSources: ['selbstzahler'], billingTypes: ['selbstzahler'], selfPay: true,
    costBearerTypes: ['selbstzahler'], activeCostBearerType: 'selbstzahler',
    selbstzahlerName: 'Maria Beispiel', selbstzahlerStreet: 'Musterstraße 12', selbstzahlerZip: '10115', selbstzahlerCity: 'Berlin',
    costBearerTemplateIds: {}, costBearerDbTypes: {}, supportWishes: ['einkaufen'], preferredTimes: ['vormittags'], excludedTimes: ['sonntag'],
    mobility: 'Rollator', orientation: 'Orientiert', communication: 'Deutlich sprechen', homeAccess: ['klingeln'],
    keyStatus: 'kein_schluessel', bellName: 'Beispiel', floor: '2', elevatorAvailable: false, accessNotes: 'Links klingeln',
    emergencyContactName: 'Eva Beispiel', emergencyContactPhone: '0309876543',
    assignedModules: ['office', 'assist'], consentDatenschutz: true, consentVertrag: true,
    intakeContractType: 'assist', intakeAssignmentEnabled: false, intakeOptionalConsents: [],
    intakeDocuments: [document('privacy_consent_default', 'privacy_consent'), document('client_contract_assist', 'client_contract')],
    consentTypes: [], contractTypes: [], documentCategories: [], taskCategories: [], hourlyRate: '38.50', ...overrides,
  };
}
async function seed() {
  await db.exec("RESET ROLE; SELECT set_config('fixture.denied','',false)");
  await db.exec('TRUNCATE ' + sourceTables.map((table) => 'public.' + identifier(table)).join(',')
    + ',auth.users,public.client_intake_drafts,client_intake_private.client_intake_operations,'
    + 'client_intake_private.client_intake_completions,client_intake_private.client_intake_originals,'
    + 'client_intake_private.client_intake_pending_clients CASCADE');
  await db.query('INSERT INTO auth.users(id) VALUES($1),($2)', [id.auth, id.otherAuth]);
  await db.query("INSERT INTO tenants(id,name,status) VALUES($1,'Beispielpflege','active'),($2,'Anderer Mandant','active')", [id.tenant, id.otherTenant]);
  await db.query("INSERT INTO roles(id,tenant_id,key,name) VALUES($1,$2,'office_staff','Büro')", [id.role, id.tenant]);
  await db.query("INSERT INTO profiles(id,tenant_id,auth_user_id,role_id,status,is_active) VALUES($1,$2,$3,$4,'active',true),($5,$6,$7,NULL,'active',true)",
    [id.profile, id.tenant, id.auth, id.role, id.otherProfile, id.otherTenant, id.otherAuth]);
  for (const permission of ['office.clients.create', 'office.clients.edit', 'office.clients.view', 'office.clients.view_sensitive'])
    await db.query('INSERT INTO role_permissions(tenant_id,role_id,permission_key) VALUES($1,$2,$3)', [id.tenant, id.role, permission]);
  await db.query("INSERT INTO tenant_users(tenant_id,auth_user_id,display_name,first_name,last_name,email,username,role_key,status,first_login_completed,must_change_password) VALUES($1,$2,'Büro Beispiel','Büro','Beispiel','office@example.invalid','office','office_staff','active',true,false)", [id.tenant, id.auth]);
  await db.query("INSERT INTO tenant_client_service_types(tenant_id,service_type_key,care_context_key,name,module_keys) VALUES($1,'assist','daily_assistance','Alltagsbegleitung',ARRAY['office','assist'])", [id.tenant]);
  for (const [key, type] of [['privacy_consent_default', 'privacy_consent'], ['client_contract_assist', 'client_contract']])
    await db.query(`INSERT INTO intake_document_system_templates
      (template_key,title,document_type,service_type,version,is_required,is_active,requires_client_signature,
        html_content,plain_text_content,signature_slots,updated_at)
      VALUES($1,'Geprüfte Aufnahme',$2,$3,1,true,true,true,$4,'Geprüfte Aufnahme',
        '[{"role":"client","placeholder":"{{signature.client}}","required":true}]',$5)`,
    [key, type, type === 'client_contract' ? 'assist' : null, originalHtml, renderedAt]);
  tenantDisplaySnapshot = (await db.query("SELECT jsonb_build_object('name',name,'street',street,'house_number',house_number,'postal_code',postal_code,'city',city) AS snapshot FROM tenants WHERE id=$1", [id.tenant])).rows[0].snapshot;
  templateSnapshots = new Map((await db.query('SELECT to_jsonb(t) AS snapshot FROM intake_document_system_templates t')).rows
    .map(({ snapshot }) => [snapshot.template_key, snapshot]));
  await actor();
}
async function save(value = form(), expected = 0, operation = id.operation) {
  return (await db.query('SELECT public.client_intake_save_draft($1,$2,$3,$4,$5) AS receipt',
    [id.tenant, id.client, value, expected, operation])).rows[0].receipt;
}
async function load() {
  return (await db.query('SELECT public.client_intake_load_draft($1,$2) AS draft', [id.tenant, id.client])).rows[0].draft;
}
function completionDocuments(value = form()) {
  return value.intakeDocuments.map((entry) => ({ ...entry, contentHash,
    templateUpdatedAt: templateSnapshots.get(entry.templateKey).updated_at,
    systemTemplateUpdatedAt: templateSnapshots.get(entry.templateKey).updated_at,
    systemTemplateSnapshot: templateSnapshots.get(entry.templateKey), tenantTemplateSnapshot: null, tenantDisplaySnapshot,
  }));
}
async function complete(saved, documents = completionDocuments(), overrides = {}) {
  const p = { tenant: id.tenant, client: id.client, profile: id.profile, auth: id.auth,
    revision: saved.revision, hash: saved.formHash, documents, ...overrides };
  return (await db.query('SELECT public.client_intake_commit_completion($1,$2,$3,$4,$5,$6,$7) AS receipt',
    [p.tenant, p.client, p.profile, p.auth, p.revision, p.hash, p.documents])).rows[0].receipt;
}
async function counts() {
  await db.exec('RESET ROLE');
  const result = {};
  for (const table of ['client_addresses', 'client_contacts', 'client_care_contexts', 'client_funding_selections',
    'client_service_profiles', 'client_module_assignments', 'client_intake_documents', 'client_document_signatures',
    'client_documents', 'client_consent_status', 'client_timeline_events', 'client_budget_settings', 'client_care_entitlement',
    'client_budget_accounts', 'client_budget_transactions', 'client_billing_audit_log', 'tenant_budget_years', 'tenant_budget_defaults',
    'tenant_client_portal_defaults', 'tenant_service_intake_sections',
    'client_intake_private.client_intake_originals', 'client_intake_private.client_intake_completions'])
    result[table] = (await db.query('SELECT count(*)::integer AS n FROM ' + table)).rows[0].n;
  return result;
}
async function seedSyntheticBudgetCatalog() {
  await db.exec('RESET ROLE');
  // Deliberately synthetic cents, not statutory amounts.
  await db.exec(`INSERT INTO budget_template_catalog
    (catalog_key,budget_year,label,period,default_amount_cents,care_grade_min,care_grade_max,billing_priority) VALUES
    ('paragraph_45b',extract(year FROM current_date),'Synthetic monthly 1111','monthly',1111,'pg1','pg5',10),
    ('umwandlung_pg2',extract(year FROM current_date),'Synthetic conversion 2222','monthly',2222,'pg2','pg2',20),
    ('gemeinsames_jahresbudget',extract(year FROM current_date),'Synthetic annual 3333','yearly',3333,'pg2','pg5',30),
    ('umwandlung_pg3',extract(year FROM current_date),'Inapplicable grade','monthly',4444,'pg3','pg3',40)`);
  await actor();
}
async function assertNoMutation(sql, params) {
  try { assert.equal((await db.query(sql + ' RETURNING id', params)).rows.length, 0, 'Denied UPDATE changed a record'); }
  catch (error) {
    if (error instanceof assert.AssertionError) throw error;
    assert.match(String(error.message), /permission|policy|security|Original|Signatur|Aufnahme|Abschluss|unveränder|geschützt|server|direkt|Entwurf/i);
  }
}

await test('fixture enforces the real generated-document FK and required archive columns', async () => {
  await seed();
  assert.equal((await db.query('SELECT care_security.fixture_existing_capability() AS allowed')).rows[0].allowed, true);
  await save(); await db.exec('RESET ROLE');
  await assert.rejects(db.query(`INSERT INTO client_intake_documents
    (id,tenant_id,client_id,template_key,document_type,title,generated_document_id)
    VALUES($1,$2,$3,'fixture','privacy_consent','Original',$1)`, [id.privacy, id.tenant, id.client]), /foreign key/);
  await assert.rejects(db.query('INSERT INTO client_documents(tenant_id,client_id,title) VALUES($1,$2,$3)',
    [id.tenant, id.client, 'Kein Dateiname']), /not-null/);
});

await test('full signed JSON survives draft save/load; operation replay is idempotent and content-bound', async () => {
  await seed(); const value = form(); const saved = await save(value);
  assert.equal(saved.contract, 'client-intake-draft-v1'); assert.equal(saved.revision, 1);
  assert.match(saved.formHash, /^sha256:[0-9a-f]{64}$/);
  const loaded = await load(); assert.deepEqual(loaded.form, value); assert.equal(loaded.actorProfileId, id.profile);
  const replay = await save(value); assert.equal(replay.replayed, true); assert.equal(replay.revision, 1); assert.equal(replay.formHash, saved.formHash);
  await assert.rejects(save(form({ firstName: 'Andere Fassung' })));
  assert.deepEqual((await load()).form, value);
});

await test('competing stale writers cannot replace the winning revision; old operation retries cannot revert it', async () => {
  await seed(); await save();
  const outcomes = await Promise.allSettled([save(form({ firstName: 'Writer A' }), 1, id.nextOperation), save(form({ firstName: 'Writer B' }), 1, id.otherClient)]);
  assert.equal(outcomes.filter((row) => row.status === 'fulfilled').length, 1);
  assert.equal(outcomes.filter((row) => row.status === 'rejected').length, 1);
  const winning = await load(); assert.equal(winning.revision, 2);
  assert.equal((await save()).replayed, true); assert.deepEqual((await load()).form, winning.form);
});

await test('tenant, portal and actor boundaries protect draft contents and writes', async () => {
  await seed(); await save();
  await actor('client_portal'); await assert.rejects(load()); await assert.rejects(save());
  await actor('office_staff', { tenant: id.otherTenant, auth: id.otherAuth, profile: id.otherProfile });
  await assert.rejects(load()); await assert.rejects(save());
  await actor(); assert.equal((await load()).revision, 1);
});

await test('completion is service-only and still verifies the human actor, auth binding and current permission', async () => {
  await seed(); const saved = await save(); await assert.rejects(complete(saved), /permission denied/);
  await actor('service_role');
  await assert.rejects(complete(saved, completionDocuments(), { profile: id.otherProfile }));
  await assert.rejects(complete(saved, completionDocuments(), { auth: id.otherAuth }));
  await db.exec('RESET ROLE'); await db.query('UPDATE profiles SET is_active=false WHERE id=$1', [id.profile]);
  await actor('service_role'); await assert.rejects(complete(saved));
  await db.exec('RESET ROLE'); await db.query('UPDATE profiles SET is_active=true WHERE id=$1', [id.profile]);
  await db.query("DELETE FROM role_permissions WHERE role_id=$1 AND permission_key='office.clients.create'", [id.role]);
  await actor('service_role'); await assert.rejects(complete(saved));
  await db.exec('RESET ROLE'); await db.query("INSERT INTO role_permissions(tenant_id,role_id,permission_key) VALUES($1,$2,'office.clients.create')", [id.tenant, id.role]);
  await db.query("DELETE FROM role_permissions WHERE role_id=$1 AND permission_key='office.clients.view_sensitive'", [id.role]);
  await actor('service_role'); await assert.rejects(complete(saved)); await actor();
  await assert.rejects(load()); await assert.rejects(save(form(), saved.revision, id.nextOperation));
  await db.exec('RESET ROLE'); assert.equal((await db.query('SELECT status FROM clients WHERE id=$1', [id.client])).rows[0].status, 'lead');
});

await test('one completion commits originals, signatures, consent, projections and activation; replay adds nothing', async () => {
  await seed(); const saved = await save();
  await db.query(`INSERT INTO client_intake_documents(id,tenant_id,client_id,template_key,document_type,title,status,preview_html)
    VALUES($1,$2,$3,'privacy_consent_default','privacy_consent','Vorschau','preview_open',$4)`, [id.privacy, id.tenant, id.client, originalHtml]);
  await db.query("INSERT INTO client_consent_status(tenant_id,client_id,privacy_status,contract_status) VALUES($1,$2,'not_started','not_started')", [id.tenant, id.client]);
  await actor('service_role'); const receipt = await complete(saved);
  assert.equal(receipt.contract, 'client-intake-completion-v1'); assert.equal(receipt.status, 'active'); assert.equal(receipt.confirmed, true);
  const before = await counts();
  for (const table of ['client_intake_documents', 'client_document_signatures', 'client_documents', 'client_intake_private.client_intake_originals']) assert.equal(before[table], 2);
  assert.equal(before['client_intake_private.client_intake_completions'], 1); assert.equal(before.client_consent_status, 1);
  for (const table of ['client_addresses', 'client_contacts', 'client_care_contexts', 'client_funding_selections', 'client_service_profiles', 'client_module_assignments']) assert.ok(before[table] > 0, table);
  assert.equal((await db.query('SELECT status FROM clients WHERE id=$1', [id.client])).rows[0].status, 'active');
  assert.equal((await db.query('SELECT count(*)::integer AS n FROM client_intake_documents WHERE generated_document_id IS NOT NULL')).rows[0].n, 0);
  assert.deepEqual((await db.query('SELECT DISTINCT finalized_html FROM client_intake_documents')).rows.map((row) => row.finalized_html), [originalHtml]);
  await actor('service_role'); assert.equal((await complete(saved)).replayed, true); assert.deepEqual(await counts(), before);
});

await test('stale revision, form hash and changed original are rejected without partial evidence', async () => {
  await seed(); const saved = await save(); await actor('service_role');
  await assert.rejects(complete(saved, completionDocuments(), { revision: saved.revision + 1 }));
  await assert.rejects(complete(saved, completionDocuments(), { hash: 'sha256:' + '0'.repeat(64) }));
  const changed = completionDocuments(); changed[0].finalizedHtml = '<p>Changed after signing</p>'; await assert.rejects(complete(saved, changed));
  const state = await counts(); assert.equal(state.client_intake_documents, 0); assert.equal(state.client_document_signatures, 0); assert.equal(state['client_intake_private.client_intake_completions'], 0);
});

await test('changed template bytes, revision or tenant address invalidate the reviewed completion', async () => {
  for (const update of ["UPDATE intake_document_system_templates SET html_content='<p>Andere Bytes, gleiche Zeit</p>'",
    "UPDATE intake_document_system_templates SET updated_at=updated_at+interval '1 minute'", "UPDATE tenants SET street='Neue Geschäftsadresse'"]) {
    await seed(); const saved = await save(); await db.exec('RESET ROLE'); await db.exec(update); await actor('service_role');
    await assert.rejects(complete(saved)); assert.equal((await counts())['client_intake_private.client_intake_originals'], 0);
  }
});

await test('a late activation failure rolls projections, originals, consent and completion receipts back together', async () => {
  await seed(); await seedSyntheticBudgetCatalog();
  const value = form({ careLevel: 'pg2', fundingSources: ['entlastungsleistung', 'umwandlung'] });
  const saved = await save(value); const baseline = await counts();
  await db.exec(`CREATE FUNCTION fixture_reject_activation() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.status='active' THEN RAISE EXCEPTION 'fixture activation failure'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER fixture_reject_activation BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION fixture_reject_activation()`);
  try {
    await actor('service_role'); await assert.rejects(complete(saved, completionDocuments(value)), /fixture activation failure/);
    assert.deepEqual(await counts(), baseline); await actor(); assert.equal((await load()).status, 'draft'); assert.equal((await load()).revision, saved.revision);
  } finally { await db.exec('RESET ROLE; DROP TRIGGER fixture_reject_activation ON clients; DROP FUNCTION fixture_reject_activation()'); }
});

await test('missing required original or signature role cannot activate the intake', async () => {
  await seed(); const saved = await save(); await actor('service_role');
  await assert.rejects(complete(saved, completionDocuments().slice(0, 1)));
  const noSignature = completionDocuments(); noSignature[0].signatures = {}; await assert.rejects(complete(saved, noSignature));
  assert.equal((await counts()).client_documents, 0);
});

await test('direct signatures, final originals, receipts, consent, archive and status assertions are blocked', async () => {
  await seed(); await save(); await db.exec('RESET ROLE');
  await db.query(`INSERT INTO client_intake_documents(id,tenant_id,client_id,template_key,document_type,title,status,preview_html)
    VALUES($1,$2,$3,'privacy_consent_default','privacy_consent','Ungesicherte Vorschau','preview_open',$4)`, [id.privacy, id.tenant, id.client, originalHtml]);
  await actor();
  await assert.rejects(db.query("INSERT INTO client_document_signatures(tenant_id,client_id,document_id,signer_role,signature_data) VALUES($1,$2,$3,'client',$4)", [id.tenant, id.client, id.privacy, png]));
  await assertNoMutation("UPDATE client_intake_documents SET status='finalized',finalized_html=preview_html,finalized_at=now() WHERE id=$1", [id.privacy]);
  await assert.rejects(db.query(`INSERT INTO client_timeline_events(tenant_id,client_id,event_type,title,metadata)
    VALUES($1,$2,'status','Gefälschter Abschluss','{"contract":"client-intake-completion-v1"}')`, [id.tenant, id.client]));
  await assert.rejects(db.query(`INSERT INTO client_document_events(tenant_id,client_id,document_id,event_type,summary,metadata_json)
    VALUES($1,$2,$3,'document_finalized','Gefälschtes Original','{"contract":"client-intake-completion-v1"}')`, [id.tenant, id.client, id.privacy]));
  await assert.rejects(db.query("INSERT INTO client_consent_status(tenant_id,client_id,privacy_status,contract_status) VALUES($1,$2,'finalized','finalized')", [id.tenant, id.client]));
  await assert.rejects(db.query("INSERT INTO client_documents(tenant_id,client_id,title,file_name,status,source,intake_document_id) VALUES($1,$2,'Gefälschtes Archiv','original.html','abgeschlossen','intake',$3)", [id.tenant, id.client, id.privacy]));
  await assertNoMutation("UPDATE clients SET status='active' WHERE id=$1", [id.client]);
  await db.query("UPDATE clients SET status='paused' WHERE id=$1", [id.client]).catch(() => undefined);
  await assertNoMutation("UPDATE clients SET status='active' WHERE id=$1", [id.client]);
  await db.query("INSERT INTO clients(id,tenant_id,first_name,last_name,status) VALUES($1,$2,'Direkt','Aktiv','active')", [id.otherClient, id.tenant]);
});

await test('completed evidence remains immutable and a new draft operation cannot reopen or overwrite it', async () => {
  await seed(); const saved = await save(); await actor('service_role'); await complete(saved); const before = await counts();
  const original = (await db.query('SELECT id FROM client_intake_documents ORDER BY template_key LIMIT 1')).rows[0]; await actor();
  await assert.rejects(save(form({ firstName: 'Nachträglich verändert' }), saved.revision, id.nextOperation));
  await assertNoMutation('UPDATE client_intake_documents SET finalized_html=$1 WHERE id=$2', ['Verändert', original.id]);
  await assertNoMutation('UPDATE client_document_signatures SET signature_data=$1 WHERE document_id=$2', ['Verändert', original.id]);
  await assertNoMutation('UPDATE client_documents SET title=$1 WHERE intake_document_id=$2', ['Verändert', original.id]);
  const loaded = await load(); assert.equal(loaded.status, 'completed'); assert.equal(loaded.completedReceipt.confirmed, true); assert.deepEqual(loaded.form, form()); assert.deepEqual(await counts(), before);
});

await test('all nine carrier mappings, combined billing and six modules survive the atomic projection', async () => {
  await seed();
  const mappings = [['pflegekasse', 'careFund', 'care_insurance'], ['krankenkasse', 'healthInsurance', 'health_insurance'],
    ['privatversicherung', 'privatversicherung', 'private_insurance'], ['sozialamt', 'sozialamt', 'social_welfare_office'],
    ['beihilfe', 'beihilfe', 'beihilfe'], ['selbstzahler', 'selbstzahler', 'selbstzahler'],
    ['berufsgenossenschaft', 'berufsgenossenschaft', 'employers_liability_insurance'],
    ['unfallversicherung', 'unfallversicherung', 'accident_insurance'], ['sonstiger', 'sonstiger', 'sonstiger']];
  const value = form({ costBearerTypes: mappings.map(([key]) => key), billingTypes: ['kombi'],
    assignedModules: ['office', 'assist', 'pflege', 'stationaer', 'beratung', 'akademie'], insuranceNumber: 'A123456789', costBearerIk: '123456789' });
  for (const [key, prefix] of mappings) {
    value[key === 'krankenkasse' ? 'healthInsurance' : prefix + 'Name'] = 'Träger ' + key;
    value[prefix + 'Street'] = 'Trägerstraße 7'; value[prefix + 'Zip'] = '10115'; value[prefix + 'City'] = 'Berlin'; value[prefix + 'Ik'] = '123456789';
  }
  const saved = await save(value); await actor('service_role'); await complete(saved, completionDocuments(value)); await db.exec('RESET ROLE');
  const assignments = (await db.query('SELECT carrier_type,name_snapshot,address_snapshot FROM client_cost_carrier_assignments WHERE archived_at IS NULL ORDER BY carrier_type')).rows;
  assert.equal(assignments.length, 9); assert.deepEqual(assignments.map((row) => row.carrier_type), mappings.map(([, , type]) => type).sort());
  for (const [key, , type] of mappings) { const row = assignments.find((entry) => entry.carrier_type === type); assert.equal(row.name_snapshot, 'Träger ' + key); assert.equal(row.address_snapshot.postalCode, '10115'); }
  assert.equal((await db.query('SELECT billing_type FROM client_billing_profiles')).rows[0].billing_type, 'kombi');
  const modules = (await db.query('SELECT module_key,is_primary,is_active FROM client_module_assignments ORDER BY module_key')).rows;
  assert.equal(modules.length, 6); assert.ok(modules.every((row) => row.is_active)); assert.deepEqual(modules.filter((row) => row.is_primary).map((row) => row.module_key), ['pflege']);
});

await test('explicit reconciliation merges changed core fields, preserves signed form data and enforces both CAS values', async () => {
  await seed(); const saved = await save(); const original = await load(); assert.equal(original.coreChanged, false);
  await db.exec('RESET ROLE'); await db.query("UPDATE clients SET first_name='Amtlich geändert',care_level='unknown',updated_at=clock_timestamp() WHERE id=$1", [id.client]);
  await actor(); const changed = await load(); assert.equal(changed.coreChanged, true); assert.deepEqual(changed.form, form());
  await assert.rejects(save(form({ firstName: 'Alter Browserstand' }), saved.revision, id.nextOperation), { code: '40001' });
  const reconcile = (revision, updatedAt, operation = id.nextOperation) => db.query('SELECT public.client_intake_reconcile_draft($1,$2,$3,$4,$5) AS receipt', [id.tenant, id.client, revision, updatedAt, operation]);
  await assert.rejects(reconcile(saved.revision, original.currentClientUpdatedAt), { code: '40001' });
  assert.equal((await reconcile(saved.revision, changed.currentClientUpdatedAt)).rows[0].receipt.revision, 2);
  const merged = await load(); assert.equal(merged.coreChanged, false); assert.equal(merged.form.firstName, 'Amtlich geändert'); assert.equal(merged.form.careLevel, 'unbekannt');
  assert.deepEqual(merged.form.intakeDocuments, form().intakeDocuments); assert.deepEqual(merged.form.supportWishes, form().supportWishes);
  assert.equal((await reconcile(saved.revision, changed.currentClientUpdatedAt)).rows[0].receipt.replayed, true);
  await assert.rejects(reconcile(saved.revision, changed.currentClientUpdatedAt, id.otherClient), { code: '40001' }); assert.deepEqual((await load()).form, merged.form);
});

await test('current platform tenant and account suspensions prevent save, load and service completion', async () => {
  for (const state of ['tenant_suspended', 'inactive', 'deleted']) {
    await seed(); const saved = await save(); await db.exec('RESET ROLE');
    if (state === 'tenant_suspended') await db.query("INSERT INTO platform_tenants(tenant_id,tenant_name,status) VALUES($1,'Beispielpflege','suspended')", [id.tenant]);
    else await db.query('INSERT INTO platform_account_access_states(tenant_user_id,tenant_id,state) SELECT id,tenant_id,$2 FROM tenant_users WHERE auth_user_id=$1', [id.auth, state]);
    await actor(); await assert.rejects(load(), { code: '42501' }); await assert.rejects(save(form(), saved.revision, id.nextOperation), { code: '42501' });
    await actor('service_role'); await assert.rejects(complete(saved), { code: '42501' }); assert.equal((await counts())['client_intake_private.client_intake_completions'], 0);
  }
});

await test('a new lead cannot escape its origin marker through paused status and an identity change', async () => {
  await seed(); await db.query("INSERT INTO clients(id,tenant_id,first_name,last_name,status) VALUES($1,$2,'Neue','Aufnahme','lead')", [id.client, id.tenant]);
  await db.query("UPDATE clients SET status='paused' WHERE id=$1", [id.client]);
  await assertNoMutation("UPDATE clients SET id=$1,status='active' WHERE id=$2", [id.otherClient, id.client]); await assertNoMutation("UPDATE clients SET status='active' WHERE id=$1", [id.client]);
  await db.query("INSERT INTO clients(id,tenant_id,first_name,last_name,status) VALUES($1,$2,'Historisch','Pausiert','paused')", [id.otherClient, id.tenant]);
  await db.query("UPDATE clients SET status='active' WHERE id=$1", [id.otherClient]); assert.equal((await db.query('SELECT status FROM clients WHERE id=$1', [id.otherClient])).rows[0].status, 'active');
});

await test('archive references cannot attach even unsigned originals to another client or tenant', async () => {
  await seed(); await save();
  await db.query("INSERT INTO client_intake_documents(id,tenant_id,client_id,template_key,document_type,title,status) VALUES($1,$2,$3,'privacy_consent_default','privacy_consent','Vorschau','preview_open')", [id.privacy, id.tenant, id.client]);
  for (const tenant of [id.tenant, id.otherTenant]) {
    await db.exec('RESET ROLE'); await db.query("INSERT INTO clients(id,tenant_id,first_name,last_name,status) VALUES($1,$2,'Andere','Akte','active') ON CONFLICT(id) DO UPDATE SET tenant_id=excluded.tenant_id", [id.otherClient, tenant]);
    await actor(); await assert.rejects(db.query("INSERT INTO client_documents(tenant_id,client_id,title,file_name,intake_document_id) VALUES($1,$2,'Fremde Vorschau','preview.html',$3)", [tenant, id.otherClient, id.privacy]), { code: '42501' });
  }
});

await test('a newly activated tenant overlay invalidates a previously reviewed system document', async () => {
  await seed(); const saved = await save(); await db.exec('RESET ROLE');
  await db.query("INSERT INTO tenant_document_templates(tenant_id,template_key,document_type,html_content) VALUES($1,'privacy_consent_default','privacy_consent','<p>Neue eigene Vorlage</p>')", [id.tenant]);
  await actor('service_role'); await assert.rejects(complete(saved), { code: '40001' }); assert.equal((await counts())['client_intake_private.client_intake_originals'], 0);
});

await test('a tenant template with null HTML retains its verified system fallback and both source snapshots', async () => {
  await seed(); await db.exec('RESET ROLE');
  const own = (await db.query("INSERT INTO tenant_document_templates(tenant_id,template_key,document_type,html_content,updated_at) VALUES($1,'privacy_consent_default','privacy_consent',NULL,$2) RETURNING to_jsonb(tenant_document_templates) AS snapshot", [id.tenant, renderedAt])).rows[0].snapshot;
  const value = form(); Object.assign(value.intakeDocuments[0], { source: 'tenant', tenantTemplateId: own.id }); await actor(); const saved = await save(value);
  const documents = completionDocuments(value); Object.assign(documents[0], { tenantTemplateSnapshot: own, templateUpdatedAt: own.updated_at });
  await actor('service_role'); assert.equal((await complete(saved, documents)).confirmed, true); await db.exec('RESET ROLE');
  const stored = (await db.query("SELECT source,tenant_template_id,finalized_html FROM client_intake_documents WHERE template_key='privacy_consent_default'")).rows[0];
  assert.equal(stored.source, 'tenant'); assert.equal(stored.tenant_template_id, own.id); assert.equal(stored.finalized_html, originalHtml);
});

await test('completion copies service-year tenant defaults and generates current catalogue accounts with ledger and funding locks', async () => {
  await seed(); await seedSyntheticBudgetCatalog(); await db.exec('RESET ROLE'); await db.query('SELECT seed_tenant_client_core_templates($1)', [id.tenant]);
  const date = (await db.query("SELECT current_date::text AS today, extract(year FROM current_date)::integer AS year, date_trunc('month',current_date)::date::text AS month_start")).rows[0];
  const serviceYear = date.year + 1;
  const budgetYear = (await db.query('INSERT INTO tenant_budget_years(tenant_id,budget_year) VALUES($1,$2) RETURNING id', [id.tenant, serviceYear])).rows[0].id;
  const budgetType = (await db.query("SELECT id FROM tenant_budget_types WHERE tenant_id=$1 AND budget_type_key='entlastung_45b'", [id.tenant])).rows[0].id;
  await db.query("INSERT INTO tenant_budget_defaults(tenant_id,budget_year_id,budget_type_id,amount_cents,yearly_amount_cents,monthly_amount_cents,conversion_rate_pct,notes) VALUES($1,$2,$3,5555,6666,777,12.5,'Synthetic tenant defaults')", [id.tenant, budgetYear, budgetType]);
  const value = form({ careLevel: 'pg2', careLevelValidFrom: '2001-01-01', careFundName: 'Testkasse', insuranceNumber: 'T123', serviceStart: `${serviceYear}-02-01`, fundingSources: ['entlastungsleistung', 'umwandlung'] });
  await actor(); const saved = await save(value); await actor('service_role'); await complete(saved, completionDocuments(value)); await db.exec('RESET ROLE');
  const setting = (await db.query('SELECT * FROM client_budget_settings')).rows[0];
  assert.equal(setting.budget_year_id, budgetYear); assert.equal(Number(setting.allocated_cents), 6666); assert.equal(Number(setting.monthly_limit_cents), 777); assert.equal(Number(setting.conversion_rate_pct), 12.5);
  const entitlement = (await db.query('SELECT *,valid_from::text AS start_date FROM client_care_entitlement')).rows[0];
  assert.equal(entitlement.care_grade, 'pg2'); assert.equal(entitlement.start_date, '2001-01-01'); assert.equal(entitlement.care_fund_name, 'Testkasse'); assert.equal(entitlement.conversion_enabled, true);
  const accounts = (await db.query('SELECT *,period_start::text AS start_date,period_end::text AS end_date FROM client_budget_accounts ORDER BY billing_priority')).rows;
  assert.equal(accounts.length, 3); assert.deepEqual(accounts.map((row) => Number(row.allocated_cents)), [1111, 2222, 3333]); assert.ok(accounts.every((row) => row.catalog_year === date.year));
  assert.equal(accounts[0].start_date, date.month_start); assert.equal(accounts[0].end_date, `${date.year + 1}-06-30`); assert.equal(accounts[0].catalog_snapshot.defaultAmountCents, 1111);
  assert.equal(accounts[2].status, 'suspended'); assert.equal(accounts[2].lock_reason, 'Finanzierungsart nicht ausgewählt');
  assert.equal((await db.query("SELECT count(*)::integer AS n FROM client_budget_transactions WHERE transaction_type='allocation'")).rows[0].n, 3);
  assert.equal((await db.query("SELECT count(*)::integer AS n FROM client_billing_audit_log WHERE action='auto_generate_account'")).rows[0].n, 3);
  const before = await counts(); await actor('service_role'); assert.equal((await complete(saved, completionDocuments(value))).replayed, true); assert.deepEqual(await counts(), before);
});

await test('existing budget settings, individual account amounts, usage, reservations and manual locks survive completion', async () => {
  await seed(); await seedSyntheticBudgetCatalog(); const value = form({ careLevel: 'pg2', fundingSources: ['entlastungsleistung', 'umwandlung'] });
  const saved = await save(value); await db.exec('RESET ROLE'); await db.query('SELECT seed_tenant_client_core_templates($1)', [id.tenant]);
  await db.query("INSERT INTO client_budget_settings(tenant_id,client_id,budget_year_id,budget_type_id,allocated_cents,notes) SELECT $1,$2,budget_year_id,budget_type_id,98765,'Existing individual setting' FROM tenant_budget_defaults WHERE tenant_id=$1 LIMIT 1", [id.tenant, id.client]);
  await db.query(`INSERT INTO client_budget_accounts(tenant_id,client_id,catalog_template_id,catalog_key,catalog_year,period,period_start,period_end,
    allocated_cents,used_cents,reserved_cents,is_individual_override,individual_amount_cents,locked,lock_reason)
    SELECT $1,$2,id,catalog_key,budget_year,period,date_trunc('month',current_date)::date,
      make_date(extract(year FROM current_date)::integer+1,6,30),9876,678,90,true,9876,true,'Manuell geprüft'
    FROM budget_template_catalog WHERE catalog_key='paragraph_45b'`, [id.tenant, id.client]);
  await db.query(`INSERT INTO client_budget_accounts(tenant_id,client_id,catalog_template_id,catalog_key,catalog_year,period,period_start,period_end,
    allocated_cents,used_cents,reserved_cents,locked,lock_reason)
    SELECT $1,$2,id,catalog_key,budget_year,period,date_trunc('year',current_date)::date,
      make_date(extract(year FROM current_date)::integer,12,31),5432,125,56,true,'Manuelle Abrechnungssperre'
    FROM budget_template_catalog WHERE catalog_key='gemeinsames_jahresbudget'`, [id.tenant, id.client]);
  await actor('service_role'); await complete(saved, completionDocuments(value)); await db.exec('RESET ROLE');
  assert.equal(Number((await db.query('SELECT allocated_cents FROM client_budget_settings')).rows[0].allocated_cents), 98765);
  const account = (await db.query("SELECT * FROM client_budget_accounts WHERE catalog_key='paragraph_45b'")).rows[0];
  assert.deepEqual([account.allocated_cents, account.used_cents, account.reserved_cents, account.individual_amount_cents].map(Number), [9876, 678, 90, 9876]);
  assert.equal(account.is_individual_override, true); assert.equal(account.locked, true); assert.equal(account.lock_reason, 'Manuell geprüft');
  assert.equal((await db.query('SELECT count(*)::integer AS n FROM client_budget_transactions WHERE budget_account_id=$1', [account.id])).rows[0].n, 0);
  const unselected = (await db.query("SELECT * FROM client_budget_accounts WHERE catalog_key='gemeinsames_jahresbudget'")).rows[0];
  assert.equal(unselected.status, 'suspended'); assert.equal(unselected.is_enabled, false); assert.equal(unselected.locked, true); assert.equal(unselected.lock_reason, 'Manuelle Abrechnungssperre');
  assert.deepEqual([unselected.allocated_cents, unselected.used_cents, unselected.reserved_cents].map(Number), [5432, 125, 56]);
  assert.equal((await db.query('SELECT count(*)::integer AS n FROM client_budget_transactions WHERE budget_account_id=$1', [unselected.id])).rows[0].n, 0);
});

await test('a pending care-grade application creates no invented entitlement or catalogue account', async () => {
  await seed(); await seedSyntheticBudgetCatalog(); const value = form({ careLevel: 'beantragt', careLevelStatus: 'beantragt' });
  const saved = await save(value); await actor('service_role'); await complete(saved, completionDocuments(value));
  const state = await counts(); assert.equal(state.client_care_entitlement, 0); assert.equal(state.client_budget_accounts, 0); assert.equal(state.client_budget_transactions, 0);
});


const initialContact = (patch = {}) => form({ intakeWorkflowVersion: 2, intakeStage: 'first_contact', firstName: '', lastName: 'Interessiert', phone: '03012345', dateOfBirth: '', careContexts: [], intakeDocuments: [], ...patch });
const schedule = revision => db.query('SELECT public.client_intake_schedule_first_appointment($1,$2,$3) AS receipt', [id.tenant,id.client,revision]).then(r => r.rows[0].receipt);
const removeDraft = revision => db.query('SELECT public.client_intake_delete_draft($1,$2,$3) AS receipt', [id.tenant,id.client,revision]).then(r => r.rows[0].receipt);
await test('minimal first contact remains one lead and resumes with its original contact data', async () => {
  await seed(); const first = initialContact({ intakeContactPerson: 'Tochter', intakeContactNotes: 'Anruf am Nachmittag' });
  await save(first); assert.deepEqual((await load()).form, first);
  const updated = await save({ ...first, firstName: 'Maria', intakeStage: 'full_intake', careContexts: ['support_care'] }, 1, id.nextOperation);
  assert.equal(updated.clientId,id.client); assert.equal(updated.revision,2);
  await db.exec('RESET ROLE');
  assert.equal((await db.query('SELECT count(*)::int n FROM clients')).rows[0].n,1);
  assert.equal((await db.query('SELECT status FROM clients')).rows[0].status,'lead');
  assert.equal((await db.query('SELECT count(*)::int n FROM calendar_events')).rows[0].n,0);
});
await test('first appointment is internal, linked, correctly zoned and idempotent after a lost response', async () => {
  await seed(); await save(initialContact({ intakeAppointmentRequested:true,intakeAppointmentStart:'2026-11-01T11:00',intakeAppointmentEnd:'2026-11-01T12:00',intakeAppointmentLocation:'Zu Hause' }));
  const first=await schedule(1), repeated=await schedule(1); assert.deepEqual(repeated,first);
  assert.equal(new Date(first.startAt).toISOString(),'2026-11-01T10:00:00.000Z');
  await db.exec('RESET ROLE'); const rows=(await db.query('SELECT * FROM calendar_events')).rows;
  assert.equal(rows.length,1); assert.equal(rows[0].related_client_id,id.client); assert.equal(rows[0].source_id,id.client);
  assert.equal(rows[0].source_type,'intake_appointment'); assert.equal(rows[0].is_client_portal_visible,false); assert.equal(rows[0].is_employee_portal_visible,false);
  await db.query("UPDATE calendar_events SET start_at='2026-11-02T10:00:00Z',end_at='2026-11-02T11:00:00Z',archived_at=now(),status='archiviert' WHERE id=$1",[first.id]);
  await actor(); const after=await schedule(1); assert.equal(after.status,'archiviert'); assert.equal(new Date(after.startAt).toISOString(),'2026-11-02T10:00:00.000Z');
});
await test('calendar planning rejects stale versions, missing permission and ambiguous DST times', async () => {
  await seed(); await save(initialContact({intakeAppointmentRequested:true,intakeAppointmentStart:'2026-11-01T11:00',intakeAppointmentEnd:'2026-11-01T12:00'}));
  await assert.rejects(schedule(2), /inzwischen geändert/);
  await db.query("SELECT set_config('fixture.denied','office.appointments.edit',false)"); await assert.rejects(schedule(1), /Berechtigung/);
  await seed(); await save(initialContact({intakeAppointmentRequested:true,intakeAppointmentStart:'2027-03-28T02:30',intakeAppointmentEnd:'2027-03-28T04:00'}));
  await assert.rejects(schedule(1), /Zeitumstellung/);
  await seed(); await save(initialContact({intakeAppointmentRequested:true,intakeAppointmentStart:'2026-10-25T02:30',intakeAppointmentEnd:'2026-10-25T04:00'}));
  await assert.rejects(schedule(1), /Zeitumstellung/);
});
await test('deletion checks the current revision, removes the linked appointment and prevents resurrection', async () => {
  await seed(); const first=initialContact({intakeAppointmentRequested:true,intakeAppointmentStart:'2026-11-01T11:00',intakeAppointmentEnd:'2026-11-01T12:00'});
  await save(first); await schedule(1); await save({...first,firstName:'Maria'},1,id.nextOperation);
  await assert.rejects(removeDraft(1),/inzwischen geändert/);
  assert.equal((await removeDraft(2)).deleted,true); assert.equal((await removeDraft(2)).deleted,true);
  await assert.rejects(load(),/gelöscht/);
  await assert.rejects(save(first,2,'70000000-0000-4000-8000-000000000003'),/offenen Aufnahme/);
  await db.exec('RESET ROLE');
  assert.equal((await db.query('SELECT status FROM clients')).rows[0].status,'deleted');
  assert.equal((await db.query('SELECT status FROM calendar_events')).rows[0].status,'archiviert');
  assert.equal((await db.query('SELECT count(*)::int n FROM client_intake_private.client_intake_operations')).rows[0].n,2);
});
await test('deletion cannot cross tenants, run without delete permission, or delete a completed intake', async () => {
  await seed(); await save();
  await actor('office_staff',{tenant:id.otherTenant}); await assert.rejects(removeDraft(1),/Berechtigung|Profil/);
  await actor(); await db.query("SELECT set_config('fixture.denied','office.clients.delete',false)"); await assert.rejects(removeDraft(1),/Berechtigung/);
  await db.query("SELECT set_config('fixture.denied','',false)"); const saved=await load();
  await actor('service_role'); await complete(saved); await actor(); await assert.rejects(removeDraft(1),/Abgeschlossene/);
});
await test('v2 requires all selected contracts once and commits the combined originals atomically', async () => {
  await seed(); await db.exec('RESET ROLE');
  for (const type of ['ambulatory_care','stationary_care','care_consulting']) {
    await db.query("INSERT INTO intake_document_system_templates(template_key,title,document_type,service_type,version,is_required,is_active,requires_client_signature,html_content,plain_text_content,signature_slots,updated_at) SELECT $1,title,document_type,$2,version,is_required,is_active,requires_client_signature,html_content,plain_text_content,signature_slots,updated_at FROM intake_document_system_templates WHERE template_key='client_contract_assist'",['client_contract_'+type,type]);
  }
  templateSnapshots=new Map((await db.query('SELECT to_jsonb(t) AS snapshot FROM intake_document_system_templates t')).rows.map(({snapshot})=>[snapshot.template_key,snapshot]));
  await actor();
  const value=form({intakeWorkflowVersion:2,intakeStage:'full_intake',intakeContractType:'day_care',careContexts:['daily_assistance','support_care','companionship','ambulatory_care','stationary_care','consulting','academy_prepared']});
  value.intakeDocuments.push(...['ambulatory_care','stationary_care','care_consulting'].map(type=>document('client_contract_'+type,'client_contract')));
  const saved=await save(value); const docs=completionDocuments(value); await actor('service_role');
  await assert.rejects(complete(saved,docs.slice(0,2)),/vollständig/);
  const receipt=await complete(saved,docs); assert.equal(receipt.confirmed,true);
  const state=await counts(); assert.equal(state.client_intake_documents,5); assert.equal(state['client_intake_private.client_intake_originals'],5);
});
await test('first-contact stage cannot be activated even when complete signed documents are supplied', async () => {
  await seed(); const value=form({intakeWorkflowVersion:2,intakeStage:'first_contact'}), saved=await save(value);
  await actor('service_role'); await assert.rejects(complete(saved,completionDocuments(value)),/Erstkontakt zunächst vervollständigen/);
});
await test('calendar edits cannot detach the first appointment or publish it to a portal', async () => {
  await seed(); await save(initialContact({intakeAppointmentRequested:true,intakeAppointmentStart:'2026-11-01T11:00',intakeAppointmentEnd:'2026-11-01T12:00'}));
  await schedule(1); await db.exec('RESET ROLE');
  await assert.rejects(db.exec("UPDATE calendar_events SET source_type='custom_event'"),/unveränderlich/);
  await assert.rejects(db.exec('UPDATE calendar_events SET is_client_portal_visible=true'),/intern/);
});

await test('direct calendar access keeps intake appointments internal and enforces edit permission', async () => {
  await seed(); await save(initialContact({intakeAppointmentRequested:true,intakeAppointmentStart:'2026-11-01T11:00',intakeAppointmentEnd:'2026-11-01T12:00'}));
  const appointment=await schedule(1);
  await actor('client_portal');
  assert.equal((await db.query('SELECT id FROM calendar_events')).rows.length,0);
  assert.equal((await db.query("UPDATE calendar_events SET title='Portal edit' RETURNING id")).rows.length,0);
  await actor('office_staff',{tenant:id.otherTenant});
  assert.equal((await db.query('SELECT id FROM calendar_events')).rows.length,0);
  await actor('office_staff',{denied:'office.appointments.edit'});
  assert.equal((await db.query('SELECT id FROM calendar_events')).rows.length,1);
  assert.equal((await db.query("UPDATE calendar_events SET title='Read-only edit' RETURNING id")).rows.length,0);
  await actor('office_staff',{denied:''});
  assert.equal((await db.query("UPDATE calendar_events SET location_name='Neuer Ort' WHERE id=$1 RETURNING id",[appointment.id])).rows.length,1);
  // Removing the intake itself is separately authorized by clients.delete;
  // its security-definer operation may archive the linked event atomically.
  await actor('office_staff',{denied:'office.appointments.edit'});
  assert.equal((await removeDraft(1)).deleted,true);
});
await test('direct inserts cannot pre-create an internal intake event from a portal session', async () => {
  await seed(); await save(initialContact());
  await actor('client_portal');
  const query="INSERT INTO calendar_events(tenant_id,module_key,source_type,source_id,event_type,title,start_at,end_at,related_client_id,is_client_portal_visible,is_employee_portal_visible) VALUES($1,'office','intake_appointment',$2,'termin','Nicht erlaubt','2026-11-01T10:00:00Z','2026-11-01T11:00:00Z',$2,false,false)";
  await assert.rejects(db.query(query,[id.tenant,id.client]),/policy|security/i);
  await actor('office_staff',{denied:'office.appointments.edit'});
  await assert.rejects(db.query(query,[id.tenant,id.client]),/policy|security/i);
});

await test('2027 publication creates separate editions without changing legacy templates and denies client writes', async () => {
  await seed(); await db.exec('RESET ROLE');
  const before = (await db.query('SELECT to_jsonb(t) AS row FROM intake_document_system_templates t ORDER BY template_key')).rows;
  const catalogueSchema = read('../migrations/20261013080703_central_document_catalog.sql').match(/CREATE TABLE IF NOT EXISTS public\.central_document_catalog \([\s\S]*?\n\);/)[0];
  await db.exec(catalogueSchema);
  await db.exec(read('../schema/intake_documents_2027.sql'));
  assert.deepEqual((await db.query('SELECT to_jsonb(t) AS row FROM intake_document_system_templates t ORDER BY template_key')).rows, before);
  assert.equal((await db.query('SELECT count(*)::int AS count FROM central_document_catalog WHERE version=3')).rows[0].count, 40);
  await actor();
  assert.equal((await db.query('SELECT template_key FROM intake_document_templates_2027')).rows.length, 12);
  await assert.rejects(db.exec("UPDATE intake_document_templates_2027 SET html_content='Changed'"), /permission denied/);
  await db.exec('RESET ROLE; SET ROLE anon');
  await assert.rejects(db.exec('SELECT * FROM intake_document_templates_2027'), /permission denied/);
});
await test('legacy completion remains valid after the separate 2027 publication', async () => {
  await seed(); const saved = await save(); await actor('service_role');
  assert.equal((await complete(saved)).confirmed, true);
});
async function edition2027Form(stationary = false) {
  await db.exec('RESET ROLE');
  templateSnapshots = new Map((await db.query('SELECT to_jsonb(t) AS snapshot FROM intake_document_templates_2027 t')).rows.map(({ snapshot }) => [snapshot.template_key, snapshot]));
  const value = form({ intakeWorkflowVersion: 2, intakeStage: 'full_intake', intakeTemplateEdition: '2027', intakeLegalDetails: { 'signer.name': 'Maria Beispiel', 'employee.name': 'Anna Beispiel' },
    careContexts: [stationary ? 'stationary_care' : 'daily_assistance'], intakeContractType: stationary ? 'stationary_care' : 'assist' });
  value.intakeDocuments = ['privacy_consent_default', stationary ? 'client_contract_stationary_care' : 'client_contract_assist'].map(key => {
    const template = templateSnapshots.get(key), entry = document(key, template.document_type);
    entry.title = template.title; entry.version = 4;
    entry.signatures = Object.fromEntries(template.signature_slots.map(slot => [slot.role, { role: slot.role, dataUrl: png, signedAt: renderedAt, signerName: slot.role === 'employee' ? 'Anna Beispiel' : 'Maria Beispiel' }]));
    return entry;
  });
  await actor(); return value;
}
await test('2027 completion binds new snapshots and both roles atomically, rejecting missing employee consent', async () => {
  await seed(); const value = await edition2027Form(), saved = await save(value), docs = completionDocuments(value);
  await actor('service_role');
  const missing = structuredClone(docs); delete missing[1].signatures.employee;
  await assert.rejects(complete(saved, missing), /Unterschrift|Original/);
  assert.equal((await counts()).client_intake_documents, 0);
  await actor('service_role');
  assert.equal((await complete(saved, docs)).confirmed, true);
  await db.exec('RESET ROLE');
  const originals = (await db.query('SELECT template_snapshot, signatures_json FROM client_intake_private.client_intake_originals')).rows;
  assert.equal(originals.length, 2);
  assert.ok(originals.every(row => row.template_snapshot.system.version === 4));
  assert.equal(originals.reduce((sum, row) => sum + Object.keys(row.signatures_json).length, 0), 3);
});
await test('2027 WBVG paper completion is rejected without partial activation', async () => {
  await seed(); const value = await edition2027Form(true), saved = await save(value);
  await actor('service_role');
  await assert.rejects(complete(saved, completionDocuments(value)), /WBVG/);
  assert.equal((await counts()).client_intake_documents, 0);
});
await db.close();
