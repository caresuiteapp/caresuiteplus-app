import { Platform, Linking } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { v4 as uuid } from 'uuid';
import { getSupabaseClient } from '@/lib/supabase/client';

export const SUPPORT_SCOPES = {
  'company.read': 'Unternehmensdaten einsehen',
  'company.write': 'Unternehmensdaten bearbeiten',
  'assignments.read': 'Einsätze, Zeiten und Dokumentationsstatus einsehen',
  'assignments.notes.write': 'Interne Einsatznotizen bearbeiten',
  'clients.read': 'Klienten: Name, Nummer und Status einsehen',
  'employees.read': 'Personal: Name, Nummer, Status und Portalstatus einsehen',
} as const;
export type SupportScope = keyof typeof SUPPORT_SCOPES;
export const SUPPORT_STATUS: Record<string, string> = { open: 'Offen', waiting_tenant: 'Antwort vom Unternehmen', waiting_support: 'Antwort vom Support', resolved: 'Gelöst', closed: 'Geschlossen' };
export type SupportTicket = { id: string; number: number; subject: string; tenant_id: string; tenant_name: string; status: string; category: string; priority: string; assigned_name: string | null; updated_at: string; last_message?: string };
export type SupportAttachment = { id: string; file_name: string; storage_path: string; byte_size: number; mime_type: string; state: 'uploading' | 'ready' | 'discarding' };
export type SupportMessage = { id: string; body: string; author_kind: 'tenant' | 'platform'; author_name: string; created_at: string; attachments: SupportAttachment[] };
export type SupportAccess = { id: string; ticket_id: string; requester_name: string; reason: string; scopes: SupportScope[]; status: 'requested' | 'approved' | 'rejected' | 'revoked'; duration_minutes: number; created_at: string; expires_at: string | null; is_requester: boolean };
export type SupportDetail = { ticket: SupportTicket; messages: SupportMessage[]; requests: SupportAccess[]; audit: { event: string; details: Record<string, unknown>; created_at: string }[]; can_approve: boolean; can_write: boolean; can_support_write: boolean };
export type SupportQueue = { tickets: SupportTicket[]; can_create: boolean; can_manage: boolean; can_support_write: boolean };
export type SupportRecord = Record<string, string | boolean | null> & { id: string; updated_at: string };
export const newSupportNonce = uuid;

function supportError(code?: string, message = '') {
  if (code === '42501' || /support_access_denied|support_forbidden/.test(message)) return 'Der Zugriff ist nicht freigegeben oder wurde beendet. Bitte Ansicht aktualisieren.';
  if (code === '40001') return 'Der Datensatz wurde inzwischen geändert. Bitte neu laden und die Änderung erneut prüfen.';
  if (/support_request_pending/.test(message)) return 'Für dieses Ticket wartet bereits eine Zugriffsanfrage auf Bestätigung.';
  if (/support_upload_incomplete/.test(message)) return 'Der Upload ist noch nicht vollständig bestätigt. Bitte die Datei erneut auswählen.';
  if (/support_ticket_closed|support_request_inactive/.test(message)) return 'Das Ticket oder die Freigabe ist nicht mehr aktiv. Bitte aktualisieren.';
  if (/support_tenant_approval_required/.test(message)) return 'Nur die berechtigte Unternehmensverwaltung kann diesen Zugriff freigeben.';
  if (/support_invalid|support_patch|support_scope/.test(message)) return 'Bitte Nachricht, Anhänge und ausgewählte Berechtigungen prüfen.';
  if (/support_upload_limit/.test(message)) return 'Zu viele offene Uploads. Bitte vorhandene Anhänge senden oder später erneut versuchen.';
  return 'Die Support-Anfrage konnte nicht abgeschlossen werden. Ihre Eingaben bleiben erhalten; bitte erneut versuchen.';
}

export class SupportRequestError extends Error { constructor(message: string, public readonly code?: string) { super(message); this.name = 'SupportRequestError'; } }
export const isSupportPermissionError = (cause: unknown): boolean => cause instanceof SupportRequestError && cause.code === '42501';

export async function supportRpc<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  const client = getSupabaseClient();
  if (!client) throw new Error('Support ist momentan nicht erreichbar. Bitte Verbindung und Anmeldung prüfen.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const result = await client.rpc(name as never, args as never).abortSignal(controller.signal);
    if (result.error) throw new SupportRequestError(supportError(result.error.code, result.error.message), result.error.code);
    return result.data as T;
  } catch (cause) {
    if (cause instanceof SupportRequestError) throw cause;
    throw new SupportRequestError(supportError());
  } finally { clearTimeout(timer); }
}

