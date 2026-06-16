import type {
  BillingProviderConfig,
  ConnectBillingProviderKey,
  ConnectBillingProviderStatus,
} from '@/types/connect/billing';
import {
  CONNECT_BILLING_PROVIDER_LABELS,
  CONNECT_BILLING_PROVIDER_STATUS_LABELS,
} from '@/types/connect/billing';

export type BillingProviderDefinition = {
  key: ConnectBillingProviderKey;
  defaultStatus: ConnectBillingProviderStatus;
  exportCapable: boolean;
  apiPlanned: boolean;
  description: string;
};

export const BILLING_PROVIDER_DEFINITIONS: BillingProviderDefinition[] = [
  {
    key: 'opta_data',
    defaultStatus: 'vorbereitet',
    exportCapable: true,
    apiPlanned: true,
    description: 'opta data — vorbereitet, nicht konfiguriert.',
  },
  {
    key: 'dmrz',
    defaultStatus: 'vorbereitet',
    exportCapable: true,
    apiPlanned: true,
    description: 'DMRZ — vorbereitet, Export möglich nach Konfiguration.',
  },
  {
    key: 'rzh',
    defaultStatus: 'vorbereitet',
    exportCapable: true,
    apiPlanned: true,
    description: 'RZH — vorbereitet, API später.',
  },
  {
    key: 'davaso',
    defaultStatus: 'vorbereitet',
    exportCapable: true,
    apiPlanned: true,
    description: 'DAVASO — vorbereitet, nicht konfiguriert.',
  },
  {
    key: 'generic_export',
    defaultStatus: 'export_moeglich',
    exportCapable: true,
    apiPlanned: false,
    description: 'Generischer Export — Dateipaket ohne Live-Übermittlung.',
  },
];

export function listBillingProviderDefinitions(): BillingProviderDefinition[] {
  return BILLING_PROVIDER_DEFINITIONS;
}

export function getBillingProviderLabel(key: ConnectBillingProviderKey): string {
  return CONNECT_BILLING_PROVIDER_LABELS[key];
}

export function getBillingProviderStatusLabel(status: ConnectBillingProviderStatus): string {
  return CONNECT_BILLING_PROVIDER_STATUS_LABELS[status];
}

export function createDefaultProviderConfig(
  tenantId: string,
  providerKey: ConnectBillingProviderKey,
): BillingProviderConfig {
  const def = BILLING_PROVIDER_DEFINITIONS.find((entry) => entry.key === providerKey)!;
  const now = new Date().toISOString();
  return {
    id: `bpc-${tenantId}-${providerKey}`,
    tenantId,
    providerKey,
    status: def.defaultStatus,
    environment: 'preparation',
    isActive: false,
    exportFormat: def.exportCapable ? 'preparation_package' : null,
    apiReady: false,
    configuredAt: null,
    configuredBy: null,
    notes: def.description,
    createdAt: now,
    updatedAt: now,
  };
}

export function isProviderConfiguredForExport(config: BillingProviderConfig | null | undefined): boolean {
  if (!config) return false;
  return config.isActive && (config.status === 'export_moeglich' || config.status === 'api_spaeter');
}

export function canMarkExportAsSubmitted(config: BillingProviderConfig | null | undefined): boolean {
  return false;
}
