import { useMemo } from 'react';
import {
  getCategoryDashboardStats,
  getProviderCompliance,
  resolveConnectDisplayStatus,
  type ConnectCategoryDashboardStats,
} from '@/lib/connect/connectPresentation';
import {
  getConnectCategories,
  getConnectCategory,
  getConnectIntegration,
  getConnectProviderPlaceholders,
  getVisibleConnectIntegrations,
} from '@/lib/connect';
import { useAuth } from '@/lib/auth/context';

export function useConnectDashboard() {
  const { profile } = useAuth();
  const tenantId = profile?.tenantId ?? null;
  const placeholders = useMemo(() => getConnectProviderPlaceholders(tenantId), [tenantId]);
  const categories = useMemo(() => getConnectCategories(), []);

  const categoryStats: ConnectCategoryDashboardStats[] = useMemo(
    () => categories.map((category) => getCategoryDashboardStats(category, placeholders)),
    [categories, placeholders],
  );

  return {
    categories,
    categoryStats,
    placeholders,
    getCategoryStats: (categoryKey: string) => {
      const category = getConnectCategory(categoryKey);
      return category ? getCategoryDashboardStats(category, placeholders) : null;
    },
    getVisibleIntegrations: (categoryKey: string) => {
      const category = getConnectCategory(categoryKey);
      return category ? getVisibleConnectIntegrations(category) : [];
    },
    getIntegrationView: (categoryKey: string, integrationKey: string) => {
      const integration = getConnectIntegration(categoryKey, integrationKey);
      if (!integration) return null;
      const placeholder = placeholders.find((p) => p.integrationKey === integrationKey) ?? null;
      return {
        integration,
        placeholder,
        displayStatus: resolveConnectDisplayStatus(integration, placeholder),
        compliance: getProviderCompliance(categoryKey, integration),
      };
    },
  };
}
