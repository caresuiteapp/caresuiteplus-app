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
import { resolveVisitMasterId } from '@/lib/assist/visitRecurrenceExpansion';
import { isVirtualRecurringOccurrenceId } from '@/lib/assist/visitRecurrenceExecution';
import { canClientPortalSeeFeature, fetchClientPortalSettingsResolved } from '@/lib/client/clientPortalSettingsService';
import { calendarEventRepository } from '@/lib/calendar/calendarEventRepository';
import type { WorkflowStatus } from '@/types/core/base';

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
    serviceName: item.serviceName,
    startsAt: item.scheduledStart,
    endsAt: item.scheduledEnd,
    status: item.status,
    assignmentStatus: item.assignmentStatus,
    assignmentIncomplete: item.isIncomplete,
    documentationPending: item.documentationStatus === 'open',
    signaturePending: item.proofStatus === 'pending' || item.proofStatus === 'rejected',
    seriesMasterId: item.seriesMasterId,
    seriesOccurrenceDate: item.seriesOccurrenceDate,
    location: item.location || null,
    clientId: item.clientId ?? '',
    employeeId: item.employeeId,
    clientName: item.clientName,
    employeeName: item.employeeName || undefined,
  };
}

/** assignments.status is source of truth for portal execution; assist_visits.canonical_status may lag. */
async function enrichPortalAppointmentsWithAssignmentStatus(
  tenantId: string,
  items: PortalAppointmentItem[],
): Promise<PortalAppointmentItem[]> {
  if (items.length === 0) return items;

  const supabase = getSupabaseClient();
  if (!supabase) return items;

  const ids = [
    ...new Set(
      items
        .filter((item) => !isVirtualRecurringOccurrenceId(item.id))
        .map((item) => resolveVisitMasterId(item.id)),
    ),
  ];
  if (ids.length === 0) return items;

  const { data, error } = await fromUnknownTable(supabase, 'assignments')
    .select('id, status')
    .eq('tenant_id', tenantId)
    .in('id', ids);

  if (error) {
    if (!isMissingTableError(error)) {
      console.warn('[portalAppointmentsLiveService] assignment status overlay:', error.message);
    }
    return items;
  }

  const statusById = new Map(
    (data ?? []).map((row) => {
      const record = row as { id: string; status: string };
      return [record.id, remoteStatusToAssignment(record.status)] as const;
    }),
  );

  return items.map((item) => {
    if (isVirtualRecurringOccurrenceId(item.id)) return item;
    const assignmentStatus = statusById.get(resolveVisitMasterId(item.id));
    if (!assignmentStatus) return item;
    return { ...item, assignmentStatus };
  });
}

