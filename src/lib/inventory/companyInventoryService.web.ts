import type { RoleKey } from '@/types';
import type { PermissionKey } from '@/types/permissions';
import type {
  CreateInventoryItemInput, InventoryAssignment, InventoryAuditEvent, InventoryCategory,
  InventoryCategoryGroup, InventoryCondition, InventoryDamageReport, InventoryItem,
  InventoryItemStatus, InventoryLocation, InventoryReturnRecord, IssueInventoryItemInput,
  OffboardingInventoryCheck, RecordReturnInput,
} from '@/types/inventory';
import { INVENTORY_CATEGORY_GROUPS, INVENTORY_CONDITIONS, INVENTORY_ITEM_STATUSES } from '@/types/inventory';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import {
  mapInventoryAssignment, mapInventoryCategory, mapInventoryDamageReport,
  mapInventoryItem, mapInventoryLocation, mapInventoryReturnRecord,
} from './inventoryMapper';

export type CompanyInventoryScope = { tenantId: string; actorRoleKey: RoleKey | null; actorProfileId?: string | null; effectivePermissions?: readonly PermissionKey[] };
export type CompanyInventoryResult<T> = { ok: true; data: T } | { ok: false; error: string; reloadRequired?: boolean };
export type CompanyInventoryEmployee = { id: string; firstName: string; lastName: string; status: string };
export type CompanyInventoryPermissions = {
  view: boolean; manage: boolean; issue: boolean; returnItems: boolean; reportDamage: boolean;
  offboarding: boolean; viewEmployees: boolean; audit: boolean;
};
export type CompanyInventorySnapshot = {
  items: InventoryItem[]; categories: InventoryCategory[]; locations: InventoryLocation[];
  assignments: InventoryAssignment[]; returns: InventoryReturnRecord[]; damageReports: InventoryDamageReport[];
  employees: CompanyInventoryEmployee[]; employeesVisible: boolean; audit: InventoryAuditEvent[];
};
export type CompanyInventoryItemInput = CreateInventoryItemInput & { id?: string; status?: InventoryItemStatus; expectedUpdatedAt?: string };
export type CompanyInventoryCategoryInput = {
  id?: string; group: InventoryCategoryGroup; label: string; requiresReturnOnExit: boolean;
  portalVisibleToEmployee: boolean; barcodeEnabled: boolean; expectedUpdatedAt?: string;
};
export type CompanyInventoryLocationInput = {
  id?: string; label: string; building?: string | null; room?: string | null; notes?: string | null; expectedUpdatedAt?: string;
};
export type CompanyInventoryDamageInput = {
  itemId: string; assignmentId?: string | null; reportType: InventoryDamageReport['reportType'];
  description: string; condition?: InventoryCondition; expectedUpdatedAt?: string;
};

type Row = Record<string, unknown>;
type Db = NonNullable<ReturnType<typeof getSupabaseClient>>;
type Context = { db: Db; scope: CompanyInventoryScope; permission: PermissionKey; writeAttempted: boolean };
const PAGE = 500;
const CLOSED_ASSIGNMENTS = ['returned', 'damaged_returned', 'archived'];
const RETURNABLE = ['issued', 'acknowledged', 'return_requested', 'partially_returned', 'overdue', 'disputed', 'lost'];
const MANUAL_STATUSES = ['available', 'reserved', 'maintenance', 'damaged', 'lost', 'decommissioned', 'archived'];
const EMPLOYEE_SELECT = 'id,first_name,last_name,status';
const busy = new Set<string>();
const nullable = (value?: string | null) => value?.trim() || null;

class InventoryError extends Error {
  constructor(message: string, readonly reloadRequired = false) { super(message); }
}

export function getCompanyInventoryPermissions(role: RoleKey | null | undefined, effectivePermissions?: readonly PermissionKey[]): CompanyInventoryPermissions {
  const allows = (permission: PermissionKey) => enforcePermission(role, permission, { effectivePermissions }) === null;
  const viewEmployees = allows('office.employees.view');
  return {
    view: allows('inventory.view'), manage: allows('inventory.manage_items'),
    issue: allows('inventory.issue') && viewEmployees, returnItems: allows('inventory.return_manage'),
    reportDamage: allows('inventory.report_damage'), offboarding: allows('inventory.offboarding') && viewEmployees,
    viewEmployees, audit: allows('inventory.audit_view'),
  };
}

