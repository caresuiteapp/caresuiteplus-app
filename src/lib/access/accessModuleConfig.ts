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
  'In der lokalen Vorschau werden Beispieldaten angezeigt. Im Live-Betrieb werden ausschließlich Mandantendaten aus Supabase geladen.';

export const CLIENT_PORTAL_ACCESS_PREPARED_MESSAGE =
  'In der lokalen Vorschau werden Beispielcodes angezeigt. Im Live-Betrieb werden ausschließlich Mandantendaten verwendet.';

export const RELATIVE_PORTAL_ACCESS_PREPARED_MESSAGE =
  'In der lokalen Vorschau werden Beispielcodes angezeigt. Im Live-Betrieb werden ausschließlich Mandantendaten verwendet.';
