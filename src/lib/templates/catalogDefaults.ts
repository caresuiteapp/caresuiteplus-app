import type { CatalogType, DropdownOption } from '@/types/templates';

const MESSAGE_CATEGORY_DEFAULTS: DropdownOption[] = [
  { value: 'intern', label: 'Intern', isSystem: true },
  { value: 'klient', label: 'Klient:in', isSystem: true },
  { value: 'mitarbeiter', label: 'Mitarbeiter:in', isSystem: true },
];

export function getCatalogDefaults(catalogType: CatalogType): DropdownOption[] {
  if (catalogType === 'message_category') return MESSAGE_CATEGORY_DEFAULTS;
  return [];
}
