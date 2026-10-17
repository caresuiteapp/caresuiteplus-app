import type { RoleKey, ServiceResult } from '@/types';
import type { PermissionKey } from '@/types/permissions';
import { visitSupabaseRepository } from '@/lib/assist/repositories/visitRepository.supabase';
import type { VisitDispositionListItem } from '@/lib/assist/visitTypes';
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import type { EmployeePortalLocationConsent, EmployeePortalTrackingSnapshot } from '@/types/modules/employeePortalTracking';
import type { AssistLocationPointRow } from '@/types/assistExecutionPersistence';
import { DAY_MONITOR_STATUS_COLORS, type DayMonitorDisplayStatus } from '@/types/modules/liveMonitor';
import { fetchVisitDispositionList } from '@/lib/assist/visitService';
import { fetchActiveTrackingSession, fetchLatestTrackingSessionWithConsent, fetchLocationPointsForVisit, fetchTimeEventsForVisit } from '@/lib/assist/assistTrackingPersistenceService';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { calculateVisitTimes, type TimeEventLike } from '@/features/assistWorkflow/calculateVisitTimes';
import { parseGoogleRouteReference } from '@/features/liveTracking/googleRouteReference';
import { reconcileAssistLiveRouteGaps } from '@/features/liveTracking/reconcileAssistLiveRouteGaps';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { isVirtualRecurringOccurrenceId } from '@/lib/assist/visitRecurrenceExecution';
import { buildAssistLiveRouteSummary, getAssistLiveMonitoring, type AssistLiveMonitoringRow, type AssistLiveMonitoringOverview } from './getAssistLiveMonitoring';

export type AssistLiveWorkspaceRow = AssistLiveMonitoringRow & {
  trackingError: string | null;
  warnings: string[];
};
export type AssistLiveWorkspaceOverview = Omit<AssistLiveMonitoringOverview, 'rows'> & {
  rows: AssistLiveWorkspaceRow[];
  partialData: boolean;
  warnings: string[];
};

export const LIVE_POSITION_FRESH_MS = 45_000;
export const LIVE_RUNNING_STATUSES: readonly AssignmentStatus[] = ['unterwegs', 'angekommen', 'gestartet', 'pausiert'];
const unknownConsent: EmployeePortalLocationConsent = { granted: false, grantedAt: null, explainedAt: null };
const dayFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' });
export function liveMonitoringDayKey(value: Date | string | number = new Date()): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const parts = dayFormatter.formatToParts(date);
  return ['year', 'month', 'day'].map((type) => parts.find((part) => part.type === type)?.value).join('-');
}

/** Include ongoing overnight visits and appointments crossing local midnight. */
export function isVisitInLiveDay(item: Pick<VisitDispositionListItem, 'scheduledStart' | 'scheduledEnd' | 'assignmentStatus'>, now = new Date()): boolean {
  const day = liveMonitoringDayKey(now);
  const start = liveMonitoringDayKey(item.scheduledStart);
  const endMs = new Date(item.scheduledEnd).getTime();
  const end = liveMonitoringDayKey(endMs - 1);
  return (Boolean(start) && start <= day && Boolean(end) && end >= day) ||
    (LIVE_RUNNING_STATUSES.includes(item.assignmentStatus) && Number.isFinite(new Date(item.scheduledStart).getTime()) && new Date(item.scheduledStart) <= now);
}

export function isFreshLivePosition(row: Pick<AssistLiveMonitoringRow, 'tracking' | 'status'>, now = Date.now()): boolean {
  const tracking = row.tracking;
  const point = tracking?.lastPosition;
  if (!tracking?.trackingActive || !tracking.assistVisible || !tracking.consent.granted || !point || !LIVE_RUNNING_STATUSES.includes(row.status)) return false;
  if (!validPosition(point.latitude, point.longitude, point.accuracyMeters, point.capturedAt, now)) return false;
  const age = now - new Date(point.capturedAt).getTime();
  const heartbeatAge = tracking.deviceHeartbeatAt ? now - new Date(tracking.deviceHeartbeatAt).getTime() : null;
  return age < LIVE_POSITION_FRESH_MS && (heartbeatAge === null || (Number.isFinite(heartbeatAge) && heartbeatAge >= 0 && heartbeatAge < LIVE_POSITION_FRESH_MS));
}

