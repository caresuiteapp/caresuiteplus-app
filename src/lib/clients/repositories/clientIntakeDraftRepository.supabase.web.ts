import type { ServiceResult } from '@/types';
import type { Database } from '@/lib/supabase/database.types';
import type { ClientIntakeFormData } from '@/types/forms/clientIntakeForm';
import { normalizeIntakeCareLevelForDb } from '@/lib/clients/clientIntakeCareLevel';
import { resolvePrimaryCostBearerName } from '@/lib/clients/clientIntakeCostBearerConfig';
import { resolveIntakeBillingProfileType } from '@/lib/clients/clientIntakeBilling';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { isUuid } from '@/lib/validation/uuid';
import type { IntakeReservationReview } from '@/lib/clients/clientIntakeWorkflow.web';

type DraftOptions = {
  clientId?: string | null;
  /** A locally durable UUID reserved for this first insert, never an upsert. */
  newClientId?: string | null;
  actorProfileId?: string | null;
  /** Persist the dispatch journal and recheck current authority before writing. */
  beforeWrite?: () => Promise<boolean>;
  /** The server preparation is obtained by beforeWrite, never from local storage. */
  identityReview?: () => IntakeReservationReview | null;
};
type ClientInsert = Database['public']['Tables']['clients']['Insert'];
type NativeRow = Record<string, unknown>;
type IntakeRpcClient = {
  rpc(name: string, args: Record<string, unknown>): Promise<{ data: unknown; error: unknown }>;
};
type DraftWriteResult = ServiceResult<{ id: string }>
  | { ok: false; error: string; identityReviewRejected: true };

const CONFLICT_MESSAGE =
  'Eine Person mit übereinstimmenden Identitätsmerkmalen ist bereits vorhanden. Bitte prüfen Sie die bestehende Akte. Der Entwurf wurde nicht als weitere Person gespeichert.';
const STALE_DRAFT_MESSAGE =
  'Dieser Entwurf ist nicht mehr als offene Aufnahme verfügbar. Bitte prüfen Sie die bestehende Akte. Es wurde keine weitere Person angelegt.';
const UNCONFIRMED_MESSAGE =
  'Das Speichern des Entwurfs konnte nicht vollständig bestätigt werden. Bitte prüfen Sie die Akte, bevor Sie eine neue Aufnahme beginnen.';

function nativeRow(value: unknown): value is NativeRow {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number(value.slice(0, 4)) === 0) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}
function validTimestamp(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:?\d{2})$/.test(value)
    && validCalendarDate(value.slice(0, 10)) && Number.isFinite(Date.parse(value));
}

