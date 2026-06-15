import type { RoleKey, ServiceResult } from '@/types';
import type { SecurityDetail, SecurityHubSnapshot, SecurityListItem } from '@/types/security';
import {
  SECURITY_DEMO_TENANT,
  createSecurityFinding,
  getSecurityDetail,
  getSecurityHubSnapshot,
  securityDemoList,
} from '@/data/demo/domains/securityDemo';
import { enforcePermission } from '@/lib/permissions';

/** WP547 — Service-Schicht Security */
export async function fetchSecurityHub(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<SecurityHubSnapshot>> {
  const denied = enforcePermission<SecurityHubSnapshot>(actorRoleKey, 'security.view');
  if (denied) return denied;
  if (tenantId !== SECURITY_DEMO_TENANT) return { ok: false, error: 'Mandant nicht gefunden.' };
  await new Promise((r) => setTimeout(r, 180));
  return { ok: true, data: getSecurityHubSnapshot() };
}

export async function fetchSecurityList(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<SecurityListItem[]>> {
  const denied = enforcePermission<SecurityListItem[]>(actorRoleKey, 'security.view');
  if (denied) return denied;
  if (tenantId !== SECURITY_DEMO_TENANT) return { ok: false, error: 'Mandant nicht gefunden.' };
  await new Promise((r) => setTimeout(r, 160));
  return { ok: true, data: securityDemoList };
}

export async function fetchSecurityDetail(
  tenantId: string,
  itemId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<SecurityDetail>> {
  const denied = enforcePermission<SecurityDetail>(actorRoleKey, 'security.view');
  if (denied) return denied;
  if (tenantId !== SECURITY_DEMO_TENANT) return { ok: false, error: 'Mandant nicht gefunden.' };
  const detail = getSecurityDetail(itemId);
  if (!detail) return { ok: false, error: 'Eintrag nicht gefunden.' };
  await new Promise((r) => setTimeout(r, 140));
  return { ok: true, data: detail };
}

export async function createSecurityItem(
  tenantId: string,
  title: string,
  category: SecurityListItem['category'],
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<{ id: string }>> {
  const denied = enforcePermission<{ id: string }>(actorRoleKey, 'security.manage');
  if (denied) return denied;
  if (tenantId !== SECURITY_DEMO_TENANT) return { ok: false, error: 'Mandant nicht gefunden.' };
  if (!title.trim()) return { ok: false, error: 'Titel ist erforderlich.' };
  await new Promise((r) => setTimeout(r, 220));
  return { ok: true, data: createSecurityFinding(title, category) };
}
