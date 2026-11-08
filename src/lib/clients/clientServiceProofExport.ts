import type { ServiceResult } from '@/types';
import type { ClientDocumentRecord } from '@/types/modules/client';
import { resolveClientDocumentCategoryKey } from '@/lib/clients/clientDocumentCategories';
import { PORTAL_PROOFS_CATEGORY } from '@/lib/clients/clientDocumentPortalVisibility';
import { buildDocumentPdfFileName, isDirectPdfDownloadMimeType } from '@/lib/documents/documentPdfFileName';
import { fetchStoredDocumentBytes } from '@/lib/documents/documentPdfService';
import { parseGermanOrIsoDateInput } from '@/lib/formatters/dateTimeFormatters';
import { toTimezoneDateKey } from '@/lib/office/calendarDateUtils';
import { isTenantStoragePath } from '@/lib/storage/storagePaths';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';

export { PORTAL_PROOFS_CATEGORY as CLIENT_SERVICE_PROOF_CATEGORY };

export type ClientServiceProofMetadata = Record<string, { serviceDay: string | null; storagePath: string | null }>;
export type ClientServiceProofRange = { from: string; to: string };

type ProofRow = {
  id: string;
  tenant_id: string;
  scheduled_start: string | null;
  storage_path: string | null;
  assist_visits: { tenant_id: string; client_id: string; planned_start_at: string | null };
};

type ServiceRecordRow = { id: string; tenant_id: string; client_id: string; service_date: string | null };

const SCOPE_ERROR = 'Der Leistungsnachweis gehört nicht zu dieser Klient:innenakte.';
const METADATA_ERROR = 'Leistungsdaten konnten nicht geladen werden. Bitte versuchen Sie es erneut.';

export function isClientServiceProofPdf(doc: ClientDocumentRecord): boolean {
  return resolveClientDocumentCategoryKey(doc) === PORTAL_PROOFS_CATEGORY
    && isDirectPdfDownloadMimeType(doc.mimeType) && doc.status !== 'gesperrt';
}

export function normalizeServiceProofDay(input: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$|^\d{2}\.\d{2}\.\d{4}$/.test(input.trim())) return null;
  const day = parseGermanOrIsoDateInput(input);
  if (!day) return null;
  return [
    String(day.getFullYear()).padStart(4, '0'),
    String(day.getMonth() + 1).padStart(2, '0'),
    String(day.getDate()).padStart(2, '0'),
  ].join('-');
}

function proofDay(value: string | null | undefined): string | null {
  if (!value) return null;
  const day = normalizeServiceProofDay(value);
  if (day) return day;
  return /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value))
    ? toTimezoneDateKey(value) : null;
}

function isScopedProof(doc: ClientDocumentRecord, tenantId: string, clientId: string): boolean {
  return !!tenantId && !!clientId && doc.tenantId === tenantId && doc.clientId === clientId && isClientServiceProofPdf(doc);
}

