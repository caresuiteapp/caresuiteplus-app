/**
 * Assist execution persistence — shared helpers for Migration 0156 tables.
 * Stubs only: tables not applied remotely yet; returns tableMissing when absent.
 *
 * Privacy: persistence writes for GPS/tracking originate from employee portal services.
 * Assist/Office services should use read paths only until portal wiring is approved.
 */

import type { ServiceResult } from '@/types';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isSupabaseMissingTableError, toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import {
  ASSIST_EXECUTION_TABLES,
  type AssistVisitSignatureRow,
} from '@/types/assistExecutionPersistence';

function unavailable<T>(): ServiceResult<T> {
  return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
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

/** Returns whether Migration 0156 signature table exists (probe, no throw). */
export async function isAssistExecutionPersistenceReady(
  tenantId: string,
): Promise<{ ready: boolean; tableMissing: boolean }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ready: false, tableMissing: false };

  const { error } = await fromUnknownTable(supabase, ASSIST_EXECUTION_TABLES.signatures)
    .select('id')
    .eq('tenant_id', tenantId)
    .limit(1);

  if (error && isSupabaseMissingTableError(error)) {
    return { ready: false, tableMissing: true };
  }
  return { ready: !error, tableMissing: false };
}

/** Read valid signature for visit — Office/Assist read-only path. */
export async function fetchValidVisitSignature(
  tenantId: string,
  visitId: string,
): Promise<ServiceResult<AssistVisitSignatureRow | null>> {
  const supabase = getSupabaseClient();
  if (!supabase) return unavailable();

  const { data, error } = await fromUnknownTable(supabase, ASSIST_EXECUTION_TABLES.signatures)
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('visit_id', visitId)
    .eq('is_valid', true)
    .order('signed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isSupabaseMissingTableError(error)) {
      return { ok: true, data: null, tableMissing: true };
    }
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  if (!data) return { ok: true, data: null };
  return { ok: true, data: mapSignatureRow(data as SignatureDbRow) };
}

/**
 * GAP (Phase 3): persist signature after Storage upload + hash computation.
 * Wire from employee portal / visit close flow after 0156 apply + Storage policies.
 */
export async function persistVisitSignatureStub(): Promise<ServiceResult<never>> {
  return {
    ok: false,
    error:
      'assist_visit_signatures (0156) noch nicht angewendet — Signatur-Persistenz folgt nach Migration-Apply.',
  };
}
