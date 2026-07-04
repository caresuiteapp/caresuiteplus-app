import type { RoleKey, ServiceResult } from '@/types';
import type {
  WfmAbsence,
  WfmTeamTodayKpis,
  WfmTeamTodayOverview,
  WfmTeamTodayRow,
  WfmTimeEvent,
  WfmWorkSession,
} from '@/types/modules/wfm';
import { mapEmployeeAvatarUrl } from '@/lib/office/employeeAvatarService';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { listWfmAbsencesForTeam } from './wfmAbsenceService';
import { listPendingWfmApprovals } from './wfmApprovalService';
import {
  buildTeamRowWarnings,
  isWfmAbsenceCoveringDate,
  resolveLastEventSourceLabel,
  resolveTeamEmployeeStatusLabel,
  resolveWfmWorkTypeLabel,
} from './wfmDisplayHelpers';
import { listWfmTeamRuleViolationsToday } from './wfmRuleEngine';
import {
  fetchSessionEvents,
  listSessionsForDate,
  todayWorkDate,
} from './wfmWorkSessionRepository';

type EmployeeProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
};

type EmployeeProfile = {
  name: string;
  avatarUrl: string | null;
};

async function fetchEmployeeProfiles(
  tenantId: string,
  employeeIds: string[],
): Promise<Map<string, EmployeeProfile>> {
  const map = new Map<string, EmployeeProfile>();
  if (employeeIds.length === 0) return map;

  if (getServiceMode() !== 'supabase') {
    for (const id of employeeIds) {
      map.set(id, { name: `Mitarbeiter ${id.slice(-4)}`, avatarUrl: null });
    }
    return map;
  }

  const supabase = getSupabaseClient();
  if (!supabase) return map;

  const { data, error } = await supabase
    .from('employees')
    .select('id, first_name, last_name, avatar_url')
    .eq('tenant_id', tenantId)
    .in('id', employeeIds);

  if (error || !data) return map;

  for (const row of data as EmployeeProfileRow[]) {
    const name = [row.first_name, row.last_name].filter(Boolean).join(' ').trim();
    map.set(row.id, {
      name: name || `MA ${row.id.slice(0, 8)}`,
      avatarUrl: mapEmployeeAvatarUrl(row.avatar_url),
    });
  }
  return map;
}

function computeKpis(
  rows: WfmTeamTodayRow[],
  pendingReviewCount: number,
  openRequestsCount: number,
): WfmTeamTodayKpis {
  const withSession = rows.filter((r) => r.session?.startedAt);
  const activeRows = rows.filter(
    (r) => r.session?.isOnline && !['offline', 'ended'].includes(r.session.status) && !r.absence,
  );

  return {
    capturedToday: withSession.length,
    activeCount: activeRows.length,
    onPauseCount: activeRows.filter((r) => r.session?.status === 'paused').length,
    onVisitCount: activeRows.filter((r) => r.session?.status === 'on_visit').length,
    inOfficeCount: activeRows.filter(
      (r) => r.session?.status === 'office' || r.session?.displayStatus === 'buero',
    ).length,
    homeofficeCount: activeRows.filter((r) => r.session?.status === 'homeoffice').length,
    pendingReviewCount,
    openRequestsCount,
  };
}

function buildRow(
  employeeId: string,
  profile: EmployeeProfile,
  session: WfmWorkSession | null,
  absence: WfmAbsence | null,
  events: WfmTimeEvent[],
  ruleMessages: string[],
): WfmTeamTodayRow {
  const totalMinutes = session?.netMinutes || session?.grossMinutes || 0;
  return {
    employeeId,
    employeeName: profile.name,
    avatarUrl: profile.avatarUrl,
    statusLabel: resolveTeamEmployeeStatusLabel(session, absence),
    workTypeLabel: absence ? null : resolveWfmWorkTypeLabel(session),
    startedAt: session?.startedAt ?? null,
    endedAt: session?.endedAt ?? null,
    breakMinutes: session?.pauseMinutes ?? 0,
    totalMinutes,
    lastEventSourceLabel: resolveLastEventSourceLabel(events),
    warnings: buildTeamRowWarnings(session, events, ruleMessages),
    session,
    absence,
    events,
    lastEventAt: session?.lastEventAt ?? null,
    isOnline: !!session?.isOnline && !absence,
  };
}

