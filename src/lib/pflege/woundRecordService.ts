import * as Crypto from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { withServiceQueryTimeout } from '@/lib/services/queryTimeout';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import type { RoleKey, ServiceResult } from '@/types';
import { woundUuid } from './woundCareDomain';
import { loadCompleteMedicationHistory, medicationHistoryFilter } from './medicationHistoryPagination';
import { isDefiniteMedicationRejection } from './medicationRequestState';
import type { MedicationWriteResult } from './medicationAdministrationService';
import { object, type RecordPayload, type WoundCatalogItem, type WoundEntry,
  type WoundEntryKind, type WoundMedia, type WoundMediaKind } from './woundRecordDomain';

export type WoundRecordScope = {
  tenantId: string; actorId: string; role: RoleKey | null; clientId: string; woundId: string;
};
export type WoundRecordUserScope = Pick<WoundRecordScope, 'tenantId' | 'actorId' | 'role'>;
export type WoundRecordWrite = { kind: WoundEntryKind; observedAt: string; payload: RecordPayload };
export type WoundRecordData = {
  entries: WoundEntry[];
  media: WoundMedia[];
  consents: { id: string; granted_at: string; expires_at: string | null }[];
  person: { date_of_birth: string | null; gender: string | null };
};
export type WoundFile = { id: string; name: string; mime: string; bytes: ArrayBuffer; digest: string };
export const WOUND_MEDIA_LIMIT = 25 * 1024 * 1024;
const BUCKET = 'pflege-wound-media';

function assertScope(scope: Pick<WoundRecordScope, 'tenantId' | 'actorId' | 'role'>, manage: boolean) {
  const issue = enforcePermission(scope.role, 'pflege.wounds.view')
    ?? (manage ? enforcePermission(scope.role, 'pflege.wounds.manage') : null)
    ?? guardServiceTenant(scope.tenantId);
  if (issue) throw Error(!issue.ok ? issue.error : 'Zugriff nicht bestätigt.');
  if (!woundUuid(scope.actorId) || !woundUuid(scope.tenantId)) throw Error('Sitzung neu laden.');
  const db = getSupabaseClient();
  if (!db) throw Error('Die Wunddatenbank ist gerade nicht verbunden.');
  return db;
}

function assertCase(scope: WoundRecordScope, manage: boolean) {
  if (!woundUuid(scope.clientId) || !woundUuid(scope.woundId)) throw Error('Die Wundzuordnung fehlt.');
  return assertScope(scope, manage);
}

type Row = Record<string, unknown>;
type Rpc = { rpc(name: string, args: Row): Promise<{ data: unknown; error: { code?: string; message: string } | null; status?: number }> };
type Db = ReturnType<typeof assertScope>;
const rpc = (db: Db, name: string, args: Row) => withServiceQueryTimeout(
  (db as unknown as Rpc).rpc(name, args), 'Wunddokumentation', 18000,
);
const errorText = (e: unknown) => e instanceof Error ? e.message : 'Die Wundakte konnte nicht geladen werden.';
const scopeArgs = (scope: WoundRecordScope) => ({
  p_tenant: scope.tenantId, p_actor: scope.actorId, p_client: scope.clientId, p_wound: scope.woundId,
});

export async function readWoundRecord(scope: WoundRecordScope): Promise<ServiceResult<WoundRecordData>> {
  try {
    const db = assertCase(scope, false);
    const page = async (table: string, columns: string, readyOnly = false) =>
      loadCompleteMedicationHistory<Row>(async cursor => {
        let query = fromUnknownTable(db, table).select(columns)
          .eq('tenant_id', scope.tenantId).eq('client_id', scope.clientId)
          .or('wound_case_id.is.null,wound_case_id.eq.' + scope.woundId)
          .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(250);
        if (readyOnly) query = query.eq('state', 'ready');
        if (cursor) query = query.or(medicationHistoryFilter(cursor));
        const result = await withServiceQueryTimeout(Promise.resolve(query), 'Wundakte laden', 18000);
        if (result.error) throw Error(toGermanSupabaseError(result.error));
        return result.data;
      }, scope.tenantId, row => row.client_id === scope.clientId && (row.wound_case_id === null || row.wound_case_id === scope.woundId));
    const [entries, media, receipt] = await Promise.all([
      page('ambulatory_wound_clinical_entries', '*'),
      page('ambulatory_wound_media',
        'id,tenant_id,client_id,wound_case_id,assessment_id,kind,file_name,mime_type,size_bytes,observed_at,created_at', true),
      rpc(db, 'read_wound_record_context', scopeArgs(scope)),
    ]);
    if (receipt.error) throw Error(toGermanSupabaseError(receipt.error));
    const context = object(receipt.data);
    if (!context || !object(context.person) || !Array.isArray(context.consents)) throw Error('Die Wundakte konnte nicht zugeordnet werden.');
    return { ok: true, data: { entries, media, person: context.person, consents: context.consents } as unknown as WoundRecordData };
  } catch (e) { return { ok: false, error: errorText(e) }; }
}

