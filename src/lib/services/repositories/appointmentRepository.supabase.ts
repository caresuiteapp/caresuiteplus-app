import type { WorkflowStatus } from '@/types';
import type { ServiceResult } from '@/types';
import type { AppointmentListItem } from '@/types/modules/appointmentList';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { SERVICE_ERRORS } from '../errors';

function getClient() {
  return getSupabaseClient();
}

function unavailable<T>(): ServiceResult<T> {
  return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
}

/** WP210 — Live Supabase Repository (appointments) */
export const appointmentSupabaseRepository = {
  wpNumber: 210 as const,

  async list(tenantId: string): Promise<ServiceResult<AppointmentListItem[]>> {
    const supabase = getClient();
    if (!supabase) return unavailable();
    const { data, error } = await fromUnknownTable(supabase, 'appointments')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('starts_at', { ascending: true });
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return {
      ok: true,
      data: (data ?? []).map((row) => {
        const r = row as Record<string, unknown>;
        return {
          id: String(r.id),
          tenantId: String(r.tenant_id),
          clientId: String(r.client_name ?? ''),
          employeeId: null,
          title: String(r.title ?? ''),
          clientName: String(r.client_name ?? ''),
          employeeName: r.employee_name ? String(r.employee_name) : null,
          location: r.location ? String(r.location) : null,
          startsAt: String(r.starts_at ?? r.created_at),
          endsAt: String(r.ends_at ?? r.starts_at ?? r.created_at),
          status: r.status as WorkflowStatus,
          updatedAt: String(r.updated_at),
        };
      }),
    };
  },

  async create(
    tenantId: string,
    input: { title: string; clientName?: string; startsAt?: string; location?: string },
  ): Promise<ServiceResult<{ id: string }>> {
    const supabase = getClient();
    if (!supabase) return unavailable();
    const { data, error } = await fromUnknownTable(supabase, 'appointments')
      .insert({
        tenant_id: tenantId,
        title: input.title.trim(),
        client_name: input.clientName?.trim() ?? null,
        location: input.location?.trim() ?? null,
        starts_at: input.startsAt ?? new Date().toISOString(),
        status: 'entwurf',
      } as Record<string, unknown>)
      .select('id')
      .single();
    if (error || !data) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: { id: (data as { id: string }).id } };
  },
};
