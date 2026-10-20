import type { IntegrationProviderListItem } from '@/types/modules/integrations';
import { PROVIDER_REGISTRY } from '@/lib/integrations/providerRegistry';
import { DEMO_TENANT_ID } from './tenant';

const BASE = '2026-06-01T10:00:00.000Z';

type IntegrationState = IntegrationProviderListItem;

let integrationStore: IntegrationState[] = PROVIDER_REGISTRY.map((p, index) => ({
  id: `int-${String(index + 1).padStart(3, '0')}`,
  tenantId: DEMO_TENANT_ID,
  providerKey: p.key,
  name: p.name,
  category: p.category,
  status: p.key === 'azure-document-intelligence' ? 'active' as const
    : p.key === 'openai' ? 'pending_setup' as const
    : p.key === 'datev' ? 'inactive' as const
    : 'pending_setup' as const,
  secretReference: p.key === 'azure-document-intelligence' ? p.secretReferenceKey : null,
  webhookUrl: p.key === 'twilio' ? 'https://api.demo.caresuiteplus.app/webhooks/twilio' : null,
  configuredAt: p.key === 'azure-document-intelligence' ? '2026-01-15T08:00:00.000Z' : null,
  lastSyncAt: p.key === 'azure-document-intelligence' ? BASE : null,
  notes: p.description,
  updatedAt: BASE,
}));

export function getDemoIntegrations(): IntegrationProviderListItem[] {
  return integrationStore.map((i) => ({ ...i }));
}

export function getDemoIntegrationById(id: string): IntegrationProviderListItem | null {
  const item = integrationStore.find((i) => i.id === id);
  return item ? { ...item } : null;
}

export function toggleDemoIntegrationStatus(id: string): IntegrationProviderListItem | null {
  const index = integrationStore.findIndex((i) => i.id === id);
  if (index < 0) return null;
  const current = integrationStore[index];
  const nextStatus =
    current.status === 'active' ? 'inactive' : current.status === 'inactive' ? 'pending_setup' : 'active';
  const def = PROVIDER_REGISTRY.find((p) => p.key === current.providerKey);
  integrationStore[index] = {
    ...current,
    status: nextStatus,
    secretReference: nextStatus === 'active' ? (def?.secretReferenceKey ?? null) : null,
    configuredAt: nextStatus === 'active' ? new Date().toISOString() : current.configuredAt,
    updatedAt: new Date().toISOString(),
  };
  return { ...integrationStore[index] };
}
