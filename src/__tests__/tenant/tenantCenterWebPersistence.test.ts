import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PermissionKey, RoleKey } from '@/types';
import type {
  TenantBankAccount,
  TenantContactCommunication,
  TenantRepresentative,
} from '@/types/tenant/tenantCenter';
import {
  EMPTY_TENANT_LEGAL,
  DEFAULT_TENANT_MODULES,
  EMPTY_TENANT_PAYMENT,
  EMPTY_TENANT_REGISTER,
  EMPTY_TENANT_TAX,
} from '@/types/tenant/tenantCenter';
import {
  fetchTenantCenter,
  resetTenantCenterStore,
  saveTenantBankAccounts,
  saveTenantContactProfile,
  saveTenantLegalProfile,
  saveTenantModuleSettings,
  saveTenantPaymentTerms,
  saveTenantRegisterProfile,
  saveTenantRepresentatives,
  saveTenantTaxProfile,
} from '@/lib/tenant/tenantCenterService';

const mocked = vi.hoisted(() => ({
  live: true,
  blockedTenant: null as string | null,
  client: null as unknown,
  permissions: ['business.tenant.manage'] as PermissionKey[],
  limited: false,
  accessError: null as string | null,
  accessThrows: false,
  catalogError: null as string | null,
  customFieldsError: null as string | null,
}));

vi.mock('@/lib/tenant/companyAccessService.web', () => ({ loadCompanyAccess: async () => {
  if (mocked.accessThrows) throw new Error('network failure');
  return mocked.accessError ? { ok: false, error: mocked.accessError } : { ok: true, data: { permissions: mocked.permissions, scopeLimited: mocked.limited, canManageScopes: !mocked.limited } };
} }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => mocked.client }));
vi.mock('@/lib/services/liveServiceGuard', () => ({
  isLiveServiceMode: () => mocked.live,
  guardServiceTenant: (tenantId: string) => tenantId === mocked.blockedTenant
    ? { ok: false, error: 'Kein Zugriff auf diesen Mandanten.' }
    : null,
}));
vi.mock('@/lib/tenant/tenantServiceCatalogService', () => ({
  fetchTenantServiceCatalog: async () => mocked.catalogError
    ? { ok: false, error: mocked.catalogError }
    : { ok: true, data: { items: [], prices: [] } },
  formatCatalogSummary: () => '',
  seedTenantServiceCatalogIfEmpty: vi.fn(),
}));
vi.mock('@/lib/tenant/tenantCustomFieldService', () => ({
  fetchTenantCustomFieldDefinitions: async () => mocked.customFieldsError
    ? { ok: false, error: mocked.customFieldsError }
    : { ok: true, data: [] },
}));

type Row = Record<string, unknown>;
type Operation = 'select' | 'insert' | 'upsert' | 'update' | 'delete';
type Filter = { column: string; values: readonly unknown[] };
type QueryCall = { table: string; operation: Operation; payload: Row[]; filters: Filter[] };
type DbResult = { data: Row | Row[] | null; error: { code: string; message: string } | null };

const TENANT = 'tenant-web-persistence';
const ADMIN: RoleKey = 'business_admin';
const SUBTABLES = [
  'tenant_legal_profiles', 'tenant_tax_profiles', 'tenant_register_profiles',
  'tenant_billing_settings', 'tenant_branding', 'tenant_module_settings',
  'tenant_contacts', 'tenant_representatives', 'tenant_bank_accounts', 'audit_logs',
];

/** Local database double: records executed writes and applies tenant/id filters. */
class LocalDatabase {
  tables = new Map<string, Row[]>();
  calls: QueryCall[] = [];
  failures = new Map<string, string>();
  nextId = 0;

  constructor() {
    this.tables.set('tenants', [{ id: TENANT, name: 'Testunternehmen', country: 'Deutschland' }]);
    for (const table of SUBTABLES) this.tables.set(table, []);
  }

