import { describe, expect, it } from 'vitest';
import { validatePaymentWebhook } from '@/lib/payments/paymentWebhookGuard';

describe('Payment Webhook Guard', () => {
  const baseInput = {
    providerKey: 'stripe' as const,
    eventType: 'payment_intent.succeeded',
    externalEventId: 'evt_001',
    payloadRaw: '{"type":"payment_intent.succeeded","id":"evt_001"}',
    receivedAtMs: Date.now(),
    expectedSignaturePrefix: 'whsec_prepared_',
    knownEventIds: new Set<string>(),
  };

  it('lehnt Webhook ohne Signatur ab', () => {
    const result = validatePaymentWebhook({ ...baseInput, signatureHeader: null });
    expect(result.accepted).toBe(false);
    if (!result.accepted) expect(result.code).toBe('webhook_signature_missing');
  });

  it('lehnt ungültige Signatur ab', () => {
    const result = validatePaymentWebhook({ ...baseInput, signatureHeader: 'invalid_sig' });
    expect(result.accepted).toBe(false);
    if (!result.accepted) expect(result.code).toBe('webhook_signature_invalid');
  });

  it('akzeptiert gültige Signatur mit Hash', () => {
    const result = validatePaymentWebhook({
      ...baseInput,
      signatureHeader: 'whsec_prepared_test123',
    });
    expect(result.accepted).toBe(true);
    if (result.accepted) expect(result.payloadHash).toMatch(/^h/);
  });

  it('erkennt Duplikate (Idempotenz)', () => {
    const known = new Set(['evt_001']);
    const result = validatePaymentWebhook({
      ...baseInput,
      signatureHeader: 'whsec_prepared_test123',
      knownEventIds: known,
    });
    expect(result.accepted).toBe(false);
    if (!result.accepted) expect(result.code).toBe('webhook_duplicate');
  });
});
