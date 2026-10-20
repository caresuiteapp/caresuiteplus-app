import type { CatalogType, DropdownOption } from '@/types/templates';
import { getAllCatalogEntries } from '@/data/demo/templates/seeds';

const DEFAULTS_BY_TYPE = getAllCatalogEntries().reduce<Partial<Record<CatalogType, DropdownOption[]>>>(
  (acc, entry) => {
    const list = acc[entry.catalogType] ?? [];
    list.push({
      value: entry.valueKey,
      label: entry.label,
      description: entry.description ?? undefined,
      isSystem: entry.isSystem,
    });
    acc[entry.catalogType] = list;
    return acc;
  },
  {},
);

export function getCatalogDefaults(catalogType: CatalogType): DropdownOption[] {
  return DEFAULTS_BY_TYPE[catalogType] ?? [];
}
