/**
 * Assist execution persistence DTOs — local interfaces for Migration 0156.
 *
 * Privacy / portal rules:
 * - GPS capture & tracking sessions: employee portal ONLY (source of truth).
 * - Assist / Office: read-only monitor — no tracking start from back-office UI.
 * - Client portal: limited visibility window; no raw GPS trail by default.
 */

export type AssistVisitSignatureStatus = 'valid' | 'invalidated';

export type AssistVisitProofStatus =
  | 'draft'
  | 'pending_review'
  | 'approved'
  | 'exported'
  | 'archived'
  | 'rejected';

export type AssistVisitProofPortalReleaseStatus =
  | 'none'
  | 'released'
  | 'pending_client_signature'
  | 'revoked';

export type AssistTrackingSessionEndReason =
  | 'completed'
  | 'cancelled'
  | 'timeout'
  | 'manual_stop'
  | 'status_change';

export type AssistTrackingSessionSource = 'employee_portal' | 'device' | 'manual';

export type AssistTimeEventType =
  | 'drive_start'
  | 'drive_end'
  | 'service_start'
  | 'service_end'
  | 'pause_start'
  | 'pause_end'
  | 'arrive'
  | 'depart'
  | 'arrived_without_gps'
  | 'arrived_manual';

export type AssistGeofenceCheckType = 'arrival' | 'departure' | 'periodic';

export type AssistDrivingLogStatus = 'open' | 'completed' | 'corrected' | 'cancelled';

export type AssistProofAttachmentType = 'photo' | 'document' | 'signature_copy';

