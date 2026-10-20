import type { RoleKey, ServiceResult } from '@/types';
import type { RoadmapDetail, RoadmapHubSnapshot, RoadmapListItem } from '@/types/roadmap';
import {
  ROADMAP_DEMO_TENANT,
  createRoadmapMilestone,
  getRoadmapDetail,
  getRoadmapHubSnapshot,
  roadmapDemoList,
} from '@/data/demo/domains/roadmapDemo';
import { enforcePermission } from '@/lib/permissions';

/** WP587 — Service-Schicht Roadmap */
export async function fetchRoadmapHub(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<RoadmapHubSnapshot>> {
  const denied = enforcePermission<RoadmapHubSnapshot>(actorRoleKey, 'roadmap.view');
  if (denied) return denied;
  if (tenantId !== ROADMAP_DEMO_TENANT) return { ok: false, error: 'Mandant nicht gefunden.' };
  await new Promise((r) => setTimeout(r, 180));
  return { ok: true, data: getRoadmapHubSnapshot() };
}

export async function fetchRoadmapList(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<RoadmapListItem[]>> {
  const denied = enforcePermission<RoadmapListItem[]>(actorRoleKey, 'roadmap.view');
  if (denied) return denied;
  if (tenantId !== ROADMAP_DEMO_TENANT) return { ok: false, error: 'Mandant nicht gefunden.' };
  await new Promise((r) => setTimeout(r, 160));
  return { ok: true, data: roadmapDemoList };
}

export async function fetchRoadmapDetail(
  tenantId: string,
  itemId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<RoadmapDetail>> {
  const denied = enforcePermission<RoadmapDetail>(actorRoleKey, 'roadmap.view');
  if (denied) return denied;
  if (tenantId !== ROADMAP_DEMO_TENANT) return { ok: false, error: 'Mandant nicht gefunden.' };
  const detail = getRoadmapDetail(itemId);
  if (!detail) return { ok: false, error: 'Meilenstein nicht gefunden.' };
  await new Promise((r) => setTimeout(r, 140));
  return { ok: true, data: detail };
}

export async function createRoadmapEntry(
  tenantId: string,
  title: string,
  phase: RoadmapListItem['phase'],
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<{ id: string }>> {
  const denied = enforcePermission<{ id: string }>(actorRoleKey, 'roadmap.manage');
  if (denied) return denied;
  if (tenantId !== ROADMAP_DEMO_TENANT) return { ok: false, error: 'Mandant nicht gefunden.' };
  if (!title.trim()) return { ok: false, error: 'Titel ist erforderlich.' };
  await new Promise((r) => setTimeout(r, 220));
  return { ok: true, data: createRoadmapMilestone(title, phase) };
}
