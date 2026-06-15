import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

type TypedClient = SupabaseClient<Database>;

/**
 * Query tables not yet present in generated Database types (e.g. migration 0014 vs remote drift).
 * Runtime queries still target Supabase; only TypeScript is relaxed.
 */
export function fromUnknownTable(client: TypedClient, table: string) {
  return (client as SupabaseClient).from(table);
}