function assertScope(scope: CompanyInventoryScope, permission: PermissionKey) {
  const denied = enforcePermission(scope.actorRoleKey, permission, { effectivePermissions: scope.effectivePermissions });
  if (denied && !denied.ok) throw new InventoryError(denied.error);
  const blocked = guardServiceTenant(scope.tenantId);
  if (blocked) throw new InventoryError(blocked.error);
  if (getServiceMode() !== 'supabase') throw new InventoryError('Das Unternehmensinventar benötigt eine aktive Datenbankverbindung. Es werden keine Beispieldaten verwendet.');
}

async function run<T>(scope: CompanyInventoryScope, permission: PermissionKey, work: (ctx: Context) => Promise<T>, mutation = false): Promise<CompanyInventoryResult<T>> {
  let ctx: Context | undefined;
  const lock = `${scope.tenantId}:${scope.actorProfileId ?? scope.actorRoleKey}`;
  let locked = false;
  try {
    assertScope(scope, permission);
    const db = getSupabaseClient();
    if (!db) throw new InventoryError('Die Datenbankverbindung ist nicht verfügbar. Bitte erneut laden.');
    if (mutation) {
      if (busy.has(lock)) throw new InventoryError('Ein Inventarvorgang wird bereits gespeichert. Bitte kurz warten.');
      busy.add(lock); locked = true;
    }
    ctx = { db, scope, permission, writeAttempted: false };
    return { ok: true, data: await work(ctx) };
  } catch (error) {
    const message = error instanceof InventoryError ? error.message : toGermanSupabaseError(error);
    const reloadRequired = Boolean(ctx?.writeAttempted || (error instanceof InventoryError && error.reloadRequired));
    return { ok: false, error: reloadRequired
      ? `${message} Der Speicherstand ist nicht vollständig bestätigt. Bitte neu laden und den Vorgang prüfen, bevor Sie erneut speichern.`
      : message, reloadRequired };
  } finally { if (locked) busy.delete(lock); }
}

