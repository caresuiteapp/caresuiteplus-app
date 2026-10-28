import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PermissionKey } from '@/types/permissions';
import type { CompanyInventoryScope } from '@/lib/inventory/companyInventoryService.web';
import {
  acknowledgeCompanyInventoryAssignment, checkCompanyInventoryOffboarding, getCompanyInventoryPermissions,
  issueCompanyInventoryItem, loadCompanyInventory, reportCompanyInventoryDamage, requestCompanyInventoryReturn,
  returnCompanyInventoryItem, resolveCompanyInventoryDamage, saveCompanyInventoryCategory, saveCompanyInventoryItem, saveCompanyInventoryLocation,
} from '@/lib/inventory/companyInventoryService.web';

const mocked = vi.hoisted(() => ({ client: null as unknown, mode: 'supabase', tenantBlocked: false, denied: new Set<string>(), scopeLimited: false,
  serverPermissions: ['inventory.view', 'inventory.manage_items', 'inventory.issue', 'inventory.return_manage', 'inventory.report_damage', 'inventory.offboarding', 'inventory.audit_view', 'office.employees.view'] }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => mocked.client }));
vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => mocked.mode }));
vi.mock('@/lib/services/liveServiceGuard', () => ({ guardServiceTenant: () => mocked.tenantBlocked ? { ok: false, error: 'Mandant gesperrt' } : null }));
vi.mock('@/lib/tenant/companyAccessService', () => ({ loadCompanyAccess: async () => ({ ok: true, data: { permissions: mocked.serverPermissions, scopeLimited: mocked.scopeLimited, canManageScopes: !mocked.scopeLimited } }) }));
vi.mock('@/lib/permissions', () => ({ enforcePermission: (_role: unknown, permission: string, context?: { effectivePermissions?: readonly string[] }) =>
  mocked.denied.has(permission) || (context?.effectivePermissions && !context.effectivePermissions.includes(permission))
    ? { ok: false, error: 'Keine Berechtigung' } : null }));

type Row = Record<string, unknown>;
type Operation = 'select' | 'insert' | 'update';
type Call = { table: string; operation: Operation; columns: string; payload: Row; filters: [string, unknown][] };
type Result = { data: unknown; error: null | { message: string; code: string } };
const TENANT = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const DATE = '2026-10-01T12:00:00.000Z';
const scope: CompanyInventoryScope = { tenantId: TENANT, actorRoleKey: 'business_admin', actorProfileId: 'actor-1' };
const tables = ['inventory_items', 'inventory_categories', 'inventory_locations', 'inventory_assignments', 'inventory_return_records', 'inventory_damage_reports', 'inventory_audit_events', 'employees'];
const category = (extra: Row = {}): Row => ({ id: 'category-1', tenant_id: TENANT, group_key: 'devices', label: 'Geräte', requires_return_on_exit: true, portal_visible_to_employee: false, barcode_enabled: false, created_at: DATE, updated_at: DATE, ...extra });
const item = (extra: Row = {}): Row => ({ id: 'item-1', tenant_id: TENANT, category_id: 'category-1', name: 'Diensttelefon', status: 'available', condition: 'good', requires_return_on_exit: true, portal_visible_to_employee: false, created_at: DATE, updated_at: DATE, ...extra });
const person = (extra: Row = {}): Row => ({ id: 'person-1', tenant_id: TENANT, first_name: 'Erika', last_name: 'Beispiel', status: 'active', bank_account: 'MUST_NOT_LOAD', ...extra });
const assignment = (extra: Row = {}): Row => ({ id: 'assignment-1', tenant_id: TENANT, item_id: 'item-1', recipient_employee_id: 'person-1', responsible_employee_id: 'person-1', status: 'issued', issue_condition: 'good', return_required: true, issued_at: DATE, created_at: DATE, updated_at: DATE, ...extra });

