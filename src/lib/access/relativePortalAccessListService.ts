import type { RoleKey, ServiceResult } from '@/types';
import { enforcePermission } from '@/lib/permissions';
import { getServiceMode } from '@/lib/services/mode';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getRelativePortalCodes } from '@/lib/auth/demoAccessStore';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { demoClients } from '@/data/demo/clients';
import { fetchRelativePortalAccessListFromSupabase } from './accessManagementLiveRepository';
import type { RelativePortalAccessListItem } from './accessManagementMappers';

function resolveDemoClientName(clientId: string): string {
  const client = demoClients.find((entry) => entry.id === clientId);
  return client ? `${client.firstName} ${client.lastName}` : 'Unbekannt';
}

function mapDemoRelativePortalList(tenantId: string): RelativePortalAccessListItem[] {
  return getRelativePortalCodes(tenantId).map((entry) => ({
    ...entry,
    clientName: resolveDemoClientName(entry.clientId),
    relativeContactName: entry.relativeContactId,
  }));
}

export async function fetchRelativePortalAccessList(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<RelativePortalAccessListItem[]>> {
  const denied = enforcePermission<RelativePortalAccessListItem[]>(
    actorRoleKey,
    'office.access' as never,
  );
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    return fetchRelativePortalAccessListFromSupabase(tenantId);
  }

  await new Promise((resolve) => setTimeout(resolve, 180));
  return { ok: true, data: mapDemoRelativePortalList(tenantId || DEMO_TENANT_ID) };
}

export type { RelativePortalAccessListItem } from './accessManagementMappers';
