import type { ConnectCategoryKey, ConnectConnectorStatus, ConnectProviderAdapter } from '@/types/connect/gateway';
import { PREPARED_CONNECT_ADAPTERS } from './adapters/preparedAdapters';
import { BaseConnectAdapter } from './adapters/BaseConnectAdapter';

const registry = new Map<string, ConnectProviderAdapter>();

for (const adapter of PREPARED_CONNECT_ADAPTERS) {
  registry.set(adapter.providerKey, adapter);
}

export function registerConnectAdapter(adapter: ConnectProviderAdapter): void {
  registry.set(adapter.providerKey, adapter);
}

export function getConnectAdapter(providerKey: string): ConnectProviderAdapter | null {
  return registry.get(providerKey) ?? null;
}

export function getConnectAdapterOrFallback(providerKey: string): ConnectProviderAdapter {
  const existing = registry.get(providerKey);
  if (existing) return existing;

  const fallback = new (class extends BaseConnectAdapter {
    providerKey = providerKey;
    category: ConnectCategoryKey = 'marketplace';
    protected override defaultStatus: ConnectConnectorStatus = 'not_available';
    protected override allowedActions = ['test_connection'] as const;
  })();

  return fallback;
}

export function listRegisteredConnectAdapters(): ConnectProviderAdapter[] {
  return Array.from(registry.values());
}
