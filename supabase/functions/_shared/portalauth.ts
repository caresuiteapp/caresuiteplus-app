import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export type PortalAuthLinkTable =
  | 'client_portal_access'
  | 'employee_portal_accounts'
  | 'relative_portal_codes'
  | 'client_portal_codes';

export type EnsurePortalAuthInput = {
  portalType: 'client' | 'employee' | 'relative';
  accountId: string;
  tenantId: string;
  roleKey: string;
  displayName: string;
  linkTable: PortalAuthLinkTable;
  linkRowId: string;
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

function portalAuthEmail(portalType: string, accountId: string): string {
  return `portal.${portalType}.${accountId}@caresuite-portal.local`;
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
    return { authUserId: linkRow.auth_user_id as string, error: null };
  }

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    app_metadata: {
      tenant_id: input.tenantId,
      role_key: input.roleKey,
      portal_type: input.portalType,
      portal_account_id: input.accountId,
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

  const { data: updated, error: updateError } = await supabase.auth.admin.updateUserById(existing.id, {
    email_confirm: true,
    app_metadata: {
      ...existing.app_metadata,
      tenant_id: input.tenantId,
      role_key: input.roleKey,
      portal_type: input.portalType,
      portal_account_id: input.accountId,
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

async function upsertPortalProfile(
  supabase: SupabaseClient,
  input: EnsurePortalAuthInput,
  authUserId: string,
  email: string,
): Promise<string | null> {
  const now = new Date().toISOString();
  const { error } = await supabase.from('profiles').upsert(
    {
      id: authUserId,
      auth_user_id: authUserId,
      tenant_id: input.tenantId,
      role_key: input.roleKey,
      display_name: input.displayName,
      email,
      updated_at: now,
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
  const email = portalAuthEmail(input.portalType, input.accountId);

  const resolved = await resolveAuthUserId(supabase, input, email);
  if (!resolved.authUserId) {
    return { ok: false, error: resolved.error ?? 'Auth-Benutzer konnte nicht aufgelöst werden.' };
  }

  const authUserId = resolved.authUserId;
  const now = new Date().toISOString();

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
