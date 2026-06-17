import { getServiceMode } from '@/lib/services/mode';

export function isAccessManagementLiveReady(): boolean {
  return false;
}

export function isClientPortalAccessLiveReady(): boolean {
  return getServiceMode() === 'supabase';
}

export const ACCESS_MANAGEMENT_PREPARED_MESSAGE =
  'Zugangsverwaltung nutzt Demo-Daten — Live-Supabase-Sync und Mandanten-RLS sind in Vorbereitung.';

export const CLIENT_PORTAL_ACCESS_LIVE_MESSAGE =
  'Portal-Zugänge werden live aus Supabase geladen — Codes werden in der Klientenakte verwaltet.';
