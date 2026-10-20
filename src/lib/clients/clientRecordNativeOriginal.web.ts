import { woundUuid } from '../pflege/woundCareDomain.ts';

export type ClientNativeRow = Record<string, unknown>;
export type ClientNativeScope = { tenantId: string; clientId: string };
export const CLIENT_RECORD_NATIVE_POOLS = {
  contacts: 'client_contacts', consents: 'client_consents', audit: 'client_audit_entries',
  history: 'client_history_entries', addresses: 'client_addresses', careLevels: 'client_care_levels',
  budgets: 'client_budgets', billingProfiles: 'client_billing_profiles', contracts: 'client_contracts',
  documents: 'client_documents', intakeDocuments: 'client_intake_documents', documentEvents: 'client_document_events', notes: 'client_notes',
  risks: 'client_risks', prescriptions: 'client_prescriptions', portalAccess: 'client_portal_access', tasks: 'client_tasks', timeline: 'client_timeline_events',
} as const;
export type ClientNativePoolKey = keyof typeof CLIENT_RECORD_NATIVE_POOLS;
export type ClientNativeParts = { client: ClientNativeRow } & Record<ClientNativePoolKey, ClientNativeRow[]>;
export type ClientNativeOriginals = {
  parts: ClientNativeParts;
  careContexts: ClientNativeRow[] | null;
  coreSensitiveFields: 'requested' | 'not_requested';
  selectors: Record<string, string>;
  // Exactly these delivered queries, not an atomic snapshot or all possible signature/event tables.
  queriedPools: string[];
};

const plain = (value: unknown): value is ClientNativeRow => !!value && typeof value === 'object'
  && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));

/** Check descriptors before reading even owner fields. No dropped extras, getters, sparse arrays or class instances. */
export function cloneClientNativeOriginal<T>(value: T, seen = new Set<object>()): T {
  if (value === null || value === undefined || typeof value === 'string' || typeof value === 'boolean'
    || typeof value === 'number' && Number.isFinite(value)) return value;
  if ((!plain(value) && !(Array.isArray(value) && Object.getPrototypeOf(value) === Array.prototype))
    || seen.has(value as object)) throw Error('Der gelieferte native Aktenbestand hat kein verlustfrei prüfbares Originalformat.');
  seen.add(value as object);
  const output: ClientNativeRow | unknown[] = Array.isArray(value) ? [] : Object.create(Object.getPrototypeOf(value));
  for (const key of Reflect.ownKeys(value as object)) {
    if (Array.isArray(value) && key === 'length') continue;
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    if (typeof key !== 'string' || !('value' in descriptor) || !descriptor.enumerable
      || Array.isArray(value) && (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= value.length)) {
      throw Error('Ungeklärte native Aktenfelder dürfen vor der Originalprüfung nicht entfallen.');
    }
    Object.defineProperty(output, key, { value: cloneClientNativeOriginal(descriptor.value, seen), enumerable: true, configurable: true, writable: true });
  }
  if (Array.isArray(value)) for (let index = 0; index < value.length; index++) {
    if (!Object.hasOwn(value, index)) throw Error('Eine gelieferte native Aktenseite enthält Lücken.');
  }
  seen.delete(value as object);
  return output as T;
}
export function freezeClientNativeOriginal<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) freezeClientNativeOriginal((value as ClientNativeRow)[key]);
    Object.freeze(value);
  }
  return value;
}
export function sameClientNativeOriginal(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) return Array.isArray(left) && Array.isArray(right)
    && left.length === right.length && left.every((value, index) => sameClientNativeOriginal(value, right[index]));
  if (!plain(left) || !plain(right)) return false;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every(key => Object.hasOwn(right, key) && sameClientNativeOriginal(left[key], right[key]));
}
export function assertClientNativeScope(scope: ClientNativeScope): void {
  if (!woundUuid(scope.tenantId) || !woundUuid(scope.clientId)) throw Error('Eigener nativer Mandant und Klient sind für diesen Aktenabruf nicht bestätigt.');
}
function ownRow(row: unknown, scope: ClientNativeScope, root: boolean): asserts row is ClientNativeRow {
  if (!plain(row) || !Object.hasOwn(row, 'id') || !woundUuid(row.id)
    || !Object.hasOwn(row, 'tenant_id') || row.tenant_id !== scope.tenantId
    || root && row.id !== scope.clientId
    || !root && (!Object.hasOwn(row, 'client_id') || row.client_id !== scope.clientId)) {
    throw Error('Eine native Aktenzeile hat ungeklärte Kennungen oder Zuordnung.');
  }
  // Unknown/missing/legacy metadata is an original, not a clinical instant or a prerequisite for UUID paging.
}
export function captureClientNativeRoot(input: unknown, scope: ClientNativeScope): ClientNativeRow {
  assertClientNativeScope(scope);
  const root = cloneClientNativeOriginal(input);
  ownRow(root, scope, true);
  return freezeClientNativeOriginal(root);
}
/** UUID ascending is only a paging order. It has no clinical or revision-head meaning. */
export function captureClientNativePage(input: unknown, scope: ClientNativeScope, cursor: string | null): ClientNativeRow[] {
  assertClientNativeScope(scope);
  if (cursor !== null && !woundUuid(cursor)) throw Error('Der native Akten-Seitencursor ist ungültig.');
  const page = cloneClientNativeOriginal(input);
  if (!Array.isArray(page)) throw Error('Eine native Aktenseite wurde nicht als vollständige Liste geliefert.');
  let previous = cursor?.toLowerCase() ?? null;
  for (const row of page) {
    ownRow(row, scope, false);
    const id = (row.id as string).toLowerCase();
    if (previous !== null && id <= previous) throw Error('Native Aktenseiten enthalten doppelte oder nicht fortschreitende Kennungen.');
    previous = id;
  }
  return freezeClientNativeOriginal(page);
}
const contexts = new Set(['daily_assistance', 'support_care', 'companionship', 'ambulatory_care', 'stationary_care', 'consulting', 'academy_prepared']);
export function captureClientNativeContexts(rows: ClientNativeRow[]): string[] {
  const seen = new Set<string>();
  for (const row of rows) {
    if (typeof row.context_key !== 'string' || !contexts.has(row.context_key) || typeof row.is_primary !== 'boolean' || seen.has(row.context_key)) {
      throw Error('Die gelieferten nativen Leistungsbereiche sind nicht eindeutig bestätigt.');
    }
    seen.add(row.context_key);
  }
  // Same established primary-first projection, with deterministic UUID order among equals. Empty stays empty.
  return [...rows].sort((a, b) => Number(b.is_primary) - Number(a.is_primary)).map(row => row.context_key as string);
}
