import type { RoleKey, ServiceResult } from '@/types';
import type { WfmDrivingLogRow, WfmEmployeeVisitTimeSummary, WfmVisitTimeRow } from '@/types/modules/wfm';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isSupabaseMissingTableError, toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { ASSIST_EXECUTION_TABLES } from '@/types/assistExecutionPersistence';
import { resolveEmployeeIdForUser } from './wfmWorkSessionRepository';

/** Default lookback for portal "Meine Zeiten" — own assignments only. */
export const PORTAL_EMPLOYEE_TIMES_LOOKBACK_DAYS = 60;

const EMPLOYEE_TIME_EVENT_LABELS: Record<string, string> = {
  drive_start: 'Anfahrt begonnen',
  drive_end: 'Anfahrt beendet',
  service_start: 'Einsatz begonnen',
  service_end: 'Einsatz beendet',
  pause_start: 'Pause begonnen',
  pause_end: 'Pause beendet',
  arrive: 'Am Einsatzort angekommen',
  depart: 'Abfahrt vom Einsatzort',
};

/** Meaningful milestones for employee-facing timeline (skip technical duplicates). */
const DISPLAY_EVENT_TYPES = new Set([
  'drive_start',
  'arrive',
  'service_start',
  'service_end',
  'depart',
  'pause_start',
  'pause_end',
]);

const demoVisitSummaries: WfmEmployeeVisitTimeSummary[] = [
  {
    visitId: 'demo-visit-1',
    title: 'Alltagsbegleitung',
    clientName: 'Klient Müller',
    dateLabel: new Date().toLocaleDateString('de-DE', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }),
    plannedRange: '09:00 – 10:00',
    timelineText: 'Anfahrt 08:45 · Angekommen 08:55 · Einsatz 09:00–10:00',
    occurredAt: new Date(Date.now() - 3600000).toISOString(),
  },
];

const demoDrivingLogs: WfmDrivingLogRow[] = [
  {
    id: 'demo-dl-1',
    visitId: 'demo-visit-1',
    purpose: 'Anfahrt zum Einsatz',
    startedAt: new Date(Date.now() - 5400000).toISOString(),
    endedAt: new Date(Date.now() - 3600000).toISOString(),
    distanceKm: 12.4,
    startAddress: 'Büro',
    endAddress: 'Klient Müller',
    status: 'completed',
  },
];

function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function formatDateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatPlannedRange(start?: string | null, end?: string | null): string | null {
  if (!start || !end) return null;
  return `${formatClock(start)} – ${formatClock(end)}`;
}

