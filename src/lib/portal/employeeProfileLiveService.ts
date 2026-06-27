import type { ServiceResult } from '@/types';
import type { PortalEmployeeProfile, PortalTimesheetEntry } from '@/types/portal/employee';
import type { WorkflowStatus } from '@/types/workflow/status';
import { remoteStatusToAssignment, assignmentStatusToRemote } from '@/lib/assist/assignmentStatusBridge';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isMissingTableError } from '@/lib/supabase/missingtablefallback';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { runService } from '@/lib/services/serviceRunner';
import { fetchLivePortalAppointmentsForEmployee } from './portalAppointmentsLiveService';
import { mapPortalAppointmentToListItem } from './employeePortalLiveOverviewService';

const EMPLOYEE_SELECT =
  'id, tenant_id, first_name, last_name, role_title, email, phone, status, department, weekly_hours';

function mapEmployeeStatus(value: unknown): WorkflowStatus {
  const key = String(value ?? 'active').trim().toLowerCase();
  if (key === 'active' || key === 'aktiv') return 'aktiv';
  if (key === 'inactive' || key === 'inaktiv') return 'archiviert';
  if (key === 'onboarding') return 'entwurf';
  return 'aktiv';
}

function personName(row: {
  first_name?: string | null;
  last_name?: string | null;
}): string {
  const name = `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim();
  return name || 'Mitarbeiter:in';
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function isSameWeek(iso: string, ref: Date): boolean {
  const d = new Date(iso);
  const start = new Date(ref);
  start.setDate(ref.getDate() - ref.getDay() + 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return d >= start && d < end;
}

function workflowFromAssignmentStatus(status: string): WorkflowStatus {
  const assignmentStatus = remoteStatusToAssignment(status);
  const map: Partial<Record<string, WorkflowStatus>> = {
    geplant: 'entwurf',
    bestaetigt: 'aktiv',
    unterwegs: 'aktiv',
    angekommen: 'in_bearbeitung',
    gestartet: 'in_bearbeitung',
    pausiert: 'in_bearbeitung',
    beendet: 'in_bearbeitung',
    dokumentation_offen: 'in_bearbeitung',
    unterschrift_offen: 'in_bearbeitung',
    abgeschlossen: 'abgeschlossen',
    storniert: 'fehlerhaft',
    nicht_erschienen: 'fehlerhaft',
  };
  return map[assignmentStatus] ?? 'aktiv';
}

export async function fetchLiveEmployeePortalProfile(
  tenantId: string,
  employeeId: string,
): Promise<ServiceResult<PortalEmployeeProfile>> {
  return runService(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { ok: false, error: 'Supabase ist nicht verfügbar.' };
    }
    if (!tenantId.trim() || !employeeId.trim()) {
      return { ok: false, error: 'Kein Mitarbeiterprofil mit diesem Portal verknüpft.' };
    }

    const [employeeResult, appointmentsResult] = await Promise.all([
      fromUnknownTable(supabase, 'employees')
        .select(EMPLOYEE_SELECT)
        .eq('tenant_id', tenantId)
        .eq('id', employeeId)
        .maybeSingle(),
      fetchLivePortalAppointmentsForEmployee(tenantId, employeeId),
    ]);

    if (employeeResult.error) {
      if (!isMissingTableError(employeeResult.error)) {
        console.warn('[employeeProfileLiveService] employees:', employeeResult.error.message);
      }
      return { ok: false, error: 'Mitarbeiterprofil nicht gefunden.' };
    }
    if (!employeeResult.data) {
      return { ok: false, error: 'Mitarbeiterprofil nicht gefunden.' };
    }

    const row = employeeResult.data as Record<string, unknown>;
    const appointments = appointmentsResult.ok ? appointmentsResult.data : [];
    const now = new Date();
    const weekItems = appointments
      .filter((item) => isSameWeek(item.startsAt, now))
      .map(mapPortalAppointmentToListItem);
    const upcoming = appointments.filter((item) => new Date(item.startsAt) > now);
    const loggedMinutes = weekItems
      .filter((item) => item.status === 'abgeschlossen' || item.status === 'beendet')
      .reduce((sum, item) => {
        const start = new Date(item.plannedStartAt).getTime();
        const end = new Date(item.plannedEndAt).getTime();
        return sum + Math.max(0, Math.round((end - start) / 60000));
      }, 0);

    const profile: PortalEmployeeProfile = {
      employeeId,
      displayName: personName(row as { first_name?: string | null; last_name?: string | null }),
      jobTitle: String(row.role_title ?? '').trim() || null,
      email: String(row.email ?? '').trim() || null,
      phone: String(row.phone ?? row.mobile ?? '').trim() || null,
      status: mapEmployeeStatus(row.status),
      teamName: String(row.department ?? '').trim() || 'Team',
      weeklyHoursTarget: Number(row.weekly_hours ?? 38) || 38,
      weeklyHoursLogged: Math.round((loggedMinutes / 60) * 10) / 10,
      upcomingShifts: upcoming.length,
      openRequests: 0,
    };

    return { ok: true, data: profile };
  });
}

export async function fetchLiveEmployeeTimesheet(
  tenantId: string,
  employeeId: string,
): Promise<ServiceResult<PortalTimesheetEntry[]>> {
  return runService(async () => {
    const live = await fetchLivePortalAppointmentsForEmployee(tenantId, employeeId);
    if (!live.ok) return live;

    const now = new Date();
    const entries: PortalTimesheetEntry[] = live.data
      .filter((item) => isSameWeek(item.startsAt, now))
      .map((item) => {
        const listItem = mapPortalAppointmentToListItem(item);
        const start = new Date(item.startsAt);
        const end = new Date(item.endsAt);
        const durationMinutes = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
        return {
          id: item.id,
          date: formatDate(item.startsAt),
          assignmentTitle: item.title,
          clientName: item.clientName ?? 'Klient:in',
          startTime: formatTime(item.startsAt),
          endTime: formatTime(item.endsAt),
          durationMinutes,
          status: workflowFromAssignmentStatus(assignmentStatusToRemote(listItem.status)),
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date));

    return { ok: true, data: entries };
  });
}
