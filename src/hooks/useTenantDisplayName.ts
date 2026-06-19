import { useEffect, useState } from 'react';
import { demoTenant } from '@/data/demo/tenant';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { getServiceMode } from '@/lib/services/mode';
import { fetchTenantDisplayName } from '@/lib/tenant/tenantDisplayName';

export function useTenantDisplayName(): string {
  const tenantId = useServiceTenantId();
  const { portalSession } = useAuth();
  const isLive = getServiceMode() === 'supabase';
  const cachedName = portalSession?.tenantName?.trim();
  const [name, setName] = useState(
    cachedName ?? (isLive ? 'Ihr Mandant' : demoTenant.name),
  );

  useEffect(() => {
    if (cachedName) {
      setName(cachedName);
      return;
    }

    if (!isLive || !tenantId) {
      setName(isLive ? 'Ihr Mandant' : demoTenant.name);
      return;
    }

    let cancelled = false;
    void fetchTenantDisplayName(tenantId).then((resolved) => {
      if (!cancelled) setName(resolved);
    });

    return () => {
      cancelled = true;
    };
  }, [cachedName, isLive, tenantId]);

  return name;
}
