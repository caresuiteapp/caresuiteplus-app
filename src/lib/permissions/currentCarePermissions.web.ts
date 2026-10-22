import type { PermissionKey } from '@/types/permissions';
import type { CarePermissionOwner } from './carePermissionOwner.web.ts';
import { carePermissionOwnerIsCurrent } from './carePermissionOwner.web.ts';
import { getPermissionsForRole } from './staticRolePermissions';
import { getSupabaseClient } from '@/lib/supabase/client';

const pageSize = 200;
const failure = () => new Error('Die aktuellen Pflegeberechtigungen konnten nicht bestätigt werden.');
const clinicalRoles = new Set(['business_admin', 'business_manager', 'billing', 'dispatch', 'nurse', 'caregiver', 'counselor', 'akademie_admin']);
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

/** Inspect supplied data descriptors before consuming an SDK or native field. */
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

const field = (value: Record<string, unknown>, key: string): unknown => Object.getOwnPropertyDescriptor(value, key)?.value;

function page(value: unknown): readonly unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > pageSize || Reflect.ownKeys(value).length !== value.length + 1) throw failure();
  for (let i = 0; i < value.length; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
    if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) throw failure();
  }
  return value;
}

/** UUID-PK keyset: a short server-capped page is not an exhaustion proof. */
async function permissionPages(client: NonNullable<ReturnType<typeof getSupabaseClient>>, table: 'role_permissions' | 'role_permission_sets', value: string, tenantId: string | undefined, assertSession: () => Promise<void>, assertCurrent: () => void, close: () => void): Promise<PermissionKey[]> {
  const permissions: PermissionKey[] = [], seenKeys = new Set<string>();
  let cursor: string | null = null;
  try {
    for (;;) {
      await assertSession();
      assertCurrent();
      const tenant = table === 'role_permission_sets';
      let query = tenant
        ? client.from('role_permission_sets').select('id,tenant_id,role_key,permission_key').eq('role_key',value).order('id',{ascending:true}).limit(pageSize)
        : client.from('role_permissions').select('id,role_id,permission_key').eq('role_id',value).order('id',{ascending:true}).limit(pageSize);
      if (tenant) { if(!tenantId) throw failure(); query = query.eq('tenant_id', tenantId); }
      if (cursor) query = query.gt('id', cursor);
      const raw = await new Promise<unknown>((resolve, reject) => {
        // Invoke the native thenable synchronously: await(query) would defer dispatch to another microtask.
        assertCurrent(); query.then(resolve, reject);
      });
      assertCurrent();
      const response = object(raw);
      if (field(response, 'error') !== null) throw failure();
      await assertSession();
      assertCurrent();
      const rows = page(field(response, 'data'));
      if (!rows.length) return permissions;
      // Inspect the entire supplied page before extending the private result/cursor.
      const captured: { id: string; key: PermissionKey }[] = [];
      let previous: string | null = cursor;
      for (const entry of rows) {
        const row = object(entry, tenant ? ['id', 'tenant_id', 'role_key', 'permission_key'] : ['id', 'role_id', 'permission_key']);
        if (!uuid(row.id) || (tenant ? !uuid(row.tenant_id) || row.tenant_id.toLowerCase() !== tenantId?.toLowerCase() || row.role_key !== value : !uuid(row.role_id) || row.role_id.toLowerCase() !== value.toLowerCase())) throw failure();
        const nativeId = row.id.toLowerCase(), key = row.permission_key;
        if ((previous !== null && nativeId <= previous) || typeof key !== 'string' || !key || key.trim() !== key || seenKeys.has(key) || captured.some(item => item.key === key)) throw failure();
        captured.push({ id: nativeId, key: key as PermissionKey });
        previous = nativeId;
      }
      for (const row of captured) { permissions.push(row.key); seenKeys.add(row.key); }
      cursor = previous;
    }
  } catch (error) { close(); throw error; }
}

/** No completed-role cache and no static production fallback on missing role, empty grants, or errors. */
export async function fetchCurrentCarePermissions(owner: CarePermissionOwner, readIsCurrent: () => boolean = () => true): Promise<readonly PermissionKey[]> {
  const ownerKeys = ['tenantId', 'profileId', 'roleKey', 'accessToken', 'expiresAt', 'demo'] as const;
  const supplied = object(owner, ownerKeys);
  const captured = Object.freeze({ ...supplied }) as CarePermissionOwner;
  if (!uuid(captured.tenantId) || !uuid(captured.profileId) || !clinicalRoles.has(captured.roleKey) || typeof captured.demo !== 'boolean' || (captured.expiresAt !== null && (!Number.isSafeInteger(captured.expiresAt) || captured.expiresAt <= Date.now())) || !carePermissionOwnerIsCurrent(captured)) throw failure();
  if (captured.demo) return Object.freeze([...getPermissionsForRole(captured.roleKey)]);
  if (typeof captured.accessToken !== 'string' || !captured.accessToken) throw failure();
  const client = getSupabaseClient();
  if (!client) throw failure();
  let closed = false;
  const close = () => { closed = true; };
  const current = () => {
    const latest = object(owner, ownerKeys);
    if (closed || getSupabaseClient() !== client || !readIsCurrent() || ownerKeys.some(key => latest[key] !== captured[key]) || !carePermissionOwnerIsCurrent(captured)) throw failure();
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
      const response = object(await rpc.call(client, name)); current();
      if (field(response, 'error') !== null || field(response, 'data') !== expected) throw failure();
    }
    await readSession();
    current();
  };
  try {
    await assertSession();
    current();
    const query = client.from('roles').select('id,key').eq('key', captured.roleKey).maybeSingle();
    const raw = await new Promise<unknown>((resolve, reject) => { current(); query.then(resolve, reject); });
    current();
    const response = object(raw);
    if (field(response, 'error') !== null) throw failure();
    await assertSession();
    current();
    const role = object(field(response, 'data'), ['id', 'key']);
    if (!uuid(role.id) || role.key !== captured.roleKey) throw failure();
    const [global, tenant] = await Promise.all([
      permissionPages(client, 'role_permissions', role.id, undefined, assertSession, current, close),
      permissionPages(client, 'role_permission_sets', captured.roleKey, captured.tenantId, assertSession, current, close),
    ]);
    await assertSession();
    current();
    // Existing native contract: an absent tenant override inherits the complete global set.
    const result = Object.freeze([...(tenant.length ? tenant : global)]);
    close();
    return result;
  } catch (error) { close(); throw error; }
}
