/**
 * Employee portal → 0156 persistence wiring.
 * Writes only from Mitarbeiterportal; Assist/Office remain read-only consumers.
 */

import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import type { EmployeePortalSignatureCaptureInput } from '@/types/modules/employeePortalExecution';
import type { EmployeePortalGpsSnapshot } from '@/types/modules/employeePortalTracking';
import { resolveAssistVisitIdForPersistence } from '@/lib/assist/assistExecutionVisitResolver';
import type { GeofenceSoftCheckResult } from '@/lib/assist/geofenceSoftCheck';
import {
  appendDrivingLogEntry,
  appendLocationPoint,
  completeDrivingLogForVisit,
  endTrackingSession,
  recordGeofenceEvent,
  recordTimeEvent,
  startTrackingSession,
} from '@/lib/assist/assistTrackingPersistenceService';
import {
  computeSignatureDataHash,
  computeVisitSignaturePayloadHash,
  saveVisitSignaturePersistent,
  type VisitSignaturePayloadInput,
} from '@/lib/assist/assistVisitSignaturePersistenceService';
import {
  computeVisitProofPayloadHash,
  persistVisitProof,
} from '@/lib/assist/assistVisitProofPersistenceService';
import { getServiceMode } from '@/lib/services/mode';
import { peekEmployeePortalTrackingEntry } from './employeePortalVisitTrackingService';

export type EmployeePortalPersistenceContext = {
  tenantId: string;
  assignmentId: string;
  employeeId?: string | null;
  profileId?: string | null;
  locationAddress?: string | null;
};

const sessionByKey = new Map<string, string>();

function ctxKey(tenantId: string, assignmentId: string): string {
  return `${tenantId}:${assignmentId}`;
}

export function resetEmployeePortalPersistenceSessionStore(): void {
  sessionByKey.clear();
}

function statusToTimeEventType(
  fromStatus: AssignmentStatus,
  toStatus: AssignmentStatus,
): Array<'drive_start' | 'drive_end' | 'arrive' | 'service_start' | 'service_end' | 'pause_start' | 'pause_end' | 'depart'> {
  const events: Array<
    'drive_start' | 'drive_end' | 'arrive' | 'service_start' | 'service_end' | 'pause_start' | 'pause_end' | 'depart'
  > = [];

  if (toStatus === 'unterwegs') events.push('drive_start');
  if (toStatus === 'angekommen') {
    events.push('arrive');
    events.push('drive_end');
  }
  if (toStatus === 'gestartet' && fromStatus === 'pausiert') events.push('pause_end');
  if (toStatus === 'gestartet') events.push('service_start');
  if (toStatus === 'pausiert') events.push('pause_start');
  if (toStatus === 'beendet') {
    events.push('service_end');
    events.push('depart');
  }

  return events;
}

async function resolveVisit(ctx: EmployeePortalPersistenceContext): Promise<string | null> {
  if (getServiceMode() !== 'supabase') return null;
  return resolveAssistVisitIdForPersistence(ctx.tenantId, ctx.assignmentId);
}

/** Persist consent + optional session start (employee portal only). */
export async function persistEmployeePortalLocationConsent(
  ctx: EmployeePortalPersistenceContext,
): Promise<{ ok: boolean; sessionId?: string; error?: string }> {
  const visitId = await resolveVisit(ctx);
  if (!visitId) return { ok: true };

  const entry = peekEmployeePortalTrackingEntry(ctx.tenantId, ctx.assignmentId);
  const started = await startTrackingSession(ctx.tenantId, {
    visitId,
    employeeId: ctx.employeeId ?? null,
    consentGrantedAt: entry.consent.grantedAt ?? new Date().toISOString(),
    consentExplainedAt: entry.consent.explainedAt,
    source: 'employee_portal',
  });

  if (!started.ok) return { ok: false, error: started.error };
  sessionByKey.set(ctxKey(ctx.tenantId, ctx.assignmentId), started.data.id);
  return { ok: true, sessionId: started.data.id };
}

