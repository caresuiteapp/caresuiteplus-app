import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes as strip } from 'node:module';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const form = (patch = {}) => ({
  firstName: ' Anna ',
  lastName: 'Meyer',
  dateOfBirth: '1940-02-29',
  insuranceNumber: ' A123456789 ',
  assignedModules: [],
  ...patch,
});

function repository(db) {
  const source = strip(read('src/lib/clients/repositories/clientIntakeRepository.supabase.ts')
    .replace(/^import[\s\S]*?;\n/gm, '')
    .replace(/\bexport /g, ''));
  const deps = {
    getSupabaseClient: () => db,
    toGermanSupabaseError: (error) => error?.message ?? 'Datenbankfehler',
    SERVICE_ERRORS: { supabaseUnavailable: 'Kein SDK' },
    isUuid: (value) => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value),
    normalizeIntakeCareLevelForDb: (value) => value || null,
    resolvePrimaryCostBearerName: () => null,
    resolveIntakeBillingProfileType: () => null,
    workflowStatusToRemote: (value) => value,
    fromUnknownTable: () => { throw new Error('Nicht Teil dieser Prüfung'); },
    isCostBearerTypeKey: () => false,
  };
  return new Function(
    ...Object.keys(deps),
    `${source}; return { findExactClientIdentityConflictFromIntake, createClientFromIntake };`,
  )(...Object.values(deps));
}

function database(rows = [], options = {}) {
  const calls = [];
  return {
    calls,
    from(table) {
      assert.equal(table, 'clients');
      const filters = [];
      let limit = Infinity;
      const query = {
        select(columns) { assert.equal(columns, 'id'); return query; },
        eq(field, value) { filters.push(['eq', field, value]); return query; },
        neq(field, value) { filters.push(['neq', field, value]); return query; },
        ilike(field, value) { filters.push(['ilike', field, value]); return query; },
        limit(value) { limit = value; return query; },
        then(resolve, reject) {
          calls.push(structuredClone(filters));
          if (options.failAt === calls.length) {
            return Promise.resolve({ data: null, error: { message: 'RLS-Prüfung fehlgeschlagen' } }).then(resolve, reject);
          }
          const data = rows.filter((row) => filters.every(([kind, field, value]) => {
            if (kind === 'eq') return row[field] === value;
            if (kind === 'neq') return row[field] !== value;
            const literal = value.replace(/\\([\\%_])/g, '$1').toLocaleLowerCase('de-DE');
            return String(row[field] ?? '').toLocaleLowerCase('de-DE') === literal;
          })).slice(0, limit).map((row) => ({ id: row.id }));
          return Promise.resolve({ data, error: null }).then(resolve, reject);
        },
      };
      return query;
    },
  };
}

test('exact tenant-scoped name and birth date blocks a second native identity', async () => {
  const db = database([{ id: id(20), tenant_id: id(1), first_name: 'anna', last_name: 'MEYER', date_of_birth: '1940-02-29', insurance_number: null }]);
  const result = await repository(db).findExactClientIdentityConflictFromIntake(id(1), form());
  assert.deepEqual(result, { ok: true, data: { clientId: id(20), match: 'name_birth_date' } });
  assert.equal(db.calls.length, 1);
  assert.ok(db.calls[0].some(([, field, value]) => field === 'tenant_id' && value === id(1)));
});

test('exact insurance number blocks after the name and birth date check', async () => {
  const db = database([{ id: id(21), tenant_id: id(1), first_name: 'Else', last_name: 'Schulz', date_of_birth: '1939-01-01', insurance_number: 'a123456789' }]);
  const result = await repository(db).findExactClientIdentityConflictFromIntake(id(1), form());
  assert.deepEqual(result, { ok: true, data: { clientId: id(21), match: 'insurance_number' } });
  assert.equal(db.calls.length, 2);
});

test('same identity in another tenant is never selected', async () => {
  const db = database([{ id: id(22), tenant_id: id(9), first_name: 'Anna', last_name: 'Meyer', date_of_birth: '1940-02-29', insurance_number: 'A123456789' }]);
  const result = await repository(db).findExactClientIdentityConflictFromIntake(id(1), form());
  assert.deepEqual(result, { ok: true, data: null });
});

test('the current recoverable draft is excluded but another duplicate remains blocking', async () => {
  const draft = id(30);
  const rows = [
    { id: draft, tenant_id: id(1), first_name: 'Anna', last_name: 'Meyer', date_of_birth: '1940-02-29', insurance_number: 'A123456789' },
    { id: id(31), tenant_id: id(1), first_name: 'Anna', last_name: 'Meyer', date_of_birth: '1940-02-29', insurance_number: null },
  ];
  const db = database(rows);
  const result = await repository(db).findExactClientIdentityConflictFromIntake(id(1), form(), draft);
  assert.deepEqual(result, { ok: true, data: { clientId: id(31), match: 'name_birth_date' } });
  assert.ok(db.calls[0].some(([kind, field, value]) => kind === 'neq' && field === 'id' && value === draft));
});