class Database {
  tables = new Map<string, Row[]>(tables.map(name => [name, []]));
  calls: Call[] = [];
  fail = new Map<string, 'error' | 'throw' | 'empty'>();
  unexpectedPayload = new Map<string, unknown>();
  beforeWrite?: (call: Call) => void;
  nextId = 1;
  choiceRows: Row[] = [];
  rpcCalls: { name: string; args: Row }[] = [];
  rpc = async (name: string, args: Row) => {
    this.rpcCalls.push({ name, args });
    return { data: this.choiceRows.slice(Number(args.p_offset), Number(args.p_offset) + 500), error: null };
  };
  from = (name: string) => new Query(this, name);
  rows(name: string) { return this.tables.get(name)!; }
  set(name: string, rows: Row[]) { this.tables.set(name, rows); }
  writes() { return this.calls.filter(call => call.operation !== 'select'); }
}
class Query implements PromiseLike<Result> {
  private operation: Operation = 'select';
  private columns = '*';
  private payload: Row = {};
  private filters: [string, unknown][] = [];
  private singleResult = false;
  private start = 0;
  private end = 999999;
  constructor(private db: Database, private name: string) {}
  select(columns = '*') { this.columns = columns; return this; }
  eq(column: string, value: unknown) { this.filters.push([column, value]); return this; }
  is(column: string, value: null) { this.filters.push([column, value]); return this; }
  order() { return this; }
  range(start: number, end: number) { this.start = start; this.end = end; return this; }
  maybeSingle() { this.singleResult = true; return this; }
  single() { this.singleResult = true; return this; }
  insert(payload: Row) { this.operation = 'insert'; this.payload = payload; return this; }
  update(payload: Row) { this.operation = 'update'; this.payload = payload; return this; }
  then<TResult1 = Result, TResult2 = never>(fulfilled?: ((result: Result) => TResult1 | PromiseLike<TResult1>) | null, rejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve().then(() => this.execute()).then(fulfilled, rejected);
  }
  private execute(): Result {
    const call = { table: this.name, operation: this.operation, columns: this.columns, payload: this.payload, filters: this.filters };
    this.db.calls.push(call);
    if (this.db.unexpectedPayload.has(`${this.name}:${this.operation}`)) return { data: this.db.unexpectedPayload.get(`${this.name}:${this.operation}`), error: null };
    const failure = this.db.fail.get(`${this.name}:${this.operation}`);
    if (failure === 'throw') throw new Error('Connection interrupted');
    if (failure === 'error') return { data: null, error: { code: '42501', message: 'permission denied' } };
    if (failure === 'empty') return { data: this.singleResult ? null : [], error: null };
    if (this.operation !== 'select') this.db.beforeWrite?.(call);
    let selected = this.db.rows(this.name).filter(row => this.filters.every(([key, value]) => value === null ? row[key] == null : row[key] === value));
    if (this.operation === 'insert') {
      const saved = { id: `new-${this.db.nextId++}`, created_at: DATE, updated_at: DATE, ...this.payload };
      this.db.rows(this.name).push(saved); selected = [saved];
    } else if (this.operation === 'update') {
      for (const row of selected) Object.assign(row, this.payload);
    }
    selected = selected.slice(this.start, this.end + 1).map(row => this.columns === '*' ? { ...row } : Object.fromEntries(this.columns.split(',').map(key => [key, row[key]])));
    return { data: this.singleResult ? selected[0] ?? null : selected, error: null };
  }
}

let db: Database;
beforeEach(() => {
  db = new Database(); mocked.client = db; mocked.mode = 'supabase'; mocked.tenantBlocked = false; mocked.denied.clear();
  mocked.scopeLimited = false; mocked.serverPermissions = ['inventory.view', 'inventory.manage_items', 'inventory.issue', 'inventory.return_manage', 'inventory.report_damage', 'inventory.offboarding', 'inventory.audit_view', 'office.employees.view'];
  db.set('inventory_categories', [category()]); db.set('inventory_items', [item()]); db.set('employees', [person()]);
});

