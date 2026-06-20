/**
 * Assist tracking persistence — Migration 0156 stub.
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
  AssistGeofenceEventInsert,
  AssistLocationPointInsert,
  AssistTimeEventInsert,
  AssistTrackingSessionInsert,
  AssistTrackingSessionRow,
} from '@/types/assistExecutionPersistence';
import { getSupabaseClient } from '@/lib/supabase/client';
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

/** Read active tracking session for visit — Assist monitor read path. */
export async function fetchActiveTrackingSession(
  tenantId: string,
  visitId: string,
): Promise<ServiceResult<AssistTrackingSessionRow | null>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

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

/**
 * GAP: start session after employee portal consent — wire from employeePortalVisitTrackingService.
 */
export async function startTrackingSessionStub(
  _tenantId: string,
  _input: AssistTrackingSessionInsert,
): Promise<ServiceResult<AssistTrackingSessionRow>> {
  return {
    ok: false,
    error:
      'assist_tracking_sessions (0156) noch nicht angewendet — GPS-Persistenz folgt nach Migration-Apply.',
  };
}

/** GAP: append location point during active session (employee portal foreground GPS). */
export async function appendLocationPointStub(
  _tenantId: string,
  _input: AssistLocationPointInsert,
): Promise<ServiceResult<{ id: string }>> {
  return {
    ok: false,
    error: 'assist_location_points (0156) noch nicht angewendet.',
  };
}

/** GAP: record time event (drive/service/pause) from status transitions. */
export async function recordTimeEventStub(
  _tenantId: string,
  _input: AssistTimeEventInsert,
): Promise<ServiceResult<{ id: string }>> {
  return {
    ok: false,
    error: 'assist_time_events (0156) noch nicht angewendet.',
  };
}

/** GAP: persist soft geofence check result at arrival (from geofenceSoftCheck). */
export async function recordGeofenceEventStub(
  _tenantId: string,
  _input: AssistGeofenceEventInsert,
): Promise<ServiceResult<{ id: string }>> {
  return {
    ok: false,
    error: 'assist_geofence_events (0156) noch nicht angewendet.',
  };
}

/** GAP: link visit/trip/session to assist_driving_log entry. */
export async function appendDrivingLogEntryStub(): Promise<ServiceResult<{ id: string }>> {
  return {
    ok: false,
    error: 'assist_driving_log (0156) noch nicht angewendet.',
  };
}
