import { getServiceMode } from '@/lib/services/mode';

/** Gesamte Zugangsverwaltung — Live-Supabase wenn konfiguriert. */
export function isAccessManagementLiveReady(): boolean {
  return getServiceMode() === 'supabase';
}

/** Klient:innenportal-Codes — Live-Supabase inkl. Migration 0061. */
export function isClientPortalAccessLiveReady(): boolean {
  return getServiceMode() === 'supabase';
}

/** Angehörigenportal-Codes — Live-Supabase (Migration 0016/0017). */
export function isRelativePortalAccessLiveReady(): boolean {
  return getServiceMode() === 'supabase';
}

export const ACCESS_MANAGEMENT_PREPARED_MESSAGE =
  'Zugangsverwaltung nutzt Demo-Daten — Live-Supabase-Sync ist nur im Demo-Modus aktiv.';

export const CLIENT_PORTAL_ACCESS_PREPARED_MESSAGE =
  'Klient:innenportal-Codes nutzen Demo-Daten — im Live-Modus werden Supabase-Daten verwendet.';

export const RELATIVE_PORTAL_ACCESS_PREPARED_MESSAGE =
  'Angehörigen-Codes nutzen Demo-Daten — im Live-Modus werden Supabase-Daten verwendet.';
