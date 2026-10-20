import type { SupabaseClient } from '@supabase/supabase-js';

/** Typed workaround bis communication_* in generierten DB-Typen enthalten sind. */
export function communicationFrom(supabase: SupabaseClient, table: string) {
  return (supabase as unknown as { from: (t: string) => ReturnType<SupabaseClient['from']> }).from(
    table,
  );
}
