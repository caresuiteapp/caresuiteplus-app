// Generated native presentation from src/lib/permissions/confirmedCarePermissions.web.ts. Update through scripts/port-native-workspaces.mjs.
import type { PermissionKey } from '@/types/permissions';
import type { CarePermissionOwner } from "./carePermissionOwner.native.ts";
import { fetchCurrentCarePermissions } from "./currentCarePermissions.native.ts";
import { NATIVE_SERVICE_QUERY_TIMEOUT_MS, withServiceQueryTimeout } from '@/lib/services/queryTimeout';
const failure = () => new Error('Die aktuellen Berechtigungen konnten nicht bestätigt werden.');
const ownerKeys = ['tenantId', 'profileId', 'roleKey', 'accessToken', 'expiresAt', 'demo'] as const;
function ownerSnapshot(owner: CarePermissionOwner): CarePermissionOwner {
    if (!owner || typeof owner !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(owner)))
        throw failure();
    const keys = Reflect.ownKeys(owner);
    if (keys.length !== ownerKeys.length || ownerKeys.some(key => !keys.includes(key)))
        throw failure();
    const captured: Record<string, unknown> = {};
    for (const key of ownerKeys) {
        const descriptor = Object.getOwnPropertyDescriptor(owner, key);
        if (!descriptor || !('value' in descriptor) || !descriptor.enumerable)
            throw failure();
        captured[key] = descriptor.value;
    }
    if (typeof captured.demo !== 'boolean' || (captured.expiresAt !== null
        && (!Number.isSafeInteger(captured.expiresAt) || (captured.expiresAt as number) <= Date.now())))
        throw failure();
    return Object.freeze(captured) as CarePermissionOwner;
}
function sameOwner(owner: CarePermissionOwner, captured: CarePermissionOwner): boolean {
    try {
        const latest = ownerSnapshot(owner);
        return ownerKeys.every(key => latest[key] === captured[key]);
    }
    catch {
        return false;
    }
}
/** The complete reader confirms the exact own native profile/role before and after grants. */
export async function fetchConfirmedCarePermissions(owner: CarePermissionOwner, readIsCurrent: () => boolean = () => true): Promise<readonly PermissionKey[]> {
    const captured = ownerSnapshot(owner);
    let closed = false;
    const current = () => !closed && readIsCurrent() && sameOwner(owner, captured);
    try {
        const permissions = await withServiceQueryTimeout(fetchCurrentCarePermissions(owner, current), 'Berechtigungsprüfung', NATIVE_SERVICE_QUERY_TIMEOUT_MS);
        if (!current())
            throw failure();
        return permissions;
    }
    finally {
        closed = true;
    }
}