function buildDraftPatch(
  tenantId: string,
  form: ClientIntakeFormData,
  actorProfileId: string,
): ClientInsert {
  const primaryCostBearerName = resolvePrimaryCostBearerName(form);
  resolveIntakeBillingProfileType(form.billingTypes);
  return {
    tenant_id: tenantId,
    first_name: form.firstName.trim() || 'Entwurf',
    last_name: form.lastName.trim() || '—',
    date_of_birth: form.dateOfBirth.trim() || null,
    care_level: normalizeIntakeCareLevelForDb(form.careLevel),
    status: 'lead',
    street: form.street.trim() || null,
    house_number: form.houseNumber.trim() || null,
    postal_code: form.zip.trim() || null,
    city: form.city.trim() || null,
    phone: form.phone.trim() || null,
    mobile: form.mobile.trim() || null,
    email: form.email.trim() || null,
    internal_notes: form.specialNotes.trim() || null,
    insurance_number: form.insuranceNumber.trim() || null,
    insurance_name: primaryCostBearerName,
    cost_bearer: primaryCostBearerName,
    admission_date: form.admissionDate || null,
    gender: form.gender || null,
    updated_by: actorProfileId,
  };
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

/** Web draft writes never turn a missing/finished draft into a new person. */
export async function upsertClientIntakeDraft(
  tenantId: string,
  form: ClientIntakeFormData,
  options?: DraftOptions,
): Promise<DraftWriteResult> {
  try {
    return await persistClientIntakeDraft(tenantId, form, options);
  } catch {
    // A thrown transport error does not prove that a dispatched write failed.
    return { ok: false, error: UNCONFIRMED_MESSAGE };
  }
}

async function persistClientIntakeDraft(
  tenantId: string,
  form: ClientIntakeFormData,
  options?: DraftOptions,
): Promise<DraftWriteResult> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
  if (!isUuid(tenantId) || !isUuid(options?.actorProfileId)) {
    return { ok: false, error: 'Zum Speichern des Entwurfs sind ein bestätigter Mandant und ein eigenes Profil erforderlich.' };
  }
  const clientId = options?.clientId ?? null;
  const newClientId = options?.newClientId ?? null;
  if ((clientId !== null && !isUuid(clientId))
    || (newClientId !== null && (!isUuid(newClientId) || clientId !== null))) {
    return { ok: false, error: 'Die gespeicherte Aktenkennung ist ungültig. Bitte prüfen Sie den Entwurf; es wurde keine weitere Person angelegt.' };
  }
  const firstName = form.firstName.trim();
  const lastName = form.lastName.trim();
  const birthDate = form.dateOfBirth.trim();
  if (birthDate && !validCalendarDate(birthDate)) {
    return { ok: false, error: 'Bitte geben Sie ein gültiges Geburtsdatum im Format JJJJ-MM-TT an.' };
  }
  if (clientId === null && (!firstName || !lastName || !validCalendarDate(birthDate))) {
    return { ok: false, error: 'Für die erste Serversicherung sind Vorname, Nachname und ein gültiges Geburtsdatum erforderlich. Unvollständige Angaben bleiben lokal als Entwurf erhalten.' };
  }
  // Capture all scalar writes before the first await. Later input changes may
  // not alter the identity or payload of this already running request.
  const actorProfileId = options.actorProfileId;
  const patch = buildDraftPatch(tenantId, form, actorProfileId);
  const beforeWrite = options.beforeWrite;
  const identityReview = options.identityReview;
  const payload = clientId !== null ? patch : {
    ...patch, created_by: actorProfileId, ...(newClientId ? { id: newClientId } : {}),
  };
  let expectedUpdatedAt: string | null = null;

  if (clientId !== null) {
    const { data, error } = await supabase.from('clients')
      .select('id,tenant_id,status,updated_at')
      .eq('tenant_id', tenantId).eq('id', clientId).maybeSingle();
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    if (!nativeRow(data) || data.id !== clientId || data.tenant_id !== tenantId || data.status !== 'lead') {
      return { ok: false, error: STALE_DRAFT_MESSAGE };
    }
    if (typeof data.updated_at !== 'string'
      || !/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:?\d{2})$/.test(data.updated_at)
      || !Number.isFinite(Date.parse(data.updated_at))) {
      return { ok: false, error: 'Der aktuelle Änderungsstand des Entwurfs konnte nicht bestätigt werden. Bitte laden Sie die Aufnahme erneut.' };
    }
    expectedUpdatedAt = data.updated_at;
  }

  // These are existence checks, not a complete candidate search or an identity
  // decision. Similar names never choose, link or merge an existing person.
  const queries = [];
  if (firstName && lastName && birthDate) {
    queries.push(supabase.from('clients').select('id,tenant_id')
      .eq('tenant_id', tenantId)
      .ilike('first_name', escapeLike(firstName))
      .ilike('last_name', escapeLike(lastName))
      .eq('date_of_birth', birthDate));
  }
  if (typeof patch.insurance_number === 'string') {
    queries.push(supabase.from('clients').select('id,tenant_id')
      .eq('tenant_id', tenantId).ilike('insurance_number', escapeLike(patch.insurance_number)));
  }
  for (let query of queries) {
    if (clientId !== null) query = query.neq('id', clientId);
    const { data, error } = await query.limit(1);
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    if (!Array.isArray(data) || data.length > 1 || data.some((row: unknown) =>
      !nativeRow(row) || !isUuid(typeof row.id === 'string' ? row.id : null)
      || row.tenant_id !== tenantId || row.id === clientId)) {
      return { ok: false, error: 'Die Identitätsprüfung konnte nicht vollständig bestätigt werden. Der Entwurf wurde nicht geschrieben.' };
    }
    if (data.length > 0) return { ok: false, error: CONFLICT_MESSAGE };
  }

  if (beforeWrite && !await beforeWrite()) {
    return { ok: false, error: 'Die aktuelle Aufnahmeberechtigung ist nicht mehr bestätigt. Der Entwurf wurde nicht geschrieben.' };
  }
  if (getSupabaseClient() !== supabase) {
    return { ok: false, error: 'Die Verbindung hat sich geändert. Bitte laden Sie die Aufnahme erneut.' };
  }
  const rpcPayload: Record<string, unknown> = { ...payload };
  for (const fixed of ['id', 'tenant_id', 'status', 'created_by', 'updated_by']) delete rpcPayload[fixed];
  const review = clientId === null ? identityReview?.() : null;
  if (clientId === null && (!review || !isUuid(review.id) || review.requestId !== newClientId
    || review.tenantId !== tenantId || review.actorId !== actorProfileId
    || review.inputKey !== JSON.stringify([firstName, lastName, birthDate, patch.insurance_number ?? ''])
    || !Number.isSafeInteger(review.candidateCount) || review.candidateCount < 0
    || !Number.isFinite(Date.parse(review.expiresAt)) || Date.parse(review.expiresAt) <= Date.now())) {
    return { ok: false, identityReviewRejected: true,
      error: 'Die aktuelle Personenentscheidung konnte nicht auf dem Server bestätigt werden. Bitte prüfen Sie vorhandene Personen erneut.' };
  }
  const result = clientId !== null
    ? await supabase.from('clients').update(payload)
      .eq('tenant_id', tenantId).eq('id', clientId).eq('status', 'lead')
      // Preserve the exact native microsecond timestamp in the write guard.
      .eq('updated_at', expectedUpdatedAt!).select('*').maybeSingle()
    : newClientId !== null
      ? await (supabase as unknown as IntakeRpcClient).rpc('web_reserve_reviewed_client_intake_draft', {
          p_tenant_id: tenantId,
          // The locally durable request id and proposed client id are the same
          // UUID. A lost response can therefore only resolve this exact intake.
          p_request_id: newClientId,
          p_proposed_client_id: newClientId,
          p_actor_profile_id: actorProfileId,
          p_review_id: review!.id,
          p_payload: rpcPayload,
        })
      : { data: null, error: { message: 'Für die erste Serversicherung fehlt die dauerhaft reservierte Anfragekennung.' } };
  if (result.error) {
    // Only an actual SQL rejection with an empty data response establishes a
    // rolled-back first transaction. Missing/throwing/transport replies stay unknown.
    if (clientId === null && result.data === null && getSupabaseClient() === supabase
      && nativeRow(result.error) && ['P0I01','P0I02','22023','42501'].includes(String(result.error.code))) {
      return { ok: false, identityReviewRejected: true,
        error: 'Die Personenentscheidung wurde vom Server abgelehnt. Ihre Eingaben bleiben erhalten. Bitte prüfen Sie vorhandene Personen erneut.' };
    }
    return { ok: false, error: UNCONFIRMED_MESSAGE };
  }
  const rpcReceipt = clientId === null ? result.data : null;
  const persisted: unknown = clientId === null && nativeRow(rpcReceipt) ? rpcReceipt.row : result.data;
  if (!nativeRow(persisted) || !isUuid(typeof persisted.id === 'string' ? persisted.id : null)
    || ((clientId ?? newClientId) !== null && persisted.id !== (clientId ?? newClientId))
    || (clientId === null && (!nativeRow(rpcReceipt)
      || rpcReceipt.id !== newClientId || typeof rpcReceipt.created !== 'boolean'
      || rpcReceipt.identity_review_id !== review!.id || rpcReceipt.request_id !== newClientId
      || !validTimestamp(rpcReceipt.updated_at) || rpcReceipt.updated_at !== persisted.updated_at))
    || Object.entries(payload).some(([key, value]) => persisted[key] !== value)) {
    return { ok: false, error: UNCONFIRMED_MESSAGE };
  }
  return { ok: true, data: { id: persisted.id as string } };
}