  from = (table: string) => new LocalQuery(this, table);

  rows(table: string) { return this.tables.get(table) ?? []; }
  writes(table?: string) {
    return this.calls.filter((call) => call.operation !== 'select' && (!table || call.table === table));
  }
}

class LocalQuery implements PromiseLike<DbResult> {
  private operation: Operation = 'select';
  private payload: Row[] = [];
  private filters: Filter[] = [];
  private singleResult = false;
  private conflictColumns = ['id'];

  constructor(private database: LocalDatabase, private table: string) {}

  select() { return this; }
  order() { return this; }
  limit() { return this; }
  eq(column: string, value: unknown) {
    this.filters.push({ column, values: [value] });
    return this;
  }
  in(column: string, values: readonly unknown[]) {
    this.filters.push({ column, values: [...values] });
    return this;
  }
  maybeSingle() { this.singleResult = true; return this; }
  single() { this.singleResult = true; return this; }
  insert(payload: Row | Row[]) { return this.mutate('insert', payload); }
  update(payload: Row) { return this.mutate('update', payload); }
  upsert(payload: Row | Row[], options?: { onConflict?: string }) {
    this.conflictColumns = options?.onConflict?.split(',') ?? ['id'];
    return this.mutate('upsert', payload);
  }
  delete() { this.operation = 'delete'; return this; }

  private mutate(operation: Operation, payload: Row | Row[]) {
    this.operation = operation;
    this.payload = structuredClone(Array.isArray(payload) ? payload : [payload]);
    return this;
  }

  private execute(): DbResult {
    const { database, table, operation, payload, filters } = this;
    database.calls.push(structuredClone({ table, operation, payload, filters }));
    const failure = database.failures.get(`${table}:${operation}`);
    if (failure) return { data: null, error: { code: 'TEST_FAILURE', message: failure } };
    const matches = (row: Row) => filters.every((filter) => filter.values.includes(row[filter.column]));
    let rows = database.rows(table);
    let affected = rows.filter(matches);
    if (operation === 'delete') {
      rows = rows.filter((row) => !matches(row));
    } else if (operation === 'update') {
      rows = rows.map((row) => matches(row) ? { ...row, ...payload[0] } : row);
      affected = rows.filter(matches);
    } else if (operation === 'insert' || operation === 'upsert') {
      affected = [];
      for (const row of payload) {
        const index = operation === 'upsert'
          ? rows.findIndex((existing) => this.conflictColumns.every((column) =>
              row[column] !== undefined && existing[column] === row[column]))
          : -1;
        const stored = { id: `generated-${++database.nextId}`, ...(index >= 0 ? rows[index] : {}), ...row };
        if (index >= 0) rows[index] = stored;
        else rows.push(stored);
        affected.push(stored);
      }
    }
    database.tables.set(table, rows);
    return { data: structuredClone(this.singleResult ? affected[0] ?? null : affected), error: null };
  }

