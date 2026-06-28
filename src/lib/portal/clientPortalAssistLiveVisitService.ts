/**
 * Client portal — sanitized live visit projection for map display.
 * Only last known position during active visit; no GPS history or driving log.
 */
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import type { AssistMapPosition } from '@/lib/assist/assistMapProvider';
import { listAssignmentWorkflows } from '@/lib/assist/assignmentWorkflowService';
import { resolveAssistVisitIdForPersistence } from '@/lib/assist/assistExecutionVisitResolver';
import {
  fetchActiveTrackingSession,
  fetchLatestLocationPointForVisit,
} from '@/lib/assist/assistTrackingPersistenceService';
import {
  canClientPortalSeeFeature,
  fetchClientPortalSettingsResolved,
} from '@/lib/client/clientPortalSettingsService';
import { assertClientPortalVisibility } from '@/lib/geo/geoGuard';
import {
  computeClientPortalVisibilityWindow,
  isWithinLiveTrackingWindow,
} from '@/lib/geo/geoModuleConfig';
import { fetchClientPortalRestrictedLiveStatus } from '@/lib/portal/clientPortalVisitTrackingViewService';
import {
  buildEmployeePortalTrackingSnapshot,
  getEmployeePortalGpsPermissionStatus,
} from '@/lib/portal/employeePortalVisitTrackingService';
import { getServiceMode } from '@/lib/services/mode';
import { isDemoMode, isSupabaseConfigured } from '@/lib/supabase/config';

const ACTIVE_VISIT_STATUSES = new Set<AssignmentStatus>(['unterwegs', 'angekommen', 'gestartet']);
const PRE_START_STATUSES = new Set<AssignmentStatus>(['bestaetigt', 'geplant']);

const FALLBACK_NOT_ACTIVE =
  'Live-Karte ist nur während eines laufenden Einsatzes verfügbar.';
const FALLBACK_NOT_RELEASED =
  'Live-Karte wird angezeigt, sobald der Einsatz für das Portal freigegeben ist.';
const FALLBACK_OUTSIDE_WINDOW =
  'Live-Karte ist derzeit nicht im sichtbaren Zeitfenster.';
const FALLBACK_NO_POSITION =
  'Noch keine Standortdaten — Tracking startet im Mitarbeiterportal während der Einsatzdurchführung.';
const FALLBACK_PRE_START =
  'Ihre Betreuungskraft ist für den Einsatz eingeplant — Live-Standort erscheint bei Anfahrt.';

function isClientPortalLiveMapEligible(
  status: AssignmentStatus,
  plannedStartAt: string,
  plannedEndAt: string,
  now: Date = new Date(),
): { eligible: boolean; fallback: string | null } {
  const window = computeClientPortalVisibilityWindow(plannedStartAt, plannedEndAt);
  const inWindow = assertClientPortalVisibility(window, now).allowed;
  const inPreStartBuffer = isWithinLiveTrackingWindow(plannedStartAt, now);
  const isActive = ACTIVE_VISIT_STATUSES.has(status);
  const isPreStart = PRE_START_STATUSES.has(status);

  if (!inWindow && !isActive) {
    return { eligible: false, fallback: FALLBACK_OUTSIDE_WINDOW };
  }

  if (isActive && inWindow) {
    return { eligible: true, fallback: null };
  }

  if (inPreStartBuffer && inWindow && isPreStart) {
    return { eligible: true, fallback: FALLBACK_PRE_START };
  }

  if (!isActive) {
    return { eligible: false, fallback: FALLBACK_NOT_ACTIVE };
  }

  return { eligible: true, fallback: null };
}

export type ClientPortalAssistLiveVisitProjection = {
  mapVisible: boolean;
  statusLabel: string | null;
  lastPosition: AssistMapPosition | null;
  fallbackMessage: string | null;
};

function assignmentBelongsToClient(
  tenantId: string,
  assignmentId: string,
  clientId: string,
): boolean {
  const record = listAssignmentWorkflows(tenantId).find((row) => row.id === assignmentId);
  if (record) return record.clientId === clientId;
  return getServiceMode() === 'supabase';
}

function mapSnapshotPosition(
  snapshot: ReturnType<typeof buildEmployeePortalTrackingSnapshot>,
): AssistMapPosition | null {
  if (!snapshot.lastPosition) return null;
  return {
    latitude: snapshot.lastPosition.latitude,
    longitude: snapshot.lastPosition.longitude,
    accuracyMeters: snapshot.lastPosition.accuracyMeters,
    capturedAt: snapshot.lastPosition.capturedAt,
  };
}

