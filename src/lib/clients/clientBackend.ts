import type { supabaseClientExtendedRepository as SupabaseClientExtendedRepository } from './repositories/clientExtendedRepository.supabase';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { isDemoMode } from '@/lib/supabase/config';

export function isDemoClientBackend(): boolean {
  return isDemoMode();
}

export function assertDemoTenant(tenantId: string) {
  return tenantId === DEMO_TENANT_ID
    ? null
    : { ok: false as const, error: 'Mandant nicht gefunden.' };
}

/** Lazy — Supabase-Repo erst bei Live-Modus laden (Vitest ohne React-Native-Import). */
export function getClientExtendedRepository(): typeof SupabaseClientExtendedRepository {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('./repositories/clientExtendedRepository.supabase').supabaseClientExtendedRepository;
}
