type RegistrationError = { code?: string; message?: string };
type RegistrationResult<T> = { data: T; error: RegistrationError | null };
type RegistrationLookup = {
  eq(column: string, value: string): RegistrationLookup;
  maybeSingle(): PromiseLike<RegistrationResult<Record<string, string | null> | null>>;
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

export function validateRegistrationBody(body: Record<string, unknown>): string | null {
  if (!body || Array.isArray(body) || typeof body !== 'object') return 'Ungültige Registrierungsdaten.';
  for (const key of ['companyName','legalForm','industry','street','zip','city','phone','email','adminFirstName','adminLastName','adminEmail']) {
    if (typeof body[key] !== 'string' || !(body[key] as string).trim() || (body[key] as string).length > 200) {
      return 'Bitte Unternehmensdaten, Anschrift und Administrationskonto vollständig ausfüllen (höchstens 200 Zeichen je Feld).';
    }
  }
  if (!['email','adminEmail'].every(key => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((body[key] as string).trim()))) return 'Bitte gültige E-Mail-Adressen eingeben.';
  if (typeof body.adminPassword !== 'string' || body.adminPassword.length < 10 || body.adminPassword.length > 128) return 'Das Passwort muss 10 bis 128 Zeichen lang sein.';
  if (body.termsAccepted !== true) return 'Bitte Datenschutz, Nutzungsbedingungen und Ihre Registrierungsberechtigung bestätigen.';
  for (const key of ['website','ikNumber','taxNumber','vatId','adminPhone','contactFirstName','contactLastName','contactRole']) {
    if (body[key] != null && (typeof body[key] !== 'string' || (body[key] as string).length > 200)) return 'Bitte die optionalen Angaben prüfen.';
  }
  const website = (body.website as string | undefined | null)?.trim();
  if (website && !/^https?:\/\/[^\s]+$/i.test(website)) return 'Die Website muss mit https:// oder http:// beginnen.';
  return null;
}

export async function provisionBusinessRegistration(client: RegistrationClient, body: Record<string, unknown>) {
  const email = (body.adminEmail as string).trim().toLowerCase();
  const { data, error } = await client.auth.admin.createUser({
    email,
    password: body.adminPassword as string,
    email_confirm: true,
    user_metadata: { display_name: `${(body.adminFirstName as string).trim()} ${(body.adminLastName as string).trim()}` },
  });
  if (error || !data.user) {
    return { status: 409, body: { ok: false, error: 'Das Administrationskonto konnte nicht erstellt werden. Falls die E-Mail bereits registriert ist, nutzen Sie bitte die Anmeldung oder „Passwort vergessen“.' } };
  }
  // Do not persist the password or accept client-selected entitlements.
  const { adminPassword: _password, selectedModules: _modules, ...workspace } = body;
  const args = { p_auth_user_id: data.user.id, p_data: { ...workspace, adminEmail: email } };
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
  const owner = await client.from('tenant_users').select('id,tenant_id,username,email,role_key,display_name').eq('auth_user_id',data.user.id).eq('role_key','owner').maybeSingle();
  if (!owner.error && owner.data) {
    const row = owner.data;
    return { status: 201, body: { ok: true, tenantId: row.tenant_id, owner: { id: row.id, tenantId: row.tenant_id, username: row.username, email: row.email, roleKey: row.role_key, displayName: row.display_name }, credentials: { username: row.username } } };
  }
  if (!uncertainTransport && !owner.error && !owner.data) {
    const profile = await client.from('profiles').select('tenant_id').eq('auth_user_id',data.user.id).maybeSingle();
    if (!profile.error && !profile.data?.tenant_id) {
      const cleanup = await client.auth.admin.deleteUser(data.user.id);
      if (!cleanup.error) return { status: 503, body: { ok: false, error: 'Das Unternehmen konnte nicht vollständig eingerichtet werden. Es wurde kein Unternehmen angelegt; bitte versuchen Sie es später erneut.' } };
    }
  }
  return { status: 503, body: { ok: false, error: 'Die Einrichtung konnte nicht bestätigt werden. Bitte prüfen Sie zuerst die Anmeldung mit Ihrer E-Mail-Adresse und wenden Sie sich bei Bedarf an den Support.' } };
}