/** Persist foreground GPS point for active session. */
export async function persistEmployeePortalLocationPoint(
  ctx: EmployeePortalPersistenceContext,
  snapshot: EmployeePortalGpsSnapshot,
): Promise<{ ok: boolean; error?: string }> {
  const visitId = await resolveVisit(ctx);
  if (!visitId) return { ok: true };

  const key = ctxKey(ctx.tenantId, ctx.assignmentId);
  let sessionId = sessionByKey.get(key);
  if (!sessionId) {
    const consent = await persistEmployeePortalLocationConsent(ctx);
    if (!consent.ok) return consent;
    sessionId = consent.sessionId;
  }
  if (!sessionId) return { ok: true };

  const result = await appendLocationPoint(ctx.tenantId, {
    sessionId,
    visitId,
    latitude: snapshot.latitude,
    longitude: snapshot.longitude,
    accuracyMeters: snapshot.accuracyMeters,
    recordedAt: snapshot.capturedAt,
    source: 'device',
  });

  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

/** Persist status transition side effects: time events, geofence, driving log, session end. */
export async function persistEmployeePortalStatusTransition(
  ctx: EmployeePortalPersistenceContext,
  fromStatus: AssignmentStatus,
  toStatus: AssignmentStatus,
  geofence?: GeofenceSoftCheckResult | null,
): Promise<{ ok: boolean; warnings: string[] }> {
  const warnings: string[] = [];
  const visitId = await resolveVisit(ctx);
  if (!visitId) return { ok: true, warnings };

  const key = ctxKey(ctx.tenantId, ctx.assignmentId);
  const sessionId = sessionByKey.get(key) ?? null;
  const now = new Date().toISOString();
  const entry = peekEmployeePortalTrackingEntry(ctx.tenantId, ctx.assignmentId);

  for (const eventType of statusToTimeEventType(fromStatus, toStatus)) {
    const recorded = await recordTimeEvent(
      ctx.tenantId,
      { visitId, sessionId, eventType, occurredAt: now },
      ctx.profileId ?? ctx.employeeId ?? null,
    );
    if (!recorded.ok) warnings.push(recorded.error);
    else if (ctx.employeeId || ctx.profileId) {
      const { syncAssistTimeEventToWfm } = await import('@/lib/wfm/wfmAssistAdapter');
      const syncResult = await syncAssistTimeEventToWfm(
        ctx.tenantId,
        ctx.employeeId ?? null,
        ctx.profileId ?? null,
        visitId,
        eventType,
        now,
      );
      if (!syncResult.ok) warnings.push(syncResult.error ?? 'WFM-Sync fehlgeschlagen.');
    }
  }

  if (toStatus === 'unterwegs') {
    if (!sessionId) {
      const started = await persistEmployeePortalLocationConsent(ctx);
      if (!started.ok) warnings.push(started.error ?? 'Tracking-Session konnte nicht gestartet werden.');
    }
    const drive = await appendDrivingLogEntry(ctx.tenantId, {
      visitId,
      sessionId: sessionByKey.get(key) ?? null,
      employeeId: ctx.employeeId ?? null,
      purpose: 'Anfahrt zum Einsatz',
      startedAt: now,
      startAddress: ctx.locationAddress ?? null,
      status: 'open',
    });
    if (!drive.ok) warnings.push(drive.error);
  }

  if (toStatus === 'angekommen' && geofence?.checked) {
    const pos = entry.lastPosition;
    const target = entry.targetCoordinates;
    const geo = await recordGeofenceEvent(ctx.tenantId, {
      visitId,
      sessionId,
      checkType: 'arrival',
      latitude: pos?.latitude ?? null,
      longitude: pos?.longitude ?? null,
      targetLatitude: target?.latitude ?? null,
      targetLongitude: target?.longitude ?? null,
      distanceMeters: geofence.distanceMeters,
      toleranceMeters: geofence.toleranceMeters,
      insideTolerance: geofence.insideTolerance,
      overridden: geofence.overridden,
      overrideReason: entry.geofenceOverrideReason,
      warningText: geofence.warning,
      checkedAt: now,
    });
    if (!geo.ok) warnings.push(geo.error);

    const driveEnd = await completeDrivingLogForVisit(
      ctx.tenantId,
      visitId,
      now,
      ctx.locationAddress ?? null,
    );
    if (!driveEnd.ok) warnings.push(driveEnd.error);
  }

  if (toStatus === 'beendet' || toStatus === 'abgeschlossen' || toStatus === 'storniert') {
    const ended = await endTrackingSession(ctx.tenantId, visitId, 'status_change');
    if (!ended.ok) warnings.push(ended.error);
    sessionByKey.delete(key);
  }

  return { ok: warnings.length === 0, warnings };
}

/** Persist captured signature to Storage + assist_visit_signatures. */
export async function persistEmployeePortalSignature(
  ctx: EmployeePortalPersistenceContext,
  input: EmployeePortalSignatureCaptureInput,
  payload: VisitSignaturePayloadInput,
): Promise<{ ok: boolean; error?: string }> {
  const visitId = await resolveVisit(ctx);
  if (!visitId) return { ok: true };

  if (!input.signatureDataUrl?.trim()) return { ok: true };

  const payloadHash = await computeVisitSignaturePayloadHash(payload);
  const signatureHash = await computeSignatureDataHash(input.signatureDataUrl);
  const saved = await saveVisitSignaturePersistent(ctx.tenantId, {
    visitId,
    signerName: input.signerName,
    signerRole: input.signatureType,
    storagePath: '',
    payloadHash,
    signatureHash,
    signedAt: new Date().toISOString(),
    signedByProfileId: ctx.profileId ?? null,
    signatureDataUrl: input.signatureDataUrl,
  });

  return saved.ok ? { ok: true } : { ok: false, error: saved.error };
}

/** Persist Leistungsnachweis snapshot from visit proof preview fields. */
export async function persistEmployeePortalVisitProof(
  ctx: EmployeePortalPersistenceContext,
  snapshot: Record<string, unknown>,
  signatureId?: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const visitId = await resolveVisit(ctx);
  if (!visitId) return { ok: true };

  const payloadHash = await computeVisitProofPayloadHash(snapshot);
  const saved = await persistVisitProof(
    ctx.tenantId,
    {
      visitId,
      signatureId: signatureId ?? null,
      status: 'draft',
      payloadSnapshot: snapshot,
      payloadHash,
    },
    ctx.profileId ?? ctx.employeeId ?? null,
  );

  return saved.ok ? { ok: true } : { ok: false, error: saved.error };
}

export function getPersistedSessionId(tenantId: string, assignmentId: string): string | null {
  return sessionByKey.get(ctxKey(tenantId, assignmentId)) ?? null;
}
