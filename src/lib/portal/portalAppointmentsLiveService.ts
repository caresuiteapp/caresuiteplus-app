import type { ServiceResult } from '@/types';
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import { remoteStatusToAssignment } from '@/lib/assist/assignmentStatusBridge';
import { visitSupabaseRepository } from '@/lib/assist/repositories/visitRepository.supabase';
import type { VisitDispositionListItem } from '@/lib/assist/visitTypes';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isMissingTableError } from '@/lib/supabase/missingtablefallback';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { runService } from '@/lib/services/serviceRunner';
import type { PortalClientAppointmentDetail } from '@/types/portal/client';
import { fetchVisitDispositionDetail } from '@/lib/assist/visitService';
import {
  projectClientPortalAssistLiveVisit,
  sanitizeClientPortalLiveVisitPayload,
} from '@/lib/portal/clientPortalAssistLiveVisitService';
import type { PortalAppointmentItem } from './appointmentService';
import { PORTAL_ACTIVE_LIVE_ASSIGNMENT_STATUSES } from '@/lib/portal/portalAssignmentStatusFilters';

const ACTIVE_ASSIGNMENT_SELECT = `
  id, tenant_id, client_id, employee_id,
  planned_start_at, planned_end_at,
  status, title, address_snapshot, client_visible_notes,
  clients(first_name, last_name),
  employees(first_name, last_name, phone)
`;
const PLANNED_CHANGE_STATUSES = new Set<AssignmentStatus>(['geplant', 'bestaetigt']);

function visitListItemToPortalAppointment(item: VisitDispositionListItem): PortalAppointmentItem {
  return {
    id: item.id,
    title: item.title,
    startsAt: item.scheduledStart,
    endsAt: item.scheduledEnd,
    status: item.status,
    assignmentStatus: item.assignmentStatus,
    location: item.location || null,
    clientId: item.clientId ?? '',
    employeeId: item.employeeId,
    clientName: item.clientName,
  };
}

async function fetchLivePortalAppointments(
  tenantId: string,
  filter: { clientId?: string; employeeId?: string },
): Promise<ServiceResult<PortalAppointmentItem[]>> {
  return runService(async () => {
    const visitResult = await visitSupabaseRepository.list(tenantId, {
      clientId: filter.clientId,
      employeeId: filter.employeeId,
      portalAudience: filter.clientId ? 'client' : 'employee',
    });
    if (!visitResult.ok) {
      return {
        ok: false,
        error: 'Einsätze konnten nicht geladen werden. Bitte erneut versuchen.',
      };
    }

    return {
      ok: true,
      data: visitResult.data.map(visitListItemToPortalAppointment),
    };
  });
}

const ACTIVE_LIVE_STATUSES = PORTAL_ACTIVE_LIVE_ASSIGNMENT_STATUSES;

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

export async function fetchActiveLivePortalAssignmentForClient(
  tenantId: string,
  clientId: string,
): Promise<
  ServiceResult<{
    id: string;
    title: string;
    status: AssignmentStatus;
    startsAt: string;
    endsAt: string;
    caregiverName: string | null;
  } | null>
> {
  return runService(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { ok: false, error: 'Supabase ist nicht verfügbar.' };
    }
    if (!tenantId.trim() || !clientId.trim()) {
      return { ok: true, data: null };
    }

    const { data, error } = await fromUnknownTable(supabase, 'assignments')
      .select(ACTIVE_ASSIGNMENT_SELECT)
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .in('status', [...ACTIVE_LIVE_STATUSES])
      .order('planned_start_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      if (!isMissingTableError(error)) {
        console.warn('[portalAppointmentsLiveService] active live assignment:', error.message);
      }
      return { ok: false, error: 'Aktiver Einsatz konnte nicht geladen werden.' };
    }
    if (!data) {
      return { ok: true, data: null };
    }

    const row = data as unknown as AssignmentLiveListRow;
    const assignmentStatus = remoteStatusToAssignment(row.status);
    return {
      ok: true,
      data: {
        id: row.id,
        title: row.title?.trim() || 'Einsatz',
        status: assignmentStatus,
        startsAt: row.planned_start_at,
        endsAt: row.planned_end_at,
        caregiverName: personName(row.employees),
      },
    };
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
    if (!tenantId.trim() || !clientId.trim() || !assignmentId.trim()) {
      return { ok: false, error: 'Einsatz nicht gefunden.' };
    }

    const visitDetail = await fetchVisitDispositionDetail(assignmentId, tenantId, 'client_portal');
    if (!visitDetail.ok) {
      return { ok: false, error: 'Einsatz nicht gefunden.' };
    }
    if (!visitDetail.data || visitDetail.data.clientId !== clientId) {
      return { ok: false, error: 'Einsatz nicht gefunden.' };
    }

    const detail = visitDetail.data;
    const assignmentStatus = detail.assignmentStatus;

    const liveVisit = sanitizeClientPortalLiveVisitPayload(
      await projectClientPortalAssistLiveVisit({
        tenantId,
        clientId,
        assignmentId: detail.id,
        status: assignmentStatus,
        plannedStartAt: detail.scheduledStart,
        plannedEndAt: detail.scheduledEnd,
        portalReleaseEnabled: detail.portalReleaseEnabled,
      }),
    );

    const portalDetail: PortalClientAppointmentDetail = {
      id: detail.id,
      title: detail.title,
      startsAt: detail.scheduledStart,
      endsAt: detail.scheduledEnd,
      status: detail.status,
      location: detail.location || null,
      caregiverName: detail.employeeName || null,
      caregiverPhone: null,
      serviceType: detail.serviceName?.trim() || detail.title,
      preparationNotes: detail.notes?.trim() || null,
      canRequestChange: PLANNED_CHANGE_STATUSES.has(assignmentStatus),
      liveVisit: liveVisit as PortalClientAppointmentDetail['liveVisit'],
    };
    return { ok: true as const, data: portalDetail };
  });
}
