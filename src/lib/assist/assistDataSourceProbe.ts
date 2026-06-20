import { visitSupabaseRepository } from '@/lib/assist/repositories/visitRepository.supabase';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { getServiceMode } from '@/lib/services/mode';
import { isMissingTableError } from '@/lib/supabase/missingtablefallback';
import { isSupabaseConfigured } from '@/lib/supabase/config';

export const ASSIST_VISITS_MISSING_BANNER_MESSAGE =
  'Die Tabelle assist_visits ist in Supabase noch nicht verfügbar. Einsätze können nicht persistent geladen oder gespeichert werden. Bitte Migration 0116 anwenden (separater Freigabe-Schritt — nicht in diesem Zwischenauftrag).';

export const ASSIST_SUPABASE_NOT_CONFIGURED_MESSAGE =
  'Supabase-Modus ist aktiv, aber keine Verbindung konfiguriert. Assist-Einsätze können nicht persistent gelesen werden.';

export type AssistDataSourceProbeResult = {
  blocking: boolean;
  title: string;
  message: string;
};

export async function probeAssistVisitPersistence(
  tenantId: string | null | undefined,
): Promise<AssistDataSourceProbeResult> {
  if (getServiceMode() !== 'supabase') {
    return { blocking: false, title: '', message: '' };
  }

  if (!isSupabaseConfigured()) {
    return {
      blocking: true,
      title: 'Persistenz nicht verfügbar',
      message: ASSIST_SUPABASE_NOT_CONFIGURED_MESSAGE,
    };
  }

  if (!tenantId) {
    return { blocking: false, title: '', message: '' };
  }

  const visitResult = await visitSupabaseRepository.list(tenantId);
  if (visitResult.ok) {
    return { blocking: false, title: '', message: '' };
  }

  if (
    visitResult.error === SERVICE_ERRORS.supabaseUnavailable ||
    isMissingTableError(visitResult.error)
  ) {
    return {
      blocking: true,
      title: 'Assist-Datenquelle blockiert',
      message: ASSIST_VISITS_MISSING_BANNER_MESSAGE,
    };
  }

  return { blocking: false, title: '', message: '' };
}
