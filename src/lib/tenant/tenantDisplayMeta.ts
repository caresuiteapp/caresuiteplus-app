import { demoTenant, demoTenantAddress } from '@/data/demo/tenant';
import { getSupabaseClient } from '@/lib/supabase/client';

export type TenantDisplayMeta = {
  name: string;
  street: string;
  zip: string;
  city: string;
};

export const DEFAULT_TENANT_DISPLAY: TenantDisplayMeta = {
  name: 'Ihr Mandant',
  street: '',
  zip: '',
  city: '',
};

export function demoTenantDisplayMeta(): TenantDisplayMeta {
  return {
    name: demoTenant.name,
    street: demoTenantAddress.street,
    zip: demoTenantAddress.zip,
    city: demoTenantAddress.city,
  };
}

export async function fetchTenantDisplayMeta(tenantId: string): Promise<TenantDisplayMeta> {
  const client = getSupabaseClient();
  if (!client) {
    return DEFAULT_TENANT_DISPLAY;
  }

  const { data, error } = await client
    .from('tenants')
    .select('name, street, house_number, postal_code, city')
    .eq('id', tenantId)
    .maybeSingle();

  if (error || !data) {
    return DEFAULT_TENANT_DISPLAY;
  }

  const streetLine = [data.street?.trim(), data.house_number?.trim()].filter(Boolean).join(' ');

  return {
    name: data.name?.trim() || DEFAULT_TENANT_DISPLAY.name,
    street: streetLine,
    zip: data.postal_code?.trim() || '',
    city: data.city?.trim() || '',
  };
}
