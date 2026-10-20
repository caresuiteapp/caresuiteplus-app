export {
  isGeoLiveReady,
  isGpsTrackingLiveReady,
  isGeoLiveWiringPrepared,
  isWithinLiveTrackingWindow,
  computeClientPortalVisibilityWindow,
  computeRetentionUntil,
  getGeoLiveFlipBlockers,
  GEO_PREPARED_MESSAGE,
  GPS_TRACKING_PREPARED_MESSAGE,
  GPS_TRIPS_PREPARED_MESSAGE,
  GEO_LIVE_WIRING_MIGRATION,
  LIVE_TRACKING_WINDOW_MINUTES_BEFORE,
  LIVE_TRACKING_WINDOW_MINUTES_AFTER,
  DEFAULT_LOCATION_RETENTION_DAYS,
  CLIENT_PORTAL_VISIBILITY_BUFFER_MINUTES,
} from './geoModuleConfig';

export {
  assertGeoRolePermission,
  assertLocationPurpose,
  assertGpsConsent,
  assertLiveTrackingWindow,
  assertLiveTrackingAllowed,
  assertNoPermanentTracking,
  assertProviderConfigured,
  assertExternalProviderAllowed,
  assertGeofenceNotProof,
  assertClientPortalVisibility,
  assertGeoExecutionReady,
  runGeoGuardChain,
  resolveGeoPermissionForPurpose,
} from './geoGuard';

export {
  GEO_PROVIDER_REGISTRY,
  getGeoProviderDefinition,
  listGeoProviderKeys,
  resolveDefaultProviderForPurpose,
} from './geoProviderRegistry';

export { validateAddress, resolveProviderForValidation } from './geocoderService';
export {
  showAssignmentRoute,
  calculateTravelTime,
  calculateKilometers,
  extractTravelMetrics,
} from './routeService';

export {
  plausibilizeAssignmentStatusWithGps,
  markUnterwegsWithLocation,
  markAngekommenWithLocation,
  markEinsatzGestartetWithLocation,
  startLiveTrackingSession,
  canClientPortalViewLocationEvent,
  evaluateLiveTrackingBlocked,
  peekAssignmentLocationEvents,
  clearAssignmentLocationEventBuffer,
} from './locationService';

export {
  prepareMileageLogEntry,
  stageMileageLogEntry,
  peekMileageLogEntries,
  clearMileageLogBuffer,
} from './mileageService';

export {
  recordLocationAuditEvent,
  auditBlockedGeoAction,
  peekLocationAuditEvents,
  clearLocationAuditBuffer,
  buildRetentionUntil,
} from './locationAuditService';
