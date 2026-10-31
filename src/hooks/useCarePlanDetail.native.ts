// Generated native presentation from src/hooks/useCarePlanDetail.web.ts. Update through scripts/port-native-workspaces.mjs.
import { useEffect, useRef, useState } from 'react';
import type { CarePlanDetail, VitalReadingListItem } from '@/types/modules/pflege';
import { fetchCarePlanDetail } from '@/lib/pflege';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useCareRuntimePermissions } from "./pflege/useCareRuntimePermissions.native.ts";
import { carePermissionOwner, carePermissionOwnerIsCurrent, sameCarePermissionOwner } from "../lib/permissions/carePermissionOwner.native.ts";
import { getSupabaseClient } from "../lib/supabase/client.ts";
import { getServiceMode } from '@/lib/services/mode';
import { isDemoMode } from '@/lib/supabase/config';
const unavailable = 'Die eigene Sitzung oder das aktuelle Pflegeplan-Leserecht ist nicht bestätigt.';
const invalid = 'Der geladene Pflegeplan gehört nicht zur aktuellen Auswahl. Bitte neu laden.';
/** Every view and retained reload belongs to one account, grant set, SDK and plan. */
export function useCarePlanDetail(planId: string | undefined) {
    const auth = useAuth(), tenantId = useServiceTenantId(), permissions = useCareRuntimePermissions();
    const owner = carePermissionOwner(auth, tenantId, isDemoMode()), sdk = getSupabaseClient();
    const latest = useRef({ owner, permissions, sdk, planId });
    latest.current = { owner, permissions, sdk, planId };
    const [, update] = useState(0);
    type Frame = {
        owner: typeof owner;
        grants: typeof permissions.permissions;
        sdk: typeof sdk;
        planId: typeof planId;
        alive: boolean;
        retired: boolean;
        ticket: symbol | null;
        loading: boolean;
        data: CarePlanDetail | undefined;
        error: string | null;
    };
    const frame = useRef<Frame | null>(null);
    if (!frame.current || !sameCarePermissionOwner(frame.current.owner, owner)
        || frame.current.grants !== permissions.permissions || frame.current.sdk !== sdk || frame.current.planId !== planId) {
        if (frame.current) {
            frame.current.retired = true;
            frame.current.data = undefined;
            frame.current.ticket = null;
        }
        frame.current = { owner, grants: permissions.permissions, sdk, planId,
            alive: false, retired: false, ticket: null, loading: true, data: undefined, error: null };
    }
    const ownFrame = frame.current;
    const current = () => {
        const now = latest.current;
        const valid = frame.current === ownFrame && !ownFrame.retired && !!owner && !owner.demo
            && !!owner.accessToken && Number.isFinite(owner.expiresAt) && carePermissionOwnerIsCurrent(owner)
            && sameCarePermissionOwner(owner, now.owner) && now.permissions.permissions === ownFrame.grants
            && now.permissions.tenantId === owner.tenantId && now.permissions.can('pflege.plans.view')
            && typeof planId === 'string' && planId.length > 0 && now.planId === planId
            && !!sdk && now.sdk === sdk && getSupabaseClient() === sdk && getServiceMode() === 'supabase';
        if (!valid) {
            ownFrame.retired = true;
            ownFrame.data = undefined;
            ownFrame.ticket = null;
        }
        return valid;
    };
    const refresh = async () => {
        if (!ownFrame.alive || !current() || ownFrame.ticket)
            return;
        const ticket = Symbol('care-plan-detail');
        ownFrame.ticket = ticket;
        ownFrame.loading = true;
        ownFrame.data = undefined;
        ownFrame.error = null;
        update(value => value + 1);
        try {
            const result = await fetchCarePlanDetail(planId!, owner!.tenantId, owner!.roleKey);
            if (!ownFrame.alive || !current() || ownFrame.ticket !== ticket)
                return;
            if (!result.ok)
                ownFrame.error = result.error;
            else if (!result.data || result.data.id !== planId || result.data.tenantId !== owner!.tenantId)
                ownFrame.error = invalid;
            else
                ownFrame.data = result.data;
        }
        catch {
            if (ownFrame.alive && current() && ownFrame.ticket === ticket)
                ownFrame.error = 'Pflegeplandetails konnten nicht geladen werden. Bitte erneut versuchen.';
        }
        finally {
            if (ownFrame.alive && current() && ownFrame.ticket === ticket) {
                ownFrame.ticket = null;
                ownFrame.loading = false;
                update(value => value + 1);
            }
        }
    };
    useEffect(() => {
        ownFrame.alive = true;
        void refresh();
        return () => { ownFrame.alive = false; ownFrame.ticket = null; ownFrame.data = undefined; };
    }, [ownFrame]);
    const allowed = current();
    const shown = allowed ? ownFrame.data : undefined;
    return {
        isCurrent: () => ownFrame.alive && current() && !!shown && ownFrame.data === shown && !ownFrame.loading,
        data: shown,
        vitals: [] as VitalReadingListItem[],
        vitalsLoaded: false,
        loading: permissions.loading || (allowed && ownFrame.loading),
        error: allowed ? ownFrame.error : unavailable,
        refresh,
        notFound: false,
    };
}
