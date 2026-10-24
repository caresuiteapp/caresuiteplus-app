import { toGermanSupabaseError } from '@/lib/supabase/errors';

/** SQL 42501 does not identify a foreign tenant; it also covers missing table privileges. */
export function qmReadError(error: Parameters<typeof toGermanSupabaseError>[0]): string {
  if (error && typeof error === 'object' && 'code' in error && error.code === '42501') {
    return 'Der Zugriff auf diesen QM-Bereich ist nicht freigegeben.';
  }
  return toGermanSupabaseError(error);
}
