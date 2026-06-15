import type { ServiceResult } from '@/types';
import type { CommunicationSettings } from '../communication.types';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { mapCommunicationSettingsRow } from './communicationMappers';
import { communicationFrom } from './supabaseTable';

const TABLE = 'communication_settings';

function unavailable<T>(): ServiceResult<T> {
  return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
}

export const settingsSupabaseRepository = {
  async get(tenantId: string): Promise<ServiceResult<CommunicationSettings | null>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();
    const { data, error } = await communicationFrom(supabase, TABLE)
      .select('*')
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    if (!data) return { ok: true, data: null };
    return { ok: true, data: mapCommunicationSettingsRow(data as Record<string, unknown>) };
  },

  async upsert(
    tenantId: string,
    patch: Partial<Record<string, unknown>>,
  ): Promise<ServiceResult<CommunicationSettings>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();
    const { data, error } = await communicationFrom(supabase, TABLE)
      .upsert({ tenant_id: tenantId, ...patch }, { onConflict: 'tenant_id' })
      .select('*')
      .single();
    if (error || !data) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: mapCommunicationSettingsRow(data as Record<string, unknown>) };
  },
};
