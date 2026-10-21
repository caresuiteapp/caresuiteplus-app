import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { resolveAcademyFamilyIdentity } from './academyFamilyIdentity.ts';

export type PortalAuthLinkTable =
  | 'client_portal_access'
  | 'employee_portal_accounts'
  | 'relative_portal_codes'
  | 'client_portal_codes';

export type EnsurePortalAuthInput = {
  portalType: 'client' | 'employee' | 'relative' | 'academy_family';
  accountId: string;
  tenantId: string;
  roleKey: string;
  displayName: string;
  linkTable: PortalAuthLinkTable;
  linkRowId: string;
  clientFirstName?: string | null;
  clientLastName?: string | null;
  relativeContactId?: string;
  accessGeneration?: number;
};

export type PortalAuthSessionResult =
  | {
      ok: true;
      authUserId: string;
      accessToken: string;
      refreshToken: string;
      expiresAt: number | null;
    }
  | { ok: false; error: string };

type AuthAdminUser = {
  id: string;
  email?: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
};

function portalAuthEmail(portalType: string, accountId: string, accessGeneration?: number): string {
  // GoTrue refresh tokens belong to an Auth user, not to our opaque portal
  // session. Never upgrade the metadata of an older family generation: its
  // outstanding refresh tokens must retain their old subject and claims.
  if (portalType === 'academy_family') return `portal.${portalType}.${accountId}.g${accessGeneration}@caresuite-portal.local`;
  return `portal.${portalType}.${accountId}@caresuite-portal.local`;
}

function scopedMetadata(input: EnsurePortalAuthInput) {
  return input.portalType === 'academy_family'
    ? { access_scope: 'academy', relative_contact_id: input.relativeContactId, academy_access_generation: input.accessGeneration }
    : {};
}

function matchesFamilyAuthIdentity(user: AuthAdminUser, input: EnsurePortalAuthInput): boolean {
  const metadata = user.app_metadata;
  return metadata?.portal_type === 'academy_family' && metadata?.role_key === 'family_portal' &&
    metadata?.tenant_id === input.tenantId && metadata?.portal_account_id === input.accountId &&
    metadata?.access_scope === 'academy' && metadata?.relative_contact_id === input.relativeContactId &&
    metadata?.academy_access_generation === input.accessGeneration;
}

async function findAuthUserByEmail(
  supabase: SupabaseClient,
  email: string,
): Promise<AuthAdminUser | null> {
  const normalized = email.toLowerCase();
  let page = 1;
  const perPage = 200;

  while (page <= 10) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      console.warn(`[portalAuth] listUsers failed: ${error.message}`);
      return null;
    }

    const match = data.users.find((user) => user.email?.toLowerCase() === normalized);
    if (match) {
      return {
        id: match.id,
        email: match.email,
        app_metadata: match.app_metadata as Record<string, unknown>,
        user_metadata: match.user_metadata as Record<string, unknown>,
      };
    }

    if (data.users.length < perPage) break;
    page += 1;
  }

  return null;
}

