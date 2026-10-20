import type { ProductKey } from '@/types';
import { PRODUCT_LABELS } from '@/data/constants/productLabels';
import { isFreePlatformEnabled } from '@/lib/billing/freePlatformService';
import { getTenantModules } from './moduleAccessService';

export type BillingPreviewItem = {
  productKey: ProductKey;
  label: string;
  billingStatus: import('@/types').ModuleBillingStatus;
  accessSource: import('@/types').ModuleAccessSource;
  isIncluded: boolean;
  isBillable: boolean;
};

export type BillingPreview = {
  items: BillingPreviewItem[];
  billableCount: number;
  includedCount: number;
  totalActiveCount: number;
};

/** Berechnet Abrechnungspositionen — Office mit included_base wird nicht doppelt berechnet. */
export function calculateBillingItems(tenantId: string): BillingPreview {
  const modules = getTenantModules(tenantId).filter((module) => module.isActive);

  const items: BillingPreviewItem[] = modules.map((module) => ({
    productKey: module.productKey,
    label: PRODUCT_LABELS[module.productKey],
    billingStatus: module.billingStatus,
    accessSource: module.accessSource,
    isIncluded:
      isFreePlatformEnabled() ||
      module.billingStatus === 'included' ||
      module.billingStatus === 'free_active' ||
      module.accessSource === 'included_base' ||
      module.accessSource === 'free_active',
    isBillable: !isFreePlatformEnabled() && module.billingStatus === 'billable',
  }));

  return {
    items,
    billableCount: items.filter((item) => item.isBillable).length,
    includedCount: items.filter((item) => item.isIncluded).length,
    totalActiveCount: items.length,
  };
}
