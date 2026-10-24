// Generated native presentation from src/hooks/pflege/useCareRuntimePermissions.web.ts. Update through scripts/port-native-workspaces.mjs.
import {useNativeWorkflowWindow} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {nativeDocument as document,nativeWindow as window} from '@/lib/platform/nativeWorkflowEnvironment.native';
import { useEffect, useRef, useState } from 'react';
import type { PermissionDecision, PermissionKey } from '@/types/permissions';
import { ROLE_LABELS } from '@/data/constants';
import { checkPermissionWithList } from '@/lib/permissions/check';
import { hasEffectiveModuleGateAccess } from '@/lib/modules/moduleAccessService';
import { isDemoMode } from '@/lib/supabase/config';
import { useAuth } from '@/lib/auth/context';
import { resolveEffectiveRoleKey } from '@/lib/auth/sessionTarget';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { carePermissionOwner, sameCarePermissionOwner, carePermissionOwnerIsCurrent } from "../../lib/permissions/carePermissionOwner.native.ts";
import type { CarePermissionOwner } from "../../lib/permissions/carePermissionOwner.native.ts";
import { fetchConfirmedCarePermissions as fetchCurrentCarePermissions } from "../../lib/permissions/confirmedCarePermissions.native.ts";
type PermissionRead = {
    owner: CarePermissionOwner | null;
    revision: number;
    alive: boolean;
    suspended: boolean;
    ticket: symbol | null;
    status: 'loading' | 'ready' | 'error' | 'denied';
    permissions: readonly PermissionKey[];
    error: string | null;
};
const noPermissions: readonly PermissionKey[] = Object.freeze([]);
/** Private Web clinical hook. Shared/Android permission contracts are unchanged. */
export function useCareRuntimePermissions() {
    const window = useNativeWorkflowWindow();
    const auth = useAuth(), tenantId = useServiceTenantId(), demo = isDemoMode();
    const roleKey = resolveEffectiveRoleKey(auth.profile, auth.user, auth.portalSession);
    const owner = carePermissionOwner(auth, tenantId, demo);
    const [revision, setRevision] = useState(0), [, setUpdate] = useState(0);
    const current = useRef<PermissionRead | null>(null);
    if (!current.current || !sameCarePermissionOwner(current.current.owner, owner) || current.current.revision !== revision) {
        if (current.current) {
            current.current.alive = false;
            current.current.ticket = null;
            current.current.permissions = noPermissions;
        }
        current.current = { owner, revision, alive: false, suspended: false, ticket: null, status: owner ? 'loading' : 'denied', permissions: noPermissions, error: null };
    }
    const read = current.current;
    const ownRead = () => current.current === read && read.alive && !read.suspended && carePermissionOwnerIsCurrent(read.owner);
    const grants = () => ownRead() && read.status === 'ready' ? read.permissions : noPermissions;
    const refreshPermissions = () => {
        if (!ownRead())
            return;
        read.ticket = null;
        read.status = 'loading';
        read.permissions = noPermissions;
        read.error = null;
        setRevision(value => value + 1);
    };
    useEffect(() => {
        read.alive = true;
        const ticket = Symbol('care-permission-read');
        read.ticket = ticket;
        let timer: ReturnType<typeof setTimeout> | undefined;
        let removeLifecycleListeners = () => { };
        if (read.owner) {
            const hidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden';
            let resumeQueued = false;
            const suspend = () => {
                if (current.current !== read || !read.alive)
                    return;
                read.suspended = true;
                read.ticket = null;
                read.permissions = noPermissions;
                read.status = 'loading';
                read.error = null;
                setUpdate(value => value + 1);
            };
            const resume = () => {
                if (current.current !== read || !read.alive || hidden() || resumeQueued)
                    return;
                resumeQueued = true;
                read.ticket = null;
                read.permissions = noPermissions;
                read.status = 'loading';
                read.error = null;
                setRevision(value => value + 1);
            };
            const onVisibility = () => { if (hidden())
                suspend();
            else
                resume(); };
            if (typeof document !== 'undefined' && typeof window !== 'undefined') {
                document.addEventListener('visibilitychange', onVisibility);
                window.addEventListener('focus', resume);
                window.addEventListener('pageshow', resume);
                window.addEventListener('pagehide', suspend);
                window.addEventListener('online', resume);
                removeLifecycleListeners = () => {
                    document.removeEventListener('visibilitychange', onVisibility);
                    window.removeEventListener('focus', resume);
                    window.removeEventListener('pageshow', resume);
                    window.removeEventListener('pagehide', suspend);
                    window.removeEventListener('online', resume);
                };
            }
            read.suspended = hidden();
            if (!read.suspended)
                void fetchCurrentCarePermissions(read.owner, () => ownRead() && read.ticket === ticket).then(permissions => {
                    if (!ownRead() || read.ticket !== ticket)
                        return;
                    read.permissions = Object.freeze([...permissions]);
                    read.status = 'ready';
                    setUpdate(value => value + 1);
                }).catch(() => {
                    if (!ownRead() || read.ticket !== ticket)
                        return;
                    read.permissions = noPermissions;
                    read.status = 'error';
                    read.error = 'Die aktuellen Berechtigungen konnten nicht bestätigt werden.';
                    setUpdate(value => value + 1);
                });
            if (read.owner.expiresAt !== null)
                timer = setTimeout(() => {
                    if (current.current !== read || !read.alive || read.ticket !== ticket)
                        return;
                    read.permissions = noPermissions;
                    read.ticket = null;
                    read.status = 'denied';
                    setRevision(value => value + 1);
                }, Math.min(2147483647, Math.max(0, read.owner.expiresAt - Date.now())));
        }
        return () => { removeLifecycleListeners(); if (timer !== undefined)
            clearTimeout(timer); read.alive = false; read.ticket = null; read.permissions = noPermissions; };
    }, [read]);
    return {
        roleKey, roleLabel: roleKey ? ROLE_LABELS[roleKey] : null, tenantId,
        permissions: grants(),
        can: (permission: PermissionKey) => grants().includes(permission),
        canAny: (keys: PermissionKey[]) => ownRead() && read.status === 'ready' && keys.some(key => read.permissions.includes(key)),
        canAll: (keys: PermissionKey[]) => ownRead() && read.status === 'ready' && keys.every(key => read.permissions.includes(key)),
        check: (permission: PermissionKey): PermissionDecision => ownRead() && read.status === 'ready' ? checkPermissionWithList(roleKey, read.permissions, permission) : { allowed: false, reason: read.error ?? 'Die aktuellen Berechtigungen sind noch nicht bestätigt.' },
        hasModuleGate: (moduleKey: import('@/types').ProductKey) => ownRead() && read.status === 'ready' && !!tenantId && hasEffectiveModuleGateAccess(moduleKey, tenantId),
        isReadOnly: grants().includes('office.clients.view') && !grants().includes('office.clients.edit'),
        loading: read.status === 'loading', error: read.error, refreshPermissions,
    };
}
