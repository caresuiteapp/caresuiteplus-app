import type { PostgrestError } from '@supabase/supabase-js';

const GENERIC_DB_ERROR = 'Datenbankfehler: Bitte erneut versuchen.';

function isDevEnvironment(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.EXPO_PUBLIC_DEMO_MODE === 'true';
}

export function toGermanSupabaseError(error: PostgrestError | null): string {
  if (!error) return 'Ein unerwarteter Datenbankfehler ist aufgetreten.';

  const msg = error.message ?? '';
  if (msg.includes('Keine Berechtigung')) return msg;
  if (msg.includes('nicht gefunden')) return 'Klient:in wurde nicht gefunden.';
  if (msg.includes('Ungültiger Status')) return 'Der gewählte Status ist ungültig.';
  if (error.code === '42501') return 'Kein Zugriff auf diesen Datensatz (RLS).';
  if (error.code === 'PGRST116') return 'Datensatz wurde nicht gefunden.';
  if (error.code === 'PGRST205' || msg.includes('Could not find the table')) {
    return isDevEnvironment()
      ? `Tabelle nicht verfügbar (${msg})`
      : GENERIC_DB_ERROR;
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
