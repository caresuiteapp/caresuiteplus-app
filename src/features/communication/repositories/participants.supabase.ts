import type { ServiceResult } from '@/types';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { communicationFrom } from './supabaseTable';

const TABLE = 'communication_participants';

function unavailable<T>(): ServiceResult<T> {
  return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
}

export const participantsSupabaseRepository = {
  async listByThread(tenantId: string, threadId: string): Promise<ServiceResult<Record<string, unknown>[]>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();
    const { data, error } = await communicationFrom(supabase, TABLE)
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('thread_id', threadId);
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: (data ?? []) as Record<string, unknown>[] };
  },
};
