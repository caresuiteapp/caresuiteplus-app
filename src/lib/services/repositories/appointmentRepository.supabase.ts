import type { WorkflowStatus } from '@/types';
import type { ServiceResult } from '@/types';
import type { AppointmentListItem } from '@/types/modules/appointmentList';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { SERVICE_ERRORS } from '../errors';
import { readAllVisitPages } from '@/lib/assist/repositories/visitListPagination';
import { isUuid } from '@/lib/validation/uuid';

export type AppointmentMutationInput = {
  title: string; clientName?: string | null; employeeName?: string | null;
  startsAt?: string; endsAt?: string; location?: string | null;
  status?: WorkflowStatus;

};

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
    const [appointments, bindings] = await Promise.all([
      readAllVisitPages((from, to) => fromUnknownTable(supabase, 'appointments')
        .select('*').eq('tenant_id', tenantId)
        .order('starts_at', { ascending: true }).order('id', { ascending: true }).range(from, to)),
      readAllVisitPages((from, to) => fromUnknownTable(supabase, 'calendar_events')
        .select('source_id, related_client_id, related_employee_id')
        .eq('tenant_id', tenantId).eq('source_type', 'appointment').is('archived_at', null)
        .order('id', { ascending: true }).range(from, to)),
    ]);
    const { data, error } = appointments;
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    if (bindings.error) return { ok: false, error: toGermanSupabaseError(bindings.error) };
    const bySource = new Map((bindings.data ?? []).map(value => { const row = value as Record<string, unknown>; return [String(row.source_id), row]; }));
    return {
      ok: true,
      data: (data ?? []).map((row) => {
        const r = row as Record<string, unknown>;
        const binding = bySource.get(String(r.id));
        return {
          id: String(r.id),
          tenantId: String(r.tenant_id),
          clientId: binding?.related_client_id ? String(binding.related_client_id) : '',
          employeeId: binding?.related_employee_id ? String(binding.related_employee_id) : null,
          title: String(r.title ?? ''),
          clientName: isUuid(String(r.client_name ?? '')) ? 'Zuordnung prüfen' : String(r.client_name ?? ''),
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
    input: AppointmentMutationInput,
  ): Promise<ServiceResult<{ id: string }>> {
    const supabase = getClient();
    if (!supabase) return unavailable();
    const { data, error } = await fromUnknownTable(supabase, 'appointments')
      .insert({
        tenant_id: tenantId,
        title: input.title.trim(),
        client_name: input.clientName?.trim() || null,
        employee_name: input.employeeName?.trim() || null,
        location: input.location?.trim() ?? null,
        starts_at: input.startsAt ?? new Date().toISOString(),
        ends_at: input.endsAt ?? input.startsAt ?? new Date().toISOString(),
        status: input.status ?? 'entwurf',
      } as Record<string, unknown>)
      .select('id')
      .single();
    if (error || !data) return { ok: false, error: toGermanSupabaseError(error) };
    const id = (data as { id: string }).id;
    return { ok: true, data: { id } };
  },
  async update(tenantId: string, id: string, input: AppointmentMutationInput): Promise<ServiceResult<{ id: string; status?: WorkflowStatus }>> {
    const supabase = getClient();
    if (!supabase) return unavailable();
    const patch = { title: input.title.trim(), client_name: input.clientName?.trim() || null,
      employee_name: input.employeeName?.trim() || null, location: input.location?.trim() || null,
      starts_at: input.startsAt, ends_at: input.endsAt,
      ...(input.status ? { status: input.status } : {}) };
    const { data, error } = await fromUnknownTable(supabase, 'appointments').update(patch)
      .eq('tenant_id', tenantId).eq('id', id).select('id, status').maybeSingle();
    if (error || !data) return { ok: false, error: error ? toGermanSupabaseError(error) : 'Termin wurde nicht geändert. Bitte Zugriff prüfen.' };
    const row = data as { id: string; status?: WorkflowStatus };
    if (row.id !== id) return { ok: false, error: 'Terminänderung konnte nicht bestätigt werden.' };
    return { ok: true, data: { id: row.id, status: row.status } };
  },
};
