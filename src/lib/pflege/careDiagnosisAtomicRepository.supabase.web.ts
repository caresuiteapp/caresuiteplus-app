import type { ServiceResult } from '@/types';
import type { CareDiagnosis } from '@/types/modules/pflege';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';

export type CareDiagnosisAtomicOriginal = Readonly<{
  tenantId: string;
  clientId: string;
  actorId: string;
  requestId: string;
  icdCode: string;
  icdTitle: string;
  physicianStatement: string;
  diagnosedAt: string | null;
  diagnosedBy: string;
  sourceDocument: string;
  relevanceForCare: string;
  precautions: string;
  actorName: string;
}>;

type Row = Record<string, unknown>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MICROTIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}\.\d{6}(?:Z|[+-]\d{2}:?\d{2})$/;

function plain(value: unknown): value is Row {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}
function capture(original: CareDiagnosisAtomicOriginal): CareDiagnosisAtomicOriginal | null {
  const candidate = { ...original, diagnosedAt: original.diagnosedAt || null };
  if (![candidate.tenantId, candidate.clientId, candidate.actorId, candidate.requestId].every(value => UUID.test(value))
    || !candidate.icdTitle.trim() || !candidate.physicianStatement.trim() || !candidate.diagnosedBy.trim()
    || !candidate.actorName.trim() || (candidate.diagnosedAt !== null && !DATE.test(candidate.diagnosedAt))) return null;
  return Object.freeze(candidate);
}
function mapReceipt(value: unknown, original: CareDiagnosisAtomicOriginal): CareDiagnosis | null {
  if (!plain(value) || value.request_id !== original.requestId || !plain(value.care_diagnosis) || !plain(value.clinical_record)) return null;
  const row = value.care_diagnosis, clinical = value.clinical_record;
  if (!UUID.test(String(row.id ?? '')) || row.tenant_id !== original.tenantId || row.client_id !== original.clientId
    || row.clinical_request_id !== original.requestId || clinical.request_id !== original.requestId
    || clinical.tenant_id !== original.tenantId || clinical.client_id !== original.clientId
    || row.clinical_record_id !== clinical.id || clinical.recorded_by_profile_id !== original.actorId
    || row.icd_code !== (original.icdCode.trim() || null) || row.icd_title !== original.icdTitle.trim()
    || row.physician_statement !== original.physicianStatement.trim() || row.diagnosed_at !== original.diagnosedAt
    || row.diagnosed_by !== original.diagnosedBy.trim() || row.source_document !== original.sourceDocument.trim()
    || row.relevance_for_care !== original.relevanceForCare.trim() || row.precautions !== original.precautions.trim()
    || !MICROTIME.test(String(row.created_at ?? '')) || !MICROTIME.test(String(row.updated_at ?? ''))) return null;
  return {
    id: String(row.id), tenantId: original.tenantId, clientId: original.clientId, clientName: '—',
    carePlanId: row.care_plan_id ? String(row.care_plan_id) : null,
    diagnosisType: String(row.diagnosis_type) as CareDiagnosis['diagnosisType'],
    icdCode: String(row.icd_code ?? ''), icdTitle: String(row.icd_title),
    physicianStatement: String(row.physician_statement), diagnosedAt: row.diagnosed_at ? String(row.diagnosed_at) : null,
    diagnosedBy: String(row.diagnosed_by), sourceDocument: String(row.source_document ?? ''),
    relevanceForCare: String(row.relevance_for_care ?? ''), precautions: String(row.precautions ?? ''),
    status: String(row.status) as CareDiagnosis['status'], validFrom: String(row.valid_from ?? ''),
    validUntil: row.valid_until ? String(row.valid_until) : null, recordedByName: String(row.recorded_by_name),
    createdAt: String(row.created_at), updatedAt: String(row.updated_at),
  };
}
function args(original: CareDiagnosisAtomicOriginal) {
  return { p_tenant_id: original.tenantId, p_client_id: original.clientId, p_actor_profile_id: original.actorId,
    p_request_id: original.requestId, p_payload: { icd_code: original.icdCode.trim() || null,
      icd_title: original.icdTitle.trim(), physician_statement: original.physicianStatement.trim(),
      diagnosed_at: original.diagnosedAt, diagnosed_by: original.diagnosedBy.trim(),
      source_document: original.sourceDocument.trim(), relevance_for_care: original.relevanceForCare.trim(),
      precautions: original.precautions.trim(), recorded_by_name: original.actorName.trim() } };
}

export async function recordCareDiagnosisAtomically(input: CareDiagnosisAtomicOriginal): Promise<ServiceResult<CareDiagnosis>> {
  const original = capture(input), client = getSupabaseClient();
  if (!original) return { ok: false, error: 'Die vollständige ärztliche Angabe und ihre native Anfragebindung fehlen.' };
  if (!client) return { ok: false, error: 'Live-Datenbank ist nicht verfügbar.' };
  const boundClient = client;
  const { data, error } = await client.rpc('web_record_care_diagnosis_with_history', args(original));
  if (getSupabaseClient() !== boundClient) return { ok: false, error: 'Die Sitzung hat während der Speicherung gewechselt.' };
  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  const mapped = mapReceipt(data, original);
  return mapped ? { ok: true, data: mapped } : { ok: false, error: 'Die atomare Diagnosequittung ist unvollständig oder widersprüchlich.' };
}

export async function confirmCareDiagnosisAtomicWrite(input: CareDiagnosisAtomicOriginal): Promise<ServiceResult<CareDiagnosis>> {
  const original = capture(input), client = getSupabaseClient();
  if (!original) return { ok: false, error: 'Die gespeicherte Diagnoseanfrage ist unvollständig.' };
  if (!client) return { ok: false, error: 'Live-Datenbank ist nicht verfügbar.' };
  const boundClient = client;
  const { data, error } = await client.rpc('web_confirm_care_diagnosis_with_history', {
    p_tenant_id: original.tenantId, p_client_id: original.clientId,
    p_actor_profile_id: original.actorId, p_request_id: original.requestId,
  });
  if (getSupabaseClient() !== boundClient) return { ok: false, error: 'Die Sitzung hat während der Aufklärung gewechselt.' };
  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  const mapped = mapReceipt(data, original);
  return mapped ? { ok: true, data: mapped } : { ok: false, error: 'Der native Diagnosebeleg passt nicht zum gespeicherten Original.' };
}

export const careDiagnosisAtomicInternals = Object.freeze({ capture, mapReceipt, args });
