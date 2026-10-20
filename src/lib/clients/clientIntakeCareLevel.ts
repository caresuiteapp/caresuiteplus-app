import type { Database } from '@/lib/supabase/database.types';

type DbCareLevel = Database['public']['Enums']['care_level'];

const DB_CARE_LEVELS = new Set<string>([
  'none',
  'pg1',
  'pg2',
  'pg3',
  'pg4',
  'pg5',
  'unknown',
]);

const CATALOG_TO_DB: Record<string, DbCareLevel | null> = {
  kein: 'none',
  unbekannt: 'unknown',
  beantragt: null,
  abgelehnt: null,
};

/**
 * The intake catalog contains workflow values (for example "beantragt") that
 * are intentionally not members of the clients.care_level enum. Their exact
 * workflow state is persisted in the extended insurance record; the compact
 * clients row only receives a valid database enum value.
 */
export function normalizeIntakeCareLevelForDb(value: string): DbCareLevel | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (Object.prototype.hasOwnProperty.call(CATALOG_TO_DB, trimmed)) {
    return CATALOG_TO_DB[trimmed] ?? null;
  }

  return DB_CARE_LEVELS.has(trimmed) ? (trimmed as DbCareLevel) : null;
}
