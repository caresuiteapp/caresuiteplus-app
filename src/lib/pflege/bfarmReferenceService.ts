import type { ServiceResult } from '@/types';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { withServiceQueryTimeout } from '@/lib/services/queryTimeout';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isValidPzn } from './medicationMasterDataValidation';
import { decodeBfarmReference, type BfarmReference } from './bfarmReference';

export async function getBfarmReference(tenantId: string, input: string): Promise<ServiceResult<BfarmReference | null>> {
  const blocked = guardServiceTenant(tenantId);
  if (blocked) return blocked;
  const pzn = input.trim();
  if (!isValidPzn(pzn)) return { ok: false, error: 'Bitte eine gültige achtstellige PZN einschließlich führender Nullen eingeben.' };
  const client = getServiceMode() === 'supabase' ? getSupabaseClient() : null;
  if (!client) return { ok: false, error: 'Die BfArM-Referenzdatenbank ist nicht verbunden.' };
  try {
    const rpc = client as unknown as { rpc: (name: string, args: Record<string, string>) => PromiseLike<{ data: unknown; error: { code?: string } | null }> };
    const { data, error } = await withServiceQueryTimeout(Promise.resolve(rpc.rpc('get_pflege_bfarm_reference', {
      p_tenant: tenantId, p_pzn: pzn,
    })), 'BfArM-Einzelabfrage', 15_000);
    if (error) return { ok: false, error: error.code === '42501' ? 'Die Berechtigung für die Medikamentenreferenzdaten fehlt.'
      : error.code === '55000' ? 'Es ist noch keine geprüfte BfArM-Lieferung verfügbar.' : 'Die BfArM-Referenzdaten konnten nicht abgerufen werden.' };
    if (data === null) return { ok: true, data: null };
    const result = decodeBfarmReference(data, pzn);
    return result ? { ok: true, data: result } : { ok: false, error: 'Der BfArM-Datensatz konnte nicht eindeutig bestätigt werden.' };
  } catch {
    return { ok: false, error: 'Die BfArM-Referenzdatenbank hat nicht geantwortet. Bitte erneut versuchen.' };
  }
}
