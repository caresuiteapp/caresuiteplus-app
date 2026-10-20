import type { CommunicationMessage } from '@/features/communication/communication.types';
import { formatOfficeClientName } from '@/lib/office/officeDocumentDisplay';
import type { OfficeMessage, OfficeMessageThread, OfficeThreadType } from '@/types/office/messaging';

export const OFFICE_THREAD_TYPE_LABELS: Record<OfficeThreadType, string> = {
  client_office: 'Klient:in',
  employee_office: 'Mitarbeiter:in',
  employee_group_office: 'Gruppen-Chat',
  internal: 'Intern',
};

export function formatPersonFullName(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
): string | null {
  return formatOfficeClientName(firstName, lastName);
}

export function resolveProfileDisplayName(displayName: string | null | undefined): string | null {
  const trimmed = displayName?.trim();
  return trimmed || null;
}

export function resolveInternalParticipantName(
  profileIds: string[],
  profileNames: Map<string, string>,
  actorProfileId?: string | null,
): string | null {
  const targetIds =
    actorProfileId && profileIds.length > 1
      ? profileIds.filter((id) => id !== actorProfileId)
      : profileIds;
  const names = targetIds
    .map((id) => profileNames.get(id))
    .filter((name): name is string => Boolean(name?.trim()));
  if (names.length > 0) return names.join(' · ');
  const fallbackNames = profileIds
    .map((id) => profileNames.get(id))
    .filter((name): name is string => Boolean(name?.trim()));
  return fallbackNames.length > 0 ? fallbackNames.join(' · ') : null;
}

export function resolveOfficeThreadParticipantName(
  thread: OfficeMessageThread | null | undefined,
): string {
  if (!thread) return 'Chat';

  if (thread.threadType === 'client_office' && thread.clientName) return thread.clientName;
  if (thread.threadType === 'employee_office' && thread.employeeName) return thread.employeeName;
  if (thread.threadType === 'employee_group_office') {
    return thread.subject?.trim() || 'Gruppen-Chat';
  }
  if (thread.threadType === 'internal' && thread.participantName) return thread.participantName;

  return (
    thread.clientName ??
    thread.employeeName ??
    thread.participantName ??
    (thread.subject?.trim() || 'Chat')
  );
}

export function resolveOfficeThreadHeaderSubtitle(
  thread: OfficeMessageThread | null | undefined,
  statusLabel: string,
): string {
  if (!thread) return statusLabel;

  const typeLabel = OFFICE_THREAD_TYPE_LABELS[thread.threadType];
  const subject = thread.subject?.trim();
  const memberSuffix =
    thread.threadType === 'employee_group_office' && thread.memberCount
      ? `${thread.memberCount} Mitglieder`
      : null;
  const parts = [typeLabel, memberSuffix, subject, `Status: ${statusLabel}`].filter(Boolean);
  return parts.join(' · ');
}

export function mapOfficeMessageToChatBubble(message: OfficeMessage): CommunicationMessage {
  return {
    id: message.id,
    tenantId: message.tenantId,
    threadId: message.threadId,
    senderType:
      message.senderType === 'client_portal'
        ? 'client_portal'
        : message.senderType === 'employee_portal'
          ? 'employee_portal'
          : message.senderType === 'system'
            ? 'system'
            : 'business_user',
    senderUserId: message.senderProfileId,
    senderPortalSessionId: null,
    senderDisplayName: message.senderDisplayName,
    contentType: message.isSystemMessage ? 'system' : 'text',
    bodyText: message.body,
    hasAttachments: false,
    hasVoice: false,
    emojiReactionsCount: 0,
    status: message.status === 'read' ? 'read' : 'sent',
    isInternalNote: message.isInternalNote,
    isVisibleToBusiness: true,
    isVisibleToEmployee: !message.isInternalNote,
    isVisibleToClient: !message.isInternalNote,
    isVisibleToRelative: false,
    sentAt: message.sentAt,
    deliveredAt: message.sentAt,
    readAt: message.readAt,
    editedAt: null,
    editedBy: null,
    deletedAt: null,
    deletedBy: null,
    deleteReason: null,
    replyToMessageId: null,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
  };
}
