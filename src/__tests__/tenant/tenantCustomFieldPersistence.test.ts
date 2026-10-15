import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCustomFieldDraft } from '@/lib/tenant/tenantCustomFieldEditor';
import {
  fetchTenantCustomFieldDefinitions,
  resetTenantCustomFieldStore,
  saveTenantCustomFieldDefinition,
} from '@/lib/tenant/tenantCustomFieldService';

const mocked = vi.hoisted(() => ({ os: 'web', canManage: true, live: true, blockedTenant: '', client: null as unknown }));
vi.mock('react-native', () => ({ Platform: { get OS() { return mocked.os; } } }));
vi.mock('@/lib/tenant/companyAccessService.web', () => ({ loadCompanyAccess: async () => ({ ok: true, data: { scopeLimited: false, permissions: mocked.canManage ? ['business.tenant.manage'] : [] } }) }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => mocked.client }));
vi.mock('@/lib/services/liveServiceGuard', () => ({
  isLiveServiceMode: () => mocked.live,
  guardServiceTenant: (tenantId: string) => tenantId === mocked.blockedTenant
    ? { ok: false, error: 'Kein Zugriff auf diesen Mandanten.' } : null,
}));

type Row = Record<string, unknown>;
type Operation = 'select' | 'insert' | 'update';
type Result = { data: Row | Row[] | null; error: { code: string; message: string } | null };
type Call = { operation: Operation; filters: [string, unknown][]; returning: boolean };
const TENANT = 'tenant-custom-fields';
const field = (id?: string) => ({
  ...createCustomFieldDraft().definition,
  ...(id ? { id } : {}),
  fieldKey: 'internal_reference', label: 'Aktenzeichen',
});

class LocalDatabase {
  rows: Row[] = [];
  calls: Call[] = [];
  failOperation: Operation | null = null;
  throwOnRead = false;
  omitWriteRow = false;
  from = () => new LocalQuery(this);
}

/** Local query double models returned rows and tenant/id filters without network writes. */
class LocalQuery implements PromiseLike<Result> {
  private operation: Operation = 'select';
  private payload: Row = {};
  private filters: [string, unknown][] = [];
  private returning = false;
  private single = false;

  constructor(private database: LocalDatabase) {}
  select() { this.returning = true; return this; }
  eq(column: string, value: unknown) { this.filters.push([column, value]); return this; }
  order() { return this; }
  maybeSingle() { this.single = true; return this; }
  insert(payload: Row) { this.operation = 'insert'; this.payload = payload; return this; }
  update(payload: Row) { this.operation = 'update'; this.payload = payload; return this; }

  private execute(): Result {
    const { database, operation, filters, returning } = this;
    database.calls.push({ operation, filters, returning });
    if (operation === 'select' && database.throwOnRead) throw new Error('network disconnected');
    if (database.failOperation === operation) {
      return { data: null, error: { code: 'TEST_FAILURE', message: 'test query unavailable' } };
    }
    const matches = (row: Row) => filters.every(([column, value]) => row[column] === value);
    let affected = database.rows.filter(matches);
    if (operation === 'insert') {
      affected = [{ id: 'new-field', ...this.payload }];
      database.rows.push(...affected);
    } else if (operation === 'update') {
      database.rows = database.rows.map(row => matches(row) ? { ...row, ...this.payload } : row);
      affected = database.rows.filter(matches);
    }
    if (operation !== 'select' && (!returning || database.omitWriteRow)) return { data: null, error: null };
    return { data: structuredClone(this.single ? affected[0] ?? null : affected), error: null };
  }

  then<TResult1 = Result, TResult2 = never>(
    fulfilled?: ((value: Result) => TResult1 | PromiseLike<TResult1>) | null,
    rejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve().then(() => this.execute()).then(fulfilled, rejected);
  }
}

let database: LocalDatabase;
beforeEach(() => {
  mocked.os = 'web'; mocked.canManage = true; mocked.live = true; mocked.blockedTenant = '';
  database = new LocalDatabase(); mocked.client = database;
  resetTenantCustomFieldStore();
});

