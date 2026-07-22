import type { PostgrestError } from '@supabase/supabase-js';

const GENERIC_DB_ERROR = 'Datenbankfehler: Bitte erneut versuchen.';
const MISSING_SCHEMA_ERROR =
  'Datenbank-Schema unvollständig. Leistungsarten konnten nicht gespeichert werden — bitte erneut versuchen.';

function isDevEnvironment(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.EXPO_PUBLIC_DEMO_MODE === 'true';
}

export function isSupabaseMissingTableError(error: PostgrestError | null): boolean {
  if (!error) return false;
  const msg = error.message ?? '';
  return error.code === 'PGRST205' || msg.includes('Could not find the table');
}

export function isSupabaseRlsError(error: PostgrestError | unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const record = error as { code?: string; message?: string };
  if (record.code === '42501' || record.code === 'PGRST301') return true;
  const msg = record.message ?? '';
  return msg.includes('permission denied') || msg.includes('row-level security');
}

/** Column/relation drift or invalid filter values (e.g. empty tenant UUID). */
export function isSupabaseSchemaMismatchError(error: PostgrestError | unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const record = error as { code?: string; message?: string };
  if (record.code === '42703' || record.code === 'PGRST204' || record.code === '22P02') {
    return true;
  }
  const msg = record.message ?? '';
  return (
    (msg.includes('column') && msg.includes('does not exist')) ||
    msg.includes('invalid input syntax for type uuid') ||
    (msg.includes('Could not find the') && msg.includes('column'))
  );
}

/** Detects missing-table errors on translated or raw service error strings. */
export function isMissingTableServiceError(message: string): boolean {
  return (
    message.includes('PGRST205') ||
    message.includes('Could not find the table') ||
    message.includes('schema cache') ||
    message.includes('Tabelle nicht verfügbar') ||
    message.includes('Datenbank-Schema unvollständig') ||
    message.includes('Datenbankschema unvollständig')
  );
}

export function toGermanSupabaseError(error: PostgrestError | null): string {
  if (!error) return 'Ein unerwarteter Datenbankfehler ist aufgetreten.';

  const msg = error.message ?? '';
  if (msg.includes('Keine Berechtigung')) return msg;
  if (msg.includes('nicht gefunden')) return 'Klient:in wurde nicht gefunden.';
  if (msg.includes('Ungültiger Status')) return 'Der gewählte Status ist ungültig.';
  if (
    error.code === '23503' &&
    (msg.includes('workforce_time_entry_reviews_employee_id_fkey') ||
      msg.includes('keinem gültigen Mitarbeiterprofil zugeordnet'))
  ) {
    return 'Arbeitszeiteintrag ist keinem gültigen Mitarbeiterprofil zugeordnet. Bitte die Mitarbeitenden-Zuordnung prüfen.';
  }
  if (error.code === '42501' || error.code === 'PGRST301') {
    return 'Kein Zugriff auf diesen Datensatz (RLS).';
  }
  if (error.code === 'PGRST116') return 'Datensatz wurde nicht gefunden.';
  if (isSupabaseMissingTableError(error)) {
    if (msg.includes('client_care_contexts')) return MISSING_SCHEMA_ERROR;
    return isDevEnvironment()
      ? `Tabelle nicht verfügbar (${msg})`
      : MISSING_SCHEMA_ERROR;
  }
  if (msg.includes('invalid input syntax for type uuid')) {
    return 'Ungültige Mitarbeiter-ID. Bitte Personalnummer oder interne UUID verwenden.';
  }
  if (error.code === '22P02') {
    return isDevEnvironment()
      ? `Ungültiger Datenbankwert (${msg})`
      : 'Ein Filterwert passt nicht zum Datenbankschema. Bitte erneut versuchen.';
  }
  if (error.code === '42703' || (msg.includes('column') && msg.includes('does not exist'))) {
    return GENERIC_DB_ERROR;
  }
  if (error.code === 'PGRST204' || msg.includes('Could not find the') && msg.includes('column')) {
    return isDevEnvironment()
      ? `Datenbankschema passt nicht (${msg})`
      : GENERIC_DB_ERROR;
  }
  if (error.code === '42P01' || msg.includes('relation') && msg.includes('does not exist')) {
    return isDevEnvironment()
      ? `Datenbankschema unvollständig (${msg})`
      : GENERIC_DB_ERROR;
  }

  if (isDevEnvironment() && msg) {
    return `${GENERIC_DB_ERROR} [${error.code ?? 'unknown'}: ${msg}]`;
  }

  return GENERIC_DB_ERROR;
}
