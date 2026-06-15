import { fetchInvoiceModuleSnapshot } from '@/lib/office/billingModuleService';
import { useTenantModuleSnapshot } from '@/hooks/core/useTenantModuleSnapshot';

/** WP228 — Invoice Modul-Hook */
export function useInvoiceModule() {
  return useTenantModuleSnapshot(228, fetchInvoiceModuleSnapshot);
}
