import type { RoleKey, ServiceResult } from '@/types';
import {
  createDemoInformationCollection,
  getDemoInformationCollectionById,
  getDemoInformationCollections,
  type InformationCollectionListItem,
} from '@/data/demo/informationCollections';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';

async function demoDelay(ms = 220): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

export async function fetchInformationCollections(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<InformationCollectionListItem[]>> {
  const denied = enforcePermission<InformationCollectionListItem[]>(actorRoleKey, 'pflege.plans.view');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  if (tenantId !== DEMO_TENANT_ID) return { ok: false, error: 'Live-Modus: Repository erweitern.' };
  await demoDelay();
  return { ok: true, data: getDemoInformationCollections() };
}

export async function fetchInformationCollectionDetail(
  tenantId: string,
  id: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<InformationCollectionListItem>> {
  const denied = enforcePermission<InformationCollectionListItem>(actorRoleKey, 'pflege.plans.view');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  if (tenantId !== DEMO_TENANT_ID) return { ok: false, error: 'Live-Modus: Repository erweitern.' };
  await demoDelay();
  const item = getDemoInformationCollectionById(id);
  if (!item) return { ok: false, error: 'Informationssammlung nicht gefunden.' };
  return { ok: true, data: item };
}

export async function createInformationCollection(
  tenantId: string,
  input: { clientId: string; clientName: string; collectionType: string },
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<InformationCollectionListItem>> {
  const denied = enforcePermission<InformationCollectionListItem>(actorRoleKey, 'pflege.plans.view');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  if (tenantId !== DEMO_TENANT_ID) return { ok: false, error: 'Live-Modus: Repository erweitern.' };
  await demoDelay(300);
  return { ok: true, data: createDemoInformationCollection(input) };
}
