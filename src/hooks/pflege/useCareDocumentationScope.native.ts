// Generated native presentation from src/hooks/pflege/useCareDocumentationScope.web.ts. Update through scripts/port-native-workspaces.mjs.
import { useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth/context';
import { canShowDesktopCatalogRoute } from '@/liquid-command/navigation/appsWidgetsCatalogModel.shared';
import { woundUuid } from '@/lib/pflege/woundCareDomain';
import type { PermissionKey } from '@/types/permissions';
import { useCareRuntimePermissions } from "./useCareRuntimePermissions.native.ts";
export function useCareDocumentationScope(required: PermissionKey = 'pflege.documentation.view') {
    const permissions = useCareRuntimePermissions();
    const auth = useAuth();
    const { profile, user, session } = auth;
    const tenantId = permissions.tenantId ?? '';
    const actorId = profile?.id ?? '';
    const token = session?.accessToken;
    const expiresAt = session?.expiresAt;
    const authorized = () => woundUuid(tenantId) && woundUuid(actorId) && woundUuid(user?.id)
        && session?.user.id === user?.id && !!token && auth.authReady && auth.isAuthenticated && !auth.isLoading
        && !auth.profileBootstrapError && !auth.portalSession && profile?.tenantId === tenantId
        && profile?.roleKey === permissions.roleKey
        && (expiresAt === null || (typeof expiresAt === 'number' && expiresAt > Date.now()))
        && canShowDesktopCatalogRoute('/pflege/dokumentation', permissions) && permissions.can(required);
    const ready = authorized();
    const key = JSON.stringify([tenantId, actorId, user?.id, permissions.roleKey, expiresAt, [...permissions.permissions].sort(), required]);
    const boundary = useRef({ key, token, ready, revision: 0 });
    if (boundary.current.key !== key || boundary.current.token !== token || boundary.current.ready !== ready) {
        boundary.current = { key, token, ready, revision: boundary.current.revision + 1 };
    }
    const captured = boundary.current;
    const current = useRef({ authorized, permissions });
    current.current = { authorized, permissions };
    const alive = useRef(true);
    useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
    const isCurrent = () => alive.current && boundary.current === captured && current.current.authorized();
    const can = (permission: PermissionKey) => isCurrent() && current.current.permissions.can(permission);
    return { permissions, profile, tenantId, actorId, ready, revision: captured.revision, isCurrent, can };
}
