import type { RoleKey, ServiceResult } from '@/types';
import type { QaDetail, QaHubSnapshot, QaListItem } from '@/types/qa';
import {
  QA_DEMO_TENANT,
  createQaItem,
  getQaDetail,
  getQaHubSnapshot,
  qaDemoList,
} from '@/data/demo/domains/qaDemo';
import { enforcePermission } from '@/lib/permissions';

/** WP567 — Service-Schicht QA */
export async function fetchQaHub(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<QaHubSnapshot>> {
  const denied = enforcePermission<QaHubSnapshot>(actorRoleKey, 'qa.view');
  if (denied) return denied;
  if (tenantId !== QA_DEMO_TENANT) return { ok: false, error: 'Mandant nicht gefunden.' };
  await new Promise((r) => setTimeout(r, 180));
  return { ok: true, data: getQaHubSnapshot() };
}

export async function fetchQaList(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<QaListItem[]>> {
  const denied = enforcePermission<QaListItem[]>(actorRoleKey, 'qa.view');
  if (denied) return denied;
  if (tenantId !== QA_DEMO_TENANT) return { ok: false, error: 'Mandant nicht gefunden.' };
  await new Promise((r) => setTimeout(r, 160));
  return { ok: true, data: qaDemoList };
}

export async function fetchQaDetail(
  tenantId: string,
  itemId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<QaDetail>> {
  const denied = enforcePermission<QaDetail>(actorRoleKey, 'qa.view');
  if (denied) return denied;
  if (tenantId !== QA_DEMO_TENANT) return { ok: false, error: 'Mandant nicht gefunden.' };
  const detail = getQaDetail(itemId);
  if (!detail) return { ok: false, error: 'Eintrag nicht gefunden.' };
  await new Promise((r) => setTimeout(r, 140));
  return { ok: true, data: detail };
}

export async function createQaEntry(
  tenantId: string,
  title: string,
  kind: QaListItem['kind'],
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<{ id: string }>> {
  const denied = enforcePermission<{ id: string }>(actorRoleKey, 'qa.manage');
  if (denied) return denied;
  if (tenantId !== QA_DEMO_TENANT) return { ok: false, error: 'Mandant nicht gefunden.' };
  if (!title.trim()) return { ok: false, error: 'Titel ist erforderlich.' };
  await new Promise((r) => setTimeout(r, 220));
  return { ok: true, data: createQaItem(title, kind) };
}
