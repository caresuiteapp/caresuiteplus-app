import { validateRegistrationBody } from '../_shared/companyRegistrationValidation.ts';
export { validateRegistrationBody } from '../_shared/companyRegistrationValidation.ts';
import { normalizeCompanyRegistrationSelection } from '../_shared/companyRegistrationCatalog.ts';

function usesCompanyCatalog(body: Record<string, unknown>): boolean {
  return body.registrationCatalogVersion != null || body.legalFormKey != null || body.industryKey != null;
}

type RegistrationError = { code?: string; message?: string };
type RegistrationResult<T> = { data: T; error: RegistrationError | null };
type RegistrationLookup = {
  eq(column: string, value: string): RegistrationLookup;
  maybeSingle(): PromiseLike<RegistrationResult<Record<string, unknown> | null>>;
};
// Structural boundary keeps provisioning testable without a Deno runtime or SDK import.
export type RegistrationClient = {
  auth: { admin: {
    createUser(input: { email: string; password: string; email_confirm: boolean; user_metadata: Record<string,string> }): PromiseLike<RegistrationResult<{ user: { id: string } | null }>>;
    deleteUser(id: string): PromiseLike<{ error: RegistrationError | null }>;
  } };
  rpc(name: string, args: Record<string,unknown>): PromiseLike<RegistrationResult<{ ok?: boolean; [key: string]: unknown } | null>>;
  from(table: string): { select(columns: string): RegistrationLookup };
};


export async function provisionBusinessRegistration(client: RegistrationClient, body: Record<string, unknown>,
  options: { verifyExistingIdentity?: (email: string, password: string) => Promise<string | null> } = {}) {
  const validation = validateRegistrationBody(body);
  if (validation) return { status: 400, body: { ok: false, error: validation } };
  body = { ...body, ...normalizeCompanyRegistrationSelection({ legalForm: body.legalForm as string, industry: body.industry as string }) };
  const email = (body.adminEmail as string).trim().toLowerCase();
  const { data, error } = await client.auth.admin.createUser({
    email,
    password: body.adminPassword as string,
    email_confirm: true,
    user_metadata: { display_name: `${(body.adminFirstName as string).trim()} ${(body.adminLastName as string).trim()}` },
  });
  let authUserId = !error && typeof data?.user?.id === 'string' && data.user.id ? data.user.id : undefined;
  const createdIdentity = !error && Boolean(authUserId);
  if (!createdIdentity && error && (['email_exists', 'user_already_exists'].includes(error.code ?? '') || /already.*(registered|exists)/i.test(error.message ?? ''))) {
    authUserId = await options.verifyExistingIdentity?.(email, body.adminPassword as string) ?? undefined;
  }
  if (!authUserId) {
    return { status: 409, body: { ok: false, error: 'Das Administrationskonto konnte nicht erstellt werden. Falls die E-Mail bereits registriert ist, nutzen Sie bitte die Anmeldung oder „Passwort vergessen“.' } };
  }
  // Do not persist the password or accept client-selected entitlements.
  const { adminPassword: _password, selectedModules: _modules, ...workspace } = body;
  const args = { p_auth_user_id: authUserId, p_data: { ...workspace, adminEmail: email } };
  let uncertainTransport = false;
  const attempt = async () => {
    try {
      const response = await client.rpc('register_business_workspace', args);
      if (response.error && !/^[0-9A-Z]{5}$/.test(response.error.code ?? '')) uncertainTransport = true;
      return response;
    } catch {
      uncertainTransport = true;
      return { data: null, error: { code: 'TRANSPORT', message: 'Unconfirmed registration response' } };
    }
  };
  let result = await attempt();
  if (result.error) result = await attempt();
  if (!result.error && result.data?.ok === true) return { status: 201, body: result.data };

  // A lost transport response is not proof that the transaction rolled back.
  // Confirm that there is no workspace before removing only this new auth user.
  const owner = await client.from('tenant_users').select('id,tenant_id,username,email,role_key,display_name').eq('auth_user_id',authUserId).eq('role_key','owner').eq('status','active').maybeSingle();
  if (!owner.error && owner.data) {
    const row = owner.data;
    if (typeof row.id !== 'string' || typeof row.tenant_id !== 'string' || row.email !== email || row.role_key !== 'owner') {
      return { status: 503, body: { ok: false, error: 'Die Einrichtung konnte nicht bestätigt werden. Bitte prüfen Sie die Anmeldung oder wenden Sie sich an den Support.' } };
    }
    // An owner row alone cannot prove a working registration after a lost response.
    const profile = await client.from('profiles').select('tenant_id,role_id,status,is_active').eq('auth_user_id',authUserId).eq('tenant_id',row.tenant_id).maybeSingle();
    if (profile.error || profile.data?.tenant_id !== row.tenant_id || profile.data.status !== 'active' || profile.data.is_active !== true || typeof profile.data.role_id !== 'string') {
      return { status: 503, body: { ok: false, error: 'Die Einrichtung konnte nicht vollständig bestätigt werden. Bitte wenden Sie sich an den Support.' } };
    }
    const role = await client.from('roles').select('key,tenant_id').eq('id',profile.data.role_id).eq('tenant_id',row.tenant_id).maybeSingle();
    if (role.error || role.data?.key !== 'owner' || role.data.tenant_id !== row.tenant_id) {
      return { status: 503, body: { ok: false, error: 'Die Administrationsrolle konnte nicht bestätigt werden. Bitte wenden Sie sich an den Support.' } };
    }
    let welcomeEmailQueued = false;
    try {
      const welcome = row.id ? await client.from('registration_welcome_outbox').select('state').eq('tenant_user_id',row.id).maybeSingle() : null;
      welcomeEmailQueued = !welcome?.error && typeof welcome?.data?.state === 'string' && ['pending','sending','sent'].includes(welcome.data.state);
    } catch {
      // The workspace is already confirmed; a mail-status lookup cannot undo it.
    }
    return { status: 201, body: { ok: true, tenantId: row.tenant_id, owner: { id: row.id, tenantId: row.tenant_id, username: row.username, email: row.email, roleKey: row.role_key, displayName: row.display_name }, credentials: { username: row.username }, welcomeEmailQueued } };
  }
  if (createdIdentity && !uncertainTransport && !owner.error && !owner.data) {
    const profile = await client.from('profiles').select('tenant_id').eq('auth_user_id',authUserId).maybeSingle();
    if (!profile.error && !profile.data?.tenant_id) {
      const cleanup = await client.auth.admin.deleteUser(authUserId);
      if (!cleanup.error) return { status: 503, body: { ok: false, error: 'Das Unternehmen konnte nicht vollständig eingerichtet werden. Es wurde kein Unternehmen angelegt; bitte versuchen Sie es später erneut.' } };
    }
  }
  return { status: 503, body: { ok: false, error: 'Die Einrichtung konnte nicht bestätigt werden. Bitte prüfen Sie zuerst die Anmeldung mit Ihrer E-Mail-Adresse und wenden Sie sich bei Bedarf an den Support.' } };
}