async function resolveAuthUserId(
  supabase: SupabaseClient,
  input: EnsurePortalAuthInput,
  email: string,
): Promise<{ authUserId: string | null; error: string | null }> {
  const { data: linkRow, error: linkError } = await supabase
    .from(input.linkTable)
    .select('auth_user_id')
    .eq('id', input.linkRowId)
    .maybeSingle();

  if (linkError) {
    return { authUserId: null, error: linkError.message };
  }

  if (linkRow?.auth_user_id) {
    const linkedAuthUserId = linkRow.auth_user_id as string;
    const { data: linkedUser, error: linkedUserError } =
      await supabase.auth.admin.getUserById(linkedAuthUserId);
    const linkedEmail = linkedUser?.user?.email?.trim().toLowerCase() ?? '';

    if (!linkedUserError && linkedEmail === email.toLowerCase()) {
      if (input.portalType === 'academy_family' && (!linkedUser.user || !matchesFamilyAuthIdentity(linkedUser.user, input))) {
        return { authUserId: null, error: 'Die gespeicherte Auth-Identität passt nicht zu diesem persönlichen Akademiezugang.' };
      }
      return { authUserId: linkedAuthUserId, error: null };
    }

    // Altbestände konnten ein Portal-Konto mit einem normalen Business-Auth-
    // Benutzer verknüpfen. Anschließend wurde zwar für die synthetische Portal-
    // E-Mail eine Sitzung erzeugt, die RLS-Verknüpfung zeigte aber weiterhin auf
    // den anderen Benutzer. Dadurch waren Lesen aus Cache möglich, alle echten
    // Einsatz- und Nachrichten-Schreibvorgänge jedoch gesperrt. Ein Portal erhält
    // deshalb immer seine eigene, eindeutig zur Portal-E-Mail gehörende Auth-ID.
    if (input.portalType !== 'academy_family') {
      console.warn(`[portalAuth] replacing mismatched auth link for ${input.portalType}/${input.accountId}`);
    }
  }

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    app_metadata: {
      tenant_id: input.tenantId,
      role_key: input.roleKey,
      portal_type: input.portalType,
      portal_account_id: input.accountId,
      ...scopedMetadata(input),
    },
    user_metadata: {
      display_name: input.displayName,
    },
  });

  if (created?.user) {
    return { authUserId: created.user.id, error: null };
  }

  const createMessage = createError?.message ?? '';
  const alreadyExists =
    createMessage.toLowerCase().includes('already been registered') ||
    createMessage.toLowerCase().includes('already registered');

  if (!alreadyExists) {
    return { authUserId: null, error: createMessage || 'Auth-Benutzer konnte nicht angelegt werden.' };
  }

  const existing = await findAuthUserByEmail(supabase, email);
  if (!existing) {
    return { authUserId: null, error: 'Portal-Auth-Benutzer konnte nicht verknüpft werden.' };
  }
  if (input.portalType === 'academy_family') {
    if (!matchesFamilyAuthIdentity(existing, input)) {
      return { authUserId: null, error: 'Der persönliche Akademiezugang ist mit einer abweichenden Auth-Identität belegt.' };
    }
    return { authUserId: existing.id, error: null };
  }

  const { data: updated, error: updateError } = await supabase.auth.admin.updateUserById(existing.id, {
    email_confirm: true,
    app_metadata: {
      ...existing.app_metadata,
      tenant_id: input.tenantId,
      role_key: input.roleKey,
      portal_type: input.portalType,
      portal_account_id: input.accountId,
      ...scopedMetadata(input),
    },
    user_metadata: {
      ...existing.user_metadata,
      display_name: input.displayName,
    },
  });

  if (updateError || !updated?.user) {
    return {
      authUserId: null,
      error: updateError?.message ?? 'Portal-Auth-Benutzer konnte nicht aktualisiert werden.',
    };
  }

  return { authUserId: updated.user.id, error: null };
}

async function refreshPortalAuthMetadata(
  supabase: SupabaseClient,
  authUserId: string,
  input: EnsurePortalAuthInput,
): Promise<string | null> {
  const { data, error: lookupError } = await supabase.auth.admin.getUserById(authUserId);
  if (lookupError || !data.user) {
    return lookupError?.message ?? 'Portal-Auth-Benutzer konnte nicht geladen werden.';
  }
  if (input.portalType === 'academy_family' && !matchesFamilyAuthIdentity(data.user, input)) {
    return 'Die persönliche Auth-Identität wurde geändert. Bitte erneut anmelden.';
  }

  const { error: updateError } = await supabase.auth.admin.updateUserById(authUserId, {
    app_metadata: {
      ...data.user.app_metadata,
      tenant_id: input.tenantId,
      role_key: input.roleKey,
      portal_type: input.portalType,
      portal_account_id: input.accountId,
      ...scopedMetadata(input),
    },
    user_metadata: {
      ...data.user.user_metadata,
      display_name: input.displayName,
    },
  });

  return updateError?.message ?? null;
}

async function resolveRoleId(
  supabase: SupabaseClient,
  roleKey: string,
): Promise<string | null> {
  const { data, error } = await supabase.from('roles').select('id').eq('key', roleKey).maybeSingle();
  if (error || !data?.id) {
    return null;
  }
  return data.id as string;
}

