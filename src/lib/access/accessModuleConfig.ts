import { getServiceMode } from '@/lib/services/mode';

/** Gesamte Zugangsverwaltung — interne Benutzer, Audit usw. noch Demo-basiert. */
export function isAccessManagementLiveReady(): boolean {
  return false;
}

/** Klient:innenportal-Codes — Live-Supabase inkl. Migration 0061. */
export function isClientPortalAccessLiveReady(): boolean {
  return getServiceMode() === 'supabase';
}

export const ACCESS_MANAGEMENT_PREPARED_MESSAGE =
  'Zugangsverwaltung nutzt Demo-Daten — Live-Supabase-Sync und Mandanten-RLS sind in Vorbereitung.';

export const CLIENT_PORTAL_ACCESS_PREPARED_MESSAGE =
  'Klient:innenportal-Codes nutzen Demo-Daten — Live-Supabase-Anbindung ist in Supabase-Modus aktiv.';
