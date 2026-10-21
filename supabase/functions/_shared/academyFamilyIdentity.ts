/** Only the service-role RPC can authorize this narrowly scoped portal identity. */
export type AcademyFamilyIdentity = {
  accountId: string; tenantId: string; contactId: string; clientId: string;
  firstName: string | null; lastName: string | null; displayName: string; username: string;
  accessGeneration: number;
};
type IdentityClient = { rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }> };

export async function resolveAcademyFamilyIdentity(
  client: IdentityClient, accountId: string, tenantId: string, contactId: string,
): Promise<AcademyFamilyIdentity | null> {
  if (!accountId || !tenantId || !contactId) return null;
  const { data, error } = await client.rpc('academy_family_auth_identity', {
    p_account: accountId, p_tenant: tenantId, p_contact: contactId,
  });
  if (error || !data || typeof data !== 'object' || Array.isArray(data)) return null;
  const value = data as Record<string, unknown>;
  if (value.accountId !== accountId || value.tenantId !== tenantId || value.contactId !== contactId ||
      typeof value.clientId !== 'string' || !value.clientId || typeof value.displayName !== 'string' ||
      !value.displayName.trim() || typeof value.username !== 'string' || !value.username ||
      typeof value.accessGeneration !== 'number' || !Number.isSafeInteger(value.accessGeneration) || value.accessGeneration < 1) return null;
  return {
    accountId, tenantId, contactId, clientId: value.clientId,
    firstName: typeof value.firstName === 'string' ? value.firstName : null,
    lastName: typeof value.lastName === 'string' ? value.lastName : null,
    displayName: value.displayName, username: value.username,
    accessGeneration: value.accessGeneration,
  };
}