/** Row shape for assist_visit_signatures (0156). */
export type AssistVisitSignatureRow = {
  id: string;
  tenantId: string;
  visitId: string;
  signerName: string;
  signerRole: string;
  /** Supabase Storage path — never store base64 in DB. */
  storagePath: string;
  payloadHash: string;
  signatureHash: string;
  signedAt: string;
  signedByProfileId: string | null;
  isValid: boolean;
  invalidatedAt: string | null;
  invalidationReason: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

/** Input for persisting a captured signature after Storage upload. */
export type AssistVisitSignatureInsert = {
  visitId: string;
  signerName: string;
  signerRole: string;
  storagePath: string;
  payloadHash: string;
  signatureHash: string;
  signedAt: string;
  signedByProfileId?: string | null;
  metadata?: Record<string, unknown>;
};

/** Row shape for assist_visit_proofs (0156). */
export type AssistVisitProofRow = {
  id: string;
  tenantId: string;
  visitId: string;
  signatureId: string | null;
  proofNumber: string | null;
  status: AssistVisitProofStatus;
  storagePath: string | null;
  payloadSnapshot: Record<string, unknown>;
  payloadHash: string | null;
  generatedAt: string | null;
  generatedBy: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  billingReleased: boolean;
  portalVisible: boolean;
  releasedToPortalAt: string | null;
  portalReleaseStatus: AssistVisitProofPortalReleaseStatus;
  approvalNote: string | null;
  rejectionReason: string | null;
  pdfStoragePath: string | null;
  pdfHash: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Client-safe proof view — no GPS or internal tracking fields. */
export type ClientPortalAssistVisitProof = {
  id: string;
  visitId: string;
  proofNumber: string | null;
  title: string;
  serviceName: string | null;
  clientName: string | null;
  employeeName: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  documentationNote: string | null;
  signedAt: string | null;
  signerName: string | null;
  releasedAt: string | null;
  pdfStoragePath: string | null;
  portalReleaseStatus?: AssistVisitProofPortalReleaseStatus;
  signatureRequired?: boolean;
};

export type AssistVisitProofInsert = {
  visitId: string;
  signatureId?: string | null;
  status?: AssistVisitProofStatus;
  payloadSnapshot: Record<string, unknown>;
  payloadHash?: string | null;
  storagePath?: string | null;
};

/** Row shape for assist_tracking_sessions (0156). */
export type AssistTrackingSessionRow = {
  id: string;
  tenantId: string;
  visitId: string;
  employeeId: string | null;
  consentGrantedAt: string;
  consentExplainedAt: string | null;
  startedAt: string;
  endedAt: string | null;
  endReason: AssistTrackingSessionEndReason | null;
  source: AssistTrackingSessionSource;
  isActive: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type AssistTrackingSessionInsert = {
  visitId: string;
  employeeId?: string | null;
  consentGrantedAt: string;
  consentExplainedAt?: string | null;
  source?: AssistTrackingSessionSource;
};

/** Row shape for assist_location_points (0156) — append-only. */
export type AssistLocationPointRow = {
  id: string;
  tenantId: string;
  sessionId: string;
  visitId: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  recordedAt: string;
  source: 'device' | 'geofence' | 'manual';
  createdAt: string;
};

export type AssistLocationPointInsert = {
  sessionId: string;
  visitId: string;
  latitude: number;
  longitude: number;
  accuracyMeters?: number | null;
  recordedAt?: string;
  source?: 'device' | 'geofence' | 'manual';
};

/** Row shape for assist_time_events (0156). */
export type AssistTimeEventRow = {
  id: string;
  tenantId: string;
  visitId: string;
  sessionId: string | null;
  eventType: AssistTimeEventType;
  occurredAt: string;
  recordedBy: string | null;
  durationSeconds: number | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type AssistTimeEventInsert = {
  visitId: string;
  sessionId?: string | null;
  eventType: AssistTimeEventType;
  occurredAt?: string;
  durationSeconds?: number | null;
  metadata?: Record<string, unknown>;
};

/** Row shape for assist_geofence_events (0156) — soft check audit. */
export type AssistGeofenceEventRow = {
  id: string;
  tenantId: string;
  visitId: string;
  sessionId: string | null;
  checkType: AssistGeofenceCheckType;
  latitude: number | null;
  longitude: number | null;
  targetLatitude: number | null;
  targetLongitude: number | null;
  distanceMeters: number | null;
  toleranceMeters: number;
  insideTolerance: boolean;
  overridden: boolean;
  overrideReason: string | null;
  warningText: string | null;
  checkedAt: string;
  createdAt: string;
};

export type AssistGeofenceEventInsert = {
  visitId: string;
  sessionId?: string | null;
  checkType?: AssistGeofenceCheckType;
  latitude?: number | null;
  longitude?: number | null;
  targetLatitude?: number | null;
  targetLongitude?: number | null;
  distanceMeters?: number | null;
  toleranceMeters?: number;
  insideTolerance: boolean;
  overridden?: boolean;
  overrideReason?: string | null;
  warningText?: string | null;
  checkedAt?: string;
};

/** Row shape for assist_driving_log (0156). */
export type AssistDrivingLogRow = {
  id: string;
  tenantId: string;
  visitId: string | null;
  tripId: string | null;
  sessionId: string | null;
  employeeId: string | null;
  purpose: string | null;
  startedAt: string | null;
  endedAt: string | null;
  distanceKm: number | null;
  startAddress: string | null;
  endAddress: string | null;
  correctionReason: string | null;
  status: AssistDrivingLogStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AssistDrivingLogInsert = {
  visitId?: string | null;
  tripId?: string | null;
  sessionId?: string | null;
  employeeId?: string | null;
  purpose?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  distanceKm?: number | null;
  startAddress?: string | null;
  endAddress?: string | null;
  status?: AssistDrivingLogStatus;
  notes?: string | null;
};

/** Table name constants for 0156 repositories. */
export const ASSIST_EXECUTION_TABLES = {
  signatures: 'assist_visit_signatures',
  proofs: 'assist_visit_proofs',
  proofAttachments: 'assist_proof_attachments',
  trackingSessions: 'assist_tracking_sessions',
  locationPoints: 'assist_location_points',
  timeEvents: 'assist_time_events',
  geofenceEvents: 'assist_geofence_events',
  drivingLog: 'assist_driving_log',
} as const;
