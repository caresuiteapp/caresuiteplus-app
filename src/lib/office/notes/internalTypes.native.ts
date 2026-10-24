// Generated native presentation from src/lib/office/notes/internalTypes.web.ts. Update through scripts/port-native-workspaces.mjs.
import type { NotesActor, NotesResult } from "./types.native.ts";
export type InternalNoteKind = 'note' | 'task' | 'conversation' | 'callback' | 'request';
export type InternalNotePriority = 'normal' | 'high';
export type InternalDeliveryStatus = 'open' | 'in_progress' | 'done';
export type InternalNoteBox = 'sent' | 'inbox';
export type InternalNoteActor = NotesActor & {
    employeeId?: string | null;
    readOnly?: boolean;
};
export type InternalNoteResult<T> = NotesResult<T>;
export type InternalNoteDraft = {
    kind: InternalNoteKind;
    priority: InternalNotePriority;
    title: string;
    body: string;
    dueDate: string;
    recipientEmployeeIds: string[];
};
export type InternalRecipient = {
    employeeId: string;
    displayName: string;
};
export type InternalDelivery = {
    id: string;
    employeeId: string;
    recipientUserId: string;
    displayName: string;
    status: InternalDeliveryStatus;
    readAt: string | null;
    updatedAt: string;
    revision: number;
    response: string;
};
export type InternalNote = {
    id: string;
    tenantId: string;
    senderUserId: string;
    senderName: string;
    kind: InternalNoteKind;
    priority: InternalNotePriority;
    title: string;
    body: string;
    dueDate: string;
    createdAt: string;
    recipients: InternalDelivery[];
};
export type InternalNoteSendReceipt = {
    dispatchId: string;
    createdAt: string;
};
export type InternalPendingNoteSend = {
    requestId: string;
    draft: InternalNoteDraft;
};
export type InternalDeliveryOperation = {
    deliveryId: string;
    employeeId: string;
    expectedRevision: number;
    action: 'read' | 'status';
    status?: InternalDeliveryStatus;
    /** Omitted preserves the previous response; an empty string clears it. */
    response?: string;
};
