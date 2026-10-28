// Generated native presentation from src/lib/permissions/confirmedCarePermissions.web.ts. Update through scripts/port-native-workspaces.mjs.
import type { PermissionKey } from '@/types/permissions';
import type { CarePermissionOwner } from "./carePermissionOwner.native.ts";
import { carePermissionOwnerIsCurrent } from "./carePermissionOwner.native.ts";
import { fetchCurrentCarePermissions } from "./currentCarePermissions.native.ts";
import { getSupabaseClient } from "../supabase/client.ts";
import { NATIVE_SERVICE_QUERY_TIMEOUT_MS, withServiceQueryTimeout } from '@/lib/services/queryTimeout';
const failure = () => new Error('Die aktuellen Berechtigungen konnten nicht bestätigt werden.');
const ownerKeys = ['tenantId', 'profileId', 'roleKey', 'accessToken', 'expiresAt', 'demo'] as const;
const roles = new Set(['business_admin', 'business_manager', 'billing', 'dispatch', 'nurse', 'caregiver', 'counselor', 'akademie_admin']);
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
function object(value: unknown, keys?: readonly string[]): Record<string, unknown> {
    if (!value || typeof value !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(value)))
        throw failure();
    const supplied = Reflect.ownKeys(value);
    if (supplied.some(key => typeof key !== 'string') || (keys && (supplied.length !== keys.length || keys.some(key => !supplied.includes(key)))))
        throw failure();
    for (const key of supplied) {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor || !('value' in descriptor) || !descriptor.enumerable)
            throw failure();
    }
    return value as Record<string, unknown>;
}
function captureOwner(owner: CarePermissionOwner): CarePermissionOwner {
    const snapshot = Object.freeze({ ...object(owner, ownerKeys) }) as CarePermissionOwner;
    if (!uuid(snapshot.profileId) || !uuid(snapshot.tenantId) || !roles.has(snapshot.roleKey) || typeof snapshot.demo !== 'boolean' || (snapshot.expiresAt !== null && (!Number.isSafeInteger(snapshot.expiresAt) || snapshot.expiresAt <= Date.now())) || !carePermissionOwnerIsCurrent(snapshot) || (!snapshot.demo && (typeof snapshot.accessToken !== 'string' || !snapshot.accessToken)))
        throw failure();
    return snapshot;
}
/** Private Web confirmation; database RLS and protected role assignment remain separate server gates. */
export async function fetchConfirmedCarePermissions(owner: CarePermissionOwner, readIsCurrent: () => boolean = () => true): Promise<readonly PermissionKey[]> {
    if (!readIsCurrent())
        throw failure();
    const captured = captureOwner(owner);
    if (captured.demo)
        return fetchCurrentCarePermissions(owner, readIsCurrent);
    const client = getSupabaseClient();
    if (!client)
        throw failure();
    let closed = false;
    const current = () => {
        const latest = object(owner, ownerKeys);
        if (closed || !readIsCurrent() || !carePermissionOwnerIsCurrent(captured) || ownerKeys.some(key => latest[key] !== captured[key]))
            throw failure();
    };
    const session = async () => {
        current();
        const response = object(await client.auth.getSession());
        current();
        if (response.error !== null)
            throw failure();
        const native = object(object(response.data).session), user = object(native.user);
        if (native.access_token !== captured.accessToken || user.id !== captured.profileId)
            throw failure();
        const expires = native.expires_at;
        if (expires === undefined || expires === null) {
            if (captured.expiresAt !== null)
                throw failure();
        }
        else if (!Number.isSafeInteger(expires) || !Number.isSafeInteger((expires as number) * 1000) || (expires as number) * 1000 !== captured.expiresAt || (expires as number) * 1000 <= Date.now())
            throw failure();
    };
    const confirmation = async () => {
        await session();
        current();
        // Read the authentic user for this exact token; user_metadata supplies no role or tenant.
        const auth = object(await client.auth.getUser(captured.accessToken!));
        current();
        if (auth.error !== null)
            throw failure();
        const user = object(object(auth.data).user);
        if (user.id !== captured.profileId || user.is_anonymous === true)
            throw failure();
        await session();
        current();
        const query = client.from('profiles').select('id,tenant_id,role_id,is_active,status,auth_user_id,roles(id,key)').eq('id', captured.profileId).maybeSingle();
        const raw = await new Promise<unknown>((resolve, reject) => { current(); query.then(resolve, reject); });
        current();
        const response = object(raw);
        if (response.error !== null)
            throw failure();
        const profile = object(response.data, ['id', 'tenant_id', 'role_id', 'is_active', 'status', 'auth_user_id', 'roles']);
        const role = object(profile.roles, ['id', 'key']);
        if (profile.id !== captured.profileId || profile.tenant_id !== captured.tenantId || profile.is_active !== true || profile.status !== 'active' || (profile.auth_user_id !== null && profile.auth_user_id !== captured.profileId) || !uuid(profile.role_id) || role.id !== profile.role_id || role.key !== captured.roleKey)
            throw failure();
        const roleId = profile.role_id;
        await session();
        current();
        return roleId;
    };
    try {
        const read = (async () => {
            const roleId = await confirmation();
            const permissions = await fetchCurrentCarePermissions(owner, () => { current(); return true; });
            current();
            if (await confirmation() !== roleId)
                throw failure();
            current();
            return permissions;
        })();
        // Reuse the existing shorter query deadline; late continuations fail before another dispatch.
        const permissions = await withServiceQueryTimeout(read, 'Berechtigungsprüfung', NATIVE_SERVICE_QUERY_TIMEOUT_MS);
        current();
        return permissions;
    }
    finally {
        closed = true;
    }
}
