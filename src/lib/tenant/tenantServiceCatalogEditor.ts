import { isUnreleasedCatalogModuleKey } from '@/lib/modules/constants';
import { formatServicePriceUnit } from '@/lib/tenant/serviceCatalogLabels';
import type { ServiceCatalogCategory, TenantModuleKey, TenantServiceCatalogItem } from '@/types/tenant/tenantCenter';

export type CatalogCategoryFilter = ServiceCatalogCategory | 'all';

/** Empty is deliberate; malformed input must never silently become a price. */
export function parseCatalogAmount(value: string): number | null | 'invalid' {
  const trimmed = value.trim().replace(/\s/g, '');
  if (!trimmed) return null;
  if (trimmed.includes(',') && !/^(?:\d+|\d{1,3}(?:\.\d{3})+),\d{1,2}$/.test(trimmed)) return 'invalid';
  const normalized = trimmed.includes(',') ? trimmed.replace(/\./g, '').replace(',', '.') : trimmed;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return 'invalid';
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount <= 99999999.99 ? amount : 'invalid';
}

export function formatCatalogPrice(item: Pick<TenantServiceCatalogItem, 'defaultPriceNet' | 'unit'>): string {
  if (item.defaultPriceNet == null) return 'Preis noch offen';
  const amount = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(item.defaultPriceNet);
  return item.unit === 'percent' ? `${amount} %` : `${amount} € / ${formatServicePriceUnit(item.unit)}`;
}

export function filterCompanyCatalog(items: TenantServiceCatalogItem[], category: CatalogCategoryFilter, query: string, moduleKey?: TenantModuleKey) {
  const term = query.trim().toLocaleLowerCase('de-DE');
  return items.filter((item) => !isUnreleasedCatalogModuleKey(item.moduleKey) && (!moduleKey || item.moduleKey === moduleKey) &&
    (category === 'all' || item.category === category) &&
    (!term || `${item.name} ${item.description}`.toLocaleLowerCase('de-DE').includes(term)))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'de'));
}
