export { supabaseClientRepository as clientRepository } from '../clients/clientRepository.supabase';
import { getSupabaseClient } from '@/lib/supabase/client';

/** WP170 — Client-Repository mit Live-Supabase-Verdrahtung */
export const CLIENT_RLS_WP = 170 as const;
export const CLIENT_REPOSITORY_TABLE = 'clients' as const;

export function isClientRepositoryAvailable(): boolean {
  return getSupabaseClient() !== null;
}
