import { CompanyInventoryScreen } from './CompanyInventoryScreen.native';
import { COMPANY_INVENTORY_LEGACY_VIEWS } from '@/lib/navigation/companyInventoryRoute';
import type { ComponentProps } from 'react';
import type { InventoryListScreen as ExistingInventoryListScreen } from './InventoryListScreen';
export function InventoryListScreen({ variant, categoryGroupFilter, titleOverride }: ComponentProps<typeof ExistingInventoryListScreen>) {
  return <CompanyInventoryScreen view={COMPANY_INVENTORY_LEGACY_VIEWS[variant] ?? 'stock'} categoryGroupFilter={categoryGroupFilter} title={titleOverride} />;
}
