import { getServiceMode } from '@/lib/services/mode';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { assertTenant } from '@/lib/services/serviceRunner';
import type { supabaseClientExtendedRepository as SupabaseClientExtendedRepository } from './repositories/clientExtendedRepository.supabase';

export function isDemoClientBackend(): boolean {
  return getServiceMode() === 'demo';
}

export function assertDemoTenant(tenantId: string) {
  if (!isDemoClientBackend()) return null;
  return assertTenant(tenantId, DEMO_TENANT_ID);
}

/** Lazy — Supabase-Repo erst bei Live-Modus laden (Vitest/Demo ohne React-Native-Import). */
export function getClientExtendedRepository(): typeof SupabaseClientExtendedRepository {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('./repositories/clientExtendedRepository.supabase').supabaseClientExtendedRepository;
}