test('missing identity input and lookup failure both fail closed', async () => {
  const db = database([], { failAt: 1 });
  const api = repository(db);
  assert.deepEqual(await api.findExactClientIdentityConflictFromIntake(id(1), form({ firstName: ' ' })), {
    ok: false,
    error: 'Die Identitätsprüfung benötigt Mandant, Name und Geburtsdatum.',
  });
  assert.deepEqual(await api.findExactClientIdentityConflictFromIntake(id(1), form()), {
    ok: false,
    error: 'RLS-Prüfung fehlgeschlagen',
  });
  const malformed = repository(database([{ id: 'legacy-row', tenant_id: id(1), first_name: 'Anna', last_name: 'Meyer', date_of_birth: '1940-02-29', insurance_number: null }]));
  assert.deepEqual(await malformed.findExactClientIdentityConflictFromIntake(id(1), form()), {
    ok: false,
    error: 'Die Identitätsprüfung lieferte keine gültige native Personenkennung.',
  });
});

function submitClientIntake(deps) {
  const source = read('src/lib/clients/clientIntakeService.ts');
  const body = strip(source.slice(
    source.indexOf('export async function submitClientIntake('),
    source.indexOf('export async function submitClientIntakeUpdate('),
  ).replace(/\bexport /g, ''));
  return new Function(...Object.keys(deps), `${body}; return submitClientIntake;`)(...Object.values(deps));
}

function serviceHarness(identityResult) {
  const calls = [];
  const ok = (name, data = undefined) => (...args) => { calls.push([name, ...args]); return Promise.resolve({ ok: true, data }); };
  const submit = submitClientIntake({
    enforcePermission: () => null,
    runService: (operation) => operation(),
    isDemoClientBackend: () => false,
    findExactClientIdentityConflictFromIntake: ok('identity', identityResult),
    createClientFromIntake: ok('create', { id: id(40) }),
    persistClientIntakeDocuments: ok('documents'),
    persistIntakeCostCarriers: ok('carriers'),
    syncIntakeClientExtendedData: ok('extended'),
    mapIntakeModulesToPortal: () => [],
    saveClientModuleAssignments: ok('modules'),
    syncClientCoreAfterIntake: ok('core'),
    activateClientFromIntake: ok('activate', { id: id(40) }),
    assertDemoTenant: () => null,
    persistDemoClientIntake: () => { throw new Error('Kein Demo-Pfad'); },
  });
  return { calls, submit };
}

test('active intake blocks before every write when an exact conflict exists', async () => {
  const h = serviceHarness({ clientId: id(20), match: 'name_birth_date' });
  const result = await h.submit(id(1), form(), { actorProfileId: id(2), actorRoleKey: 'business_admin' });
  assert.equal(result.ok, false);
  assert.match(result.error, /zweite Anlage wurde nicht ausgeführt/);
  assert.deepEqual(h.calls.map(([name]) => name), ['identity']);
});

test('active intake writes only after a conflict-free tenant lookup', async () => {
  const h = serviceHarness(null);
  const result = await h.submit(id(1), form(), { actorProfileId: id(2), actorRoleKey: 'business_admin' });
  assert.deepEqual(result, { ok: true, data: { id: id(40) } });
  assert.deepEqual(h.calls.map(([name]) => name), ['identity', 'create', 'documents', 'carriers', 'extended', 'core', 'activate']);
});

test('active intake propagates lookup denial and never reaches a mutation', async () => {
  const calls = [];
  const submit = submitClientIntake({
    enforcePermission: () => null,
    runService: (operation) => operation(),
    isDemoClientBackend: () => false,
    findExactClientIdentityConflictFromIntake: async () => ({ ok: false, error: 'RLS-Prüfung fehlgeschlagen' }),
    createClientFromIntake: async () => { calls.push('create'); return { ok: true, data: { id: id(40) } }; },
    persistClientIntakeDocuments: async () => { calls.push('documents'); return { ok: true, data: undefined }; },
    persistIntakeCostCarriers: async () => ({ ok: true, data: undefined }),
    syncIntakeClientExtendedData: async () => ({ ok: true, data: undefined }),
    mapIntakeModulesToPortal: () => [],
    saveClientModuleAssignments: async () => ({ ok: true, data: undefined }),
    syncClientCoreAfterIntake: async () => ({ ok: true, data: undefined }),
    activateClientFromIntake: async () => ({ ok: true, data: { id: id(40) } }),
    assertDemoTenant: () => null,
    persistDemoClientIntake: () => {},
  });
  assert.deepEqual(await submit(id(1), form(), { actorRoleKey: 'business_admin' }), {
    ok: false,
    error: 'RLS-Prüfung fehlgeschlagen',
  });
  assert.deepEqual(calls, []);
});