function table(ctx: Context, name: string) {
  assertScope(ctx.scope, ctx.permission);
  return fromUnknownTable(ctx.db, name);
}
function beginWrite(ctx: Context) { assertScope(ctx.scope, ctx.permission); ctx.writeAttempted = true; }
function ensureId(id: string | undefined, label: string) { if (!id?.trim()) throw new InventoryError(`${label} fehlt.`); }
function ensureCondition(condition: string) { if (!(INVENTORY_CONDITIONS as readonly string[]).includes(condition)) throw new InventoryError('Bitte einen gültigen Zustand auswählen.'); }
function ensureFresh(row: Row, expected?: string) {
  if (expected && String(row.updated_at) !== expected) throw new InventoryError('Der Eintrag wurde inzwischen geändert.', true);
}
function dateOnly(value: string | null | undefined, label: string) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(`${value}T00:00:00Z`)) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) throw new InventoryError(`${label}: Bitte ein gültiges Datum eingeben.`);
  return value;
}
function timestamp(value: string | null | undefined, label: string) {
  if (!value) return null;
  if (!Number.isFinite(Date.parse(value))) throw new InventoryError(`${label}: Bitte ein gültiges Datum eingeben.`);
  return new Date(value).toISOString();
}
function isRow(value: unknown): value is Row {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function confirmedRow(value: unknown): Row {
  if (!isRow(value) || typeof value.id !== 'string' || !value.id.trim()) {
    throw new InventoryError('Die Datenbankantwort enthält keinen gültigen Inventardatensatz. Bitte erneut laden.');
  }
  return value;
}
async function rows(ctx: Context, name: string, columns = '*', filters: Record<string, string> = {}): Promise<Row[]> {
  const result: Row[] = [];
  for (let start = 0; ; start += PAGE) {
    let query = table(ctx, name).select(columns).eq('tenant_id', ctx.scope.tenantId).order('id').range(start, start + PAGE - 1);
    for (const [key, value] of Object.entries(filters)) query = query.eq(key, value);
    const response = await query;
    if (response.error) throw response.error;
    if (!Array.isArray(response.data)) throw new InventoryError('Die Inventardaten wurden nicht vollständig bestätigt.');
    const page = response.data.map(confirmedRow);
    result.push(...page);
    if (page.length < PAGE) return result;
  }
}
async function one(ctx: Context, name: string, id: string, columns = '*'): Promise<Row> {
  ensureId(id, 'Datensatz');
  const response = await table(ctx, name).select(columns).eq('tenant_id', ctx.scope.tenantId).eq('id', id).maybeSingle();
  if (response.error) throw response.error;
  if (!response.data) throw new InventoryError('Der ausgewählte Eintrag ist für dieses Unternehmen nicht verfügbar.');
  return confirmedRow(response.data);
}
async function insert(ctx: Context, name: string, payload: Row): Promise<Row> {
  beginWrite(ctx);
  const result = await table(ctx, name).insert({ ...payload, tenant_id: ctx.scope.tenantId }).select('*').single();
  if (result.error) throw result.error;
  if (!result.data) throw new InventoryError('Das Anlegen wurde nicht bestätigt.', true);
  return confirmedRow(result.data);
}
async function update(ctx: Context, name: string, existing: Row, payload: Row): Promise<Row> {
  beginWrite(ctx);
  let query = table(ctx, name).update({ ...payload, updated_at: new Date().toISOString() }).eq('tenant_id', ctx.scope.tenantId).eq('id', String(existing.id));
  if (existing.updated_at) query = query.eq('updated_at', String(existing.updated_at));
  if (existing.status) query = query.eq('status', String(existing.status));
  const result = await query.select('*').maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) throw new InventoryError('Der Eintrag wurde inzwischen geändert oder kann nicht bearbeitet werden.', true);
  return confirmedRow(result.data);
}
async function audit(ctx: Context, action: string, entityType: InventoryAuditEvent['entityType'], entityId: string, metadata: Row = {}) {
  await insert(ctx, 'inventory_audit_events', { action, entity_type: entityType, entity_id: entityId, actor_profile_id: ctx.scope.actorProfileId ?? null, metadata });
}
async function itemAssignments(ctx: Context, itemId: string) {
  return (await rows(ctx, 'inventory_assignments', '*', { item_id: itemId })).filter(row => !CLOSED_ASSIGNMENTS.includes(String(row.status)));
}
async function employee(ctx: Context, id: string, activeOnly = false) {
  assertScope(ctx.scope, 'office.employees.view');
  const row = await one(ctx, 'employees', id, EMPLOYEE_SELECT);
  if (activeOnly && !['active', 'aktiv'].includes(String(row.status))) throw new InventoryError('Ausgaben sind nur an aktive Mitarbeitende möglich.');
  return row;
}

