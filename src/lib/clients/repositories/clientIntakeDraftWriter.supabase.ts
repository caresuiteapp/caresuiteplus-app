import type { SupabaseClient } from '@supabase/supabase-js';
import type { ServiceResult } from '@/types';
import type { ClientIntakeFormData } from '@/types/forms/clientIntakeForm';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { isUuid } from '@/lib/validation/uuid';

export type IntakeDraftReceipt = {
  id: string;
  contract: 'client-intake-draft-v1';
  clientId: string;
  revision: number;
  formHash: string;
  operationId: string;
  status: 'draft';
  replayed: boolean;
};
export type IntakeDraftSaveResult = ServiceResult<IntakeDraftReceipt> & {
  recoverableClientId?: string;
  conflict?: boolean;
  /** A SQL rejection proves this operation did not commit. Transport failures do not. */
  rejected?: boolean;
};
const unavailable = 'Die Serversicherung ist derzeit nicht erreichbar. Der Entwurf bleibt auf diesem Gerät erhalten.';
const validRevision = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) > 0;
const validHash = (value: unknown): value is string => typeof value === 'string' && /^sha256:[a-f0-9]{64}$/i.test(value);
const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));

/** The server owns actor identity, authorization and all draft writes. */
export async function upsertClientIntakeDraft(
  tenantId: string,
  form: ClientIntakeFormData,
  options: { clientId: string; expectedRevision: number; operationId: string; actorProfileId?: string | null },
): Promise<IntakeDraftSaveResult> {
  const { clientId, expectedRevision, operationId } = options;
  const failure = (error: string, conflict = false, rejected = false): IntakeDraftSaveResult => ({ ok: false, error, recoverableClientId: clientId, conflict, rejected });
  if (!isUuid(tenantId) || !isUuid(clientId) || !isUuid(operationId) || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
    return failure('Die Identität oder Version des Entwurfs ist ungültig. Bitte die Aufnahme erneut öffnen.');
  }
  const db = getSupabaseClient();
  if (!db) return failure(unavailable);
  try {
    const { data, error } = await (db as SupabaseClient).rpc('client_intake_save_draft', {
      p_tenant: tenantId, p_client: clientId, p_form: form,
      p_expected_revision: expectedRevision, p_operation_id: operationId,
    });
    if (error) return failure(error.code === '40001'
      ? 'Diese Aufnahme wurde inzwischen auf einem anderen Gerät geändert. Laden Sie den aktuellen Serverstand, bevor Sie weiter speichern.'
      : toGermanSupabaseError(error), error.code === '40001', ['22023', '23502', '23503', '23505', '23514', '42501', '40001', 'P0001'].includes(error.code ?? ''));
    if (!record(data) || data.contract !== 'client-intake-draft-v1' || data.clientId !== clientId ||
        data.operationId !== operationId || !validRevision(data.revision) || data.revision !== expectedRevision + 1 ||
        !validHash(data.formHash) || data.status !== 'draft' || typeof data.replayed !== 'boolean') {
      return failure('Die Serversicherung konnte nicht eindeutig bestätigt werden. Bitte denselben Entwurf erneut sichern.');
    }
    return { ok: true, data: { ...data, id: clientId } as IntakeDraftReceipt };
  } catch {
    return failure(unavailable);
  }
}

