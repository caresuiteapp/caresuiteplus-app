import type { RoleKey, ServiceResult } from '@/types';
import type { ReleaseDetail, ReleaseHubSnapshot, ReleaseListItem } from '@/types/release';
import {
  RELEASE_DEMO_TENANT,
  createReleaseDraft,
  getReleaseDetail,
  getReleaseHubSnapshot,
  releaseDemoList,
  toggleReleaseChecklistItem,
} from '@/data/demo/domains/releaseDemo';
import { enforcePermission } from '@/lib/permissions';

/** WP527 — Service-Schicht Release */
export async function fetchReleaseHub(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<ReleaseHubSnapshot>> {
  const denied = enforcePermission<ReleaseHubSnapshot>(actorRoleKey, 'release.view');
  if (denied) return denied;
  if (tenantId !== RELEASE_DEMO_TENANT) return { ok: false, error: 'Mandant nicht gefunden.' };
  await new Promise((r) => setTimeout(r, 180));
  return { ok: true, data: getReleaseHubSnapshot() };
}

export async function fetchReleaseList(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<ReleaseListItem[]>> {
  const denied = enforcePermission<ReleaseListItem[]>(actorRoleKey, 'release.view');
  if (denied) return denied;
  if (tenantId !== RELEASE_DEMO_TENANT) return { ok: false, error: 'Mandant nicht gefunden.' };
  await new Promise((r) => setTimeout(r, 160));
  return { ok: true, data: releaseDemoList };
}

export async function fetchReleaseDetail(
  tenantId: string,
  releaseId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<ReleaseDetail>> {
  const denied = enforcePermission<ReleaseDetail>(actorRoleKey, 'release.view');
  if (denied) return denied;
  if (tenantId !== RELEASE_DEMO_TENANT) return { ok: false, error: 'Mandant nicht gefunden.' };
  const detail = getReleaseDetail(releaseId);
  if (!detail) return { ok: false, error: 'Release nicht gefunden.' };
  await new Promise((r) => setTimeout(r, 140));
  return { ok: true, data: detail };
}

export async function createRelease(
  tenantId: string,
  title: string,
  env: ReleaseListItem['env'],
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<{ id: string }>> {
  const denied = enforcePermission<{ id: string }>(actorRoleKey, 'release.manage');
  if (denied) return denied;
  if (tenantId !== RELEASE_DEMO_TENANT) return { ok: false, error: 'Mandant nicht gefunden.' };
  if (!title.trim()) return { ok: false, error: 'Titel ist erforderlich.' };
  await new Promise((r) => setTimeout(r, 220));
  return { ok: true, data: createReleaseDraft(title, env) };
}

export async function toggleReleaseChecklist(
  tenantId: string,
  releaseId: string,
  itemId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<ReleaseDetail>> {
  const denied = enforcePermission<ReleaseDetail>(actorRoleKey, 'release.manage');
  if (denied) return denied;
  if (tenantId !== RELEASE_DEMO_TENANT) return { ok: false, error: 'Mandant nicht gefunden.' };
  const detail = toggleReleaseChecklistItem(releaseId, itemId);
  if (!detail) return { ok: false, error: 'Checklistenpunkt nicht gefunden.' };
  await new Promise((r) => setTimeout(r, 200));
  return { ok: true, data: detail };
}
