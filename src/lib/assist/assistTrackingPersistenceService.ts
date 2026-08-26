/**
 * Assist tracking persistence — Migration 0156.
 * GPS sessions, location points, time events, geofence audit, driving log.
 *
 * Privacy rules (mandatory):
 * - Tracking session START: employee portal ONLY (consent required).
 * - Location points: session-scoped; no cross-visit trail without active session.
 * - Assist Live-Status / Office: read aggregated snapshots — never write GPS here.
 * - Client portal: limited window; no full location history by default.
 */

import type { ServiceResult } from '@/types';
import type {
  AssistDrivingLogInsert,
  AssistDrivingLogRow,
  AssistGeofenceEventInsert,
  AssistLocationPointInsert,
  AssistLocationPointRow,
  AssistTimeEventInsert,
  AssistTimeEventRow,
  AssistTrackingSessionEndReason,
  AssistTrackingSessionInsert,
  AssistTrackingSessionRow,
} from '@/types/assistExecutionPersistence';
import { getSupabaseClient } from '@/lib/supabase/client';
import { inferTravelRouteType } from '@/lib/travel/travelCompensationPolicy';
import { isSupabaseMissingTableError, toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { ASSIST_EXECUTION_TABLES } from '@/types/assistExecutionPersistence';

type SessionDbRow = {
  id: string;
  tenant_id: string;
  visit_id: string;
  employee_id: string | null;
  consent_granted_at: string;
  consent_explained_at: string | null;
  started_at: string;
  ended_at: string | null;
  end_reason: AssistTrackingSessionRow['endReason'];
  source: AssistTrackingSessionRow['source'];
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type LocationDbRow = {
  id: string;
  tenant_id: string;
  session_id: string;
  visit_id: string;
  latitude: number;
  longitude: number;
  accuracy_meters: number | null;
  recorded_at: string;
  source: AssistLocationPointRow['source'];
  created_at: string;
};

type TimeEventDbRow = {
  id: string;
  tenant_id: string;
  visit_id: string;
  session_id: string | null;
  event_type: AssistTimeEventRow['eventType'];
  occurred_at: string;
  recorded_by: string | null;
  duration_seconds: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
};


type DrivingLogDbRow = {
  id: string;
  tenant_id: string;
  visit_id: string | null;
  trip_id: string | null;
  session_id: string | null;
  employee_id: string | null;
  purpose: string | null;
  started_at: string | null;
  ended_at: string | null;
  distance_km: number | null;
  travel_type: AssistDrivingLogRow['travelType'] | null;
  logbook_eligible: boolean;
  payroll_eligible: boolean;
  work_time_eligible: boolean;
  client_billing_eligible: boolean;
  mileage_rate_cents: number | null;
  mileage_amount_cents: number | null;
  start_address: string | null;
  end_address: string | null;
  correction_reason: string | null;
  status: AssistDrivingLogRow['status'];
  notes: string | null;
  created_at: string;
  updated_at: string;
};

function mapSessionRow(row: SessionDbRow): AssistTrackingSessionRow {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    visitId: row.visit_id,
    employeeId: row.employee_id,
    consentGrantedAt: row.consent_granted_at,
    consentExplainedAt: row.consent_explained_at,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    endReason: row.end_reason,
    source: row.source,
    isActive: row.is_active,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapLocationRow(row: LocationDbRow): AssistLocationPointRow {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    sessionId: row.session_id,
    visitId: row.visit_id,
    latitude: row.latitude,
    longitude: row.longitude,
    accuracyMeters: row.accuracy_meters,
    recordedAt: row.recorded_at,
    source: row.source,
    createdAt: row.created_at,
  };
}

function mapTimeEventRow(row: TimeEventDbRow): AssistTimeEventRow {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    visitId: row.visit_id,
    sessionId: row.session_id,
    eventType: row.event_type,
    occurredAt: row.occurred_at,
    recordedBy: row.recorded_by,
    durationSeconds: row.duration_seconds,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  };
}


function mapDrivingLogRow(row: DrivingLogDbRow): AssistDrivingLogRow {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    visitId: row.visit_id,
    tripId: row.trip_id,
    sessionId: row.session_id,
    employeeId: row.employee_id,
    purpose: row.purpose,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    distanceKm: row.distance_km,
    travelType: row.travel_type ?? inferTravelRouteType(row.purpose),
    logbookEligible: row.logbook_eligible,
    payrollEligible: row.payroll_eligible,
    workTimeEligible: row.work_time_eligible,
    clientBillingEligible: row.client_billing_eligible,
    mileageRateCents: row.mileage_rate_cents,
    mileageAmountCents: row.mileage_amount_cents ?? 0,
    startAddress: row.start_address,
    endAddress: row.end_address,
    correctionReason: row.correction_reason,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function unavailable<T>(): ServiceResult<T> {
  return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
}

/** Latest tracking session for visit (any active state) with consent timestamp. */
export async function fetchLatestTrackingSessionWithConsent(
  tenantId: string,
  visitId: string,
): Promise<ServiceResult<AssistTrackingSessionRow | null>> {
  const supabase = getSupabaseClient();
  if (!supabase) return unavailable();

  const { data, error } = await fromUnknownTable(
    supabase,
    ASSIST_EXECUTION_TABLES.trackingSessions,
  )
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('visit_id', visitId)
    .not('consent_granted_at', 'is', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isSupabaseMissingTableError(error)) {
      return { ok: true, data: null, tableMissing: true };
    }
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  if (!data) return { ok: true, data: null };
  return { ok: true, data: mapSessionRow(data as SessionDbRow) };
}

/** Read active tracking session for visit — Assist monitor read path. */
export async function fetchActiveTrackingSession(
  tenantId: string,
  visitId: string,
): Promise<ServiceResult<AssistTrackingSessionRow | null>> {
  const supabase = getSupabaseClient();
  if (!supabase) return unavailable();

  const { data, error } = await fromUnknownTable(
    supabase,
    ASSIST_EXECUTION_TABLES.trackingSessions,
  )
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('visit_id', visitId)
    .eq('is_active', true)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isSupabaseMissingTableError(error)) {
      return { ok: true, data: null, tableMissing: true };
    }
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  if (!data) return { ok: true, data: null };
  return { ok: true, data: mapSessionRow(data as SessionDbRow) };
}

/** Merge producer-owned metadata without discarding consent/audit fields. */
export async function mergeTrackingSessionMetadata(
  tenantId: string,
  sessionId: string,
  patch: Record<string, unknown>,
): Promise<ServiceResult<void>> {
  const supabase = getSupabaseClient();
  if (!supabase) return unavailable();
  const current = await fromUnknownTable(supabase, ASSIST_EXECUTION_TABLES.trackingSessions)
    .select('metadata')
    .eq('tenant_id', tenantId)
    .eq('id', sessionId)
    .maybeSingle();
  if (current.error) return { ok: false, error: toGermanSupabaseError(current.error) };
  const metadata = (current.data as { metadata?: Record<string, unknown> } | null)?.metadata ?? {};
  const { error } = await fromUnknownTable(supabase, ASSIST_EXECUTION_TABLES.trackingSessions)
    .update({ metadata: { ...metadata, ...patch }, updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('id', sessionId);
  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  return { ok: true, data: undefined };
}

/** Latest location point for visit — read-only (Assist live status). No full trail. */
export async function fetchLatestLocationPointForVisit(
  tenantId: string,
  visitId: string,
): Promise<ServiceResult<AssistLocationPointRow | null>> {
  const supabase = getSupabaseClient();
  if (!supabase) return unavailable();

  const { data, error } = await fromUnknownTable(supabase, ASSIST_EXECUTION_TABLES.locationPoints)
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('visit_id', visitId)
    .order('recorded_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isSupabaseMissingTableError(error)) {
      return { ok: true, data: null, tableMissing: true };
    }
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  if (!data) return { ok: true, data: null };
  return { ok: true, data: mapLocationRow(data as LocationDbRow) };
}

/**
 * Chronological GPS trail for one visit/session. Assist and Office use this
 * read-only history to draw the travelled route and calculate distance.
 */
export async function fetchLocationPointsForVisit(
  tenantId: string,
  visitId: string,
  sessionId?: string | null,
  limit = 1_500,
): Promise<ServiceResult<AssistLocationPointRow[]>> {
  const supabase = getSupabaseClient();
  if (!supabase) return unavailable();

  let query = fromUnknownTable(supabase, ASSIST_EXECUTION_TABLES.locationPoints)
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('visit_id', visitId);

  if (sessionId) query = query.eq('session_id', sessionId);

  const { data, error } = await query
    .order('recorded_at', { ascending: false })
    .limit(limit);

  if (error) {
    if (isSupabaseMissingTableError(error)) {
      return { ok: true, data: [], tableMissing: true };
    }
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  const rows = ((data ?? []) as LocationDbRow[])
    .map(mapLocationRow)
    .sort(
      (left, right) =>
        new Date(left.recordedAt).getTime() - new Date(right.recordedAt).getTime(),
    );

  return { ok: true, data: rows };
}

/**
 * Latest time events for a visit.
 *
 * Recurring assignments can reuse a visit id across many cycles. Limiting an
 * ascending query returned the oldest rows and caused a freshly saved
 * administrative correction to disappear again during the following refresh.
 * Fetch newest first, apply the limit there, then restore chronological order
 * for callers that render or process the returned sequence.
 */
export async function fetchTimeEventsForVisit(
  tenantId: string,
  visitId: string,
  limit = 50,
): Promise<ServiceResult<AssistTimeEventRow[]>> {
  const supabase = getSupabaseClient();
  if (!supabase) return unavailable();

  const { data, error } = await fromUnknownTable(supabase, ASSIST_EXECUTION_TABLES.timeEvents)
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('visit_id', visitId)
    .order('occurred_at', { ascending: false })
    .limit(limit);

  if (error) {
    if (isSupabaseMissingTableError(error)) {
      return { ok: true, data: [], tableMissing: true };
    }
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  const rows = ((data ?? []) as TimeEventDbRow[])
    .map(mapTimeEventRow)
    .sort(
      (left, right) =>
        new Date(left.occurredAt).getTime() - new Date(right.occurredAt).getTime(),
    );

  return { ok: true, data: rows };
}

/** Start session after employee portal consent. */
export async function startTrackingSession(
  tenantId: string,
  input: AssistTrackingSessionInsert,
): Promise<ServiceResult<AssistTrackingSessionRow>> {
  const supabase = getSupabaseClient();
  if (!supabase) return unavailable();

  const now = new Date().toISOString();
  const { data, error } = await fromUnknownTable(supabase, ASSIST_EXECUTION_TABLES.trackingSessions)
    .insert({
      tenant_id: tenantId,
      visit_id: input.visitId,
      employee_id: input.employeeId ?? null,
      consent_granted_at: input.consentGrantedAt,
      consent_explained_at: input.consentExplainedAt ?? null,
      started_at: now,
      source: input.source ?? 'employee_portal',
      is_active: true,
      metadata: {},
    })
    .select('*')
    .single();

  if (error) {
    if (isSupabaseMissingTableError(error)) {
      return { ok: false, error: 'assist_tracking_sessions (0156) nicht verfügbar.' };
    }
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  return { ok: true, data: mapSessionRow(data as SessionDbRow) };
}

/** End active session for visit. */
export async function endTrackingSession(
  tenantId: string,
  visitId: string,
  endReason: AssistTrackingSessionEndReason = 'status_change',
): Promise<ServiceResult<void>> {
  const supabase = getSupabaseClient();
  if (!supabase) return unavailable();

  const now = new Date().toISOString();
  const { error } = await fromUnknownTable(supabase, ASSIST_EXECUTION_TABLES.trackingSessions)
    .update({
      is_active: false,
      ended_at: now,
      end_reason: endReason,
    })
    .eq('tenant_id', tenantId)
    .eq('visit_id', visitId)
    .eq('is_active', true);

  if (error) {
    if (isSupabaseMissingTableError(error)) {
      return { ok: false, error: 'assist_tracking_sessions (0156) nicht verfügbar.' };
    }
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  return { ok: true, data: undefined };
}

/** Append location point during active session (employee portal foreground GPS). */
export async function appendLocationPoint(
  tenantId: string,
  input: AssistLocationPointInsert,
): Promise<ServiceResult<{ id: string }>> {
  const supabase = getSupabaseClient();
  if (!supabase) return unavailable();

  const { data, error } = await fromUnknownTable(supabase, ASSIST_EXECUTION_TABLES.locationPoints)
    .insert({
      tenant_id: tenantId,
      session_id: input.sessionId,
      visit_id: input.visitId,
      latitude: input.latitude,
      longitude: input.longitude,
      accuracy_meters: input.accuracyMeters ?? null,
      recorded_at: input.recordedAt ?? new Date().toISOString(),
      source: input.source ?? 'device',
    })
    .select('id')
    .single();

  if (error) {
    if (isSupabaseMissingTableError(error)) {
      return { ok: false, error: 'assist_location_points (0156) nicht verfügbar.' };
    }
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  return { ok: true, data: { id: String((data as { id: string }).id) } };
}

/** Record time event (drive/service/pause) from status transitions. */
export async function recordTimeEvent(
  tenantId: string,
  input: AssistTimeEventInsert,
  recordedBy?: string | null,
): Promise<ServiceResult<{ id: string }>> {
  const supabase = getSupabaseClient();
  if (!supabase) return unavailable();

  const { data, error } = await fromUnknownTable(supabase, ASSIST_EXECUTION_TABLES.timeEvents)
    .insert({
      tenant_id: tenantId,
      visit_id: input.visitId,
      session_id: input.sessionId ?? null,
      event_type: input.eventType,
      occurred_at: input.occurredAt ?? new Date().toISOString(),
      recorded_by: recordedBy ?? null,
      duration_seconds: input.durationSeconds ?? null,
      metadata: input.metadata ?? {},
    })
    .select('id')
    .single();

  if (error) {
    if (isSupabaseMissingTableError(error)) {
      return { ok: false, error: 'assist_time_events (0156) nicht verfügbar.' };
    }
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  return { ok: true, data: { id: String((data as { id: string }).id) } };
}

/** Persist soft geofence check result at arrival (from geofenceSoftCheck). */
export async function recordGeofenceEvent(
  tenantId: string,
  input: AssistGeofenceEventInsert,
): Promise<ServiceResult<{ id: string }>> {
  const supabase = getSupabaseClient();
  if (!supabase) return unavailable();

  const { data, error } = await fromUnknownTable(supabase, ASSIST_EXECUTION_TABLES.geofenceEvents)
    .insert({
      tenant_id: tenantId,
      visit_id: input.visitId,
      session_id: input.sessionId ?? null,
      check_type: input.checkType ?? 'arrival',
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      target_latitude: input.targetLatitude ?? null,
      target_longitude: input.targetLongitude ?? null,
      distance_meters: input.distanceMeters ?? null,
      tolerance_meters: input.toleranceMeters ?? 150,
      inside_tolerance: input.insideTolerance,
      overridden: input.overridden ?? false,
      override_reason: input.overrideReason ?? null,
      warning_text: input.warningText ?? null,
      checked_at: input.checkedAt ?? new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    if (isSupabaseMissingTableError(error)) {
      return { ok: false, error: 'assist_geofence_events (0156) nicht verfügbar.' };
    }
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  return { ok: true, data: { id: String((data as { id: string }).id) } };
}

/** Link visit/trip/session to assist_driving_log entry. */
export async function appendDrivingLogEntry(
  tenantId: string,
  input: AssistDrivingLogInsert,
): Promise<ServiceResult<AssistDrivingLogRow>> {
  const supabase = getSupabaseClient();
  if (!supabase) return unavailable();

  const { data, error } = await fromUnknownTable(supabase, ASSIST_EXECUTION_TABLES.drivingLog)
    .insert({
      tenant_id: tenantId,
      visit_id: input.visitId ?? null,
      trip_id: input.tripId ?? null,
      session_id: input.sessionId ?? null,
      employee_id: input.employeeId ?? null,
      purpose: input.purpose ?? null,
      started_at: input.startedAt ?? null,
      ended_at: input.endedAt ?? null,
      distance_km: input.distanceKm ?? null,
      travel_type: input.travelType ?? null,
      start_address: input.startAddress ?? null,
      end_address: input.endAddress ?? null,
      status: input.status ?? 'open',
      notes: input.notes ?? null,
    })
    .select('*')
    .single();

  if (error) {
    if (isSupabaseMissingTableError(error)) {
      return { ok: false, error: 'assist_driving_log (0156) nicht verfügbar.' };
    }
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  return { ok: true, data: mapDrivingLogRow(data as DrivingLogDbRow) };
}

/** Complete open driving log row for visit when drive ends. */
export async function completeDrivingLogForVisit(
  tenantId: string,
  visitId: string,
  endedAt: string,
  endAddress?: string | null,
): Promise<ServiceResult<void>> {
  const supabase = getSupabaseClient();
  if (!supabase) return unavailable();

  const { error } = await fromUnknownTable(supabase, ASSIST_EXECUTION_TABLES.drivingLog)
    .update({
      ended_at: endedAt,
      end_address: endAddress ?? null,
      status: 'completed',
    })
    .eq('tenant_id', tenantId)
    .eq('visit_id', visitId)
    .eq('status', 'open');

  if (error) {
    if (isSupabaseMissingTableError(error)) {
      return { ok: false, error: 'assist_driving_log (0156) nicht verfügbar.' };
    }
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  return { ok: true, data: undefined };
}
