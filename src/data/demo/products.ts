import type { Product, ProductKey, TenantProduct } from '@/types';
import { DEMO_TENANT_ID } from './tenant';

export const PRODUCT_LABELS: Record<ProductKey, string> = {
  office: 'CareSuite+ Office',
  assist: 'CareSuite+ Assist',
  pflege: 'CareSuite+ Pflege',
  stationaer: 'CareSuite+ Stationär',
  beratung: 'CareSuite+ Beratung',
  akademie: 'CareSuite+ Akademie',
};

export const demoProducts: Product[] = [
  {
    id: 'prod-office',
    key: 'office',
    name: PRODUCT_LABELS.office,
    description: 'Zentrale Verwaltung, Klient:innen, Mitarbeitende, Dokumente und Rechnungen.',
    isActive: true,
    sortOrder: 1,
    createdAt: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'prod-assist',
    key: 'assist',
    name: PRODUCT_LABELS.assist,
    description: 'Alltagsbegleitung, Einsätze, Aufgaben und Leistungsnachweise.',
    isActive: true,
    sortOrder: 2,
    createdAt: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'prod-pflege',
    key: 'pflege',
    name: PRODUCT_LABELS.pflege,
    description: 'Pflegeplanung, Vitalwerte, Wunddokumentation und Pflegeberichte.',
    isActive: true,
    sortOrder: 3,
    createdAt: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'prod-stationaer',
    key: 'stationaer',
    name: PRODUCT_LABELS.stationaer,
    description: 'Bewohner:innen, Zimmer, Übergaben und Tagesstruktur.',
    isActive: false,
    sortOrder: 4,
    createdAt: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'prod-beratung',
    key: 'beratung',
    name: PRODUCT_LABELS.beratung,
    description: 'Beratungsfälle, Protokolle und Empfehlungen.',
    isActive: true,
    sortOrder: 5,
    createdAt: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'prod-akademie',
    key: 'akademie',
    name: PRODUCT_LABELS.akademie,
    description: 'Kurse, Lektionen, Prüfungen und Zertifikate.',
    isActive: true,
    sortOrder: 6,
    createdAt: '2025-01-01T00:00:00.000Z',
  },
];

export function buildDemoTenantProduct(product: Product): TenantProduct {
  return {
    id: `tp-${product.key}`,
    tenantId: DEMO_TENANT_ID,
    productId: product.id,
    productKey: product.key,
    isActive: product.isActive,
    activatedAt: '2025-02-01T00:00:00.000Z',
    accessSource: product.isActive ? 'purchased' : 'disabled',
    includedByModuleKey: null,
    isBaseIncluded: false,
    billingStatus: product.isActive ? 'billable' : 'not_billed',
  };
}

/** Demo-Mandantenprodukte — Office separat gebucht, Fachmodule aktiv (Stationär aus). */
export const demoTenantProducts: TenantProduct[] = demoProducts.map(buildDemoTenantProduct);