describe('company inventory live reads and authorization', () => {
  it('uses authoritative scope restrictions without loading global personnel or audit', async () => {
    mocked.scopeLimited = true; db.choiceRows = [person()];
    const result = await loadCompanyInventory(scope);
    expect(result.ok && result.data.scopeLimited).toBe(true);
    expect(result.ok && result.data.permissions.createItems).toBe(false);
    expect(result.ok && result.data.permissions.manageCatalogs).toBe(false);
    expect(result.ok && result.data.permissions.offboarding).toBe(false);
    expect(result.ok && result.data.permissions.audit).toBe(false);
    expect(db.calls.some(call => ['employees', 'inventory_audit_events'].includes(call.table))).toBe(false);
    expect(db.rpcCalls).toEqual([{ name: 'company_inventory_employee_choices', args: { p_tenant_id: TENANT, p_offset: 0 } }]);
  });
  it('fails closed after a server-side permission removal', async () => {
    mocked.serverPermissions = [];
    expect((await loadCompanyInventory(scope)).ok).toBe(false);
    expect(db.calls).toHaveLength(0);
  });
  it('blocks global creation/catalog changes and complete offboarding for scoped actors', async () => {
    mocked.scopeLimited = true;
    expect((await saveCompanyInventoryItem(scope, { name: 'Telefon', categoryId: 'category-1' })).ok).toBe(false);
    expect((await saveCompanyInventoryCategory(scope, { group: 'devices', label: 'Global', barcodeEnabled: false, portalVisibleToEmployee: false, requiresReturnOnExit: true })).ok).toBe(false);
    expect((await saveCompanyInventoryLocation(scope, { label: 'Global' })).ok).toBe(false);
    expect((await checkCompanyInventoryOffboarding(scope, 'person-1')).ok).toBe(false);
    expect(db.writes()).toHaveLength(0); expect(db.calls).toHaveLength(0);
  });
  it('allows an existing visible item edit but refuses issue to an employee outside choices', async () => {
    mocked.scopeLimited = true; db.choiceRows = [];
    expect((await saveCompanyInventoryItem(scope, { id: 'item-1', name: 'Aktualisiert', categoryId: 'category-1', condition: 'good' })).ok).toBe(true);
    expect((await issueCompanyInventoryItem(scope, { itemId: 'item-1', recipientEmployeeId: 'person-1' })).ok).toBe(false);
    expect(db.calls.some(call => call.table === 'employees')).toBe(false);
    expect(db.rows('inventory_assignments')).toHaveLength(0);
  });
  it('loads only this tenant, paginates and never seeds categories on open', async () => {
    db.set('inventory_items', Array.from({ length: 503 }, (_, i) => item({ id: `item-${i}` })).concat(item({ id: 'foreign', tenant_id: OTHER })));
    db.set('employees', [person(), person({ id: 'foreign-person', tenant_id: OTHER })]);
    const result = await loadCompanyInventory(scope);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.items).toHaveLength(503);
    expect(result.data.employees).toEqual([{ id: 'person-1', firstName: 'Erika', lastName: 'Beispiel', status: 'active' }]);
    expect(db.calls.filter(call => call.table === 'employees').every(call => call.columns === 'id,first_name,last_name,status')).toBe(true);
    expect(db.calls.every(call => call.filters.some(([key, value]) => key === 'tenant_id' && value === TENANT))).toBe(true);
    expect(db.writes()).toHaveLength(0);
  });
  it('keeps an empty company empty without writes', async () => {
    db.set('inventory_categories', []); db.set('inventory_items', []);
    const result = await loadCompanyInventory(scope);
    expect(result.ok && result.data.categories).toEqual([]);
    expect(db.writes()).toHaveLength(0);
  });
  it('does not query personnel or audit without their rights', async () => {
    mocked.denied.add('office.employees.view'); mocked.denied.add('inventory.audit_view');
    const result = await loadCompanyInventory(scope);
    expect(result.ok && result.data.employeesVisible).toBe(false);
    expect(db.calls.some(call => ['employees', 'inventory_audit_events'].includes(call.table))).toBe(false);
    expect(getCompanyInventoryPermissions('business_admin').issue).toBe(false);
  });
  it('respects explicit runtime permission removals', async () => {
    const restricted = { ...scope, effectivePermissions: ['inventory.view'] as PermissionKey[] };
    expect(getCompanyInventoryPermissions(scope.actorRoleKey, restricted.effectivePermissions).manage).toBe(false);
    expect((await saveCompanyInventoryItem(restricted, { name: 'Telefon', categoryId: 'category-1' })).ok).toBe(false);
    expect(db.calls).toHaveLength(0);
  });
  it.each(['tenant', 'permission', 'demo', 'config'])('blocks %s without a database query', async reason => {
    if (reason === 'tenant') mocked.tenantBlocked = true;
    if (reason === 'permission') mocked.denied.add('inventory.view');
    if (reason === 'demo') mocked.mode = 'demo';
    if (reason === 'config') mocked.client = null;
    expect((await loadCompanyInventory(scope)).ok).toBe(false);
    expect(db.calls).toHaveLength(0);
  });
  it('reports failed data reads instead of an empty successful workspace', async () => {
    db.fail.set('inventory_return_records:select', 'error');
    expect(await loadCompanyInventory(scope)).toMatchObject({ ok: false, reloadRequired: false });
    expect(db.writes()).toHaveLength(0);
  });
  it.each([null, 'unexpected', {}, [null], [5], [{ name: 'Fehlende Kennung' }], [['nested']]])('rejects malformed list payload %j', async payload => {
    db.unexpectedPayload.set('inventory_categories:select', payload);
    expect((await loadCompanyInventory(scope)).ok).toBe(false);
    expect(db.writes()).toHaveLength(0);
  });
  it.each(['unexpected', [], {}, { id: 123 }])('rejects malformed single-row payload %j before writing', async payload => {
    db.unexpectedPayload.set('inventory_categories:select', payload);
    const result = await saveCompanyInventoryItem(scope, { name: 'Telefon', categoryId: 'category-1' });
    expect(result).toMatchObject({ ok: false, reloadRequired: false });
    expect(db.writes()).toHaveLength(0);
  });
  it('requires reload when a write response has no valid row identity', async () => {
    db.unexpectedPayload.set('inventory_items:insert', { message: 'unexpected write response' });
    expect(await saveCompanyInventoryItem(scope, { name: 'Telefon', categoryId: 'category-1' })).toMatchObject({ ok: false, reloadRequired: true });
    expect(db.calls.some(call => call.table === 'inventory_audit_events')).toBe(false);
  });
  it('checks every write entry point before any database access', async () => {
    const deniedScope = { ...scope, effectivePermissions: [] as PermissionKey[] };
    const results = await Promise.all([
      saveCompanyInventoryItem(deniedScope, { name: 'Telefon', categoryId: 'category-1' }),
      saveCompanyInventoryCategory(deniedScope, { label: 'Neu', group: 'devices', requiresReturnOnExit: true, portalVisibleToEmployee: false, barcodeEnabled: false }),
      saveCompanyInventoryLocation(deniedScope, { label: 'Büro' }),
      issueCompanyInventoryItem(deniedScope, { itemId: 'item-1', recipientEmployeeId: 'person-1' }),
      returnCompanyInventoryItem(deniedScope, { assignmentId: 'assignment-1', capture: { returned: true, complete: true, condition: 'good' } }),
      reportCompanyInventoryDamage(deniedScope, { itemId: 'item-1', reportType: 'damage', description: 'Defekt' }),
      resolveCompanyInventoryDamage(deniedScope, 'damage-1', 'Geklärt'),
      requestCompanyInventoryReturn(deniedScope, 'assignment-1'),
      acknowledgeCompanyInventoryAssignment(deniedScope, 'assignment-1'),
      checkCompanyInventoryOffboarding(deniedScope, 'person-1'),
    ]);
    expect(results.every(result => !result.ok)).toBe(true);
    expect(db.calls).toHaveLength(0);
  });
});

