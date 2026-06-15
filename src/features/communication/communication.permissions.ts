import type { RoleKey } from '@/types/core/auth';
import type { PermissionKey } from '@/types/permissions';
import { checkPermission, enforcePermission } from '@/lib/permissions';
import type { CommunicationAudience } from './communication.types';

export type CommunicationPermission =
  | 'communication.view_center'
  | 'communication.create_thread'
  | 'communication.send_message'
  | 'communication.send_internal_note'
  | 'communication.edit_own_message'
  | 'communication.edit_any_message'
  | 'communication.delete_own_message'
  | 'communication.delete_any_message'
  | 'communication.archive_thread'
  | 'communication.restore_thread'
  | 'communication.assign_thread'
  | 'communication.manage_participants'
  | 'communication.upload_attachment'
  | 'communication.send_voice_message'
  | 'communication.view_client_threads'
  | 'communication.view_employee_threads'
  | 'communication.view_relative_threads'
  | 'communication.view_internal_threads'
  | 'communication.view_deleted_messages'
  | 'communication.export_messages'
  | 'communication.manage_settings';

const COMMUNICATION_PERMISSION_MAP: Record<CommunicationPermission, PermissionKey> = {
  'communication.view_center': 'communication.view_center',
  'communication.create_thread': 'communication.create_thread',
  'communication.send_message': 'communication.send_message',
  'communication.send_internal_note': 'communication.send_internal_note',
  'communication.edit_own_message': 'communication.edit_own_message',
  'communication.edit_any_message': 'communication.edit_any_message',
  'communication.delete_own_message': 'communication.delete_own_message',
  'communication.delete_any_message': 'communication.delete_any_message',
  'communication.archive_thread': 'communication.archive_thread',
  'communication.restore_thread': 'communication.restore_thread',
  'communication.assign_thread': 'communication.assign_thread',
  'communication.manage_participants': 'communication.manage_participants',
  'communication.upload_attachment': 'communication.upload_attachment',
  'communication.send_voice_message': 'communication.send_voice_message',
  'communication.view_client_threads': 'communication.view_client_threads',
  'communication.view_employee_threads': 'communication.view_employee_threads',
  'communication.view_relative_threads': 'communication.view_relative_threads',
  'communication.view_internal_threads': 'communication.view_internal_threads',
  'communication.view_deleted_messages': 'communication.view_deleted_messages',
  'communication.export_messages': 'communication.export_messages',
  'communication.manage_settings': 'communication.manage_settings',
};

export function hasCommunicationPermission(
  roleKey: RoleKey | null | undefined,
  permission: CommunicationPermission,
): boolean {
  return checkPermission(roleKey, COMMUNICATION_PERMISSION_MAP[permission]).allowed;
}

export function enforceCommunicationPermission<T>(
  roleKey: RoleKey | null | undefined,
  permission: CommunicationPermission,
) {
  return enforcePermission<T>(roleKey, COMMUNICATION_PERMISSION_MAP[permission]);
}

export function canAccessCommunicationCenter(roleKey: RoleKey | null | undefined): boolean {
  return hasCommunicationPermission(roleKey, 'communication.view_center');
}

export function canSendPortalMessage(
  roleKey: RoleKey | null | undefined,
  audience: CommunicationAudience,
): boolean {
  switch (audience) {
    case 'employee_portal':
      return checkPermission(roleKey, 'portal.employee.messages.reply').allowed;
    case 'client_portal':
      return checkPermission(roleKey, 'portal.client.messages.reply').allowed;
    case 'relative_portal':
      return checkPermission(roleKey, 'portal.client.messages.reply').allowed;
    default:
      return hasCommunicationPermission(roleKey, 'communication.send_message');
  }
}

export function canViewPortalThreads(
  roleKey: RoleKey | null | undefined,
  audience: CommunicationAudience,
): boolean {
  switch (audience) {
    case 'employee_portal':
      return checkPermission(roleKey, 'portal.employee.messages.view').allowed;
    case 'client_portal':
      return checkPermission(roleKey, 'portal.client.messages.view').allowed;
    case 'relative_portal':
      return checkPermission(roleKey, 'portal.client.messages.view').allowed;
    default:
      return canAccessCommunicationCenter(roleKey);
  }
}

export const COMMUNICATION_PERMISSION_LABELS: Record<CommunicationPermission, string> = {
  'communication.view_center': 'Kommunikationszentrum ansehen',
  'communication.create_thread': 'Threads anlegen',
  'communication.send_message': 'Nachrichten senden',
  'communication.send_internal_note': 'Interne Notizen senden',
  'communication.edit_own_message': 'Eigene Nachrichten bearbeiten',
  'communication.edit_any_message': 'Alle Nachrichten bearbeiten',
  'communication.delete_own_message': 'Eigene Nachrichten löschen',
  'communication.delete_any_message': 'Alle Nachrichten löschen',
  'communication.archive_thread': 'Threads archivieren',
  'communication.restore_thread': 'Threads wiederherstellen',
  'communication.assign_thread': 'Nachrichten zuordnen',
  'communication.manage_participants': 'Teilnehmer verwalten',
  'communication.upload_attachment': 'Anhänge hochladen',
  'communication.send_voice_message': 'Sprachnachrichten senden',
  'communication.view_client_threads': 'Klient:innen-Threads ansehen',
  'communication.view_employee_threads': 'Mitarbeitenden-Threads ansehen',
  'communication.view_relative_threads': 'Angehörigen-Threads ansehen',
  'communication.view_internal_threads': 'Interne Threads ansehen',
  'communication.view_deleted_messages': 'Gelöschte Nachrichten ansehen',
  'communication.export_messages': 'Nachrichten exportieren',
  'communication.manage_settings': 'Kommunikationseinstellungen verwalten',
};
