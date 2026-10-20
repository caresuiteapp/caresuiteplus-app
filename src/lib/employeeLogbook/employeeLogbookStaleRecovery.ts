import { berlinToday } from './employeeLogbookDate';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';

type Row = Record<string, unknown>;

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function time(value: unknown): number {
  const parsed = new Date(text(value)).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function isBeforeCurrentBerlinDay(value: unknown): boolean {
  const timestamp = time(value);
  if (!timestamp) return false;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(timestamp)) < berlinToday();
}

/**
 * Closes stale Assist sessions and quarantines stale/legacy logbook records.
 * No questionable kilometre is approved or paid by this repair.
 */
export async function repairStaleEmployeeLogbookState(
  tenantId: string,
  employeeId: string,
): Promise<{ sessionsClosed: number; tripsQuarantined: number; legacyTripsQuarantined: number }> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Keine sichere Datenbankverbindung.');

  const [sessionsResult, tripsResult, legacyResult] = await Promise.all([
    fromUnknownTable(supabase, 'assist_tracking_sessions')
      .select('id,started_at,last_location_at,updated_at')
      .eq('tenant_id', tenantId)
      .eq('employee_id', employeeId)
      .eq('is_active', true),
    fromUnknownTable(supabase, 'employee_logbook_trips')
      .select('id,started_at')
      .eq('tenant_id', tenantId)
      .eq('employee_id', employeeId)
      .eq('status', 'recording'),
    fromUnknownTable(supabase, 'employee_logbook_trips')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('employee_id', employeeId)
      .eq('status', 'completed')
      .like('source', 'assist_gps_recovery:%'),
  ]);
  const error = sessionsResult.error || tripsResult.error || legacyResult.error;
  if (error) throw new Error(error.message);

  const nowMs = Date.now();
  const staleSessions = ((sessionsResult.data ?? []) as Row[]).filter((session) => {
    if (isBeforeCurrentBerlinDay(session.started_at)) return true;
    const latestActivity = Math.max(time(session.last_location_at), time(session.updated_at));
    return latestActivity > 0 && nowMs - latestActivity > 30 * 60 * 1_000;
  });
  for (const session of staleSessions) {
    const endedAt = text(session.last_location_at) || text(session.updated_at) || text(session.started_at);
    const update = await fromUnknownTable(supabase, 'assist_tracking_sessions')
      .update({
        is_active: false,
        ended_at: endedAt,
        end_reason: 'timeout',
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .eq('employee_id', employeeId)
      .eq('id', text(session.id))
      .eq('is_active', true);
    if (update.error) throw new Error(update.error.message);
  }

  let tripsQuarantined = 0;
  const staleTrips = ((tripsResult.data ?? []) as Row[]).filter((trip) =>
    isBeforeCurrentBerlinDay(trip.started_at),
  );
  for (const trip of staleTrips) {
    const latestPoint = await fromUnknownTable(supabase, 'employee_logbook_points')
      .select('recorded_at')
      .eq('tenant_id', tenantId)
      .eq('employee_id', employeeId)
      .eq('trip_id', text(trip.id))
      .order('recorded_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestPoint.error) throw new Error(latestPoint.error.message);
    const endedAt = text((latestPoint.data as Row | null)?.recorded_at) || text(trip.started_at);
    const update = await fromUnknownTable(supabase, 'employee_logbook_trips')
      .update({
        status: 'review_required',
        ended_at: endedAt,
        notes: 'Automatisch beendet: Die Aufzeichnung war über den Kalendertag hinaus offen. Kilometer bleiben bis zur Verwaltungsprüfung gesperrt.',
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .eq('employee_id', employeeId)
      .eq('id', text(trip.id))
      .eq('status', 'recording');
    if (update.error) throw new Error(update.error.message);
    tripsQuarantined += 1;
  }

  const legacyTrips = (legacyResult.data ?? []) as Row[];
  for (const trip of legacyTrips) {
    const update = await fromUnknownTable(supabase, 'employee_logbook_trips')
      .update({
        status: 'review_required',
        notes: 'R16-Gesamtimport gesperrt: Die Assist-Sitzung muss in einzelne Anfahrt-, Dienst- und Rückfahrtabschnitte zerlegt werden.',
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .eq('employee_id', employeeId)
      .eq('id', text(trip.id))
      .eq('status', 'completed');
    if (update.error) throw new Error(update.error.message);
  }

  return {
    sessionsClosed: staleSessions.length,
    tripsQuarantined,
    legacyTripsQuarantined: legacyTrips.length,
  };
}
