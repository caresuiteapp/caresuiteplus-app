/**
 * Client portal live visit location — central query with resolveLiveAssignment.
 */
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import type { AssistMapPosition } from '@/lib/assist/assistMapProvider';
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
import { listAssignmentWorkflows } from '@/lib/assist/assignmentWorkflowService';
import {
  buildEmployeePortalTrackingSnapshot,
  getEmployeePortalGpsPermissionStatus,
} from '@/lib/portal/employeePortalVisitTrackingService';
import { fetchClientPortalRestrictedLiveStatus } from '@/lib/portal/clientPortalVisitTrackingViewService';
import { getServiceMode } from '@/lib/services/mode';
import { isDemoMode, isSupabaseConfigured } from '@/lib/supabase/config';
import { resolveLiveAssignment, resolveLiveVisitId } from './resolveLiveAssignment';

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

export type ClientLiveVisitLocation = {
  mapVisible: boolean;
  statusLabel: string | null;
  lastPosition: AssistMapPosition | null;
  fallbackMessage: string | null;
  assignmentId: string;
  visitId: string;
};

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

export async function getClientLiveVisitLocation(input: {
  tenantId: string;
  clientId: string;
  assignmentId: string;
  status: AssignmentStatus;
  plannedStartAt: string;
  plannedEndAt: string;
  portalReleaseEnabled?: boolean;
}): Promise<ClientLiveVisitLocation> {
  const emptyBase = {
    mapVisible: false,
    statusLabel: null as string | null,
    lastPosition: null as AssistMapPosition | null,
    fallbackMessage: null as string | null,
    assignmentId: input.assignmentId,
    visitId: input.assignmentId,
  };

  try {
    return await resolveClientLiveVisitLocation(input, emptyBase);
  } catch (cause) {
    console.warn('[getClientLiveVisitLocation] projection failed:', cause);
    return emptyBase;
  }
}

async function resolveClientLiveVisitLocation(
  input: {
    tenantId: string;
    clientId: string;
    assignmentId: string;
    status: AssignmentStatus;
    plannedStartAt: string;
    plannedEndAt: string;
    portalReleaseEnabled?: boolean;
  },
  emptyBase: ClientLiveVisitLocation,
): Promise<ClientLiveVisitLocation> {
  const localAssignment = listAssignmentWorkflows(input.tenantId).find(
    (row) => row.id === input.assignmentId,
  );

  const settingsResult = await fetchClientPortalSettingsResolved(input.tenantId, input.clientId);
  const hasAppointmentAccess =
    settingsResult.ok && canClientPortalSeeFeature(settingsResult.data, 'appointments');

  if (!hasAppointmentAccess && !localAssignment) {
    return emptyBase;
  }

  if (localAssignment && localAssignment.clientId !== input.clientId) {
    return emptyBase;
  }

  const resolved = localAssignment
    ? null
    : await resolveLiveAssignment({
        tenantId: input.tenantId,
        rawId: input.assignmentId,
        clientId: input.clientId,
      });

  if (!localAssignment) {
    if (!resolved?.ok || !resolved.data) {
      return { ...emptyBase, fallbackMessage: 'Einsatz nicht gefunden.' };
    }
    if (resolved.data.clientId !== input.clientId) {
      return emptyBase;
    }
  }

  const portalReleased = input.portalReleaseEnabled !== false;
  if (!portalReleased) {
    return { ...emptyBase, fallbackMessage: FALLBACK_NOT_RELEASED };
  }

  const eligibility = isClientPortalLiveMapEligible(
    input.status,
    input.plannedStartAt,
    input.plannedEndAt,
  );
  if (!eligibility.eligible) {
    return { ...emptyBase, fallbackMessage: eligibility.fallback };
  }

  const liveStatus = await fetchClientPortalRestrictedLiveStatus(
    input.tenantId,
    resolved?.data?.assignmentId ?? input.assignmentId,
  );

  const usePersistence =
    getServiceMode() === 'supabase' &&
    !isDemoMode() &&
    isSupabaseConfigured() &&
    !localAssignment;

  if (usePersistence) {
    const visitId = await resolveLiveVisitId(
      input.tenantId,
      resolved?.data?.assignmentId ?? input.assignmentId,
    );
    if (!visitId) {
      return {
        ...emptyBase,
        assignmentId: resolved?.data?.assignmentId ?? input.assignmentId,
        visitId: resolved?.data?.visitId ?? input.assignmentId,
        statusLabel: liveStatus.label,
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
        ...emptyBase,
        assignmentId: resolved?.data?.assignmentId ?? input.assignmentId,
        visitId,
        statusLabel: liveStatus.label,
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
      assignmentId: resolved?.data?.assignmentId ?? input.assignmentId,
      visitId,
    };
  }

  const gpsPermission = await getEmployeePortalGpsPermissionStatus();
  const snapshot = buildEmployeePortalTrackingSnapshot(
    input.tenantId,
    input.assignmentId,
    input.status,
    gpsPermission,
  );
  const lastPosition = snapshot.lastPosition
    ? {
        latitude: snapshot.lastPosition.latitude,
        longitude: snapshot.lastPosition.longitude,
        accuracyMeters: snapshot.lastPosition.accuracyMeters,
        capturedAt: snapshot.lastPosition.capturedAt,
      }
    : null;

  return {
    mapVisible: Boolean(lastPosition && snapshot.trackingActive),
    statusLabel: liveStatus.visible ? liveStatus.label : null,
    lastPosition,
    fallbackMessage: lastPosition ? null : eligibility.fallback ?? FALLBACK_NO_POSITION,
    assignmentId: input.assignmentId,
    visitId: input.assignmentId,
  };
}

/** Strip history fields — client portal must never receive GPS trails. */
export function sanitizeClientLiveVisitLocation(
  projection: ClientLiveVisitLocation,
): Omit<ClientLiveVisitLocation, 'visitId'> & { visitId?: never } {
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
    assignmentId: projection.assignmentId,
  };
}