/** Confirm a draft or revoke its exact unconsumed review; no patient mutation. */
export async function confirmClientIntakeDraft(
  tenantId: string,
  clientId: string,
  form: ClientIntakeFormData,
  actorProfileId: string,
  options?: { requireDecisionReceipt?: boolean; identityReviewId?: string | null },
): Promise<ServiceResult<{ id: string; reviewRevoked?: boolean }>> {
  try {
    if (![tenantId, clientId, actorProfileId].every(isUuid)) return { ok: false, error: UNCONFIRMED_MESSAGE };
    const supabase = getSupabaseClient();
    if (!supabase) return { ok: false, error: UNCONFIRMED_MESSAGE };
    const patch = buildDraftPatch(tenantId, form, actorProfileId);
    if (options?.requireDecisionReceipt) {
      if (!isUuid(options.identityReviewId)) return { ok: false, error: UNCONFIRMED_MESSAGE };
      const rpcPayload: Record<string, unknown> = { ...patch };
      for (const key of ['tenant_id', 'status', 'updated_by']) delete rpcPayload[key];
      const result = await (supabase as unknown as IntakeRpcClient).rpc('web_confirm_reviewed_client_intake_draft', {
        p_tenant_id: tenantId, p_request_id: clientId, p_actor_profile_id: actorProfileId,
        p_review_id: options.identityReviewId, p_payload: rpcPayload,
      });
      const receipt = result.data;
      if (!result.error && getSupabaseClient() === supabase && nativeRow(receipt)
        && receipt.disposition === 'review_revoked' && receipt.created === false
        && receipt.id === clientId && receipt.request_id === clientId && receipt.identity_review_id === options.identityReviewId
        && receipt.tenant_id === tenantId && receipt.actor_profile_id === actorProfileId
        && validTimestamp(receipt.revoked_at) && !Object.hasOwn(receipt, 'row')) {
        return { ok: true, data: { id: clientId, reviewRevoked: true } };
      }
      const row: unknown = nativeRow(receipt) ? receipt.row : null;
      if (result.error || getSupabaseClient() !== supabase || !nativeRow(receipt) || !nativeRow(row)
        || receipt.id !== clientId || receipt.request_id !== clientId || receipt.created !== false
        || receipt.identity_review_id !== options.identityReviewId || receipt.updated_at !== row.updated_at
        || !validTimestamp(receipt.updated_at) || row.id !== clientId || row.created_by !== actorProfileId
        || Object.entries(patch).some(([key, value]) => row[key] !== value)) return { ok: false, error: UNCONFIRMED_MESSAGE };
      return { ok: true, data: { id: clientId } };
    }
    const { data, error } = await supabase.from('clients').select('*')
      .eq('tenant_id', tenantId).eq('id', clientId).maybeSingle();
    if (error || getSupabaseClient() !== supabase || !nativeRow(data) || data.id !== clientId
      || Object.entries(patch).some(([key, value]) => Object.getOwnPropertyDescriptor(data, key)?.value !== value)) {
      return { ok: false, error: UNCONFIRMED_MESSAGE };
    }
    return { ok: true, data: { id: clientId } };
  } catch {
    return { ok: false, error: UNCONFIRMED_MESSAGE };
  }
}