export async function loadCompanyInventory(scope: CompanyInventoryScope): Promise<CompanyInventoryResult<CompanyInventorySnapshot>> {
  return run(scope, 'inventory.view', async ctx => {
    const permissions = getCompanyInventoryPermissions(scope.actorRoleKey, scope.effectivePermissions);
    const [items, categories, locations, assignments, returns, damageReports, employees, events] = await Promise.all([
      rows(ctx, 'inventory_items'), rows(ctx, 'inventory_categories'), rows(ctx, 'inventory_locations'),
      rows(ctx, 'inventory_assignments'), rows(ctx, 'inventory_return_records'), rows(ctx, 'inventory_damage_reports'),
      permissions.viewEmployees ? rows(ctx, 'employees', EMPLOYEE_SELECT) : Promise.resolve([]),
      permissions.audit ? rows(ctx, 'inventory_audit_events') : Promise.resolve([]),
    ]);
    const categoryMap = new Map(categories.map(row => [String(row.id), mapInventoryCategory(row)]));
    return {
      items: items.map(row => {
        const category = categoryMap.get(String(row.category_id));
        if (!category) throw new InventoryError('Die Kategorie eines Inventarpostens ist nicht verfügbar. Bitte den Datenbestand prüfen.');
        return mapInventoryItem(row, category.group);
      }), categories: [...categoryMap.values()], locations: locations.map(mapInventoryLocation),
      assignments: assignments.map(mapInventoryAssignment), returns: returns.map(mapInventoryReturnRecord), damageReports: damageReports.map(mapInventoryDamageReport),
      employees: employees.map(row => ({ id: String(row.id), firstName: String(row.first_name ?? ''), lastName: String(row.last_name ?? ''), status: String(row.status ?? '') })), employeesVisible: permissions.viewEmployees,
      audit: events.map(row => ({ id: String(row.id), tenantId: scope.tenantId, actorProfileId: nullable(String(row.actor_profile_id ?? '')), action: String(row.action), entityType: row.entity_type as InventoryAuditEvent['entityType'], entityId: String(row.entity_id), metadata: (row.metadata ?? {}) as Row, createdAt: String(row.created_at) })).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    };
  });
}

export async function saveCompanyInventoryItem(scope: CompanyInventoryScope, input: CompanyInventoryItemInput): Promise<CompanyInventoryResult<InventoryItem>> {
  return run(scope, 'inventory.manage_items', async ctx => {
    if (!input.name?.trim()) throw new InventoryError('Bitte eine Bezeichnung eingeben.');
    ensureId(input.categoryId, 'Kategorie');
    if (input.status && !(INVENTORY_ITEM_STATUSES as readonly string[]).includes(input.status)) throw new InventoryError('Der gewählte Status ist ungültig.');
    if (input.condition) ensureCondition(input.condition);
    const category = mapInventoryCategory(await one(ctx, 'inventory_categories', input.categoryId));
    if (input.locationId) await one(ctx, 'inventory_locations', input.locationId);
    const existing = input.id ? await one(ctx, 'inventory_items', input.id) : null;
    if (existing) ensureFresh(existing, input.expectedUpdatedAt);
    const open = existing ? await itemAssignments(ctx, String(existing.id)) : [];
    const status = input.status ?? (existing ? String(existing.status) : 'available');
    if ((!existing || status !== existing.status) && !MANUAL_STATUSES.includes(status)) throw new InventoryError('Dieser Status wird durch Ausgabe oder Rücknahme festgelegt.');
    if (open.length && (status !== existing?.status || (input.condition !== undefined && input.condition !== existing?.condition))) throw new InventoryError('Bei einer offenen Ausgabe bitte Rücknahme oder Schadenmeldung verwenden.');
    if (status === 'available' && ['damaged', 'unusable', 'lost', 'unknown'].includes(input.condition ?? String(existing?.condition ?? 'new'))) throw new InventoryError('Ein beschädigter, verlorener oder ungeprüfter Posten kann nicht als verfügbar freigegeben werden.');
    const payload = {
      name: input.name.trim(), category_id: input.categoryId, sku: nullable(input.sku), barcode: nullable(input.barcode), serial_number: nullable(input.serialNumber),
      manufacturer: nullable(input.manufacturer), model: nullable(input.model), purchase_date: dateOnly(input.purchaseDate, 'Kaufdatum'), warranty_until: dateOnly(input.warrantyUntil, 'Garantie'),
      location_id: input.locationId || null, status, condition: input.condition ?? existing?.condition ?? 'new', notes: nullable(input.notes),
      requires_return_on_exit: input.requiresReturnOnExit ?? category.requiresReturnOnExit, portal_visible_to_employee: input.portalVisibleToEmployee ?? category.portalVisibleToEmployee,
    };
    const saved = existing ? await update(ctx, 'inventory_items', existing, payload) : await insert(ctx, 'inventory_items', payload);
    await audit(ctx, existing ? 'update_item' : 'create_item', 'inventory_item', String(saved.id), { name: input.name.trim() });
    return mapInventoryItem(saved, category.group);
  }, true);
}

