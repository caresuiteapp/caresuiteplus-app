// Generated native presentation from src/lib/permissions/carePermissionOwner.web.ts. Update through scripts/port-native-workspaces.mjs.
import type { RoleKey } from '@/types';
type Identity = {
    id: string;
    roleKey?: string | null;
};
export type CarePermissionAuth = {
    authReady: boolean;
    isAuthenticated: boolean;
    isLoading: boolean;
    profileBootstrapError: string | null;
    profile: (Identity & {
        tenantId: string | null;
    }) | null;
    user: Identity | null;
    session: {
        user: Identity;
        accessToken: string;
        expiresAt: number | null;
    } | null;
    portalSession: unknown;
};
export type CarePermissionOwner = Readonly<{
    tenantId: string;
    profileId: string;
    roleKey: RoleKey;
    accessToken: string | null;
    expiresAt: number | null;
    demo: boolean;
}>;
const clinicalRoles = new Set(['business_admin', 'business_manager', 'billing', 'dispatch', 'nurse', 'caregiver', 'counselor', 'akademie_admin']);
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
/** Only native business identity is eligible for these private clinical Web readers. */
export function carePermissionOwner(auth: CarePermissionAuth, tenantId: string | null, demo: boolean, now = Date.now()): CarePermissionOwner | null {
    const profile = auth.profile;
    if (!profile || !uuid(profile.id) || !uuid(tenantId) || profile.tenantId !== tenantId || !clinicalRoles.has(profile.roleKey ?? '') || auth.portalSession)
        return null;
    if (demo)
        return Object.freeze({ tenantId, profileId: profile.id, roleKey: profile.roleKey as RoleKey, accessToken: null, expiresAt: null, demo: true });
    const user = auth.user, session = auth.session;
    if (auth.authReady !== true || auth.isAuthenticated !== true || auth.isLoading !== false || auth.profileBootstrapError || !user || !session || user.id !== profile.id || session.user.id !== profile.id || (user.roleKey && user.roleKey !== profile.roleKey) || (session.user.roleKey && session.user.roleKey !== profile.roleKey) || typeof session.accessToken !== 'string' || !session.accessToken || (session.expiresAt !== null && (!Number.isFinite(session.expiresAt) || session.expiresAt <= now)))
        return null;
    return Object.freeze({ tenantId, profileId: profile.id, roleKey: profile.roleKey as RoleKey, accessToken: session.accessToken, expiresAt: session.expiresAt, demo: false });
}
export function sameCarePermissionOwner(a: CarePermissionOwner | null, b: CarePermissionOwner | null): boolean {
    return a === b || (!!a && !!b && a.tenantId === b.tenantId && a.profileId === b.profileId && a.roleKey === b.roleKey && a.accessToken === b.accessToken && a.expiresAt === b.expiresAt && a.demo === b.demo);
}
export function carePermissionOwnerIsCurrent(owner: CarePermissionOwner | null, now = Date.now()): owner is CarePermissionOwner {
    return !!owner && (owner.demo || owner.expiresAt === null || owner.expiresAt > now);
}
