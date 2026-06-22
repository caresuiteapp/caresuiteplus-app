import { useCallback, useEffect, useState } from 'react';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { fetchTenantCenter } from '@/lib/tenant/tenantCenterService';
import {
  getTenantModuleSettingsCache,
  setTenantModuleSettingsCache,
  subscribeTenantModuleSettings,
} from '@/lib/tenant/tenantModuleSettingsCache';
import { syncModuleAccessFromTenantSettings } from '@/lib/tenant/syncTenantModuleAccess';
import { isDemoMode } from '@/lib/supabase/config';
import { useServiceTenantId } from '@/hooks/useTenantId';
import type { TenantModuleSettings } from '@/types/tenant/tenantCenter';

export function useTenantModuleSettings() {
  const serviceTenantId = useServiceTenantId();
  const tenantId = serviceTenantId ?? (isDemoMode() ? DEMO_TENANT_ID : null);
  const [modules, setModules] = useState<TenantModuleSettings>(() =>
    tenantId ? getTenantModuleSettingsCache(tenantId) : getTenantModuleSettingsCache(''),
  );
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    const result = await fetchTenantCenter(tenantId);
    setLoading(false);
    if (result.ok) {
      setTenantModuleSettingsCache(tenantId, result.data.modules);
      syncModuleAccessFromTenantSettings(tenantId, result.data.modules);
      setModules(result.data.modules);
    }
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId) return undefined;
    setModules(getTenantModuleSettingsCache(tenantId));
    void refresh();
    return subscribeTenantModuleSettings(() => {
      setModules(getTenantModuleSettingsCache(tenantId));
    });
  }, [tenantId, refresh]);

  return { tenantId, modules, loading, refresh };
}