export async function saveCompanyInventoryCategory(scope: CompanyInventoryScope, input: CompanyInventoryCategoryInput): Promise<CompanyInventoryResult<InventoryCategory>> {
  return run(scope, 'inventory.manage_items', async ctx => {
    if (!input.label?.trim()) throw new InventoryError('Bitte eine Kategoriebezeichnung eingeben.');
    if (!(INVENTORY_CATEGORY_GROUPS as readonly string[]).includes(input.group)) throw new InventoryError('Bitte eine gültige Kategoriegruppe auswählen.');
    const existing = input.id ? await one(ctx, 'inventory_categories', input.id) : null;
    if (existing) {
      ensureFresh(existing, input.expectedUpdatedAt);
      if (existing.group_key !== input.group && (await rows(ctx, 'inventory_items', 'id', { category_id: input.id! })).length) throw new InventoryError('Die Gruppe einer bereits verwendeten Kategorie kann nicht geändert werden.');
    }
    const payload = { group_key: input.group, label: input.label.trim(), requires_return_on_exit: input.requiresReturnOnExit, portal_visible_to_employee: input.portalVisibleToEmployee, barcode_enabled: input.barcodeEnabled };
    return mapInventoryCategory(existing ? await update(ctx, 'inventory_categories', existing, payload) : await insert(ctx, 'inventory_categories', payload));
  }, true);
}

export async function saveCompanyInventoryLocation(scope: CompanyInventoryScope, input: CompanyInventoryLocationInput): Promise<CompanyInventoryResult<InventoryLocation>> {
  return run(scope, 'inventory.manage_items', async ctx => {
    if (!input.label?.trim()) throw new InventoryError('Bitte einen Lagerort benennen.');
    const existing = input.id ? await one(ctx, 'inventory_locations', input.id) : null;
    if (existing) ensureFresh(existing, input.expectedUpdatedAt);
    const payload = { label: input.label.trim(), building: nullable(input.building), room: nullable(input.room), notes: nullable(input.notes) };
    return mapInventoryLocation(existing ? await update(ctx, 'inventory_locations', existing, payload) : await insert(ctx, 'inventory_locations', payload));
  }, true);
}

export async function issueCompanyInventoryItem(scope: CompanyInventoryScope, input: IssueInventoryItemInput & { expectedUpdatedAt?: string }): Promise<CompanyInventoryResult<InventoryAssignment>> {
  return run(scope, 'inventory.issue', async ctx => {
    const item = await one(ctx, 'inventory_items', input.itemId);
    ensureFresh(item, input.expectedUpdatedAt);
    await employee(ctx, input.recipientEmployeeId, true);
    if (input.responsibleEmployeeId && input.responsibleEmployeeId !== input.recipientEmployeeId) await employee(ctx, input.responsibleEmployeeId, true);
    if (item.status !== 'available' || (await itemAssignments(ctx, input.itemId)).length) throw new InventoryError('Der Inventarposten ist nicht für eine neue Ausgabe verfügbar.');
    const condition = input.issueCondition ?? item.condition as InventoryCondition;
    ensureCondition(condition);
    if (['lost', 'unusable', 'damaged', 'unknown'].includes(condition) || ['lost', 'unusable', 'damaged', 'unknown'].includes(String(item.condition))) throw new InventoryError('Ein beschädigter, verlorener oder ungeprüfter Posten darf nicht ausgegeben werden.');
    const due = timestamp(input.expectedReturnAt, 'Rückgabefrist');
    if (due && Date.parse(due) <= Date.now()) throw new InventoryError('Die Rückgabefrist muss in der Zukunft liegen.');
    // Claim the stock row first with optimistic locking. A subsequent failure is
    // deliberately not reported as success and must be reconciled after reload.
    await update(ctx, 'inventory_items', item, { status: 'assigned', condition });
    const saved = await insert(ctx, 'inventory_assignments', {
      item_id: input.itemId, recipient_employee_id: input.recipientEmployeeId, responsible_employee_id: input.responsibleEmployeeId || input.recipientEmployeeId,
      issued_by_profile_id: scope.actorProfileId ?? null, issued_at: new Date().toISOString(), expected_return_at: due,
      status: 'issued', issue_condition: condition, issue_notes: nullable(input.issueNotes), return_required: Boolean(item.requires_return_on_exit),
    });
    await audit(ctx, 'issue_item', 'inventory_assignment', String(saved.id), { itemId: input.itemId, recipientEmployeeId: input.recipientEmployeeId });
    return mapInventoryAssignment(saved);
  }, true);
}

