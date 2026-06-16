import type { ConnectCategoryKey } from '@/types/connect/gateway';

/** Mappt UI-Katalog-Schlüssel auf Gateway-Kategorien. */
export const CONNECT_CATALOG_TO_GATEWAY_CATEGORY: Record<string, ConnectCategoryKey> = {
  billing: 'billing',
  accounting: 'accounting',
  payments: 'payments',
  ti_kim: 'ti_kim',
  communication_channels: 'communication',
  routes_gps: 'maps',
  documents_signatures: 'documents',
  medical_data: 'medical_catalogs',
  hr_payroll: 'hr_payroll',
  academy_integrations: 'academy',
  marketplace: 'marketplace',
};

export const CONNECT_GATEWAY_CATEGORIES: ConnectCategoryKey[] = [
  'billing',
  'accounting',
  'payments',
  'ti_kim',
  'communication',
  'maps',
  'documents',
  'medical_catalogs',
  'hr_payroll',
  'academy',
  'marketplace',
];

export function resolveGatewayCategory(catalogCategoryKey: string): ConnectCategoryKey {
  return CONNECT_CATALOG_TO_GATEWAY_CATEGORY[catalogCategoryKey] ?? 'marketplace';
}
