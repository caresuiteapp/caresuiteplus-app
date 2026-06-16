import { useMemo } from 'react';
import {
  getConnectCategories,
  getConnectCategory,
  getConnectIntegration,
  getConnectProviderPlaceholders,
  getVisibleConnectIntegrations,
} from '@/lib/connect';
import { useAuth } from '@/lib/auth/context';

export function useConnectCatalog() {
  const { profile } = useAuth();
  const tenantId = profile?.tenantId ?? null;

  const categories = useMemo(() => getConnectCategories(), []);

  return {
    categories,
    getCategory: (categoryKey: string) => getConnectCategory(categoryKey),
    getIntegration: (categoryKey: string, integrationKey: string) =>
      getConnectIntegration(categoryKey, integrationKey),
    getVisibleIntegrations: (categoryKey: string) => {
      const category = getConnectCategory(categoryKey);
      return category ? getVisibleConnectIntegrations(category) : [];
    },
    getProviderPlaceholders: () => getConnectProviderPlaceholders(tenantId),
  };
}
