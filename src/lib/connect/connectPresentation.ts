import type { ConnectCategory, ConnectIntegration, ConnectReadiness } from '@/types/modules/connect';
import type { ConnectProviderPlaceholder } from '@/types/modules/connect';
import { getConnectUserFacingComingSoonText } from './connectRoadmap';
import { isConnectIntegrationExecutable } from './connectMessages';

/** Anzeige-Status für Connect-UI (kein Fake „verbunden“). */
export type ConnectDisplayStatus =
  | 'not_configured'
  | 'coming_soon'
  | 'sandbox'
  | 'production'
  | 'disabled'
  | 'error';

export const CONNECT_DISPLAY_STATUS_LABELS: Record<ConnectDisplayStatus, string> = {
  not_configured: 'Nicht konfiguriert',
  coming_soon: 'Vorbereitet – noch nicht produktiv verfügbar',
  sandbox: 'Sandbox aktiv – keine Produktivdaten verwenden',
  production: 'Produktiv aktiv',
  disabled: 'Deaktiviert',
  error: 'Fehlerhafte Verbindung',
};

export type ConnectProviderCompliance = {
  supportsSandbox: boolean;
  supportsProduction: boolean;
  requiresAvv: boolean;
  requiresContract: boolean;
  mayTransferHealthData: boolean;
};

export type ConnectCategoryDashboardStats = {
  categoryKey: string;
  totalProviders: number;
  visibleProviders: number;
  activatedProviders: number;
  warningCount: number;
  lastSyncLabel: string;
  displayStatus: ConnectDisplayStatus;
};

const HEALTH_CATEGORIES = new Set(['ti_kim', 'medical_data', 'pflege']);
const CONTRACT_CATEGORIES = new Set(['billing', 'accounting', 'payments', 'ti_kim']);

export function getProviderCompliance(
  categoryKey: string,
  integration: ConnectIntegration,
): ConnectProviderCompliance {
  const health =
    HEALTH_CATEGORIES.has(categoryKey) ||
    integration.key.includes('kim') ||
    integration.key.includes('epa') ||
    integration.key.includes('icd');
  return {
    supportsSandbox: integration.readiness !== 'disabled',
    supportsProduction: false,
    requiresAvv: health || CONTRACT_CATEGORIES.has(categoryKey),
    requiresContract: CONTRACT_CATEGORIES.has(categoryKey) && integration.requiresProvider,
    mayTransferHealthData: health,
  };
}

export function resolveConnectDisplayStatus(
  integration: ConnectIntegration,
  placeholder?: ConnectProviderPlaceholder | null,
): ConnectDisplayStatus {
  if (integration.readiness === 'disabled') return 'disabled';
  if (placeholder?.status === 'placeholder') {
    return 'sandbox';
  }
  if (integration.readiness === 'coming_soon') return 'coming_soon';
  if (integration.readiness === 'internal') return 'coming_soon';
  return 'not_configured';
}

export function isConnectDisplayedAsActive(status: ConnectDisplayStatus): boolean {
  return status === 'sandbox' || status === 'production';
}

export function canActivateConnectIntegration(
  integration: ConnectIntegration,
  canConfigure: boolean,
): boolean {
  if (!canConfigure) return false;
  if (integration.readiness === 'disabled' || integration.readiness === 'coming_soon') return false;
  if (!isConnectIntegrationExecutable(integration)) return false;
  return integration.readiness === 'prepared' || integration.readiness === 'beta';
}

export function getCategoryDashboardStats(
  category: ConnectCategory,
  placeholders: ConnectProviderPlaceholder[],
): ConnectCategoryDashboardStats {
  const visible = category.integrations.filter((i) => i.readiness !== 'disabled');
  const categoryPlaceholders = placeholders.filter((p) =>
    visible.some((i) => i.key === p.integrationKey),
  );
  const activated = categoryPlaceholders.filter((p) => p.status !== 'not_configured').length;
  let warningCount = 0;
  for (const integration of visible) {
    const compliance = getProviderCompliance(category.key, integration);
    const status = resolveConnectDisplayStatus(integration);
    if (compliance.mayTransferHealthData) warningCount += 1;
    if (compliance.requiresAvv && status === 'not_configured') warningCount += 1;
    if (integration.readiness === 'coming_soon') warningCount += 1;
  }

  const displayStatus: ConnectDisplayStatus =
    category.readiness === 'disabled'
      ? 'disabled'
      : category.readiness === 'coming_soon'
        ? 'coming_soon'
        : activated > 0
          ? 'sandbox'
          : 'not_configured';

  return {
    categoryKey: category.key,
    totalProviders: category.integrations.length,
    visibleProviders: visible.length,
    activatedProviders: activated,
    warningCount,
    lastSyncLabel: 'Keine Synchronisation',
    displayStatus,
  };
}

export function readinessToDisplayHint(readiness: ConnectReadiness): string {
  if (readiness === 'coming_soon') return CONNECT_DISPLAY_STATUS_LABELS.coming_soon;
  if (readiness === 'disabled') return CONNECT_DISPLAY_STATUS_LABELS.disabled;
  return CONNECT_DISPLAY_STATUS_LABELS.not_configured;
}

/** Sales-freundlicher, ehrlicher Hinweis für Endnutzer — ohne Admin-Roadmap-Details. */
export function getConnectUserDisplayHint(
  categoryKey: string,
  integration: ConnectIntegration,
): string {
  if (integration.readiness === 'disabled') {
    return CONNECT_DISPLAY_STATUS_LABELS.disabled;
  }
  return getConnectUserFacingComingSoonText(categoryKey, integration);
}
