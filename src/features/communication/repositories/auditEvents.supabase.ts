import type { ServiceResult } from '@/types';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { communicationFrom } from './supabaseTable';

const TABLE = 'communication_audit_events';

function unavailable<T>(): ServiceResult<T> {
  return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
}

export const auditEventsSupabaseRepository = {
  async insert(tenantId: string, input: Record<string, unknown>): Promise<ServiceResult<{ id: string }>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();
    const { data, error } = await communicationFrom(supabase, TABLE)
      .insert({ tenant_id: tenantId, ...input })
      .select('id')
      .single();
    if (error || !data) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: { id: String((data as { id: string }).id) } };
  },
};
