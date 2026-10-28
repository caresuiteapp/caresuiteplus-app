// Generated native presentation from src/lib/qm/qmReadOwner.web.ts. Update through scripts/port-native-workspaces.mjs.
import type { RoleKey } from '@/types';
import type { QmReadScope } from "./confirmQmReadScope.native.ts";
const businessRoles = new Set(['business_admin', 'business_manager', 'billing', 'dispatch', 'nurse', 'caregiver', 'counselor', 'akademie_admin']);
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
/** Capture data fields only. This snapshot is not permission; confirmQmReadScope verifies the own database mapping. */
export function qmReadOwner(auth: unknown, tenantId: string | null): QmReadScope | null {
    try {
        const own = (object: unknown, key: string, optional = false): unknown => {
            if (!object || typeof object !== 'object' || Array.isArray(object))
                throw Error('Own auth context missing');
            const descriptor = Object.getOwnPropertyDescriptor(object, key);
            if (!descriptor) {
                if (optional)
                    return null;
                throw Error('Own auth field missing');
            }
            if (!Object.hasOwn(descriptor, 'value') || descriptor.enumerable !== true)
                throw Error('Own auth data field missing');
            return descriptor.value;
        };
        if (own(auth, 'authReady') !== true || own(auth, 'isAuthenticated') !== true || own(auth, 'isLoading') !== false || own(auth, 'profileBootstrapError') !== null || own(auth, 'portalSession') !== null)
            return null;
        const profile = own(auth, 'profile'), user = own(auth, 'user'), session = own(auth, 'session'), sessionUser = own(session, 'user');
        const profileId = own(profile, 'id'), profileTenant = own(profile, 'tenantId'), roleKey = own(profile, 'roleKey');
        const authUserId = own(user, 'id'), sessionUserId = own(sessionUser, 'id');
        const userRole = own(user, 'roleKey', true), sessionRole = own(sessionUser, 'roleKey', true);
        const accessToken = own(session, 'accessToken'), expiresAt = own(session, 'expiresAt');
        if (!uuid(profileId) || !uuid(tenantId) || profileTenant !== tenantId || typeof roleKey !== 'string' || !businessRoles.has(roleKey) || !uuid(authUserId) || sessionUserId !== authUserId || typeof accessToken !== 'string' || !accessToken)
            return null;
        if ((userRole != null && typeof userRole !== 'string') || (sessionRole != null && typeof sessionRole !== 'string') || (userRole && userRole !== roleKey) || (sessionRole && sessionRole !== roleKey))
            return null;
        if (expiresAt !== null && (typeof expiresAt !== 'number' || !Number.isSafeInteger(expiresAt) || expiresAt <= Date.now()))
            return null;
        return Object.freeze({ tenantId, profileId, authUserId, roleKey: roleKey as RoleKey, accessToken, expiresAt });
    }
    catch {
        return null;
    }
}
export function sameQmReadOwner(a: QmReadScope | null, b: QmReadScope | null): boolean {
    return a === b || (!!a && !!b && a.tenantId === b.tenantId && a.profileId === b.profileId && a.authUserId === b.authUserId && a.roleKey === b.roleKey && a.accessToken === b.accessToken && a.expiresAt === b.expiresAt);
}