function validPosition(lat: number, lng: number, accuracy: number | null, at: string, now: number): boolean {
  const age = now - new Date(at).getTime();
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 &&
    (accuracy === null || (Number.isFinite(accuracy) && accuracy >= 0 && accuracy <= 120)) && Number.isFinite(age) && age >= 0;
}

const displayStatuses: Record<AssignmentStatus, DayMonitorDisplayStatus> = {
  geplant: 'geplant', bestaetigt: 'geplant', unterwegs: 'unterwegs', angekommen: 'angekommen', gestartet: 'gestartet', pausiert: 'pausiert',
  beendet: 'beendet', dokumentation_offen: 'doku_fehlt', unterschrift_offen: 'signatur_fehlt', abgeschlossen: 'abgeschlossen', storniert: 'abgesagt', nicht_erschienen: 'nicht_angetroffen',
};
function baseRow(item: VisitDispositionListItem, now: Date): AssistLiveWorkspaceRow {
  const status = item.assignmentStatus;
  const displayStatus = displayStatuses[status];
  const plannedStart = new Date(item.scheduledStart).getTime();
  const plannedEnd = new Date(item.scheduledEnd).getTime();
  const delay = ['geplant', 'bestaetigt', 'unterwegs'].includes(status) ? Math.max(0, Math.floor((now.getTime() - plannedStart) / 60_000)) : 0;
  const overrun = ['gestartet', 'pausiert'].includes(status) ? Math.max(0, Math.floor((now.getTime() - plannedEnd) / 60_000)) : 0;
  return {
    assignmentId: item.id, visitId: item.id, tenantId: item.tenantId, title: item.title, employeeId: item.employeeId, clientId: item.clientId ?? '',
    employeeName: item.employeeName || null, clientName: item.clientName || null, status,
    canonicalStatus: ({ geplant: 'planned', bestaetigt: 'confirmed', unterwegs: 'on_the_way', angekommen: 'arrived', gestartet: 'started', pausiert: 'paused', beendet: 'finished', dokumentation_offen: 'documentation_pending', unterschrift_offen: 'signature_pending', abgeschlossen: 'completed', storniert: 'cancelled', nicht_erschienen: 'no_show' } as const)[status],
    displayStatus, statusColor: DAY_MONITOR_STATUS_COLORS[displayStatus], plannedStartAt: item.scheduledStart, plannedEndAt: item.scheduledEnd,
    actualStartAt: item.actualStartAt ?? null, actualEndAt: item.actualEndAt ?? null,
    delayMinutes: Number.isFinite(delay) && delay > 0 ? delay : null, overrunMinutes: Number.isFinite(overrun) && overrun > 0 ? overrun : null,
    docStatus: item.documentationStatus === 'complete' || ['unterschrift_offen', 'abgeschlossen'].includes(status) ? 'ok' : ['beendet', 'dokumentation_offen'].includes(status) ? 'missing' : 'na',
    signatureStatus: status === 'abgeschlossen' || item.proofStatus === 'signed' ? 'ok' : status === 'unterschrift_offen' ? 'missing' : 'na',
    problemStatus: item.isAtRisk ? 'reported' : 'none', cancelRequest: false, rescheduleRequest: false,
    tracking: null, route: null, trackingError: null, warnings: [],
  };
}

async function readMonitoringConsent(tenantId: string, employeeId: string): Promise<ServiceResult<EmployeePortalLocationConsent | null>> {
  const client = getSupabaseClient();
  if (!client) return { ok: false, error: 'Standortfreigaben konnten nicht geladen werden.' };
  // Do not filter revoked_at: an explicit withdrawal must outrank an older session consent.
  const { data, error } = await fromUnknownTable(client, 'employee_location_consents')
    .select('consent_granted_at, consent_explained_at, revoked_at').eq('tenant_id', tenantId).eq('employee_id', employeeId).maybeSingle();
  if (error) return { ok: false, error: 'Standortfreigaben konnten nicht geladen werden.' };
  const row = data as { consent_granted_at: string | null; consent_explained_at: string | null; revoked_at: string | null } | null;
  return { ok: true, data: row ? { granted: Boolean(row.consent_granted_at && !row.revoked_at), grantedAt: row.consent_granted_at, explainedAt: row.consent_explained_at } : null };
}

