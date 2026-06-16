import type { RoleKey, ServiceResult } from '@/types';
import type {
  InvoicePaymentSnapshot,
  PaymentMethodType,
  PaymentProviderKey,
  PaymentTransactionStatus,
} from '@/types/payments';
import { demoInvoices } from '@/data/demo/invoices';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import {
  assertConnectFeatureAllowed,
  buildConnectFeatureGateContextFromFeatureKey,
} from '@/lib/connect/gateway/connectFeatureGate';
import { assertPaymentActionAllowed } from './paymentGuard';
import { getDemoPaymentConfig } from './paymentProviderService';
import {
  canTransitionPaymentStatus,
  resolveEffectivePaymentStatus,
} from './paymentStatusLogic';

const DEMO_TRANSACTIONS = new Map<string, InvoicePaymentSnapshot>();

function defaultSnapshot(invoiceId: string, amountCents: number): InvoicePaymentSnapshot {
  return {
    transactionId: null,
    invoiceId,
    status: 'unpaid',
    methodType: null,
    providerKey: null,
    amountCents,
    paymentLinkPrepared: false,
    paymentLinkBlockedReason: 'Kein Zahlungsanbieter konfiguriert.',
    providerConfirmedPaid: false,
    mandateStatus: null,
    reconciliationStatus: 'none',
    dunningEligible: false,
  };
}

async function demoDelay(ms = 160): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

export async function fetchInvoicePaymentSnapshot(
  tenantId: string,
  invoiceId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<InvoicePaymentSnapshot>> {
  const denied = enforcePermission<InvoicePaymentSnapshot>(actorRoleKey, 'office.invoices.view');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  if (tenantId !== DEMO_TENANT_ID) {
    return { ok: false, error: 'Live-Rechnungszahlungen: Repository erweitern.' };
  }

  await demoDelay();
  const invoice = demoInvoices.find((inv) => inv.id === invoiceId);
  if (!invoice) return { ok: false, error: 'Rechnung nicht gefunden.' };

  const existing = DEMO_TRANSACTIONS.get(`${tenantId}:${invoiceId}`);
  if (existing) return { ok: true, data: existing };

  const config = getDemoPaymentConfig(tenantId);
  const snapshot = defaultSnapshot(invoiceId, invoice.amountCents);
  if (config?.isActive && config.providerKey !== 'none') {
    snapshot.providerKey = config.providerKey;
    snapshot.paymentLinkBlockedReason = null;
    snapshot.dunningEligible =
      invoice.status === 'in_bearbeitung' || invoice.status === 'fehlerhaft';
  }

  return { ok: true, data: snapshot };
}

export async function prepareInvoicePaymentLink(
  tenantId: string,
  invoiceId: string,
  methodType: PaymentMethodType,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<InvoicePaymentSnapshot>> {
  const denied = enforcePermission<InvoicePaymentSnapshot>(actorRoleKey, 'office.invoices.view');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  if (tenantId !== DEMO_TENANT_ID) {
    return { ok: false, error: 'Live-Zahlungslink: Repository erweitern.' };
  }

  const config = getDemoPaymentConfig(tenantId);
  const featureGate = assertConnectFeatureAllowed(
    'payments.link',
    'create_payment_link',
    buildConnectFeatureGateContextFromFeatureKey('payments.link', {
      tenantId,
      userId: actorRoleKey ?? 'demo-user',
      role: actorRoleKey ?? 'business_admin',
      featureReadiness: config?.isActive ? 'prepared' : 'coming_soon',
      integrationStatus: config?.isActive ? 'configured' : 'not_configured',
      hasCredentialReference: config?.hasCredentialReference ?? false,
      connectorStatus: config?.isActive ? 'sandbox_ready' : 'coming_soon',
      hasPaymentApproval: config?.isActive ?? false,
      hasExternalTransferConsent: config?.isActive ?? false,
    }),
  );
  if (!featureGate.allowed) {
    return { ok: false, error: featureGate.message };
  }

  const guard = assertPaymentActionAllowed({
    tenantId,
    providerKey: config?.providerKey ?? 'none',
    providerActive: config?.isActive ?? false,
    environment: config?.environment ?? 'sandbox',
    isMockProvider: true,
    demoMode: true,
    hasCredentialReference: config?.hasCredentialReference ?? false,
  });

  if (!guard.allowed) {
    return { ok: false, error: guard.message };
  }

  const invoice = demoInvoices.find((inv) => inv.id === invoiceId);
  if (!invoice) return { ok: false, error: 'Rechnung nicht gefunden.' };

  await demoDelay();
  const txId = `tx-${invoiceId.slice(0, 8)}-${Date.now()}`;
  const snapshot: InvoicePaymentSnapshot = {
    transactionId: txId,
    invoiceId,
    status: methodType === 'sepa_direct_debit' ? 'mandate_pending' : 'pending',
    methodType,
    providerKey: config!.providerKey as Exclude<PaymentProviderKey, 'none'>,
    amountCents: invoice.amountCents,
    paymentLinkPrepared: true,
    paymentLinkBlockedReason: null,
    providerConfirmedPaid: false,
    mandateStatus: methodType === 'sepa_direct_debit' ? 'mandate_pending' : null,
    reconciliationStatus: 'none',
    dunningEligible: false,
  };

  DEMO_TRANSACTIONS.set(`${tenantId}:${invoiceId}`, snapshot);
  return { ok: true, data: snapshot };
}

export async function reconcileInvoicePayment(
  tenantId: string,
  invoiceId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<InvoicePaymentSnapshot>> {
  const denied = enforcePermission<InvoicePaymentSnapshot>(actorRoleKey, 'office.invoices.view');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  if (tenantId !== DEMO_TENANT_ID) {
    return { ok: false, error: 'Live-Abgleich: Repository erweitern.' };
  }

  const key = `${tenantId}:${invoiceId}`;
  const existing = DEMO_TRANSACTIONS.get(key);
  if (!existing?.transactionId) {
    return { ok: false, error: 'Keine Zahlung zum Abgleichen — zuerst Zahlungslink vorbereiten.' };
  }

  await demoDelay();
  const updated: InvoicePaymentSnapshot = {
    ...existing,
    reconciliationStatus: 'pending',
    status: resolveEffectivePaymentStatus(existing.status, existing.providerConfirmedPaid),
  };
  DEMO_TRANSACTIONS.set(key, updated);
  return { ok: true, data: updated };
}

/** Versucht Status auf paid zu setzen — blockiert ohne Provider-Bestätigung. */
export function tryMarkPaymentPaid(
  current: InvoicePaymentSnapshot,
  providerConfirmedPaid: boolean,
): ServiceResult<InvoicePaymentSnapshot> {
  const nextStatus: PaymentTransactionStatus = 'paid';
  if (
    !canTransitionPaymentStatus({
      currentStatus: current.status,
      nextStatus,
      providerConfirmedPaid,
    })
  ) {
    return {
      ok: false,
      error: 'Zahlung kann nicht als bezahlt markiert werden ohne Provider-Bestätigung.',
    };
  }

  const updated: InvoicePaymentSnapshot = {
    ...current,
    status: nextStatus,
    providerConfirmedPaid: true,
    reconciliationStatus: 'matched',
  };
  return { ok: true, data: updated };
}

export function clearDemoPaymentTransactions(): void {
  DEMO_TRANSACTIONS.clear();
}

export { DEMO_TRANSACTIONS };
