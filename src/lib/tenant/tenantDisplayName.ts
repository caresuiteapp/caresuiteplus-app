import { getSupabaseClient } from '@/lib/supabase/client';

export async function fetchTenantDisplayName(tenantId: string): Promise<string> {
  const client = getSupabaseClient();
  if (!client) {
    return 'Ihr Mandant';
  }

  const { data, error } = await client
    .from('tenants')
    .select('id, name')
    .eq('id', tenantId)
    .maybeSingle();

  if (error || !data?.name) {
    return 'Ihr Mandant';
  }

  return data.name.trim() || 'Ihr Mandant';
}
