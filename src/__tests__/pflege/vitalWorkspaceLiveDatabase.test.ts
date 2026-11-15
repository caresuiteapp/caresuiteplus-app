import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getVitalDefinition, VITAL_SIGN_CATALOG } from '@/lib/pflege/vitalCatalog';
import { assertVitalMeasurementWriteReceiptWeb, assertVitalDetailWriteReceiptWeb } from '@/lib/pflege/vitalNativeWriteReceipt.web';
import type { VitalMeasurementPayload } from '@/lib/pflege/vitalMeasurementDomain';

const id = (n: number) => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const tenant = id(1), otherTenant = id(2), author = id(11), reader = id(12), outsider = id(13), office = id(14);
const people = [author, reader, outsider, office];
const subject = id(31), secondCase = id(32), archived = id(33), otherCase = id(34), assistOnly = id(35);
const migration = readFileSync('supabase/migrations/20261115011117_pflege_vital_workspace_live.sql', 'utf8');
const preferencesMigration = readFileSync('supabase/migrations/20261115013804_pflege_vital_catalog_preferences.sql', 'utf8');
const liveBefore = readFileSync('supabase/migrations/20260812100000_vital_signs_live_final.sql', 'utf8');
const vitalTables = liveBefore.slice(liveBefore.indexOf('CREATE TABLE IF NOT EXISTS public.vital_sign_catalog'),
  liveBefore.indexOf('CREATE OR REPLACE FUNCTION public.vital_actor_can_record'));
const legacyHistory = readFileSync('supabase/patches/ambulatory_vital_documentation.sql', 'utf8')
  .match(/create table if not exists public.vital_measurement_follow_ups\([\s\S]+?\n\);/)?.[0];
const legacyInvalidations = readFileSync('supabase/patches/ambulatory_vital_invalidations.sql', 'utf8')
  .match(/create table if not exists public.vital_measurement_invalidations\([\s\S]+?\n\);/)?.[0];

let db: PGlite;
let observedAt: string;
let definitionVersion: string;
let root: string;
let rootReceipt: Record<string, unknown>;
const request = id(41);
const observationRequest = id(42);
const correctionRequest = id(43);

async function actor(profile: string, options: { aal?: string; expired?: boolean; portal?: string; session?: string } = {}) {
  const index = people.indexOf(profile);
  const claims = {
    sub: id(101 + index), role: 'authenticated', session_id: options.session ?? id(201 + index),
    exp: Math.floor(Date.now() / 1000) + (options.expired ? -60 : 3600), aal: options.aal ?? 'aal2',
    app_metadata: options.portal ? { portal_type: options.portal } : {},
  };
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify(claims)]);
  await db.exec('set role authenticated');
}

const packet = (overrides: Partial<VitalMeasurementPayload> = {}): VitalMeasurementPayload => ({
  clientId: subject, type: 'pulse', occurredAt: observedAt, valuesJson: '{"value":72}',
  contextJson: '{"rhythm":"regelmäßig"}', note: 'Synthetische Messung', catalogVersion: definitionVersion,
  configurationVersion: 'none', ...overrides,
});
const one = async (sql: string, parameters: unknown[] = []) => (await db.query<Record<string, unknown>>(sql, parameters)).rows[0]!;
const record = (rid: string, value: VitalMeasurementPayload) => one(
  'select public.record_ambulatory_vital_measurement($1,$2) id', [rid, JSON.stringify(value)]);
