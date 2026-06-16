import type {
  PaymentGuardCode,
  PaymentGuardResult,
  PaymentProviderKey,
  PaymentWebhookProcessingStatus,
} from '@/types/payments';

const REPLAY_WINDOW_MS = 5 * 60 * 1000;
const MAX_WEBHOOK_AGE_MS = 24 * 60 * 60 * 1000;

export type PaymentWebhookInput = {
  providerKey: PaymentProviderKey;
  eventType: string;
  externalEventId: string | null;
  signatureHeader: string | null;
  payloadRaw: string;
  receivedAtMs: number;
  expectedSignaturePrefix?: string;
  knownEventIds?: Set<string>;
};

export type PaymentWebhookGuardResult =
  | { accepted: true; payloadHash: string; processingStatus: PaymentWebhookProcessingStatus }
  | { accepted: false; code: PaymentGuardCode; message: string; processingStatus: PaymentWebhookProcessingStatus };

function denyWebhook(
  code: PaymentGuardCode,
  message: string,
  processingStatus: PaymentWebhookProcessingStatus,
): PaymentWebhookGuardResult {
  return { accepted: false, code, message, processingStatus };
}

/** Einfacher Hash für Payload-Protokollierung — kein Klartext-Speichern. */
export function hashWebhookPayload(payload: string): string {
  let hash = 0;
  for (let i = 0; i < payload.length; i++) {
    hash = (hash << 5) - hash + payload.charCodeAt(i);
    hash |= 0;
  }
  return `h${Math.abs(hash).toString(16)}`;
}

/**
 * Webhook-Sicherheit (vorbereitet, nicht live):
 * - Signatur erforderlich
 * - Idempotenz via externalEventId
 * - Replay-Schutz via Zeitfenster
 * - Payload wird nicht blind vertraut
 */
export function validatePaymentWebhook(input: PaymentWebhookInput): PaymentWebhookGuardResult {
  const payloadHash = hashWebhookPayload(input.payloadRaw);

  if (!input.signatureHeader?.trim()) {
    return denyWebhook(
      'webhook_signature_missing',
      'Webhook ohne Signatur abgelehnt.',
      'rejected',
    );
  }

  const prefix = input.expectedSignaturePrefix ?? 'whsec_prepared_';
  if (!input.signatureHeader.startsWith(prefix)) {
    return denyWebhook(
      'webhook_signature_invalid',
      'Webhook-Signatur ungültig.',
      'rejected',
    );
  }

  if (input.externalEventId && input.knownEventIds?.has(input.externalEventId)) {
    return denyWebhook(
      'webhook_duplicate',
      'Webhook bereits verarbeitet (Idempotenz).',
      'duplicate',
    );
  }

  const ageMs = Date.now() - input.receivedAtMs;
  if (ageMs > MAX_WEBHOOK_AGE_MS) {
    return denyWebhook(
      'webhook_replay',
      'Webhook zu alt — Replay-Schutz.',
      'rejected',
    );
  }

  if (ageMs < -REPLAY_WINDOW_MS) {
    return denyWebhook(
      'webhook_replay',
      'Webhook-Zeitstempel in der Zukunft — abgelehnt.',
      'rejected',
    );
  }

  if (!input.eventType?.trim()) {
    return denyWebhook('action_blocked', 'Webhook ohne Event-Typ abgelehnt.', 'rejected');
  }

  return { accepted: true, payloadHash, processingStatus: 'received' };
}

/** Leitet aus Webhook-Event KEINEN paid-Status ab — nur explizite Provider-Bestätigung. */
export function deriveStatusFromWebhookEvent(
  eventType: string,
  providerConfirmedPaid: boolean,
): 'processing' | 'paid' | 'failed' | 'mandate_active' | 'mandate_pending' {
  if (eventType.includes('payment_succeeded') || eventType.includes('charge.succeeded')) {
    return providerConfirmedPaid ? 'paid' : 'processing';
  }
  if (eventType.includes('payment_failed') || eventType.includes('charge.failed')) {
    return 'failed';
  }
  if (eventType.includes('mandate_active') || eventType.includes('mandate.activated')) {
    return 'mandate_active';
  }
  if (eventType.includes('mandate_pending') || eventType.includes('mandate.created')) {
    return 'mandate_pending';
  }
  return 'processing';
}