async function upsertPortalProfile(
  supabase: SupabaseClient,
  input: EnsurePortalAuthInput,
  authUserId: string,
  email: string,
): Promise<string | null> {
  const now = new Date().toISOString();
  const firstName = input.clientFirstName?.trim() || null;
  const lastName = input.clientLastName?.trim() || null;
  const roleId = await resolveRoleId(supabase, input.roleKey);

  const { data: existing, error: lookupError } = await supabase
    .from('profiles')
    .select('id')
    .eq('auth_user_id', authUserId)
    .maybeSingle();

  if (lookupError) {
    return lookupError.message;
  }

  const profilePayload = {
    tenant_id: input.tenantId,
    auth_user_id: authUserId,
    first_name: firstName,
    last_name: lastName,
    email,
    updated_at: now,
    ...(roleId ? { role_id: roleId } : {}),
  };

  if (existing?.id) {
    const { error } = await supabase.from('profiles').update(profilePayload).eq('id', existing.id);
    return error?.message ?? null;
  }

  const { error } = await supabase.from('profiles').upsert(
    {
      id: authUserId,
      ...profilePayload,
    },
    { onConflict: 'id' },
  );

  return error?.message ?? null;
}

async function createPortalSession(
  supabase: SupabaseClient,
  email: string,
): Promise<{ accessToken: string; refreshToken: string; expiresAt: number | null } | { error: string }> {
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });

  if (linkError || !linkData?.properties?.hashed_token) {
    return { error: linkError?.message ?? 'Supabase-Session konnte nicht erstellt werden.' };
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: 'email',
  });

  if (sessionError || !sessionData.session) {
    return { error: sessionError?.message ?? 'Supabase-Session-Verifikation fehlgeschlagen.' };
  }

  return {
    accessToken: sessionData.session.access_token,
    refreshToken: sessionData.session.refresh_token,
    expiresAt: sessionData.session.expires_at ?? null,
  };
}

/** Links portal account to Supabase Auth, upserts profile, returns session tokens for client setSession. */
export async function ensurePortalSupabaseAuth(
  supabase: SupabaseClient,
  input: EnsurePortalAuthInput,
): Promise<PortalAuthSessionResult> {
  if (input.linkTable === 'client_portal_access') {
    const { data: account, error } = await supabase.from('client_portal_access')
      .select('*').eq('id', input.linkRowId).eq('tenant_id', input.tenantId).maybeSingle();
    if (error || !account || !account.portal_enabled || account.status !== 'aktiv' ||
        (account.account_kind === 'academy_family') !== (input.portalType === 'academy_family')) {
      return { ok: false, error: 'Portalkonto ist nicht aktiv oder passt nicht zur angeforderten Kontoart.' };
    }
  }
  if (input.portalType === 'academy_family') {
    if (input.roleKey !== 'family_portal' || input.linkTable !== 'client_portal_access' ||
        input.linkRowId !== input.accountId || !input.relativeContactId) {
      return { ok: false, error: 'Akademiezugang ist nicht gültig verknüpft.' };
    }
    const identity = await resolveAcademyFamilyIdentity(supabase, input.accountId, input.tenantId, input.relativeContactId);
    if (!identity || identity.accessGeneration !== input.accessGeneration) return { ok: false, error: 'Akademiezugang ist nicht aktiv oder wurde inzwischen geändert.' };
    input = { ...input, displayName: identity.displayName, clientFirstName: identity.firstName, clientLastName: identity.lastName };
  }
  const email = portalAuthEmail(input.portalType, input.accountId, input.accessGeneration);

  const resolved = await resolveAuthUserId(supabase, input, email);
  if (!resolved.authUserId) {
    return { ok: false, error: resolved.error ?? 'Auth-Benutzer konnte nicht aufgelöst werden.' };
  }

  const authUserId = resolved.authUserId;
  const now = new Date().toISOString();

  // Existing linked portal users used to skip metadata refresh. Their JWT could
  // therefore keep an old tenant/role and every subsequent RLS check failed.
  const metadataError = await refreshPortalAuthMetadata(supabase, authUserId, input);
  if (metadataError) {
    return { ok: false, error: metadataError };
  }

  const { error: linkUpdateError } = await supabase
    .from(input.linkTable)
    .update({ auth_user_id: authUserId, updated_at: now })
    .eq('id', input.linkRowId);

  if (linkUpdateError) {
    return { ok: false, error: linkUpdateError.message };
  }

  const profileError = await upsertPortalProfile(supabase, input, authUserId, email);
  if (profileError) {
    console.warn(`[portalAuth] profile upsert skipped: ${profileError}`);
  }

  const session = await createPortalSession(supabase, email);
  if ('error' in session) {
    return { ok: false, error: session.error };
  }

  return {
    ok: true,
    authUserId,
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    expiresAt: session.expiresAt,
  };
}