export async function writeWoundRecord(scope: WoundRecordScope, id: string, entry: WoundRecordWrite): Promise<MedicationWriteResult> {
  let db: Db;
  try { db = assertCase(scope, true); } catch (e) { return { ok: false, error: errorText(e) }; }
  try {
    const response = await rpc(db, 'write_wound_record_entry', { ...scopeArgs(scope), p_id: id,
      p_kind: entry.kind, p_observed: entry.observedAt, p_payload: entry.payload });
    if (response.error) return { ok: false, error: toGermanSupabaseError(response.error),
      uncertain: !isDefiniteMedicationRejection(response.error.code, response.status) };
    if (response.data !== id) return { ok: false, error: 'Speicherbestätigung fehlt.', uncertain: true };
    return { ok: true, data: { id } };
  } catch { return { ok: false, error: 'Speicherbestätigung fehlt. Dieselbe Erfassung erneut prüfen.', uncertain: true }; }
}

export async function readWoundCatalog(scope: Pick<WoundRecordScope, 'tenantId' | 'actorId' | 'role'>): Promise<ServiceResult<WoundCatalogItem[]>> {
  try {
    const db = assertScope(scope, false);
    const items = await loadCompleteMedicationHistory<Row>(async cursor => {
      let query = fromUnknownTable(db, 'ambulatory_wound_catalog').select('*').eq('tenant_id', scope.tenantId)
        .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(250);
      if (cursor) query = query.or(medicationHistoryFilter(cursor));
      const result = await withServiceQueryTimeout(Promise.resolve(query), 'Katalog laden', 18000);
      if (result.error) throw Error(toGermanSupabaseError(result.error));
      return result.data;
    }, scope.tenantId, () => true);
    return { ok: true, data: (items as WoundCatalogItem[]).sort((a, b) => a.name.localeCompare(b.name, 'de')) };
  } catch (e) { return { ok: false, error: errorText(e) }; }
}

export async function saveWoundCatalogItem(scope: Pick<WoundRecordScope, 'tenantId' | 'actorId' | 'role'>,
  item: Omit<WoundCatalogItem, 'updated_at'> & { updated_at?: string }): Promise<ServiceResult<string>> {
  try {
    const db = assertScope(scope, true);
    const response = await rpc(db, 'save_wound_catalog_item', {
      p_tenant: scope.tenantId, p_actor: scope.actorId, p_item: item,
    });
    if (response.error) throw Error(toGermanSupabaseError(response.error));
    if (response.data !== item.id) throw Error('Katalogeintrag konnte nicht bestätigt werden.');
    return { ok: true, data: item.id };
  } catch (e) { return { ok: false, error: errorText(e) }; }
}

export async function prepareWoundFile(name: string, mime: string, bytes: ArrayBuffer): Promise<WoundFile> {
  const normalized = mime.split(';')[0].trim().toLowerCase();
  if (bytes.byteLength < 1 || bytes.byteLength > WOUND_MEDIA_LIMIT) throw Error('Datei zwischen 1 Byte und 25 MB auswählen.');
  const sha = new Uint8Array(await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes));
  const digest = Array.from(sha, byte => byte.toString(16).padStart(2, '0')).join('');
  return { id: Crypto.randomUUID(), name: name.replace(/[\\/\x00-\x1f]/g, '_').slice(0, 180), mime: normalized, bytes, digest };
}

export async function chooseWoundFiles(kind: WoundMediaKind) {
  const type = kind === 'voice' ? ['audio/*'] : ['image/jpeg', 'image/png', 'image/webp'];
  const result = await DocumentPicker.getDocumentAsync({ type, multiple: true, copyToCacheDirectory: true });
  if (result.canceled) return [];
  const files: WoundFile[] = [];
  for (const asset of result.assets) {
    if (asset.size != null && asset.size > WOUND_MEDIA_LIMIT) throw Error('Die Datei ' + asset.name + ' ist größer als 25 MB.');
    const file = asset.file ?? new File(asset.uri);
    try {
      files.push(await prepareWoundFile(asset.name, asset.mimeType || asset.file?.type || file.type, await file.arrayBuffer()));
    } finally {
      if (file instanceof File) { try { file.delete(); } catch { /* Picker cache is also managed by the operating system. */ } }
    }
  }
  return files;
}