export async function returnCompanyInventoryItem(scope: CompanyInventoryScope, input: RecordReturnInput & { expectedUpdatedAt?: string }): Promise<CompanyInventoryResult<InventoryReturnRecord>> {
  return run(scope, 'inventory.return_manage', async ctx => {
    const assignment = await one(ctx, 'inventory_assignments', input.assignmentId);
    ensureFresh(assignment, input.expectedUpdatedAt);
    if (!RETURNABLE.includes(String(assignment.status))) throw new InventoryError('Für diese Ausgabe kann keine weitere Rücknahme erfasst werden.');
    const item = await one(ctx, 'inventory_items', String(assignment.item_id));
    const c = input.capture;
    ensureCondition(c.condition);
    if (c.complete && (!c.returned || c.accessoriesComplete === false || c.chargerReturned === false || c.condition === 'lost')) throw new InventoryError('Eine vollständige Rückgabe darf keine fehlenden Gegenstände oder Zubehörteile enthalten.');
    if (c.returned && c.condition === 'lost') throw new InventoryError('Ein verlorener Posten kann nicht gleichzeitig als zurückgegeben erfasst werden.');
    if (!c.returned && !nullable(c.notes) && !nullable(c.damageDescription)) throw new InventoryError('Bitte die fehlende Rückgabe beschreiben.');
    if (['damaged', 'unusable'].includes(c.condition) && !nullable(c.damageDescription)) throw new InventoryError('Bitte die Beschädigung beschreiben.');
    const damaged = ['damaged', 'unusable'].includes(c.condition);
    const assignmentStatus = !c.returned ? 'disputed' : !c.complete ? 'partially_returned' : damaged ? 'damaged_returned' : 'returned';
    const itemStatus = !c.returned ? String(item.status) : !c.complete || c.condition === 'unknown' ? 'maintenance' : damaged ? 'damaged' : 'available';
    const competing = (await itemAssignments(ctx, String(item.id))).filter(row => row.id !== assignment.id);
    if (competing.length) throw new InventoryError('Für diesen Posten bestehen mehrere offene Ausgaben. Bitte den Bestand zuerst klären.', true);
    await update(ctx, 'inventory_assignments', assignment, { status: assignmentStatus });
    const saved = await insert(ctx, 'inventory_return_records', {
      assignment_id: assignment.id, item_id: item.id, employee_id: assignment.recipient_employee_id,
      returned_at: new Date().toISOString(), returned: c.returned, complete: c.complete, condition: c.condition,
      damage_description: nullable(c.damageDescription), accessories_complete: c.accessoriesComplete ?? null, charger_returned: c.chargerReturned ?? null,
      sim_removed: c.simRemoved ?? null, device_reset: c.deviceReset ?? null, data_deleted: c.dataDeleted ?? null,
      photo_refs: c.photoRefs ?? [], signature_refs: c.signatureRefs ?? [], notes: nullable(c.notes), recorded_by_profile_id: scope.actorProfileId ?? null,
    });
    if (c.returned) await update(ctx, 'inventory_items', item, { status: itemStatus, condition: c.condition });
    await audit(ctx, 'record_return', 'inventory_return', String(saved.id), { itemId: item.id, assignmentId: assignment.id, complete: c.complete });
    return mapInventoryReturnRecord(saved);
  }, true);
}

