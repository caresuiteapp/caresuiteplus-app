import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';

let db: PGlite;
const tenant = '10000000-0000-4000-8000-000000000001';
const otherTenant = '10000000-0000-4000-8000-000000000002';
const actor = '20000000-0000-4000-8000-000000000001';
const otherActor = '20000000-0000-4000-8000-000000000002';
const client = '30000000-0000-4000-8000-000000000001';
const otherClient = '30000000-0000-4000-8000-000000000002';
const sameTenantClient = '30000000-0000-4000-8000-000000000003';
const noPflegeClient = '30000000-0000-4000-8000-000000000004';
const session = '40000000-0000-4000-8000-000000000001';
const otherSession = '40000000-0000-4000-8000-000000000002';
const role = '50000000-0000-4000-8000-000000000001';
const otherRole = '50000000-0000-4000-8000-000000000002';
const employee = '60000000-0000-4000-8000-000000000001';
const view = 'pflege.access,pflege.medications.view,office.clients.view,office.clients.view_sensitive';
const manage = view + ',pflege.medications.manage';
const patient = { firstName: 'Michaela', lastName: 'Muster', birthDate: '1936-12-13', insuranceId: 'B987563276' };
const plan = { version: '028', patient, rows: [{ kind: 'medication', name: 'Beispiel A', morning: '0,5' }, { kind: 'medication', name: 'Beispiel B', doseText: 'nach ärztlicher Anordnung' }] };

async function current(sessionTenant = tenant, sessionActor = actor, permissions = manage, overrides: Record<string, unknown> = {}) {
  const claims = { role: 'authenticated', session_id: sessionActor === actor ? session : otherSession,
    exp: Math.floor(Date.now() / 1000) + 3600, ...overrides };
  await db.query("select set_config('test.tenant',$1,false),set_config('test.actor',$2,false),set_config('test.permissions',$3,false),set_config('request.jwt.claims',$4,false)",
    [sessionTenant, sessionActor, permissions, JSON.stringify(claims)]);
  await db.exec('reset role;');
  await db.query('delete from public.role_permissions where role_id = $1', [role]);
  await db.query("insert into public.role_permissions(role_id, permission_key) select $1, unnest(string_to_array($2, ','))", [role, permissions]);
  await db.exec('set role authenticated;');
}
async function rpc<T>(fn: string, args: unknown[]): Promise<T> {
  const { rows } = await db.query<{ result: T }>(`select public.${fn}(${args.map((_, i) => '$' + (i + 1)).join(',')}) as result`, args);
  return rows[0].result;
}
const source = (key = randomUUID(), version = '028') => Buffer.from(`<MP v="${version}" U="${key}" l="de-DE"><P g="Michaela" f="Muster" b="19361213"/><A n="Beispiel" t="2026-07-01T12:00:00"/><S><M a="Beispiel A" m="0,5"/></S></MP>`);
type Draft = { id: string; clientId: string; plan: typeof plan; sourceSha256: string; confirmed: unknown[] };
const save = (args: { request?: string; clientId?: string; bytes?: Buffer; original?: unknown; assignment?: string; reason?: string; mimeType?: string } = {}) =>
  rpc<Draft>('save_medication_plan_import', [tenant, actor, args.request ?? randomUUID(), args.clientId ?? client,
    args.assignment ?? 'exact', args.reason ?? '', 'original.xml', args.mimeType ?? 'application/xml', (args.bytes ?? source()).toString('base64'), JSON.stringify(args.original ?? plan)]);