function personName(row?: { first_name: string | null; last_name: string | null } | null): string | null {
  if (!row) return null;
  const name = `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim();
  return name || null;
}

type RawTimeEvent = {
  id: string;
  visit_id: string;
  event_type: string;
  occurred_at: string;
  duration_seconds: number | null;
};

type VisitMeta = {
  title: string;
  clientName: string | null;
  plannedStart: string | null;
  plannedEnd: string | null;
};

function buildVisitSummaries(
  events: RawTimeEvent[],
  visitMetaById: Map<string, VisitMeta>,
): WfmEmployeeVisitTimeSummary[] {
  const byVisit = new Map<string, RawTimeEvent[]>();
  for (const event of events) {
    if (!DISPLAY_EVENT_TYPES.has(event.event_type)) continue;
    const list = byVisit.get(event.visit_id) ?? [];
    list.push(event);
    byVisit.set(event.visit_id, list);
  }

  const summaries: WfmEmployeeVisitTimeSummary[] = [];
  for (const [visitId, visitEvents] of byVisit) {
    visitEvents.sort(
      (a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime(),
    );

    const meta = visitMetaById.get(visitId);
    const title = meta?.title ?? 'Einsatz';
    const clientName = meta?.clientName ?? null;
    const anchor = visitEvents[0]?.occurred_at ?? new Date().toISOString();

    const steps: string[] = [];
    let lastMinuteKey: string | null = null;
    for (const event of visitEvents) {
      const minuteKey = `${event.event_type}:${event.occurred_at.slice(0, 16)}`;
      if (minuteKey === lastMinuteKey) continue;
      lastMinuteKey = minuteKey;
      const label = EMPLOYEE_TIME_EVENT_LABELS[event.event_type] ?? event.event_type;
      steps.push(`${label} ${formatClock(event.occurred_at)}`);
    }

    summaries.push({
      visitId,
      title,
      clientName,
      dateLabel: formatDateLabel(anchor),
      plannedRange: formatPlannedRange(meta?.plannedStart, meta?.plannedEnd),
      timelineText: steps.join(' · '),
      occurredAt: visitEvents[visitEvents.length - 1]?.occurred_at ?? anchor,
    });
  }

  summaries.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  return summaries;
}

export async function listEmployeeVisitTimes(
  tenantId: string,
  userId: string,
  actorRoleKey: RoleKey | null,
  options?: { employeeId?: string | null; days?: number },
): Promise<
  ServiceResult<{
    visitTimes: WfmVisitTimeRow[];
    visitSummaries: WfmEmployeeVisitTimeSummary[];
    drivingLogs: WfmDrivingLogRow[];
  }>
> {
  const denied = enforcePermission(actorRoleKey, 'time.tracking.own.view');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const employeeResult = await resolveEmployeeIdForUser(tenantId, userId, options?.employeeId);
  if (!employeeResult.ok) return employeeResult;

  const days = options?.days ?? PORTAL_EMPLOYEE_TIMES_LOOKBACK_DAYS;
  const fromIso = new Date(Date.now() - days * 86400000).toISOString();
  const employeeId = employeeResult.data;

  if (getServiceMode() !== 'supabase') {
    return {
      ok: true,
      data: { visitTimes: [], visitSummaries: demoVisitSummaries, drivingLogs: demoDrivingLogs },
    };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const { data: employeeVisits, error: visitsError } = await fromUnknownTable(
    supabase,
    'assist_visits',
  )
    .select('id, title, planned_start_at, planned_end_at, clients(first_name, last_name)')
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId);

  if (visitsError) {
    if (isSupabaseMissingTableError(visitsError)) {
      return { ok: true, data: { visitTimes: [], visitSummaries: [], drivingLogs: [] } };
    }
    return { ok: false, error: toGermanSupabaseError(visitsError) };
  }

  const visitMetaById = new Map<string, VisitMeta>();
  const employeeVisitIds: string[] = [];
  for (const row of employeeVisits ?? []) {
    const visit = row as {
      id: string;
      title: string | null;
      planned_start_at: string | null;
      planned_end_at: string | null;
      clients?: { first_name: string | null; last_name: string | null } | null;
    };
    employeeVisitIds.push(visit.id);
    visitMetaById.set(visit.id, {
      title: visit.title?.trim() || 'Einsatz',
      clientName: personName(visit.clients),
      plannedStart: visit.planned_start_at,
      plannedEnd: visit.planned_end_at,
    });
  }

  if (employeeVisitIds.length === 0) {
    return { ok: true, data: { visitTimes: [], visitSummaries: [], drivingLogs: [] } };
  }

  const { data: timeEvents, error: timeError } = await fromUnknownTable(
    supabase,
    ASSIST_EXECUTION_TABLES.timeEvents,
  )
    .select('id, visit_id, event_type, occurred_at, duration_seconds')
    .eq('tenant_id', tenantId)
    .in('visit_id', employeeVisitIds)
    .gte('occurred_at', fromIso)
    .order('occurred_at', { ascending: false })
    .limit(500);

  if (timeError) {
    if (isSupabaseMissingTableError(timeError)) {
      return { ok: true, data: { visitTimes: [], visitSummaries: [], drivingLogs: [] } };
    }
    return { ok: false, error: toGermanSupabaseError(timeError) };
  }

  const rawEvents = (timeEvents ?? []) as RawTimeEvent[];

  const visitSummaries = buildVisitSummaries(rawEvents, visitMetaById);

  const visitTimes: WfmVisitTimeRow[] = visitSummaries.map((summary) => ({
    id: summary.visitId,
    visitId: summary.visitId,
    assignmentLabel: summary.clientName ? `${summary.title} · ${summary.clientName}` : summary.title,
    eventType: 'summary',
    eventLabel: summary.timelineText,
    occurredAt: summary.occurredAt,
    durationSeconds: null,
  }));

  const { data: drivingData, error: driveError } = await fromUnknownTable(
    supabase,
    ASSIST_EXECUTION_TABLES.drivingLog,
  )
    .select(
      'id, visit_id, purpose, started_at, ended_at, distance_km, start_address, end_address, status',
    )
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId)
    .gte('started_at', fromIso)
    .order('started_at', { ascending: false })
    .limit(100);

  if (driveError && !isSupabaseMissingTableError(driveError)) {
    return { ok: false, error: toGermanSupabaseError(driveError) };
  }

  const drivingLogs: WfmDrivingLogRow[] = (drivingData ?? []).map((row) => {
    const r = row as {
      id: string;
      visit_id: string | null;
      purpose: string | null;
      started_at: string | null;
      ended_at: string | null;
      distance_km: number | null;
      start_address: string | null;
      end_address: string | null;
      status: string;
    };
    return {
      id: r.id,
      visitId: r.visit_id,
      purpose: r.purpose,
      startedAt: r.started_at,
      endedAt: r.ended_at,
      distanceKm: r.distance_km,
      startAddress: r.start_address,
      endAddress: r.end_address,
      status: r.status,
    };
  });

  return { ok: true, data: { visitTimes, visitSummaries, drivingLogs } };
}