describe('company inventory editing', () => {
  it('creates categories and locations only on an explicit save', async () => {
    const c = await saveCompanyInventoryCategory(scope, { label: ' Schlüsselsatz ', group: 'keys_access', requiresReturnOnExit: true, portalVisibleToEmployee: true, barcodeEnabled: false });
    const l = await saveCompanyInventoryLocation(scope, { label: ' Büro ', building: 'Haus A', room: '02' });
    expect(c.ok && c.data.label).toBe('Schlüsselsatz'); expect(l.ok && l.data.label).toBe('Büro');
    expect(db.writes()).toHaveLength(2);
    expect(db.writes().every(call => call.payload.tenant_id === TENANT)).toBe(true);
  });
  it('rejects foreign categories and locations before any writes', async () => {
    db.set('inventory_categories', [category({ tenant_id: OTHER })]);
    expect((await saveCompanyInventoryItem(scope, { name: 'Telefon', categoryId: 'category-1' })).ok).toBe(false);
    db.set('inventory_categories', [category()]);
    db.set('inventory_locations', [{ id: 'location-other', tenant_id: OTHER, label: 'Fremd' }]);
    expect((await saveCompanyInventoryItem(scope, { name: 'Telefon', categoryId: 'category-1', locationId: 'location-other' })).ok).toBe(false);
    expect(db.writes()).toHaveLength(0);
  });
  it('edits all entered item fields while retaining the item identity', async () => {
    db.set('inventory_locations', [{ id: 'location-1', tenant_id: TENANT, label: 'Büro' }]);
    const result = await saveCompanyInventoryItem(scope, { id: 'item-1', name: 'Telefon neu', categoryId: 'category-1', manufacturer: 'Hersteller', model: 'Modell', barcode: 'ABC', serialNumber: 'SER-1', purchaseDate: '2026-01-15', warrantyUntil: '2028-01-15', locationId: 'location-1', condition: 'good', expectedUpdatedAt: DATE });
    expect(result.ok && result.data).toMatchObject({ id: 'item-1', name: 'Telefon neu', manufacturer: 'Hersteller', model: 'Modell', barcode: 'ABC', serialNumber: 'SER-1', locationId: 'location-1', warrantyUntil: '2028-01-15' });
    expect(db.rows('inventory_items')).toHaveLength(1);
  });
  it('rejects invalid dates and direct assignment status manipulation', async () => {
    expect((await saveCompanyInventoryItem(scope, { name: 'Test', categoryId: 'category-1', purchaseDate: '2026-02-30' })).ok).toBe(false);
    expect((await saveCompanyInventoryItem(scope, { name: 'Test', categoryId: 'category-1', status: 'assigned' })).ok).toBe(false);
    expect(db.writes()).toHaveLength(0);
  });
  it('blocks archiving an assigned item and changing a category group already used', async () => {
    db.set('inventory_items', [item({ status: 'assigned' })]); db.set('inventory_assignments', [assignment()]);
    expect((await saveCompanyInventoryItem(scope, { id: 'item-1', name: 'Telefon', categoryId: 'category-1', status: 'archived' })).ok).toBe(false);
    expect((await saveCompanyInventoryCategory(scope, { id: 'category-1', group: 'vehicles', label: 'Autos', requiresReturnOnExit: true, portalVisibleToEmployee: false, barcodeEnabled: false })).ok).toBe(false);
    expect(db.writes()).toHaveLength(0);
  });
  it('blocks stale editing without overwriting newer data', async () => {
    const result = await saveCompanyInventoryItem(scope, { id: 'item-1', name: 'Alt', categoryId: 'category-1', expectedUpdatedAt: '2020-01-01T00:00:00Z' });
    expect(result).toMatchObject({ ok: false, reloadRequired: true }); expect(db.writes()).toHaveLength(0);
  });
  it('does not report success when the audit write fails after the item save', async () => {
    db.fail.set('inventory_audit_events:insert', 'error');
    const result = await saveCompanyInventoryItem(scope, { name: 'Neues Telefon', categoryId: 'category-1' });
    expect(result).toMatchObject({ ok: false, reloadRequired: true });
    expect(db.rows('inventory_items')).toHaveLength(2);
  });
});

