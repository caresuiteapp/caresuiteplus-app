import type { InventoryCategoryGroup } from '@/types/inventory';
import { INVENTORY_CATEGORY_LABELS } from '@/types/inventory';

type DefaultCategorySeed = {
  group_key: InventoryCategoryGroup;
  label: string;
  requires_return_on_exit: boolean;
  portal_visible_to_employee: boolean;
  barcode_enabled: boolean;
};

const DEFAULT_CATEGORY_SEEDS: DefaultCategorySeed[] = [
  {
    group_key: 'devices',
    label: 'Tablets & Laptops',
    requires_return_on_exit: true,
    portal_visible_to_employee: true,
    barcode_enabled: true,
  },
  {
    group_key: 'mobile_sim',
    label: 'Diensthandys & SIM',
    requires_return_on_exit: true,
    portal_visible_to_employee: true,
    barcode_enabled: true,
  },
  {
    group_key: 'uniform',
    label: INVENTORY_CATEGORY_LABELS.uniform,
    requires_return_on_exit: false,
    portal_visible_to_employee: true,
    barcode_enabled: false,
  },
  {
    group_key: 'keys_access',
    label: 'Schlüssel & Transponder',
    requires_return_on_exit: true,
    portal_visible_to_employee: false,
    barcode_enabled: false,
  },
  {
    group_key: 'documents',
    label: INVENTORY_CATEGORY_LABELS.documents,
    requires_return_on_exit: true,
    portal_visible_to_employee: false,
    barcode_enabled: false,
  },
  {
    group_key: 'vehicles',
    label: INVENTORY_CATEGORY_LABELS.vehicles,
    requires_return_on_exit: true,
    portal_visible_to_employee: false,
    barcode_enabled: false,
  },
  {
    group_key: 'software_access',
    label: INVENTORY_CATEGORY_LABELS.software_access,
    requires_return_on_exit: true,
    portal_visible_to_employee: true,
    barcode_enabled: false,
  },
];

export function buildDefaultCategoryRows(tenantId: string): Array<DefaultCategorySeed & { tenant_id: string }> {
  return DEFAULT_CATEGORY_SEEDS.map((seed) => ({
    ...seed,
    tenant_id: tenantId,
  }));
}
