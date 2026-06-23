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
import { computeClientPortalVisibilityWindow } from '@/lib/geo/geoModuleConfig';
import { fetchClientPortalRestrictedLiveStatus } from '@/lib/portal/clientPortalVisitTrackingViewService';
import {
  buildEmployeePortalTrackingSnapshot,
  getEmployeePortalGpsPermissionStatus,
} from '@/lib/portal/employeePortalVisitTrackingService';
import { getServiceMode } from '@/lib/services/mode';
import { isDemoMode, isSupabaseConfigured } from '@/lib/supabase/config';

const ACTIVE_VISIT_STATUSES = new Set<AssignmentStatus>(['unterwegs', 'angekommen', 'gestartet']);

export type ClientPortalAssistLiveVisitProjection = {
  mapVisible: boolean;
  statusLabel: string | null;
  lastPosition: AssistMapPosition | null;
  fallbackMessage: string | null;
};

const FALLBACK_NOT_ACTIVE =
  'Live-Karte ist nur während eines laufenden Einsatzes verfügbar.';
const FALLBACK_NOT_RELEASED =
  'Live-Karte wird angezeigt, sobald der Einsatz für das Portal freigegeben ist.';
const FALLBACK_OUTSIDE_WINDOW =
  'Live-Karte ist derzeit nicht im sichtbaren Zeitfenster.';
const FALLBACK_NO_POSITION =
  'Noch keine Standortdaten — Tracking startet im Mitarbeiterportal während der Einsatzdurchführung.';

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

  if (!ACTIVE_VISIT_STATUSES.has(input.status)) {
    return { ...empty, fallbackMessage: FALLBACK_NOT_ACTIVE };
  }

  const portalReleased = input.portalReleaseEnabled !== false;
  if (!portalReleased) {
    return { ...empty, fallbackMessage: FALLBACK_NOT_RELEASED };
  }

  const window = computeClientPortalVisibilityWindow(input.plannedStartAt, input.plannedEndAt);
  const visibility = assertClientPortalVisibility(window);
  if (!visibility.allowed) {
    return { ...empty, fallbackMessage: FALLBACK_OUTSIDE_WINDOW };
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
      fallbackMessage: lastPosition ? null : FALLBACK_NO_POSITION,
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
    fallbackMessage: lastPosition ? null : FALLBACK_NO_POSITION,
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
