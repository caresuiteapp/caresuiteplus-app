/**
 * Assist visit signature persistence — Migration 0156 stub.
 * Signatures: storage_path + hashes in DB, image in Supabase Storage (never base64 in DB).
 *
 * Privacy: capture initiated in employee portal; Assist/Office reads audit trail only.
 */

import type { ServiceResult } from '@/types';
import type {
  AssistVisitSignatureInsert,
  AssistVisitSignatureRow,
} from '@/types/assistExecutionPersistence';
import {
  fetchValidVisitSignature,
  isAssistExecutionPersistenceReady,
} from '@/lib/assist/assistExecutionPersistenceService';

export { fetchValidVisitSignature, isAssistExecutionPersistenceReady };

/** Canonical payload fields hashed before signing (implement after 0156 apply). */
export type VisitSignaturePayloadInput = {
  visitId: string;
  clientId: string;
  employeeId: string | null;
  plannedStartAt: string;
  plannedEndAt: string;
  taskStatuses: Array<{ taskId: string; status: string }>;
  documentationNote: string | null;
};

/**
 * GAP: compute SHA-256 of canonical JSON payload.
 * Replace stub when crypto helper is wired for production persist path.
 */
export function computeVisitSignaturePayloadHashStub(
  _payload: VisitSignaturePayloadInput,
): string {
  return 'pending-0156-apply';
}

/**
 * GAP: upload signature image to Storage, then INSERT assist_visit_signatures.
 * Employee portal only — requires consent + visit execution context.
 */
export async function saveVisitSignaturePersistent(
  _tenantId: string,
  _input: AssistVisitSignatureInsert,
): Promise<ServiceResult<AssistVisitSignatureRow>> {
  return {
    ok: false,
    error:
      'Signatur-Persistenz (0156) vorbereitet — Migration noch nicht remote angewendet.',
  };
}

/**
 * GAP: invalidate signature when visit payload changes after signing.
 */
export async function invalidateVisitSignatureStub(
  _tenantId: string,
  _signatureId: string,
  _reason: string,
): Promise<ServiceResult<void>> {
  return {
    ok: false,
    error: 'Signatur-Invalidierung erfordert angewendete Migration 0156.',
  };
}
