import type { PostgrestError } from '@supabase/supabase-js';

export function toGermanSupabaseError(error: PostgrestError | null): string {
  if (!error) return 'Ein unerwarteter Datenbankfehler ist aufgetreten.';

  const msg = error.message ?? '';
  if (msg.includes('Keine Berechtigung')) return msg;
  if (msg.includes('nicht gefunden')) return 'Klient:in wurde nicht gefunden.';
  if (msg.includes('Ungültiger Status')) return 'Der gewählte Status ist ungültig.';
  if (error.code === '42501') return 'Kein Zugriff auf diesen Datensatz (RLS).';
  if (error.code === 'PGRST116') return 'Datensatz wurde nicht gefunden.';

  return 'Datenbankfehler: Bitte erneut versuchen.';
}
