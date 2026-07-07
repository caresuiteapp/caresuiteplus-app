import type { RoleKey, ServiceResult } from '@/types';
import type { AppointmentListItem } from '@/types/modules/appointmentList';
import { demoAppointments } from '@/data/demo/appointments';
import { demoClients } from '@/data/demo/clients';
import { demoEmployees } from '@/data/demo/employees';
import { enforcePermission } from '@/lib/permissions';
import { getServiceMode } from '@/lib/services/mode';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { appointmentSupabaseRepository } from '@/lib/services/repositories/appointmentRepository.supabase';
import { runService } from '@/lib/services/serviceRunner';
import { demoOnlyDelay } from '@/lib/services/demoDelay';

const SIMULATED_DELAY_MS = 350;

function resolveClientName(clientId: string): string {
  const client = demoClients.find((c) => c.id === clientId);
  return client ? `${client.firstName} ${client.lastName}` : 'Unbekannt';
}

function resolveEmployeeName(employeeId: string | null): string | null {
  if (!employeeId) return null;
  const employee = demoEmployees.find((e) => e.id === employeeId);
  return employee ? `${employee.firstName} ${employee.lastName}` : null;
}

export async function fetchAppointmentList(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
  options?: { simulateError?: boolean; simulateEmpty?: boolean },
): Promise<ServiceResult<AppointmentListItem[]>> {
  const denied = enforcePermission<AppointmentListItem[]>(
    actorRoleKey,
    'office.appointments.view',
  );
  if (denied) return denied;

  return runService(async () => {
    await demoOnlyDelay(SIMULATED_DELAY_MS);

    if (options?.simulateError) {
      return {
        ok: false,
        error: 'Termine konnten nicht geladen werden. Bitte erneut versuchen.',
      };
    }

    const tenantBlock = guardServiceTenant(tenantId);
    if (tenantBlock) return tenantBlock;

    if (getServiceMode() === 'supabase') {
      return appointmentSupabaseRepository.list(tenantId);
    }

    if (options?.simulateEmpty) {
      return { ok: true, data: [] };
    }

    const data: AppointmentListItem[] = demoAppointments.map((appt) => ({
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
      clientName: resolveClientName(appt.clientId),
      employeeName: resolveEmployeeName(appt.employeeId),
    }));

    return { ok: true, data };
  });
}
