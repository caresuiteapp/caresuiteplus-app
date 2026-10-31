// Generated native presentation from src/hooks/pflege/useWoundRead.web.ts. Update through scripts/port-native-workspaces.mjs.
import {nativeStructuredClone as structuredClone} from '@/lib/platform/nativeWorkflowEnvironment.native';
import { useEffect, useRef } from 'react';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { careAssessmentRuntimeAccess } from "../../lib/careAssessment/careAssessmentRuntimeAccess.native.ts";
import { sameWoundReadOriginal } from "../../lib/pflege/woundReadOriginal.native.ts";
import type { RoleKey, ServiceResult } from '@/types';
export type WoundReadOwner = {
    tenantId: string;
    profileId: string;
    role: RoleKey;
};
export type WoundReadProps = {
    owner: WoundReadOwner | null;
    serviceTenant: string | null;
    runtimeTenant: string | null;
    runtimeRole: RoleKey | null;
    canView: boolean;
    canManage: boolean;
};
type ReadResult<T> = {
    ticket: symbol;
    readId: symbol;
    owner: WoundReadOwner;
    value: T;
};
const same = sameWoundReadOriginal;
/** Web-only read ownership. Existing services still establish backend permission and dataset scope. */
export function useWoundRead<T>(props: WoundReadProps, resource: string, fetch: (owner: WoundReadOwner) => Promise<ServiceResult<T>>, capture: (value: unknown, tenantId: string) => T) {
    const owner = useRef(props.owner ? structuredClone(props.owner) : null).current;
    const alive = useRef(true);
    useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
    const access = careAssessmentRuntimeAccess({ tenantId: props.owner?.tenantId, profileId: props.owner?.profileId,
        profileRole: props.owner?.role, runtimeTenantId: props.runtimeTenant, runtimeRole: props.runtimeRole,
        canView: props.canView, canManage: props.canManage });
    const canRead = access.canRead && props.serviceTenant === owner?.tenantId && same(owner, props.owner);
    const queryKey = JSON.stringify([owner, resource, props.serviceTenant, props.runtimeTenant, props.runtimeRole, props.canView, canRead]);
    const boundary = useRef({ key: queryKey, ticket: Symbol('wound-read') });
    if (boundary.current.key !== queryKey)
        boundary.current = { key: queryKey, ticket: Symbol('wound-read') };
    const runtime = useRef({ owner: props.owner, access, canRead, ticket: boundary.current.ticket });
    runtime.current = { owner: props.owner, access, canRead, ticket: boundary.current.ticket };
    function ownRead(ticket: symbol) {
        return alive.current && !!owner && runtime.current.canRead && runtime.current.ticket === ticket && same(owner, runtime.current.owner);
    }
    const readFlight = useRef<symbol | null>(null);
    const accepted = useRef<ReadResult<T> | null>(null);
    const query = useAsyncQuery<ReadResult<T>>(async () => {
        const ticket = runtime.current.ticket;
        if (!ownRead(ticket) || !owner)
            return { ok: false, error: 'Der aktuelle Zugriff auf die Wunddokumentation fehlt.' };
        const readId = Symbol('wound-response');
        readFlight.current = readId;
        accepted.current = null;
        try {
            const result = await fetch(owner);
            if (!ownRead(ticket) || readFlight.current !== readId)
                return { ok: false, error: 'Der Zugriff auf die Wunddokumentation hat sich geändert.' };
            if (!result.ok)
                return result;
            const value = capture(result.data, owner.tenantId);
            const envelope = { ticket, readId, owner: structuredClone(owner), value };
            accepted.current = { ...envelope, owner: structuredClone(owner), value: structuredClone(value) };
            return { ...result, data: envelope };
        }
        catch (cause) {
            return { ok: false, error: cause instanceof Error ? cause.message : 'Die Wunddokumentation konnte nicht vollständig geprüft werden.' };
        }
        finally {
            if (readFlight.current === readId)
                readFlight.current = null;
        }
    }, [queryKey], { queryKey, enabled: canRead, retryCount: 0 });
    const envelope = query.data;
    let data: T | null = null, poolError: string | null = null;
    let ready = canRead && !!envelope && ownRead(envelope.ticket) && same(envelope.owner, owner)
        && readFlight.current === null && accepted.current?.readId === envelope.readId
        && !query.loading && !query.refreshing && !query.error && !query.refreshError && !query.previewData && !query.tableMissing
        && !query.cacheMeta.fromCache && !query.cacheMeta.partialDetail;
    if (ready && envelope && owner) {
        try {
            data = capture(envelope.value, owner.tenantId);
            if (!same(data, accepted.current?.value))
                throw Error('Der geladene Wundbestand hat sich geändert. Bitte neu laden.');
        }
        catch (cause) {
            ready = false;
            data = null;
            poolError = cause instanceof Error ? cause.message : 'Der Wundbestand ist nicht bestätigt.';
        }
    }
    const renderTicket = boundary.current.ticket, renderReadId = envelope?.readId ?? null;
    const renderOriginal = data === null ? null : structuredClone(data);
    const latest = useRef({ envelope, ready, queryKey, refresh: query.refresh });
    latest.current = { envelope, ready, queryKey, refresh: query.refresh };
    function current(): T | null {
        const now = latest.current, original = accepted.current;
        if (!owner || !ownRead(renderTicket) || !now.ready || now.queryKey !== queryKey || !now.envelope || !original
            || readFlight.current !== null || original.readId !== renderReadId || now.envelope.readId !== renderReadId
            || now.envelope.ticket !== renderTicket || !same(now.envelope.owner, owner))
            return null;
        try {
            const value = capture(now.envelope.value, owner.tenantId);
            return same(value, original.value) && same(value, renderOriginal) ? value : null;
        }
        catch {
            return null;
        }
    }
    function mayManage() { return !!current() && runtime.current.access.canManage; }
    function refresh() {
        if (!ownRead(renderTicket))
            return;
        accepted.current = null;
        void latest.current.refresh();
    }
    return { canRead, ready, data, current, mayManage, refresh,
        loading: query.loading || query.refreshing || readFlight.current !== null,
        error: poolError ?? query.error ?? query.refreshError ?? 'Die aktuelle Wunddokumentation ist noch nicht bestätigt. Bitte neu laden.' };
}
