/**
 * Office Live-Mitarbeiter — merges WFM sessions with active Assist GPS tracking.
 */
import type { RoleKey, ServiceResult } from '@/types';
import type { WfmLiveEmployeeRow } from '@/types/modules/wfm';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { getWfmLiveEmployeeOverview } from '@/lib/wfm/wfmLiveStatusService';

type ActiveTrackingRow = {
  employee_id: string;
  visit_id: string;
  started_at: string;
  latitude: number | null;
  longitude: number | null;
  recorded_at: string | null;
};

const LIVE_TRACKING_FRESHNESS_MS = 15 * 60 * 1000;

function isFreshLiveTimestamp(value: string | null | undefined, now = Date.now()): boolean {
  if (!value) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && now - timestamp >= 0 && now - timestamp <= LIVE_TRACKING_FRESHNESS_MS;
}

async function fetchActiveAssistTrackingRows(
  tenantId: string,
): Promise<ActiveTrackingRow[]> {
  const supabase = getSupabaseClient();
  if (!supabase || getServiceMode() !== 'supabase') return [];

  const { data: sessions, error } = await supabase
    .from('assist_tracking_sessions')
    .select('employee_id, visit_id, started_at')
    .eq('tenant_id', tenantId)
    .eq('is_active', true);

  if (error || !sessions?.length) {
    if (error) console.warn('[getOfficeLiveEmployees] sessions:', toGermanSupabaseError(error));
    return [];
  }

  const typedSessions = sessions as {
    employee_id: string | null;
    visit_id: string;
    started_at: string;
  }[];
  const visitIds = [...new Set(typedSessions.map((session) => session.visit_id))];
  const cutoff = new Date(Date.now() - LIVE_TRACKING_FRESHNESS_MS).toISOString();
  const { data: points, error: pointsError } = await supabase
      .from('assist_location_points')
      .select('visit_id, latitude, longitude, recorded_at')
      .eq('tenant_id', tenantId)
      .in('visit_id', visitIds)
      .gte('recorded_at', cutoff)
      .order('recorded_at', { ascending: false });

  if (pointsError) {
    console.warn('[getOfficeLiveEmployees] points:', toGermanSupabaseError(pointsError));
  }

  const latestPointByVisit = new Map<string, {
    latitude: number | null;
    longitude: number | null;
    recorded_at: string | null;
  }>();
  for (const point of (points ?? []) as {
    visit_id: string;
    latitude: number | null;
    longitude: number | null;
    recorded_at: string | null;
  }[]) {
    if (!latestPointByVisit.has(point.visit_id)) latestPointByVisit.set(point.visit_id, point);
  }

  const rows: ActiveTrackingRow[] = [];
  for (const session of typedSessions) {
    if (!session.employee_id) continue;
    const point = latestPointByVisit.get(session.visit_id);
    const liveAt = point?.recorded_at ?? session.started_at;
    if (!isFreshLiveTimestamp(liveAt)) continue;

    rows.push({
      employee_id: session.employee_id,
      visit_id: session.visit_id,
      started_at: session.started_at,
      latitude: point?.latitude != null ? Number(point.latitude) : null,
      longitude: point?.longitude != null ? Number(point.longitude) : null,
      recorded_at: point?.recorded_at ?? null,
    });
  }

  return rows;
}

async function fetchEmployeeNameMap(
  tenantId: string,
  employeeIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (employeeIds.length === 0) return map;

  const supabase = getSupabaseClient();
  if (!supabase) return map;

  const { data } = await supabase
    .from('employees')
    .select('id, first_name, last_name')
    .eq('tenant_id', tenantId)
    .in('id', employeeIds);

  for (const row of (data ?? []) as { id: string; first_name: string | null; last_name: string | null }[]) {
    const name = [row.first_name, row.last_name].filter(Boolean).join(' ').trim();
    map.set(row.id, name || `MA ${row.id.slice(0, 8)}`);
  }
  return map;
}

export async function getOfficeLiveEmployees(
  tenantId: string,
  actorRoleKey: RoleKey | null,
): Promise<ServiceResult<{ rows: WfmLiveEmployeeRow[]; onlineCount: number; totalCount: number }>> {
  const denied = enforcePermission(actorRoleKey, 'time.tracking.team.view');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const wfmOverview = await getWfmLiveEmployeeOverview(tenantId, actorRoleKey);
  if (!wfmOverview.ok) return wfmOverview;

  const trackingRows = await fetchActiveAssistTrackingRows(tenantId);
  if (trackingRows.length === 0) {
    return wfmOverview;
  }

  const rowByEmployee = new Map(wfmOverview.data.rows.map((r) => [r.employeeId, r]));
  const trackingEmployeeIds = trackingRows.map((t) => t.employee_id);
  const missingIds = trackingEmployeeIds.filter((id) => !rowByEmployee.has(id));
  const names = await fetchEmployeeNameMap(tenantId, missingIds);

  for (const track of trackingRows) {
    const existing = rowByEmployee.get(track.employee_id);
    if (existing) {
      if (!existing.session?.isOnline) {
        existing.session = {
          ...existing.session!,
          isOnline: true,
          status: 'on_visit',
          currentVisitId: track.visit_id,
          lastEventAt: track.recorded_at ?? track.started_at,
        };
        existing.statusLabel = 'Unterwegs / Einsatz (GPS)';
        existing.lastEventAt = track.recorded_at ?? track.started_at;
        if (track.latitude != null && track.longitude != null) {
          existing.locationLabel = `${track.latitude.toFixed(4)}, ${track.longitude.toFixed(4)}`;
        }
      }
      continue;
    }

    rowByEmployee.set(track.employee_id, {
      employeeId: track.employee_id,
      employeeName: names.get(track.employee_id) ?? 'Unbekannt',
      session: {
        id: `assist-track-${track.visit_id}`,
        tenantId,
        employeeId: track.employee_id,
        userId: null,
        workDate: new Date().toISOString().slice(0, 10),
        status: 'on_visit',
        workMode: 'field',
        displayStatus: 'im_einsatz',
        isOnline: true,
        currentVisitId: track.visit_id,
        lastEventAt: track.recorded_at ?? track.started_at,
        startedAt: track.started_at,
        endedAt: null,
        grossMinutes: 0,
        netMinutes: 0,
        pauseMinutes: 0,
      },
      statusLabel: 'Unterwegs / Einsatz (GPS)',
      locationLabel:
        track.latitude != null && track.longitude != null
          ? `${track.latitude.toFixed(4)}, ${track.longitude.toFixed(4)}`
          : null,
      lastEventAt: track.recorded_at ?? track.started_at,
    });
  }

  const rows = [...rowByEmployee.values()].sort((a, b) => {
    const aOnline = a.session?.isOnline ? 1 : 0;
    const bOnline = b.session?.isOnline ? 1 : 0;
    if (bOnline !== aOnline) return bOnline - aOnline;
    return (b.lastEventAt ?? '').localeCompare(a.lastEventAt ?? '');
  });

  const onlineCount = rows.filter((r) => r.session?.isOnline && r.session.status !== 'ended').length;

  return {
    ok: true,
    data: { rows, onlineCount, totalCount: rows.length },
  };
}
