import type { RoleKey, ServiceResult } from '@/types';
import type { WfmDrivingLogRow, WfmVisitTimeRow } from '@/types/modules/wfm';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isSupabaseMissingTableError, toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { ASSIST_EXECUTION_TABLES } from '@/types/assistExecutionPersistence';
import { resolveEmployeeIdForUser } from './wfmWorkSessionRepository';

const ASSIST_EVENT_LABELS: Record<string, string> = {
  drive_start: 'Anfahrt gestartet',
  drive_end: 'Anfahrt beendet',
  service_start: 'Einsatz gestartet',
  service_end: 'Einsatz beendet',
  pause_start: 'Pause',
  pause_end: 'Fortsetzung',
  arrive: 'Angekommen',
  depart: 'Abfahrt',
};

const demoVisitTimes: WfmVisitTimeRow[] = [
  {
    id: 'demo-vt-1',
    visitId: 'demo-visit-1',
    assignmentLabel: 'Einsatz Klient Müller',
    eventType: 'service_start',
    eventLabel: 'Einsatz gestartet',
    occurredAt: new Date(Date.now() - 3600000).toISOString(),
    durationSeconds: null,
  },
  {
    id: 'demo-vt-2',
    visitId: 'demo-visit-1',
    assignmentLabel: 'Einsatz Klient Müller',
    eventType: 'drive_start',
    eventLabel: 'Anfahrt gestartet',
    occurredAt: new Date(Date.now() - 5400000).toISOString(),
    durationSeconds: 900,
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

export async function listEmployeeVisitTimes(
  tenantId: string,
  userId: string,
  actorRoleKey: RoleKey | null,
  options?: { employeeId?: string | null; days?: number },
): Promise<ServiceResult<{ visitTimes: WfmVisitTimeRow[]; drivingLogs: WfmDrivingLogRow[] }>> {
  const denied = enforcePermission(actorRoleKey, 'time.tracking.own.view');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const employeeResult = await resolveEmployeeIdForUser(tenantId, userId, options?.employeeId);
  if (!employeeResult.ok) return employeeResult;

  const days = options?.days ?? 14;
  const fromIso = new Date(Date.now() - days * 86400000).toISOString();

  if (getServiceMode() !== 'supabase') {
    return { ok: true, data: { visitTimes: demoVisitTimes, drivingLogs: demoDrivingLogs } };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const { data: timeEvents, error: timeError } = await fromUnknownTable(
    supabase,
    ASSIST_EXECUTION_TABLES.timeEvents,
  )
    .select('id, visit_id, event_type, occurred_at, duration_seconds')
    .eq('tenant_id', tenantId)
    .gte('occurred_at', fromIso)
    .order('occurred_at', { ascending: false })
    .limit(50);

  if (timeError) {
    if (isSupabaseMissingTableError(timeError)) {
      return { ok: true, data: { visitTimes: [], drivingLogs: [] } };
    }
    return { ok: false, error: toGermanSupabaseError(timeError) };
  }

  const visitTimes: WfmVisitTimeRow[] = (timeEvents ?? []).map((row) => {
    const r = row as {
      id: string;
      visit_id: string;
      event_type: string;
      occurred_at: string;
      duration_seconds: number | null;
    };
    return {
      id: r.id,
      visitId: r.visit_id,
      assignmentLabel: `Einsatz ${r.visit_id.slice(0, 8)}`,
      eventType: r.event_type,
      eventLabel: ASSIST_EVENT_LABELS[r.event_type] ?? r.event_type,
      occurredAt: r.occurred_at,
      durationSeconds: r.duration_seconds,
    };
  });

  const { data: drivingData, error: driveError } = await fromUnknownTable(
    supabase,
    ASSIST_EXECUTION_TABLES.drivingLog,
  )
    .select(
      'id, visit_id, purpose, started_at, ended_at, distance_km, start_address, end_address, status',
    )
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeResult.data)
    .gte('started_at', fromIso)
    .order('started_at', { ascending: false })
    .limit(30);

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

  return { ok: true, data: { visitTimes, drivingLogs } };
}