export async function reportCompanyInventoryDamage(scope: CompanyInventoryScope, input: CompanyInventoryDamageInput): Promise<CompanyInventoryResult<InventoryDamageReport>> {
  return run(scope, 'inventory.report_damage', async ctx => {
    if (!input.description?.trim()) throw new InventoryError('Bitte den Vorfall beschreiben.');
    if (!['damage', 'loss', 'missing_return'].includes(input.reportType)) throw new InventoryError('Bitte eine gültige Meldungsart auswählen.');
    const item = await one(ctx, 'inventory_items', input.itemId);
    ensureFresh(item, input.expectedUpdatedAt);
    if (['archived', 'decommissioned'].includes(String(item.status))) throw new InventoryError('Für archivierte oder ausgemusterte Posten kann kein neuer Vorfall erfasst werden.');
    const open = await itemAssignments(ctx, input.itemId);
    if (open.length > 1) throw new InventoryError('Für diesen Posten bestehen mehrere offene Ausgaben. Bitte zuerst klären.', true);
    let assignment: Row | undefined;
    if (input.assignmentId) {
      assignment = await one(ctx, 'inventory_assignments', input.assignmentId);
      if (assignment.item_id !== item.id || CLOSED_ASSIGNMENTS.includes(String(assignment.status))) throw new InventoryError('Die ausgewählte Ausgabe gehört nicht zu diesem offenen Vorgang.');
    } else assignment = open[0];
    if (input.reportType === 'missing_return' && !assignment) throw new InventoryError('Eine fehlende Rückgabe benötigt eine offene Ausgabe.');
    const condition = input.condition ?? (input.reportType === 'loss' ? 'lost' : input.reportType === 'damage' ? 'damaged' : item.condition as InventoryCondition);
    ensureCondition(condition);
    if (input.reportType === 'loss' && condition !== 'lost') throw new InventoryError('Bei einem Verlust muss der Zustand als verloren erfasst werden.');
    if (input.reportType === 'damage' && !['damaged', 'unusable'].includes(condition)) throw new InventoryError('Eine Schadenmeldung benötigt einen beschädigten oder nicht nutzbaren Zustand.');
    const saved = await insert(ctx, 'inventory_damage_reports', {
      item_id: item.id, assignment_id: assignment?.id ?? null, employee_id: assignment?.recipient_employee_id ?? null,
      report_type: input.reportType, description: input.description.trim(), condition, reported_at: new Date().toISOString(), reported_by_profile_id: scope.actorProfileId ?? null,
    });
    if (input.reportType !== 'missing_return') await update(ctx, 'inventory_items', item, { status: input.reportType === 'loss' ? 'lost' : 'damaged', condition });
    // A damage/loss report never implies physical return. Responsibility stays open.
    if (assignment && ['loss', 'missing_return'].includes(input.reportType)) await update(ctx, 'inventory_assignments', assignment, { status: 'disputed' });
    await audit(ctx, `report_${input.reportType}`, 'inventory_damage', String(saved.id), { itemId: item.id, assignmentId: assignment?.id ?? null });
    return mapInventoryDamageReport(saved);
  }, true);
}

/** Close the report only; this does not certify repair, return or release stock. */
export async function resolveCompanyInventoryDamage(scope: CompanyInventoryScope, reportId: string, notes: string, expectedDescription?: string): Promise<CompanyInventoryResult<InventoryDamageReport>> {
  return run(scope, 'inventory.manage_items', async ctx => {
    if (!notes?.trim()) throw new InventoryError('Bitte dokumentieren, wie der Vorfall geklärt wurde.');
    const report = await one(ctx, 'inventory_damage_reports', reportId);
    if (report.resolved_at) throw new InventoryError('Dieser Vorfall wurde bereits abgeschlossen.', true);
    if (expectedDescription !== undefined && expectedDescription !== String(report.description)) throw new InventoryError('Die Schadenmeldung wurde inzwischen geändert.', true);
    await one(ctx, 'inventory_items', String(report.item_id));
    const resolvedAt = new Date().toISOString();
    const description = `${String(report.description)}\n\nKlärung (${new Intl.DateTimeFormat('de-DE', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Berlin' }).format(new Date(resolvedAt))}):\n${notes.trim()}`;
    // The existing table has no updated_at column. Compare its original text and
    // open state instead, and require the updated row to confirm the write.
    beginWrite(ctx);
    const result = await table(ctx, 'inventory_damage_reports')
      .update({ resolved_at: resolvedAt, description })
      .eq('tenant_id', scope.tenantId).eq('id', reportId)
      .eq('description', String(report.description)).is('resolved_at', null)
      .select('*').maybeSingle();
    if (result.error) throw result.error;
    if (!result.data) throw new InventoryError('Der Vorfall wurde inzwischen geändert oder abgeschlossen.', true);
    await audit(ctx, 'resolve_damage', 'inventory_damage', reportId, { itemId: report.item_id, resolution: notes.trim(), resolvedAt });
    return mapInventoryDamageReport(confirmedRow(result.data));
  }, true);
}

