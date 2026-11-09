import { getSupabaseClient } from '@/lib/supabase/client';
import { isUuid } from '@/lib/validation/uuid';
import { EMPLOYEE_PORTAL_ALLOWED_IMAGE_MIME_TYPES, EMPLOYEE_PORTAL_ALLOWED_VIDEO_MIME_TYPES, inferEmployeePortalMimeType } from '@/lib/portal/employeePortalMediaValidation';
import { documentationRequest } from './service';
import type { DocumentationActor, DocumentationEntry, DocumentationFile, DocumentationUpload } from './model';

export const DOCUMENTATION_FILE_LIMIT = 50 * 1024 * 1024;
export const DOCUMENTATION_BUCKET = 'office-documentation';
const employeeMimeTypes = new Set([...EMPLOYEE_PORTAL_ALLOWED_IMAGE_MIME_TYPES, ...EMPLOYEE_PORTAL_ALLOWED_VIDEO_MIME_TYPES, 'application/pdf']);
export const EMPLOYEE_DOCUMENTATION_FILE_ACCEPT = [...employeeMimeTypes].join(',');
export function employeeDocumentationFileMime(file: Pick<DocumentationUpload['file'], 'name' | 'type'>) {
  const mime = inferEmployeePortalMimeType({ fileName: file.name, reportedMimeType: file.type });
  return employeeMimeTypes.has(mime) ? mime : null;
}
type Target = Pick<DocumentationEntry, 'id' | 'source'> & { visit_id?: string | null };
export const fileSize = (n: number) => n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toLocaleString('de-DE', { maximumFractionDigits: 1 })} MB`;
export function fileKind(mime: string) {
  if (EMPLOYEE_PORTAL_ALLOWED_IMAGE_MIME_TYPES.has(mime) || mime === 'image/bmp') return 'image';
  if (EMPLOYEE_PORTAL_ALLOWED_VIDEO_MIME_TYPES.has(mime) || mime === 'video/ogg') return 'video';
  if (/^audio\//.test(mime)) return 'audio';
  return mime === 'application/pdf' ? 'pdf' : 'file';
}
async function action(actor: DocumentationActor, entry: Target, op: string, payload = {}) {
  if (!isUuid(entry.id) || !['manual', 'visit'].includes(entry.source)) throw new Error('Ungültiger Eintrag');
  return documentationRequest(actor, 'office_documentation_attachments', { p_entry_id: entry.id, p_source: entry.source, p_action: op, p_payload: payload });
}
export async function listDocumentationFiles(actor: DocumentationActor, entry: Target) {
  const r = await action(actor, entry, 'list');
  if (!Array.isArray(r.items) || typeof r.canUpload !== 'boolean' || r.items.some((f: DocumentationFile) => {
    const originalVisit = f.storage_bucket === 'office-documents';
    const prefix = originalVisit ? `tenant/${actor.tenantId}/assist/visits/${entry.visit_id}/attachments/` : `${actor.tenantId}/${entry.source}/${entry.id}/`;
    return !isUuid(f.id) || (originalVisit && (entry.source !== 'visit' || !isUuid(entry.visit_id))) || (!originalVisit && f.storage_bucket !== undefined && f.storage_bucket !== DOCUMENTATION_BUCKET) || !f.storage_path?.startsWith(prefix) || typeof f.file_name !== 'string' || typeof f.mime_type !== 'string' || !Number.isSafeInteger(f.size_bytes) || f.size_bytes < 1;
  })) throw new Error('Ungültige Dateiliste');
  return { items: r.items as DocumentationFile[], canUpload: r.canUpload };
}
export async function uploadDocumentationFile(actor: DocumentationActor, entry: Target, upload: DocumentationUpload) {
  const { file } = upload;
  if (!isUuid(upload.id) || file.size < 1 || file.size > DOCUMENTATION_FILE_LIMIT || file.name.length > 240 || /[\x00-\x1f/\\]/.test(file.name)) throw new Error('Bitte eine Datei bis 50 MB mit gültigem Dateinamen auswählen.');
  const mime = actor.mediaOnly ? employeeDocumentationFileMime(file) : file.type.split(';')[0].toLowerCase().trim() || 'application/octet-stream';
  if (!mime) throw new Error('Bitte ein Foto, ein Video oder eine PDF-Datei auswählen.');
  const p = await action(actor, entry, 'prepare', { id: upload.id, name: file.name, mime, size: file.size });
  const expected = `${actor.tenantId}/${entry.source}/${entry.id}/${upload.id}`;
  if (p.id !== upload.id || p.storage_path !== expected || !['pending', 'ready'].includes(String(p.state))) throw new Error('Die Dateizuordnung konnte nicht bestätigt werden.');
  if (p.state === 'ready') return;
  const client = getSupabaseClient();
  if (!client) throw new Error('Dateiupload nicht verfügbar.');
  const bytes = await file.arrayBuffer();
  if (bytes.byteLength !== file.size) throw new Error('Die Datei wurde nicht vollständig gelesen. Bitte erneut auswählen.');
  const r = await client.storage.from(DOCUMENTATION_BUCKET).upload(expected, bytes, { upsert: false, contentType: mime, cacheControl: '0' });
  // A retry may find the original after a lost Storage response. Completion checks its actual owner, size and MIME.
  if (r.error && !['409', 'Duplicate'].includes(String((r.error as unknown as { statusCode?: string }).statusCode)) && !/already exists|duplicate/i.test(r.error.message)) throw new Error('Die Datei konnte nicht hochgeladen werden. Bitte erneut versuchen.');
  const complete = await action(actor, entry, 'complete', { id: upload.id });
  if (complete.id !== upload.id || complete.state !== 'ready') throw new Error('Die Datei wurde noch nicht bestätigt. Bitte erneut versuchen.');
}
export async function discardDocumentationFile(actor: DocumentationActor, entry: Target, upload: DocumentationUpload) {
  const r = await action(actor, entry, 'discard', { id: upload.id });
  if (r.storage_path) await getSupabaseClient()?.storage.from(DOCUMENTATION_BUCKET).remove([String(r.storage_path)]);
}
export async function documentationFileUrl(actor: DocumentationActor, file: DocumentationFile, download = false) {
  const client = getSupabaseClient();
  const bucket = file.storage_bucket ?? DOCUMENTATION_BUCKET;
  if (!client || !['office-documentation','office-documents'].includes(bucket) || !file.storage_path.startsWith(bucket === 'office-documents' ? `tenant/${actor.tenantId}/assist/visits/` : `${actor.tenantId}/`)) throw new Error('Datei nicht verfügbar.');
  const user = await client.auth.getUser();
  if (user.error || user.data.user?.id !== actor.userId) throw new Error('Bitte erneut anmelden.');
  const r = await client.storage.from(bucket).createSignedUrl(file.storage_path, 600, download ? { download: file.file_name } : undefined);
  if (r.error || !r.data?.signedUrl) throw new Error('Die Datei konnte nicht geöffnet werden. Bitte erneut laden.');
  return r.data.signedUrl;
}
