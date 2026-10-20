import type { RoleKey } from '@/types/core/auth';
import type { CommunicationAudience, CommunicationMessage } from './communication.types';

export function filterMessagesForAudience(
  messages: CommunicationMessage[],
  audience: CommunicationAudience,
  canViewDeleted: boolean,
): CommunicationMessage[] {
  return messages.filter((message) => {
    if (message.deletedAt && !canViewDeleted) {
      return false;
    }
    if (message.isInternalNote && audience !== 'business') {
      return false;
    }
    switch (audience) {
      case 'business':
        return message.isVisibleToBusiness;
      case 'employee_portal':
        return message.isVisibleToEmployee && !message.isInternalNote;
      case 'client_portal':
        return message.isVisibleToClient && !message.isInternalNote;
      case 'relative_portal':
        return message.isVisibleToRelative && !message.isInternalNote;
      default:
        return false;
    }
  });
}

export function stripInternalNotes(messages: CommunicationMessage[]): CommunicationMessage[] {
  return messages.filter((m) => !m.isInternalNote);
}

export function assertNoInternalNotesInPortalView(messages: CommunicationMessage[]): boolean {
  return messages.every((m) => !m.isInternalNote);
}

export function resolveSenderTypeForAudience(
  audience: CommunicationAudience,
  roleKey: RoleKey | null | undefined,
): CommunicationMessage['senderType'] {
  switch (audience) {
    case 'employee_portal':
      return 'employee_portal';
    case 'client_portal':
      return 'client_portal';
    case 'relative_portal':
      return 'relative_portal';
    default:
      return roleKey?.includes('portal') ? 'employee_portal' : 'business_user';
  }
}

export function mapDeletedMessageBody(message: CommunicationMessage, audience: CommunicationAudience): string | null {
  if (!message.deletedAt) return message.bodyText;
  if (audience === 'business') return 'Nachricht gelöscht (Soft Delete)';
  return null;
}
