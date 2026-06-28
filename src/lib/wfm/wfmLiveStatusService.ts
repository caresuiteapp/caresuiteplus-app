import type { RoleKey, ServiceResult } from '@/types';
import type { WfmLiveEmployeeRow } from '@/types/modules/wfm';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { formatWfmStatusLabel } from './wfmClockService';
import { listTeamSessionsToday } from './wfmSessionService';

type EmployeeNameRow = { id: string; first_name: string | null; last_name: string | null };

async function fetchEmployeeNames(
  tenantId: string,
  employeeIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (employeeIds.length === 0) return map;

  if (getServiceMode() !== 'supabase') {
    for (const id of employeeIds) {
      map.set(id, `Mitarbeiter ${id.slice(-4)}`);
    }
    return map;
  }

  const supabase = getSupabaseClient();
  if (!supabase) return map;

  const { data, error } = await supabase
    .from('employees')
    .select('id, first_name, last_name')
    .eq('tenant_id', tenantId)
    .in('id', employeeIds);

  if (error || !data) return map;

  for (const row of data as EmployeeNameRow[]) {
    const name = [row.first_name, row.last_name].filter(Boolean).join(' ').trim();
    map.set(row.id, name || `MA ${row.id.slice(0, 8)}`);
  }
  return map;
}

export async function getWfmLiveEmployeeOverview(
  tenantId: string,
  actorRoleKey: RoleKey | null,
): Promise<ServiceResult<{ rows: WfmLiveEmployeeRow[]; onlineCount: number; totalCount: number }>> {
  const denied = enforcePermission(actorRoleKey, 'time.tracking.team.view');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const sessionsResult = await listTeamSessionsToday(tenantId, actorRoleKey);
  if (!sessionsResult.ok) return sessionsResult;

  const sessions = sessionsResult.data;
  const employeeIds = [...new Set(sessions.map((s) => s.employeeId))];
  const names = await fetchEmployeeNames(tenantId, employeeIds);

  const rows: WfmLiveEmployeeRow[] = sessions.map((session) => ({
    employeeId: session.employeeId,
    employeeName: names.get(session.employeeId) ?? 'Unbekannt',
    session,
    statusLabel: formatWfmStatusLabel(session),
    locationLabel: null,
    lastEventAt: session.lastEventAt,
  }));

  rows.sort((a, b) => {
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

export async function getWfmMapMarkers(
  tenantId: string,
  actorRoleKey: RoleKey | null,
): Promise<
  ServiceResult<
    Array<{
      employeeId: string;
      employeeName: string;
      latitude: number;
      longitude: number;
      statusLabel: string;
      capturedAt: string | null;
    }>
  >
> {
  const overview = await getWfmLiveEmployeeOverview(tenantId, actorRoleKey);
  if (!overview.ok) return overview;

  const activeRows = overview.data.rows.filter(
    (r) => r.session?.isOnline && ['on_visit', 'driving'].includes(r.session.status),
  );

  if (getServiceMode() !== 'supabase') {
    const demoMarkers = activeRows.map((row, index) => ({
      employeeId: row.employeeId,
      employeeName: row.employeeName,
      latitude: 52.52 + index * 0.01,
      longitude: 13.405 + index * 0.01,
      statusLabel: row.statusLabel,
      capturedAt: row.lastEventAt,
    }));
    return { ok: true, data: demoMarkers };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const markers: Array<{
    employeeId: string;
    employeeName: string;
    latitude: number;
    longitude: number;
    statusLabel: string;
    capturedAt: string | null;
  }> = [];

  for (const row of activeRows) {
    const visitId = row.session?.currentVisitId;
    if (!visitId) continue;

    const { data, error } = await supabase
      .from('assist_location_points')
      .select('latitude, longitude, recorded_at')
      .eq('tenant_id', tenantId)
      .eq('visit_id', visitId)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      if (!toGermanSupabaseError(error).includes('assist_location_points')) continue;
    }
    if (!data) continue;

    markers.push({
      employeeId: row.employeeId,
      employeeName: row.employeeName,
      latitude: Number(data.latitude),
      longitude: Number(data.longitude),
      statusLabel: row.statusLabel,
      capturedAt: data.recorded_at ?? row.lastEventAt,
    });
  }

  return { ok: true, data: markers };
}
