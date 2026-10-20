import type { ServiceResult } from '@/types';
import type {
  EmployeePortalSignatureCaptureInput,
  EmployeePortalSignatureRecord,
  EmployeePortalSignatureType,
} from '@/types/modules/employeePortalExecution';

let signatureCounter = 0;
const SIGNATURE_STORE = new Map<string, EmployeePortalSignatureRecord[]>();

function hashContent(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return `sig-${Math.abs(hash).toString(16)}`;
}

function signatureKey(tenantId: string, assignmentId: string): string {
  return `${tenantId}:${assignmentId}`;
}

export function captureEmployeePortalSignature(
  tenantId: string,
  assignmentId: string,
  clientId: string,
  capturedBy: string,
  input: EmployeePortalSignatureCaptureInput,
): ServiceResult<EmployeePortalSignatureRecord> {
  if (!input.signerName.trim()) {
    return { ok: false, error: 'Name für Unterschrift erforderlich.' };
  }

  if (!input.signatureDataUrl.trim() && !input.signatureImpossibleReason?.trim()) {
    return { ok: false, error: 'Unterschrift oder Begründung für Unmöglichkeit erforderlich.' };
  }

  const key = signatureKey(tenantId, assignmentId);
  const existing = SIGNATURE_STORE.get(key) ?? [];
  const locked = existing.some((s) => s.locked);
  if (locked) {
    return { ok: false, error: 'Finalisierte Unterschrift kann nicht geändert werden.' };
  }

  const now = new Date();
  signatureCounter += 1;
  const record: EmployeePortalSignatureRecord = {
    id: `ep-sig-${signatureCounter}`,
    tenantId,
    assignmentId,
    clientId,
    signatureType: input.signatureType,
    signerName: input.signerName.trim(),
    signedAt: now.toISOString(),
    signedTimeLocal: now.toLocaleString('de-DE'),
    deviceSessionId: input.deviceSessionId?.trim() || `session-${capturedBy}`,
    contentHash: hashContent(
      `${assignmentId}:${input.signerName}:${input.signatureDataUrl}:${input.relatedDocumentId ?? ''}`,
    ),
    relatedDocumentId: input.relatedDocumentId ?? null,
    capturedBy,
    signatureDataUrl: input.signatureDataUrl,
    locked: false,
  };

  SIGNATURE_STORE.set(key, [...existing, record]);
  return { ok: true, data: record };
}

export function listEmployeePortalSignatures(
  tenantId: string,
  assignmentId: string,
): EmployeePortalSignatureRecord[] {
  return [...(SIGNATURE_STORE.get(signatureKey(tenantId, assignmentId)) ?? [])];
}

export function hasRequiredSignature(
  tenantId: string,
  assignmentId: string,
  requiredTypes: EmployeePortalSignatureType[] = ['assignment'],
): boolean {
  const signatures = listEmployeePortalSignatures(tenantId, assignmentId);
  return requiredTypes.every((type) => signatures.some((s) => s.signatureType === type));
}

export function lockEmployeePortalSignatures(tenantId: string, assignmentId: string): void {
  const key = signatureKey(tenantId, assignmentId);
  const records = SIGNATURE_STORE.get(key) ?? [];
  SIGNATURE_STORE.set(
    key,
    records.map((r) => ({ ...r, locked: true })),
  );
}

export function resetEmployeePortalSignatureStore(): void {
  SIGNATURE_STORE.clear();
  signatureCounter = 0;
}