async function fetchLivePortalAppointments(
  tenantId: string,
  filter: { clientId?: string; employeeId?: string; teamCalendar?: boolean },
): Promise<ServiceResult<PortalAppointmentItem[]>> {
  return runService(async () => {
    const visitResult = await visitSupabaseRepository.list(tenantId, {
      clientId: filter.clientId,
      employeeId: filter.teamCalendar ? undefined : filter.employeeId,
      portalAudience: filter.clientId ? 'client' : 'employee',
    });
    if (!visitResult.ok) {
      return {
        ok: false,
        error: 'Einsätze konnten nicht geladen werden. Bitte erneut versuchen.',
      };
    }

    let items = visitResult.data.map(visitListItemToPortalAppointment);
    items = await enrichPortalAppointmentsWithAssignmentStatus(tenantId, items);

    return {
      ok: true,
      data: items,
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
    portalReleaseEnabled: boolean;
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
    const settings = await fetchClientPortalSettingsResolved(tenantId, clientId);
    if (!settings.ok) return settings;
    if (!canClientPortalSeeFeature(settings.data, 'appointments')) return { ok: true, data: null };

    const { data, error } = await fromUnknownTable(supabase, 'assignments')
      .select(ACTIVE_ASSIGNMENT_SELECT)
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .in('status', [...ACTIVE_LIVE_STATUSES])
      .order('planned_start_at', { ascending: true });

    if (error) {
      if (!isMissingTableError(error)) {
        console.warn('[portalAppointmentsLiveService] active live assignment:', error.message);
      }
      return { ok: false, error: 'Aktiver Einsatz konnte nicht geladen werden.' };
    }
    for (const row of (data ?? []) as unknown as AssignmentLiveListRow[]) {
      // Assignments are readable for the client's schedule even when GPS is not
      // released. The canonical visit owns the separate live-location release.
      const { data: visit, error: releaseError } = await fromUnknownTable(supabase, 'assist_visits')
        .select('id, portal_release_enabled')
        .eq('tenant_id', tenantId)
        .eq('client_id', clientId)
        .neq('planning_status', 'draft')
        .or(`id.eq.${row.id},legacy_assignment_id.eq.${row.id}`)
        .maybeSingle();
      if (releaseError) return { ok: false, error: 'Die Freigabe der Live-Anfahrt konnte nicht geprüft werden.' };
      if (visit?.portal_release_enabled !== true) continue;
      return {
        ok: true,
        data: {
          id: String(visit.id),
          title: row.title?.trim() || 'Einsatz',
          status: remoteStatusToAssignment(row.status),
          startsAt: row.planned_start_at,
          endsAt: row.planned_end_at,
          caregiverName: personName(row.employees),
          portalReleaseEnabled: visit.portal_release_enabled === true,
        },
      };
    }
    return { ok: true, data: null };
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

/** All employee-portal-visible team assignments in the tenant (team calendar). */
export async function fetchLivePortalAppointmentsForEmployeeTeam(
  tenantId: string,
): Promise<ServiceResult<PortalAppointmentItem[]>> {
  if (!tenantId.trim()) {
    return { ok: true, data: [] };
  }
  return fetchLivePortalAppointments(tenantId, { teamCalendar: true });
}

export async function fetchLivePortalClientAppointmentDetail(
  tenantId: string,
  clientId: string,
  assignmentId: string,
  onBasicDetail?: (detail: PortalClientAppointmentDetail) => void,
): Promise<ServiceResult<PortalClientAppointmentDetail>> {
  return runService(async () => {
    if (!tenantId.trim() || !clientId.trim() || !assignmentId.trim()) {
      return { ok: false, error: 'Einsatz nicht gefunden.' };
    }

    // Calendar-only entries have their own identity. Read through the existing
    // client-scoped repository and expose only public notes, never internal text.
    const readCalendarDetail = async (): Promise<ServiceResult<PortalClientAppointmentDetail>> => {
      const calendarId = assignmentId.startsWith('calendar:') ? assignmentId.slice('calendar:'.length) : assignmentId;
      const calendar = await calendarEventRepository.listForPortal(tenantId, {
        portalType: 'client', clientId,
      });
      if (!calendar.ok) return { ok: false, error: calendar.error };
      const matches = calendar.data.filter((candidate) =>
        (candidate.id === calendarId || (!assignmentId.startsWith('calendar:') && candidate.sourceId === calendarId)) &&
        candidate.tenantId === tenantId &&
        candidate.relatedClientId === clientId &&
        candidate.isClientPortalVisible && !candidate.archivedAt,
      );
      if (matches.length !== 1) return { ok: false, error: 'Einsatz nicht gefunden.' };
      const event = matches[0];
      const status = remoteStatusToAssignment(event.status);
      return { ok: true, data: {
        id: `calendar:${event.id}`,
        moduleKey: event.moduleKey,
        title: event.title,
        startsAt: event.startAt,
        endsAt: event.endAt,
        status: event.status as WorkflowStatus,
        assignmentStatus: status,
        location: event.locationName || event.address || null,
        caregiverName: null,
        caregiverPhone: null,
        serviceType: event.title,
        preparationNotes: event.publicNote?.trim() || null,
        canRequestChange: PLANNED_CHANGE_STATUSES.has(status) && new Date(event.endAt).getTime() >= Date.now(),
        liveVisit: null,
      } };
    };
    if (assignmentId.startsWith('calendar:')) return readCalendarDetail();

    const visibleFallback = async (): Promise<PortalClientAppointmentDetail | null> => {
      const visible = await fetchLivePortalAppointmentsForClient(tenantId, clientId);
      const item = visible.ok ? visible.data.find((candidate) => candidate.id === assignmentId) : null;
      if (!item) {
        const calendar = await readCalendarDetail();
        return calendar.ok ? calendar.data : null;
      }
      const status = item.assignmentStatus ?? remoteStatusToAssignment(item.status);
      return {
        id: item.id,
        title: item.title,
        startsAt: item.startsAt,
        endsAt: item.endsAt,
        status: item.status,
        assignmentStatus: status,
        location: item.location || null,
        caregiverName: item.employeeName || null,
        caregiverPhone: null,
        serviceType: item.serviceName?.trim() || item.title,
        preparationNotes: null,
        canRequestChange: PLANNED_CHANGE_STATUSES.has(status),
        liveVisit: null,
      };
    };

    let visitDetail: Awaited<ReturnType<typeof fetchVisitDispositionDetail>>;
    try {
      visitDetail = await fetchVisitDispositionDetail(assignmentId, tenantId, 'client_portal');
    } catch (cause) {
      console.warn('[portalAppointmentsLiveService] visit detail failed:', cause);
      const fallback = await visibleFallback();
      if (fallback) return { ok: true as const, data: fallback };
      return { ok: false, error: 'Einsatzdetails konnten nicht geladen werden.' };
    }

    if (!visitDetail.ok) {
      const fallback = await visibleFallback();
      if (fallback) return { ok: true as const, data: fallback };
      return { ok: false, error: 'Einsatz nicht gefunden.' };
    }
    if (!visitDetail.data || visitDetail.data.clientId !== clientId) {
      const fallback = await visibleFallback();
      if (fallback) return { ok: true as const, data: fallback };
      return { ok: false, error: 'Einsatz nicht gefunden.' };
    }

    const detail = visitDetail.data;
    const assignmentStatus = detail.assignmentStatus ?? 'geplant';

    const portalDetail: PortalClientAppointmentDetail = {
      id: detail.id,
      moduleKey: 'assist',
      title: detail.title,
      startsAt: detail.scheduledStart,
      endsAt: detail.scheduledEnd,
      status: detail.status,
      assignmentStatus,
      location: detail.location || null,
      caregiverName: detail.employeeName || null,
      caregiverPhone: null,
      serviceType: detail.serviceName?.trim() || detail.title,
      preparationNotes: detail.clientVisibleNotes?.trim() || null,
      canRequestChange: PLANNED_CHANGE_STATUSES.has(assignmentStatus),
      liveVisit: null,
    };
    onBasicDetail?.(portalDetail);
    let liveVisit: PortalClientAppointmentDetail['liveVisit'] = null;
    try {
      liveVisit = sanitizeClientPortalLiveVisitPayload(
        await projectClientPortalAssistLiveVisit({
          tenantId,
          clientId,
          assignmentId: detail.id,
          status: assignmentStatus,
          plannedStartAt: detail.scheduledStart,
          plannedEndAt: detail.scheduledEnd,
          portalReleaseEnabled: detail.portalReleaseEnabled,
        }),
      ) as PortalClientAppointmentDetail['liveVisit'];
    } catch (cause) {
      console.warn('[portalAppointmentsLiveService] live visit projection failed:', cause);
    }

    portalDetail.liveVisit = liveVisit;
    return { ok: true as const, data: portalDetail };
  });
}
