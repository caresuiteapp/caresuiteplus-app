import { useEffect, useState } from 'react';
import { demoTenant } from '@/data/demo/tenant';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { getServiceMode } from '@/lib/services/mode';
import { fetchTenantDisplayName } from '@/lib/tenant/tenantDisplayName';

export function useTenantDisplayName(): string {
  const tenantId = useServiceTenantId();
  const isLive = getServiceMode() === 'supabase';
  const [name, setName] = useState(isLive ? 'Ihr Mandant' : demoTenant.name);

  useEffect(() => {
    if (!isLive || !tenantId) {
      setName(demoTenant.name);
      return;
    }

    let cancelled = false;
    void fetchTenantDisplayName(tenantId).then((resolved) => {
      if (!cancelled) setName(resolved);
    });

    return () => {
      cancelled = true;
    };
  }, [isLive, tenantId]);

  return name;
}