export async function projectClientPortalAssistLiveVisit(input: {
  tenantId: string;
  clientId: string;
  assignmentId: string;
  status: AssignmentStatus;
  plannedStartAt: string;
  plannedEndAt: string;
  portalReleaseEnabled?: boolean;
}): Promise<ClientPortalAssistLiveVisitProjection> {
  const empty: ClientPortalAssistLiveVisitProjection = {
    mapVisible: false,
    statusLabel: null,
    lastPosition: null,
    fallbackMessage: null,
  };

  const localAssignment = listAssignmentWorkflows(input.tenantId).find(
    (row) => row.id === input.assignmentId,
  );

  const settingsResult = await fetchClientPortalSettingsResolved(input.tenantId, input.clientId);
  const hasAppointmentAccess =
    settingsResult.ok && canClientPortalSeeFeature(settingsResult.data, 'appointments');

  if (!hasAppointmentAccess && !localAssignment) {
    return empty;
  }

  if (!assignmentBelongsToClient(input.tenantId, input.assignmentId, input.clientId)) {
    return empty;
  }

  const portalReleased = input.portalReleaseEnabled !== false;
  if (!portalReleased) {
    return { ...empty, fallbackMessage: FALLBACK_NOT_RELEASED };
  }

  const eligibility = isClientPortalLiveMapEligible(
    input.status,
    input.plannedStartAt,
    input.plannedEndAt,
  );
  if (!eligibility.eligible) {
    return { ...empty, fallbackMessage: eligibility.fallback };
  }

  const liveStatus = await fetchClientPortalRestrictedLiveStatus(input.tenantId, input.assignmentId);

  const usePersistence =
    getServiceMode() === 'supabase' &&
    !isDemoMode() &&
    isSupabaseConfigured() &&
    !localAssignment;

  if (usePersistence) {
    const visitId = await resolveAssistVisitIdForPersistence(input.tenantId, input.assignmentId);
    if (!visitId) {
      return {
        mapVisible: false,
        statusLabel: liveStatus.label,
        lastPosition: null,
        fallbackMessage: FALLBACK_NO_POSITION,
      };
    }

    const [sessionRes, pointRes] = await Promise.all([
      fetchActiveTrackingSession(input.tenantId, visitId),
      fetchLatestLocationPointForVisit(input.tenantId, visitId),
    ]);

    const sessionActive = sessionRes.ok && sessionRes.data?.isActive === true;
    const point = pointRes.ok ? pointRes.data : null;

    if (!sessionActive && !point) {
      return {
        mapVisible: false,
        statusLabel: liveStatus.label,
        lastPosition: null,
        fallbackMessage: FALLBACK_NO_POSITION,
      };
    }

    const lastPosition: AssistMapPosition | null = point
      ? {
          latitude: point.latitude,
          longitude: point.longitude,
          accuracyMeters: point.accuracyMeters,
          capturedAt: point.recordedAt,
        }
      : null;

    return {
      mapVisible: Boolean(lastPosition),
      statusLabel: liveStatus.label,
      lastPosition,
      fallbackMessage: lastPosition ? null : eligibility.fallback ?? FALLBACK_NO_POSITION,
    };
  }

  const gpsPermission = await getEmployeePortalGpsPermissionStatus();
  const snapshot = buildEmployeePortalTrackingSnapshot(
    input.tenantId,
    input.assignmentId,
    input.status,
    gpsPermission,
  );
  const lastPosition = mapSnapshotPosition(snapshot);

  return {
    mapVisible: Boolean(lastPosition && snapshot.trackingActive),
    statusLabel: liveStatus.visible ? liveStatus.label : null,
    lastPosition,
    fallbackMessage: lastPosition ? null : eligibility.fallback ?? FALLBACK_NO_POSITION,
  };
}

/** Strip history fields — client portal must never receive GPS trails. */
export function sanitizeClientPortalLiveVisitPayload(
  projection: ClientPortalAssistLiveVisitProjection,
): ClientPortalAssistLiveVisitProjection {
  return {
    mapVisible: projection.mapVisible,
    statusLabel: projection.statusLabel,
    lastPosition: projection.lastPosition
      ? {
          latitude: projection.lastPosition.latitude,
          longitude: projection.lastPosition.longitude,
          accuracyMeters: projection.lastPosition.accuracyMeters ?? null,
          capturedAt: projection.lastPosition.capturedAt ?? null,
        }
      : null,
    fallbackMessage: projection.fallbackMessage,
  };
}