async function safeRead<T>(read: () => Promise<ServiceResult<T>>): Promise<ServiceResult<T>> {
  try { return await read(); } catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Daten konnten nicht geladen werden.' }; }
}
function failed(result: ServiceResult<unknown>): boolean { return !result.ok || Boolean((result as { tableMissing?: boolean }).tableMissing); }
function failedLabel(result: ServiceResult<unknown>, label: string): string | null { return failed(result) ? `${label} konnten nicht geladen werden.` : null; }

function fallbackTimeEvents(item: VisitDispositionListItem, events: TimeEventLike[]): TimeEventLike[] {
  const result = [...events];
  const add = (eventType: string, occurredAt: string | null | undefined) => {
    if (occurredAt && Number.isFinite(new Date(occurredAt).getTime()) && !events.some((event) => event.eventType === eventType)) result.push({ eventType, occurredAt });
  };
  add('drive_start', item.onTheWayAt); add('arrive', item.arrivedAt); add('service_start', item.actualStartAt); add('service_end', item.actualEndAt);
  return result;
}

async function enrichRow(tenantId: string, item: VisitDispositionListItem, requestedNow: Date | undefined, consentFor: (employeeId: string) => Promise<ServiceResult<EmployeePortalLocationConsent | null>>): Promise<AssistLiveWorkspaceRow> {
  const row = baseRow(item, requestedNow ?? new Date());
  // Virtual occurrences have no execution yet. Reading their master would leak another day's GPS/timers.
  if (isVirtualRecurringOccurrenceId(item.id)) return row;
  const [active, latest, times, consent] = await Promise.all([
    safeRead(() => fetchActiveTrackingSession(tenantId, item.id)),
    safeRead(() => fetchLatestTrackingSessionWithConsent(tenantId, item.id)),
    safeRead(() => fetchTimeEventsForVisit(tenantId, item.id)),
    item.employeeId ? consentFor(item.employeeId) : Promise.resolve({ ok: true as const, data: null }),
  ]);
  row.warnings = [failedLabel(active, 'Tracking-Sitzungen'), failedLabel(latest, 'Standortfreigaben'), failedLabel(times, 'Einsatzzeiten'), failedLabel(consent, 'Standortfreigaben')].filter((warning): warning is string => Boolean(warning));
  if (failed(active) || failed(latest) || failed(times)) { row.trackingError = row.warnings.join(' '); return row; }
  if (!active.ok || !latest.ok || !times.ok) return row;
  const candidate = active.data ?? latest.data;
  // A visit can be reassigned after a previous employee recorded a route. The
  // current employee's consent must never authorize that other person's GPS.
  const sessionMatches = !candidate || (candidate.tenantId === tenantId && candidate.visitId === item.id &&
    Boolean(item.employeeId) && candidate.employeeId === item.employeeId);
  const session = sessionMatches ? candidate : null;
  if (!sessionMatches) {
    row.trackingError = 'Die Standortaufzeichnung gehört nicht zur aktuellen Mitarbeitendenzuordnung.';
    row.warnings.push(row.trackingError);
  }
  const points = session ? await safeRead(() => fetchLocationPointsForVisit(tenantId, item.id, session.id)) : { ok: true as const, data: [] as AssistLocationPointRow[] };
  const pointWarning = failedLabel(points, 'Standortdaten');
  if (pointWarning) row.warnings.push(pointWarning);
  const now = requestedNow ?? new Date();
  const scopedPoints = points.ok && session ? points.data.filter((point) => point.tenantId === tenantId && point.visitId === item.id && point.sessionId === session.id) : [];
  if (points.ok && scopedPoints.length !== points.data.length) {
    row.trackingError = 'Ein Teil der Standortdaten konnte diesem Einsatz nicht eindeutig zugeordnet werden.';
    row.warnings.push(row.trackingError);
  }
  const validPoints = scopedPoints.filter((point) => validPosition(point.latitude, point.longitude, point.accuracyMeters, point.recordedAt, now.getTime()));
  const point = validPoints[validPoints.length - 1] ?? null;
  const grantedConsent = !consent.ok ? unknownConsent : consent.data !== null ? consent.data : session?.consentGrantedAt ? { granted: true, grantedAt: session.consentGrantedAt, explainedAt: session.consentExplainedAt } : unknownConsent;
  const events = fallbackTimeEvents(item, times.data.map(({ eventType, occurredAt }) => ({ eventType, occurredAt })));
  const trackingActive = Boolean(sessionMatches && active.data?.isActive && LIVE_RUNNING_STATUSES.includes(row.status));
  const tracking: EmployeePortalTrackingSnapshot = {
    assignmentId: item.id, tenantId, status: row.status, consent: grantedConsent,
    // Device permission is not the administrator browser's geolocation permission.
    gpsPermission: point ? 'granted' : 'undetermined', trackingActive, deviceHeartbeatAt: sessionMatches ? active.data?.updatedAt ?? null : null,
    lastPosition: point && grantedConsent.granted ? { latitude: point.latitude, longitude: point.longitude, accuracyMeters: point.accuracyMeters, capturedAt: point.recordedAt } : null,
    googleRouteReference: parseGoogleRouteReference(session?.metadata), timers: calculateVisitTimes(events, row.status, now), geofence: null,
    warnings: row.warnings, arrivalProof: times.data.some((event) => event.eventType === 'arrived_without_gps') ? 'without_gps' : times.data.some((event) => event.eventType === 'arrived_manual') ? 'manual' : null,
    assistVisible: trackingActive && grantedConsent.granted && Boolean(point), clientPortalVisible: false,
  };
  row.tracking = tracking;
  row.trackingTimeEvents = events;
  if (pointWarning) row.trackingError = pointWarning;
  if (validPoints.length && grantedConsent.granted) {
    const measured = buildAssistLiveRouteSummary(validPoints.map((point) => ({ latitude: point.latitude, longitude: point.longitude, accuracyMeters: point.accuracyMeters, capturedAt: point.recordedAt })));
    // Keep the existing route-gap reconciliation; it reads/maps a route and never starts GPS.
    const recovery = measured.gapCount ? await reconcileAssistLiveRouteGaps(tenantId, measured.segments).catch(() => null) : null;
    const resolved = recovery?.resolvedGapCount ?? 0;
    const unresolved = Math.max(0, measured.gapCount - resolved, recovery?.unresolvedGapCount ?? 0);
    const gapDistance = recovery?.googleGapDistanceKm ?? 0;
    row.route = { ...measured, discardedPointCount: measured.discardedPointCount + scopedPoints.length - validPoints.length, googleGapDistanceKm: gapDistance, resolvedGapCount: resolved, unresolvedGapCount: unresolved,
      totalDistanceKm: measured.totalDistanceKm + gapDistance, distanceStatus: unresolved ? 'incomplete' : gapDistance ? 'google_reconciled' : 'measured' };
    if (points.ok && points.data.length >= 1_500) row.warnings.push('Die Route zeigt die letzten 1.500 Standortpunkte; die Entfernung kann unvollständig sein.');
  }
  return row;
}

