/**
 * Assist visit proof persistence — Migration 0156.
 * Proofs: payload snapshot + optional PDF storage_path.
 *
 * Privacy: client portal sees approved proofs only; raw drafts are tenant-internal.
 */

import type { ServiceResult } from '@/types';
import type {
  AssistVisitProofInsert,
  AssistVisitProofPortalReleaseStatus,
  AssistVisitProofRow,
} from '@/types/assistExecutionPersistence';
import {
  canonicalJsonStringify,
  computeSha256Hex,
} from '@/lib/assist/assistExecutionHashService';
import {
  ASSIST_EXECUTION_STORAGE_BUCKET,
  buildAssistVisitProofStoragePath,
} from '@/lib/assist/assistStoragePaths';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isSupabaseMissingTableError, toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { toStorageUploadError } from '@/lib/storage/storagePaths';
import { ASSIST_EXECUTION_TABLES } from '@/types/assistExecutionPersistence';

type ProofDbRow = {
  id: string;
  tenant_id: string;
  visit_id: string;
  signature_id: string | null;
  proof_number: string | null;
  status: AssistVisitProofRow['status'];
  storage_path: string | null;
  payload_snapshot: Record<string, unknown>;
  payload_hash: string | null;
  generated_at: string | null;
  generated_by: string | null;
  approved_at: string | null;
  approved_by: string | null;
  billing_released: boolean;
  portal_visible: boolean;
  released_to_portal_at: string | null;
  portal_release_status: AssistVisitProofPortalReleaseStatus;
  approval_note: string | null;
  rejection_reason: string | null;
  pdf_storage_path: string | null;
  pdf_hash: string | null;
  created_at: string;
  updated_at: string;
};

function mapProofRow(row: ProofDbRow): AssistVisitProofRow {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    visitId: row.visit_id,
    signatureId: row.signature_id,
    proofNumber: row.proof_number,
    status: row.status,
    storagePath: row.storage_path,
    payloadSnapshot: row.payload_snapshot ?? {},
    payloadHash: row.payload_hash,
    generatedAt: row.generated_at,
    generatedBy: row.generated_by,
    approvedAt: row.approved_at,
    approvedBy: row.approved_by,
    billingReleased: row.billing_released,
    portalVisible: row.portal_visible ?? false,
    releasedToPortalAt: row.released_to_portal_at,
    portalReleaseStatus: row.portal_release_status ?? 'none',
    approvalNote: row.approval_note,
    rejectionReason: row.rejection_reason,
    pdfStoragePath: row.pdf_storage_path,
    pdfHash: row.pdf_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Read latest proof for visit — Assist/Office read path. */
export async function fetchLatestVisitProof(
  tenantId: string,
  visitId: string,
): Promise<ServiceResult<AssistVisitProofRow | null>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const { data, error } = await fromUnknownTable(supabase, ASSIST_EXECUTION_TABLES.proofs)
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('visit_id', visitId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isSupabaseMissingTableError(error)) {
      return { ok: true, data: null, tableMissing: true };
    }
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  if (!data) return { ok: true, data: null };
  return { ok: true, data: mapProofRow(data as ProofDbRow) };
}

/** Read latest approved proof for client portal (restricted). */
export async function fetchApprovedVisitProofForClient(
  tenantId: string,
  visitId: string,
): Promise<ServiceResult<AssistVisitProofRow | null>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const { data, error } = await fromUnknownTable(supabase, ASSIST_EXECUTION_TABLES.proofs)
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('visit_id', visitId)
    .in('status', ['approved', 'exported', 'archived'])
    .order('approved_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isSupabaseMissingTableError(error)) {
      return { ok: true, data: null, tableMissing: true };
    }
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  if (!data) return { ok: true, data: null };
  return { ok: true, data: mapProofRow(data as ProofDbRow) };
}

export async function computeVisitProofPayloadHash(snapshot: Record<string, unknown>): Promise<string> {
  return computeSha256Hex(canonicalJsonStringify(snapshot));
}

