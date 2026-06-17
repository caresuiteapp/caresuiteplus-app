import type { CommunicationThread } from '@/features/communication/communication.types';
import type { RoleKey } from '@/types';
import type { MessageListItem } from '@/types/portal/communication';
import type { WorkflowStatus } from '@/types';
import type { OfficeRecipientType } from '@/types/office/officeCompose';

export type BuildOfficeThreadInput = {
  subject: string;
  audienceScope: 'office' | 'portal';
  recipientType?: OfficeRecipientType | null;
  recipientId?: string | null;
  recipientLabel?: string;
  recipientName?: string;
};

const OFFICE_BACK_OFFICE_ROLES: RoleKey[] = [
  'business_admin',
  'business_manager',
  'billing',
  'dispatch',
];

export const OFFICE_RECIPIENT_HINTS: Record<OfficeRecipientType, string> = {
  client: 'Nachricht erscheint im Klient:innen-Portal und in der Office-Nachrichtenliste.',
  employee: 'Nachricht erscheint im Mitarbeiter:innen-Portal und in der Office-Nachrichtenliste.',
  team: 'Nachricht geht an das Team-Postfach aller aktiven Mitarbeitenden. „Allgemein“ = Broadcast an das gesamte Team.',
  internal:
    'Nachricht landet im internen Büro-Postfach — sichtbar für Büropersonal (Admin, Leitung, Abrechnung, Disposition), nicht für Außendienst.',
};

export function canViewOfficeInternalMessages(roleKey?: RoleKey | null): boolean {
  if (!roleKey) return false;
  return OFFICE_BACK_OFFICE_ROLES.includes(roleKey);
}

export function isOfficeTeamBroadcastThread(thread: CommunicationThread): boolean {
  return thread.threadType === 'employee' && thread.employeeId === null && thread.moduleKey === 'office';
}

export function buildOfficeThreadPayload(
  input: BuildOfficeThreadInput,
  profileId?: string,
): Partial<CommunicationThread> & { title: string; threadType: CommunicationThread['threadType'] } {
  const subject = input.subject.trim();
  const recipientLabel = input.recipientLabel?.trim() || input.recipientName?.trim() || 'Empfänger';

  if (input.recipientType === 'client') {
    return {
      threadType: 'client',
      title: subject,
      subject,
      moduleKey: 'office',
      clientId: input.recipientId ?? null,
      employeeId: null,
      isInternalOnly: false,
      isPortalVisible: true,
      allowClientReplies: true,
      allowEmployeeReplies: false,
      allowRelativeReplies: false,
      createdByUserId: profileId ?? null,
    };
  }

  if (input.recipientType === 'employee') {
    return {
      threadType: 'employee',
      title: subject,
      subject,
      moduleKey: 'office',
      clientId: null,
      employeeId: input.recipientId ?? null,
      isInternalOnly: false,
      isPortalVisible: true,
      allowClientReplies: false,
      allowEmployeeReplies: true,
      allowRelativeReplies: false,
      createdByUserId: profileId ?? null,
    };
  }

  if (input.recipientType === 'team') {
    return {
      threadType: 'employee',
      title: `${subject} — ${recipientLabel}`,
      subject,
      moduleKey: 'office',
      clientId: null,
      employeeId: null,
      isInternalOnly: false,
      isPortalVisible: true,
      allowClientReplies: false,
      allowEmployeeReplies: true,
      allowRelativeReplies: false,
      createdByUserId: profileId ?? null,
    };
  }

  if (input.recipientType === 'internal') {
    return {
      threadType: 'internal',
      title: subject,
      subject,
      moduleKey: 'office',
      clientId: null,
      employeeId: null,
      isInternalOnly: true,
      isPortalVisible: false,
      allowClientReplies: false,
      allowEmployeeReplies: false,
      allowRelativeReplies: false,
      createdByUserId: profileId ?? null,
    };
  }

  return {
    threadType: 'internal',
    title: subject,
    subject,
    moduleKey: 'office',
    clientId: null,
    employeeId: null,
    isInternalOnly: input.audienceScope === 'office',
    isPortalVisible: input.audienceScope !== 'office',
    allowClientReplies: false,
    allowEmployeeReplies: false,
    allowRelativeReplies: false,
    createdByUserId: profileId ?? null,
  };
}

function mapThreadStatusToWorkflow(status: string): WorkflowStatus {
  switch (status) {
    case 'open':
    case 'waiting_for_portal_user':
      return 'aktiv';
    case 'waiting_for_business':
    case 'blocked':
      return 'in_bearbeitung';
    case 'resolved':
    case 'archived':
      return 'abgeschlossen';
    default:
      return 'aktiv';
  }
}

function resolveOfficeMessageSubject(thread: CommunicationThread): string {
  if (thread.subject?.trim()) return thread.subject.trim();
  const separator = thread.title.indexOf(' — ');
  if (separator > 0) return thread.title.slice(0, separator);
  return thread.title;
}

export function resolveOfficeMessageRecipientName(thread: CommunicationThread): string {
  if (thread.threadType === 'internal') return 'Büro (intern)';
  if (thread.threadType === 'client') return 'Klient:in';
  if (thread.threadType === 'employee') {
    if (isOfficeTeamBroadcastThread(thread)) {
      const separator = thread.title.indexOf(' — ');
      if (separator > 0) return thread.title.slice(separator + 3);
      return 'Team (alle)';
    }
    return 'Mitarbeiter:in';
  }
  return thread.title;
}

export function mapOfficeThreadToMessageListItem(
  thread: CommunicationThread,
  body: string,
  senderName: string,
): MessageListItem {
  const isInternal = thread.threadType === 'internal';
  const isTeamBroadcast = isOfficeTeamBroadcastThread(thread);

  return {
    id: thread.id,
    subject: resolveOfficeMessageSubject(thread),
    body,
    senderName,
    recipientName: resolveOfficeMessageRecipientName(thread),
    direction: 'outbound',
    readAt: thread.unreadCountBusiness > 0 ? null : thread.updatedAt,
    status: mapThreadStatusToWorkflow(thread.status),
    updatedAt: thread.lastMessageAt ?? thread.updatedAt,
    visibility: isInternal || isTeamBroadcast ? 'team' : 'shared',
    sensitivity: isInternal ? 'internal' : 'restricted',
  };
}

export function shouldIncludeOfficeThread(
  thread: CommunicationThread,
  actorRoleKey?: RoleKey | null,
): boolean {
  if (thread.moduleKey !== 'office') return false;
  if (thread.deletedAt || thread.status === 'deleted') return false;
  if (thread.threadType === 'internal' && !canViewOfficeInternalMessages(actorRoleKey)) {
    return false;
  }
  return true;
}
