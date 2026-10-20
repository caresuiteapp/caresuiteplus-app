import { isDemoMode, isSupabaseConfigured } from '@/lib/supabase/config';

/** Office dashboard — demo snapshot; Live-Mandantenkpi folgt separaten Migrationen. */
export function isOfficeDashboardLiveReady(): boolean {
  return isSupabaseConfigured() && !isDemoMode();
}

export const OFFICE_DASHBOARD_PREPARED_MESSAGE =
  'Office-Dashboard nutzt Demo-Kennzahlen. Live-Mandanten-KPIs und Dokument-Upload folgen nach Remote-Migrationen — kein Fake-Live.';
