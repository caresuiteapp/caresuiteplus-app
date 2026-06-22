import type { AssignmentStatus } from './assignmentStatus';
import type { GeofenceSoftCheckResult } from '@/lib/assist/geofenceSoftCheck';

export type EmployeePortalGpsPermissionStatus = 'granted' | 'denied' | 'undetermined' | 'unavailable';

export type EmployeePortalLocationConsent = {
  granted: boolean;
  grantedAt: string | null;
  explainedAt: string | null;
};

export type EmployeePortalGpsSnapshot = {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  capturedAt: string;
};

export type EmployeePortalLiveTimers = {
  driveSeconds: number | null;
  serviceSeconds: number | null;
  pauseSeconds: number | null;
  activeTimer: 'drive' | 'service' | 'pause' | null;
  driveStartedAt: string | null;
  serviceStartedAt: string | null;
  pauseStartedAt: string | null;
};

export type EmployeePortalTrackingSnapshot = {
  assignmentId: string;
  tenantId: string;
  status: AssignmentStatus;
  consent: EmployeePortalLocationConsent;
  gpsPermission: EmployeePortalGpsPermissionStatus;
  trackingActive: boolean;
  lastPosition: EmployeePortalGpsSnapshot | null;
  timers: EmployeePortalLiveTimers;
  geofence: GeofenceSoftCheckResult | null;
  warnings: string[];
  /** Assist/Office darf Position sehen — nur während aktiver Fahrt/Anfahrt */
  assistVisible: boolean;
  /** Klientenportal — eingeschränkt, nur im Freigabefenster (Gap wenn kein Backend) */
  clientPortalVisible: boolean;
};
