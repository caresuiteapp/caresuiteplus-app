import { useEffect, useState } from 'react';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { getServiceMode } from '@/lib/services/mode';
import {
  DEFAULT_TENANT_DISPLAY,
  demoTenantDisplayMeta,
  fetchTenantDisplayMeta,
  type TenantDisplayMeta,
} from '@/lib/tenant/tenantDisplayMeta';

export function useTenantDisplayMeta(): TenantDisplayMeta {
  const tenantId = useServiceTenantId();
  const isLive = getServiceMode() === 'supabase';
  const [meta, setMeta] = useState<TenantDisplayMeta>(() =>
    isLive ? { ...DEFAULT_TENANT_DISPLAY, name: 'Ihr Mandant' } : demoTenantDisplayMeta(),
  );

  useEffect(() => {
    if (!isLive || !tenantId) {
      setMeta(demoTenantDisplayMeta());
      return;
    }

    let cancelled = false;
    void fetchTenantDisplayMeta(tenantId).then((resolved) => {
      if (!cancelled) setMeta(resolved);
    });

    return () => {
      cancelled = true;
    };
  }, [isLive, tenantId]);

  return meta;
}