describe('custom-field web persistence', () => {
  it('blocks denied roles and tenant scopes before writes', async () => {
    mocked.canManage = false;
    expect((await saveTenantCustomFieldDefinition(TENANT, field(), 'employee_portal')).ok).toBe(false);
    mocked.canManage = true;
    mocked.blockedTenant = TENANT;
    expect((await saveTenantCustomFieldDefinition(TENANT, field(), 'business_admin')).ok).toBe(false);
    expect(database.calls).toEqual([]);
  });

  it('rejects a zero-row update and never touches a matching ID from another tenant', async () => {
    database.rows = [{ id: 'existing-field', tenant_id: 'another-tenant', label: 'Unverändert' }];
    const result = await saveTenantCustomFieldDefinition(TENANT, field('existing-field'), 'business_admin');
    expect(result.ok).toBe(false);
    expect(result.savedId).toBeUndefined();
    expect(database.rows[0].label).toBe('Unverändert');
    expect(database.calls).toEqual([{
      operation: 'update', returning: true,
      filters: [['tenant_id', TENANT], ['id', 'existing-field']],
    }]);
  });

  it.each(['insert', 'update'] as const)('propagates %s errors without reporting a save or reloading', async operation => {
    database.failOperation = operation;
    const result = await saveTenantCustomFieldDefinition(TENANT, field(operation === 'update' ? 'existing-field' : undefined), 'business_admin');
    expect(result.ok).toBe(false);
    expect(result.savedId).toBeUndefined();
    expect(database.calls.map(call => call.operation)).toEqual([operation]);
  });

  it('does not report success when an insert returns no confirmed ID', async () => {
    database.omitWriteRow = true;
    const result = await saveTenantCustomFieldDefinition(TENANT, field(), 'business_admin');
    expect(result.ok).toBe(false);
    expect(result.savedId).toBeUndefined();
    expect(database.calls).toHaveLength(1);
  });

  it('confirms an insert and reloads only the requested tenant', async () => {
    database.rows = [{ id: 'foreign-field', tenant_id: 'another-tenant' }];
    const result = await saveTenantCustomFieldDefinition(TENANT, field(), 'business_admin');
    expect(result).toEqual({ ok: true, data: [expect.objectContaining({ id: 'new-field', label: 'Aktenzeichen' })] });
    expect(database.rows[1].tenant_id).toBe(TENANT);
    expect(database.calls[0].returning).toBe(true);
    expect(database.calls[1].filters).toEqual([['tenant_id', TENANT]]);
  });

  it.each(['result', 'exception'] as const)('reports a confirmed save separately from a reload %s and supplies its ID for safe retry', async failure => {
    if (failure === 'result') database.failOperation = 'select';
    else database.throwOnRead = true;
    const result = await saveTenantCustomFieldDefinition(TENANT, field(), 'business_admin');
    expect(result.ok).toBe(false);
    expect(result.savedId).toBe('new-field');
    expect(result.error).toContain('wurde gespeichert, aber');
    expect(database.rows).toHaveLength(1);

    database.failOperation = null; database.throwOnRead = false;
    const retry = await saveTenantCustomFieldDefinition(TENANT, { ...field(), id: result.savedId }, 'business_admin');
    expect(retry.ok).toBe(true);
    expect(database.rows).toHaveLength(1);
    expect(database.calls[2].operation).toBe('update');
  });

  it('includes inactive definitions in the web company editor while default reads stay active-only', async () => {
    const result = await saveTenantCustomFieldDefinition(TENANT, { ...field(), isActive: false }, 'business_admin');
    expect(result).toEqual({ ok: true, data: [expect.objectContaining({ isActive: false })] });
    expect(await fetchTenantCustomFieldDefinitions(TENANT, 'business_admin')).toEqual({ ok: true, data: [] });
    expect(await fetchTenantCustomFieldDefinitions(TENANT, 'business_admin', true)).toEqual(result);
    mocked.os = 'android';
    expect(await fetchTenantCustomFieldDefinitions(TENANT, 'business_admin', true)).toEqual({ ok: true, data: [] });
  });

  it('preserves native demo visibility while Web requires authoritative live access', async () => {
    mocked.live = false; mocked.os = 'android';
    const saved = await saveTenantCustomFieldDefinition(TENANT, { ...field(), isActive: false }, 'business_admin');
    expect(saved).toEqual({ ok: true, data: [expect.objectContaining({ isActive: false })] });
    expect(await fetchTenantCustomFieldDefinitions(TENANT, 'business_admin')).toEqual(saved);
    mocked.os = 'web';
    expect((await fetchTenantCustomFieldDefinitions(TENANT, 'business_admin', true)).ok).toBe(false);
  });
});
