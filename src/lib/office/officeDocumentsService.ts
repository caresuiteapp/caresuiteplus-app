import { blobBytes } from '@/lib/platform/blobBytes';
import type { Profile, RoleKey, ServiceResult } from '@/types';
import type { PermissionKey } from '@/types/permissions';
import type { PortalDocumentListItem } from '@/types/portal/documents';
import type { ClientDocumentRecord } from '@/types/modules/client';
import { CLIENT_DOCUMENT_CATEGORY_LABELS } from '@/types/modules/client/clientDocuments';
import { demoPortalDocuments } from '@/data/demo/documents';
import { mergeClientRecordDocuments, mapIntakeDocumentRow } from '@/lib/clients/clientDocumentMerge';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { mapClientDocument } from '@/lib/supabase/mappers/clientExtendedMapper';
import { enforceWithActor } from '@/lib/permissions/actorPermissions';
import { getServiceMode } from '@/lib/services/mode';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { buildStorageObjectFileName, buildTenantStoragePath, isTenantStoragePath, toStorageUploadError } from '@/lib/storage/storagePaths';
import { mapClientDocumentToPortalListItem } from './officeDocumentDisplay';

export type OfficeDocumentItem = { id: string; title: string; category: string; status: string };
export type OfficeDocumentUploadInput = { filename: string; mimeType: string; sizeBytes: number; category?: string; contentBase64?: string; clientId?: string; title?: string; uploadedBy?: string | null; requestId?: string };
export type OfficeDocumentFile = PortalDocumentListItem & { storagePath: string | null; signaturePending: boolean; signatureRequired: boolean; createdAt: string };
type Row = Record<string, unknown>;
function isRow(value: unknown): value is Row {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
const BUCKET = 'office-documents';
const SELECT = 'id,tenant_id,client_id,title,file_name,mime_type,category,storage_path,status,sensitivity,uploaded_by,valid_until,created_at,updated_at,portal_visible,size_bytes,source,intake_document_id,signature_required,signed_at';
const INTAKE = 'id,tenant_id,client_id,template_key,document_type,title,status,finalized_html,preview_html,finalized_at,created_at,updated_at,rendered_pdf_path';
export const OFFICE_UPLOAD_MAX_BYTES = 20 * 1024 * 1024;

async function guard<T>(tenantId: string, role?: RoleKey | null, profile?: Profile | null, permission: PermissionKey = 'office.documents.view'): Promise<ServiceResult<T> | null> {
  return guardServiceTenant(tenantId) ?? await enforceWithActor<T>(role, tenantId, profile, permission);
}
function stored(row: Row): ClientDocumentRecord {
  return { ...mapClientDocument(row as Parameters<typeof mapClientDocument>[0]), documentSource: row.source === 'intake' ? 'intake' : 'upload', intakeDocumentId: row.intake_document_id ? String(row.intake_document_id) : null };
}
export function mapOfficeDocumentFile(doc: ClientDocumentRecord, row?: Row, clientName?: string | null): OfficeDocumentFile {
  const pending = (row?.signature_required === true || /\.pending$/i.test(doc.fileName)) && !row?.signed_at;
  const item = mapClientDocumentToPortalListItem(doc, { fileSizeBytes: Number(row?.size_bytes ?? 0), visibility: row?.portal_visible === true ? 'shared' : 'team', clientName });
  return { ...item, previewHtml: item.status === 'gesperrt' ? null : item.previewHtml, documentSource: row?.source ? String(row.source) : doc.documentSource, displayFileName: /\.pending$/i.test(doc.fileName) ? null : item.displayFileName, status: item.status === 'gesperrt' ? 'gesperrt' : pending ? 'in_bearbeitung' : item.status, sizeLabel: pending ? 'Unterschrift ausstehend' : item.sizeLabel, storagePath: doc.storagePath, signaturePending: pending, signatureRequired: row?.signature_required === true, createdAt: doc.createdAt };
}
async function rows(table: string, tenantId: string, select: string, signal?: AbortSignal): Promise<ServiceResult<Row[]>> {
  const client = getSupabaseClient(); if (!client) return { ok: false, error: 'Die Dokumentablage ist gerade nicht erreichbar.' };
  const result: Row[] = [];
  for (let offset = 0; offset <= 10000; offset += 250) {
    if (signal?.aborted) return { ok: false, error: 'Abfrage abgebrochen.' };
    const page = await fromUnknownTable(client, table).select(select).eq('tenant_id', tenantId).order('updated_at', { ascending: false }).order('id', { ascending: false }).range(offset, offset === 10000 ? offset : offset + 249).abortSignal(signal ?? new AbortController().signal);
    if (page.error) return { ok: false, error: toGermanSupabaseError(page.error) };
    const data: unknown = page.data ?? [];
    if (!Array.isArray(data) || !data.every(isRow)) return { ok: false, error: 'Die Dokumentablage hat eine ungültige Antwort geliefert. Bitte erneut laden.' };
    if (offset === 10000 && data.length > 0) return { ok: false, error: 'Die Ablage enthält mehr als 10.000 Einträge. Öffnen Sie die Unterlagen bitte direkt in der jeweiligen Akte.' };
    result.push(...data); if (data.length < 250) break;
  }
  return { ok: true, data: result };
}
async function names(tenantId: string, ids: string[], signal?: AbortSignal): Promise<Map<string, string>> {
  const client = getSupabaseClient(); const result = new Map<string, string>(); if (!client) return result;
  const unique = [...new Set(ids.filter(Boolean))];
  for (let offset = 0; offset < unique.length; offset += 100) {
    if (signal?.aborted) break;
    const { data } = await fromUnknownTable(client, 'clients').select('id,first_name,last_name').eq('tenant_id', tenantId).in('id', unique.slice(offset, offset + 100));
    for (const row of data ?? []) result.set(String(row.id), [row.first_name, row.last_name].filter(Boolean).join(' '));
  }
  return result;
}
export async function fetchOfficeDocumentList(tenantId: string, actorRoleKey?: RoleKey | null, profile?: Profile | null, options?: { signal?: AbortSignal }): Promise<ServiceResult<PortalDocumentListItem[]>> {
  const denied = await guard<PortalDocumentListItem[]>(tenantId, actorRoleKey, profile); if (denied) return denied;
  if (getServiceMode() !== 'supabase') return { ok: true, data: demoPortalDocuments.filter(doc => doc.audienceScope === 'office') };
  try {
    const [documents, intake] = await Promise.all([rows('client_documents', tenantId, SELECT, options?.signal), rows('client_intake_documents', tenantId, INTAKE, options?.signal)]);
    if (!documents.ok) return documents; if (!intake.ok) return intake;
    const byId = new Map(documents.data.map(row => [String(row.id), row]));
    const merged = mergeClientRecordDocuments(documents.data.map(stored), intake.data as Parameters<typeof mergeClientRecordDocuments>[1]);
    const clients = await names(tenantId, merged.map(doc => doc.clientId), options?.signal);
    return { ok: true, data: merged.map(doc => mapOfficeDocumentFile(doc, byId.get(doc.id), clients.get(doc.clientId))) };
  } catch { return { ok: false, error: 'Die Dokumente konnten nicht geladen werden. Bitte erneut versuchen.' }; }
}
export async function fetchOfficeDocumentDetail(tenantId: string, id: string, actorRoleKey?: RoleKey | null, profile?: Profile | null): Promise<ServiceResult<OfficeDocumentFile>> {
  const denied = await guard<OfficeDocumentFile>(tenantId, actorRoleKey, profile); if (denied) return denied;
  const client = getSupabaseClient(); if (!client) return { ok: false, error: 'Die Dokumentablage ist gerade nicht erreichbar.' };
  try {
    const record = await fromUnknownTable(client, 'client_documents').select(SELECT).eq('tenant_id', tenantId).eq('id', id).maybeSingle();
    if (record.error) return { ok: false, error: toGermanSupabaseError(record.error) };
    let doc: ClientDocumentRecord; let row: Row | undefined;
    if (record.data) {
      row = record.data;
      const source = stored(row);
      const intake = await fromUnknownTable(client, 'client_intake_documents').select(INTAKE).eq('tenant_id', tenantId).eq('client_id', source.clientId);
      if (intake.error && (source.intakeDocumentId || source.documentSource === 'intake')) return { ok: false, error: 'Der Dokumentinhalt konnte nicht geladen werden.' };
      doc = mergeClientRecordDocuments([source], (intake.data ?? []) as Parameters<typeof mergeClientRecordDocuments>[1]).find(item => item.id === id) ?? source;
    } else {
      const intake = await fromUnknownTable(client, 'client_intake_documents').select(INTAKE).eq('tenant_id', tenantId).eq('id', id).maybeSingle();
      if (intake.error || !intake.data) return { ok: false, error: 'Das Dokument wurde nicht gefunden oder ist für Sie nicht freigegeben.' };
      doc = mapIntakeDocumentRow(intake.data as unknown as Parameters<typeof mapIntakeDocumentRow>[0]);
    }
    const clients = await names(tenantId, [doc.clientId]);
    return { ok: true, data: mapOfficeDocumentFile(doc, row, clients.get(doc.clientId)) };
  } catch { return { ok: false, error: 'Das Dokument konnte nicht geladen werden.' }; }
}
export async function fetchOfficeDocumentBlob(tenantId: string, id: string, role?: RoleKey | null, profile?: Profile | null): Promise<ServiceResult<{ blob: Blob; filename: string }>> {
  const result = await fetchOfficeDocumentDetail(tenantId, id, role, profile); if (!result.ok) return result;
  const doc = result.data;
  if (doc.status === 'gesperrt' || !isTenantStoragePath(doc.storagePath, tenantId) || /\.pending$/i.test(doc.fileName)) return { ok: false, error: doc.signaturePending ? 'Die Datei wird nach Abschluss der Unterschrift erstellt.' : 'Zu diesem Dokument ist noch keine Datei hinterlegt.' };
  const client = getSupabaseClient(); if (!client) return { ok: false, error: 'Die Dokumentablage ist gerade nicht erreichbar.' };
  try {
    const file = await client.storage.from(BUCKET).download(doc.storagePath!);
    if (file.error || !file.data) return { ok: false, error: 'Die Datei konnte nicht geladen werden. Bitte erneut versuchen.' };
    return { ok: true, data: { blob: file.data, filename: doc.fileName } };
  } catch { return { ok: false, error: 'Die Datei konnte nicht geladen werden.' }; }
}
export async function fetchOfficeDocumentsDashboard(tenantId: string, role?: RoleKey | null): Promise<ServiceResult<{ total: number; byCategory: Record<string, number>; items: OfficeDocumentItem[] }>> {
  const list = await fetchOfficeDocumentList(tenantId, role); if (!list.ok) return list;
  const byCategory: Record<string, number> = {}; list.data.forEach(doc => { byCategory[doc.category] = (byCategory[doc.category] ?? 0) + 1; });
  return { ok: true, data: { total: list.data.length, byCategory, items: list.data } };
}
export function buildOfficeDocumentStoragePath(tenantId: string, documentId: string, fileName: string): string {
  return buildTenantStoragePath(tenantId, 'office', 'documents', documentId, buildStorageObjectFileName(documentId, fileName));
}
export async function loadOfficeUploadClients(tenantId: string, role?: RoleKey | null, profile?: Profile | null): Promise<ServiceResult<{ id: string; name: string }[]>> {
  const denied = await guard<{ id: string; name: string }[]>(tenantId, role, profile, 'office.clients.edit'); if (denied) return denied;
  const result = await rows('clients', tenantId, 'id,first_name,last_name,updated_at'); if (!result.ok) return result;
  return { ok: true, data: result.data.map(row => ({ id: String(row.id), name: [row.first_name, row.last_name].filter(Boolean).join(' ') || 'Klientenakte' })).sort((a,b) => a.name.localeCompare(b.name, 'de')) };
}
export async function uploadOfficeDocument(tenantId: string, input: OfficeDocumentUploadInput, role?: RoleKey | null, profile?: Profile | null): Promise<ServiceResult<{ id: string; storagePath: string }>> {
  const denied = await guard<{ id: string; storagePath: string }>(tenantId, role, profile, 'office.clients.edit'); if (denied) return denied;
  const viewDenied = await guard<{ id: string; storagePath: string }>(tenantId, role, profile); if (viewDenied) return viewDenied;
  if (!input.clientId || !input.title?.trim() || !input.filename.trim() || !Object.prototype.hasOwnProperty.call(CLIENT_DOCUMENT_CATEGORY_LABELS, input.category ?? '')) return { ok: false, error: 'Bitte Datei, Dokumenttitel, Kategorie und Klientenakte auswählen.' };
  if (!input.contentBase64 || input.sizeBytes <= 0 || input.sizeBytes > OFFICE_UPLOAD_MAX_BYTES) return { ok: false, error: 'Bitte eine Datei mit höchstens 20 MB auswählen.' };
  const client = getSupabaseClient(); if (!client || getServiceMode() !== 'supabase') return { ok: false, error: 'Zum Hochladen ist eine aktive Datenverbindung erforderlich.' };
  try {
    const owner = await fromUnknownTable(client, 'clients').select('id').eq('tenant_id', tenantId).eq('id', input.clientId).maybeSingle();
    if (owner.error || !owner.data) return { ok: false, error: 'Die gewählte Klientenakte ist nicht verfügbar.' };
    const id = input.requestId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.requestId) ? input.requestId : globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : (await import('expo-crypto')).randomUUID();
    const existing = await fromUnknownTable(client, 'client_documents').select('id,storage_path,client_id').eq('tenant_id', tenantId).eq('id', id).maybeSingle();
    if (existing.error) return { ok: false, error: 'Der Uploadstatus konnte nicht geprüft werden.' };
    const storagePath = buildTenantStoragePath(tenantId, 'clients', input.clientId, 'documents', id, buildStorageObjectFileName(id, input.filename));
    if (existing.data) return existing.data.client_id === input.clientId && existing.data.storage_path === storagePath ? { ok: true, data: { id, storagePath } } : { ok: false, error: 'Die Zuordnung des Dokuments ist nicht eindeutig.' };
    const payload = Uint8Array.from(atob(input.contentBase64), c => c.charCodeAt(0));
    if (payload.byteLength !== input.sizeBytes) return { ok: false, error: 'Die Datei wurde nicht vollständig gelesen. Bitte erneut auswählen.' };
    const uploaded = await client.storage.from(BUCKET).upload(storagePath, payload, { contentType: input.mimeType, upsert: false });
    if (uploaded.error) {
      // A previous uncertain attempt may already own this exact immutable object.
      // Compare its content before continuing; never overwrite an existing object.
      const previous = await client.storage.from(BUCKET).download(storagePath);
      if (previous.error || !previous.data) return { ok: false, error: toStorageUploadError(uploaded.error.message) };
      const bytes = await blobBytes(previous.data);
      if (bytes.length !== payload.length || bytes.some((value, index) => value !== payload[index])) return { ok: false, error: 'Zu diesem Upload liegt eine andere Datei vor. Bitte die Datei neu auswählen.' };
    }
    const saved = await fromUnknownTable(client, 'client_documents').insert({ id, tenant_id: tenantId, client_id: input.clientId, title: input.title.trim(), file_name: input.filename, mime_type: input.mimeType, category: input.category, storage_path: storagePath, status: 'aktiv', sensitivity: 'care', source: 'upload', size_bytes: payload.byteLength, uploaded_by: profile?.id ?? input.uploadedBy ?? null, portal_visible: false }).select('id').single();
    if (saved.error || !saved.data) {
      const recovered = await fromUnknownTable(client, 'client_documents').select('id,storage_path,client_id').eq('tenant_id', tenantId).eq('id', id).maybeSingle();
      if (recovered.data?.storage_path === storagePath && recovered.data.client_id === input.clientId) return { ok: true, data: { id, storagePath } };
      // Remove only this attempt's file after a confirmed missing row; uncertain writes stay recoverable.
      if (!uploaded.error && !recovered.error && !recovered.data) await client.storage.from(BUCKET).remove([storagePath]);
      return { ok: false, error: 'Das Dokument konnte noch nicht in der Akte bestätigt werden. Bitte erneut versuchen.' };
    }
    return { ok: true, data: { id, storagePath } };
  } catch { return { ok: false, error: 'Der Upload konnte nicht abgeschlossen werden. Bitte erneut versuchen.' }; }
}
