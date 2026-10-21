import type { SupabaseClient } from '@supabase/supabase-js';
import type { ServiceResult } from '@/types';
import type { ClientIntakeFormData } from '@/types/forms/clientIntakeForm';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { isUuid } from '@/lib/validation/uuid';
import { mergeIntakeFormWithDefaults } from '@/lib/clients/clientIntakeDraftStorage';

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
export type ServerIntakeDraft = {
  clientId: string;
  revision: number;
  formHash: string;
  status: 'draft' | 'completed';
  form: ClientIntakeFormData;
  updatedAt: string;
  coreChanged: boolean;
  currentClientUpdatedAt?: string;
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

export async function loadServerClientIntakeDraft(tenantId: string, clientId: string): Promise<ServiceResult<ServerIntakeDraft | null> & { deleted?: boolean }> {
  if (!isUuid(tenantId) || !isUuid(clientId)) return { ok: false, error: 'Die Aufnahme-ID ist ungültig.' };
  const db = getSupabaseClient();
  if (!db) return { ok: false, error: unavailable };
  try {
    const { data, error } = await (db as SupabaseClient).rpc('client_intake_load_draft', { p_tenant: tenantId, p_client: clientId });
    if (error) return { ok: false, error: toGermanSupabaseError(error), deleted: error.code === 'P0002' };
    if (data === null) return { ok: true, data: null };
    if (!record(data) || data.contract !== 'client-intake-draft-v1' || data.clientId !== clientId ||
        !validRevision(data.revision) || !validHash(data.formHash) || !['draft', 'completed'].includes(String(data.status)) ||
        !record(data.form) || typeof data.updatedAt !== 'string') {
      return { ok: false, error: 'Der gespeicherte Entwurf konnte nicht eindeutig geladen werden. Ihre Angaben werden nicht überschrieben.' };
    }
    return { ok: true, data: { clientId, revision: data.revision, formHash: data.formHash,
      status: data.status as ServerIntakeDraft['status'], form: mergeIntakeFormWithDefaults(data.form), updatedAt: data.updatedAt,
      coreChanged: data.coreChanged === true, currentClientUpdatedAt: typeof data.currentClientUpdatedAt === 'string' ? data.currentClientUpdatedAt : undefined } };
  } catch {
    return { ok: false, error: unavailable };
  }
}

export async function deleteClientIntakeDraft(tenantId: string, clientId: string, expectedRevision: number): Promise<ServiceResult<void>> {
  if (!isUuid(tenantId) || !isUuid(clientId) || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0) return { ok: false, error: 'Die Entwurfsfassung ist ungültig.' };
  const db = getSupabaseClient();
  if (!db) return { ok: false, error: 'Die Löschung ist nicht bestätigt. Bitte erneut versuchen.' };
  try {
    const { data, error } = await (db as SupabaseClient).rpc('client_intake_delete_draft', { p_tenant: tenantId, p_client: clientId, p_expected_revision: expectedRevision });
    if (error) return { ok: false, error: error.code === '40001' ? 'Der Entwurf wurde inzwischen geändert. Bitte neu laden und die Löschung erneut prüfen.' : toGermanSupabaseError(error) };
    if (!record(data) || data.contract !== 'client-intake-delete-v1' || data.clientId !== clientId || data.deleted !== true) return { ok: false, error: 'Die Löschung konnte nicht bestätigt werden. Bitte erneut versuchen.' };
    return { ok: true, data: undefined };
  } catch { return { ok: false, error: 'Die Löschung konnte nicht bestätigt werden. Bitte erneut versuchen.' }; }
}

export type IntakeFirstAppointment = { id: string; startAt: string; endAt: string; location: string; status: string };

export async function getIntakeFirstAppointment(tenantId: string, clientId: string): Promise<ServiceResult<IntakeFirstAppointment | null>> {
  const db = getSupabaseClient();
  if (!db || !isUuid(tenantId) || !isUuid(clientId)) return { ok: false, error: 'Der Kalendertermin konnte nicht geladen werden.' };
  try {
    const { data, error } = await (db as SupabaseClient).rpc('client_intake_first_appointment', { p_tenant: tenantId, p_client: clientId });
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    if (data === null) return { ok: true, data: null };
    if (!record(data) || (typeof data.id !== 'string' || !isUuid(data.id)) || typeof data.startAt !== 'string' || typeof data.endAt !== 'string' || typeof data.location !== 'string' || typeof data.status !== 'string') return { ok: false, error: 'Der Kalendertermin konnte nicht eindeutig geladen werden.' };
    return { ok: true, data: data as IntakeFirstAppointment };
  } catch { return { ok: false, error: 'Der Kalendertermin konnte nicht geladen werden. Bitte erneut versuchen.' }; }
}

export async function scheduleIntakeFirstAppointment(tenantId: string, clientId: string, expectedRevision: number): Promise<ServiceResult<IntakeFirstAppointment>> {
  const db = getSupabaseClient();
  if (!db || !isUuid(tenantId) || !isUuid(clientId) || !validRevision(expectedRevision)) return { ok: false, error: 'Der Erstkontakt muss zuerst im Unternehmen gespeichert werden.' };
  try {
    const { data, error } = await (db as SupabaseClient).rpc('client_intake_schedule_first_appointment', { p_tenant: tenantId, p_client: clientId, p_expected_revision: expectedRevision });
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    if (!record(data) || (typeof data.id !== 'string' || !isUuid(data.id)) || typeof data.startAt !== 'string' || typeof data.endAt !== 'string' || typeof data.location !== 'string' || typeof data.status !== 'string') return { ok: false, error: 'Der Kalendertermin konnte nicht bestätigt werden. Bitte erneut speichern.' };
    return { ok: true, data: data as IntakeFirstAppointment };
  } catch { return { ok: false, error: 'Der Kalendertermin konnte nicht bestätigt werden. Bitte erneut speichern.' }; }
}

/** Explicitly adopt authoritative record fields; never accepts caller-supplied core data. */
export async function reconcileServerClientIntakeDraft(
  tenantId: string,
  options: { clientId: string; expectedRevision: number; expectedClientUpdatedAt: string; operationId: string },
): Promise<IntakeDraftSaveResult> {
  const { clientId, expectedRevision, expectedClientUpdatedAt, operationId } = options;
  const failure = (error: string, conflict = false, rejected = false): IntakeDraftSaveResult => ({ ok: false, error, recoverableClientId: clientId, conflict, rejected });
  if (!isUuid(tenantId) || !isUuid(clientId) || !isUuid(operationId) || !validRevision(expectedRevision) ||
      !expectedClientUpdatedAt || !Number.isFinite(Date.parse(expectedClientUpdatedAt))) {
    return failure('Die aktuelle Aktenfassung konnte nicht eindeutig bestimmt werden. Bitte erneut laden.');
  }
  const db = getSupabaseClient();
  if (!db) return failure(unavailable);
  try {
    const { data, error } = await (db as SupabaseClient).rpc('client_intake_reconcile_draft', {
      p_tenant: tenantId, p_client: clientId, p_expected_revision: expectedRevision,
      p_expected_client_updated_at: expectedClientUpdatedAt, p_operation_id: operationId,
    });
    if (error) return failure(error.code === '40001'
      ? 'Die Akte wurde während der Übernahme erneut geändert. Prüfen Sie die aktuelle Fassung und versuchen Sie die Übernahme erneut.'
      : toGermanSupabaseError(error), error.code === '40001', ['22023', '23502', '23503', '23505', '23514', '42501', '40001', 'P0001'].includes(error.code ?? ''));
    if (!record(data) || data.contract !== 'client-intake-draft-v1' || data.clientId !== clientId ||
        data.operationId !== operationId || data.revision !== expectedRevision + 1 || !validRevision(data.revision) ||
        !validHash(data.formHash) || data.status !== 'draft' || typeof data.replayed !== 'boolean') {
      return failure('Die Übernahme wurde nicht eindeutig bestätigt. Bitte denselben Vorgang erneut versuchen.');
    }
    return { ok: true, data: { ...data, id: clientId } as IntakeDraftReceipt };
  } catch {
    return failure('Die Übernahme konnte nicht bestätigt werden. Bitte denselben Vorgang erneut versuchen.');
  }
}