/** Generate proof from visit snapshot + persist JSON snapshot in Storage. */
export async function persistVisitProof(
  tenantId: string,
  input: AssistVisitProofInsert,
  generatedBy?: string | null,
): Promise<ServiceResult<AssistVisitProofRow>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const proofId = crypto.randomUUID?.() ?? `proof-${Date.now()}`;
  const payloadHash =
    input.payloadHash ?? (await computeVisitProofPayloadHash(input.payloadSnapshot));
  const snapshotJson = JSON.stringify(input.payloadSnapshot);
  let storagePath =
    input.storagePath ??
    buildAssistVisitProofStoragePath(tenantId, input.visitId, proofId, 'json');

  if (!input.storagePath) {
    const { error: uploadError } = await supabase.storage
      .from(ASSIST_EXECUTION_STORAGE_BUCKET)
      .upload(storagePath, snapshotJson, {
        contentType: 'application/json',
        upsert: false,
      });
    if (uploadError) {
      // Payload is also stored in DB — do not block proof row on Storage RLS gaps.
      storagePath = '';
    }
  }

  const now = new Date().toISOString();
  const { data, error } = await fromUnknownTable(supabase, ASSIST_EXECUTION_TABLES.proofs)
    .insert({
      id: proofId,
      tenant_id: tenantId,
      visit_id: input.visitId,
      signature_id: input.signatureId ?? null,
      status: input.status ?? 'draft',
      storage_path: storagePath || null,
      payload_snapshot: input.payloadSnapshot,
      payload_hash: payloadHash,
      generated_at: now,
      generated_by: generatedBy ?? null,
    })
    .select('*')
    .single();

  if (error) {
    if (isSupabaseMissingTableError(error)) {
      return { ok: false, error: 'assist_visit_proofs (0156) nicht verfügbar.' };
    }
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  return { ok: true, data: mapProofRow(data as ProofDbRow) };
}

/** Read proof by id — Assist/Office review path. */
export async function fetchVisitProofById(
  tenantId: string,
  proofId: string,
): Promise<ServiceResult<AssistVisitProofRow | null>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const { data, error } = await fromUnknownTable(supabase, ASSIST_EXECUTION_TABLES.proofs)
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', proofId)
    .maybeSingle();

  if (error) {
    if (isSupabaseMissingTableError(error)) {
      return { ok: true, data: null, tableMissing: true };
    }
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  if (!data) return { ok: true, data: null };
  return { ok: true, data: mapProofRow(data as ProofDbRow) };
}

export type VisitProofListFilter = {
  status?: AssistVisitProofRow['status'] | AssistVisitProofRow['status'][];
  portalReleaseStatus?: AssistVisitProofPortalReleaseStatus;
  limit?: number;
};

/** List visit proofs for Assist/Office review — tenant scoped. */
export async function listVisitProofs(
  tenantId: string,
  filter?: VisitProofListFilter,
): Promise<ServiceResult<AssistVisitProofRow[]>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  let query = fromUnknownTable(supabase, ASSIST_EXECUTION_TABLES.proofs)
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (filter?.status) {
    const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
    query = query.in('status', statuses);
  }
  if (filter?.portalReleaseStatus) {
    query = query.eq('portal_release_status', filter.portalReleaseStatus);
  }
  if (filter?.limit) {
    query = query.limit(filter.limit);
  }

  const { data, error } = await query;

  if (error) {
    if (isSupabaseMissingTableError(error)) {
      return { ok: true, data: [], tableMissing: true };
    }
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  return { ok: true, data: (data ?? []).map((row) => mapProofRow(row as ProofDbRow)) };
}

/** Patch proof row — internal helper for approval/PDF services. */
export async function updateVisitProofRow(
  tenantId: string,
  proofId: string,
  patch: Record<string, unknown>,
): Promise<ServiceResult<AssistVisitProofRow>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const { data, error } = await fromUnknownTable(supabase, ASSIST_EXECUTION_TABLES.proofs)
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('id', proofId)
    .select('*')
    .single();

  if (error) {
    if (isSupabaseMissingTableError(error)) {
      return { ok: false, error: 'assist_visit_proofs (0156) nicht verfügbar.' };
    }
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  return { ok: true, data: mapProofRow(data as ProofDbRow) };
}
