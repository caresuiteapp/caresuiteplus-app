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

export function toGermanSupabaseError(error: PostgrestError | null): string {
  if (!error) return 'Ein unerwarteter Datenbankfehler ist aufgetreten.';

  const msg = error.message ?? '';
  if (msg.includes('Keine Berechtigung')) return msg;
  if (msg.includes('nicht gefunden')) return 'Klient:in wurde nicht gefunden.';
  if (msg.includes('Ungültiger Status')) return 'Der gewählte Status ist ungültig.';
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
