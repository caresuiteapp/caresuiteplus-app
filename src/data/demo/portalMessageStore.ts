import type { PortalMessage } from '@/types/portal/communication';
import { demoPortalMessages } from './messages';

type MessageSeed = (typeof demoPortalMessages)[number];

let messageState: MessageSeed[] = demoPortalMessages.map((m) => ({ ...m }));

export function getMutablePortalMessages(): MessageSeed[] {
  return messageState;
}

export function markDemoPortalMessageRead(messageId: string): PortalMessage | null {
  const index = messageState.findIndex((m) => m.id === messageId);
  if (index < 0) return null;

  const now = new Date().toISOString();
  messageState[index] = {
    ...messageState[index],
    readAt: messageState[index].readAt ?? now,
    status: 'abgeschlossen',
    updatedAt: now,
  };

  return messageState[index] as PortalMessage;
}

export function appendDomainMessage(input: {
  tenantId: string;
  domain: string;
  wpNumber: number;
  audienceScope: 'office' | 'portal';
  subject: string;
  body: string;
  senderName: string;
  recipientName: string;
}): MessageSeed {
  const now = new Date().toISOString();
  const message: MessageSeed = {
    id: `msg-${input.domain}-${input.wpNumber}-${Date.now()}`,
    tenantId: input.tenantId,
    subject: input.subject,
    body: input.body,
    channel: 'portal',
    direction: 'outbound',
    senderName: input.senderName,
    recipientName: input.recipientName,
    readAt: now,
    status: 'aktiv',
    visibility: 'team',
    sensitivity: 'internal',
    audienceScope: input.audienceScope,
    ownedByProfileId: undefined,
    createdAt: now,
    updatedAt: now,
  };

  messageState = [message, ...messageState];
  return message;
}

export function replyToDemoPortalMessage(
  messageId: string,
  replyBody: string,
): PortalMessage | null {
  const original = messageState.find((m) => m.id === messageId);
  if (!original) return null;

  const now = new Date().toISOString();
  const reply: MessageSeed = {
    id: `msg-reply-${Date.now()}`,
    tenantId: original.tenantId,
    subject: `Re: ${original.subject}`,
    body: replyBody.trim(),
    channel: 'portal',
    direction: 'outbound',
    senderName: original.recipientName,
    recipientName: original.senderName,
    readAt: now,
    status: 'aktiv',
    visibility: original.visibility,
    sensitivity: original.sensitivity,
    audienceScope: 'portal',
    ownedByProfileId: original.ownedByProfileId,
    createdAt: now,
    updatedAt: now,
  };

  messageState = [reply, ...messageState];
  markDemoPortalMessageRead(messageId);
  return reply as PortalMessage;
}

export function replyToDemoOfficeMessage(
  messageId: string,
  replyBody: string,
  senderName: string,
): PortalMessage | null {
  const original = messageState.find(
    (m) => m.id === messageId && m.audienceScope === 'office',
  );
  if (!original) return null;

  const now = new Date().toISOString();
  const reply: MessageSeed = {
    id: `msg-office-reply-${Date.now()}`,
    tenantId: original.tenantId,
    subject: original.subject.startsWith('Re:') ? original.subject : `Re: ${original.subject}`,
    body: replyBody.trim(),
    channel: 'portal',
    direction: 'outbound',
    senderName,
    recipientName: original.senderName,
    readAt: now,
    status: 'aktiv',
    visibility: original.visibility,
    sensitivity: original.sensitivity,
    audienceScope: 'office',
    ownedByProfileId: original.ownedByProfileId,
    createdAt: now,
    updatedAt: now,
  };

  messageState = [reply, ...messageState];
  markDemoPortalMessageRead(messageId);
  return reply as PortalMessage;
}
