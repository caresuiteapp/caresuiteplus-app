import { isDemoMode, isSupabaseConfigured } from '@/lib/supabase/config';

/**
 * Employee full-profile detail live readiness.
 * Live-Mapping für department/start_date/notes ist code-ready in Supabase-Modus;
 * Migration 0033 muss remote angewendet sein — sonst meldet Mapper Schema-Fehler.
 */
export function isEmployeeDetailLiveReady(): boolean {
  return isSupabaseConfigured() && !isDemoMode();
}

export const EMPLOYEE_DETAIL_PREPARED_MESSAGE =
  'Erweiterte Mitarbeitenden-Profile (Abteilung, Eintrittsdatum, HR-Notizen) sind im Demo-Modus angereichert. Live-Supabase mappt diese Felder nach Migration 0033 — kein Fake-Vollprofil.';
