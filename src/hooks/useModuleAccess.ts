import { useEffect, useMemo, useState } from 'react';
import type { EffectiveModuleAccess, ProductKey } from '@/types';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import {
  getEffectiveModuleAccess,
  getModuleAccessSource,
  hasEffectiveModuleGateAccess,
  hasModuleAccess,
  hasOfficeBaseAccess,
} from '@/lib/modules/moduleAccessService';
import { calculateBillingItems } from '@/lib/modules/moduleEntitlementService';
import { isDemoMode } from '@/lib/supabase/config';
import { subscribeTenantModuleSettings } from '@/lib/tenant/tenantModuleSettingsCache';
import { useServiceTenantId } from '@/hooks/useTenantId';

export function useModuleAccess(revision = 0) {
  const serviceTenantId = useServiceTenantId();
  const tenantId = serviceTenantId ?? (isDemoMode() ? DEMO_TENANT_ID : '');
  const [cacheRevision, setCacheRevision] = useState(0);

  useEffect(() => subscribeTenantModuleSettings(() => {
    setCacheRevision((value) => value + 1);
  }), []);

  const effectiveRevision = revision + cacheRevision;

  return useMemo(() => {
    if (!tenantId) {
      const emptyBilling = {
        items: [],
        billableCount: 0,
        includedCount: 0,
        totalActiveCount: 0,
      };
      return {
        tenantId: null as string | null,
        modules: [] as EffectiveModuleAccess[],
        billing: emptyBilling,
        hasModule: () => false,
        hasGate: () => false,
        hasOffice: (): boolean => false,
        getAccessSource: () => 'disabled' as const,
        getModule: () => undefined,
      };
    }

    const modules = getEffectiveModuleAccess(tenantId);
    const billing = calculateBillingItems(tenantId);

    return {
      tenantId,
      modules,
      billing,
      hasModule: (moduleKey: ProductKey) => hasModuleAccess(moduleKey, tenantId),
      hasGate: (moduleKey: ProductKey) => hasEffectiveModuleGateAccess(moduleKey, tenantId),
      hasOffice: (): boolean => hasOfficeBaseAccess(tenantId),
      getAccessSource: (moduleKey: ProductKey) => getModuleAccessSource(moduleKey, tenantId),
      getModule: (moduleKey: ProductKey): EffectiveModuleAccess | undefined =>
        modules.find((entry) => entry.productKey === moduleKey),
    };
  }, [tenantId, effectiveRevision]);
}
