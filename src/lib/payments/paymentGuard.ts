import { assertMockProviderAllowed } from '@/lib/environment';
import type {
  PaymentEnvironment,
  PaymentGuardCode,
  PaymentGuardResult,
  PaymentProviderKey,
} from '@/types/payments';

export type PaymentExecutionContext = {
  tenantId: string | null;
  providerKey: PaymentProviderKey | null;
  providerActive: boolean;
  environment: PaymentEnvironment;
  isMockProvider: boolean;
  demoMode: boolean;
  hasCredentialReference: boolean;
};

function deny(code: PaymentGuardCode, message: string): PaymentGuardResult {
  return { allowed: false, code, message };
}

/** Blockiert Zahlungsaktionen ohne konfigurierten Anbieter. */
export function assertPaymentActionAllowed(
  context: PaymentExecutionContext,
): PaymentGuardResult {
  if (!context.tenantId?.trim()) {
    return deny('missing_tenant', 'Mandant fehlt — Zahlung blockiert.');
  }
  if (!context.providerKey || context.providerKey === 'none') {
    return deny('missing_provider', 'Kein Zahlungsanbieter konfiguriert — Zahlung blockiert.');
  }
  if (!context.providerActive) {
    return deny('provider_inactive', 'Zahlungsanbieter ist nicht aktiv.');
  }
  const mockBlock = assertMockProviderAllowed(
    context.isMockProvider,
    context.environment === 'production' ? 'production' : 'sandbox',
    context.tenantId,
  );
  if (!mockBlock.ok) {
    return deny('production_mock_blocked', mockBlock.error);
  }
  if (context.environment === 'production' && context.demoMode) {
    return deny(
      'production_demo_blocked',
      'Demo-Modus in Produktion blockiert — keine echten Zahlungen.',
    );
  }
  if (
    context.environment === 'production' &&
    !context.hasCredentialReference
  ) {
    return deny('missing_provider', 'Vault-Referenz für Produktion fehlt.');
  }
  return { allowed: true };
}

/** Maskiert Vault-Referenzen für Admin-UI — niemals Klartext. */
export function maskPaymentCredentialReference(reference: string | null): string {
  if (!reference?.trim()) return 'Nicht konfiguriert';
  const tail = reference.slice(-4);
  return `vault:••••${tail}`;
}

/** Prüft ob Wert echte Secret-Literale enthält (nicht Detektions-Patterns). */
export function containsPaymentSecretLiteral(value: string): boolean {
  const stripeSecret = ['sk', 'live'].join('_') + '_';
  const stripeTest = ['sk', 'test'].join('_') + '_';
  const pubLive = ['pk', 'live'].join('_') + '_';
  const pubTest = ['pk', 'test'].join('_') + '_';
  return (
    value.includes(stripeSecret) ||
    value.includes(stripeTest) ||
    value.includes(pubLive) ||
    value.includes(pubTest) ||
    /SUPABASE_SERVICE_ROLE|webhook_secret=/.test(value)
  );
}