const confirm = (mid: string, rid: string, value: VitalMeasurementPayload) => one(
  'select public.confirm_ambulatory_vital_measurement($1,$2,$3) receipt', [mid, rid, JSON.stringify(value)]);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth; create schema account_security;
    create table auth.sessions (id uuid primary key, user_id uuid, not_after timestamptz, aal text);
    create table account_security.device_sessions (session_id uuid, revoked_at timestamptz);
    create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
    create function auth.uid() returns uuid language sql stable as $$select nullif(auth.jwt()->>'sub','')::uuid$$;
    create function account_security.session_id() returns uuid language sql stable as $$select nullif(auth.jwt()->>'session_id','')::uuid$$;
    create function account_security.allowed_session() returns boolean language sql stable security definer as $$
      select exists (select 1 from auth.sessions s where s.id=account_security.session_id()
        and s.user_id=auth.uid() and (s.not_after is null or s.not_after>now()) and s.aal='aal2' and auth.jwt()->>'aal'='aal2')
      and not exists (select 1 from account_security.device_sessions d where d.session_id=account_security.session_id() and d.revoked_at is not null)
    $$;
    create table public.tenants(id uuid primary key);
    create table public.roles(id uuid primary key, tenant_id uuid, key text not null);
    create table public.role_permissions(role_id uuid, tenant_id uuid, permission_key text, can_view boolean, can_update boolean);
    create table public.profiles(id uuid primary key, tenant_id uuid not null, role_id uuid, auth_user_id uuid,
      display_name text, email text, status text, is_active boolean);
    create function public.resolve_current_profile_id() returns uuid language sql stable security definer as $$
      select p.id from public.profiles p where p.id=auth.uid() or p.auth_user_id=auth.uid()
      order by (p.id=auth.uid()) desc limit 1
    $$;
    create function public.current_tenant_id() returns uuid language sql stable security definer as $$
      select tenant_id from public.profiles where id=public.resolve_current_profile_id()
    $$;
    create function public.current_portal_type() returns text language sql stable as $$
      select auth.jwt()#>>'{app_metadata,portal_type}'
    $$;
    create type public.client_status as enum ('lead','active','paused','inactive','archived','deceased','blocked','deleted');
    create table public.clients(id uuid primary key, tenant_id uuid not null, first_name text, last_name text,
      client_number text, status public.client_status, deleted_at timestamptz);
    create table public.client_module_assignments(id uuid primary key default gen_random_uuid(), tenant_id uuid not null,
      client_id uuid not null, module_key text, status text, is_active boolean);
    create table public.client_timeline_events(tenant_id uuid, client_id uuid, event_type text, icon text,
      title text, subtitle text, status text, actor_name text, is_internal boolean, metadata jsonb);
    insert into public.tenants values ('${tenant}'),('${otherTenant}');
    ${vitalTables}
    ${legacyHistory}
    ${legacyInvalidations}
  `);
  for (const [index, profile] of people.entries()) {
    const scope = profile === outsider ? otherTenant : tenant;
    const role = id(301 + index);
    await db.query('insert into public.roles values ($1,$2,$3)', [role, scope, 'pflege-fixture-' + index]);
    await db.query("insert into public.profiles values ($1,$2,$3,$4,'Synthetic account','fixture@example.invalid','active',true)",
      [profile, scope, role, id(101 + index)]);
    await db.query("insert into auth.sessions values ($1,$2,clock_timestamp()+interval '1 hour','aal2')",
      [id(201 + index), id(101 + index)]);
    if (profile !== office) await db.query("insert into public.role_permissions(role_id,tenant_id,permission_key) values ($1,$2,'pflege.vitals.view')", [role, scope]);
    if (profile === author || profile === outsider) await db.query(
      "insert into public.role_permissions(role_id,tenant_id,permission_key) values ($1,$2,'pflege.vitals.manage')", [role, scope]);
  }
  for (const [index, clientId] of [subject, secondCase, archived, otherCase, assistOnly].entries()) {
    const scope = clientId === otherCase ? otherTenant : tenant;
    await db.query("insert into public.clients values ($1,$2,'Synthetic','Case',$3,$4,null)",
      [clientId, scope, 'A-' + index, clientId === archived ? 'archived' : 'active']);
    await db.query("insert into public.client_module_assignments(tenant_id,client_id,module_key,status,is_active) values ($1,$2,$3,'active',true)",
      [scope, clientId, clientId === assistOnly ? 'assist' : 'pflege']);
  }
  await db.exec(migration);
  // Reapplying an already reviewed release leaves the grants, triggers and catalog stable.
  await db.exec(migration);
  await db.exec(preferencesMigration);
  observedAt = new Date(Date.now() - 120_000).toISOString();
  // Keep the full precision supplied by PostgREST to the application.
  definitionVersion = String((await one("select to_char(updated_at at time zone 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') version from public.vital_sign_catalog where key='pulse'")).version);
}, 35_000);

afterAll(async () => { await db?.close(); });

describe('Live-DB-Vertrag für Vitalwerte', () => {
  it('begrenzte Fallauswahl nur mit eigenen Vitalrechten und aktiver Pflegezuordnung', async () => {
    await actor(author);
    expect((await db.query('select id from public.list_ambulatory_vital_cases(null,1)')).rows).toEqual([{ id: subject }]);
    expect((await db.query('select id from public.list_ambulatory_vital_cases($1,2)', [subject])).rows).toEqual([{ id: secondCase }]);
    expect((await db.query('select id from public.get_ambulatory_vital_case($1)', [otherCase])).rows).toEqual([]);
    expect((await db.query('select key from public.vital_sign_catalog')).rows).toHaveLength(42);
    await actor(office);
    await expect(db.query('select * from public.list_ambulatory_vital_cases(null,20)')).rejects.toMatchObject({ code: '42501' });
  });

  it('speichert tatsächliche Messzeit, bestätigt das vollständige Original und wiederholt idempotent', async () => {
    await actor(author);
    const data = packet();
    root = String((await record(request, data)).id);
    rootReceipt = (await confirm(root, request, data)).receipt as Record<string, unknown>;
    expect(assertVitalMeasurementWriteReceiptWeb(rootReceipt, { tenantId: tenant, actorId: author, clientId: subject }, root, request, data)).toEqual(rootReceipt);
    expect(await record(request, data)).toEqual({ id: root });
    await expect(record(request, packet({ note: 'Geändert' }))).rejects.toMatchObject({ code: '23514' });
    expect(new Date(String(rootReceipt.measured_at)).toISOString()).toBe(observedAt);
    expect((await one('select count(*)::int count from public.vital_sign_measurements')).count).toBe(1);
  });

  it('weist fremde, deaktivierte, geänderte und falsch zusammengesetzte Messaufträge ab', async () => {
    await actor(author);
    await expect(record(id(50), packet({ clientId: otherCase }))).rejects.toMatchObject({ code: '42501' });
    await expect(record(id(51), packet({ clientId: archived }))).rejects.toMatchObject({ code: '42501' });
    await expect(record(id(52), packet({ clientId: assistOnly }))).rejects.toMatchObject({ code: '42501' });
    await expect(record(id(53), packet({ catalogVersion: observedAt }))).rejects.toMatchObject({ code: '40001' });
    await expect(record(id(54), packet({ valuesJson: '{"systolic":123}' }))).rejects.toMatchObject({ code: '23514' });
    await expect(record(id(55), packet({ occurredAt: '2036-01-01T00:00:00Z' }))).rejects.toMatchObject({ code: '23514' });
    await actor(reader);
    await expect(record(id(56), packet())).rejects.toMatchObject({ code: '42501' });
    await expect(confirm(root, request, packet())).rejects.toMatchObject({ code: 'P0V01' });
  });

  it('führt Verlauf und Korrektur mit eigenen, unveränderten Quittungen', async () => {
    await actor(author);
    const context = { tenantId: tenant, clientId: subject, actorId: author, measurementId: root, measurement: rootReceipt };
    const follow = { measurementId: root, observedAt: new Date(Date.now() - 20_000).toISOString(),
      observation: 'Synthetische Kontrolle', action: 'Synthetische Reaktion', responsiblePerson: 'Synthetic author',
      outcome: 'resolved' as const, nextReviewAt: '' };
    const followId = String((await one('select public.record_ambulatory_vital_follow_up($1,$2) id', [observationRequest, JSON.stringify(follow)])).id);
    const confirmedFollow = (await one('select public.confirm_ambulatory_vital_follow_up($1,$2,$3) receipt',
      [followId, observationRequest, JSON.stringify(follow)])).receipt;
    expect(assertVitalDetailWriteReceiptWeb(confirmedFollow, context, followId, observationRequest, 'follow_up', follow)).toEqual(confirmedFollow);
    const correction = { measurementId: root, reason: 'Synthetischer Korrekturgrund' };
    const correctionId = String((await one('select public.invalidate_ambulatory_vital_measurement($1,$2) id',
      [correctionRequest, JSON.stringify(correction)])).id);
    const confirmedCorrection = (await one('select public.confirm_ambulatory_vital_invalidation($1,$2,$3) receipt',
      [correctionId, correctionRequest, JSON.stringify(correction)])).receipt;
    expect(assertVitalDetailWriteReceiptWeb(confirmedCorrection, context, correctionId, correctionRequest, 'invalidation', correction)).toEqual(confirmedCorrection);
    expect((await one('select public.invalidate_ambulatory_vital_measurement($1,$2) id',
      [correctionRequest, JSON.stringify(correction)])).id).toBe(correctionId);
    await expect(db.query('select public.record_ambulatory_vital_follow_up($1,$2)', [id(65), JSON.stringify(follow)]))
      .rejects.toMatchObject({ code: '23514' });

    await actor(reader);
    expect((await db.query('select id from public.vital_measurement_follow_ups')).rows).toEqual([{ id: followId }]);
    expect((await db.query('select id from public.vital_measurement_invalidations')).rows).toEqual([{ id: correctionId }]);
    await actor(outsider);
    expect((await db.query('select id from public.vital_measurement_follow_ups')).rows).toEqual([]);
    expect((await db.query('select id from public.vital_measurement_invalidations')).rows).toEqual([]);
    await db.exec('reset role');
    await expect(db.query('update public.vital_sign_measurements set note = null where id=$1', [root])).rejects.toMatchObject({ code: '42501' });
  });

  it('respektiert aktive Sitzungen, MFA, Mandantengrenze und Portalsitzungen', async () => {
    for (const options of [{ aal: 'aal1' }, { expired: true }, { portal: 'employee' }, { session: id(400) }]) {
      await actor(author, options);
      await expect(record(id(57), packet())).rejects.toMatchObject({ code: '42501' });
      expect((await db.query('select id from public.vital_sign_measurements')).rows).toEqual([]);
    }
    await db.exec('reset role; set role anon');
    await expect(db.query('select * from public.list_ambulatory_vital_cases(null, 2)')).rejects.toMatchObject({ code: '42501' });
  });

  it('lässt ältere individuelle Konfigurationen ohne erfundene Bewertung speichern', async () => {
    const pressure = getVitalDefinition('blood_pressure')!;
    await db.exec('reset role');
    await db.query(`insert into public.client_vital_sign_settings(tenant_id,client_id,vital_key,enabled,limits,schedule,created_by,updated_by)
      values ($1,$2,$3,true,'{"systolic":{"max":100}}','{}',$4,$4)`, [tenant, subject, pressure.key, author]);
    const catalog = await one(`select to_char(updated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') version from public.vital_sign_catalog where key=$1`, [pressure.key]);
    const settings = await one(`select to_char(updated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') version from public.client_vital_sign_settings where client_id=$1 and vital_key=$2`, [subject, pressure.key]);
    await actor(author);
    const data = packet({ type: pressure.key, valuesJson: '{"systolic":122,"diastolic":78}', catalogVersion: String(catalog.version), configurationVersion: String(settings.version) });
    const writeId = id(70), reading = String((await record(writeId, data)).id);
    const receipt = (await confirm(reading, writeId, data)).receipt as Record<string, unknown>;
    expect(receipt.flag_status).toBe('unrated');
    expect(assertVitalMeasurementWriteReceiptWeb(receipt, { tenantId: tenant, actorId: author, clientId: subject }, reading, writeId, data)).toEqual(receipt);
  });

  it('speichert und bestätigt alle 42 Katalogarten mit gültiger Fallfreigabe', async () => {
    await db.exec('reset role');
    const cases = await db.query<{ key: string; updated_at: string }>(`select key,
      to_char(updated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') updated_at from public.vital_sign_catalog`);
    const measurementVersions = new Map(cases.rows.map(item => [item.key, item.updated_at]));
    for (const definition of VITAL_SIGN_CATALOG) {
      await db.query(`insert into public.client_vital_sign_settings(tenant_id,client_id,vital_key,enabled,limits,schedule,created_by,updated_by)
        values ($1,$2,$3,true,'{}','{}',$4,$4)`, [tenant, secondCase, definition.key, author]);
    }
    const settings = await db.query<{ vital_key: string; updated_at: string }>(`select vital_key,
      to_char(updated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') updated_at from public.client_vital_sign_settings where client_id=$1`, [secondCase]);
    const settingVersions = new Map(settings.rows.map(item => [item.vital_key, item.updated_at]));
    await actor(author);
    for (const [index, definition] of VITAL_SIGN_CATALOG.entries()) {
      const values = Object.fromEntries(definition.components.map(component => [component.key, 1]));
      if (definition.key === 'fluid_balance') values.balance = values.intake - values.output;
      if (definition.key === 'gcs') values.total = values.eyes + values.verbal + values.motor;
      const context = definition.key === 'pain_score' ? { scale: 'NRS' } : definition.key === 'urine_output'
        ? { period: 'Synthetischer Zeitraum' } : definition.key === 'fluid_balance'
          ? { period: 'Synthetischer Zeitraum', completeness: 'complete' } : {};
      const data = packet({ clientId: secondCase, type: definition.key,
        catalogVersion: measurementVersions.get(definition.key)!, configurationVersion: settingVersions.get(definition.key)!,
        valuesJson: JSON.stringify(values), contextJson: JSON.stringify(context) });
      const writeId = id(900 + index);
      const measurement = String((await record(writeId, data)).id);
      const receipt = (await confirm(measurement, writeId, data)).receipt;
      expect(assertVitalMeasurementWriteReceiptWeb(receipt, { tenantId: tenant, actorId: author, clientId: secondCase },
        measurement, writeId, data), definition.key).toEqual(receipt);
    }
  });

  it('aktiviert eine Messart fallbezogen und ändert weder andere Einstellungen noch Fachfreigaben', async () => {
    const kind = 'body_surface_area';
    const versionSql = `to_char(updated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;
    await actor(author);
    const version = (await one(`select ${versionSql} version from public.vital_sign_catalog where key=$1`, [kind])).version;
    const change = (enabled: boolean, expected: unknown, client = subject) => one(
      'select public.configure_ambulatory_vital_choice($1,$2,$3,$4,$5) enabled', [client, kind, enabled, version, expected]);
    await expect(change(true, 'none', otherCase)).rejects.toMatchObject({code: '42501'});
    await expect(change(true, 'none', archived)).rejects.toMatchObject({code: '42501'});
    await actor(reader);
    await expect(change(true, 'none')).rejects.toMatchObject({code: '42501'});
    await actor(author);
    const data = packet({type: kind, catalogVersion: String(version), valuesJson: '{"value":1}'});
    await expect(record(id(989), data)).rejects.toMatchObject({code: '23514'});
    expect(await change(true, 'none')).toEqual({enabled: true});
    await expect(change(false, 'none')).rejects.toMatchObject({code: '40001'});

    const settings = () => one(`select enabled, limits, schedule, ${versionSql} version from public.client_vital_sign_settings
      where client_id=$1 and vital_key=$2`, [subject, kind]);
    const enabled = await settings();
    const writeId = id(990), writeData = {...data, configurationVersion: String(enabled.version)};
    const measurement = String((await record(writeId, writeData)).id);
    expect((await confirm(measurement, writeId, writeData)).receipt).toBeTruthy();

    await db.exec('reset role');
    await db.query(`update public.client_vital_sign_settings set limits='{"value":{"min":0}}', schedule='{"period":"Test"}'
      where client_id=$1 and vital_key=$2`, [subject, kind]);
    await actor(author);
    const original = await settings();
    expect(await change(false, original.version)).toEqual({enabled: false});
    expect(await settings()).toMatchObject({enabled: false, limits: original.limits, schedule: original.schedule});

    await db.exec('reset role');
    await db.query(`update public.client_vital_sign_settings set approved_by=$1 where client_id=$2 and vital_key=$3`,
      [author, subject, kind]);
    await actor(author);
    await expect(change(true, (await settings()).version)).rejects.toMatchObject({code: '42501'});
    expect((await settings()).enabled).toBe(false);
    await db.exec('reset role; set role anon');
    await expect(change(true, 'none')).rejects.toMatchObject({code: '42501'});
  });

});
