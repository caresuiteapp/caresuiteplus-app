import type { PostgrestError, Session } from '@supabase/supabase-js';
import type { AuthSession, AuthUser, Profile, RoleKey } from '@/types/core/auth';
import type { AuthBootstrapResult, TenantSummary } from '@/types/supabase/session';
import { mapCanonicalRoleToRoleKey } from '@/lib/permissions/workspaceRoles';
import type { CanonicalWorkspaceRoleKey } from '@/types/permissions/workspace';
import { getSupabaseClient } from './client';
import { isDemoMode } from './config';
import { toGermanSupabaseError } from './errors';

const ROLE_KEYS: readonly RoleKey[] = [
  'business_admin',
  'business_manager',
  'billing',
  'dispatch',
  'nurse',
  'caregiver',
  'counselor',
  'akademie_admin',
  'employee_portal',
  'client_portal',
  'family_portal',
];

type ProfileQueryRow = {
  id: string;
  tenant_id: string | null;
  role_id: string | null;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
  roles: { key: string } | null;
};

function parseRoleKey(value: string | null): RoleKey | null {
  if (!value) return null;
  if (ROLE_KEYS.includes(value as RoleKey)) {
    return value as RoleKey;
  }
  return mapCanonicalRoleToRoleKey(value as CanonicalWorkspaceRoleKey);
}

function readSessionRoleHint(session: Session): string | null {
  const appRole = session.user.app_metadata?.role_key;
  if (typeof appRole === 'string' && appRole.trim()) {
    return appRole.trim();
  }

  const userRole = session.user.user_metadata?.role_key;
  if (typeof userRole === 'string' && userRole.trim()) {
    return userRole.trim();
  }

  return null;
}

function resolveDisplayName(row: ProfileQueryRow): string | null {
  const fullName = row.full_name?.trim();
  if (fullName) return fullName;

  const composed = [row.first_name?.trim(), row.last_name?.trim()].filter(Boolean).join(' ');
  return composed || null;
}

async function fetchRoleKeyById(
  client: NonNullable<ReturnType<typeof getSupabaseClient>>,
  roleId: string | null,
): Promise<string | null> {
  if (!roleId) return null;

  const { data, error } = await client.from('roles').select('key').eq('id', roleId).maybeSingle();
  if (error || !data?.key) {
    return null;
  }

  return data.key;
}

async function resolveProfileRoleKey(
  client: NonNullable<ReturnType<typeof getSupabaseClient>>,
  row: ProfileQueryRow,
  session: Session,
): Promise<RoleKey | null> {
  const fromJoin = parseRoleKey(row.roles?.key ?? null);
  if (fromJoin) return fromJoin;

  const fromRoleId = parseRoleKey(await fetchRoleKeyById(client, row.role_id));
  if (fromRoleId) return fromRoleId;

  return parseRoleKey(readSessionRoleHint(session));
}

function mapProfileQueryRow(row: ProfileQueryRow, roleKey: RoleKey | null): Profile {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    roleId: row.role_id,
    roleKey,
    displayName: resolveDisplayName(row),
    email: row.email,
    phone: row.phone,
    avatarUrl: row.avatar_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function buildAuthUser(session: Session, profile: Profile): AuthUser {
  return {
    id: session.user.id,
    email: session.user.email ?? profile.email ?? '',
    displayName: profile.displayName,
    roleKey: profile.roleKey,
  };
}

function buildAuthSession(session: Session, user: AuthUser): AuthSession {
  return {
    user,
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: session.expires_at ? session.expires_at * 1000 : null,
  };
}

const PROFILE_SELECT =
  'id, tenant_id, role_id, first_name, last_name, full_name, email, phone, avatar_url, created_at, updated_at, roles(key)';

async function queryProfileForAuthUser(
  client: NonNullable<ReturnType<typeof getSupabaseClient>>,
  authUserId: string,
): Promise<{ data: ProfileQueryRow | null; error: PostgrestError | null }> {
  const byAuthUserId = await client
    .from('profiles')
    .select(PROFILE_SELECT)
    .eq('auth_user_id', authUserId)
    .maybeSingle();

  if (byAuthUserId.error) {
    return { data: null, error: byAuthUserId.error };
  }
  if (byAuthUserId.data) {
    return { data: byAuthUserId.data as unknown as ProfileQueryRow, error: null };
  }

  const legacy = await client
    .from('profiles')
    .select(PROFILE_SELECT)
    .eq('id', authUserId)
    .maybeSingle();

  if (legacy.error) {
    return { data: null, error: legacy.error };
  }

  return {
    data: legacy.data ? (legacy.data as unknown as ProfileQueryRow) : null,
    error: null,
  };
}

export async function fetchTenantProfile(userId: string): Promise<Profile | null> {
  if (isDemoMode()) {
    return null;
  }

  const client = getSupabaseClient();
  if (!client) {
    return null;
  }

  const { data, error } = await queryProfileForAuthUser(client, userId);

  if (error || !data) {
    return null;
  }

  const roleKey =
    parseRoleKey(data.roles?.key ?? null) ??
    parseRoleKey(await fetchRoleKeyById(client, data.role_id));

  return mapProfileQueryRow(data, roleKey);
}

export async function fetchTenantSummaryById(tenantId: string): Promise<TenantSummary | null> {
  const client = getSupabaseClient();
  if (!client) {
    return null;
  }

  const { data, error } = await client
    .from('tenants')
    .select('id, name')
    .eq('id', tenantId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return { id: data.id, name: data.name };
}

export async function bootstrapTenantContext(
  supabaseSession: Session,
): Promise<AuthBootstrapResult> {
  if (isDemoMode()) {
    return { ok: false, error: 'Mandantenkontext im Demo-Modus nicht über Supabase verfügbar.' };
  }

  const client = getSupabaseClient();
  if (!client) {
    return { ok: false, error: 'Supabase ist nicht konfiguriert.' };
  }

  const { data, error } = await queryProfileForAuthUser(client, supabaseSession.user.id);

  if (error) {
    return { ok: false, error: toGermanSupabaseError(error as PostgrestError) };
  }

  if (!data) {
    return { ok: false, error: 'Benutzerprofil wurde nicht gefunden.' };
  }

  const roleKey = await resolveProfileRoleKey(
    client,
    data as unknown as ProfileQueryRow,
    supabaseSession,
  );
  if (!roleKey) {
    return { ok: false, error: 'Benutzerrolle konnte nicht geladen werden.' };
  }

  const profile = mapProfileQueryRow(data as unknown as ProfileQueryRow, roleKey);
  const user = buildAuthUser(supabaseSession, profile);
  const session = buildAuthSession(supabaseSession, user);
  const tenant = profile.tenantId ? await fetchTenantSummaryById(profile.tenantId) : null;

  return { ok: true, user, profile, session, tenant };
}
