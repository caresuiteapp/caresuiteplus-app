import { demoTenant, demoTenantAddress } from '@/data/demo/tenant';
import { getSupabaseClient } from '@/lib/supabase/client';

export type TenantDisplayMeta = {
  name: string;
  street: string;
  zip: string;
  city: string;
};

export const DEFAULT_TENANT_DISPLAY: TenantDisplayMeta = {
  name: 'Ihr Unternehmen',
  street: '',
  zip: '',
  city: '',
};

export function demoTenantDisplayMeta(): TenantDisplayMeta {
  return {
    name: demoTenant?.name?.trim() || DEFAULT_TENANT_DISPLAY.name,
    street: demoTenantAddress?.street?.trim() || DEFAULT_TENANT_DISPLAY.street,
    zip: demoTenantAddress?.zip?.trim() || DEFAULT_TENANT_DISPLAY.zip,
    city: demoTenantAddress?.city?.trim() || DEFAULT_TENANT_DISPLAY.city,
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
