import { buildCommunicationDemoData, type CommunicationDemoBundle } from './communication.demoData';
import type {
  CommunicationAttachment,
  CommunicationAuditEvent,
  CommunicationMessage,
  CommunicationNotification,
  CommunicationParticipant,
  CommunicationSettings,
  CommunicationThread,
  MessageAssignment,
  MessageReaction,
} from './communication.types';

let store: CommunicationDemoBundle | null = null;

function clone<T>(value: T): T {
  return structuredClone(value);
}

export function getCommunicationDemoStore(): CommunicationDemoBundle {
  if (!store) {
    store = buildCommunicationDemoData();
  }
  return store;
}

export function resetCommunicationDemoStore(): void {
  store = buildCommunicationDemoData();
}

export function getDemoThreads(): CommunicationThread[] {
  return getCommunicationDemoStore().threads;
}

export function getDemoMessages(): CommunicationMessage[] {
  return getCommunicationDemoStore().messages;
}

export function getDemoParticipants(): CommunicationParticipant[] {
  return getCommunicationDemoStore().participants;
}

export function getDemoAttachments(): CommunicationAttachment[] {
  return getCommunicationDemoStore().attachments;
}

export function getDemoReactions(): MessageReaction[] {
  return getCommunicationDemoStore().reactions;
}

export function getDemoAssignments(): MessageAssignment[] {
  return getCommunicationDemoStore().assignments;
}

export function getDemoNotifications(): CommunicationNotification[] {
  return getCommunicationDemoStore().notifications;
}

export function getDemoAuditEvents(): CommunicationAuditEvent[] {
  return getCommunicationDemoStore().auditEvents;
}

export function getDemoCommunicationSettings(): CommunicationSettings {
  return getCommunicationDemoStore().settings;
}

export function appendDemoMessage(message: CommunicationMessage): CommunicationMessage {
  getDemoMessages().push(message);
  return message;
}

export function appendDemoThread(thread: CommunicationThread): CommunicationThread {
  getDemoThreads().push(thread);
  return thread;
}

export function appendDemoAudit(event: CommunicationAuditEvent): void {
  getDemoAuditEvents().push(event);
}

export function appendDemoNotification(notification: CommunicationNotification): void {
  getDemoNotifications().push(notification);
}

export function appendDemoReaction(reaction: MessageReaction): MessageReaction {
  getDemoReactions().push(reaction);
  return reaction;
}

export function appendDemoAssignment(assignment: MessageAssignment): MessageAssignment {
  getDemoAssignments().push(assignment);
  return assignment;
}

export function appendDemoAttachment(attachment: CommunicationAttachment): CommunicationAttachment {
  getDemoAttachments().push(attachment);
  return attachment;
}

export function snapshotDemoStore(): CommunicationDemoBundle {
  return clone(getCommunicationDemoStore());
}
