import type {
  PaymentMandateStatus,
  PaymentTransactionStatus,
} from '@/types/payments';

const TERMINAL_STATUSES = new Set<PaymentTransactionStatus>([
  'paid',
  'failed',
  'refunded',
  'cancelled',
  'chargeback',
  'mandate_failed',
]);

const PAID_STATUSES = new Set<PaymentTransactionStatus>(['paid']);

const MANDATE_ACTIVE_STATUSES = new Set<PaymentMandateStatus>(['mandate_active']);

/** Erlaubte Status-Übergänge — paid nur mit Provider-Bestätigung. */
const ALLOWED_TRANSITIONS: Record<PaymentTransactionStatus, PaymentTransactionStatus[]> = {
  unpaid: ['pending', 'processing', 'cancelled', 'mandate_pending'],
  pending: ['processing', 'failed', 'cancelled', 'mandate_pending'],
  processing: ['paid', 'failed', 'disputed', 'cancelled'],
  paid: ['refunded', 'partially_refunded', 'disputed', 'chargeback'],
  failed: ['pending', 'cancelled'],
  refunded: [],
  partially_refunded: ['refunded', 'disputed'],
  disputed: ['paid', 'refunded', 'chargeback', 'cancelled'],
  cancelled: [],
  chargeback: ['refunded'],
  mandate_pending: ['mandate_active', 'mandate_failed', 'cancelled'],
  mandate_active: ['processing', 'pending', 'mandate_failed', 'cancelled'],
  mandate_failed: ['mandate_pending', 'cancelled'],
};

export type StatusTransitionInput = {
  currentStatus: PaymentTransactionStatus;
  nextStatus: PaymentTransactionStatus;
  providerConfirmedPaid?: boolean;
  providerConfirmedMandate?: boolean;
};

export function canTransitionPaymentStatus(input: StatusTransitionInput): boolean {
  const { currentStatus, nextStatus, providerConfirmedPaid, providerConfirmedMandate } = input;
  if (currentStatus === nextStatus) return true;

  const allowed = ALLOWED_TRANSITIONS[currentStatus] ?? [];
  if (!allowed.includes(nextStatus)) return false;

  if (nextStatus === 'paid' && !providerConfirmedPaid) return false;

  if (nextStatus === 'mandate_active' && !providerConfirmedMandate) return false;

  return true;
}

export function resolveEffectivePaymentStatus(
  status: PaymentTransactionStatus,
  providerConfirmedPaid: boolean,
): PaymentTransactionStatus {
  if (status === 'paid' && !providerConfirmedPaid) return 'processing';
  return status;
}

export function isTerminalPaymentStatus(status: PaymentTransactionStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

export function isPaidPaymentStatus(
  status: PaymentTransactionStatus,
  providerConfirmedPaid: boolean,
): boolean {
  return PAID_STATUSES.has(status) && providerConfirmedPaid;
}

export function isMandateActive(
  status: PaymentMandateStatus,
  providerConfirmedAt: string | null,
): boolean {
  return MANDATE_ACTIVE_STATUSES.has(status) && !!providerConfirmedAt;
}

export function assertMandateActivationAllowed(
  providerConfirmedAt: string | null,
): { ok: true } | { ok: false; reason: string } {
  if (!providerConfirmedAt) {
    return {
      ok: false,
      reason: 'SEPA-Mandat kann nicht als aktiv markiert werden ohne Provider-Bestätigung.',
    };
  }
  return { ok: true };
}

export function assertPaidStatusAllowed(
  providerConfirmedPaid: boolean,
): { ok: true } | { ok: false; reason: string } {
  if (!providerConfirmedPaid) {
    return {
      ok: false,
      reason: 'Zahlung kann nicht als bezahlt markiert werden ohne Provider-Bestätigung.',
    };
  }
  return { ok: true };
}
