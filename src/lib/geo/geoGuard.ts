import type { RoleKey } from '@/types/core/auth';
import type { PermissionKey } from '@/types/permissions';
import type {
  ClientPortalVisibilityWindow,
  GeoAssignmentContext,
  GeoConsentContext,
  GeoGuardCode,
  GeoGuardResult,
  GeoProviderContext,
  GeofenceEvent,
  LocationPurpose,
} from '@/types/geo';
import {
  GEO_PREPARED_MESSAGE,
  isGeoLiveReady,
  isWithinLiveTrackingWindow,
} from '@/lib/geo/geoModuleConfig';

const PURPOSE_PERMISSIONS: Partial<Record<LocationPurpose, PermissionKey>> = {
  address_validation: 'geo.routes.view',
  assignment_route: 'geo.routes.view',
  travel_time: 'geo.routes.view',
  distance_calculation: 'geo.routes.view',
  status_plausibility: 'geo.location.capture',
  unterwegs_status: 'geo.location.capture',
  angekommen_status: 'geo.location.capture',
  einsatz_gestartet_status: 'geo.location.capture',
  live_tracking: 'geo.live_tracking',
  mileage_log: 'geo.mileage.manage',
  geofence_check: 'geo.routes.view',
};

const LIVE_TRACKING_PURPOSES = new Set<LocationPurpose>(['live_tracking']);

const GPS_CAPTURE_PURPOSES = new Set<LocationPurpose>([
  'status_plausibility',
  'unterwegs_status',
  'angekommen_status',
  'einsatz_gestartet_status',
  'live_tracking',
]);

function deny(code: GeoGuardCode, message: string): GeoGuardResult {
  return { allowed: false, code, message };
}

export function resolveGeoPermissionForPurpose(purpose: LocationPurpose): PermissionKey {
  return PURPOSE_PERMISSIONS[purpose] ?? 'geo.routes.view';
}

export function assertGeoRolePermission(
  roleKey: RoleKey | null | undefined,
  purpose: LocationPurpose,
  rolePermissions: readonly PermissionKey[],
): GeoGuardResult {
  if (!roleKey) {
    return deny('missing_role', 'Rolle fehlt — Standortaktion blockiert.');
  }
  const permission = resolveGeoPermissionForPurpose(purpose);
  if (!rolePermissions.includes(permission)) {
    return deny('missing_permission', `Keine Berechtigung (${permission}) für Zweck „${purpose}".`);
  }
  return { allowed: true };
}

export function assertLocationPurpose(purpose: LocationPurpose | null | undefined): GeoGuardResult {
  if (!purpose?.trim()) {
    return deny('missing_purpose', 'Zweck für Standortdaten ist erforderlich.');
  }
  return { allowed: true };
}

export function assertGpsConsent(
  purpose: LocationPurpose,
  consent: GeoConsentContext,
): GeoGuardResult {
  if (!GPS_CAPTURE_PURPOSES.has(purpose)) {
    return { allowed: true };
  }
  if (!consent.employeeConsentGranted) {
    return deny(
      'missing_consent',
      'Standort-Einwilligung fehlt — GPS-Erfassung blockiert. Mitarbeitende müssen informiert sein.',
    );
  }
  return { allowed: true };
}

export function assertLiveTrackingWindow(
  assignment: GeoAssignmentContext,
  now: Date = new Date(),
): GeoGuardResult {
  if (!isWithinLiveTrackingWindow(assignment.assignmentStartAt, now)) {
    return deny(
      'live_tracking_outside_window',
      'Live-Tracking nur 30 Minuten vor/nach Einsatzbeginn erlaubt.',
    );
  }
  return { allowed: true };
}

export function assertLiveTrackingAllowed(
  purpose: LocationPurpose,
  assignment: GeoAssignmentContext,
  now: Date = new Date(),
): GeoGuardResult {
  if (!LIVE_TRACKING_PURPOSES.has(purpose)) {
    return { allowed: true };
  }
  if (!isGeoLiveReady()) {
    return deny('live_tracking_not_ready', GEO_PREPARED_MESSAGE);
  }
  return assertLiveTrackingWindow(assignment, now);
}

export function assertNoPermanentTracking(isContinuous: boolean): GeoGuardResult {
  if (isContinuous) {
    return deny(
      'permanent_tracking_denied',
      'Dauerüberwachung ist nicht erlaubt — nur zweckgebundene Erfassung im Einsatzfenster.',
    );
  }
  return { allowed: true };
}

export function assertProviderConfigured(
  provider: GeoProviderContext,
  purpose: LocationPurpose,
): GeoGuardResult {
  if (!provider.configured) {
    return deny(
      'provider_not_configured',
      `Kartenprovider „${provider.providerKey}" ist nicht konfiguriert — Aktion blockiert.`,
    );
  }
  return { allowed: true };
}

export function assertExternalProviderAllowed(
  provider: GeoProviderContext,
  purpose: LocationPurpose,
): GeoGuardResult {
  const configured = assertProviderConfigured(provider, purpose);
  if (!configured.allowed) return configured;

  if (!provider.externalDataAllowed) {
    return deny(
      'external_provider_blocked',
      `Keine Datenübermittlung an „${provider.providerKey}" — Freigabe (external_data_allowed) fehlt.`,
    );
  }
  if (!provider.credentialReference?.trim()) {
    return deny(
      'external_provider_blocked',
      `Keine Anbieter-Konfiguration — externe Geocoding-/Routing-Daten blockiert.`,
    );
  }
  return { allowed: true };
}

export function assertGeofenceNotProof(event: Pick<GeofenceEvent, 'validated' | 'proofEligible'>): GeoGuardResult {
  if (event.proofEligible && !event.validated) {
    return deny(
      'geofence_not_validated',
      'Geofence-Ereignis ist nicht validiert — kein Nachweis ohne Prüfung.',
    );
  }
  return { allowed: true };
}

export function assertClientPortalVisibility(
  window: ClientPortalVisibilityWindow,
  now: Date = new Date(),
): GeoGuardResult {
  const from = new Date(window.visibleFrom).getTime();
  const until = new Date(window.visibleUntil).getTime();
  const t = now.getTime();
  if (Number.isNaN(from) || Number.isNaN(until) || t < from || t > until) {
    return deny(
      'portal_visibility_denied',
      'Klientenportal: Standort sichtbar nur im freigegebenen Zeitfenster.',
    );
  }
  return { allowed: true };
}

export function assertGeoExecutionReady(): GeoGuardResult {
  if (!isGeoLiveReady()) {
    return deny('prepared_only', GEO_PREPARED_MESSAGE);
  }
  return { allowed: true };
}

export function runGeoGuardChain(checks: GeoGuardResult[]): GeoGuardResult {
  for (const check of checks) {
    if (!check.allowed) return check;
  }
  return { allowed: true };
}
