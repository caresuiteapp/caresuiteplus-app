import type {
  OfficeMessage,
  OfficeMessageThreadDetail,
  OfficeThreadStatus,
} from '@/types/office/messaging';

export type OfficeMessageOpenPlan = Readonly<{
  markMessagesRead: boolean;
  workflowStatusUpdate: null;
}>;

export type OfficeMessageFollowUpCode =
  | 'assign_owner'
  | 'contact_recipient'
  | 'await_response'
  | 'process_response'
  | 'confirm_communication_closure';

export type OfficeMessageFollowUpState = Readonly<{
  threadId: string;
  tenantId: string;
  inquiry: Readonly<OfficeMessage> | null;
  contactAttempts: readonly Readonly<OfficeMessage>[];
  responses: readonly Readonly<OfficeMessage>[];
  readReceiptCount: number;
  workflowStatus: OfficeThreadStatus;
  communicationClosure: 'open' | 'confirmed' | 'unconfirmed';
  openFollowUps: readonly OfficeMessageFollowUpCode[];
  taskCompletion: 'not_determined';
}>;

const CLOSED = new Set<OfficeThreadStatus>(['resolved', 'closed', 'archived', 'deleted']);

function cloneMessage(message: OfficeMessage): Readonly<OfficeMessage> {
  return Object.freeze({ ...message });
}

const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.(\d{1,6}))?(?:Z|[+-]\d{2}:\d{2})$/;

function instantMicros(value: string, label: string): bigint {
  const match = INSTANT.exec(value);
  const milliseconds = Date.parse(value);
  if (!match || Number.isNaN(milliseconds)) throw new Error(`${label} ist kein exakter Zeitpunkt.`);
  const fraction = (match[1] ?? '').padEnd(6, '0');
  return BigInt(milliseconds) * 1000n + BigInt(fraction.slice(3, 6) || '0');
}

function assertWholeThread(thread: OfficeMessageThreadDetail): void {
  if (!thread.id.trim() || !thread.tenantId.trim()) {
    throw new Error('Nachrichtenverlauf benötigt native Mandanten- und Threadkennung.');
  }
  const ids = new Set<string>();
  let previousSentAt: bigint | null = null;
  for (const message of thread.messages) {
    if (!message.id.trim() || ids.has(message.id)) {
      throw new Error('Nachrichtenverlauf enthält eine fehlende oder doppelte Nachrichtenkennung.');
    }
    ids.add(message.id);
    if (message.tenantId !== thread.tenantId || message.threadId !== thread.id) {
      throw new Error('Nachricht gehört nicht zum vollständig geladenen Mandanten- und Threadkontext.');
    }
    const sentAt = instantMicros(message.sentAt, 'Original-Sendezeitpunkt');
    if (previousSentAt !== null && sentAt < previousSentAt) {
      throw new Error('Nachrichtenverlauf ist nicht vollständig chronologisch geladen.');
    }
    previousSentAt = sentAt;
    const readAt = message.readAt ? instantMicros(message.readAt, 'Original-Lesezeitpunkt') : null;
    if (readAt !== null && readAt < sentAt) {
      throw new Error('Lesebeleg liegt vor dem Original-Sendezeitpunkt.');
    }
  }
}

/**
 * Opening a thread may create read receipts only. It never changes the explicit
 * workflow status and therefore cannot claim that somebody started or finished
 * the underlying task.
 */
export function planOfficeMessageOpen(
  thread: Pick<OfficeMessageThreadDetail, 'status' | 'unreadCount'>,
): OfficeMessageOpenPlan {
  return Object.freeze({
    markMessagesRead: thread.unreadCount > 0 || thread.status === 'new' || thread.status === 'received',
    workflowStatusUpdate: null,
  });
}

/**
 * Read-only projection of inquiry, actual contact messages and actual replies.
 * Message/read facts remain separate from an explicit communication closure;
 * the completion of a linked operational or care task is never inferred.
 */
export function projectOfficeMessageFollowUp(
  thread: OfficeMessageThreadDetail,
): OfficeMessageFollowUpState {
  assertWholeThread(thread);
  const messages = thread.messages.map(cloneMessage);
  const visible = messages.filter((message) => !message.isInternalNote && !message.isSystemMessage);
  const inbound = visible.filter(
    (message) => message.senderType === 'client_portal' || message.senderType === 'employee_portal',
  );
  const inquiry = inbound[0] ?? null;
  const inquiryIndex = inquiry ? visible.findIndex((message) => message.id === inquiry.id) : -1;
  const contactAttempts = inquiry
    ? visible.slice(inquiryIndex + 1).filter((message) => message.senderType === 'office_profile')
    : [];
  const firstAttemptIndex = contactAttempts.length
    ? visible.findIndex((message) => message.id === contactAttempts[0]!.id)
    : -1;
  const responses = firstAttemptIndex >= 0
    ? visible.slice(firstAttemptIndex + 1).filter(
        (message) => message.senderType === 'client_portal' || message.senderType === 'employee_portal',
      )
    : [];

  const explicitlyClosed = CLOSED.has(thread.status);
  const communicationClosure = !explicitlyClosed
    ? 'open'
    : thread.closedAt && thread.closedByUserId
      ? 'confirmed'
      : 'unconfirmed';

  const openFollowUps: OfficeMessageFollowUpCode[] = [];
  if (!explicitlyClosed) {
    if (!thread.assignedToUserId) openFollowUps.push('assign_owner');
    if (inquiry && contactAttempts.length === 0) openFollowUps.push('contact_recipient');
    if (contactAttempts.length > 0 && responses.length === 0) openFollowUps.push('await_response');
    if (responses.length > 0) openFollowUps.push('process_response');
  } else if (communicationClosure === 'unconfirmed') {
    openFollowUps.push('confirm_communication_closure');
  }

  return Object.freeze({
    threadId: thread.id,
    tenantId: thread.tenantId,
    inquiry,
    contactAttempts: Object.freeze(contactAttempts),
    responses: Object.freeze(responses),
    readReceiptCount: visible.filter((message) => message.readAt !== null).length,
    workflowStatus: thread.status,
    communicationClosure,
    openFollowUps: Object.freeze(openFollowUps),
    taskCompletion: 'not_determined',
  });
}
