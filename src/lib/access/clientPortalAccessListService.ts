import type { RoleKey, ServiceResult } from '@/types';
import { demoClients } from '@/data/demo/clients';
import { getClientPortalCodes } from '@/lib/auth/accessStore';
import { getClientExtendedRepository } from '@/lib/clients/clientBackend';
import { enforcePermission } from '@/lib/permissions';
import { getServiceMode } from '@/lib/services/mode';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import {
  mapClientPortalAccessListRow,
  type ClientPortalAccessListItem,
  type ClientPortalAccessListRow,
} from './clientPortalAccessListMapper';

const PORTAL_ACCESS_LIST_SELECT = `
  id, tenant_id, client_id, contact_id, email, portal_username, portal_enabled,
  status, last_login_at, invited_at, code_created_at, code_rotated_at,
  modules_enabled, two_factor_enabled, created_at, updated_at,
  clients(first_name, last_name)
` as const;

function castRows(rows: unknown[] | null | undefined): ClientPortalAccessListRow[] {
  return (rows ?? []) as ClientPortalAccessListRow[];
}

function resolveDemoClientName(clientId: string): string {
  const client = demoClients.find((entry) => entry.id === clientId);
  return client ? `${client.firstName} ${client.lastName}` : 'Unbekannt';
}

function mapDemoPortalAccessList(tenantId: string): ClientPortalAccessListItem[] {
  return getClientPortalCodes(tenantId).map((entry) => ({
    id: entry.id,
    tenantId: entry.tenantId,
    clientId: entry.clientId,
    clientName: resolveDemoClientName(entry.clientId),
    portalUsername: entry.username,
    portalEnabled: entry.status === 'active',
    status: entry.status === 'active' ? 'aktiv' : entry.status === 'blocked' ? 'gesperrt' : 'deaktiviert',
    lastLoginAt: entry.lastUsedAt,
    codeCreatedAt: entry.createdAt,
  }));
}

async function fetchTenantPortalAccessFromSupabase(
  tenantId: string,
): Promise<ServiceResult<ClientPortalAccessListItem[]>> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, error: 'Supabase ist nicht verfügbar.' };
  }

  const { data, error } = await fromUnknownTable(supabase, 'client_portal_access')
    .select(PORTAL_ACCESS_LIST_SELECT)
    .eq('tenant_id', tenantId)
    .order('updated_at', { ascending: false });

  if (error) return { ok: false, error: toGermanSupabaseError(error) };

  const rows = castRows(data);
  const clientNames = new Map<string, string>();
  return {
    ok: true,
    data: rows.map((row) => mapClientPortalAccessListRow(row, clientNames)),
  };
}

export async function fetchClientPortalAccessList(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<ClientPortalAccessListItem[]>> {
  const denied = enforcePermission<ClientPortalAccessListItem[]>(
    actorRoleKey,
    'office.clients.view',
  );
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    const direct = await fetchTenantPortalAccessFromSupabase(tenantId);
    if (direct.ok) return direct;

    const repo = getClientExtendedRepository();
    const fallback = await repo.listPortalAccessForTenant(tenantId);
    if (!fallback.ok) return fallback;
    return { ok: true, data: fallback.data };
  }

  await new Promise((resolve) => setTimeout(resolve, 180));
  return { ok: true, data: mapDemoPortalAccessList(tenantId) };
}
