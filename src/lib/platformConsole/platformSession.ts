import { getSession } from '@/lib/supabase/authService';
import { buildPlatformLoginPath } from './platformLoginPath';

export { buildPlatformLoginPath };

export async function hasSupabaseAuthSession(): Promise<boolean> {
  const sessionResult = await getSession();
  return Boolean(sessionResult.ok && sessionResult.data);
}