export function isSupportAccessActive(request: SupportAccess, now = Date.now()) {
  return request.status === 'approved' && !!request.expires_at && Date.parse(request.expires_at) > now;
}

export function withRequiredReadScopes(scopes: SupportScope[]): SupportScope[] {
  const next = new Set(scopes);
  if (next.has('company.write')) next.add('company.read');
  if (next.has('assignments.notes.write')) next.add('assignments.read');
  return [...next];
}

const ALLOWED_FILES: Record<string, string> = { png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',pdf:'application/pdf',txt:'text/plain',log:'text/plain',zip:'application/zip',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',mp4:'video/mp4' };
export async function pickSupportAttachment(ticketId: string): Promise<SupportAttachment | null> {
  const chosen = await DocumentPicker.getDocumentAsync({ multiple: false, copyToCacheDirectory: true, type: Object.values(ALLOWED_FILES) });
  if (chosen.canceled) return null;
  const file = chosen.assets[0];
  const mime = ALLOWED_FILES[file.name.split('.').pop()?.toLowerCase() ?? ''];
  if (!mime) throw new Error('Unterstützt werden Bilder, PDF, Text, ZIP, Word, Excel und MP4.');
  if (file.size && file.size > 20 * 1024 * 1024) throw new Error('Eine Datei darf höchstens 20 MB groß sein.');
  const response = await fetch(file.uri);
  const bytes = await response.arrayBuffer();
  if (!bytes.byteLength || bytes.byteLength > 20 * 1024 * 1024) throw new Error('Bitte eine Datei zwischen 1 Byte und 20 MB auswählen.');
  const attachment = await supportRpc<SupportAttachment>('support_reserve_attachment', { p_ticket_id: ticketId, p_file_name: file.name, p_mime_type: mime, p_byte_size: bytes.byteLength });
  const client = getSupabaseClient();
  if (!client) throw new Error('Anmeldung nicht verfügbar.');
  const result = await client.storage.from('support-ticket-attachments').upload(attachment.storage_path, bytes, { contentType: mime, upsert: false });
  if (result.error) throw new Error('Die Datei konnte nicht hochgeladen werden. Bitte erneut auswählen.');
  return supportRpc<SupportAttachment>('support_finalize_attachment', { p_attachment_id: attachment.id });
}

export async function removeSupportDraftAttachment(file: SupportAttachment) {
  const client = getSupabaseClient();
  if (!client) throw new Error('Anmeldung nicht verfügbar.');
  await supportRpc('support_begin_discard_attachment', { p_attachment_id: file.id });
  const { error } = await client.storage.from('support-ticket-attachments').remove([file.storage_path]);
  if (error) throw new Error('Der Anhang konnte nicht entfernt werden. Bitte erneut versuchen.');
  await supportRpc('support_discard_attachment', { p_attachment_id: file.id });
}

export async function downloadSupportAttachment(file: SupportAttachment) {
  const client = getSupabaseClient();
  if (!client) throw new Error('Anmeldung nicht verfügbar.');
  if (Platform.OS === 'web') {
    // Authenticated download checks ticket authorization on every request.
    const { data, error } = await client.storage.from('support-ticket-attachments').download(file.storage_path);
    if (error || !data) throw new Error('Anhang nicht verfügbar oder Zugriff beendet.');
    const url = URL.createObjectURL(data);
    const link = document.createElement('a'); link.href = url; link.download = file.file_name; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } else {
    const { data, error } = await client.storage.from('support-ticket-attachments').createSignedUrl(file.storage_path, 60, { download: file.file_name });
    if (error || !data) throw new Error('Anhang nicht verfügbar oder Zugriff beendet.');
    await Linking.openURL(data.signedUrl);
  }
}

/** RLS filters every event; polling remains a fallback when Realtime is unavailable. */
export function subscribeSupport(ticketId: string | null, changed: () => void): () => void {
  const client = getSupabaseClient();
  if (!client) return () => undefined;
  const channel = client.channel(`support:${ticketId ?? 'queue'}:${uuid()}`);
  if (ticketId) {
    for (const table of ['support_messages', 'support_access_requests']) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `ticket_id=eq.${ticketId}` }, changed);
    }
  } else channel.on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets' }, changed);
  channel.subscribe();
  return () => { void client.removeChannel(channel); };
}
