import { getSupabaseClient } from '@/lib/supabase/client';
import { platformRpc } from '@/lib/platformConsole/platformSupabaseClient';
import type { ServiceResult } from '@/types/core/base';

export async function checkBusinessAccess(expectedAuthUserId?: string): Promise<ServiceResult<null>> {
  const client = getSupabaseClient();
  const matchesSession = async () => {
    if (!expectedAuthUserId) return true;
    try { return (await client?.auth.getSession())?.data.session?.user.id === expectedAuthUserId; }
    catch { return false; }
  };
  const changedSession = { ok: false as const, error: 'Die Anmeldung wurde durch einen Sitzungswechsel unterbrochen. Bitte mit dem gewünschten Konto erneut anmelden.' };
  if (!await matchesSession()) return changedSession;
  let response: { data: { allowed: boolean; message?: string } | null; error: unknown };
  try { response = await platformRpc<{ allowed: boolean; message?: string }>('platform_business_access_state'); }
  catch { response = { data: null, error: true }; }
  const { data, error } = response;
  if (!await matchesSession()) return changedSession;
  if (!error && data?.allowed === true) return { ok: true, data: null };
  // End only this device session; accounts in other companies remain intact.
  try { await client?.auth.signOut({ scope: 'local' }); } catch { /* Data access remains denied by the database. */ }
  return { ok: false, error: error ? 'Der Unternehmenszugang konnte nicht geprüft werden. Bitte erneut anmelden.' :
    data?.allowed === false ? data.message ?? 'Der Unternehmenszugang ist deaktiviert. Bitte wenden Sie sich an die Verwaltung.' :
      'Der Unternehmenszugang wurde nicht bestätigt. Bitte erneut anmelden.' };
}