async function changeAssignment(scope: CompanyInventoryScope, assignmentId: string, action: 'request' | 'acknowledge', expectedUpdatedAt?: string): Promise<CompanyInventoryResult<InventoryAssignment>> {
  return run(scope, action === 'request' ? 'inventory.return_manage' : 'inventory.issue', async ctx => {
    const assignment = await one(ctx, 'inventory_assignments', assignmentId);
    ensureFresh(assignment, expectedUpdatedAt);
    await one(ctx, 'inventory_items', String(assignment.item_id));
    const allowed = action === 'request' ? ['issued', 'acknowledged', 'partially_returned', 'overdue', 'disputed'] : ['issued'];
    if (!allowed.includes(String(assignment.status))) throw new InventoryError('Diese Aktion ist für den aktuellen Ausgabestatus nicht möglich.');
    const saved = await update(ctx, 'inventory_assignments', assignment, action === 'request' ? { status: 'return_requested' } : { status: 'acknowledged', acknowledged_at: new Date().toISOString() });
    await audit(ctx, action === 'request' ? 'request_return' : 'acknowledge_assignment', 'inventory_assignment', assignmentId, { itemId: assignment.item_id });
    return mapInventoryAssignment(saved);
  }, true);
}
export function requestCompanyInventoryReturn(scope: CompanyInventoryScope, assignmentId: string, expectedUpdatedAt?: string) { return changeAssignment(scope, assignmentId, 'request', expectedUpdatedAt); }
export function acknowledgeCompanyInventoryAssignment(scope: CompanyInventoryScope, assignmentId: string, expectedUpdatedAt?: string) { return changeAssignment(scope, assignmentId, 'acknowledge', expectedUpdatedAt); }

export async function checkCompanyInventoryOffboarding(scope: CompanyInventoryScope, employeeId: string): Promise<CompanyInventoryResult<OffboardingInventoryCheck>> {
  return run(scope, 'inventory.offboarding', async ctx => {
    await employee(ctx, employeeId);
    const [allAssignments, items] = await Promise.all([rows(ctx, 'inventory_assignments'), rows(ctx, 'inventory_items', 'id,name,category_id,requires_return_on_exit')]);
    const itemMap = new Map(items.map(row => [String(row.id), row]));
    const relevant = allAssignments.filter(row => (row.recipient_employee_id === employeeId || row.responsible_employee_id === employeeId) && !CLOSED_ASSIGNMENTS.includes(String(row.status)) && Boolean(row.return_required));
    if (relevant.some(row => !itemMap.has(String(row.item_id)))) throw new InventoryError('Die Austrittsprüfung ist unvollständig, weil ein zugeordneter Inventarposten nicht verfügbar ist.');
    const openAssignments = relevant.map(mapInventoryAssignment);
    return { employeeId, canCompleteOffboarding: openAssignments.length === 0, openAssignments,
      returnTasksSuggested: relevant.map(row => `Rückgabe klären: ${String(itemMap.get(String(row.item_id))!.name)}`),
      portalLockPrepared: false, deviceAccessDeactivatePrepared: false };
  });
}
