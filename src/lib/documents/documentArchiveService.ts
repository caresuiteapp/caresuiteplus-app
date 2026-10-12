import type { GeneratedDocumentRecord } from '@/types/documents/documentEngine';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { resolveAuthenticatedProfileId } from '@/lib/auth/resolveAuthenticatedProfile';
import { isTenantStoragePath } from '@/lib/storage/storagePaths';

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

  if (!input.document.pdfPath || input.document.tenantId !== input.tenantId
    || input.document.clientId !== input.clientId || !isTenantStoragePath(input.document.pdfPath, input.tenantId)) {
    return { ok: false, error: 'Das bestätigte PDF oder die eindeutige Aktenzuordnung fehlt.' };
  }
  const docId = input.document.id;
  const storagePath = input.document.pdfPath;
  const fileName = input.document.fileName ?? `${input.document.title}.pdf`;
  const category = input.category ?? mapStorageAreaToCategory(input.storageArea);
  const readExisting = () => fromUnknownTable(supabase, 'client_documents')
    .select('id,client_id,storage_path,file_name,mime_type').eq('tenant_id', input.tenantId).eq('id', docId).maybeSingle();
  const matches = (row: Record<string, unknown>) => row.client_id === input.clientId && row.storage_path === storagePath
    && row.file_name === fileName && row.mime_type === 'application/pdf';
  const existing = await readExisting();
  if (existing.error) return { ok: false, error: 'Die bisherige Ablage konnte nicht geprüft werden. Bitte erneut versuchen.' };
  if (existing.data) return matches(existing.data as Record<string, unknown>)
    ? { ok: true, clientDocumentId: docId } : { ok: false, error: 'Für dieses Dokument besteht bereits eine andere Ablage. Das Original bleibt erhalten.' };
  const actor = await resolveAuthenticatedProfileId(input.tenantId);
  if (!actor.ok) return { ok: false, error: actor.error };
  const inserted = await fromUnknownTable(supabase, 'client_documents').insert({
    id: docId, tenant_id: input.tenantId, client_id: input.clientId, title: input.document.title,
    file_name: fileName, category, storage_path: storagePath, mime_type: 'application/pdf',
    status: 'aktiv', sensitivity: 'care', source: 'upload', portal_visible: false, uploaded_by: actor.data,
  }).select('id').single();
  if (inserted.error || !inserted.data) {
    if (inserted.error?.code === '23505') {
      const replay = await readExisting();
      if (!replay.error && replay.data && matches(replay.data as Record<string, unknown>)) return { ok: true, clientDocumentId: docId };
    }
    return { ok: false, error: 'Das Dokument konnte nicht in der Akte gespeichert werden. Bitte erneut versuchen.' };
  }
  return { ok: true, clientDocumentId: docId };
}

export async function archiveGeneratedDocumentToEmployeeRecord(input: {
  tenantId: string;
  document: GeneratedDocumentRecord;
  employeeId: string;
  storageArea: string;
}): Promise<{ ok: boolean; employeeDocumentId?: string; error?: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Supabase nicht verfügbar.' };
  if (input.document.tenantId !== input.tenantId || input.document.employeeId !== input.employeeId
    || !isTenantStoragePath(input.document.pdfPath, input.tenantId)) {
    return { ok: false, error: 'Das bestätigte PDF oder die eindeutige Personalaktenzuordnung fehlt.' };
  }
  const docId = input.document.id;
  const fileName = input.document.fileName ?? `${input.document.title}.pdf`;
  const load = () => fromUnknownTable(supabase, 'employee_documents')
    .select('id,employee_id,storage_path,file_name').eq('tenant_id', input.tenantId).eq('id', docId).maybeSingle();
  const matches = (row: Record<string, unknown>) => row.employee_id === input.employeeId
    && row.storage_path === input.document.pdfPath && row.file_name === fileName;
  const existing = await load();
  if (existing.error) return { ok: false, error: 'Die bisherige Personalaktenablage konnte nicht geprüft werden.' };
  if (existing.data) return matches(existing.data as Record<string, unknown>)
    ? { ok: true, employeeDocumentId: docId } : { ok: false, error: 'Für dieses Dokument besteht bereits eine andere Personalaktenablage. Das Original bleibt erhalten.' };
  const actor = await resolveAuthenticatedProfileId(input.tenantId);
  if (!actor.ok) return { ok: false, error: actor.error };
  const inserted = await fromUnknownTable(supabase, 'employee_documents').insert({
    id: docId, tenant_id: input.tenantId, employee_id: input.employeeId, title: input.document.title,
    file_name: fileName, storage_path: input.document.pdfPath,
    category: input.storageArea === 'vertraege' ? 'contract' : input.storageArea === 'akademie' ? 'qualification' : 'other',
    sensitive: true, released_to_portal: false,
  }).select('id').single();
  if (inserted.error || !inserted.data) {
    if (inserted.error?.code === '23505') {
      const replay = await load();
      if (!replay.error && replay.data && matches(replay.data as Record<string, unknown>)) return { ok: true, employeeDocumentId: docId };
    }
    return { ok: false, error: 'Das Dokument konnte nicht in der Personalakte gespeichert werden. Bitte erneut versuchen.' };
  }
  return { ok: true, employeeDocumentId: docId };
}

function mapStorageAreaToCategory(area: string): string {
  const map: Record<string, string> = {
    stammdaten: 'sonstige',
    vertraege: 'vertrag',
    pflegeakte: 'pflegeplan',
    nachweise: 'leistungsnachweis',
    einsaetze: 'sonstige',
    rechnungen: 'rechnung',
    beratungsakte: 'beratungsprotokoll',
    personal: 'sonstige',
    akademie: 'sonstige',
    notfall: 'sonstige',
    qm: 'sonstige',
    archiv: 'sonstige',
  };
  return map[area] ?? 'sonstige';
}

export { STORAGE_BUCKET };
