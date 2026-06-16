import type { TenantScopedEntity } from '../core/base';

/** Unterstützte Karten-/Geocoding-Provider (Connect routes_gps). */
export type GeoProviderKey =
  | 'google_maps'
  | 'here_maps'
  | 'mapbox'
  | 'osm_nominatim'
  | 'tomtom'
  | 'generic_geocoder';

export type GeoProviderStatus = 'prepared' | 'configured' | 'active' | 'disabled';

export type LocationPurpose =
  | 'address_validation'
  | 'assignment_route'
  | 'travel_time'
  | 'distance_calculation'
  | 'status_plausibility'
  | 'unterwegs_status'
  | 'angekommen_status'
  | 'einsatz_gestartet_status'
  | 'live_tracking'
  | 'mileage_log'
  | 'geofence_check';

export type AssignmentLocationEventType =
  | 'position_snapshot'
  | 'unterwegs'
  | 'angekommen'
  | 'einsatz_gestartet'
  | 'status_plausibility'
  | 'live_tracking_start'
  | 'live_tracking_stop';

export type GeofenceEventType = 'enter' | 'exit' | 'dwell';

export type MileageLogSource = 'manual' | 'route_calculation' | 'gps_prepared';

export type MileageLogStatus = 'prepared' | 'confirmed' | 'exported' | 'archived';

export type GeoProviderConfig = TenantScopedEntity & {
  providerKey: GeoProviderKey;
  label: string;
  status: GeoProviderStatus;
  credentialReference: string | null;
  allowedPurposes: LocationPurpose[];
  externalDataAllowed: boolean;
  retentionDays: number;
  configuredAt: string | null;
};

export type GeocodedAddress = TenantScopedEntity & {
  inputHash: string;
  rawInput: string;
  formattedAddress: string | null;
  latitude: number | null;
  longitude: number | null;
  providerKey: GeoProviderKey;
  confidence: 'unknown' | 'low' | 'medium' | 'high';
  validated: boolean;
  purpose: LocationPurpose;
  retentionUntil: string | null;
};

export type RouteCalculation = TenantScopedEntity & {
  assignmentId: string | null;
  originAddress: string;
  destinationAddress: string;
  providerKey: GeoProviderKey;
  distanceKm: number | null;
  durationMinutes: number | null;
  polyline: string | null;
  purpose: LocationPurpose;
  calculatedAt: string;
  retentionUntil: string | null;
};

export type GeoPosition = {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  timestamp: string;
};

export type AssignmentLocationEvent = TenantScopedEntity & {
  assignmentId: string;
  employeeProfileId: string | null;
  eventType: AssignmentLocationEventType;
  latitude: number | null;
  longitude: number | null;
  accuracyMeters: number | null;
  purpose: LocationPurpose;
  consentVerified: boolean;
  liveTracking: boolean;
  recordedAt: string;
  retentionUntil: string | null;
  clientPortalVisibleFrom: string | null;
  clientPortalVisibleUntil: string | null;
};

export type GeofenceEvent = TenantScopedEntity & {
  assignmentId: string | null;
  geofenceLabel: string;
  eventType: GeofenceEventType;
  latitude: number | null;
  longitude: number | null;
  validated: boolean;
  proofEligible: boolean;
  purpose: LocationPurpose;
  recordedAt: string;
  retentionUntil: string | null;
};

export type MileageLogEntry = TenantScopedEntity & {
  tripId: string | null;
  assignmentId: string | null;
  employeeProfileId: string | null;
  startAddress: string | null;
  endAddress: string | null;
  distanceKm: number | null;
  purpose: LocationPurpose;
  source: MileageLogSource;
  status: MileageLogStatus;
  recordedAt: string;
  retentionUntil: string | null;
};

export type LocationAuditEvent = TenantScopedEntity & {
  actorProfileId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  purpose: LocationPurpose;
  providerKey: GeoProviderKey | null;
  blockedReason: string | null;
  metadata: Record<string, unknown>;
};

export type GeoGuardCode =
  | 'missing_tenant'
  | 'missing_role'
  | 'missing_permission'
  | 'missing_consent'
  | 'missing_purpose'
  | 'live_tracking_outside_window'
  | 'live_tracking_not_ready'
  | 'provider_not_configured'
  | 'external_provider_blocked'
  | 'geofence_not_validated'
  | 'portal_visibility_denied'
  | 'prepared_only'
  | 'permanent_tracking_denied';

export type GeoGuardResult =
  | { allowed: true }
  | { allowed: false; code: GeoGuardCode; message: string };

export type GeoConsentContext = {
  employeeConsentGranted: boolean;
  clientTrackingConsentGranted?: boolean;
  consentRecordedAt?: string | null;
  consentDocumentRef?: string | null;
};

export type GeoAssignmentContext = {
  assignmentId: string;
  assignmentStartAt: string;
  assignmentEndAt?: string | null;
};

export type GeoProviderContext = {
  providerKey: GeoProviderKey;
  configured: boolean;
  externalDataAllowed: boolean;
  credentialReference: string | null;
};

export type ClientPortalVisibilityWindow = {
  visibleFrom: string;
  visibleUntil: string;
};

export type PreparedMileageLogDraft = Omit<MileageLogEntry, 'id' | 'createdAt'> & {
  draftId: string;
};

export type ValidateAddressInput = {
  tenantId: string;
  rawAddress: string;
  purpose: LocationPurpose;
};

export type RouteRequestInput = {
  tenantId: string;
  assignmentId: string;
  originAddress: string;
  destinationAddress: string;
  purpose: LocationPurpose;
};

export type LocationCaptureInput = {
  tenantId: string;
  assignmentId: string;
  assignmentStartAt: string;
  purpose: LocationPurpose;
  eventType: AssignmentLocationEventType;
  position?: GeoPosition;
  consent: GeoConsentContext;
};