  then<TResult1 = DbResult, TResult2 = never>(
    onfulfilled?: ((value: DbResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }
}

function representative(id?: string): TenantRepresentative {
  return {
    ...(id ? { id } : {}), salutation: 'Frau', firstName: 'Lena', lastName: 'Beispiel',
    position: 'Geschäftsführung', email: 'lena@example.com', phone: '030123456',
    isPrimary: true, sortOrder: 0,
  };
}

function bankAccount(id?: string): TenantBankAccount {
  return {
    ...(id ? { id } : {}), label: 'Geschäftskonto', accountHolder: 'Testunternehmen',
    bankName: 'Testbank', iban: 'DE89370400440532013000', bic: 'COBADEFFXXX',
    isPrimary: true, sortOrder: 0,
  };
}

const contact: TenantContactCommunication = {
  billingEmail: 'rechnung@example.com', supportEmail: 'kontakt@example.com',
  supportPhone: '030987654', contactPersons: [],
};

type RemovalOptions = { removedIds?: readonly string[] };
const rowCases = [
  {
    name: 'representatives', table: 'tenant_representatives',
    save: (ids: (string | undefined)[], options?: RemovalOptions) =>
      saveTenantRepresentatives(TENANT, ids.map(representative), ADMIN, options),
  },
  {
    name: 'bank accounts', table: 'tenant_bank_accounts',
    save: (ids: (string | undefined)[], options?: RemovalOptions) =>
      saveTenantBankAccounts(TENANT, ids.map(bankAccount), ADMIN, options),
  },
];

let database: LocalDatabase;

beforeEach(() => {
  mocked.live = true; mocked.permissions = ['business.tenant.manage']; mocked.limited = false; mocked.accessError = null; mocked.accessThrows = false;
  mocked.blockedTenant = null;
  mocked.catalogError = null;
  mocked.customFieldsError = null;
  database = new LocalDatabase();
  mocked.client = database;
  resetTenantCenterStore();
});

describe('tenant center web persistence', () => {
  it.each([
    { name: 'tax', save: (role: RoleKey) => saveTenantTaxProfile(TENANT, { ...EMPTY_TENANT_TAX }, role) },
    { name: 'register', save: (role: RoleKey) => saveTenantRegisterProfile(TENANT, { ...EMPTY_TENANT_REGISTER }, role) },
    { name: 'contact', save: (role: RoleKey) => saveTenantContactProfile(TENANT, contact, role) },
  ])('blocks revoked permissions and foreign tenants before any $name write', async ({ save }) => {
    mocked.permissions = [];
    expect((await save('nurse')).ok).toBe(false);
    expect(database.writes()).toEqual([]);

    mocked.permissions = ['business.tenant.manage'];
    mocked.blockedTenant = TENANT;
    const blocked = await save(ADMIN);
    expect(blocked).toEqual({ ok: false, error: 'Kein Zugriff auf diesen Mandanten.' });
    expect(database.writes()).toEqual([]);
  });

  it('does not turn failed subtable reads into an apparently empty profile', async () => {
    for (const table of SUBTABLES) {
      database.failures.clear();
      database.failures.set(`${table}:select`, `${table} unavailable`);
      const result = await fetchTenantCenter(TENANT, ADMIN);
      expect(result.ok, table).toBe(false);
      if (!result.ok) expect(result.error, table).toContain(`${table} unavailable`);
    }
    expect(database.writes()).toEqual([]);
  });

  it('propagates catalog and custom-field fetch failures instead of empty lists', async () => {
    mocked.catalogError = 'Katalog nicht verfügbar';
    const catalog = await fetchTenantCenter(TENANT, ADMIN);
    expect(catalog.ok).toBe(false);
    if (!catalog.ok) expect(catalog.error).toContain(mocked.catalogError);

    mocked.catalogError = null;
    mocked.customFieldsError = 'Felddefinitionen nicht verfügbar';
    const customFields = await fetchTenantCenter(TENANT, ADMIN);
    expect(customFields.ok).toBe(false);
    if (!customFields.ok) expect(customFields.error).toContain(mocked.customFieldsError);
  });

  it.each(rowCases)('rejects an unknown existing id before writing $name', async ({ table, save }) => {
    database.tables.set(table, [{ id: 'known', tenant_id: TENANT }]);
    expect((await save(['unknown'])).ok).toBe(false);
    expect(database.writes()).toEqual([]);
    expect(database.rows(table)).toEqual([{ id: 'known', tenant_id: TENANT }]);
  });

  it.each(rowCases)('does not delete $name when inserting a new row fails', async ({ table, save }) => {
    database.tables.set(table, [{ id: 'remove-me', tenant_id: TENANT }]);
    database.failures.set(`${table}:insert`, 'New row rejected');
    const result = await save([undefined], { removedIds: ['remove-me'] });
    expect(result.ok).toBe(false);
    expect(database.writes(table).some((call) => call.operation === 'insert')).toBe(true);
    expect(database.writes(table).some((call) => call.operation === 'delete')).toBe(false);
    expect(database.rows(table)).toEqual([{ id: 'remove-me', tenant_id: TENANT }]);
  });

  it.each(rowCases)('preserves existing ids and omitted $name with an upsert', async ({ table, save }) => {
    database.tables.set(table, [
      { id: 'edited', tenant_id: TENANT },
      { id: 'not-in-editor', tenant_id: TENANT, label: 'Concurrent row' },
    ]);
    expect((await save(['edited'])).ok).toBe(true);
    const writes = database.writes(table);
    expect(writes.map((call) => call.operation)).toEqual(['upsert']);
    expect(writes[0].payload).toEqual([expect.objectContaining({ id: 'edited', tenant_id: TENANT })]);
    expect(database.rows(table).map((row) => row.id).sort()).toEqual(['edited', 'not-in-editor']);
  });

  it.each(rowCases)('deletes only explicitly removed $name after successful writes', async ({ table, save }) => {
    database.tables.set(table, [
      { id: 'edited', tenant_id: TENANT },
      { id: 'remove-me', tenant_id: TENANT },
      { id: 'concurrent', tenant_id: TENANT },
      { id: 'other-tenant', tenant_id: 'tenant-other' },
    ]);
    const result = await save(['edited', undefined], { removedIds: ['remove-me'] });
    expect(result.ok).toBe(true);
    const writes = database.writes(table);
    const deleteIndex = writes.findIndex((call) => call.operation === 'delete');
    expect(deleteIndex).toBeGreaterThan(writes.findIndex((call) => call.operation === 'insert'));
    expect(deleteIndex).toBeGreaterThan(writes.findIndex((call) => call.operation === 'upsert'));
    expect(writes.filter((call) => call.operation === 'delete')).toHaveLength(1);
    expect(writes[deleteIndex].filters).toEqual(expect.arrayContaining([
      { column: 'tenant_id', values: [TENANT] }, { column: 'id', values: ['remove-me'] },
    ]));
    expect(database.rows(table).map((row) => row.id)).toEqual(expect.arrayContaining([
      'edited', 'concurrent', 'other-tenant', expect.stringMatching(/^generated-/),
    ]));
    expect(database.rows(table).some((row) => row.id === 'remove-me')).toBe(false);
  });

  it('rejects unknown removed ids before modifying either row collection', async () => {
    for (const { table, save } of rowCases) {
      database.tables.set(table, [{ id: 'edited', tenant_id: TENANT }]);
      expect((await save(['edited'], { removedIds: ['foreign-id'] })).ok).toBe(false);
    }
    expect(database.writes()).toEqual([]);
  });

  it('persists zero-day payment terms and a zero fee without replacing them with defaults', async () => {
    const result = await saveTenantPaymentTerms(TENANT, {
      ...EMPTY_TENANT_PAYMENT, paymentTermsDays: '0', dunningAfterDays: '0', dunningFee: '0',
    }, ADMIN);
    expect(result.ok).toBe(true);
    expect(database.writes('tenant_billing_settings')[0]?.payload).toEqual([
      expect.objectContaining({ payment_terms_days: 0, dunning_after_days: 0, dunning_fee: 0 }),
    ]);
    if (result.ok) expect(result.data.payment).toMatchObject({ paymentTermsDays: '0', dunningAfterDays: '0', dunningFee: '0' });
  });

  it('rejects negative, NaN and partially numeric payment values before a write', async () => {
    for (const key of ['paymentTermsDays', 'dunningAfterDays', 'dunningFee'] as const) {
      for (const invalid of ['-1', 'NaN', '12abc']) {
        expect((await saveTenantPaymentTerms(TENANT, { ...EMPTY_TENANT_PAYMENT, [key]: invalid }, ADMIN)).ok,
          `${key}=${invalid}`).toBe(false);
      }
    }
    expect(database.writes()).toEqual([]);
  });

  it('fails closed instead of persisting Web company data in a demo store', async () => {
    mocked.live = false;
    const results = await Promise.all([
      fetchTenantCenter(TENANT, ADMIN), saveTenantModuleSettings(TENANT, { ...DEFAULT_TENANT_MODULES }, ADMIN), saveTenantLegalProfile(TENANT, { ...EMPTY_TENANT_LEGAL }, ADMIN),
      saveTenantTaxProfile(TENANT, { ...EMPTY_TENANT_TAX }, ADMIN), saveTenantRegisterProfile(TENANT, { ...EMPTY_TENANT_REGISTER }, ADMIN),
      saveTenantRepresentatives(TENANT, [representative()], ADMIN), saveTenantBankAccounts(TENANT, [bankAccount()], ADMIN),
    ]);
    expect(results.every(result => !result.ok && result.error.includes('aktive Datenbankverbindung'))).toBe(true);
    expect(database.calls).toEqual([]);
  });

  it('honors authoritative custom grants even for a role without a static company grant', async () => {
    const read = await fetchTenantCenter(TENANT, 'nurse'); expect(read.ok).toBe(true);
    const saved = await saveTenantLegalProfile(TENANT, { ...EMPTY_TENANT_LEGAL, liabilityInsurer: 'Tatsächliche Police' }, 'nurse');
    expect(saved.ok).toBe(true); expect(database.writes('tenant_legal_profiles')).toHaveLength(1);
  });

  it('denies global company data to scope-limited staff even with the management permission', async () => {
    mocked.limited = true;
    expect((await fetchTenantCenter(TENANT, ADMIN)).ok).toBe(false);
    expect((await saveTenantLegalProfile(TENANT, { ...EMPTY_TENANT_LEGAL }, ADMIN)).ok).toBe(false);
    expect(database.calls).toEqual([]);
  });

  it('does not fall back to a static admin role when authoritative access is unavailable', async () => {
    mocked.accessError = 'Rechte derzeit nicht verfügbar.';
    expect(await fetchTenantCenter(TENANT, ADMIN)).toEqual({ ok: false, error: mocked.accessError });
    mocked.accessError = null; mocked.accessThrows = true;
    const saved = await saveTenantLegalProfile(TENANT, { ...EMPTY_TENANT_LEGAL }, ADMIN);
    expect(saved.ok).toBe(false); if (!saved.ok) expect(saved.error).toContain('Berechtigung');
    expect(database.calls).toEqual([]);
  });

  it('saves contact people by identity and removes only explicitly selected contacts', async () => {
    database.tables.set('tenant_contacts', [
      { id: 'kept-contact', tenant_id: TENANT, first_name: 'Alt' },
      { id: 'remove-contact', tenant_id: TENANT },
      { id: 'concurrent-contact', tenant_id: TENANT, first_name: 'Concurrent' },
    ]);
    const person = {
      firstName: 'Mara', lastName: 'Muster', role: 'Buchhaltung', email: 'mara@example.com',
      phone: '030555', isPrimary: true,
    };
    const result = await saveTenantContactProfile(TENANT, {
      ...contact, contactPersons: [{ ...person, id: 'kept-contact' }, { ...person, firstName: 'Neu', isPrimary: false }],
    }, ADMIN, { removedIds: ['remove-contact'] });
    expect(result.ok).toBe(true);
    expect(database.rows('tenant_contacts').map((row) => row.id)).toEqual(expect.arrayContaining([
      'kept-contact', 'concurrent-contact', expect.stringMatching(/^generated-/),
    ]));
    expect(database.rows('tenant_contacts').some((row) => row.id === 'remove-contact')).toBe(false);
    if (result.ok) expect(result.data.contact.contactPersons).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'kept-contact', firstName: 'Mara', role: 'Buchhaltung' }),
    ]));
  });
});
