import type { Session } from '@supabase/supabase-js';
import type { AuthSession, AuthUser, Profile, RoleKey } from '@/types/core/auth';
import type { AuthBootstrapResult, TenantSummary } from '@/types/supabase/session';
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
  role_key: string | null;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
  roles: { key: string } | null;
};

function parseRoleKey(value: string | null): RoleKey | null {
  if (!value) return null;
  return ROLE_KEYS.includes(value as RoleKey) ? (value as RoleKey) : null;
}

function mapProfileQueryRow(row: ProfileQueryRow): Profile {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    roleId: row.role_id,
    roleKey: parseRoleKey(row.roles?.key ?? row.role_key),
    displayName: row.display_name?.trim() || null,
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
  'id, tenant_id, role_id, role_key, display_name, email, phone, avatar_url, created_at, updated_at, roles(key)';

export async function fetchTenantProfile(userId: string): Promise<Profile | null> {
  if (isDemoMode()) {
    return null;
  }

  const client = getSupabaseClient();
  if (!client) {
    return null;
  }

  const { data, error } = await client
    .from('profiles')
    .select(PROFILE_SELECT)
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return mapProfileQueryRow(data as unknown as ProfileQueryRow);
}

async function fetchTenantSummary(tenantId: string): Promise<TenantSummary | null> {
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

  const { data, error } = await client
    .from('profiles')
    .select(PROFILE_SELECT)
    .eq('id', supabaseSession.user.id)
    .maybeSingle();

  if (error) {
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  if (!data) {
    return { ok: false, error: 'Benutzerprofil wurde nicht gefunden.' };
  }

  const profile = mapProfileQueryRow(data as unknown as ProfileQueryRow);
  const user = buildAuthUser(supabaseSession, profile);
  const session = buildAuthSession(supabaseSession, user);
  const tenant = profile.tenantId ? await fetchTenantSummary(profile.tenantId) : null;

  return { ok: true, user, profile, session, tenant };
}