/** Read the saved proof date and legacy file link through the Office user's session. */
export async function loadClientServiceProofMetadata(
  tenantId: string,
  clientId: string,
  documents: readonly ClientDocumentRecord[],
): Promise<ServiceResult<ClientServiceProofMetadata>> {
  if (documents.some(doc => !isScopedProof(doc, tenantId, clientId))) return { ok: false, error: SCOPE_ERROR };
  if (!documents.length) return { ok: true, data: {} };
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: METADATA_ERROR };
  const metadata: ClientServiceProofMetadata = Object.create(null);

  for (let offset = 0; offset < documents.length; offset += 100) {
    const batch = documents.slice(offset, offset + 100);
    const documentIds = batch.map(doc => doc.id);
    const recordIds = [...new Set(batch.flatMap(doc => doc.serviceRecordId ? [doc.serviceRecordId] : []))];
    const [proofs, serviceRecords] = await Promise.all([
      fromUnknownTable(supabase, 'assist_visit_proofs')
        .select('id,tenant_id,storage_path,scheduled_start:payload_snapshot->>scheduledStart,assist_visits!inner(tenant_id,client_id,planned_start_at)')
        .eq('tenant_id', tenantId)
        .eq('assist_visits.tenant_id', tenantId)
        .eq('assist_visits.client_id', clientId)
        .in('id', documentIds),
      recordIds.length
        ? fromUnknownTable(supabase, 'service_records').select('id,tenant_id,client_id,service_date')
            .eq('tenant_id', tenantId).eq('client_id', clientId).in('id', recordIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (proofs.error || serviceRecords.error) return { ok: false, error: METADATA_ERROR };

    const proofById = new Map<string, ProofRow>();
    for (const row of (proofs.data ?? []) as unknown as ProofRow[]) {
      if (!documentIds.includes(row.id) || row.tenant_id !== tenantId
        || row.assist_visits?.tenant_id !== tenantId || row.assist_visits.client_id !== clientId) {
        return { ok: false, error: SCOPE_ERROR };
      }
      proofById.set(row.id, row);
    }
    const recordById = new Map<string, ServiceRecordRow>();
    for (const row of (serviceRecords.data ?? []) as ServiceRecordRow[]) {
      if (!recordIds.includes(row.id) || row.tenant_id !== tenantId || row.client_id !== clientId) {
        return { ok: false, error: SCOPE_ERROR };
      }
      recordById.set(row.id, row);
    }

    for (const doc of batch) {
      const proof = proofById.get(doc.id);
      const serviceRecord = doc.serviceRecordId ? recordById.get(doc.serviceRecordId) : undefined;
      metadata[doc.id] = {
        serviceDay: proofDay(proof?.scheduled_start) ?? proofDay(serviceRecord?.service_date)
          ?? proofDay(proof?.assist_visits.planned_start_at),
        storagePath: proof && isTenantStoragePath(proof.storage_path, tenantId) ? proof.storage_path : null,
      };
    }
  }
  return { ok: true, data: metadata };
}

export function isServiceProofInRange(
  day: string | null | undefined,
  range: ClientServiceProofRange,
): boolean {
  return Boolean(day && day >= range.from && day <= range.to);
}

function originalFileName(doc: ClientDocumentRecord, clientLastName?: string | null): string {
  const name = doc.fileName.trim().split(/[\\/]/).at(-1);
  return name && /\.pdf$/i.test(name) && !/[\u0000-\u001f:*?"<>|]/.test(name)
    ? name : buildDocumentPdfFileName(doc.title || 'Leistungsnachweis', clientLastName);
}

export type PreparedClientServiceProofPdf = { bytes: Uint8Array; fileName: string };

export async function prepareClientServiceProofPdf(input: {
  tenantId: string;
  clientId: string;
  clientLastName?: string | null;
  documents: readonly ClientDocumentRecord[];
  metadata: ClientServiceProofMetadata;
  range?: ClientServiceProofRange;
  signal?: AbortSignal;
  onProgress?: (complete: number, total: number) => void;
}): Promise<ServiceResult<PreparedClientServiceProofPdf>> {
  const { tenantId, clientId, metadata, signal, clientLastName, range } = input;
  if (!input.documents.length) return { ok: false, error: 'Für diese Auswahl sind keine PDF-Nachweise vorhanden.' };
  if (input.documents.some(doc => !isScopedProof(doc, tenantId, clientId))) return { ok: false, error: SCOPE_ERROR };

  const documents = [...new Map(input.documents.map(doc => [doc.id, doc])).values()].sort((a, b) =>
    (metadata[a.id]?.serviceDay ?? '9999-99-99').localeCompare(metadata[b.id]?.serviceDay ?? '9999-99-99')
      || a.id.localeCompare(b.id));
  const pdf = documents.length > 1 ? await import('pdf-lib') : null;
  const combined = pdf ? await pdf.PDFDocument.create() : null;
  const cancelled = { ok: false as const, error: 'Der PDF-Download wurde abgebrochen.' };
  input.onProgress?.(0, documents.length);

  for (const [index, doc] of documents.entries()) {
    if (signal?.aborted) return cancelled;
    const name = originalFileName(doc, clientLastName);
    const storagePath = doc.storagePath?.trim() || metadata[doc.id]?.storagePath;
    if (!storagePath || !isTenantStoragePath(storagePath, tenantId)) {
      return { ok: false, error: `Für „${name}“ ist keine Original-PDF in dieser Akte hinterlegt.` };
    }
    try {
      const original = await fetchStoredDocumentBytes(storagePath, signal);
      if (signal?.aborted) return cancelled;
      if (!original.ok || !new TextDecoder().decode(original.data.subarray(0, 1024)).includes('%PDF-')) {
        return { ok: false, error: `„${name}“ konnte nicht als Original-PDF geladen werden.` };
      }
      if (!pdf || !combined) return { ok: true, data: { bytes: original.data, fileName: name } };

      const source = await pdf.PDFDocument.load(original.data, { updateMetadata: false });
      if (!source.getPageCount()) return { ok: false, error: `„${name}“ enthält keine PDF-Seiten.` };
      for (const page of await combined.copyPages(source, source.getPageIndices())) combined.addPage(page);
      input.onProgress?.(index + 1, documents.length);
    } catch {
      return signal?.aborted ? cancelled : { ok: false, error: `„${name}“ konnte nicht in die Sammel-PDF übernommen werden.` };
    }
  }

  if (signal?.aborted) return cancelled;
  if (!combined) return { ok: false, error: 'Für diese Auswahl sind keine PDF-Nachweise vorhanden.' };
  combined.setTitle('CareSuite Leistungsnachweise · Sammel-PDF');
  const label = range ? `Leistungsnachweise ${range.from} bis ${range.to}` : 'Leistungsnachweise Sammlung';
  return { ok: true, data: { bytes: await combined.save(), fileName: buildDocumentPdfFileName(label, clientLastName) } };
}
