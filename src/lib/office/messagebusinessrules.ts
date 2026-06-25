import type {
  OfficeMessage,
  OfficeMessageThread,
  OfficeThreadType,
} from '@/types/office/messaging';

const OFFICE_THREAD_TYPES: OfficeThreadType[] = [
  'client_office',
  'employee_office',
  'internal',
];

const CLOSED_STATUSES = new Set<OfficeMessageThread['status']>([
  'resolved',
  'archived',
  'deleted',
  'closed',
]);

/** DB enum values used in message_threads.thread_type */
export type DbThreadType = 'client' | 'employee' | 'internal';

export function toDbThreadType(threadType: OfficeThreadType): DbThreadType {
  switch (threadType) {
    case 'client_office':
      return 'client';
    case 'employee_office':
      return 'employee';
    case 'internal':
      return 'internal';
  }
}

export function fromDbThreadType(value: string): OfficeThreadType | null {
  switch (value) {
    case 'client':
      return 'client_office';
    case 'employee':
      return 'employee_office';
    case 'internal':
      return 'internal';
    default:
      return null;
  }
}

/** Rule 1: Messages belong ONLY to the Office module (valid thread types). */
export function isOfficeModuleThread(threadType: OfficeThreadType): boolean {
  return OFFICE_THREAD_TYPES.includes(threadType);
}

/** Rule 2: No direct client↔employee communication in one thread. */
export function assertNoDirectClientEmployeeComms(thread: Pick<OfficeMessageThread, 'threadType' | 'clientId' | 'employeeId'>): boolean {
  if (thread.threadType === 'internal') {
    return thread.clientId === null && thread.employeeId === null;
  }
  if (thread.threadType === 'client_office') {
    return thread.clientId !== null && thread.employeeId === null;
  }
  if (thread.threadType === 'employee_office') {
    return thread.employeeId !== null && thread.clientId === null;
  }
  return false;
}

/** Rule 3: Closed threads cannot receive new messages. */
export function isThreadClosed(status: OfficeMessageThread['status']): boolean {
  return CLOSED_STATUSES.has(status);
}

export function canSendMessageToThread(status: OfficeMessageThread['status']): boolean {
  return !isThreadClosed(status);
}

/** Rule 4: Internal notes are never visible in portals. */
export function filterPortalVisibleMessages(messages: OfficeMessage[]): OfficeMessage[] {
  return filterActiveMessages(messages).filter((message) => !message.isInternalNote);
}

/** Active thread messages — archived/deleted entries stay out of all participant views. */
export function filterActiveMessages(messages: OfficeMessage[]): OfficeMessage[] {
  return messages.filter(
    (message) => message.status !== 'archived' && message.status !== 'deleted',
  );
}

export function isMessageVisibleInPortal(message: OfficeMessage): boolean {
  return !message.isInternalNote && !message.isSystemMessage;
}

export function validateSendMessage(
  thread: Pick<OfficeMessageThread, 'threadType' | 'status' | 'clientId' | 'employeeId'>,
): { ok: true } | { ok: false; error: string } {
  if (!isOfficeModuleThread(thread.threadType)) {
    return { ok: false, error: 'Nachrichten sind nur im Office-Modul erlaubt.' };
  }
  if (!assertNoDirectClientEmployeeComms(thread)) {
    return { ok: false, error: 'Direkte Klient:innen↔Mitarbeitende-Kommunikation ist nicht erlaubt.' };
  }
  if (!canSendMessageToThread(thread.status)) {
    return { ok: false, error: 'Abgeschlossene Chats können keine neuen Nachrichten empfangen.' };
  }
  return { ok: true };
}

export function filterThreadsForPortalClient(
  threads: OfficeMessageThread[],
  clientId: string,
): OfficeMessageThread[] {
  return threads.filter(
    (t) => t.threadType === 'client_office' && t.clientId === clientId,
  );
}

export function filterThreadsForPortalEmployee(
  threads: OfficeMessageThread[],
  employeeId: string,
): OfficeMessageThread[] {
  return threads.filter(
    (t) => t.threadType === 'employee_office' && t.employeeId === employeeId,
  );
}

export function validateCreateThread(input: {
  threadType: OfficeThreadType;
  clientId?: string | null;
  employeeId?: string | null;
}): { ok: true } | { ok: false; error: string } {
  if (!isOfficeModuleThread(input.threadType)) {
    return { ok: false, error: 'Ungültiger Chat-Typ.' };
  }
  if (!assertNoDirectClientEmployeeComms({
    threadType: input.threadType,
    clientId: input.clientId ?? null,
    employeeId: input.employeeId ?? null,
  })) {
    return { ok: false, error: 'Direkte Klient:innen↔Mitarbeitende-Kommunikation ist nicht erlaubt.' };
  }
  if (input.threadType === 'client_office' && !input.clientId) {
    return { ok: false, error: 'Klient:in erforderlich.' };
  }
  if (input.threadType === 'employee_office' && !input.employeeId) {
    return { ok: false, error: 'Mitarbeiter:in erforderlich.' };
  }
  return { ok: true };
}