describe('company inventory issue, return and damage', () => {
  it('issues only to real active personnel with the entered due date', async () => {
    const due = '2099-10-20T15:00:00Z';
    const result = await issueCompanyInventoryItem(scope, { itemId: 'item-1', recipientEmployeeId: 'person-1', expectedReturnAt: due, expectedUpdatedAt: DATE });
    expect(result.ok && result.data).toMatchObject({ recipientEmployeeId: 'person-1', expectedReturnAt: '2099-10-20T15:00:00.000Z', status: 'issued' });
    expect(db.rows('inventory_items')[0].status).toBe('assigned');
    expect(db.writes().filter(call => call.operation === 'update').every(call => call.filters.some(([key]) => key === 'updated_at'))).toBe(true);
  });
  it.each(['inactive', 'foreign', 'no-right'])('rejects %s personnel before issuing', async reason => {
    if (reason === 'inactive') db.set('employees', [person({ status: 'inactive' })]);
    if (reason === 'foreign') db.set('employees', [person({ tenant_id: OTHER })]);
    if (reason === 'no-right') mocked.denied.add('office.employees.view');
    expect((await issueCompanyInventoryItem(scope, { itemId: 'item-1', recipientEmployeeId: 'person-1' })).ok).toBe(false);
    expect(db.writes()).toHaveLength(0);
  });
  it('rejects double issue even when an inconsistent item still says available', async () => {
    db.set('inventory_assignments', [assignment()]);
    expect((await issueCompanyInventoryItem(scope, { itemId: 'item-1', recipientEmployeeId: 'person-1' })).ok).toBe(false);
    expect(db.writes()).toHaveLength(0);
  });
  it('detects a competing stock update before creating an assignment', async () => {
    db.beforeWrite = call => { if (call.table === 'inventory_items') db.rows('inventory_items')[0].updated_at = '2099-01-01T00:00:00Z'; };
    const result = await issueCompanyInventoryItem(scope, { itemId: 'item-1', recipientEmployeeId: 'person-1' });
    expect(result).toMatchObject({ ok: false, reloadRequired: true });
    expect(db.rows('inventory_assignments')).toHaveLength(0);
  });
  it('marks a failed second write as partial and does not insert a second assignment on retry', async () => {
    db.fail.set('inventory_assignments:insert', 'throw');
    const result = await issueCompanyInventoryItem(scope, { itemId: 'item-1', recipientEmployeeId: 'person-1' });
    expect(result).toMatchObject({ ok: false, reloadRequired: true });
    expect(db.rows('inventory_items')[0].status).toBe('assigned');
    db.fail.clear();
    expect((await issueCompanyInventoryItem(scope, { itemId: 'item-1', recipientEmployeeId: 'person-1' })).ok).toBe(false);
    expect(db.rows('inventory_assignments')).toHaveLength(0);
  });
  it('records a partial return without inventing completeness, accessories or deletion', async () => {
    db.set('inventory_items', [item({ status: 'assigned' })]); db.set('inventory_assignments', [assignment()]);
    const result = await returnCompanyInventoryItem(scope, { assignmentId: 'assignment-1', capture: { returned: true, complete: false, condition: 'good', accessoriesComplete: false, chargerReturned: false, dataDeleted: null, notes: 'Ladegerät fehlt' }, expectedUpdatedAt: DATE });
    expect(result.ok && result.data.capture).toMatchObject({ returned: true, complete: false, accessoriesComplete: false, chargerReturned: false, dataDeleted: null });
    expect(db.rows('inventory_items')[0].status).toBe('maintenance');
    expect(db.rows('inventory_assignments')[0].status).toBe('partially_returned');
  });
  it('blocks contradictory complete return details before writes', async () => {
    db.set('inventory_items', [item({ status: 'assigned' })]); db.set('inventory_assignments', [assignment()]);
    const result = await returnCompanyInventoryItem(scope, { assignmentId: 'assignment-1', capture: { returned: true, complete: true, condition: 'good', accessoriesComplete: false } });
    expect(result.ok).toBe(false); expect(db.writes()).toHaveLength(0);
  });
  it('returns complete undamaged stock to availability and prevents a second return', async () => {
    db.set('inventory_items', [item({ status: 'assigned' })]); db.set('inventory_assignments', [assignment()]);
    const input = { assignmentId: 'assignment-1', capture: { returned: true, complete: true, condition: 'good' as const } };
    expect((await returnCompanyInventoryItem(scope, input)).ok).toBe(true);
    expect(db.rows('inventory_items')[0].status).toBe('available');
    expect((await returnCompanyInventoryItem(scope, input)).ok).toBe(false);
    expect(db.rows('inventory_return_records')).toHaveLength(1);
  });
  it('preserves a missing return as unresolved instead of freeing stock', async () => {
    db.set('inventory_items', [item({ status: 'assigned' })]); db.set('inventory_assignments', [assignment()]);
    expect((await returnCompanyInventoryItem(scope, { assignmentId: 'assignment-1', capture: { returned: false, complete: false, condition: 'unknown', notes: 'Noch bei der Person' } })).ok).toBe(true);
    expect(db.rows('inventory_items')[0].status).toBe('assigned'); expect(db.rows('inventory_assignments')[0].status).toBe('disputed');
  });
  it('does not claim success if the item update fails after recording a return', async () => {
    db.set('inventory_items', [item({ status: 'assigned' })]); db.set('inventory_assignments', [assignment()]); db.fail.set('inventory_items:update', 'error');
    const result = await returnCompanyInventoryItem(scope, { assignmentId: 'assignment-1', capture: { returned: true, complete: true, condition: 'good' } });
    expect(result).toMatchObject({ ok: false, reloadRequired: true });
    expect(db.rows('inventory_return_records')).toHaveLength(1);
  });
  it('damage does not mark an issued item as returned', async () => {
    db.set('inventory_items', [item({ status: 'assigned' })]); db.set('inventory_assignments', [assignment()]);
    expect((await reportCompanyInventoryDamage(scope, { itemId: 'item-1', reportType: 'damage', description: 'Display defekt' })).ok).toBe(true);
    expect(db.rows('inventory_assignments')[0].status).toBe('issued'); expect(db.rows('inventory_items')[0].status).toBe('damaged');
    expect(db.rows('inventory_return_records')).toHaveLength(0);
  });
  it('rejects damage tied to an unrelated assignment', async () => {
    db.set('inventory_assignments', [assignment({ item_id: 'different-item' })]);
    expect((await reportCompanyInventoryDamage(scope, { itemId: 'item-1', assignmentId: 'assignment-1', reportType: 'damage', description: 'Display defekt' })).ok).toBe(false);
    expect(db.writes()).toHaveLength(0);
  });
  it('keeps a loss open for the real offboarding check', async () => {
    db.set('inventory_items', [item({ status: 'assigned' })]); db.set('inventory_assignments', [assignment()]);
    expect((await reportCompanyInventoryDamage(scope, { itemId: 'item-1', reportType: 'loss', description: 'Telefon verloren' })).ok).toBe(true);
    expect(db.rows('inventory_assignments')[0].status).toBe('disputed');
    const checked = await checkCompanyInventoryOffboarding(scope, 'person-1');
    expect(checked.ok && checked.data.canCompleteOffboarding).toBe(false);
    expect(checked.ok && checked.data.openAssignments).toHaveLength(1);
  });
  it('closes a documented damage case without certifying repair or return', async () => {
    db.set('inventory_items', [item({ status: 'damaged' })]); db.set('inventory_assignments', [assignment()]);
    db.set('inventory_damage_reports', [{ id: 'damage-1', tenant_id: TENANT, item_id: 'item-1', report_type: 'damage', condition: 'damaged', description: 'Display defekt', resolved_at: null }]);
    const result = await resolveCompanyInventoryDamage(scope, 'damage-1', 'Kostenübernahme schriftlich geklärt.', 'Display defekt');
    expect(result.ok && result.data.resolvedAt).toBeTruthy();
    expect(result.ok && result.data.description).toContain('Kostenübernahme schriftlich geklärt.');
    expect(result.ok && result.data.description).toContain('Display defekt');
    expect(db.rows('inventory_items')[0].status).toBe('damaged');
    expect(db.rows('inventory_assignments')[0].status).toBe('issued');
    expect(db.rows('inventory_return_records')).toHaveLength(0);
    expect(db.rows('inventory_audit_events')[0].action).toBe('resolve_damage');
  });
  it('requires a closure explanation and rejects stale descriptions', async () => {
    db.set('inventory_damage_reports', [{ id: 'damage-1', tenant_id: TENANT, item_id: 'item-1', description: 'Neuere Beschreibung', resolved_at: null }]);
    expect((await resolveCompanyInventoryDamage(scope, 'damage-1', '')).ok).toBe(false);
    expect(await resolveCompanyInventoryDamage(scope, 'damage-1', 'Geklärt', 'Veraltete Beschreibung')).toMatchObject({ ok: false, reloadRequired: true });
    expect(db.writes()).toHaveLength(0);
  });
  it('detects concurrent closure and surfaces failed closure audits', async () => {
    db.set('inventory_damage_reports', [{ id: 'damage-1', tenant_id: TENANT, item_id: 'item-1', description: 'Defekt', resolved_at: null }]);
    db.beforeWrite = call => { if (call.table === 'inventory_damage_reports') db.rows('inventory_damage_reports')[0].resolved_at = DATE; };
    expect(await resolveCompanyInventoryDamage(scope, 'damage-1', 'Geklärt', 'Defekt')).toMatchObject({ ok: false, reloadRequired: true });
    expect(db.rows('inventory_damage_reports')[0].description).toBe('Defekt');
    db.beforeWrite = undefined; db.rows('inventory_damage_reports')[0].resolved_at = null;
    db.fail.set('inventory_audit_events:insert', 'error');
    expect(await resolveCompanyInventoryDamage(scope, 'damage-1', 'Geklärt', 'Defekt')).toMatchObject({ ok: false, reloadRequired: true });
    expect(db.rows('inventory_damage_reports')[0].resolved_at).toBeTruthy();
  });
  it('confirms and requests a return with optimistic version checks', async () => {
    db.set('inventory_items', [item({ status: 'assigned' })]); db.set('inventory_assignments', [assignment()]);
    const ack = await acknowledgeCompanyInventoryAssignment(scope, 'assignment-1', DATE);
    expect(ack.ok && ack.data.status).toBe('acknowledged');
    const req = await requestCompanyInventoryReturn(scope, 'assignment-1', ack.ok ? ack.data.updatedAt : undefined);
    expect(req.ok && req.data.status).toBe('return_requested');
  });
  it('checks actual personnel assignments without writes or invented device actions', async () => {
    db.set('inventory_assignments', [assignment(), assignment({ id: 'closed', status: 'returned' }), assignment({ id: 'foreign', tenant_id: OTHER })]);
    const result = await checkCompanyInventoryOffboarding(scope, 'person-1');
    expect(result.ok && result.data).toMatchObject({ canCompleteOffboarding: false, portalLockPrepared: false, deviceAccessDeactivatePrepared: false });
    expect(result.ok && result.data.openAssignments.map(a => a.id)).toEqual(['assignment-1']);
    expect(db.writes()).toHaveLength(0);
  });
  it('does not approve offboarding if a required asset is missing from the readable inventory', async () => {
    db.set('inventory_assignments', [assignment({ item_id: 'missing-asset' })]);
    const result = await checkCompanyInventoryOffboarding(scope, 'person-1');
    expect(result.ok).toBe(false);
    expect(db.writes()).toHaveLength(0);
  });
});
