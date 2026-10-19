import {
  captureClientNativePage,
  cloneClientNativeOriginal,
  freezeClientNativeOriginal,
  type ClientNativeRow,
  type ClientNativeScope,
} from './clientRecordNativeOriginal.web.ts';

export type ClientTherapyPrescriptionFieldWeb = Readonly<{
  key: string;
  state: 'missing' | 'undefined' | 'null' | 'empty' | 'value' | 'unresolved';
  text: string | null;
}>;

export type ClientTherapyPrescriptionEvidenceWeb = Readonly<{
  kind: 'unbound_therapy_prescription_evidence';
  authority: 'inspection_only';
  tenantId: string;
  clientId: string;
  entries: readonly Readonly<{
    nativeId: string;
    fields: readonly ClientTherapyPrescriptionFieldWeb[];
    appointmentRelation: 'not_provided';
    providerRelation: 'not_provided';
    followUpTaskRelation: 'not_provided';
    performanceInference: 'not_inferred';
  }>[];
}>;

const keys = [
  'prescription_type', 'title', 'issued_at', 'valid_until', 'doctor', 'document_id',
  'status', 'note', 'created_at', 'updated_at',
] as const;
const originals = new WeakMap<object, readonly ClientNativeRow[]>();

function field(row: ClientNativeRow, key: string): ClientTherapyPrescriptionFieldWeb {
  if (!Object.hasOwn(row, key)) return { key, state: 'missing', text: null };
  const value = Object.getOwnPropertyDescriptor(row, key)!.value;
  if (value === undefined) return { key, state: 'undefined', text: null };
  if (value === null) return { key, state: 'null', text: null };
  if (value === '') return { key, state: 'empty', text: '' };
  return typeof value === 'string'
    ? { key, state: 'value', text: value }
    : { key, state: 'unresolved', text: null };
}

/** Read-only originals. No title/name/date matching to appointments, providers or tasks. */
export function captureClientTherapyPrescriptionEvidenceWeb(
  input: unknown,
  scope: ClientNativeScope,
): ClientTherapyPrescriptionEvidenceWeb | null {
  try {
    const supplied = cloneClientNativeOriginal(input);
    const rows = captureClientNativePage(supplied, scope, null);
    const captured = freezeClientNativeOriginal(rows);
    const model = freezeClientNativeOriginal({
      kind: 'unbound_therapy_prescription_evidence' as const,
      authority: 'inspection_only' as const,
      tenantId: scope.tenantId,
      clientId: scope.clientId,
      entries: captured.map(row => ({
        nativeId: row.id as string,
        fields: keys.map(key => field(row, key)),
        appointmentRelation: 'not_provided' as const,
        providerRelation: 'not_provided' as const,
        followUpTaskRelation: 'not_provided' as const,
        performanceInference: 'not_inferred' as const,
      })),
    });
    originals.set(model, captured);
    return model;
  } catch {
    return null;
  }
}

export function clientTherapyPrescriptionOriginalsWeb(model: unknown): readonly ClientNativeRow[] | null {
  return model && typeof model === 'object' ? originals.get(model) ?? null : null;
}