export async function getWfmTeamTodayOverview(
  tenantId: string,
  actorRoleKey: RoleKey | null,
): Promise<ServiceResult<WfmTeamTodayOverview>> {
  const denied = enforcePermission(actorRoleKey, 'time.tracking.team.view');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const workDate = todayWorkDate();

  const [sessionsResult, absencesResult, approvalsResult, violationsResult] = await Promise.all([
    listSessionsForDate(tenantId, workDate),
    listWfmAbsencesForTeam(tenantId, actorRoleKey),
    listPendingWfmApprovals(tenantId, actorRoleKey),
    listWfmTeamRuleViolationsToday(tenantId, actorRoleKey),
  ]);

  if (!sessionsResult.ok) return sessionsResult;

  const absences = absencesResult.ok ? absencesResult.data : [];
  const approvals = approvalsResult.ok ? approvalsResult.data : [];
  const violations = violationsResult.ok ? violationsResult.data : [];

  const absencesToday = absences.filter((a) => isWfmAbsenceCoveringDate(a, workDate));
  const absenceByEmployee = new Map(absencesToday.map((a) => [a.employeeId, a]));

  const sessionByEmployee = new Map<string, WfmWorkSession>();
  for (const session of sessionsResult.data) {
    sessionByEmployee.set(session.employeeId, session);
  }

  const employeeIds = [
    ...new Set([
      ...sessionsResult.data.map((s) => s.employeeId),
      ...absencesToday.map((a) => a.employeeId),
    ]),
  ];

  const profiles = await fetchEmployeeProfiles(tenantId, employeeIds);

  const violationsByEmployee = new Map<string, string[]>();
  for (const v of violations) {
    const list = violationsByEmployee.get(v.employeeId) ?? [];
    list.push(v.message);
    violationsByEmployee.set(v.employeeId, list);
  }

  const eventsBySession = new Map<string, WfmTimeEvent[]>();
  await Promise.all(
    sessionsResult.data.map(async (session) => {
      const eventsResult = await fetchSessionEvents(tenantId, session.id);
      eventsBySession.set(session.id, eventsResult.ok ? eventsResult.data : []);
    }),
  );

  const rows: WfmTeamTodayRow[] = employeeIds.map((employeeId) => {
    const profile = profiles.get(employeeId) ?? {
      name: `MA ${employeeId.slice(0, 8)}`,
      avatarUrl: null,
    };
    const session = sessionByEmployee.get(employeeId) ?? null;
    const absence = absenceByEmployee.get(employeeId) ?? null;
    const events = session ? eventsBySession.get(session.id) ?? [] : [];
    const ruleMessages = violationsByEmployee.get(employeeId) ?? [];
    return buildRow(employeeId, profile, session, absence, events, ruleMessages);
  });

  rows.sort((a, b) => {
    const aActive = a.isOnline ? 1 : 0;
    const bActive = b.isOnline ? 1 : 0;
    if (bActive !== aActive) return bActive - aActive;
    if (a.absence && !b.absence) return 1;
    if (!a.absence && b.absence) return -1;
    return (b.lastEventAt ?? '').localeCompare(a.lastEventAt ?? '');
  });

  const pendingReviewCount = approvals.filter((a) => a.approvalType === 'time_correction').length;
  const openRequestsCount = approvals.filter(
    (a) => a.approvalType === 'vacation' || a.approvalType === 'absence',
  ).length;

  return {
    ok: true,
    data: {
      workDate,
      kpis: computeKpis(rows, pendingReviewCount, openRequestsCount),
      rows,
    },
  };
}

export async function getWfmTeamEmployeeDayDetail(
  tenantId: string,
  actorRoleKey: RoleKey | null,
  employeeId: string,
): Promise<ServiceResult<WfmTeamTodayRow | null>> {
  const overview = await getWfmTeamTodayOverview(tenantId, actorRoleKey);
  if (!overview.ok) return overview;
  const row = overview.data.rows.find((r) => r.employeeId === employeeId) ?? null;
  return { ok: true, data: row };
}
