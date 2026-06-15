import type { ServiceResult } from '@/types';
import type { KIMMailbox } from '@/types/modules/ti';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { SERVICE_ERRORS } from '@/lib/services/errors';

const TABLE = 'kim_mailboxes';

function unavailable<T>(): ServiceResult<T> {
  return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
}

function mapRow(row: Record<string, unknown>): KIMMailbox {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    address: String(row.address ?? ''),
    displayName: String(row.display_name ?? ''),
    providerId: String(row.provider_id),
    unreadCount: Number(row.unread_count ?? 0),
    lastSyncAt: (row.last_sync_at as string | null) ?? null,
    syncStatus: (row.sync_status as KIMMailbox['syncStatus']) ?? 'idle',
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
  };
}

export const kimMailboxesSupabaseRepository = {
  async list(tenantId: string): Promise<ServiceResult<KIMMailbox[]>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();
    const { data, error } = await supabase
      .from(TABLE as 'integration_providers')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('updated_at', { ascending: false });
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: (data ?? []).map((row) => mapRow(row as Record<string, unknown>)) };
  },
};
