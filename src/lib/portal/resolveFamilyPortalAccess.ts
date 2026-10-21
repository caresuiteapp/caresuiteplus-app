import { getSupabaseClient } from '@/lib/supabase/client';
import {
  decodeFamilyPortalAccessScope,
  type FamilyPortalAccessScope,
} from './familyPortalAccessScope';

type RpcClient = {
  rpc: (name: string, args: Record<string, never>) => Promise<{
    data: Record<string, unknown>[] | Record<string, unknown> | null;
    error: { message?: string } | null;
  }>;
};

export async function fetchCurrentFamilyPortalAccessScope(
  tenantId: string,
  accountId: string,
): Promise<FamilyPortalAccessScope | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await (supabase as unknown as RpcClient).rpc(
    'current_family_portal_access_scope',
    {},
  );
  if (error) {
    console.warn('[resolveFamilyPortalAccess] current_family_portal_access_scope:', error.message);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  return decodeFamilyPortalAccessScope(row, { tenantId, accountId });
}