export function buildLiveWorkspaceOverview(rows: AssistLiveWorkspaceRow[], generatedAt: string, now = Date.now()): AssistLiveWorkspaceOverview {
  const liveRows = rows.filter((row) => isFreshLivePosition(row, now));
  const active = rows.filter((row) => LIVE_RUNNING_STATUSES.includes(row.status));
  const warnings = [...new Set(rows.flatMap((row) => row.warnings))];
  return {
    rows, todayCount: rows.filter((row) => liveMonitoringDayKey(row.plannedStartAt) === liveMonitoringDayKey(now)).length,
    runningCount: active.length, activeTrackingCount: active.filter((row) => row.tracking?.trackingActive).length, freshGpsCount: liveRows.length,
    consentPendingCount: active.filter((row) => row.tracking && !row.tracking.consent.granted).length,
    gpsDeniedCount: active.filter((row) => row.tracking?.gpsPermission === 'denied').length,
    mapMarkers: liveRows.map((row) => ({ id: row.assignmentId, latitude: row.tracking!.lastPosition!.latitude, longitude: row.tracking!.lastPosition!.longitude,
      label: row.clientName || row.title, subtitle: row.employeeName ?? undefined, capturedAt: row.tracking!.lastPosition!.capturedAt, accuracyMeters: row.tracking!.lastPosition!.accuracyMeters })),
    readOnlyNotice: 'Standorte werden aus dem Mitarbeiterportal übertragen. Die Verwaltung startet keine Standortaufzeichnung.',
    generatedAt, partialData: warnings.length > 0, warnings,
  };
}

