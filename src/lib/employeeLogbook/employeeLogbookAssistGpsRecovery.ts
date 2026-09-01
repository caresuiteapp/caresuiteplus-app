import { buildAssistLiveRouteSummary } from '@/features/assistLive/getAssistLiveMonitoring';
import { reconcileAssistLiveRouteGaps } from '@/features/liveTracking/reconcileAssistLiveRouteGaps';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';

type Row = Record<string, unknown>;

export const EMPLOYEE_LOGBOOK_RECOVERY_SINCE = '2026-08-24T00:00:00+02:00';
const RECOVERY_SOURCE_PREFIX = 'assist_gps_recovery:';

export type EmployeeLogbookGpsRecoveryCandidate = {
  sessionId: string;
  visitId: string;
  assignmentId: string;
  clientId: string | null;
  title: string;
  startedAt: string;
  endedAt: string | null;
  endAddress: string | null;
  pointCount: number;
  measuredDistanceKm: number;
  googleGapDistanceKm: number;
  finalDistanceKm: number;
  resolvedGapCount: number;
  unresolvedGapCount: number;
  imported: boolean;
  active: boolean;
  source: string;
  points: {
    latitude: number;
    longitude: number;
    accuracy: number | null;
    altitude: number | null;
    speed: number | null;
    heading: number | null;
    recordedAt: string;
  }[];
};

export type EmployeeLogbookGpsRecoveryResult = {
  candidates: EmployeeLogbookGpsRecoveryCandidate[];
  importedCount: number;
  importedDistanceKm: number;
};

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function nullableString(value: unknown): string | null {
  const text = stringValue(value).trim();
  return text || null;
}

function numberValue(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

/** Reads the original Assist GPS records. Nothing is estimated by straight line. */
export async function loadEmployeeLogbookGpsRecoveryCandidates(
  tenantId: string,
  employeeId: string,
): Promise<EmployeeLogbookGpsRecoveryCandidate[]> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Keine sichere Datenbankverbindung.');

  const sessionsResult = await fromUnknownTable(supabase, 'assist_tracking_sessions')
    .select('id,visit_id,started_at,ended_at,is_active')
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId)
    .gte('started_at', EMPLOYEE_LOGBOOK_RECOVERY_SINCE)
    .order('started_at', { ascending: false })
    .limit(250);
  if (sessionsResult.error) throw new Error(sessionsResult.error.message);
  const sessions = (sessionsResult.data ?? []) as Row[];
  if (!sessions.length) return [];

  const sessionIds = sessions.map((row) => stringValue(row.id)).filter(Boolean);
  const visitIds = [...new Set(sessions.map((row) => stringValue(row.visit_id)).filter(Boolean))];
  const sources = sessionIds.map((id) => `${RECOVERY_SOURCE_PREFIX}${id}`);

  const [visitsResult, pointsResult, importedResult] = await Promise.all([
    fromUnknownTable(supabase, 'assist_visits')
      .select('id,legacy_assignment_id,client_id,title,address_snapshot,actual_end_at,finished_at,execution_status')
      .eq('tenant_id', tenantId)
      .in('id', visitIds),
    fromUnknownTable(supabase, 'assist_location_points')
      .select('session_id,latitude,longitude,accuracy_meters,altitude_meters,speed_mps,heading_degrees,recorded_at')
      .eq('tenant_id', tenantId)
      .in('session_id', sessionIds)
      .order('recorded_at', { ascending: true }),
    fromUnknownTable(supabase, 'employee_logbook_trips')
      .select('source')
      .eq('tenant_id', tenantId)
      .eq('employee_id', employeeId)
      .in('source', sources),
  ]);
  const error = visitsResult.error || pointsResult.error || importedResult.error;
  if (error) throw new Error(error.message);

  const visits = new Map(((visitsResult.data ?? []) as Row[]).map((row) => [stringValue(row.id), row]));
  const importedSources = new Set(((importedResult.data ?? []) as Row[]).map((row) => stringValue(row.source)));
  const pointsBySession = new Map<string, Row[]>();
  for (const row of (pointsResult.data ?? []) as Row[]) {
    const sessionId = stringValue(row.session_id);
    const list = pointsBySession.get(sessionId) ?? [];
    list.push(row);
    pointsBySession.set(sessionId, list);
  }

  return Promise.all(sessions.map(async (session): Promise<EmployeeLogbookGpsRecoveryCandidate> => {
    const sessionId = stringValue(session.id);
    const visitId = stringValue(session.visit_id);
    const visit = visits.get(visitId) ?? {};
    const points = (pointsBySession.get(sessionId) ?? []).map((row) => ({
      latitude: numberValue(row.latitude),
      longitude: numberValue(row.longitude),
      accuracy: row.accuracy_meters == null ? null : numberValue(row.accuracy_meters),
      altitude: row.altitude_meters == null ? null : numberValue(row.altitude_meters),
      speed: row.speed_mps == null ? null : numberValue(row.speed_mps),
      heading: row.heading_degrees == null ? null : numberValue(row.heading_degrees),
      recordedAt: stringValue(row.recorded_at),
    }));
    const route = buildAssistLiveRouteSummary(points.map((point) => ({
      latitude: point.latitude,
      longitude: point.longitude,
      accuracyMeters: point.accuracy,
      capturedAt: point.recordedAt,
    })));
    const gapRecovery = route.gapCount > 0
      ? await reconcileAssistLiveRouteGaps(tenantId, route.segments)
      : null;
    const googleGapDistanceKm = gapRecovery?.googleGapDistanceKm ?? 0;
    const resolvedGapCount = gapRecovery?.resolvedGapCount ?? 0;
    const unresolvedGapCount = Math.max(
      route.gapCount - resolvedGapCount,
      gapRecovery?.unresolvedGapCount ?? route.gapCount,
    );
    const source = `${RECOVERY_SOURCE_PREFIX}${sessionId}`;
    const endedAt = nullableString(session.ended_at) ?? nullableString(visit.finished_at) ?? nullableString(visit.actual_end_at) ?? route.updatedAt;
    const executionStatus = stringValue(visit.execution_status).toLowerCase();
    const visitClosed = ['completed', 'finished', 'closed', 'ended'].includes(executionStatus);
    return {
      sessionId,
      visitId,
      assignmentId: nullableString(visit.legacy_assignment_id) ?? visitId,
      clientId: nullableString(visit.client_id),
      title: nullableString(visit.title) ?? 'Automatisch aufgezeichnete Einsatzfahrt',
      startedAt: route.startedAt ?? stringValue(session.started_at),
      endedAt,
      endAddress: nullableString(visit.address_snapshot),
      pointCount: route.acceptedPointCount,
      measuredDistanceKm: route.measuredDistanceKm,
      googleGapDistanceKm,
      finalDistanceKm: route.measuredDistanceKm + googleGapDistanceKm,
      resolvedGapCount,
      unresolvedGapCount,
      imported: importedSources.has(source),
      active: Boolean(session.is_active) && !nullableString(visit.finished_at) && !nullableString(visit.actual_end_at) && !visitClosed,
      source,
      points,
    };
  }));
}

