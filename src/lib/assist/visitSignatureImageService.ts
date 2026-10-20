/**
 * SIGNATURE.1 — Resolve drawn signature images from Storage (assist_visit_signatures).
 * Images live in office-documents bucket; DB stores storage_path only.
 */
import type { ServiceResult } from '@/types';
import type { AssistVisitSignatureRow } from '@/types/assistExecutionPersistence';
import { fetchValidVisitSignature } from '@/lib/assist/assistExecutionPersistenceService';
import { ASSIST_EXECUTION_STORAGE_BUCKET } from '@/lib/assist/assistStoragePaths';
import { getSupabaseClient } from '@/lib/supabase/client';
import type { VisitSignatureCapture } from '@/lib/assist/visitSignatureSessionStore';

const SIGNED_URL_TTL_SECONDS = 3600;

/** Create a short-lived signed URL for a persisted signature PNG. */
export async function resolveVisitSignatureImageUrl(
  storagePath: string | null | undefined,
): Promise<string | null> {
  const path = storagePath?.trim();
  if (!path) return null;

  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase.storage
    .from(ASSIST_EXECUTION_STORAGE_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export type VisitSignatureDisplayData = {
  signature: VisitSignatureCapture | null;
  signatureImageUrl: string | null;
};

/** Load valid signature row + signed image URL for a visit (RLS-respecting client). */
export async function loadVisitSignatureDisplayData(
  tenantId: string,
  visitId: string,
): Promise<ServiceResult<VisitSignatureDisplayData>> {
  const sig = await fetchValidVisitSignature(tenantId, visitId);
  if (!sig.ok) return sig;
  if (!sig.data) {
    return { ok: true, data: { signature: null, signatureImageUrl: null } };
  }

  const signatureImageUrl = await resolveVisitSignatureImageUrl(sig.data.storagePath);
  const signature: VisitSignatureCapture = {
    visitId,
    signerName: sig.data.signerName,
    signerRole: sig.data.signerRole,
    signedAt: sig.data.signedAt,
    dataUrl: signatureImageUrl ?? '',
  };

  return { ok: true, data: { signature, signatureImageUrl } };
}

export function mapSignatureRowToCapture(
  visitId: string,
  row: AssistVisitSignatureRow,
  signatureImageUrl: string | null,
): VisitSignatureCapture {
  return {
    visitId,
    signerName: row.signerName,
    signerRole: row.signerRole,
    signedAt: row.signedAt,
    dataUrl: signatureImageUrl ?? '',
  };
}

/** Prefer explicit image URL, then inline data URL from session capture. */
export function pickSignatureImageUrl(
  signatureImageUrl?: string | null,
  signatureDataUrl?: string | null,
): string | null {
  const explicit = signatureImageUrl?.trim();
  if (explicit) return explicit;
  const inline = signatureDataUrl?.trim();
  if (inline && inline.startsWith('data:')) return inline;
  if (inline && (inline.startsWith('http://') || inline.startsWith('https://'))) return inline;
  return null;
}

export function formatSignatureMetadataLine(input: {
  signerName?: string | null;
  signedAt?: string | null;
  signatureType?: string | null;
}): string | null {
  const name = input.signerName?.trim();
  const at = input.signedAt?.trim();
  const type = input.signatureType?.trim();

  const parts: string[] = [];
  if (name) parts.push(name);
  if (type && type !== name) parts.push(`(${type})`);

  let line = parts.join(' ');
  if (at) {
    const formatted = formatSignedAt(at);
    line = line ? `${line} · ${formatted}` : formatted;
  }

  return line || null;
}

function formatSignedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function resolveSignatureFieldStatus(input: {
  hasSignatureRecord: boolean;
  hasDrawnImage: boolean;
  notRequired?: boolean;
  refusedReason?: string | null;
}): string {
  if (input.notRequired) return 'Nicht erforderlich';
  if (input.refusedReason?.trim()) return 'Nicht möglich (begründet)';
  if (input.hasDrawnImage) return 'Gezeichnete Unterschrift vorhanden';
  if (input.hasSignatureRecord) return 'Metadaten ohne Signaturbild';
  return '—';
}
