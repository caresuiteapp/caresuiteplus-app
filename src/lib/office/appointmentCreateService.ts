import type { RoleKey, ServiceResult } from '@/types';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { enforcePermission } from '@/lib/permissions';
import { getServiceMode } from '@/lib/services/mode';
import { appointmentSupabaseRepository } from '@/lib/services/repositories/appointmentRepository.supabase';
import { assertTenantForMode } from '@/lib/tenant/tenantResolver';

export type AppointmentCreateInput = {
  title: string;
  clientName?: string;
  startsAt?: string;
  location?: string;
};

/** WP206 — Termin anlegen (Demo + Supabase) */
export async function createAppointment(
  tenantId: string,
  input: AppointmentCreateInput,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<{ id: string }>> {
  const denied = enforcePermission<{ id: string }>(actorRoleKey, 'office.appointments.view' as never);
  if (denied) return denied;
  if (!input.title.trim()) return { ok: false, error: 'Titel ist Pflicht.' };

  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return { ok: false, error: tenantErr.error };

  if (getServiceMode() === 'supabase') {
    return appointmentSupabaseRepository.create(tenantId, {
      title: input.title,
      clientName: input.clientName,
      startsAt: input.startsAt,
      location: input.location,
    });
  }

  if (tenantId !== DEMO_TENANT_ID) return { ok: false, error: 'Mandant nicht gefunden.' };

  await new Promise((r) => setTimeout(r, 220));
  return { ok: true, data: { id: `appt-${Date.now()}` } };
}
