import type { PermissionKey } from '@/types/permissions';
import type { CarePermissionOwner } from './carePermissionOwner.web';
import { carePermissionOwnerIsCurrent } from './carePermissionOwner.web';
import { fetchCurrentCarePermissions } from './currentCarePermissions.web';
import { getSupabaseClient } from '@/lib/supabase/client';
import { NATIVE_SERVICE_QUERY_TIMEOUT_MS, withServiceQueryTimeout } from '@/lib/services/queryTimeout';

const failure = () => new Error('Die aktuellen Berechtigungen konnten nicht bestätigt werden.');
const field = (value: Record<string, unknown>, key: string): unknown => Object.getOwnPropertyDescriptor(value, key)?.value;
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const ownerKeys = ['tenantId', 'profileId', 'roleKey', 'accessToken', 'expiresAt', 'demo'] as const;
const roles = new Set(['business_admin', 'business_manager', 'billing', 'dispatch', 'nurse', 'caregiver', 'counselor', 'akademie_admin']);
function object(value: unknown, keys?: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw failure();
  const supplied = Reflect.ownKeys(value);
  if (supplied.some(key => typeof key !== 'string') || (keys && (supplied.length !== keys.length || keys.some(key => !supplied.includes(key))))) throw failure();
  for (const key of supplied) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) throw failure();
  }
  return value as Record<string, unknown>;
}
function captureOwner(owner: CarePermissionOwner): CarePermissionOwner {
  const snapshot = Object.freeze({ ...object(owner, ownerKeys) }) as CarePermissionOwner;
  if (!uuid(snapshot.profileId) || !uuid(snapshot.tenantId) || !roles.has(snapshot.roleKey) || typeof snapshot.demo !== 'boolean' || (snapshot.expiresAt !== null && (!Number.isSafeInteger(snapshot.expiresAt) || snapshot.expiresAt <= Date.now())) || !carePermissionOwnerIsCurrent(snapshot) || (!snapshot.demo && (typeof snapshot.accessToken !== 'string' || !snapshot.accessToken))) throw failure();
  return snapshot;
}

/** Private Web confirmation; database RLS and protected role assignment remain separate server gates. */
export async function fetchConfirmedCarePermissions(owner: CarePermissionOwner, readIsCurrent: () => boolean = () => true): Promise<readonly PermissionKey[]> {
  if (!readIsCurrent()) throw failure();
  const captured = captureOwner(owner);
  if (captured.demo) return fetchCurrentCarePermissions(owner, readIsCurrent);
  const client = getSupabaseClient();
  if (!client) throw failure();
  let closed = false;
  const current = () => {
    const latest = object(owner, ownerKeys);
    if (closed || getSupabaseClient() !== client || !readIsCurrent() || !carePermissionOwnerIsCurrent(captured) || ownerKeys.some(key => latest[key] !== captured[key])) throw failure();
  };
  let authUserId: string | null = null;
  const assertSession = async () => {
    const readSession = async () => {
      current();
      const auth = client.auth, getSession = auth.getSession;
      current();
      if (typeof getSession !== 'function') throw failure();
      const response = object(await getSession.call(auth));
      current();
      if (field(response, 'error') !== null) throw failure();
      const native = object(field(object(field(response, 'data')), 'session')), user = object(field(native, 'user'));
      const userId = field(user, 'id');
      if (!uuid(userId) || authUserId !== null && userId !== authUserId || field(native, 'access_token') !== captured.accessToken) throw failure();
      const expires = field(native, 'expires_at');
      if (expires === undefined || expires === null) {
        if (captured.expiresAt !== null) throw failure();
      } else {
        const milliseconds = typeof expires === 'number' ? expires * 1000 : NaN;
        if (!Number.isSafeInteger(expires) || !Number.isSafeInteger(milliseconds) || milliseconds <= Date.now() || milliseconds !== captured.expiresAt) throw failure();
      }
      authUserId = userId;
      current();
    };
    await readSession();
    current();
    const auth = client.auth, getUser = auth.getUser;
    current();
    if (typeof getUser !== 'function') throw failure();
    const verified = object(await getUser.call(auth, captured.accessToken!));
    current();
    if (field(verified, 'error') !== null) throw failure();
    const user = object(field(object(field(verified, 'data')), 'user'));
    if (field(user, 'id') !== authUserId || field(user, 'is_anonymous') === true) throw failure();
    for (const [name, expected] of [['resolve_current_profile_id', captured.profileId], ['current_tenant_id', captured.tenantId]] as const) {
      current(); const rpc = client.rpc; current();
      if (typeof rpc !== 'function') throw failure();
      const response = object(await rpc.call(client, name, {})); current();
      if (field(response, 'error') !== null || field(response, 'data') !== expected) throw failure();
    }
    await readSession();
    current();
  };
  const confirmation = async () => {
    await assertSession();
    current();
    const query = client.from('profiles').select('id,tenant_id,role_id,is_active,status,auth_user_id,roles(id,key)').eq('id', captured.profileId).maybeSingle();
    const raw = await new Promise<unknown>((resolve, reject) => { current(); query.then(resolve, reject); });
    current();
    const response = object(raw);
    if (response.error !== null) throw failure();
    const profile = object(response.data, ['id', 'tenant_id', 'role_id', 'is_active', 'status', 'auth_user_id', 'roles']);
    const role = object(profile.roles, ['id', 'key']);
    if (profile.id !== captured.profileId || profile.tenant_id !== captured.tenantId || profile.is_active !== true || profile.status !== 'active' || (profile.auth_user_id === null ? profile.id !== authUserId : profile.auth_user_id !== authUserId) || !uuid(profile.role_id) || role.id !== profile.role_id || role.key !== captured.roleKey) throw failure();
    const roleId = profile.role_id;
    await assertSession();
    current();
    return roleId;
  };
  try {
    const read = (async () => {
      const roleId = await confirmation();
      const permissions = await fetchCurrentCarePermissions(owner, () => { current(); return true; });
      current();
      if (await confirmation() !== roleId) throw failure();
      current();
      return permissions;
    })();
    // Reuse the existing shorter query deadline; late continuations fail before another dispatch.
    const permissions = await withServiceQueryTimeout(read, 'Berechtigungsprüfung', NATIVE_SERVICE_QUERY_TIMEOUT_MS);
    current();
    return permissions;
  } finally { closed = true; }
}
