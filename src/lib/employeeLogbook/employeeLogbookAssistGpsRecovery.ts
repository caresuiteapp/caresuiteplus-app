import { buildAssistLiveRouteSummary } from '@/features/assistLive/getAssistLiveMonitoring';
import { reconcileAssistLiveRouteGaps } from '@/features/liveTracking/reconcileAssistLiveRouteGaps';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import {
  buildAssistGpsRecoveryLegWindows,
  isAssistTrackingSessionEffectivelyActive,
  type AssistGpsRecoveryPoint,
  type AssistGpsRecoveryTimeEvent,
} from './employeeLogbookGpsSegmentation';
import type { TravelRouteType } from '@/types/modules/travelCompensation';
import { lastItem } from '@/lib/runtime/runtimeSafeCollections';

type Row = Record<string, unknown>;

export const EMPLOYEE_LOGBOOK_RECOVERY_SINCE = '2026-08-24T00:00:00+02:00';
const RECOVERY_SOURCE_PREFIX = 'assist_gps_recovery:';
const RECOVERY_LEG_SOURCE_PREFIX = 'assist_gps_recovery_r18:';

export type EmployeeLogbookGpsRecoveryLeg = {
  id: string;
  kind: 'approach' | 'service_drive' | 'unclassified_drive';
  routeType: TravelRouteType;
  purpose: string;
  startedAt: string;
  endedAt: string;
  pointCount: number;
  measuredDistanceKm: number;
  googleGapDistanceKm: number;
  finalDistanceKm: number;
  resolvedGapCount: number;
  unresolvedGapCount: number;
  reviewRequired: boolean;
  imported: boolean;
  source: string;
  points: AssistGpsRecoveryPoint[];
};

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
  storedActive: boolean;
  stale: boolean;
  lastPointAt: string | null;
  sessionUpdatedAt: string | null;
  legacyImportRequiresReview: boolean;
  source: string;
  points: AssistGpsRecoveryPoint[];
  legs: EmployeeLogbookGpsRecoveryLeg[];
  transportMode: string | null;
  carSelectionProven: boolean;
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
    .select('id,visit_id,started_at,ended_at,is_active,last_location_at,updated_at')
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

  const [visitsResult, pointsResult, eventsResult, importedResult, mobilityResult] = await Promise.all([
    fromUnknownTable(supabase, 'assist_visits')
      .select('id,legacy_assignment_id,client_id,title,address_snapshot,actual_end_at,finished_at,execution_status')
      .eq('tenant_id', tenantId)
      .in('id', visitIds),
    fromUnknownTable(supabase, 'assist_location_points')
      .select('session_id,latitude,longitude,accuracy_meters,altitude_meters,speed_mps,heading_degrees,recorded_at')
      .eq('tenant_id', tenantId)
      .in('session_id', sessionIds)
      .order('recorded_at', { ascending: true }),
    fromUnknownTable(supabase, 'assist_time_events')
      .select('visit_id,event_type,occurred_at')
      .eq('tenant_id', tenantId)
      .in('visit_id', visitIds)
      .gte('occurred_at', EMPLOYEE_LOGBOOK_RECOVERY_SINCE)
      .order('occurred_at', { ascending: true }),
    fromUnknownTable(supabase, 'employee_logbook_trips')
      .select('source')
      .eq('tenant_id', tenantId)
      .eq('employee_id', employeeId)
      .like('source', 'assist_gps_recovery%'),
    fromUnknownTable(supabase, 'employee_visit_mobility_selections')
      .select('assignment_id,transport_mode')
      .eq('tenant_id', tenantId).eq('employee_id', employeeId),
  ]);
  const error = visitsResult.error || pointsResult.error || eventsResult.error || importedResult.error || mobilityResult.error;
  if (error) throw new Error(error.message);

  const visits = new Map(((visitsResult.data ?? []) as Row[]).map((row) => [stringValue(row.id), row]));
  const importedSources = new Set(((importedResult.data ?? []) as Row[]).map((row) => stringValue(row.source)));
  const mobilityByAssignment = new Map(((mobilityResult.data ?? []) as Row[]).map((row) => [stringValue(row.assignment_id), stringValue(row.transport_mode)]));
  const pointsBySession = new Map<string, Row[]>();
  for (const row of (pointsResult.data ?? []) as Row[]) {
    const sessionId = stringValue(row.session_id);
    const list = pointsBySession.get(sessionId) ?? [];
    list.push(row);
    pointsBySession.set(sessionId, list);
  }
  const eventsByVisit = new Map<string, AssistGpsRecoveryTimeEvent[]>();
  for (const row of (eventsResult.data ?? []) as Row[]) {
    const visitId = stringValue(row.visit_id);
    const list = eventsByVisit.get(visitId) ?? [];
    list.push({ eventType: stringValue(row.event_type), occurredAt: stringValue(row.occurred_at) });
    eventsByVisit.set(visitId, list);
  }

  return Promise.all(sessions.map(async (session): Promise<EmployeeLogbookGpsRecoveryCandidate> => {
    const sessionId = stringValue(session.id);
    const visitId = stringValue(session.visit_id);
    const visit = visits.get(visitId) ?? {};
    const assignmentId = nullableString(visit.legacy_assignment_id) ?? visitId;
    const transportMode = mobilityByAssignment.get(assignmentId) ?? null;
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
    const source = `${RECOVERY_SOURCE_PREFIX}${sessionId}`;
    const executionStatus = stringValue(visit.execution_status).toLowerCase();
    const visitClosed = ['completed', 'finished', 'closed', 'ended'].includes(executionStatus);
    const lastPointAt = route.updatedAt;
    const sessionUpdatedAt = nullableString(session.updated_at);
    const storedActive = Boolean(session.is_active);
    const active = isAssistTrackingSessionEffectivelyActive({
      storedActive,
      sessionUpdatedAt,
      lastPointAt,
      visitClosed: visitClosed || Boolean(nullableString(visit.finished_at)) || Boolean(nullableString(visit.actual_end_at)),
    });
    const stale = storedActive && !active;
    const endedAt = nullableString(session.ended_at) ?? nullableString(visit.finished_at) ?? nullableString(visit.actual_end_at) ?? (stale ? lastPointAt : null);
    const legWindows = buildAssistGpsRecoveryLegWindows({
      sessionId,
      points,
      events: eventsByVisit.get(visitId) ?? [],
      fallbackEndedAt: endedAt ?? lastPointAt,
    });
    const legs = await Promise.all(legWindows.map(async (window): Promise<EmployeeLogbookGpsRecoveryLeg> => {
      const summary = buildAssistLiveRouteSummary(window.points.map((point) => ({
        latitude: point.latitude,
        longitude: point.longitude,
        accuracyMeters: point.accuracy,
        capturedAt: point.recordedAt,
      })));
      const reconciliation = summary.gapCount > 0
        ? await reconcileAssistLiveRouteGaps(tenantId, summary.segments)
        : null;
      const legGoogleDistance = reconciliation?.googleGapDistanceKm ?? 0;
      const legResolvedGapCount = reconciliation?.resolvedGapCount ?? 0;
      const legUnresolvedGapCount = Math.max(
        summary.gapCount - legResolvedGapCount,
        reconciliation?.unresolvedGapCount ?? summary.gapCount,
      );
      const legSource = `${RECOVERY_LEG_SOURCE_PREFIX}${sessionId}:${window.id}`;
      return {
        id: window.id,
        kind: window.kind,
        routeType: window.routeType,
        purpose: `${window.purposePrefix} · ${nullableString(visit.title) ?? 'Einsatzfahrt'}`,
        startedAt: window.startedAt,
        endedAt: window.endedAt,
        pointCount: summary.acceptedPointCount,
        measuredDistanceKm: summary.measuredDistanceKm,
        googleGapDistanceKm: legGoogleDistance,
        finalDistanceKm: summary.measuredDistanceKm + legGoogleDistance,
        resolvedGapCount: legResolvedGapCount,
        unresolvedGapCount: legUnresolvedGapCount,
        reviewRequired: window.kind !== 'approach',
        imported: importedSources.has(legSource),
        source: legSource,
        points: window.points,
      };
    }));
    const pendingLegs = legs.filter((leg) => !leg.imported);
    return {
      sessionId,
      visitId,
      assignmentId,
      clientId: nullableString(visit.client_id),
      title: nullableString(visit.title) ?? 'Automatisch aufgezeichnete Einsatzfahrt',
      startedAt: route.startedAt ?? stringValue(session.started_at),
      endedAt,
      endAddress: nullableString(visit.address_snapshot),
      pointCount: route.acceptedPointCount,
      measuredDistanceKm: pendingLegs.reduce((sum, leg) => sum + leg.measuredDistanceKm, 0),
      googleGapDistanceKm: pendingLegs.reduce((sum, leg) => sum + leg.googleGapDistanceKm, 0),
      finalDistanceKm: pendingLegs.reduce((sum, leg) => sum + leg.finalDistanceKm, 0),
      resolvedGapCount: pendingLegs.reduce((sum, leg) => sum + leg.resolvedGapCount, 0),
      unresolvedGapCount: pendingLegs.reduce((sum, leg) => sum + leg.unresolvedGapCount, 0),
      imported: legs.length > 0 && legs.every((leg) => leg.imported),
      active,
      storedActive,
      stale,
      lastPointAt,
      sessionUpdatedAt,
      legacyImportRequiresReview: importedSources.has(source),
      source,
      points,
      legs,
      transportMode,
      carSelectionProven: transportMode === 'car',
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
  const ready = candidates.flatMap((candidate) =>
    candidate.active || !candidate.endedAt || !candidate.carSelectionProven
      ? []
      : candidate.legs.filter((leg) =>
          !leg.imported &&
          leg.pointCount >= 2 &&
          leg.finalDistanceKm >= 0.05 &&
          leg.unresolvedGapCount === 0,
        ).map((leg) => ({ candidate, leg })),
  );

  let importedCount = 0;
  let importedDistanceKm = 0;
  for (const { candidate, leg } of ready) {
    const insert = await fromUnknownTable(supabase, 'employee_logbook_trips').insert({
      tenant_id: input.tenantId,
      employee_id: input.employeeId,
      vehicle_id: input.vehicleId,
      assignment_id: candidate.assignmentId,
      client_id: candidate.clientId,
      route_type: leg.routeType,
      purpose: leg.purpose,
      manual_reason: null,
      status: leg.reviewRequired ? 'review_required' : 'completed',
      started_at: leg.startedAt,
      ended_at: leg.endedAt,
      start_latitude: leg.points[0]?.latitude ?? null,
      start_longitude: leg.points[0]?.longitude ?? null,
      end_latitude: lastItem(leg.points)?.latitude ?? null,
      end_longitude: lastItem(leg.points)?.longitude ?? null,
      end_address: candidate.endAddress,
      distance_gps_km: leg.measuredDistanceKm,
      google_route_distance_km: leg.googleGapDistanceKm || null,
      distance_final_km: leg.finalDistanceKm,
      gps_captured: true,
      navigation_provider: leg.googleGapDistanceKm > 0 ? 'google' : null,
      distance_source: leg.googleGapDistanceKm > 0 ? 'google_fallback' : 'gps',
      route_quality_status: leg.googleGapDistanceKm > 0 ? 'estimated_due_to_gps_gap' : 'measured',
      source: leg.source,
      counts_as_work_time: true,
      notes: leg.reviewRequired
        ? `Automatisch als einzelner Fahrtabschnitt aus Assist-Live-GPS wiederhergestellt. Fahrtzweck und Zuordnung müssen durch die Verwaltung bestätigt werden; bis dahin sind Kilometererstattung und Abrechnung gesperrt. ${leg.pointCount} verwertbare GPS-Punkte; ${leg.resolvedGapCount} Unterbrechung(en) über Google-Straßenrouten ergänzt.`
        : `Automatisch als eindeutig abgegrenzte Anfahrt aus Assist-Live-GPS wiederhergestellt. ${leg.pointCount} verwertbare GPS-Punkte; ${leg.resolvedGapCount} Unterbrechung(en) über Google-Straßenrouten ergänzt.`,
    }).select('id').single();
    if (insert.error) {
      if (/duplicate|unique/i.test(insert.error.message)) continue;
      throw new Error(insert.error.message);
    }
    const tripId = stringValue((insert.data as Row | null)?.id);
    if (!tripId) throw new Error('Die wiederhergestellte Fahrt besitzt keine Datenbank-ID.');
    for (const pointChunk of chunk(leg.points, 500)) {
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
    importedDistanceKm += leg.finalDistanceKm;
  }

  return { candidates, importedCount, importedDistanceKm };
}
