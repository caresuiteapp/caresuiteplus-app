import type { ServiceResult } from '@/types';
import type { WorkflowStatus } from '@/types/workflow/status';
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import { remoteStatusToAssignment } from '@/lib/assist/assignmentStatusBridge';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isMissingTableError } from '@/lib/supabase/missingtablefallback';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { runService } from '@/lib/services/serviceRunner';
import type { PortalClientAppointmentDetail } from '@/types/portal/client';
import {
  projectClientPortalAssistLiveVisit,
  sanitizeClientPortalLiveVisitPayload,
} from '@/lib/portal/clientPortalAssistLiveVisitService';
import type { PortalAppointmentItem } from './appointmentService';

const LIST_SELECT = `
  id, tenant_id, client_id, employee_id,
  planned_start_at, planned_end_at,
  status, title, address_snapshot, client_visible_notes,
  clients(first_name, last_name),
  employees(first_name, last_name, phone)
`;

/** Remote assignment statuses visible as portal Einsätze (non-terminal). */
const PORTAL_APPOINTMENT_STATUSES = [
  'planned',
  'confirmed',
  'on_the_way',
  'arrived',
  'started',
  'paused',
  'finished',
  'documentation_open',
  'signature_open',
] as const;

const PLANNED_CHANGE_STATUSES = new Set<AssignmentStatus>(['geplant', 'bestaetigt']);

type AssignmentLiveListRow = {
  id: string;
  tenant_id: string;
  client_id: string;
  employee_id: string | null;
  planned_start_at: string;
  planned_end_at: string;
  status: string;
  title: string | null;
  address_snapshot: string | null;
  client_visible_notes: string | null;
  clients?: { first_name: string | null; last_name: string | null } | null;
  employees?: { first_name: string | null; last_name: string | null; phone?: string | null } | null;
};

function personName(
  row?: { first_name: string | null; last_name: string | null } | null,
): string | null {
  if (!row) return null;
  const name = `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim();
  return name || null;
}

function assignmentStatusToWorkflowFilter(status: AssignmentStatus): WorkflowStatus {
  const map: Partial<Record<AssignmentStatus, WorkflowStatus>> = {
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
  return map[status] ?? 'aktiv';
}

function mapAssignmentRow(row: AssignmentLiveListRow): PortalAppointmentItem {
  const assignmentStatus = remoteStatusToAssignment(row.status);
  return {
    id: row.id,
    title: row.title?.trim() || 'Einsatz',
    startsAt: row.planned_start_at,
    endsAt: row.planned_end_at,
    status: assignmentStatusToWorkflowFilter(assignmentStatus),
    location: row.address_snapshot?.trim() || null,
    clientId: row.client_id,
    employeeId: row.employee_id,
    clientName: personName(row.clients) ?? undefined,
  };
}

async function fetchLivePortalAppointments(
  tenantId: string,
  filter: { clientId?: string; employeeId?: string },
): Promise<ServiceResult<PortalAppointmentItem[]>> {
  return runService(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { ok: false, error: 'Supabase ist nicht verfügbar.' };
    }

    let query = fromUnknownTable(supabase, 'assignments')
      .select(LIST_SELECT)
      .eq('tenant_id', tenantId)
      .in('status', [...PORTAL_APPOINTMENT_STATUSES])
      .order('planned_start_at', { ascending: true });

    if (filter.clientId?.trim()) {
      query = query.eq('client_id', filter.clientId);
    }
    if (filter.employeeId?.trim()) {
      query = query.eq('employee_id', filter.employeeId);
    }

    const { data, error } = await query;
    if (error) {
      if (!isMissingTableError(error)) {
        console.warn('[portalAppointmentsLiveService] assignments:', error.message);
      }
      return { ok: false, error: 'Einsätze konnten nicht geladen werden. Bitte erneut versuchen.' };
    }

    const rows = (data ?? []) as unknown as AssignmentLiveListRow[];
    return { ok: true, data: rows.map(mapAssignmentRow) };
  });
}

export async function fetchLivePortalAppointmentsForClient(
  tenantId: string,
  clientId: string,
): Promise<ServiceResult<PortalAppointmentItem[]>> {
  if (!tenantId.trim() || !clientId.trim()) {
    return { ok: true, data: [] };
  }
  return fetchLivePortalAppointments(tenantId, { clientId });
}

export async function fetchLivePortalAppointmentsForEmployee(
  tenantId: string,
  employeeId: string,
): Promise<ServiceResult<PortalAppointmentItem[]>> {
  if (!tenantId.trim() || !employeeId.trim()) {
    return { ok: true, data: [] };
  }
  return fetchLivePortalAppointments(tenantId, { employeeId });
}

export async function fetchLivePortalClientAppointmentDetail(
  tenantId: string,
  clientId: string,
  assignmentId: string,
): Promise<ServiceResult<PortalClientAppointmentDetail>> {
  return runService(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { ok: false, error: 'Supabase ist nicht verfügbar.' };
    }
    if (!tenantId.trim() || !clientId.trim() || !assignmentId.trim()) {
      return { ok: false, error: 'Einsatz nicht gefunden.' };
    }

    const { data, error } = await fromUnknownTable(supabase, 'assignments')
      .select(LIST_SELECT)
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .eq('id', assignmentId)
      .maybeSingle();

    if (error) {
      if (!isMissingTableError(error)) {
        console.warn('[portalAppointmentsLiveService] assignment detail:', error.message);
      }
      return { ok: false, error: 'Einsatz nicht gefunden.' };
    }
    if (!data) {
      return { ok: false, error: 'Einsatz nicht gefunden.' };
    }

    const row = data as unknown as AssignmentLiveListRow;
    const assignmentStatus = remoteStatusToAssignment(row.status);
    const employee = row.employees;

    const liveVisit = sanitizeClientPortalLiveVisitPayload(
      await projectClientPortalAssistLiveVisit({
        tenantId,
        clientId,
        assignmentId: row.id,
        status: assignmentStatus,
        plannedStartAt: row.planned_start_at,
        plannedEndAt: row.planned_end_at,
        portalReleaseEnabled: true,
      }),
    );

    const detail: PortalClientAppointmentDetail = {
      id: row.id,
      title: row.title?.trim() || 'Einsatz',
      startsAt: row.planned_start_at,
      endsAt: row.planned_end_at,
      status: assignmentStatusToWorkflowFilter(assignmentStatus),
      location: row.address_snapshot?.trim() || null,
      caregiverName: personName(employee),
      caregiverPhone: employee?.phone?.trim() || null,
      serviceType: row.title?.trim() || 'Einsatz',
      preparationNotes: row.client_visible_notes?.trim() || null,
      canRequestChange: PLANNED_CHANGE_STATUSES.has(assignmentStatus),
      liveVisit: liveVisit as PortalClientAppointmentDetail['liveVisit'],
    };
    return { ok: true as const, data: detail };
  });
}
