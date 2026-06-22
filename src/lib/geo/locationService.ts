import type { RoleKey, ServiceResult } from '@/types';
import type {
  AssignmentLocationEvent,
  AssignmentLocationEventType,
  GeoConsentContext,
  GeoPosition,
  LocationCaptureInput,
} from '@/types/geo';
import { ROLE_PERMISSIONS } from '@/lib/permissions/staticRolePermissions';
import {
  assertClientPortalVisibility,
  assertGeoExecutionReady,
  assertGeoRolePermission,
  assertGpsConsent,
  assertLiveTrackingAllowed,
  assertLocationPurpose,
  assertNoPermanentTracking,
  runGeoGuardChain,
} from '@/lib/geo/geoGuard';
import {
  computeClientPortalVisibilityWindow,
} from '@/lib/geo/geoModuleConfig';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import {
  auditBlockedGeoAction,
  buildRetentionUntil,
  recordLocationAuditEvent,
} from '@/lib/geo/locationAuditService';

const locationEventBuffer: AssignmentLocationEvent[] = [];

export function peekAssignmentLocationEvents(tenantId: string): AssignmentLocationEvent[] {
  return locationEventBuffer.filter((e) => e.tenantId === tenantId);
}

export function clearAssignmentLocationEventBuffer(): void {
  locationEventBuffer.length = 0;
}

async function captureAssignmentLocation(
  input: LocationCaptureInput,
  actorRoleKey: RoleKey | null | undefined,
  liveTracking: boolean,
): Promise<ServiceResult<AssignmentLocationEvent>> {
  const tenantBlock = guardServiceTenant(input.tenantId);
  if (tenantBlock) return tenantBlock;

  const rolePerms = ROLE_PERMISSIONS[actorRoleKey ?? 'caregiver'] ?? [];
  const portalWindow = computeClientPortalVisibilityWindow(
    input.assignmentStartAt,
  );

  const guard = runGeoGuardChain([
    assertLocationPurpose(input.purpose),
    assertGeoRolePermission(actorRoleKey, input.purpose, rolePerms),
    assertGpsConsent(input.purpose, input.consent),
    assertNoPermanentTracking(false),
    assertLiveTrackingAllowed(
      liveTracking ? 'live_tracking' : input.purpose,
      {
        assignmentId: input.assignmentId,
        assignmentStartAt: input.assignmentStartAt,
      },
    ),
    assertGeoExecutionReady(),
  ]);

  if (!guard.allowed) {
    await auditBlockedGeoAction(
      {
        tenantId: input.tenantId,
        action: `${input.eventType}_blocked`,
        entityType: 'assignment_location_event',
        purpose: input.purpose,
        blockedReason: guard.message,
        metadata: { assignmentId: input.assignmentId, eventType: input.eventType },
      },
      actorRoleKey,
    );
    return { ok: false, error: guard.message };
  }

  const now = new Date().toISOString();
  const event: AssignmentLocationEvent = {
    id: `assign-loc-${Date.now()}`,
    tenantId: input.tenantId,
    createdAt: now,
    updatedAt: now,
    assignmentId: input.assignmentId,
    employeeProfileId: null,
    eventType: input.eventType,
    latitude: input.position?.latitude ?? null,
    longitude: input.position?.longitude ?? null,
    accuracyMeters: input.position?.accuracyMeters ?? null,
    purpose: input.purpose,
    consentVerified: input.consent.employeeConsentGranted,
    liveTracking,
    recordedAt: input.position?.timestamp ?? new Date().toISOString(),
    retentionUntil: buildRetentionUntil(),
    clientPortalVisibleFrom: portalWindow.visibleFrom,
    clientPortalVisibleUntil: portalWindow.visibleUntil,
  };

  locationEventBuffer.push(event);

  recordLocationAuditEvent({
    tenantId: input.tenantId,
    action: input.eventType,
    entityType: 'assignment_location_event',
    entityId: event.id,
    purpose: input.purpose,
  });

  return { ok: true, data: event };
}

/** Einsatzstatus mit GPS plausibilisieren — preparedOnly. */
export async function plausibilizeAssignmentStatusWithGps(
  input: LocationCaptureInput,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<AssignmentLocationEvent>> {
  return captureAssignmentLocation(
    { ...input, purpose: 'status_plausibility', eventType: 'status_plausibility' },
    actorRoleKey,
    false,
  );
}

export async function markUnterwegsWithLocation(
  input: Omit<LocationCaptureInput, 'purpose' | 'eventType'>,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<AssignmentLocationEvent>> {
  return captureAssignmentLocation(
    { ...input, purpose: 'unterwegs_status', eventType: 'unterwegs' },
    actorRoleKey,
    false,
  );
}

export async function markAngekommenWithLocation(
  input: Omit<LocationCaptureInput, 'purpose' | 'eventType'>,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<AssignmentLocationEvent>> {
  return captureAssignmentLocation(
    { ...input, purpose: 'angekommen_status', eventType: 'angekommen' },
    actorRoleKey,
    false,
  );
}

export async function markEinsatzGestartetWithLocation(
  input: Omit<LocationCaptureInput, 'purpose' | 'eventType'>,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<AssignmentLocationEvent>> {
  return captureAssignmentLocation(
    { ...input, purpose: 'einsatz_gestartet_status', eventType: 'einsatz_gestartet' },
    actorRoleKey,
    false,
  );
}

/** Live-Tracking nur im Einsatzfenster (30 min vor/nach Start). */
export async function startLiveTrackingSession(
  input: Omit<LocationCaptureInput, 'purpose' | 'eventType'>,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<AssignmentLocationEvent>> {
  return captureAssignmentLocation(
    { ...input, purpose: 'live_tracking', eventType: 'live_tracking_start' },
    actorRoleKey,
    true,
  );
}

export function canClientPortalViewLocationEvent(
  event: AssignmentLocationEvent,
  now: Date = new Date(),
): boolean {
  if (!event.clientPortalVisibleFrom || !event.clientPortalVisibleUntil) {
    return false;
  }
  const check = assertClientPortalVisibility(
    {
      visibleFrom: event.clientPortalVisibleFrom,
      visibleUntil: event.clientPortalVisibleUntil,
    },
    now,
  );
  return check.allowed;
}

export type LiveTrackingCheckInput = {
  assignmentStartAt: string;
  consent: GeoConsentContext;
  roleKey: RoleKey | null;
  rolePermissions: readonly string[];
};

export function evaluateLiveTrackingBlocked(input: LiveTrackingCheckInput): ServiceResult<GeoPosition> {
  const guard = runGeoGuardChain([
    assertGeoRolePermission(input.roleKey, 'live_tracking', input.rolePermissions as never),
    assertGpsConsent('live_tracking', input.consent),
    assertLiveTrackingAllowed('live_tracking', {
      assignmentId: 'check',
      assignmentStartAt: input.assignmentStartAt,
    }),
    assertGeoExecutionReady(),
  ]);

  if (!guard.allowed) {
    return { ok: false, error: guard.message };
  }
  return { ok: true, data: { latitude: 0, longitude: 0, accuracyMeters: null, timestamp: new Date().toISOString() } };
}
