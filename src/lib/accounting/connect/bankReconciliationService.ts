import type { ServiceResult } from '@/types';
import type { PaymentMatchingSuggestion } from '@/types/connect/accounting';
import { guardLiveDemoFeature } from '@/lib/services/liveServiceGuard';
import { appendAccountingConnectAudit } from './accountingExportService';
import {
  listBankTransactions,
  listPaymentSuggestions,
  savePaymentSuggestion,
  updateBankTransaction,
  updatePaymentSuggestion,
} from './accountingConnectStore';

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export type SuggestPaymentMatchInput = {
  tenantId: string;
  bankTransactionId: string;
  invoiceId: string;
  confidenceScore?: number;
};

export function suggestPaymentMatch(
  input: SuggestPaymentMatchInput,
): ServiceResult<PaymentMatchingSuggestion> {
  const liveBlock = guardLiveDemoFeature<PaymentMatchingSuggestion>(
    input.tenantId,
    'Zahlungsabgleich',
  );
  if (liveBlock) return liveBlock;

  const tx = listBankTransactions(input.tenantId).find((row) => row.id === input.bankTransactionId);
  if (!tx) {
    return { ok: false, error: 'Bankbuchung nicht gefunden.' };
  }

  const now = new Date().toISOString();
  const suggestion: PaymentMatchingSuggestion = {
    id: newId('match'),
    tenantId: input.tenantId,
    bankTransactionId: input.bankTransactionId,
    invoiceId: input.invoiceId,
    confidenceScore: input.confidenceScore ?? 0.85,
    status: 'prepared',
    requiresReceipt: true,
    receiptReference: null,
    errorMessage: null,
    createdAt: now,
    updatedAt: now,
  };

  savePaymentSuggestion(input.tenantId, suggestion);
  updateBankTransaction(input.tenantId, input.bankTransactionId, { matchStatus: 'suggested' });
  appendAccountingConnectAudit(
    input.tenantId,
    'payment_match_suggested',
    `Abgleichsvorschlag Rechnung ${input.invoiceId} — Bestätigung erfordert Zahlungsbeleg.`,
    { invoiceId: input.invoiceId, importId: tx.importId },
  );

  return { ok: true, data: suggestion };
}

export type ConfirmPaymentMatchInput = {
  tenantId: string;
  suggestionId: string;
  receiptReference?: string | null;
};

/**
 * Bestätigt keinen Zahlungseingang als „bezahlt" ohne Belegreferenz.
 * Setzt höchstens reconciled_prepared / accepted_prepared — nie accountingStatus bezahlt.
 */
export function confirmPaymentMatchPrepared(
  input: ConfirmPaymentMatchInput,
): ServiceResult<PaymentMatchingSuggestion> {
  const liveBlock = guardLiveDemoFeature<PaymentMatchingSuggestion>(
    input.tenantId,
    'Zahlungsbestätigung',
  );
  if (liveBlock) return liveBlock;

  const suggestion = listPaymentSuggestions(input.tenantId).find((row) => row.id === input.suggestionId);
  if (!suggestion) {
    return { ok: false, error: 'Abgleichsvorschlag nicht gefunden.' };
  }

  if (!input.receiptReference?.trim()) {
    const message =
      'Zahlungsbestätigung blockiert — Zahlungsbeleg (Quittung, Kontoauszug-Referenz) erforderlich.';
    updatePaymentSuggestion(input.tenantId, input.suggestionId, {
      status: 'blocked',
      errorMessage: message,
    });
    updateBankTransaction(input.tenantId, suggestion.bankTransactionId, {
      matchStatus: 'confirmed_blocked',
    });
    appendAccountingConnectAudit(input.tenantId, 'payment_confirm_blocked', message, {
      invoiceId: suggestion.invoiceId,
    });
    appendAccountingConnectAudit(input.tenantId, 'error_logged', message, {
      invoiceId: suggestion.invoiceId,
    });
    return { ok: false, error: message };
  }

  const updated = updatePaymentSuggestion(input.tenantId, input.suggestionId, {
    status: 'accepted_prepared',
    receiptReference: input.receiptReference.trim(),
    errorMessage: null,
  });
  if (!updated) {
    return { ok: false, error: 'Abgleichsvorschlag konnte nicht aktualisiert werden.' };
  }

  updateBankTransaction(input.tenantId, suggestion.bankTransactionId, {
    matchStatus: 'reconciled_prepared',
  });

  appendAccountingConnectAudit(
    input.tenantId,
    'bank_reconciliation_prepared',
    `Bankabgleich vorbereitet mit Beleg ${input.receiptReference.trim()} — Rechnung bleibt nicht automatisch „bezahlt".`,
    { invoiceId: suggestion.invoiceId },
  );

  return { ok: true, data: updated };
}

export function listTenantPaymentSuggestions(tenantId: string): PaymentMatchingSuggestion[] {
  return listPaymentSuggestions(tenantId);
}

export function listTenantBankTransactions(tenantId: string, importId?: string) {
  return listBankTransactions(tenantId, importId);
}
