import type { ServiceResult } from '@/types';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { settingsSupabaseRepository } from '@/features/communication/repositories/settings.supabase';
import type { MessagingActor } from './messageWorkspaceService.web';

export type MessagePreferences = { attachmentsEnabled: boolean; voiceMessagesEnabled: boolean; internalNotesEnabled: boolean; emojisEnabled: boolean; showReadReceipts: boolean };
export const DEFAULT_MESSAGE_PREFERENCES: MessagePreferences = { attachmentsEnabled: true, voiceMessagesEnabled: true, internalNotesEnabled: true, emojisEnabled: true, showReadReceipts: true };
export async function loadMessagePreferences(actor: MessagingActor): Promise<ServiceResult<MessagePreferences>> {
  const denied = enforcePermission<MessagePreferences>(actor.roleKey, 'office.messages.view') ?? guardServiceTenant(actor.tenantId); if (denied) return denied;
  try { const result = await settingsSupabaseRepository.get(actor.tenantId); if (!result.ok) return result; const value = result.data; return { ok: true, data: value ? { attachmentsEnabled: value.attachmentsEnabled, voiceMessagesEnabled: value.voiceMessagesEnabled, internalNotesEnabled: value.internalNotesEnabled, emojisEnabled: value.emojisEnabled, showReadReceipts: value.showReadReceipts } : { ...DEFAULT_MESSAGE_PREFERENCES } }; } catch { return { ok: false, error: 'Nachrichteneinstellungen konnten nicht geladen werden.' }; }
}
export async function saveMessagePreferences(actor: MessagingActor, value: MessagePreferences): Promise<ServiceResult<MessagePreferences>> {
  const denied = enforcePermission<MessagePreferences>(actor.roleKey, 'communication.manage_settings') ?? guardServiceTenant(actor.tenantId); if (denied) return denied;
  try { const result = await settingsSupabaseRepository.upsert(actor.tenantId, { attachments_enabled: value.attachmentsEnabled, voice_messages_enabled: value.voiceMessagesEnabled, internal_notes_enabled: value.internalNotesEnabled, emojis_enabled: value.emojisEnabled, show_read_receipts: value.showReadReceipts }); return result.ok ? { ok: true, data: value } : result; } catch { return { ok: false, error: 'Die Einstellungen konnten nicht gespeichert werden.' }; }
}
