// Generated native presentation from src/hooks/pflege/useCareQualityVisitRead.web.ts. Update through scripts/port-native-workspaces.mjs.
import { useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAsyncQuery } from '@/hooks/core';
import type { useCareRuntimePermissions } from "./useCareRuntimePermissions.native.ts";
import { carePermissionOwner, sameCarePermissionOwner } from "../../lib/permissions/carePermissionOwner.native.ts";
import type { CarePermissionOwner } from "../../lib/permissions/carePermissionOwner.native.ts";
import { getServiceMode } from '@/lib/services/mode';
import { isDemoMode } from '@/lib/supabase/config';
import { getSupabaseClient } from "../../lib/supabase/client.ts";
import { fetchPflegeVisitsList } from '@/lib/pflege/pflegeDedicatedService';
import { cloneClientNativeOriginal, freezeClientNativeOriginal } from "../../lib/clients/clientRecordNativeOriginal.native.ts";
import { projectCareQualityVisitTemporalEvidenceWeb } from "../../lib/pflege/careQualityVisitTemporalEvidence.native.ts";
import type { CareQualityVisitTemporalEvidenceWeb } from "../../lib/pflege/careQualityVisitTemporalEvidence.native.ts";
type Runtime = ReturnType<typeof useCareRuntimePermissions>;
type SourceResult = {
    ok: true;
    data: unknown;
} | {
    ok: false;
    error: string;
};
type Generation = {
    serial: number;
    alive: boolean;
    valid: boolean;
    checking: boolean;
    authBlocked: boolean;
    owner: CarePermissionOwner | null;
    origin: Runtime['permissions'];
    can: Runtime['can'];
    sdk: unknown;
    ticket: number;
    original: unknown | null;
};
export type CareQualityVisitReadStateWeb = {
    state: 'unavailable' | 'loading' | 'refreshing' | 'error' | 'unverified_cache' | 'supplied';
    error: string | null;
};
const denied = 'Der eigene Lesezugriff auf den Visitenauszug ist nicht mehr aktuell.';
/** Read only own data fields of the current business identity. Never traverse inherited getters or clone credentials into public data. */
function visitAuthOwner(auth: unknown, tenantId: string | null): CarePermissionOwner | null {
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
        const authReady = own(auth, 'authReady'), isAuthenticated = own(auth, 'isAuthenticated'), isLoading = own(auth, 'isLoading'), profileBootstrapError = own(auth, 'profileBootstrapError'), portalSession = own(auth, 'portalSession');
        if (authReady !== true || isAuthenticated !== true || isLoading !== false || (profileBootstrapError !== null && typeof profileBootstrapError !== 'string') || portalSession !== null)
            return null;
        const profile = own(auth, 'profile'), user = own(auth, 'user'), session = own(auth, 'session'), sessionUser = own(session, 'user');
        const profileId = own(profile, 'id'), profileTenant = own(profile, 'tenantId'), profileRole = own(profile, 'roleKey'), userId = own(user, 'id'), sessionUserId = own(sessionUser, 'id');
        const userRole = own(user, 'roleKey', true), sessionRole = own(sessionUser, 'roleKey', true), accessToken = own(session, 'accessToken'), expiresAt = own(session, 'expiresAt');
        if (typeof profileId !== 'string' || typeof profileTenant !== 'string' || typeof profileRole !== 'string' || typeof userId !== 'string' || typeof sessionUserId !== 'string' || typeof accessToken !== 'string' || (expiresAt !== null && typeof expiresAt !== 'number'))
            return null;
        if ((userRole !== null && userRole !== undefined && typeof userRole !== 'string') || (sessionRole !== null && sessionRole !== undefined && typeof sessionRole !== 'string'))
            return null;
        // The shared owner predicate still validates UUIDs, known role, matching IDs/tenant, nonempty credential and actual expiry.
        return carePermissionOwner({ authReady, isAuthenticated, isLoading, profileBootstrapError, portalSession, profile: { id: profileId, tenantId: profileTenant, roleKey: profileRole }, user: { id: userId, roleKey: userRole as string | null | undefined }, session: { user: { id: sessionUserId, roleKey: sessionRole as string | null | undefined }, accessToken, expiresAt } }, tenantId, false);
    }
    catch {
        return null;
    }
}
/** One existing Visitservice, including its unchanged internal SELECTs. This is not a complete raw row/history or DB read capability. */
export function useCareQualityVisitRead(runtime: Runtime) {
    const auth = useAuth(), tenantId = useServiceTenantId(), owner = visitAuthOwner(auth, tenantId);
    const alive = useRef(true), serial = useRef(0), current = useRef<Generation | null>(null), latest = useRef({ auth, tenantId, runtime });
    latest.current = { auth, tenantId, runtime };
    if (!current.current || !sameCarePermissionOwner(current.current.owner, owner) || current.current.origin !== runtime.permissions || (current.current.authBlocked && owner && runtime.can('pflege.visits.view') === true && isDemoMode() === false && getServiceMode() === 'supabase' && getSupabaseClient())) {
        if (current.current) {
            current.current.valid = false;
            current.current.original = null;
        }
        current.current = { serial: ++serial.current, alive: true, valid: true, checking: false, authBlocked: false, owner, origin: runtime.permissions, can: runtime.can, sdk: getSupabaseClient(), ticket: 0, original: null };
    }
    const generation = current.current;
    const close = () => { generation.valid = false; generation.original = null; return false; };
    const own = () => alive.current && generation.alive && generation.valid && current.current === generation;
    const authority = () => {
        const context = latest.current, ownOwner = visitAuthOwner(context.auth, context.tenantId);
        if (!ownOwner) {
            generation.authBlocked = true;
            return false;
        }
        return !!generation.owner && context.tenantId === generation.owner.tenantId && context.runtime.tenantId === generation.owner.tenantId && context.runtime.roleKey === generation.owner.roleKey
            && context.runtime.permissions === generation.origin && sameCarePermissionOwner(generation.owner, ownOwner)
            && generation.can('pflege.visits.view') === true && context.runtime.can('pflege.visits.view') === true;
    };
    const isCurrent = () => {
        if (!own())
            return false;
        if (generation.checking)
            return close();
        generation.checking = true;
        try {
            if (!authority() || isDemoMode() !== false || getServiceMode() !== 'supabase' || !generation.sdk || getSupabaseClient() !== generation.sdk || getServiceMode() !== 'supabase')
                return close();
            if (!authority() || isDemoMode() !== false || getSupabaseClient() !== generation.sdk || getServiceMode() !== 'supabase' || getSupabaseClient() !== generation.sdk || getServiceMode() !== 'supabase' || isDemoMode() !== false || getSupabaseClient() !== generation.sdk || !authority() || !own())
                return close();
            return true;
        }
        catch {
            return close();
        }
        finally {
            generation.checking = false;
        }
    };
    useEffect(() => { alive.current = true; generation.alive = true; return () => { alive.current = false; generation.alive = false; generation.ticket++; generation.original = null; }; }, [generation]);
    const run = async (): Promise<SourceResult> => {
        const ticket = ++generation.ticket;
        generation.original = null;
        if (!isCurrent())
            return { ok: false, error: denied };
        const nativeOwner = generation.owner!;
        const result = await fetchPflegeVisitsList(nativeOwner.tenantId, nativeOwner.roleKey);
        if (!isCurrent() || generation.ticket !== ticket)
            return { ok: false, error: denied };
        try {
            const delivered = cloneClientNativeOriginal(result);
            if (!Object.hasOwn(delivered, 'ok') || typeof delivered.ok !== 'boolean')
                return { ok: false, error: 'Der Ausgang der Visitenabfrage ist ungeklärt.' };
            if (delivered.ok !== true)
                return { ok: false, error: Object.hasOwn(delivered, 'error') && typeof delivered.error === 'string' ? delivered.error : 'Der Ausgang der Visitenabfrage ist ungeklärt.' };
            if (!Object.hasOwn(delivered, 'data') || delivered.data === undefined)
                return { ok: false, error: 'Der eigene Visitenauszug ist nicht geliefert.' };
            const checked = projectCareQualityVisitTemporalEvidenceWeb(delivered.data, { tenantId: nativeOwner.tenantId });
            if (!checked.ok)
                return checked;
            const original = freezeClientNativeOriginal(delivered.data);
            if (!isCurrent() || generation.ticket !== ticket)
                return { ok: false, error: denied };
            generation.original = original;
            return { ...delivered, ok: true, data: original };
        }
        catch {
            return { ok: false, error: 'Das gelieferte Originalformat des Visitenauszugs ist ungeklärt.' };
        }
    };
    const query = useAsyncQuery(run, [generation], { enabled: isCurrent(), queryKey: 'care-quality-visit-read-' + generation.serial });
    const state = (): CareQualityVisitReadStateWeb => {
        if (!isCurrent())
            return { state: 'unavailable', error: denied };
        if (query.error || query.refreshError)
            return { state: 'error', error: query.error ?? query.refreshError };
        if (query.loading)
            return { state: 'loading', error: null };
        if (query.refreshing)
            return { state: 'refreshing', error: null };
        if (query.previewData || query.tableMissing || query.cacheMeta.fromCache || query.cacheMeta.partialDetail)
            return { state: 'unverified_cache', error: null };
        if (query.data === null || query.data === undefined || generation.original !== query.data)
            return { state: 'unavailable', error: 'Dieser Visitenauszug ist noch nicht geliefert.' };
        return { state: 'supplied', error: null };
    };
    const view = (): CareQualityVisitTemporalEvidenceWeb | null => {
        if (state().state !== 'supplied')
            return null;
        const result = projectCareQualityVisitTemporalEvidenceWeb(query.data, { tenantId: generation.owner!.tenantId });
        if (!result.ok || !isCurrent() || generation.original !== query.data)
            return null;
        return result.data;
    };
    const refresh = async () => { if (!isCurrent())
        return; await query.refresh(); };
    return { state: state(), view, isCurrent, refresh };
}
