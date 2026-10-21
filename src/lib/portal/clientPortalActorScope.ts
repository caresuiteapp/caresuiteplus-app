import type { RoleKey } from '@/types';

export type ClientPortalActorScope = Readonly<{
  tenantId: string;
  accountId: string;
  clientId: string;
  roleKey: 'client_portal' | 'family_portal';
  cachedClientId: string | null;
  cachedLinkMatches: boolean;
  source: 'authenticated_portal_link';
}>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export const isClientPortalScopeId = (value: unknown): value is string =>
  typeof value === 'string' && UUID.test(value) && value === value.toLowerCase();

export function resolveClientPortalLinkRow(
  tenantId: string,
  row: { id?: string | null; tenant_id?: string | null; client_id?: string | null } | null,
  accountId?: string | null,
): string | null {
  if (
    !isClientPortalScopeId(tenantId) ||
    !row ||
    !isClientPortalScopeId(row.id) ||
    row.tenant_id !== tenantId ||
    !isClientPortalScopeId(row.client_id) ||
    (accountId != null && row.id !== accountId)
  ) {
    return null;
  }
  return row.client_id;
}

/**
 * Builds the live client-portal scope exclusively from the authenticated
 * server link. The locally persisted client id is comparison data only: it
 * can trigger a session repair, but it can never widen or replace the scope.
 */
export function buildClientPortalActorScope(input: {
  tenantId: string;
  accountId: string;
  roleKey: RoleKey | null;
  cachedClientId?: string | null;
  linkedClientId: string;
}): ClientPortalActorScope {
  if (
    !isClientPortalScopeId(input.tenantId) ||
    !isClientPortalScopeId(input.accountId) ||
    !isClientPortalScopeId(input.linkedClientId) ||
    (input.roleKey !== 'client_portal' && input.roleKey !== 'family_portal')
  ) {
    throw Error('Verlässlicher Klientenportal-Kontext fehlt.');
  }

  const cachedClientId = isClientPortalScopeId(input.cachedClientId)
    ? input.cachedClientId
    : null;

  return Object.freeze({
    tenantId: input.tenantId,
    accountId: input.accountId,
    clientId: input.linkedClientId,
    roleKey: input.roleKey,
    cachedClientId,
    cachedLinkMatches: cachedClientId === input.linkedClientId,
    source: 'authenticated_portal_link' as const,
  });
}
