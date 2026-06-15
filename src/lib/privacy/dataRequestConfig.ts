import { isDemoMode, isSupabaseConfigured } from '@/lib/supabase/config';

/**
 * DSGVO data-subject request backend readiness.
 * Live-Submit aktiv wenn Supabase konfiguriert und nicht Demo-Modus.
 * Migration 0031 muss remote angewendet sein — sonst schlägt Insert mit Schema-Fehler fehl.
 */
export function isDataSubjectRequestBackendReady(): boolean {
  return isSupabaseConfigured() && !isDemoMode();
}

export const DATA_SUBJECT_REQUEST_PREPARED_MESSAGE =
  'Online-Einreichung ist in Vorbereitung. Nutzen Sie bis dahin Support-E-Mail oder Mandanten-Admin.';
