import { TENANT_NAME_FALLBACK } from '@/lib/portal/portalDisplayLabels';
import { getSupabaseClient } from '@/lib/supabase/client';

export async function fetchTenantDisplayName(tenantId: string): Promise<string> {
  const client = getSupabaseClient();
  if (!client) {
    return TENANT_NAME_FALLBACK;
  }

  const { data, error } = await client
    .from('tenants')
    .select('id, name')
    .eq('id', tenantId)
    .maybeSingle();

  if (error || !data?.name) {
    return TENANT_NAME_FALLBACK;
  }

  return data.name.trim() || TENANT_NAME_FALLBACK;
}
