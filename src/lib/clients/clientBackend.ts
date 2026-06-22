import type { supabaseClientExtendedRepository as SupabaseClientExtendedRepository } from './repositories/clientExtendedRepository.supabase';

export function isDemoClientBackend(): boolean {
  return false;
}

export function assertDemoTenant(_tenantId: string) {
  return null;
}

/** Lazy — Supabase-Repo erst bei Live-Modus laden (Vitest ohne React-Native-Import). */
export function getClientExtendedRepository(): typeof SupabaseClientExtendedRepository {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('./repositories/clientExtendedRepository.supabase').supabaseClientExtendedRepository;
}
