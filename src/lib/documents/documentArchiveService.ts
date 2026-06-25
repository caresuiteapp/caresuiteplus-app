import type { GeneratedDocumentRecord } from '@/types/documents/documentEngine';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { buildClientDocumentStoragePath } from '@/lib/clients/clientDocumentsService';

const STORAGE_BUCKET = 'office-documents';

export async function archiveGeneratedDocumentToClientRecord(input: {
  tenantId: string;
  document: GeneratedDocumentRecord;
  clientId: string;
  storageArea: string;
  category?: string;
}): Promise<{ ok: boolean; clientDocumentId?: string; error?: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Supabase nicht verfügbar.' };

  const docId = crypto.randomUUID?.() ?? `cd-${Date.now()}`;
  const category = input.category ?? mapStorageAreaToCategory(input.storageArea);
  const title = input.document.title;
  const storagePath =
    input.document.pdfPath ??
    buildClientDocumentStoragePath(input.tenantId, input.clientId, docId, input.document.fileName ?? `${title}.pdf`);

  const { data, error } = await fromUnknownTable(supabase, 'client_documents').insert({
    id: docId,
    tenant_id: input.tenantId,
    client_id: input.clientId,
    title,
    category,
    storage_path: storagePath,
    mime_type: 'application/pdf',
    metadata_json: {
      generatedDocumentId: input.document.id,
      storageArea: input.storageArea,
      source: 'document_engine',
    },
  }).select('id').single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, clientDocumentId: String((data as { id: string }).id) };
}

function mapStorageAreaToCategory(area: string): string {
  const map: Record<string, string> = {
    stammdaten: 'stammdaten',
    vertraege: 'vertraege',
    pflegeakte: 'pflege',
    nachweise: 'leistungsnachweise',
    einsaetze: 'einsaetze',
    rechnungen: 'abrechnung',
    beratungsakte: 'beratung',
    personal: 'personal',
    akademie: 'akademie',
    notfall: 'notfall',
    qm: 'qm',
    archiv: 'archiv',
  };
  return map[area] ?? 'sonstiges';
}

export { STORAGE_BUCKET };
