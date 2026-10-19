import {
  captureClientNativePage,
  cloneClientNativeOriginal,
  freezeClientNativeOriginal,
  type ClientNativeRow,
} from './clientRecordNativeOriginal.web.ts';

export type ClientCareLevelEvidenceFieldWeb = Readonly<{
  key: string;
  state: 'missing' | 'undefined' | 'null' | 'empty' | 'value' | 'unresolved';
  /** Only an unchanged own string can cross the primitive display boundary. */
  text: string | null;
}>;

export type ClientCareLevelEvidenceEntryWeb = Readonly<{
  nativeId: string;
  fields: readonly ClientCareLevelEvidenceFieldWeb[];
  entitlementInference: 'not_inferred';
}>;

export type ClientCareLevelEvidenceWeb = Readonly<{
  kind: 'unbound_client_care_level_evidence';
  authority: 'inspection_only';
  tenantId: string;
  clientId: string;
  entries: readonly ClientCareLevelEvidenceEntryWeb[];
  currentEntitlement: 'not_inferred';
}>;

const originals = new WeakMap<object, readonly ClientNativeRow[]>();
const displayKeys = [
  'id',
  'grade',
  'valid_from',
  'valid_until',
  'care_fund_name',
  'care_fund_member_id',
  'md_assessment_date',
  'notes',
  'created_at',
  'updated_at',
] as const;

function field(row: ClientNativeRow, key: string): ClientCareLevelEvidenceFieldWeb {
  if (!Object.hasOwn(row, key)) return { key, state: 'missing', text: null };
  const value = Object.getOwnPropertyDescriptor(row, key)!.value;
  if (value === undefined) return { key, state: 'undefined', text: null };
  if (value === null) return { key, state: 'null', text: null };
  if (value === '') return { key, state: 'empty', text: '' };
  return typeof value === 'string'
    ? { key, state: 'value', text: value }
    : { key, state: 'unresolved', text: null };
}

function scopeFrom(expected: unknown): { tenantId: string; clientId: string } | null {
  try {
    const scope = cloneClientNativeOriginal(expected);
    if (!scope || typeof scope !== 'object' || Array.isArray(scope)
      || ![Object.prototype, null].includes(Object.getPrototypeOf(scope))
      || Object.keys(scope).length !== 2) return null;
    for (const key of ['tenantId', 'clientId']) {
      if (!Object.hasOwn(scope, key) || typeof Object.getOwnPropertyDescriptor(scope, key)!.value !== 'string') return null;
    }
    return scope as { tenantId: string; clientId: string };
  } catch {
    return null;
  }
}

/**
 * Pure, query-free evidence from the complete delivered native pool. UUID order is
 * only the reader's paging order and never a revision/current-entitlement choice.
 */
export function captureClientCareLevelEvidenceWeb(input: unknown, expected: unknown): ClientCareLevelEvidenceWeb | null {
  try {
    const scope = scopeFrom(expected);
    if (!scope) return null;
    const rows = captureClientNativePage(input, scope, null);
    const model = freezeClientNativeOriginal({
      kind: 'unbound_client_care_level_evidence' as const,
      authority: 'inspection_only' as const,
      tenantId: scope.tenantId,
      clientId: scope.clientId,
      entries: rows.map(row => ({
        nativeId: Object.getOwnPropertyDescriptor(row, 'id')!.value as string,
        fields: displayKeys.map(key => field(row, key)),
        entitlementInference: 'not_inferred' as const,
      })),
      currentEntitlement: 'not_inferred' as const,
    });
    originals.set(model, rows);
    return model;
  } catch {
    return null;
  }
}

/** Private preservation only; not a current receipt, grant, Bescheid or Child prop. */
export function clientCareLevelEvidenceOriginalsWeb(model: unknown): readonly ClientNativeRow[] | null {
  return model && typeof model === 'object' ? originals.get(model) ?? null : null;
}