export async function getAssistLiveMonitoringWorkspace(tenantId: string, roleKey?: RoleKey | null, now?: Date, effectivePermissions?: readonly PermissionKey[]): Promise<ServiceResult<AssistLiveWorkspaceOverview>> {
  const denied = enforcePermission<AssistLiveWorkspaceOverview>(roleKey, 'assist.assignments.view', { effectivePermissions });
  if (denied) return denied;
  const blocked = guardServiceTenant(tenantId);
  if (blocked) return blocked;
  if (getServiceMode() !== 'supabase') {
    const demo = await getAssistLiveMonitoring(tenantId, roleKey);
    if (!demo.ok) return demo;
    return { ok: true, data: buildLiveWorkspaceOverview(demo.data.rows.map((row) => ({ ...row, trackingError: null, warnings: [] })), demo.data.generatedAt, (now ?? new Date()).getTime()) };
  }
  if (!getSupabaseClient()) return { ok: false, error: 'Die Verbindung zum Live-Status ist nicht verfügbar.' };
  // The repository applies tenant filtering and server RLS. The effective permission
  // was checked above; the legacy facade only understands static role defaults.
  const visits = await safeRead(() => effectivePermissions ? visitSupabaseRepository.list(tenantId) : fetchVisitDispositionList(tenantId, roleKey));
  if (!visits.ok) return visits;
  const items = visits.data.filter((item) => item.tenantId === tenantId && isVisitInLiveDay(item, now));
  const consentCache = new Map<string, Promise<ServiceResult<EmployeePortalLocationConsent | null>>>();
  const consentFor = (employeeId: string) => {
    if (!consentCache.has(employeeId)) consentCache.set(employeeId, safeRead(() => readMonitoringConsent(tenantId, employeeId)));
    return consentCache.get(employeeId)!;
  };
  // Bound fan-out for larger teams; the list already contains execution/documentation overlays.
  const rows: AssistLiveWorkspaceRow[] = new Array(items.length);
  let index = 0;
  await Promise.all(Array.from({ length: Math.min(items.length, 4) }, async () => {
    while (index < items.length) { const slot = index++; rows[slot] = await enrichRow(tenantId, items[slot], now, consentFor); }
  }));
  rows.sort((a, b) => Number(LIVE_RUNNING_STATUSES.includes(b.status)) - Number(LIVE_RUNNING_STATUSES.includes(a.status)) || a.plannedStartAt.localeCompare(b.plannedStartAt));
  // All durations and the screen's ticking origin use the same instant. Earlier
  // rows may have spent seconds awaiting other team members or route recovery.
  const generatedAt = now ?? new Date();
  for (const row of rows) if (row.tracking && row.trackingTimeEvents) {
    row.tracking = { ...row.tracking, timers: calculateVisitTimes(row.trackingTimeEvents, row.status, generatedAt) };
  }
  return { ok: true, data: buildLiveWorkspaceOverview(rows, generatedAt.toISOString(), generatedAt.getTime()) };
}
