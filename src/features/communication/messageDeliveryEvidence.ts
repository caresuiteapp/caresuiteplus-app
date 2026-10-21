import type { MessageStatus } from './communication.types';

export type MessageDeliveryEvidence = Readonly<{
  status: MessageStatus;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  consistent: boolean;
}>;

const time = (value: string | null): number | null => {
  if (!value) return null;
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) return null;
  const seconds = Date.parse(`${match[1]}T${match[2]}${match[4]}`);
  if (!Number.isFinite(seconds)) return null;
  const micros = Number((match[3] ?? '').padEnd(6, '0'));
  return Math.trunc(seconds / 1000) * 1_000_000 + micros;
};

/**
 * Fail-closed projection for existing rows. A timestamp never upgrades a
 * delivery state; `read` requires an ordered send/delivery/read chain.
 */
export function normalizeMessageDeliveryEvidence(input: {
  status: MessageStatus;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
}): MessageDeliveryEvidence {
  const sent = time(input.sentAt);
  const delivered = time(input.deliveredAt);
  const read = time(input.readAt);

  if (input.status === 'failed') {
    return Object.freeze({
      status: 'failed',
      sentAt: input.sentAt,
      deliveredAt: null,
      readAt: null,
      consistent: input.deliveredAt === null && input.readAt === null,
    });
  }

  if (input.status === 'read') {
    if (sent !== null && delivered !== null && read !== null && sent <= delivered && delivered <= read) {
      return Object.freeze({ ...input, consistent: true });
    }
    if (sent !== null && delivered !== null && sent <= delivered) {
      return Object.freeze({ status: 'delivered', sentAt: input.sentAt, deliveredAt: input.deliveredAt, readAt: null, consistent: false });
    }
    return Object.freeze({ status: sent === null ? 'sending' : 'sent', sentAt: input.sentAt, deliveredAt: null, readAt: null, consistent: false });
  }

  if (input.status === 'delivered') {
    if (sent !== null && delivered !== null && sent <= delivered && input.readAt === null) {
      return Object.freeze({ ...input, consistent: true });
    }
    return Object.freeze({ status: sent === null ? 'sending' : 'sent', sentAt: input.sentAt, deliveredAt: null, readAt: null, consistent: false });
  }

  if (input.status === 'sent') {
    return Object.freeze({
      status: sent === null ? 'sending' : 'sent',
      sentAt: input.sentAt,
      deliveredAt: null,
      readAt: null,
      consistent: sent !== null && input.deliveredAt === null && input.readAt === null,
    });
  }

  if (input.status === 'draft' || input.status === 'sending') {
    return Object.freeze({
      status: input.status,
      sentAt: input.sentAt,
      deliveredAt: null,
      readAt: null,
      consistent: input.deliveredAt === null && input.readAt === null,
    });
  }

  const orderedDelivery = sent !== null && delivered !== null && sent <= delivered;
  const orderedRead = orderedDelivery && read !== null && delivered <= read;
  return Object.freeze({
    status: input.status,
    sentAt: input.sentAt,
    deliveredAt: orderedDelivery ? input.deliveredAt : null,
    readAt: orderedRead ? input.readAt : null,
    consistent:
      (input.deliveredAt === null && input.readAt === null) ||
      (orderedDelivery && (input.readAt === null || orderedRead)),
  });
}

export const isMessageSecurelyRead = (evidence: MessageDeliveryEvidence): boolean =>
  evidence.consistent && evidence.status !== 'failed' && evidence.readAt !== null;
