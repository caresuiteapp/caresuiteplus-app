/**
 * Client portal — released assist visit proofs only (portal_visible).
 * No GPS / tracking data exposed.
 */

import type { ServiceResult } from '@/types';
import type { ClientPortalAssistVisitProof } from '@/types/assistExecutionPersistence';
import { stripPortalBlockedKeysFromSnapshot } from '@/lib/assist/assistProofPdfPayload';
import { ASSIST_EXECUTION_STORAGE_BUCKET } from '@/lib/assist/assistStoragePaths';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isSupabaseMissingTableError, toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { ASSIST_EXECUTION_TABLES } from '@/types/assistExecutionPersistence';

function readString(snapshot: Record<string, unknown>, key: string): string | null {
  const value = snapshot[key];
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

type ProofRow = {
  id: string;
  visit_id: string;
  proof_number: string | null;
  payload_snapshot: Record<string, unknown>;
  pdf_storage_path: string | null;
  released_to_portal_at: string | null;
};

type VisitRow = {
  id: string;
  title: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
};

function mapReleasedProof(proof: ProofRow, visit?: VisitRow | null): ClientPortalAssistVisitProof {
  const snapshot = stripPortalBlockedKeysFromSnapshot(proof.payload_snapshot ?? {});

  return {
    id: proof.id,
    visitId: proof.visit_id,
    proofNumber: proof.proof_number,
    title: readString(snapshot, 'title') ?? visit?.title ?? 'Leistungsnachweis',
    serviceName: readString(snapshot, 'serviceName'),
    clientName: readString(snapshot, 'clientName'),
    employeeName: readString(snapshot, 'employeeName'),
    scheduledStart: readString(snapshot, 'scheduledStart') ?? visit?.scheduled_start ?? null,
    scheduledEnd: readString(snapshot, 'scheduledEnd') ?? visit?.scheduled_end ?? null,
    documentationNote:
      readString(snapshot, 'documentationNote') ?? readString(snapshot, 'documentation'),
    signedAt: readString(snapshot, 'signedAt'),
    signerName: readString(snapshot, 'signerName'),
    releasedAt: proof.released_to_portal_at,
    pdfStoragePath: proof.pdf_storage_path,
  };
}

async function fetchClientVisitIds(
  tenantId: string,
  clientId: string,
): Promise<ServiceResult<string[]>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const { data, error } = await fromUnknownTable(supabase, 'assist_visits')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('client_id', clientId);

  if (error) {
    if (isSupabaseMissingTableError(error)) return { ok: true, data: [] };
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  return { ok: true, data: (data ?? []).map((row) => String((row as { id: string }).id)) };
}

export async function listReleasedProofsForClientPortal(
  tenantId: string,
  clientId: string,
): Promise<ServiceResult<ClientPortalAssistVisitProof[]>> {
  const visitIdsResult = await fetchClientVisitIds(tenantId, clientId);
  if (!visitIdsResult.ok) return visitIdsResult;
  if (visitIdsResult.data.length === 0) return { ok: true, data: [] };

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const { data, error } = await fromUnknownTable(supabase, ASSIST_EXECUTION_TABLES.proofs)
    .select('id, visit_id, proof_number, payload_snapshot, pdf_storage_path, released_to_portal_at')
    .eq('tenant_id', tenantId)
    .eq('portal_visible', true)
    .eq('portal_release_status', 'released')
    .in('visit_id', visitIdsResult.data)
    .order('released_to_portal_at', { ascending: false });

  if (error) {
    if (isSupabaseMissingTableError(error)) {
      return { ok: true, data: [] };
    }
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  const visitMap = new Map<string, VisitRow>();
  const visitLookup = await fromUnknownTable(supabase, 'assist_visits')
    .select('id, title, scheduled_start, scheduled_end')
    .eq('tenant_id', tenantId)
    .in('id', visitIdsResult.data);

  if (!visitLookup.error) {
    for (const row of visitLookup.data ?? []) {
      const visit = row as VisitRow;
      visitMap.set(visit.id, visit);
    }
  }

  return {
    ok: true,
    data: (data ?? []).map((row) =>
      mapReleasedProof(row as ProofRow, visitMap.get(String((row as ProofRow).visit_id))),
    ),
  };
}

export async function getReleasedProofForClientPortal(
  tenantId: string,
  clientId: string,
  proofId: string,
): Promise<ServiceResult<ClientPortalAssistVisitProof | null>> {
  const list = await listReleasedProofsForClientPortal(tenantId, clientId);
  if (!list.ok) return list;
  const match = list.data.find((proof) => proof.id === proofId) ?? null;
  return { ok: true, data: match };
}

export async function getProofPdfForClientPortal(
  tenantId: string,
  clientId: string,
  proofId: string,
): Promise<ServiceResult<string>> {
  const proof = await getReleasedProofForClientPortal(tenantId, clientId, proofId);
  if (!proof.ok) return proof;
  if (!proof.data?.pdfStoragePath) {
    return { ok: false, error: 'PDF ist noch nicht verfügbar.' };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const { data, error } = await supabase.storage
    .from(ASSIST_EXECUTION_STORAGE_BUCKET)
    .createSignedUrl(proof.data.pdfStoragePath, 3600);

  if (error || !data?.signedUrl) {
    return { ok: false, error: error?.message ?? 'Download konnte nicht vorbereitet werden.' };
  }

  return { ok: true, data: data.signedUrl };
}