export async function uploadWoundMedia(scope: WoundRecordScope, input: {
  kind: WoundMediaKind; file: WoundFile; observedAt: string; assessmentId: string | null; consentId: string | null;
}) {
  const db = assertCase(scope, true);
  const { file } = input;
  const response = await rpc(db, 'prepare_wound_media', { ...scopeArgs(scope), p_file: {
    id: file.id, kind: input.kind, name: file.name, mime: file.mime, size: file.bytes.byteLength,
    digest: file.digest, observedAt: input.observedAt, assessmentId: input.assessmentId, consentId: input.consentId,
  } });
  if (response.error) throw Error(toGermanSupabaseError(response.error));
  const receipt = object(response.data);
  const storedId = receipt?.id;
  const path = scope.tenantId + '/' + scope.clientId + '/' + (storedId ?? '');
  if (!woundUuid(storedId) || receipt?.path !== path) throw Error('Die Dateizuordnung konnte nicht bestätigt werden.');
  if (receipt.state === 'ready' && storedId === file.id) return;
  if (receipt.state !== 'pending') throw Error('Ungültiger Uploadstatus.');
  const upload = await db.storage.from(BUCKET).upload(path, file.bytes, {
    upsert: false, contentType: file.mime, cacheControl: '0',
  });
  if (upload.error && !/already exists|duplicate/i.test(upload.error.message)) throw Error('Upload unterbrochen. Dieselbe Datei erneut versuchen.');
  const completed = await rpc(db, 'complete_wound_media', { ...scopeArgs(scope), p_id: storedId });
  if (completed.error) throw Error(toGermanSupabaseError(completed.error));
  if (completed.data !== storedId) throw Error('Die Datei konnte noch nicht bestätigt werden.');
}

export async function woundMediaUrl(scope: WoundRecordScope, file: WoundMedia) {
  const db = assertCase(scope, false);
  if (!woundUuid(file.id)) throw Error('Datei nicht verfügbar.');
  const { data, error } = await db.storage.from(BUCKET).createSignedUrl(
    scope.tenantId + '/' + scope.clientId + '/' + file.id, 60,
  );
  if (error || !data?.signedUrl) throw Error('Die Dateifreigabe ist abgelaufen oder das Medium ist nicht mehr zugänglich.');
  return data.signedUrl;
}

export async function woundImageDataUrl(scope: WoundRecordScope, file: WoundMedia) {
  if (!/^image\/(?:jpeg|png|webp)$/.test(file.mime_type)) throw Error('Das Dateiformat wird nicht unterstützt.');
  const result = await fetch(await woundMediaUrl(scope, file), { cache: 'no-store' });
  if (!result.ok) throw Error('Das Bild konnte nicht abgerufen werden.');
  const bytes = new Uint8Array(await result.arrayBuffer());
  if (bytes.length !== file.size_bytes || bytes.length > WOUND_MEDIA_LIMIT) throw Error('Die Bilddatei wurde nicht vollständig geladen.');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let encoded = '';
  for (let offset = 0; offset < bytes.length; offset += 3) {
    const a = bytes[offset], b = bytes[offset + 1] ?? 0, c = bytes[offset + 2] ?? 0;
    encoded += alphabet[a >> 2] + alphabet[((a & 3) << 4) | (b >> 4)]
      + (offset + 1 < bytes.length ? alphabet[((b & 15) << 2) | (c >> 6)] : '=')
      + (offset + 2 < bytes.length ? alphabet[c & 63] : '=');
  }
  return 'data:' + file.mime_type + ';base64,' + encoded;
}

export type WoundStatistics = { total: number; people: number; dated: number; medianDays: number | null;
  types: Record<string, number>; ageGroups: Record<string, number>; gender: Record<string, number>; factors: Record<string, number> };

export async function readWoundStatistics(scope: WoundRecordUserScope, from: string, to: string, clientId?: string): Promise<ServiceResult<WoundStatistics>> {
  try {
    const db = assertScope(scope, false);
    if (clientId !== undefined && !woundUuid(clientId)) throw Error('Pflegeakte für die Auswertung prüfen.');
    const args = { p_tenant: scope.tenantId, p_actor: scope.actorId, p_from: from, p_to: to };
    const response = clientId
      ? await rpc(db, 'read_wound_statistics_for_client', { ...args, p_client: clientId })
      : await rpc(db, 'read_wound_statistics', args);
    if (response.error) throw Error(toGermanSupabaseError(response.error));
    const data = object(response.data);
    if (!data || !Number.isInteger(data.total)) throw Error('Statistik konnte nicht bestätigt werden.');
    return { ok: true, data: data as WoundStatistics };
  } catch (e) { return { ok: false, error: errorText(e) }; }
}
