import { getServiceMode } from '@/lib/services/mode';
import { isSupabaseConfigured } from '@/lib/supabase/config';

/** Portal profile reads live Supabase data when the app runs in supabase service mode. */
export function isPortalProfileLiveReady(): boolean {
  return getServiceMode() === 'supabase' && isSupabaseConfigured();
}

export const PORTAL_PROFILE_PREPARED_MESSAGE =
  'Portal-Profile nutzen Demo-Daten. Live-Supabase-Anbindung für Mitarbeiter- und Klient:innenprofile ist vorbereitet, aber noch nicht produktiv.';
