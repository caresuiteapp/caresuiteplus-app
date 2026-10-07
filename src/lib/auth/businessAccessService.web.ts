import { getSupabaseClient } from '@/lib/supabase/client';
import { platformRpc } from '@/lib/platformConsole/platformSupabaseClient';
import type { ServiceResult } from '@/types/core/base';

export async function checkBusinessAccess(): Promise<ServiceResult<null>> {
  let response: { data: { allowed: boolean; message?: string } | null; error: unknown };
  try { response = await platformRpc<{ allowed: boolean; message?: string }>('platform_business_access_state'); }
  catch { response = { data: null, error: true }; }
  const { data, error } = response;
  if (!error && data?.allowed === true) return { ok: true, data: null };
  // End only this device session; accounts in other companies remain intact.
  try { await getSupabaseClient()?.auth.signOut({ scope: 'local' }); } catch { /* Data access remains denied by the database. */ }
  return { ok: false, error: error ? 'Der Unternehmenszugang konnte nicht geprüft werden. Bitte erneut anmelden.' :
    data?.allowed === false ? data.message ?? 'Der Unternehmenszugang ist deaktiviert. Bitte wenden Sie sich an die Verwaltung.' :
      'Der Unternehmenszugang wurde nicht bestätigt. Bitte erneut anmelden.' };
}
