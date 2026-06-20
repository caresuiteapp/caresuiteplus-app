/**
 * Assist visit signature persistence — Migration 0156.
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
  canonicalJsonStringify,
  computeSha256Hex,
} from '@/lib/assist/assistExecutionHashService';
import {
  ASSIST_EXECUTION_STORAGE_BUCKET,
  buildAssistVisitSignatureStoragePath,
} from '@/lib/assist/assistStoragePaths';
import {
  fetchValidVisitSignature,
  isAssistExecutionPersistenceReady,
} from '@/lib/assist/assistExecutionPersistenceService';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isSupabaseMissingTableError, toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { toStorageUploadError } from '@/lib/storage/storagePaths';
import { ASSIST_EXECUTION_TABLES } from '@/types/assistExecutionPersistence';

export { fetchValidVisitSignature, isAssistExecutionPersistenceReady };

/** Canonical payload fields hashed before signing. */
export type VisitSignaturePayloadInput = {
  visitId: string;
  clientId: string;
  employeeId: string | null;
  plannedStartAt: string;
  plannedEndAt: string;
  taskStatuses: Array<{ taskId: string; status: string }>;
  documentationNote: string | null;
};

export async function computeVisitSignaturePayloadHash(
  payload: VisitSignaturePayloadInput,
): Promise<string> {
  return computeSha256Hex(canonicalJsonStringify(payload));
}

function parseDataUrl(dataUrl: string): { bytes: Uint8Array; mimeType: string } | null {
  const match = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl.trim());
  if (!match) return null;
  try {
    const bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
    return { bytes, mimeType: match[1] };
  } catch {
    return null;
  }
}

type SignatureDbRow = {
  id: string;
  tenant_id: string;
  visit_id: string;
  signer_name: string;
  signer_role: string;
  storage_path: string;
  payload_hash: string;
  signature_hash: string;
  signed_at: string;
  signed_by_profile_id: string | null;
  is_valid: boolean;
  invalidated_at: string | null;
  invalidation_reason: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

function mapSignatureRow(row: SignatureDbRow): AssistVisitSignatureRow {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    visitId: row.visit_id,
    signerName: row.signer_name,
    signerRole: row.signer_role,
    storagePath: row.storage_path,
    payloadHash: row.payload_hash,
    signatureHash: row.signature_hash,
    signedAt: row.signed_at,
    signedByProfileId: row.signed_by_profile_id,
    isValid: row.is_valid,
    invalidatedAt: row.invalidated_at,
    invalidationReason: row.invalidation_reason,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type SaveVisitSignatureInput = AssistVisitSignatureInsert & {
  /** PNG data URL from canvas capture — uploaded to Storage, not stored in DB. */
  signatureDataUrl?: string;
};

/** Upload signature image to Storage, then INSERT assist_visit_signatures. Employee portal only. */
export async function saveVisitSignaturePersistent(
  tenantId: string,
  input: SaveVisitSignatureInput,
): Promise<ServiceResult<AssistVisitSignatureRow>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const signatureId = crypto.randomUUID?.() ?? `sig-${Date.now()}`;
  let storagePath = input.storagePath;

  if (input.signatureDataUrl?.trim()) {
    const parsed = parseDataUrl(input.signatureDataUrl);
    if (!parsed) {
      return { ok: false, error: 'Signaturbild ungültig — bitte erneut erfassen.' };
    }
    storagePath = buildAssistVisitSignatureStoragePath(tenantId, input.visitId, signatureId);
    const { error: uploadError } = await supabase.storage
      .from(ASSIST_EXECUTION_STORAGE_BUCKET)
      .upload(storagePath, parsed.bytes, {
        contentType: parsed.mimeType || 'image/png',
        upsert: false,
      });
    if (uploadError) {
      return { ok: false, error: toStorageUploadError(uploadError.message) };
    }
  }

  if (!storagePath?.trim()) {
    return { ok: false, error: 'Signatur-Speicherpfad fehlt.' };
  }

  const { data, error } = await fromUnknownTable(supabase, ASSIST_EXECUTION_TABLES.signatures)
    .insert({
      id: signatureId,
      tenant_id: tenantId,
      visit_id: input.visitId,
      signer_name: input.signerName.trim(),
      signer_role: input.signerRole.trim(),
      storage_path: storagePath,
      payload_hash: input.payloadHash,
      signature_hash: input.signatureHash,
      signed_at: input.signedAt,
      signed_by_profile_id: input.signedByProfileId ?? null,
      is_valid: true,
      metadata: input.metadata ?? {},
    })
    .select('*')
    .single();

  if (error) {
    if (isSupabaseMissingTableError(error)) {
      return { ok: false, error: 'assist_visit_signatures (0156) nicht verfügbar.' };
    }
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  return { ok: true, data: mapSignatureRow(data as SignatureDbRow) };
}

/** Invalidate signature when visit payload changes after signing. */
export async function invalidateVisitSignature(
  tenantId: string,
  signatureId: string,
  reason: string,
): Promise<ServiceResult<void>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const now = new Date().toISOString();
  const { error } = await fromUnknownTable(supabase, ASSIST_EXECUTION_TABLES.signatures)
    .update({
      is_valid: false,
      invalidated_at: now,
      invalidation_reason: reason.trim(),
    })
    .eq('tenant_id', tenantId)
    .eq('id', signatureId);

  if (error) {
    if (isSupabaseMissingTableError(error)) {
      return { ok: false, error: 'assist_visit_signatures (0156) nicht verfügbar.' };
    }
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  return { ok: true, data: undefined };
}

/** Compute signature file hash from data URL (for audit row). */
export async function computeSignatureDataHash(signatureDataUrl: string): Promise<string> {
  return computeSha256Hex(signatureDataUrl.trim());
}
