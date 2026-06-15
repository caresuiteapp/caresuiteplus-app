import { isDemoMode, isSupabaseConfigured } from '@/lib/supabase/config';

/**
 * Portal Profil live readiness — Demo-Profile bis Live-Portal-Services (#85–86).
 */
export function isPortalProfileLiveReady(): boolean {
  return false;
}

export const PORTAL_PROFILE_PREPARED_MESSAGE =
  'Portal-Profile nutzen Demo-Daten. Live-Supabase-Anbindung für Mitarbeiter- und Klient:innenprofile ist vorbereitet, aber noch nicht produktiv.';
