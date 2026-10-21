import { getSupabaseClient } from '@/lib/supabase/client';
import { hashPortalCode, pickUniquePortalCode } from '@/lib/auth/portalCodeGenerator';
import { pickUniqueClientPortalUsername } from '@/lib/auth/clientPortalUsernameGenerator';
import type { ClientPortalCredentialsReveal } from '@/types/modules/client';

export type AcademyFamilyAccess = {
  id: string; tenantId: string; clientId: string; contactId: string | null;
  username: string; enabled: boolean; status: string; lastLoginAt: string | null;
};
type Rpc = { rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }> };
function record(value: unknown): AcademyFamilyAccess {
  const row = value as Record<string, unknown> | null;
  if (!row || typeof row.id !== 'string' || typeof row.tenant_id !== 'string' || typeof row.client_id !== 'string' ||
      row.account_kind !== 'academy_family' || row.access_scope !== 'academy' || typeof row.portal_username !== 'string') {
    throw new Error('Der Server hat keinen gültigen Akademiezugang bestätigt. Bitte den Stand erneut laden.');
  }
  return { id: row.id, tenantId: row.tenant_id, clientId: row.client_id,
    contactId: typeof row.contact_id === 'string' ? row.contact_id : null,
    username: row.portal_username, enabled: row.portal_enabled === true, status: String(row.status),
    lastLoginAt: typeof row.last_login_at === 'string' ? row.last_login_at : null };
}
async function call(args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const client = getSupabaseClient();
  if (!client) throw new Error('Die Verbindung ist nicht eingerichtet.');
  const { data, error } = await (client as unknown as Rpc).rpc('academy_family_access_manage', args);
  if (error) {
    if (['42883', '42P01', 'PGRST202'].includes(error.code ?? '')) throw new Error('Die sichere Angehörigenanmeldung ist auf diesem Server noch nicht eingerichtet.');
    if (error.code === '42501') throw new Error('Dieser Zugang darf noch nicht eingerichtet werden oder die erforderliche Berechtigung fehlt.');
    if (error.code === '23505') throw new Error('Der Zugang besteht bereits oder der Benutzername ist vergeben. Bitte neu laden.');
    throw new Error('Der Vorgang konnte nicht bestätigt werden. Bitte den gespeicherten Stand erneut laden.');
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Der Server hat keinen gültigen Stand bestätigt.');
  return data as Record<string, unknown>;
}
export async function listAcademyFamilyAccess(tenantId: string, clientId: string): Promise<{ accesses: AcademyFamilyAccess[]; ready: boolean }> {
  const data = await call({ p_tenant: tenantId, p_client: clientId, p_contact: null, p_action: 'list', p_account: null, p_username: null, p_code_hash: null });
  if (!Array.isArray(data.accesses)) throw new Error('Die Zugänge konnten nicht vollständig geladen werden.');
  const rows = data.accesses.map(record);
  if (rows.some(row => row.tenantId !== tenantId || row.clientId !== clientId)) throw new Error('Der angezeigte Zugang gehört nicht zu dieser Klientenakte.');
  return { accesses: rows, ready: data.ready === true };
}
export async function manageAcademyFamilyAccess(input: {
  tenantId: string; clientId: string; contactId: string | null; accountId?: string;
  action: 'setup' | 'rotate' | 'enable' | 'disable'; firstName?: string; lastName?: string;
}): Promise<{ access: AcademyFamilyAccess; credentials: ClientPortalCredentialsReveal | null }> {
  if (input.action !== 'disable' && !input.contactId) throw new Error('Bitte zuerst einen vorhandenen Kontakt auswählen.');
  if (input.action !== 'setup' && !input.accountId) throw new Error('Bitte zuerst einen vorhandenen Zugang auswählen.');
  const code = ['setup', 'rotate'].includes(input.action) ? pickUniquePortalCode([]) : null;
  const username = input.action === 'setup'
    ? `${pickUniqueClientPortalUsername(input.firstName ?? '', input.lastName ?? '', []).slice(0, 11).replace(/[.-]+$/, '')}.${input.contactId!.replaceAll('-', '').slice(0, 8)}` : null;
  const data = await call({ p_tenant: input.tenantId, p_client: input.clientId, p_contact: input.contactId,
    p_action: input.action, p_account: input.accountId ?? null, p_username: username,
    p_code_hash: code ? await hashPortalCode(code) : null });
  const access = record(data.access);
  if (access.tenantId !== input.tenantId || access.clientId !== input.clientId || access.contactId !== input.contactId ||
      (input.accountId && access.id !== input.accountId)) throw new Error('Der bestätigte Zugang passt nicht zur ausgewählten Person. Bitte neu laden.');
  return { access, credentials: code ? { username: access.username, accessCode: code } : null };
}