/**
 * Imports only closed and fully reconcilable sessions into the official
 * logbook. Incomplete routes stay visibly pending instead of producing a
 * knowingly false kilometre or reimbursement value.
 */
export async function synchronizeEmployeeLogbookFromAssistGps(input: {
  tenantId: string;
  employeeId: string;
  vehicleId: string;
  candidates?: EmployeeLogbookGpsRecoveryCandidate[];
}): Promise<EmployeeLogbookGpsRecoveryResult> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Keine sichere Datenbankverbindung.');
  const candidates = input.candidates ?? await loadEmployeeLogbookGpsRecoveryCandidates(input.tenantId, input.employeeId);
  const ready = candidates.filter((candidate) =>
    !candidate.imported &&
    !candidate.active &&
    Boolean(candidate.endedAt) &&
    candidate.pointCount >= 2 &&
    candidate.finalDistanceKm >= 0.05 &&
    candidate.unresolvedGapCount === 0,
  );

  let importedCount = 0;
  let importedDistanceKm = 0;
  for (const candidate of ready) {
    const insert = await fromUnknownTable(supabase, 'employee_logbook_trips').insert({
      tenant_id: input.tenantId,
      employee_id: input.employeeId,
      vehicle_id: input.vehicleId,
      assignment_id: candidate.assignmentId,
      client_id: candidate.clientId,
      route_type: 'other_business',
      purpose: `Automatische GPS-Einsatzfahrt · ${candidate.title}`,
      manual_reason: null,
      status: 'completed',
      started_at: candidate.startedAt,
      ended_at: candidate.endedAt,
      start_latitude: candidate.points[0]?.latitude ?? null,
      start_longitude: candidate.points[0]?.longitude ?? null,
      end_latitude: candidate.points.at(-1)?.latitude ?? null,
      end_longitude: candidate.points.at(-1)?.longitude ?? null,
      end_address: candidate.endAddress,
      distance_gps_km: candidate.measuredDistanceKm,
      google_route_distance_km: candidate.googleGapDistanceKm || null,
      distance_final_km: candidate.finalDistanceKm,
      gps_captured: true,
      navigation_provider: candidate.googleGapDistanceKm > 0 ? 'google' : null,
      distance_source: candidate.googleGapDistanceKm > 0 ? 'google_fallback' : 'gps',
      route_quality_status: candidate.googleGapDistanceKm > 0 ? 'estimated_due_to_gps_gap' : 'measured',
      source: candidate.source,
      counts_as_work_time: true,
      notes: `Automatisch aus Assist-Live-GPS wiederhergestellt. ${candidate.pointCount} verwertbare GPS-Punkte; ${candidate.resolvedGapCount} Unterbrechung(en) über Google-Straßenrouten ergänzt.`,
    }).select('id').single();
    if (insert.error) {
      if (/duplicate|unique/i.test(insert.error.message)) continue;
      throw new Error(insert.error.message);
    }
    const tripId = stringValue((insert.data as Row | null)?.id);
    if (!tripId) throw new Error('Die wiederhergestellte Fahrt besitzt keine Datenbank-ID.');
    for (const pointChunk of chunk(candidate.points, 500)) {
      const pointInsert = await fromUnknownTable(supabase, 'employee_logbook_points').insert(pointChunk.map((point) => ({
        trip_id: tripId,
        tenant_id: input.tenantId,
        employee_id: input.employeeId,
        latitude: point.latitude,
        longitude: point.longitude,
        accuracy: point.accuracy,
        altitude: point.altitude,
        speed: point.speed,
        heading: point.heading,
        recorded_at: point.recordedAt,
        source: 'assist_live_gps_recovery',
      })));
      if (pointInsert.error) {
        await fromUnknownTable(supabase, 'employee_logbook_trips').delete().eq('id', tripId);
        throw new Error(pointInsert.error.message);
      }
    }
    importedCount += 1;
    importedDistanceKm += candidate.finalDistanceKm;
  }

  return { candidates, importedCount, importedDistanceKm };
}
