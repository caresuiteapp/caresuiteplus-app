import type { ServiceResult } from '@/types';
import type { RoleKey } from '@/types/core/auth';
import type { WorkflowStatus } from '@/types/core/base';
import type { Appointment } from '@/types/modules/office';
import type { PortalClientAppointmentDetail } from '@/types/portal/client';
import type { PortalAppointmentDetail } from '@/types/portal/employee';
import { demoAppointments } from '@/data/demo/appointments';
import { getDemoAssignmentSeeds } from '@/data/demo/assistAssignments';
import { demoClients } from '@/data/demo/clients';
import { demoEmployees } from '@/data/demo/employees';
import { getDemoClientDetail } from '@/data/demo/clientDetails';
import { enforcePermission } from '@/lib/permissions';
import { getServiceMode } from '@/lib/services/mode';
import { runService } from '@/lib/services/serviceRunner';
import type { CalendarEvent } from '@/types/modules/calendarEvent';
import {
  getPortalCalendarEvents,
  getEmployeeCalendarEvents,
  portalEventsToAppointmentItems,
} from '@/lib/calendar/calendarEventService';
import {
  fetchLivePortalAppointmentsForClient,
  fetchLivePortalAppointmentsForEmployee,
  fetchLivePortalClientAppointmentDetail,
} from './portalAppointmentsLiveService';
import { getPortalProfileLink, resolvePortalScope } from './portalVisibility';

export type PortalAppointmentsPortalContext = {
  tenantId?: string | null;
  clientId?: string | null;
  employeeId?: string | null;
};

export type PortalAppointmentItem = Pick<
  Appointment,
  'id' | 'title' | 'startsAt' | 'endsAt' | 'status' | 'location' | 'clientId' | 'employeeId'
> & {
  clientName?: string;
};

const SIMULATED_DELAY_MS = 350;

