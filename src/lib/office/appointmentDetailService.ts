import type { RoleKey, ServiceResult } from '@/types';
import type { AppointmentDetail } from '@/types/modules/appointmentDetail';
import { demoAppointments } from '@/data/demo/appointments';
import { demoClients } from '@/data/demo/clients';
import { demoEmployees } from '@/data/demo/employees';
import { enforcePermission } from '@/lib/permissions';
import { getServiceMode } from '@/lib/services/mode';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { appointmentSupabaseRepository } from '@/lib/services/repositories/appointmentRepository.supabase';

function resolveClientName(clientId: string): string {
  const client = demoClients.find((c) => c.id === clientId);
  return client ? `${client.firstName} ${client.lastName}` : 'Unbekannt';
}

function resolveEmployeeName(employeeId: string | null): string | null {
  if (!employeeId) return null;
  const employee = demoEmployees.find((e) => e.id === employeeId);
  return employee ? `${employee.firstName} ${employee.lastName}` : null;
}

function buildDetailFromDemo(
  appt: (typeof demoAppointments)[number],
): AppointmentDetail {
  return {
    id: appt.id,
    tenantId: appt.tenantId,
    clientId: appt.clientId,
    employeeId: appt.employeeId,
    title: appt.title,
    startsAt: appt.startsAt,
    endsAt: appt.endsAt,
    status: appt.status,
    location: appt.location,
    updatedAt: appt.updatedAt,
    createdAt: appt.createdAt,
    clientName: resolveClientName(appt.clientId),
    employeeName: resolveEmployeeName(appt.employeeId),
    notes:
      appt.status === 'entwurf'
        ? 'Entwurf — Termin noch nicht bestätigt.'
        : appt.status === 'in_bearbeitung'
          ? 'Terminplanung läuft — Ressourcen prüfen.'
          : null,
  };
}

export async function fetchAppointmentDetail(
  appointmentId: string,
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<AppointmentDetail>> {
  const denied = enforcePermission<AppointmentDetail>(actorRoleKey, 'office.appointments.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    const result = await appointmentSupabaseRepository.list(tenantId);
    if (!result.ok) return result;
    const row = result.data.find((a) => a.id === appointmentId);
    if (!row) return { ok: false, error: 'Termin nicht gefunden.' };
    return {
      ok: true,
      data: {
        ...row,
        createdAt: row.updatedAt,
        notes: row.status === 'entwurf' ? 'Entwurf — Termin noch nicht bestätigt.' : null,
      },
    };
  }

  await new Promise((r) => setTimeout(r, 280));

  const appt = demoAppointments.find((a) => a.id === appointmentId);
  if (!appt) {
    return { ok: false, error: 'Termin nicht gefunden.' };
  }

  return { ok: true, data: buildDetailFromDemo(appt) };
}
