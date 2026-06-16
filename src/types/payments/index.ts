/** Zahlungsanbieter — Vorbereitung, keine Live-Zahlungen. */
export type PaymentProviderKey = 'stripe' | 'mollie' | 'gocardless' | 'paypal' | 'none';

export type PaymentEnvironment = 'sandbox' | 'production';

export type PaymentMethodType =
  | 'invoice'
  | 'sepa_direct_debit'
  | 'credit_card'
  | 'paypal'
  | 'subscription'
  | 'one_time';

export type PaymentTransactionStatus =
  | 'unpaid'
  | 'pending'
  | 'processing'
  | 'paid'
  | 'failed'
  | 'refunded'
  | 'partially_refunded'
  | 'disputed'
  | 'cancelled'
  | 'chargeback'
  | 'mandate_pending'
  | 'mandate_active'
  | 'mandate_failed';

export type PaymentMandateStatus =
  | 'mandate_pending'
  | 'mandate_active'
  | 'mandate_failed'
  | 'cancelled'
  | 'expired';

export type PaymentWebhookStatus =
  | 'not_configured'
  | 'pending'
  | 'verified'
  | 'failed'
  | 'disabled';

export type PaymentWebhookProcessingStatus =
  | 'received'
  | 'processing'
  | 'processed'
  | 'rejected'
  | 'failed'
  | 'duplicate';

export type PaymentGuardCode =
  | 'missing_tenant'
  | 'missing_provider'
  | 'provider_inactive'
  | 'production_mock_blocked'
  | 'production_demo_blocked'
  | 'mandate_not_confirmed'
  | 'payment_not_confirmed'
  | 'webhook_signature_missing'
  | 'webhook_signature_invalid'
  | 'webhook_replay'
  | 'webhook_duplicate'
  | 'action_blocked';

export type PaymentGuardResult =
  | { allowed: true }
  | { allowed: false; code: PaymentGuardCode; message: string };

export type PaymentProviderConfig = {
  id: string;
  tenantId: string;
  providerKey: PaymentProviderKey;
  environment: PaymentEnvironment;
  isActive: boolean;
  sepaEnabled: boolean;
  subscriptionBillingEnabled: boolean;
  webhookStatus: PaymentWebhookStatus;
  webhookLastReceivedAt: string | null;
  webhookLastError: string | null;
  hasCredentialReference: boolean;
  configuredAt: string | null;
};

export type InvoicePaymentSnapshot = {
  transactionId: string | null;
  invoiceId: string;
  status: PaymentTransactionStatus;
  methodType: PaymentMethodType | null;
  providerKey: PaymentProviderKey | null;
  amountCents: number;
  paymentLinkPrepared: boolean;
  paymentLinkBlockedReason: string | null;
  providerConfirmedPaid: boolean;
  mandateStatus: PaymentMandateStatus | null;
  reconciliationStatus: 'none' | 'pending' | 'matched' | 'partial';
  dunningEligible: boolean;
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethodType, string> = {
  invoice: 'Rechnung',
  sepa_direct_debit: 'SEPA-Lastschrift',
  credit_card: 'Kreditkarte',
  paypal: 'PayPal',
  subscription: 'Abo-Zahlung',
  one_time: 'Einmalzahlung',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentTransactionStatus, string> = {
  unpaid: 'Unbezahlt',
  pending: 'Ausstehend',
  processing: 'In Verarbeitung',
  paid: 'Bezahlt',
  failed: 'Fehlgeschlagen',
  refunded: 'Erstattet',
  partially_refunded: 'Teilweise erstattet',
  disputed: 'Angefochten',
  cancelled: 'Storniert',
  chargeback: 'Rückbuchung',
  mandate_pending: 'Mandat ausstehend',
  mandate_active: 'Mandat aktiv',
  mandate_failed: 'Mandat fehlgeschlagen',
};

export const PAYMENT_PROVIDER_LABELS: Record<PaymentProviderKey, string> = {
  stripe: 'Stripe',
  mollie: 'Mollie',
  gocardless: 'GoCardless',
  paypal: 'PayPal',
  none: 'Kein Anbieter',
};

export const SELECTABLE_PAYMENT_PROVIDERS: Exclude<PaymentProviderKey, 'none'>[] = [
  'stripe',
  'mollie',
  'gocardless',
  'paypal',
];
