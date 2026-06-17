import { demoTenant, demoTenantAddress } from '@/data/demo/tenant';
import { formatHourlyRateDocumentAmount } from '@/lib/formatters/numberFormatters';
import { getSupabaseClient } from '@/lib/supabase/client';

export type TenantDisplayMeta = {
  name: string;
  street: string;
  zip: string;
  city: string;
  /** Formatierter Mandanten-Stundensatz für Dokumente, z. B. „38,00“ */
  defaultHourlyRate: string;
};

export const DEFAULT_TENANT_DISPLAY: TenantDisplayMeta = {
  name: 'Ihr Mandant',
  street: '',
  zip: '',
  city: '',
  defaultHourlyRate: '',
};

export function demoTenantDisplayMeta(): TenantDisplayMeta {
  return {
    name: demoTenant.name,
    street: demoTenantAddress.street,
    zip: demoTenantAddress.zip,
    city: demoTenantAddress.city,
    defaultHourlyRate: '38,00',
  };
}

export async function fetchTenantDisplayMeta(tenantId: string): Promise<TenantDisplayMeta> {
  const client = getSupabaseClient();
  if (!client) {
    return DEFAULT_TENANT_DISPLAY;
  }

  const [{ data, error }, billingResult] = await Promise.all([
    client
      .from('tenants')
      .select('name, street, house_number, postal_code, city')
      .eq('id', tenantId)
      .maybeSingle(),
    client
      .from('tenant_billing_settings')
      .select('default_hourly_rate')
      .eq('tenant_id', tenantId)
      .maybeSingle(),
  ]);

  if (error || !data) {
    return DEFAULT_TENANT_DISPLAY;
  }

  const streetLine = [data.street?.trim(), data.house_number?.trim()].filter(Boolean).join(' ');
  const defaultHourlyRate = formatHourlyRateDocumentAmount(
    billingResult.data?.default_hourly_rate ?? null,
  );

  return {
    name: data.name?.trim() || DEFAULT_TENANT_DISPLAY.name,
    street: streetLine,
    zip: data.postal_code?.trim() || '',
    city: data.city?.trim() || '',
    defaultHourlyRate,
  };
}
