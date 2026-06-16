import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import type { ConnectProviderPlaceholder } from '@/types/modules/connect';
import { getAllConnectIntegrations } from './connectCatalog';

export function getConnectProviderPlaceholders(tenantId: string | null | undefined): ConnectProviderPlaceholder[] {
  const resolvedTenantId = tenantId?.trim() || DEMO_TENANT_ID;
  const providerIntegrations = getAllConnectIntegrations().filter((item) => item.requiresProvider);

  return providerIntegrations.map((item, index) => ({
    id: `connect-provider-${item.key}`,
    tenantId: resolvedTenantId,
    integrationKey: item.key,
    label: item.label,
    status: 'not_configured' as const,
    vaultReference: null,
    updatedAt: new Date(Date.UTC(2026, 0, 15 + (index % 10), 10, 0, 0)).toISOString(),
  }));
}
