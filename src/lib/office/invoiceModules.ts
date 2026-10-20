import type { TenantModuleKey } from '@/types/tenant/tenantCenter';

export type InvoiceWorkspaceKey = TenantModuleKey | 'all';

export type InvoiceModuleDefinition = {
  key: TenantModuleKey;
  label: string;
  icon: string;
  accent: string;
  basis: string;
  description: string;
};

export const INVOICE_MODULES: readonly InvoiceModuleDefinition[] = [
  {
    key: 'assist',
    label: 'Assist',
    icon: '🤝',
    accent: '#8B5CF6',
    basis: '§ 45b, § 45a und § 39 SGB XI',
    description: 'Entlastungsleistungen, Umwandlung, Budgets und freigegebene Assist-Nachweise.',
  },
  {
    key: 'pflege',
    label: 'Pflege',
    icon: '🩺',
    accent: '#20C978',
    basis: 'SGB XI / SGB V',
    description: 'Pflegeleistungen, Leistungskomplexe, Kostenträger und freigegebene Pflegenachweise.',
  },
  {
    key: 'stationaer',
    label: 'Stationär',
    icon: '🏥',
    accent: '#FF8A00',
    basis: 'Pflege-, Unterkunfts- und Investitionskosten',
    description: 'Belegungstage, Pflegeentgelte, Zuschläge und einrichtungsbezogene Abrechnung.',
  },
  {
    key: 'beratung',
    label: 'Beratung',
    icon: '💬',
    accent: '#22C7E8',
    basis: 'Beratungs- und Schulungsleistungen',
    description: 'Beratungseinsätze, Schulungen sowie private oder kostenträgerbezogene Leistungen.',
  },
] as const;

export function isInvoiceModuleKey(value: unknown): value is TenantModuleKey {
  return INVOICE_MODULES.some((module) => module.key === value);
}

export function getInvoiceModule(key: TenantModuleKey): InvoiceModuleDefinition {
  return INVOICE_MODULES.find((module) => module.key === key) ?? INVOICE_MODULES[0];
}
