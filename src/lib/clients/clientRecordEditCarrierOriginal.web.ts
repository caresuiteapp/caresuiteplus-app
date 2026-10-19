import { cloneClientNativeOriginal, freezeClientNativeOriginal, assertClientNativeScope, type ClientNativeRow, type ClientNativeScope } from './clientRecordNativeOriginal.web';
import { woundInstant, woundUuid } from '../pflege/woundCareDomain.ts';

export const CLIENT_EDIT_CARRIER_POOLS = {
  assignments: 'client_cost_carrier_assignments', overrides: 'tenant_cost_carrier_overrides', templates: 'cost_carrier_system_templates',
} as const;
export type ClientEditCarrierPool = keyof typeof CLIENT_EDIT_CARRIER_POOLS;
export type ClientEditCarrierOriginals = Readonly<{
  scope: ClientNativeScope;
  overrideScope: 'assignment_references';
  pools: Record<ClientEditCarrierPool, readonly ClientNativeRow[]>;
  /** Association only. A delivered relation is neither a validity nor a write grant. */
  links: readonly Readonly<{
    assignmentId: string; systemTemplateId: string | null; tenantOverrideId: string | null;
    systemTemplate: 'none' | 'delivered' | 'not_delivered' | 'different_type';
    tenantOverride: 'none' | 'delivered' | 'not_delivered' | 'different_type';
  }>[];
}>;
const fail = () => Error('Die ganzen nativen Kostenträgeroriginale sind nicht eindeutig und verlustfrei zugeordnet.');
const own = (row: ClientNativeRow, key: string): unknown => { if (!Object.hasOwn(row, key)) throw fail(); return row[key]; };
const text = (row: ClientNativeRow, key: string, nullable = false): void => {
  const value = own(row, key); if (nullable && value === null) return;
  if (typeof value !== 'string') throw fail();
};
function uuid(row: ClientNativeRow, key: string, nullable = false): void {
  const value = own(row, key); if (nullable && value === null) return;
  if (!woundUuid(value)) throw fail();
}
function instant(row: ClientNativeRow, key: string, nullable = false): void {
  const value = own(row, key); if (nullable && value === null) return;
  if (typeof value !== 'string' || woundInstant(value.replace(' ', 'T')) === null) throw fail();
}
function date(row: ClientNativeRow, key: string): void {
  const value = own(row, key); if (value === null) return;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number(value.slice(0, 4)) < 1
    || woundInstant(`${value}T00:00:00Z`) === null) throw fail();
}
function rowOriginal(row: unknown, pool: ClientEditCarrierPool, scope: ClientNativeScope): asserts row is ClientNativeRow {
  if (!row || typeof row !== 'object' || Array.isArray(row)) throw fail();
  const r = row as ClientNativeRow;
  uuid(r, 'id');
  if (pool !== 'templates' && own(r, 'tenant_id') !== scope.tenantId) throw fail();
  if (pool === 'assignments' && own(r, 'client_id') !== scope.clientId) throw fail();
  text(r, 'carrier_type'); if (!String(r.carrier_type).trim()) throw fail();
  instant(r, 'created_at'); instant(r, 'updated_at');
  if (pool !== 'templates') { uuid(r, 'created_by', true); uuid(r, 'updated_by', true); uuid(r, 'system_template_id', true); }
  if (pool === 'assignments') {
    uuid(r, 'tenant_override_id', true); instant(r, 'archived_at', true); date(r, 'valid_from'); date(r, 'valid_until');
    for (const key of ['name_snapshot']) text(r, key);
    for (const key of ['ik_number_snapshot', 'policy_number', 'insurance_number']) text(r, key, true);
    for (const key of ['care_level_relevant', 'billing_relevant', 'is_primary']) if (typeof own(r, key) !== 'boolean') throw fail();
    // Native JSONB can have a legacy shape. Preserve it whole; do not invent empty address fields.
    own(r, 'address_snapshot');
  } else if (pool === 'overrides') {
    for (const key of ['custom_name', 'custom_ik_number', 'custom_address_line_1', 'custom_postal_code', 'custom_city', 'custom_contact_name', 'custom_phone', 'custom_email', 'notes']) text(r, key, true);
    if (typeof own(r, 'is_active') !== 'boolean') throw fail();
  } else {
    if (!['care_insurance', 'health_insurance', 'private_insurance', 'social_welfare_office', 'employers_liability_insurance', 'accident_insurance'].includes(String(r.carrier_type))) throw fail();
    for (const key of ['template_key', 'ui_label', 'name', 'country', 'validity_status', 'data_status']) text(r, key);
    if (!['active', 'inactive', 'deprecated', 'merged', 'unknown', 'needs_review'].includes(String(r.validity_status))) throw fail();
    date(r, 'source_last_checked_at'); if (typeof own(r, 'is_system_template') !== 'boolean') throw fail();
    // These global catalog rows have no tenant/client/actor requirement in local0057.
    own(r, 'metadata');
  }
}
/** Whole lossless native page before scope/selection. Global templates have their own namespace. */
export function captureClientEditCarrierPage(input: unknown, pool: ClientEditCarrierPool, scope: ClientNativeScope, after: string | null): ClientNativeRow[] {
  assertClientNativeScope(scope);
  if (!Object.hasOwn(CLIENT_EDIT_CARRIER_POOLS, pool) || after !== null && !woundUuid(after)) throw fail();
  const rows = cloneClientNativeOriginal(input);
  if (!Array.isArray(rows)) throw fail();
  let cursor = after?.toLowerCase() ?? null;
  for (const row of rows) {
    rowOriginal(row, pool, scope);
    const id = String(row.id).toLowerCase(); if (cursor !== null && id <= cursor) throw fail(); cursor = id;
  }
  return rows;
}
/** Pure original capture only; no native read provenance, permission, persistence or clinical completion is inferred. */
export function captureClientEditCarrierOriginals(input: unknown, scopeInput: ClientNativeScope): ClientEditCarrierOriginals {
  const scope = cloneClientNativeOriginal(scopeInput); assertClientNativeScope(scope);
  const source = cloneClientNativeOriginal(input);
  if (!source || typeof source !== 'object' || Array.isArray(source)
    || Object.keys(source).length !== 3 || Object.keys(CLIENT_EDIT_CARRIER_POOLS).some(key => !Object.hasOwn(source, key))) throw fail();
  const pools = {} as Record<ClientEditCarrierPool, ClientNativeRow[]>;
  for (const pool of Object.keys(CLIENT_EDIT_CARRIER_POOLS) as ClientEditCarrierPool[]) {
    const rows = (source as Record<string, unknown>)[pool]; if (!Array.isArray(rows)) throw fail();
    const ids = new Set<string>();
    for (const row of rows) { rowOriginal(row, pool, scope); const key = String(row.id).toLowerCase(); if (ids.has(key)) throw fail(); ids.add(key); }
    pools[pool] = rows;
  }
  const ownOverrideIds = new Set(pools.assignments.filter(row => row.tenant_override_id !== null).map(row => String(row.tenant_override_id).toLowerCase()));
  if (pools.overrides.some(row => !ownOverrideIds.has(String(row.id).toLowerCase()))) throw fail();
  const templates = new Map(pools.templates.map(row => [String(row.id).toLowerCase(), row]));
  const overrides = new Map(pools.overrides.map(row => [String(row.id).toLowerCase(), row]));
  const relation = (map: Map<string, ClientNativeRow>, id: string | null, type: unknown) => {
    if (id === null) return 'none' as const;
    const row = map.get(id.toLowerCase()); return !row ? 'not_delivered' as const : row.carrier_type === type ? 'delivered' as const : 'different_type' as const;
  };
  const links = pools.assignments.map(row => ({ assignmentId: row.id as string, systemTemplateId: row.system_template_id as string | null,
    tenantOverrideId: row.tenant_override_id as string | null, systemTemplate: relation(templates, row.system_template_id as string | null, row.carrier_type),
    tenantOverride: relation(overrides, row.tenant_override_id as string | null, row.carrier_type) }));
  return freezeClientNativeOriginal({ scope, overrideScope: 'assignment_references' as const, pools, links });
}
