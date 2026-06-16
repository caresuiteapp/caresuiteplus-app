import { describe, expect, it } from 'vitest';
import {
  assertMandateActivationAllowed,
  assertPaidStatusAllowed,
  canTransitionPaymentStatus,
  isMandateActive,
  resolveEffectivePaymentStatus,
} from '@/lib/payments/paymentStatusLogic';

describe('Payment Status Logic', () => {
  it('blockiert paid ohne Provider-Bestätigung', () => {
    expect(
      canTransitionPaymentStatus({
        currentStatus: 'processing',
        nextStatus: 'paid',
        providerConfirmedPaid: false,
      }),
    ).toBe(false);
  });

  it('erlaubt paid mit Provider-Bestätigung', () => {
    expect(
      canTransitionPaymentStatus({
        currentStatus: 'processing',
        nextStatus: 'paid',
        providerConfirmedPaid: true,
      }),
    ).toBe(true);
  });

  it('setzt paid nicht ohne Bestätigung als effektiven Status', () => {
    expect(resolveEffectivePaymentStatus('paid', false)).toBe('processing');
    expect(resolveEffectivePaymentStatus('paid', true)).toBe('paid');
  });

  it('blockiert mandate_active ohne Provider-Bestätigung', () => {
    expect(
      canTransitionPaymentStatus({
        currentStatus: 'mandate_pending',
        nextStatus: 'mandate_active',
        providerConfirmedMandate: false,
      }),
    ).toBe(false);
  });

  it('markiert SEPA-Mandat nicht aktiv ohne Provider-Bestätigung', () => {
    expect(isMandateActive('mandate_active', null)).toBe(false);
    expect(isMandateActive('mandate_active', new Date().toISOString())).toBe(true);
    expect(assertMandateActivationAllowed(null).ok).toBe(false);
  });

  it('markiert Zahlung nicht bezahlt ohne Provider-Bestätigung', () => {
    expect(assertPaidStatusAllowed(false).ok).toBe(false);
    expect(assertPaidStatusAllowed(true).ok).toBe(true);
  });
});
