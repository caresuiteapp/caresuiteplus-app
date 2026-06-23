import type { RoleKey, ServiceResult } from '@/types';
import type { AssistDashboardStats, AssignmentListItem } from '@/types/modules/assist';
import { fetchAssistDashboardStats, fetchTodayAssignments } from './assignmentListService';

export const EMPTY_ASSIST_DASHBOARD_STATS: AssistDashboardStats = {
  totalAssignments: 0,
  todayCount: 0,
  activeCount: 0,
  inProgressCount: 0,
  completedTodayCount: 0,
  upcomingCount: 0,
  atRiskCount: 0,
  incompleteCount: 0,
  openProofCount: 0,
  openProofReviewCount: 0,
  openSignatureCount: 0,
  openPortalReleaseCount: 0,
  openTripsCount: 0,
};

export type AssistDashboardBundle = {
  stats: AssistDashboardStats;
  todayAssignments: AssignmentListItem[];
};

export async function fetchAssistDashboardBundle(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<AssistDashboardBundle>> {
  const statsResult = await fetchAssistDashboardStats(tenantId, actorRoleKey);
  if (!statsResult.ok) return statsResult;

  const todayResult = await fetchTodayAssignments(tenantId, actorRoleKey);
  if (!todayResult.ok) return todayResult;

  return {
    ok: true,
    data: {
      stats: statsResult.data,
      todayAssignments: todayResult.data,
    },
  };
}

export function pickRunningAssignment(
  todayAssignments: AssignmentListItem[],
): AssignmentListItem | null {
  const running = todayAssignments.find(
    (item) => item.status === 'aktiv' || item.status === 'in_bearbeitung',
  );
  return running ?? null;
}

const SKIPPED_NEXT_STATUSES = new Set([
  'abgeschlossen',
  'storniert',
  'archiviert',
  'gesperrt',
  'fehlerhaft',
  'aktiv',
  'in_bearbeitung',
]);

export function pickNextAssignment(
  todayAssignments: AssignmentListItem[],
): AssignmentListItem | null {
  const now = Date.now();
  const upcoming = todayAssignments
    .filter((item) => !SKIPPED_NEXT_STATUSES.has(String(item.status)))
    .sort(
      (a, b) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime(),
    );

  return upcoming.find((item) => new Date(item.scheduledStart).getTime() >= now) ?? upcoming[0] ?? null;
}
