import type { PortalAccessStatus } from '@/types/modules/client';
import { mapClientPortalAccess } from '@/lib/supabase/mappers';
import type { PortalAccessRow } from '@/lib/supabase/mappers/clientExtendedMapper';

export type ClientPortalAccessListItem = {
  id: string;
  tenantId: string;
  clientId: string;
  clientName: string;
  portalUsername: string | null;
  portalEnabled: boolean;
  status: PortalAccessStatus;
  lastLoginAt: string | null;
  codeCreatedAt: string | null;
};

export type ClientPortalAccessListRow = PortalAccessRow & {
  clients?: { first_name: string | null; last_name: string | null } | null;
};

function resolveClientName(
  row: ClientPortalAccessListRow,
  clientNames: Map<string, string>,
): string {
  const joined = row.clients;
  if (joined) {
    const name = `${joined.first_name ?? ''} ${joined.last_name ?? ''}`.trim();
    if (name) return name;
  }
  return clientNames.get(row.client_id) ?? 'Unbekannt';
}

export function mapClientPortalAccessListRow(
  row: ClientPortalAccessListRow,
  clientNames: Map<string, string>,
): ClientPortalAccessListItem {
  const access = mapClientPortalAccess(row);
  return {
    id: access.id,
    tenantId: access.tenantId,
    clientId: access.clientId,
    clientName: resolveClientName(row, clientNames),
    portalUsername: access.portalUsername,
    portalEnabled: access.portalEnabled,
    status: access.status,
    lastLoginAt: access.lastLoginAt,
    codeCreatedAt: access.codeCreatedAt,
  };
}
