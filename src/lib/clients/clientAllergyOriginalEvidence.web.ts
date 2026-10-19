import {
  captureClientNativeRoot, cloneClientNativeOriginal, freezeClientNativeOriginal,
  type ClientNativeRow,
} from './clientRecordNativeOriginal.web.ts';

export type ClientAllergyEvidenceFieldWeb = Readonly<{
  key: string;
  state: 'missing' | 'undefined' | 'null' | 'empty' | 'value' | 'unresolved';
  /** Only an unchanged own string can cross the primitive display boundary. */
  text: string | null;
}>;
export type ClientAllergyOriginalEvidenceWeb = Readonly<{
  kind: 'unbound_client_allergy_original_evidence';
  authority: 'inspection_only';
  tenantId: string;
  clientId: string;
  note: ClientAllergyEvidenceFieldWeb;
  rowMetadata: readonly ClientAllergyEvidenceFieldWeb[];
  clinicalInference: 'not_inferred';
}>;
const originals = new WeakMap<object, ClientNativeRow>();
const plain = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object'
  && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
function field(root: ClientNativeRow, key: string): ClientAllergyEvidenceFieldWeb {
  if (!Object.hasOwn(root, key)) return { key, state: 'missing', text: null };
  const value = Object.getOwnPropertyDescriptor(root, key)!.value;
  if (value === undefined) return { key, state: 'undefined', text: null };
  if (value === null) return { key, state: 'null', text: null };
  if (value === '') return { key, state: 'empty', text: '' };
  return typeof value === 'string' ? { key, state: 'value', text: value } : { key, state: 'unresolved', text: null };
}
/** Pure, query-free delivered-root evidence. Neither this model nor its copied scope grants a current read. */
export function captureClientAllergyOriginalEvidenceWeb(input: unknown, expected: unknown): ClientAllergyOriginalEvidenceWeb | null {
  try {
    const scope = cloneClientNativeOriginal(expected);
    if (!plain(scope) || Object.keys(scope).length !== 2 || !['tenantId', 'clientId'].every(key => Object.hasOwn(scope, key)
      && typeof Object.getOwnPropertyDescriptor(scope, key)!.value === 'string')) return null;
    const root = captureClientNativeRoot(input, { tenantId: scope.tenantId as string, clientId: scope.clientId as string });
    const model = freezeClientNativeOriginal({
      kind: 'unbound_client_allergy_original_evidence' as const, authority: 'inspection_only' as const,
      tenantId: scope.tenantId as string, clientId: scope.clientId as string,
      note: field(root, 'allergies'),
      // General row metadata, never an allergy-specific author, acquisition time, revision, or care event.
      rowMetadata: ['created_at', 'updated_at', 'created_by', 'updated_by'].map(key => field(root, key)),
      clinicalInference: 'not_inferred' as const,
    });
    originals.set(model, root);
    return model;
  } catch { return null; }
}
/** Private original preservation only; not a current receipt, NativeCan, clinical status or Child prop. */
export function clientAllergyEvidenceOriginalWeb(model: unknown): ClientNativeRow | null {
  return model && typeof model === 'object' ? originals.get(model) ?? null : null;
}
