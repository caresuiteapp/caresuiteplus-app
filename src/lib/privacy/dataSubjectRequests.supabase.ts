import type { ServiceResult } from '@/types';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import type {
  DataSubjectRequest,
  SubmitDataSubjectRequestInput,
} from './dataSubjectRequest.types';

const TABLE = 'data_subject_requests';

function unavailable<T>(): ServiceResult<T> {
  return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
}

function mapRow(row: Record<string, unknown>): DataSubjectRequest {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    profileId: row.profile_id ? String(row.profile_id) : null,
    requestType: row.request_type as DataSubjectRequest['requestType'],
    status: row.status as DataSubjectRequest['status'],
    requesterName: row.requester_name ? String(row.requester_name) : null,
    requesterEmail: row.requester_email ? String(row.requester_email) : null,
    verificationNotes: row.verification_notes ? String(row.verification_notes) : null,
    requestNumber: row.request_number ? String(row.request_number) : null,
    receivedAt: row.received_at ? String(row.received_at) : null,
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
  };
}

export const dataSubjectRequestsSupabaseRepository = {
  async submit(
    tenantId: string,
    input: SubmitDataSubjectRequestInput,
  ): Promise<ServiceResult<DataSubjectRequest>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from(TABLE)
      .insert({
        tenant_id: tenantId,
        profile_id: input.profileId ?? null,
        request_type: input.requestType,
        status: 'queued',
        requester_name: input.requesterName.trim(),
        requester_email: input.requesterEmail.trim(),
        verification_notes: input.verificationNotes?.trim() || null,
        received_at: now,
        metadata: { source: 'caresuite_app', channel: 'settings' },
      })
      .select('*')
      .single();

    if (error || !data) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: mapRow(data as Record<string, unknown>) };
  },

  async listOwn(tenantId: string, profileId: string): Promise<ServiceResult<DataSubjectRequest[]>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();

    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false });

    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return {
      ok: true,
      data: (data ?? []).map((row) => mapRow(row as Record<string, unknown>)),
    };
  },

  async listForTenant(tenantId: string): Promise<ServiceResult<DataSubjectRequest[]>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();

    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return {
      ok: true,
      data: (data ?? []).map((row) => mapRow(row as Record<string, unknown>)),
    };
  },

  async updateStatus(
    tenantId: string,
    requestId: string,
    status: DataSubjectRequest['status'],
  ): Promise<ServiceResult<DataSubjectRequest>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();

    const now = new Date().toISOString();
    const patch = {
      status,
      updated_at: now,
      ...(status === 'completed' ? { completed_at: now } : {}),
    };

    const { data, error } = await supabase
      .from(TABLE)
      .update(patch)
      .eq('tenant_id', tenantId)
      .eq('id', requestId)
      .select('*')
      .single();

    if (error || !data) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: mapRow(data as Record<string, unknown>) };
  },
};
