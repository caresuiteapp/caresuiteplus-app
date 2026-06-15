import type {
  CatalogDetail,
  CatalogItem,
  CatalogItemListItem,
  CatalogListItem,
} from '@/types/modules/catalog';
import { DEMO_TENANT_ID } from './tenant';

const BASE = '2026-06-01T10:00:00.000Z';

type CatalogSeed = Omit<CatalogDetail, 'itemCount' | 'usageCount'> & {
  tenantId: string;
};

const CATALOG_SEEDS: CatalogSeed[] = [
  {
    id: 'catalog-001',
    tenantId: DEMO_TENANT_ID,
    name: 'Leistungskatalog Assist',
    catalogType: 'service',
    description: 'Standardleistungen für Alltagsbegleitung und Betreuung',
    status: 'aktiv',
    createdAt: '2025-03-01T08:00:00.000Z',
    updatedAt: BASE,
  },
  {
    id: 'catalog-002',
    tenantId: DEMO_TENANT_ID,
    name: 'Tarife Abrechnung',
    catalogType: 'tariff',
    description: 'Abrechenbare Positionen für Pflegekassen und Selbstzahler',
    status: 'aktiv',
    createdAt: '2025-04-01T08:00:00.000Z',
    updatedAt: BASE,
  },
  {
    id: 'catalog-003',
    tenantId: DEMO_TENANT_ID,
    name: 'Qualifikationen Team',
    catalogType: 'qualification',
    description: 'Nachweise und Schulungen für Mitarbeitende',
    status: 'aktiv',
    createdAt: '2025-05-01T08:00:00.000Z',
    updatedAt: BASE,
  },
];

const ITEM_SEEDS: CatalogItem[] = [
  {
    id: 'item-001', tenantId: DEMO_TENANT_ID, catalogId: 'catalog-001', code: 'AB-001',
    label: 'Alltagsbegleitung (Std.)', unit: 'Stunde', priceCents: 3200,
    validFrom: '2026-01-01', validUntil: null, status: 'aktiv',
    createdAt: BASE, updatedAt: BASE,
  },
  {
    id: 'item-002', tenantId: DEMO_TENANT_ID, catalogId: 'catalog-001', code: 'AB-002',
    label: 'Haushaltsführung', unit: 'Stunde', priceCents: 2800,
    validFrom: '2026-01-01', validUntil: null, status: 'aktiv',
    createdAt: BASE, updatedAt: BASE,
  },
  {
    id: 'item-003', tenantId: DEMO_TENANT_ID, catalogId: 'catalog-001', code: 'AB-003',
    label: 'Begleitung Arzttermin', unit: 'Einsatz', priceCents: 4500,
    validFrom: '2026-01-01', validUntil: '2026-12-31', status: 'aktiv',
    createdAt: BASE, updatedAt: BASE,
  },
  {
    id: 'item-004', tenantId: DEMO_TENANT_ID, catalogId: 'catalog-002', code: 'PK-SGBXI-45',
    label: 'Entlastungsleistung §45b', unit: 'Stunde', priceCents: 3800,
    validFrom: '2026-01-01', validUntil: null, status: 'aktiv',
    createdAt: BASE, updatedAt: BASE,
  },
  {
    id: 'item-005', tenantId: DEMO_TENANT_ID, catalogId: 'catalog-002', code: 'PK-SGBV-37',
    label: 'Häusliche Krankenpflege', unit: 'Stunde', priceCents: 4200,
    validFrom: '2026-01-01', validUntil: null, status: 'aktiv',
    createdAt: BASE, updatedAt: BASE,
  },
  {
    id: 'item-006', tenantId: DEMO_TENANT_ID, catalogId: 'catalog-003', code: 'Q-PFK',
    label: 'Pflegefachkraft', unit: 'Nachweis', priceCents: null,
    validFrom: null, validUntil: null, status: 'aktiv',
    createdAt: BASE, updatedAt: BASE,
  },
  {
    id: 'item-007', tenantId: DEMO_TENANT_ID, catalogId: 'catalog-003', code: 'Q-ERSTHILFE',
    label: 'Erste-Hilfe-Kurs', unit: 'Zertifikat', priceCents: null,
    validFrom: '2025-01-01', validUntil: '2027-01-01', status: 'aktiv',
    createdAt: BASE, updatedAt: BASE,
  },
];

let catalogItems = ITEM_SEEDS.map((i) => ({ ...i }));

const USAGE_COUNTS: Record<string, number> = {
  'catalog-001': 42,
  'catalog-002': 18,
  'catalog-003': 7,
};

export function getDemoCatalogListItems(): CatalogListItem[] {
  return CATALOG_SEEDS.map((c) => ({
    id: c.id,
    name: c.name,
    catalogType: c.catalogType,
    description: c.description,
    itemCount: catalogItems.filter((i) => i.catalogId === c.id).length,
    status: c.status,
    updatedAt: c.updatedAt,
  }));
}

export function getDemoCatalogDetail(id: string): CatalogDetail | null {
  const seed = CATALOG_SEEDS.find((c) => c.id === id);
  if (!seed) return null;
  return {
    id: seed.id,
    name: seed.name,
    catalogType: seed.catalogType,
    description: seed.description,
    itemCount: catalogItems.filter((i) => i.catalogId === id).length,
    status: seed.status,
    updatedAt: seed.updatedAt,
    createdAt: seed.createdAt,
    usageCount: USAGE_COUNTS[id] ?? 0,
  };
}

export function updateDemoCatalogName(id: string, name: string): boolean {
  const seed = CATALOG_SEEDS.find((c) => c.id === id);
  if (!seed) return false;
  seed.name = name;
  seed.updatedAt = new Date().toISOString();
  return true;
}

export function createDemoCatalog(name: string, catalogType: CatalogDetail['catalogType'] = 'service'): CatalogDetail {
  const now = new Date().toISOString();
  const id = `catalog-${Date.now()}`;
  const seed: CatalogSeed = {
    id,
    tenantId: DEMO_TENANT_ID,
    name: name.trim(),
    catalogType,
    description: 'Angelegt über Katalog-Assistent',
    status: 'entwurf',
    createdAt: now,
    updatedAt: now,
  };
  CATALOG_SEEDS.unshift(seed);
  return getDemoCatalogDetail(id)!;
}

export function getDemoCatalogItems(catalogId: string): CatalogItemListItem[] {
  return catalogItems
    .filter((i) => i.catalogId === catalogId)
    .map((i) => ({
      id: i.id,
      catalogId: i.catalogId,
      code: i.code,
      label: i.label,
      unit: i.unit,
      priceCents: i.priceCents,
      status: i.status,
      updatedAt: i.updatedAt,
    }));
}