beforeAll(async () => {
  db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema extensions; create extension pgcrypto with schema extensions;
    create schema auth; create table auth.sessions(id uuid primary key, user_id uuid, not_after timestamptz);
    create table public.tenants(id uuid primary key);
    create table public.roles(id uuid primary key, tenant_id uuid, key text);
    create table public.profiles(id uuid primary key, tenant_id uuid, is_active boolean, status text, auth_user_id uuid, role_id uuid);
    create table public.role_permissions(role_id uuid, permission_key text, restrictions jsonb, tenant_id uuid);
    create table public.role_permission_sets(tenant_id uuid, role_key text, permission_key text);
    create table public.employees(id uuid primary key, tenant_id uuid, profile_id uuid);
    create table public.employee_permission_overrides(employee_id uuid, tenant_id uuid, permission_key text, allowed boolean,
      valid_from timestamptz, valid_until timestamptz);
    create table public.clients(id uuid primary key, tenant_id uuid, first_name text, last_name text,
      date_of_birth date, insurance_number text, status text, deleted_at timestamptz);
    create table public.client_module_assignments(tenant_id uuid, client_id uuid, module_key text, is_active boolean, status text);
    create table public.medications(id uuid);
    create table public.medication_administrations(id uuid);
    create table public.client_documents(id uuid);
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
    create function public.current_tenant_id() returns uuid language sql as $$select nullif(current_setting('test.tenant',true),'')::uuid$$;
    create function public.resolve_current_profile_id() returns uuid language sql as $$select auth.uid()$$;
    create function public.current_portal_type() returns text language sql as $$select null::text$$;
    create function public.platform_tenant_access_allowed(uuid, boolean) returns boolean language sql as $$select true$$;
    insert into auth.sessions values ('${session}','${actor}',now()+interval '1 hour'),
      ('${otherSession}','${otherActor}',now()+interval '1 hour');
    insert into public.tenants values ('${tenant}'), ('${otherTenant}');
    insert into public.roles values ('${role}',null,'owner'), ('${otherRole}','${otherTenant}','owner');
    insert into public.profiles values ('${actor}','${tenant}',true,'active',null,'${role}'),
      ('${otherActor}','${otherTenant}',true,'active',null,'${otherRole}'), (gen_random_uuid(),'${otherTenant}',true,'active','${actor}','${otherRole}');
    insert into public.role_permissions(role_id,permission_key) select '${otherRole}', unnest(string_to_array('${manage}', ','));
    insert into public.employees values ('${employee}','${tenant}','${actor}');
    insert into public.clients values
      ('${client}','${tenant}','Michaela','Muster','1936-12-13','B987563276','active',null),
      ('${otherClient}','${otherTenant}','Michaela','Muster','1936-12-13','B987563276','active',null),
      ('${sameTenantClient}','${tenant}','Ada','Beispiel','1990-10-02',null,'active',null),
      ('${noPflegeClient}','${tenant}','Andere','Muster','1940-01-01',null,'active',null);
    insert into public.client_module_assignments values
      ('${tenant}','${client}','pflege',true,'active'),
      ('${otherTenant}','${otherClient}','pflege',true,'active'),
      ('${tenant}','${sameTenantClient}','pflege',true,'active');
  `);
  await db.exec(readFileSync('supabase/migrations/20261112104353_medication_plan_import_drafts.sql', 'utf8'));
}, 20_000);

beforeEach(async () => {
  await db.exec('reset role; set role authenticated;');
  await current();
});
afterAll(async () => { await db?.close(); });

it('liefert nur die eindeutig passende aktive Pflegeakte aus dem eigenen Mandanten', async () => {
  expect(await rpc('find_medication_plan_clients', [tenant, actor, null, JSON.stringify(patient)])).toEqual({
    exact: true, clients: [{ id: client, firstName: 'Michaela', lastName: 'Muster', birthDate: '1936-12-13' }],
  });
  for (const identity of [{ ...patient, birthDate: null }, { ...patient, insuranceId: 'B987563277' }]) {
    expect(await rpc('find_medication_plan_clients', [tenant, actor, null, JSON.stringify(identity)])).toEqual({ exact: false, clients: [] });
  }
  expect(await rpc('find_medication_plan_clients', [tenant, actor, '%', null])).toEqual({ exact: false, clients: [] });
  const found = await rpc<{ clients: { id: string }[] }>('find_medication_plan_clients', [tenant, actor, 'Muster', null]);
  expect(found.clients.map(c => c.id)).toEqual([client]);
});

it('schließt automatische Zuordnung bei gleichnamigen aktiven Fällen auch ohne Pflegezuordnung aus', async () => {
  await db.exec(`reset role; begin; update clients set first_name='Michaela', date_of_birth='1936-12-13' where id='${noPflegeClient}'; set role authenticated;`);
  try {
    expect(await rpc('find_medication_plan_clients', [tenant, actor, null, JSON.stringify(patient)])).toEqual({ exact: false, clients: [] });
  } finally {
    await db.exec('rollback; set role authenticated;');
  }
});

it('speichert eingefrorenes Original und exakte Werte, ohne Gaben oder Verordnungen anzulegen', async () => {
  const request = randomUUID(), bytes = source();
  const draft = await save({ request, bytes });
  expect(draft).toMatchObject({ clientId: client, plan, sourceSha256: createHash('sha256').update(bytes).digest('hex'), confirmed: [] });
  expect(draft).not.toHaveProperty('sourceBase64');
  expect(await save({ request, bytes })).toEqual(draft);
  await expect(save({ bytes })).rejects.toThrow(/erneut/);
  await expect(save({ request, bytes, original: { ...plan, rows: [{ kind: 'medication', name: 'Abweichung' }] } })).rejects.toThrow(/erneut/);
  expect(await rpc('get_medication_plan_source', [tenant, actor, draft.id])).toMatchObject({ sourceBase64: bytes.toString('base64'), sourceSha256: draft.sourceSha256 });
  expect(await rpc('list_medication_plan_imports', [tenant, actor, client])).toContainEqual(
    expect.objectContaining({ id: draft.id, positionCount: 2, confirmedCount: 0 }),
  );
  await db.exec('reset role;');
  expect((await db.query('select * from public.medications')).rows).toHaveLength(0);
  expect((await db.query('select * from public.medication_administrations')).rows).toHaveLength(0);
  expect((await db.query('select * from public.client_documents')).rows).toHaveLength(0);
});

it('verbietet ungeprüfte, fremde und widersprüchliche Aktenzuordnungen', async () => {
  await expect(save({ clientId: otherClient })).rejects.toThrow(/Pflegebezug/);
  await expect(save({ clientId: noPflegeClient })).rejects.toThrow(/Pflegebezug/);
  await expect(save({ clientId: sameTenantClient, assignment: 'manual', reason: 'Abweichende Akte ausgewählt.' })).rejects.toThrow(/Klientenzuordnung/);
  const incomplete = { ...plan, patient: { ...patient, birthDate: null } };
  await expect(save({ original: incomplete, assignment: 'manual', reason: 'kurz' })).rejects.toThrow(/ungültig/);
  const assigned = await save({ original: incomplete, assignment: 'manual', reason: 'Geburtsdatum im Original manuell geprüft.' });
  expect(assigned.clientId).toBe(client);
  await expect(save({ assignment: 'manual', reason: 'Aktenbezug geprüft.', original: { ...plan, patient: { ...patient, insuranceId: 'B987563277' } } })).rejects.toThrow(/Klientenzuordnung/);
  await expect(save({ assignment: 'manual', reason: 'Aktenbezug geprüft.', original: { ...plan, patient: { ...patient, birthDate: '1936-12-14' } } })).rejects.toThrow(/Klientenzuordnung/);
  await expect(save({ mimeType: 'application/pdf' })).rejects.toThrow(/ungültig/);
});

it('bestätigt nur die ausgewählte Position mit unveränderlichem Autor und Zeitpunkt', async () => {
  const draft = await save();
  const receipt = await rpc('confirm_medication_plan_import_position', [tenant, actor, draft.id, 1]);
  expect(receipt).toMatchObject({ rowIndex: 1, actorId: actor });
  expect(await rpc('confirm_medication_plan_import_position', [tenant, actor, draft.id, 1])).toEqual(receipt);
  expect(await rpc('get_medication_plan_import', [tenant, actor, draft.id])).toMatchObject({ confirmed: [receipt], plan });
  await expect(rpc('confirm_medication_plan_import_position', [tenant, actor, draft.id, 2])).rejects.toThrow(/Ungültige Position/);
  await current(tenant, actor, view);
  await expect(rpc('confirm_medication_plan_import_position', [tenant, actor, draft.id, 0])).rejects.toThrow(/Pflegebezug/);
  await db.exec('reset role;');
  await expect(db.query("update medication_plan_import_private.medication_plan_import_confirmations set confirmed_at = now() where import_id = $1", [draft.id])).rejects.toThrow(/überschrieben/);
});

it('verweigert fremde Sitzungen, fehlende Rechte, direkte Tabellenabfragen und anonyme RPCs', async () => {
  const draft = await save();
  await current(otherTenant, otherActor);
  await expect(rpc('get_medication_plan_import', [otherTenant, otherActor, draft.id])).rejects.toThrow(/nicht verfügbar/);
  await expect(rpc('get_medication_plan_source', [tenant, actor, draft.id])).rejects.toThrow(/Pflegebezug/);
  await current(tenant, actor, 'pflege.medications.view');
  await expect(rpc('get_medication_plan_import', [tenant, actor, draft.id])).rejects.toThrow(/Pflegebezug/);
  await expect(db.query('select source_content from medication_plan_import_private.medication_plan_imports')).rejects.toThrow(/permission denied/);
  await db.exec('reset role; set role anon;');
  await expect(rpc('get_medication_plan_import', [tenant, actor, draft.id])).rejects.toThrow(/permission denied/);
});

it('akzeptiert ausschließlich den passenden, nicht abgelaufenen Arbeitsbereich-Login', async () => {
  const draft = await save();
  for (const claims of [{ exp: 1 }, { session_id: otherSession }, { session_id: 'fehlend' },
    { is_anonymous: true }, { app_metadata: { portal_type: 'employee' } }]) {
    await current(tenant, actor, manage, claims);
    await expect(rpc('get_medication_plan_source', [tenant, actor, draft.id])).rejects.toThrow(/Pflegebezug/);
  }
  await current(tenant, actor, view);
  await expect(rpc('find_medication_plan_clients', [tenant, actor, 'Muster', null])).rejects.toThrow(/Pflegebezug/);
  await current();
  await db.exec(`reset role; begin; update auth.sessions set not_after=now()-interval '1 second' where id='${session}'; set role authenticated;`);
  try {
    await expect(rpc('get_medication_plan_source', [tenant, actor, draft.id])).rejects.toThrow(/Pflegebezug/);
  } finally {
    await db.exec('rollback; set role authenticated;');
  }
});

it('unterstützt die drei strukturierten BMP-Versionen ohne unbekannte Formate anzunehmen', async () => {
  for (const version of ['026','027','028']) {
    const original = { ...plan, version };
    expect(await save({ original, bytes: source(randomUUID(), version) })).toMatchObject({ plan: original });
  }
  await expect(save({ original: { ...plan, version: '099' } })).rejects.toThrow(/ungültig/);
});

it('bindet grants an die eigene Rolle und respektiert Mandanten- sowie Mitarbeitergrenzen', async () => {
  const draft = await save();
  await current(tenant, actor, manage.replace('office.clients.view_sensitive', 'office.other'));
  // An active profile of the same login in another tenant still has this grant.
  await expect(rpc('get_medication_plan_import', [tenant, actor, draft.id])).rejects.toThrow(/Pflegebezug/);
  await current();
  await db.exec(`reset role; begin; insert into public.role_permission_sets values ('${tenant}','business_admin','pflege.access'); set role authenticated;`);
  try {
    await expect(rpc('get_medication_plan_import', [tenant, actor, draft.id])).rejects.toThrow(/Pflegebezug/);
  } finally {
    await db.exec('rollback; set role authenticated;');
  }
  await db.exec(`reset role; begin; insert into public.employee_permission_overrides values ('${employee}','${tenant}','pflege.medications.manage',false,now()-interval '1 minute',null); set role authenticated;`);
  try {
    expect(await rpc('get_medication_plan_import', [tenant, actor, draft.id])).toMatchObject({ id: draft.id });
    await expect(rpc('confirm_medication_plan_import_position', [tenant, actor, draft.id, 0])).rejects.toThrow(/Pflegebezug/);
  } finally {
    await db.exec('rollback; set role authenticated;');
  }
});
