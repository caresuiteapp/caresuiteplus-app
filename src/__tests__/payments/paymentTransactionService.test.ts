import { beforeEach, describe, expect, it } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { demoInvoices } from '@/data/demo/invoices';
import {
  clearDemoPaymentTransactions,
  fetchInvoicePaymentSnapshot,
  prepareInvoicePaymentLink,
  savePaymentSettings,
  tryMarkPaymentPaid,
} from '@/lib/payments';

describe('Payment Transaction Service', () => {
  beforeEach(() => {
    clearDemoPaymentTransactions();
  });

  it('blockiert Zahlungslink ohne Provider', async () => {
    const invoiceId = demoInvoices[0]!.id;
    const result = await prepareInvoicePaymentLink(
      DEMO_TENANT_ID,
      invoiceId,
      'one_time',
      'business_admin',
    );
    expect(result.ok).toBe(false);
  });

  it('bereitet Zahlungslink nach Provider-Konfiguration vor', async () => {
    await savePaymentSettings(
      DEMO_TENANT_ID,
      {
        providerKey: 'stripe',
        environment: 'sandbox',
        sepaEnabled: false,
        subscriptionBillingEnabled: false,
      },
      'business_admin',
    );
    const invoiceId = demoInvoices[0]!.id;
    const result = await prepareInvoicePaymentLink(
      DEMO_TENANT_ID,
      invoiceId,
      'one_time',
      'business_admin',
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.paymentLinkPrepared).toBe(true);
      expect(result.data.providerConfirmedPaid).toBe(false);
    }
  });

  it('setzt Status nicht fälschlich auf paid', () => {
    const snapshot = {
      transactionId: 'tx-1',
      invoiceId: 'inv-1',
      status: 'processing' as const,
      methodType: 'one_time' as const,
      providerKey: 'stripe' as const,
      amountCents: 1000,
      paymentLinkPrepared: true,
      paymentLinkBlockedReason: null,
      providerConfirmedPaid: false,
      mandateStatus: null,
      reconciliationStatus: 'none' as const,
      dunningEligible: false,
    };
    const result = tryMarkPaymentPaid(snapshot, false);
    expect(result.ok).toBe(false);
  });

  it('isolates tenant data in demo snapshot fetch', async () => {
    const invoiceId = demoInvoices[0]!.id;
    const otherTenant = '00000000-0000-0000-0000-000000000099';
    const result = await fetchInvoicePaymentSnapshot(otherTenant, invoiceId, 'business_admin');
    expect(result.ok).toBe(false);
  });
});
