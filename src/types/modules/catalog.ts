import type { TenantScopedEntity, WorkflowStatus } from '../core/base';

export type CatalogType = 'service' | 'tariff' | 'qualification';

export type Catalog = TenantScopedEntity & {
  name: string;
  catalogType: CatalogType;
  description: string | null;
  itemCount: number;
  status: WorkflowStatus;
};

export type CatalogListItem = Pick<
  Catalog,
  'id' | 'name' | 'catalogType' | 'description' | 'itemCount' | 'status' | 'updatedAt'
>;

export type CatalogItem = TenantScopedEntity & {
  catalogId: string;
  code: string;
  label: string;
  unit: string;
  priceCents: number | null;
  validFrom: string | null;
  validUntil: string | null;
  status: WorkflowStatus;
};

export type CatalogItemListItem = Pick<
  CatalogItem,
  'id' | 'catalogId' | 'code' | 'label' | 'unit' | 'priceCents' | 'status' | 'updatedAt'
>;

export type CatalogDetail = CatalogListItem & {
  createdAt: string;
  usageCount: number;
};

export const CATALOG_TYPE_LABELS: Record<CatalogType, string> = {
  service: 'Leistungen',
  tariff: 'Tarife',
  qualification: 'Qualifikationen',
};
