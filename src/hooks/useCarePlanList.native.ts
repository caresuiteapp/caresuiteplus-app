// Generated native presentation from src/hooks/useCarePlanList.web.ts. Update through scripts/port-native-workspaces.mjs.
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { withServiceQueryTimeout, SERVICE_QUERY_TIMEOUT_MS, NATIVE_SERVICE_QUERY_TIMEOUT_MS } from '@/lib/services/queryTimeout';
import type { CarePlanListItem } from '@/types/modules/pflege';
import type { ListSortOption } from '@/types/list';
import type { WorkflowStatus } from '@/types';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { fetchCarePlanList } from '@/lib/pflege/carePlanListService';
import { filterByField, filterBySearch, paginateItems, sortItems } from '@/lib/list';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useCareRuntimePermissions } from "./pflege/useCareRuntimePermissions.native.ts";
import { carePermissionOwner, carePermissionOwnerIsCurrent, sameCarePermissionOwner } from "../lib/permissions/carePermissionOwner.native.ts";
import { getSupabaseClient } from "../lib/supabase/client.ts";
import { getServiceMode } from '@/lib/services/mode';
import { isDemoMode } from '@/lib/supabase/config';
const unavailable = 'Die eigene Sitzung oder das aktuelle Pflegeplan-Leserecht ist nicht bestätigt.';
const invalid = 'Die Pflegeplan-Liste ist nicht eindeutig dem aktuellen Mandanten zugeordnet. Bitte neu laden.';
export const CARE_PLAN_STATUS_FILTERS: {
    key: WorkflowStatus | 'all';
    label: string;
}[] = [
    { key: 'all', label: 'Alle' },
    { key: 'aktiv', label: WORKFLOW_STATUS_LABELS.aktiv },
    { key: 'in_bearbeitung', label: WORKFLOW_STATUS_LABELS.in_bearbeitung },
    { key: 'entwurf', label: WORKFLOW_STATUS_LABELS.entwurf },
    { key: 'abgeschlossen', label: WORKFLOW_STATUS_LABELS.abgeschlossen },
    { key: 'fehlerhaft', label: WORKFLOW_STATUS_LABELS.fehlerhaft },
    { key: 'gesperrt', label: WORKFLOW_STATUS_LABELS.gesperrt },
];
export const CARE_PLAN_SORT_OPTIONS: ListSortOption<'clientName' | 'validFrom'>[] = [
    {
        key: 'client_asc',
        label: 'Klient A–Z',
        field: 'clientName',
        direction: 'asc',
    },
    {
        key: 'client_desc',
        label: 'Klient Z–A',
        field: 'clientName',
        direction: 'desc',
    },
    {
        key: 'valid_desc',
        label: 'Gültig ab (neueste)',
        field: 'validFrom',
        direction: 'desc',
    },
    {
        key: 'valid_asc',
        label: 'Gültig ab (älteste)',
        field: 'validFrom',
        direction: 'asc',
    },
];
export function useCarePlanList() {
    const auth = useAuth(), tenantId = useServiceTenantId(), permissions = useCareRuntimePermissions();
    const owner = carePermissionOwner(auth, tenantId, isDemoMode()), sdk = getSupabaseClient();
    const latest = useRef({ owner, permissions, sdk });
    latest.current = { owner, permissions, sdk };
    const [, update] = useState(0);
    type Frame = {
        owner: typeof owner;
        grants: typeof permissions.permissions;
        sdk: typeof sdk;
        search: string;
        status: string;
        sort: string;
        page: number;
        revision: number;
        success: boolean;
        alive: boolean;
        retired: boolean;
        ticket: symbol | null;
        loading: boolean;
        data: CarePlanListItem[] | undefined;
        error: string | null;
    };
    const frame = useRef<Frame | null>(null);
    if (!frame.current || !sameCarePermissionOwner(frame.current.owner, owner)
        || frame.current.grants !== permissions.permissions || frame.current.sdk !== sdk) {
        if (frame.current) {
            frame.current.retired = true;
            frame.current.data = undefined;
            frame.current.ticket = null;
        }
        frame.current = { owner, grants: permissions.permissions, sdk,
            search: '', status: 'all', sort: 'client_asc', page: 1, revision: 0, success: false,
            alive: false, retired: false, ticket: null, loading: true, data: undefined, error: null };
    }
    const ownFrame = frame.current;
    const current = () => {
        const now = latest.current;
        const valid = frame.current === ownFrame && !ownFrame.retired && !!owner && !owner.demo
            && !!owner.accessToken && Number.isFinite(owner.expiresAt) && carePermissionOwnerIsCurrent(owner)
            && sameCarePermissionOwner(owner, now.owner) && now.permissions.permissions === ownFrame.grants
            && now.permissions.tenantId === owner.tenantId && now.permissions.can('pflege.plans.view')
            && !!sdk && now.sdk === sdk && getSupabaseClient() === sdk && getServiceMode() === 'supabase';
        if (!valid) {
            ownFrame.retired = true;
            ownFrame.data = undefined;
            ownFrame.ticket = null;
        }
        return valid;
    };
    const read = async (explicit: boolean) => {
        if (!ownFrame.alive || !current() || ownFrame.ticket)
            return;
        const ticket = Symbol('care-plan-list');
        ownFrame.ticket = ticket;
        ownFrame.loading = true;
        ownFrame.data = undefined;
        ownFrame.error = null;
        ownFrame.success = false;
        update(value => value + 1);
        try {
            const result = await withServiceQueryTimeout(fetchCarePlanList(owner!.tenantId, owner!.roleKey), 'Pflegepläne laden', NATIVE_SERVICE_QUERY_TIMEOUT_MS);
            if (!ownFrame.alive || !current() || ownFrame.ticket !== ticket)
                return;
            if (!result.ok)
                ownFrame.error = result.error;
            else if (!Array.isArray(result.data) || new Set(result.data.map(item => item.id)).size !== result.data.length
                || result.data.some(item => typeof item?.id !== 'string' || !item.id || item.id.trim() !== item.id || item.tenantId !== owner!.tenantId))
                ownFrame.error = invalid;
            else {
                ownFrame.data = result.data;
                ownFrame.success = explicit;
            }
        }
        catch {
            if (ownFrame.alive && current() && ownFrame.ticket === ticket)
                ownFrame.error = 'Pflegepläne konnten nicht geladen werden. Bitte erneut versuchen.';
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
        void read(false);
        return () => { ownFrame.alive = false; ownFrame.ticket = null; ownFrame.data = undefined; };
    }, [ownFrame]);
    useEffect(() => {
        if (!ownFrame.success)
            return;
        const timer = setTimeout(() => {
            if (ownFrame.alive && current()) {
                ownFrame.success = false;
                update(value => value + 1);
            }
        }, 2000);
        return () => clearTimeout(timer);
    }, [ownFrame, ownFrame.success]);
    const allowed = current(), allItems = allowed ? ownFrame.data ?? [] : [];
    const option = CARE_PLAN_SORT_OPTIONS.find(item => item.key === ownFrame.sort) ?? CARE_PLAN_SORT_OPTIONS[0];
    let filtered = filterBySearch(allItems, ownFrame.search, ['title', 'clientName']);
    if (ownFrame.status !== 'all')
        filtered = filterByField(filtered, 'status', ownFrame.status);
    filtered = sortItems(filtered, option.field, option.direction);
    const paginated = paginateItems(filtered, ownFrame.page, 8);
    const shown = ownFrame.data, revision = ownFrame.revision;
    const isCurrent = () => ownFrame.alive && current() && !!shown && ownFrame.data === shown && !ownFrame.loading && ownFrame.revision === revision;
    const change = (edit: () => void) => {
        if (!ownFrame.alive || !current())
            return;
        edit();
        ownFrame.page = 1;
        ownFrame.revision++;
        update(value => value + 1);
    };
    const loading = permissions.loading || (allowed && ownFrame.loading), error = allowed ? ownFrame.error : unavailable;
    const hasActiveFilters = ownFrame.search.length > 0 || ownFrame.status !== 'all';
    return {
        allItems, items: paginated.items, totalCount: allItems.length, filteredCount: filtered.length,
        loading, error, refreshing: allowed && ownFrame.loading && ownFrame.ticket !== null,
        showSuccess: allowed && ownFrame.success,
        search: ownFrame.search, setSearch: (value: string) => change(() => { ownFrame.search = value; }),
        statusFilter: ownFrame.status as WorkflowStatus | 'all', setStatusFilter: (value: WorkflowStatus | 'all') => change(() => { ownFrame.status = value; }),
        sortKey: ownFrame.sort, setSortKey: (value: string) => change(() => { ownFrame.sort = value; }),
        sortOptions: CARE_PLAN_SORT_OPTIONS, statusFilters: CARE_PLAN_STATUS_FILTERS,
        hasMore: paginated.hasMore, loadMore: () => {
            if (isCurrent() && paginated.hasMore) {
                ownFrame.page++;
                ownFrame.revision++;
                update(value => value + 1);
            }
        },
        refresh: () => read(true), resetFilters: () => change(() => { ownFrame.search = ''; ownFrame.status = 'all'; ownFrame.sort = 'client_asc'; }),
        hasActiveFilters, isEmpty: !loading && !error && allItems.length === 0,
        isFilterEmpty: !loading && !error && filtered.length === 0 && hasActiveFilters,
        isCurrent, isCurrentItem: (id: string) => isCurrent() && paginated.items.some(item => item.id === id),
    };
}