function mapCalendarToPortalItems(events: CalendarEvent[]): PortalAppointmentItem[] {
  return portalEventsToAppointmentItems(events).map((item) => ({
    id: item.id,
    title: item.title,
    startsAt: item.startsAt,
    endsAt: item.endsAt,
    status: item.status as WorkflowStatus,
    location: item.location ?? '',
    clientId: item.clientId ?? '',
    employeeId: item.employeeId,
  }));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveClientName(clientId: string): string {
  const client = demoClients.find((c) => c.id === clientId);
  return client ? `${client.firstName} ${client.lastName}` : 'Unbekannt';
}

function resolveEmployeeName(employeeId: string | null): string | null {
  if (!employeeId) return null;
  const employee = demoEmployees.find((e) => e.id === employeeId);
  return employee ? `${employee.firstName} ${employee.lastName}` : null;
}

function resolveEmployeePhone(employeeId: string | null): string | null {
  if (!employeeId) return null;
  return demoEmployees.find((e) => e.id === employeeId)?.phone ?? null;
}

function isClientPortalRole(roleKey: RoleKey | null): boolean {
  return roleKey === 'client_portal' || roleKey === 'family_portal';
}

export async function fetchPortalAppointments(
  profileId: string,
  roleKey: RoleKey | null,
  portalContext?: PortalAppointmentsPortalContext,
  options?: { simulateError?: boolean; simulateEmpty?: boolean },
): Promise<ServiceResult<PortalAppointmentItem[]>> {
  if (options?.simulateError) {
    return {
      ok: false,
      error: 'Termine konnten nicht geladen werden. Bitte erneut versuchen.',
    };
  }

  if (!profileId || !roleKey) {
    return { ok: false, error: 'Kein Profil für Terminabruf vorhanden.' };
  }

  const employeeDenied = enforcePermission<PortalAppointmentItem[]>(
    roleKey,
    'portal.employee.appointments.view',
  );
  if (employeeDenied && roleKey === 'employee_portal') return employeeDenied;

  const clientDenied = enforcePermission<PortalAppointmentItem[]>(
    roleKey,
    'portal.client.appointments.view',
  );
  if (clientDenied && isClientPortalRole(roleKey)) return clientDenied;

  if (options?.simulateEmpty) {
    return { ok: true, data: [] };
  }

  const scope = resolvePortalScope(roleKey);
  const tenantId = portalContext?.tenantId ?? null;
  const clientId = portalContext?.clientId ?? null;
  const employeeId = portalContext?.employeeId ?? null;

  if (getServiceMode() === 'supabase') {
    if ((scope === 'portal_client' || scope === 'portal_family') && tenantId?.trim() && clientId?.trim()) {
      const calendar = await getPortalCalendarEvents(tenantId, {
        portalType: 'client',
        clientId,
      });
      if (calendar.ok && calendar.data.length > 0) {
        return { ok: true, data: mapCalendarToPortalItems(calendar.data) };
      }
      return fetchLivePortalAppointmentsForClient(tenantId, clientId);
    }
    if (scope === 'portal_employee' && tenantId?.trim() && employeeId?.trim()) {
      const calendar = await getEmployeeCalendarEvents(tenantId, employeeId);
      if (calendar.ok && calendar.data.length > 0) {
        return { ok: true, data: mapCalendarToPortalItems(calendar.data) };
      }
      return fetchLivePortalAppointmentsForEmployee(tenantId, employeeId);
    }
    return { ok: true, data: [] };
  }

  return runService(async () => {
    await delay(SIMULATED_DELAY_MS);

    const link = getPortalProfileLink(profileId);

    let filtered = demoAppointments;

    if (scope === 'portal_employee' && link.employeeId) {
      filtered = demoAppointments.filter((a) => a.employeeId === link.employeeId);
    } else if ((scope === 'portal_client' || scope === 'portal_family') && link.clientId) {
      filtered = demoAppointments.filter((a) => a.clientId === link.clientId);
    }

    const data: PortalAppointmentItem[] = filtered.map((appt) => ({
      id: appt.id,
      title: appt.title,
      startsAt: appt.startsAt,
      endsAt: appt.endsAt,
      status: appt.status,
      location: appt.location,
      clientId: appt.clientId,
      employeeId: appt.employeeId,
      clientName: resolveClientName(appt.clientId),
    }));

    return { ok: true, data };
  });
}

const ASSIGNMENT_TASKS: Record<string, string[]> = {
  'assign-001': ['Einkauf erledigen', 'Spaziergang im Park', 'Kurznotiz dokumentieren'],
  'assign-003': ['Küche reinigen', 'Wäsche sortieren', 'Lebensmittel prüfen'],
};

export async function fetchPortalAppointmentDetail(
  appointmentId: string,
  profileId: string,
  roleKey: RoleKey | null,
): Promise<ServiceResult<PortalAppointmentDetail>> {
  const denied = enforcePermission<PortalAppointmentDetail>(
    roleKey,
    'portal.employee.appointments.view',
  );
  if (denied && roleKey === 'employee_portal') return denied;

  return runService(async () => {
    await delay(SIMULATED_DELAY_MS);

    if (!profileId || !roleKey) {
      return { ok: false, error: 'Kein Profil für Einsatzabruf vorhanden.' };
    }

    const appt = demoAppointments.find((a) => a.id === appointmentId);
    if (!appt) {
      return { ok: false, error: 'Einsatz nicht gefunden.' };
    }

    const scope = resolvePortalScope(roleKey);
    const link = getPortalProfileLink(profileId);

    if (scope === 'portal_employee' && link.employeeId && appt.employeeId !== link.employeeId) {
      return { ok: false, error: 'Dieser Einsatz ist Ihnen nicht zugewiesen.' };
    }

    if (
      (scope === 'portal_client' || scope === 'portal_family') &&
      link.clientId &&
      appt.clientId !== link.clientId
    ) {
      return { ok: false, error: 'Dieser Termin ist Ihnen nicht zugeordnet.' };
    }

    const assignment = getDemoAssignmentSeeds().find((a) => a.appointmentId === appointmentId);
    const clientDetail = getDemoClientDetail(appt.clientId);
    const canStart =
      assignment != null &&
      (assignment.status === 'aktiv' || assignment.status === 'in_bearbeitung');

    return {
      ok: true,
      data: {
        id: appt.id,
        assignmentId: assignment?.id ?? null,
        title: appt.title,
        startsAt: appt.startsAt,
        endsAt: appt.endsAt,
        status: appt.status,
        location: appt.location,
        clientId: appt.clientId,
        clientName: resolveClientName(appt.clientId),
        clientPhone: clientDetail?.primaryContactPhone ?? null,
        notes: assignment?.notes ?? null,
        tasks: assignment ? (ASSIGNMENT_TASKS[assignment.id] ?? []) : [],
        canStartExecution: canStart,
        executionRoute: assignment ? `/portal/employee/assignments/${assignment.id}/execute` : null,
      },
    };
  });
}

const CLIENT_PREP_NOTES: Record<string, string> = {
  'appt-001': 'Bitte Zutritt über Hausmeister abstimmen. Schlüssel liegt beim Nachbarn.',
  'appt-004': 'Spaziergang bei gutem Wetter — wetterfeste Kleidung bereithalten.',
};

export async function fetchPortalClientAppointmentDetail(
  appointmentId: string,
  profileId: string,
  roleKey: RoleKey | null,
  portalContext?: PortalAppointmentsPortalContext,
): Promise<ServiceResult<PortalClientAppointmentDetail>> {
  const denied = enforcePermission<PortalClientAppointmentDetail>(
    roleKey,
    'portal.client.appointments.view',
  );
  if (denied && isClientPortalRole(roleKey)) return denied;

  if (!profileId || !roleKey) {
    return { ok: false, error: 'Kein Profil für Terminabruf vorhanden.' };
  }

  const tenantId = portalContext?.tenantId ?? null;
  const clientId = portalContext?.clientId ?? null;

  if (getServiceMode() === 'supabase' && tenantId?.trim() && clientId?.trim()) {
    return fetchLivePortalClientAppointmentDetail(tenantId, clientId, appointmentId);
  }

  return runService(async () => {
    await delay(SIMULATED_DELAY_MS);

    const appt = demoAppointments.find((a) => a.id === appointmentId);
    if (!appt) {
      return { ok: false, error: 'Termin nicht gefunden.' };
    }

    const link = getPortalProfileLink(profileId);
    if (link.clientId && appt.clientId !== link.clientId) {
      return { ok: false, error: 'Dieser Termin ist Ihnen nicht zugeordnet.' };
    }

    const canRequestChange =
      appt.status === 'aktiv' ||
      appt.status === 'entwurf' ||
      appt.status === 'in_bearbeitung';

    return {
      ok: true,
      data: {
        id: appt.id,
        title: appt.title,
        startsAt: appt.startsAt,
        endsAt: appt.endsAt,
        status: appt.status,
        location: appt.location,
        caregiverName: resolveEmployeeName(appt.employeeId),
        caregiverPhone: resolveEmployeePhone(appt.employeeId),
        serviceType: appt.title,
        preparationNotes: CLIENT_PREP_NOTES[appt.id] ?? null,
        canRequestChange,
      },
    };
  });
}

export async function requestPortalAppointmentChange(
  appointmentId: string,
  profileId: string,
  roleKey: RoleKey | null,
  reason: string,
  portalContext?: PortalAppointmentsPortalContext,
): Promise<ServiceResult<{ requestId: string }>> {
  const denied = enforcePermission<{ requestId: string }>(
    roleKey,
    'portal.client.appointments.request_change',
  );
  if (denied) return denied;

  return runService(async () => {
    await delay(400);

    if (!reason.trim()) {
      return { ok: false, error: 'Bitte geben Sie einen Grund für die Änderung an.' };
    }

    const detail = await fetchPortalClientAppointmentDetail(
      appointmentId,
      profileId,
      roleKey,
      portalContext,
    );
    if (!detail.ok) return detail;

    if (!detail.data.canRequestChange) {
      return { ok: false, error: 'Für diesen Termin kann keine Änderung angefragt werden.' };
    }

    return {
      ok: true,
      data: { requestId: `change-req-${Date.now()}` },
    };
  });
}
