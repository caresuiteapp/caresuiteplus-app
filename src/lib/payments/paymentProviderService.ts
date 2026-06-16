import type { RoleKey, ServiceResult } from '@/types';
import type {
  PaymentEnvironment,
  PaymentProviderConfig,
  PaymentProviderKey,
  PaymentWebhookStatus,
} from '@/types/payments';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { assertPaymentActionAllowed, maskPaymentCredentialReference } from './paymentGuard';

export type PaymentSettingsForm = {
  providerKey: PaymentProviderKey;
  environment: PaymentEnvironment;
  sepaEnabled: boolean;
  subscriptionBillingEnabled: boolean;
};

export type PaymentSettingsSnapshot = {
  activeConfig: PaymentProviderConfig | null;
  availableProviders: PaymentProviderKey[];
  testModeNotice: string;
  credentialMasked: string;
};

const DEMO_CONFIGS: Record<string, PaymentProviderConfig> = {};

function buildDemoConfig(
  tenantId: string,
  form: PaymentSettingsForm,
): PaymentProviderConfig {
  const id = `paycfg-${form.providerKey}-${tenantId.slice(0, 8)}`;
  return {
    id,
    tenantId,
    providerKey: form.providerKey,
    environment: form.environment,
    isActive: form.providerKey !== 'none',
    sepaEnabled: form.sepaEnabled,
    subscriptionBillingEnabled: form.subscriptionBillingEnabled,
    webhookStatus: form.providerKey === 'none' ? 'not_configured' : 'pending',
    webhookLastReceivedAt: null,
    webhookLastError: null,
    hasCredentialReference: form.providerKey !== 'none' && form.environment === 'sandbox',
    configuredAt: new Date().toISOString(),
  };
}

async function demoDelay(ms = 180): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

export async function fetchPaymentSettings(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<PaymentSettingsSnapshot>> {
  const denied = enforcePermission<PaymentSettingsSnapshot>(actorRoleKey, 'connect.configure');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  if (tenantId !== DEMO_TENANT_ID) {
    return { ok: false, error: 'Live-Zahlungseinstellungen: Repository erweitern.' };
  }
  await demoDelay();

  const activeConfig = DEMO_CONFIGS[tenantId] ?? {
    id: 'paycfg-default',
    tenantId,
    providerKey: 'none' as const,
    environment: 'sandbox' as const,
    isActive: false,
    sepaEnabled: false,
    subscriptionBillingEnabled: false,
    webhookStatus: 'not_configured' as PaymentWebhookStatus,
    webhookLastReceivedAt: null,
    webhookLastError: null,
    hasCredentialReference: false,
    configuredAt: null,
  };

  return {
    ok: true,
    data: {
      activeConfig,
      availableProviders: ['stripe', 'mollie', 'gocardless', 'paypal', 'none'],
      testModeNotice:
        'Testmodus — keine echten Zahlungen. Provider-Aufrufe sind blockiert bis zur Freigabe.',
      credentialMasked: maskPaymentCredentialReference(
        activeConfig.hasCredentialReference ? `vault/payments/${tenantId}/${activeConfig.providerKey}` : null,
      ),
    },
  };
}

export async function savePaymentSettings(
  tenantId: string,
  form: PaymentSettingsForm,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<PaymentProviderConfig>> {
  const denied = enforcePermission<PaymentProviderConfig>(actorRoleKey, 'connect.configure');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  if (tenantId !== DEMO_TENANT_ID) {
    return { ok: false, error: 'Live-Zahlungseinstellungen: Repository erweitern.' };
  }

  const guard = assertPaymentActionAllowed({
    tenantId,
    providerKey: form.providerKey,
    providerActive: form.providerKey !== 'none',
    environment: form.environment,
    isMockProvider: true,
    demoMode: true,
    hasCredentialReference: form.providerKey !== 'none',
  });

  if (form.providerKey !== 'none' && !guard.allowed && guard.code !== 'production_mock_blocked') {
    // Sandbox demo erlaubt Mock; Production blockiert separat
    if (form.environment === 'production') {
      return { ok: false, error: guard.message };
    }
  }

  if (form.environment === 'production') {
    return {
      ok: false,
      error: 'Produktionsmodus blockiert — Mock-Provider nicht für echte Zahlungen freigegeben.',
    };
  }

  await demoDelay();
  const config = buildDemoConfig(tenantId, form);
  DEMO_CONFIGS[tenantId] = config;
  return { ok: true, data: config };
}

export function getDemoPaymentConfig(tenantId: string): PaymentProviderConfig | null {
  return DEMO_CONFIGS[tenantId] ?? null;
}

export { maskPaymentCredentialReference };
