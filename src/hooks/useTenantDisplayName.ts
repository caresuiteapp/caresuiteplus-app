import { useEffect, useState } from 'react';
import { demoTenant } from '@/data/demo/tenant';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { getServiceMode } from '@/lib/services/mode';
import { fetchTenantBrandingLogoUrl } from '@/lib/tenant/tenantBrandingService';
import { fetchTenantDisplayName } from '@/lib/tenant/tenantDisplayName';

export type TenantBranding = {
  name: string;
  logoUrl: string;
};

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

export function useTenantBranding(): TenantBranding {
  const tenantId = useServiceTenantId();
  const { portalSession } = useAuth();
  const isLive = getServiceMode() === 'supabase';
  const cachedName = portalSession?.tenantName?.trim();
  const [name, setName] = useState(
    cachedName ?? (isLive ? 'Ihr Mandant' : demoTenant.name),
  );
  const [logoUrl, setLogoUrl] = useState('');

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

  useEffect(() => {
    if (!isLive || !tenantId) {
      setLogoUrl('');
      return;
    }

    let cancelled = false;
    void fetchTenantBrandingLogoUrl(tenantId).then((resolved) => {
      if (!cancelled) setLogoUrl(resolved.trim());
    });

    return () => {
      cancelled = true;
    };
  }, [isLive, tenantId]);

  return { name, logoUrl };
}
