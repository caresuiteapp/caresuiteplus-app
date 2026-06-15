import type { RoleKey, ServiceResult } from '@/types';
import type { AssignmentListItem } from '@/types/modules/assist';
import { getDemoAssignmentListItems } from '@/data/demo/assistAssignments';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { enforcePermission } from '@/lib/permissions';

export type CalendarDayGroup = {
  dateKey: string;
  label: string;
  assignments: AssignmentListItem[];
};

function formatDateKey(iso: string): string {
  return iso.slice(0, 10);
}

function formatDayLabel(dateKey: string): string {
  const date = new Date(`${dateKey}T12:00:00`);
  return date.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
}

/** WP243 — Kalender-Gruppierung aus Einsätzen */
export async function fetchCalendarWeek(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CalendarDayGroup[]>> {
  const denied = enforcePermission<CalendarDayGroup[]>(actorRoleKey, 'assist.assignments.view');
  if (denied) return denied;
  if (tenantId !== DEMO_TENANT_ID) return { ok: false, error: 'Mandant nicht gefunden.' };

  await new Promise((r) => setTimeout(r, 220));
  const items = getDemoAssignmentListItems();
  const map = new Map<string, AssignmentListItem[]>();
  for (const item of items) {
    const key = formatDateKey(item.scheduledStart);
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  }
  const groups = [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, assignments]) => ({
      dateKey,
      label: formatDayLabel(dateKey),
      assignments: assignments.sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart)),
    }));
  return { ok: true, data: groups };
}
