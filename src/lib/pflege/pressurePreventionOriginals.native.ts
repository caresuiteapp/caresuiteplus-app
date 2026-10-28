// Generated native presentation from src/lib/pflege/pressurePreventionOriginals.web.ts. Update through scripts/port-native-workspaces.mjs.
import type { ServiceResult } from '@/types';
import { getSupabaseClient } from "../supabase/client.ts";
import { getServiceMode } from '@/lib/services/mode';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { withServiceQueryTimeout } from '@/lib/services/queryTimeout';
import { carePermissionOwner, sameCarePermissionOwner, type CarePermissionOwner, type CarePermissionAuth } from "../permissions/carePermissionOwner.native.ts";
import { cloneClientNativeOriginal, freezeClientNativeOriginal, type ClientNativeRow } from "../clients/clientRecordNativeOriginal.native.ts";
import { woundUuid } from './woundCareDomain';
/** `permissions` must be the latest actual native-hook frozen list, not a copied/reused list or an old query envelope. */
export type PressurePreventionAccess = {
    auth: CarePermissionAuth;
    tenantId: string | null;
    clientId: string;
    markerId: string;
    can: (key: 'pflege.plans.view') => boolean;
    permissions: readonly unknown[];
};
export type PressurePreventionReceipt = Readonly<{
    kind: 'pressure_prevention_originals';
    assessmentCount: number;
    historyCount: number;
}>;
export type PressurePreventionRawOriginals = Readonly<{
    marker: ClientNativeRow;
    assessments: readonly ClientNativeRow[];
    history: readonly ClientNativeRow[];
}>;
type NativeContext = {
    owner: CarePermissionOwner;
    clientId: string;
    markerId: string;
    can: PressurePreventionAccess['can'];
    permissionOrigin: readonly unknown[];
};
type Entry = {
    serial: number;
    lifetime: number;
    valid: boolean;
    checking: boolean;
    context: NativeContext;
    db: NonNullable<ReturnType<typeof getSupabaseClient>>;
    originals: PressurePreventionRawOriginals | null;
};
const denied = () => Error('Der eigene vollständige Druckverletzungsbestand ist nicht aktuell oder nicht freigegeben.');
const plain = (v: unknown): v is ClientNativeRow => !!v && typeof v === 'object' && !Array.isArray(v) && [Object.prototype, null].includes(Object.getPrototypeOf(v));
function own(value: unknown, key: string, optional = false): unknown {
    if (!plain(value))
        throw denied();
    const d = Object.getOwnPropertyDescriptor(value, key);
    if (!d) {
        if (optional)
            return undefined;
        throw denied();
    }
    if (!('value' in d) || !d.enumerable)
        throw denied();
    return d.value;
}
function identity(value: unknown): {
    id: string;
    roleKey?: string | null;
} | null {
    if (value === null)
        return null;
    const id = own(value, 'id'), roleKey = own(value, 'roleKey', true);
    if (typeof id !== 'string' || roleKey !== undefined && roleKey !== null && typeof roleKey !== 'string')
        throw denied();
    return { id, roleKey };
}
/** Project only actual auth data descriptors, without executing getters or cloning auth callbacks. */
function captureContext(getAccess: () => PressurePreventionAccess): NativeContext {
    const input = getAccess(), raw = own(input, 'auth'), profile = own(raw, 'profile'), session = own(raw, 'session');
    const p = identity(profile), s = session === null ? null : { user: identity(own(session, 'user'))!, accessToken: own(session, 'accessToken') as string, expiresAt: own(session, 'expiresAt') as number | null };
    const auth = { authReady: own(raw, 'authReady'), isAuthenticated: own(raw, 'isAuthenticated'), isLoading: own(raw, 'isLoading'), profileBootstrapError: own(raw, 'profileBootstrapError'), profile: p === null ? null : { ...p, tenantId: own(profile, 'tenantId') }, user: identity(own(raw, 'user')), session: s, portalSession: own(raw, 'portalSession') } as CarePermissionAuth;
    const tenantId = own(input, 'tenantId'), clientId = own(input, 'clientId'), markerId = own(input, 'markerId'), can = own(input, 'can'), permissionOrigin = own(input, 'permissions');
    const permissionCopy = cloneClientNativeOriginal(permissionOrigin);
    if (!Array.isArray(permissionCopy) || !Object.isFrozen(permissionOrigin) || permissionCopy.some(key => typeof key !== 'string') || !permissionCopy.includes('pflege.plans.view'))
        throw denied();
    const owner = carePermissionOwner(auth, typeof tenantId === 'string' ? tenantId : null, false);
    if (!owner || owner.demo || !woundUuid(clientId) || !woundUuid(markerId) || typeof can !== 'function')
        throw denied();
    return { owner, clientId, markerId, can: can as PressurePreventionAccess['can'], permissionOrigin: permissionOrigin as readonly unknown[] };
}
function sameContext(a: NativeContext, b: NativeContext): boolean { return sameCarePermissionOwner(a.owner, b.owner) && a.clientId === b.clientId && a.markerId === b.markerId && a.permissionOrigin === b.permissionOrigin; }
function scope(row: ClientNativeRow, context: NativeContext, marker: boolean): void {
    const required = ['id', 'tenant_id', 'subject_type', 'subject_id', 'client_id', 'resident_record_id', ...(marker ? [] : ['marker_id'])];
    if (required.some(key => !Object.hasOwn(row, key)))
        throw denied();
    if (!woundUuid(row.id) || row.tenant_id !== context.owner.tenantId || row.subject_type !== 'client' || row.subject_id !== context.clientId || row.client_id !== context.clientId || row.resident_record_id !== null ||
        (marker ? row.id !== context.markerId : row.marker_id !== context.markerId))
        throw denied();
}
function historicalReference(row: ClientNativeRow, context: NativeContext): void {
    const snap = row.snapshot;
    if (!plain(snap))
        return;
    // Existing created/updated history may contain to_jsonb(marker). Its supplied native scope is not a second read grant.
    for (const [key, value] of Object.entries({ tenant_id: context.owner.tenantId, subject_type: 'client', subject_id: context.clientId, client_id: context.clientId, resident_record_id: null, marker_id: context.markerId }))
        if (Object.hasOwn(snap, key) && snap[key] !== value)
            throw denied();
    if ((row.event_type === 'created' || row.event_type === 'updated') && Object.hasOwn(snap, 'id') && snap.id !== context.markerId)
        throw denied();
}
function page(input: unknown, context: NativeContext, cursor: string | null, kind: 'marker' | 'assessments' | 'history'): ClientNativeRow[] {
    const cloned = cloneClientNativeOriginal(input);
    if (!Array.isArray(cloned))
        throw denied();
    let previous = cursor;
    for (const row of cloned) {
        if (!plain(row))
            throw denied();
        scope(row, context, kind === 'marker');
        const id = String(row.id).toLowerCase();
        if (previous !== null && id <= previous)
            throw denied();
        previous = id;
        if (kind === 'history')
            historicalReference(row, context);
    }
    return freezeClientNativeOriginal(cloned);
}
function response(value: unknown): unknown {
    const cloned = cloneClientNativeOriginal(value);
    if (!plain(cloned) || !Object.hasOwn(cloned, 'error') || cloned.error !== null || !Object.hasOwn(cloned, 'data') || Object.hasOwn(cloned, 'status') && (!Number.isSafeInteger(cloned.status) || Number(cloned.status) < 200 || Number(cloned.status) >= 300))
        throw denied();
    return cloned.data;
}
/** Private SELECT-only current native rows plus supplied history; no media, signatures, clinical performance,
 * complete assessment revision history or atomic database snapshot is established. */
export class PressurePreventionOriginalReader {
    private alive = false;
    private lifetime = 0;
    private serial = 0;
    private readonly access: () => PressurePreventionAccess;
    private readonly receipts = new WeakMap<PressurePreventionReceipt, Entry>();
    constructor(getAccess: () => PressurePreventionAccess) { this.access = getAccess; }
    mount(): void { if (!this.alive) {
        this.alive = true;
        this.lifetime++;
    } }
    dispose(): void { this.alive = false; this.lifetime++; this.serial++; }
    private ownEntry(entry: Entry): void { if (!entry.valid || !this.alive || entry.lifetime !== this.lifetime || entry.serial !== this.serial)
        throw denied(); }
    private authority(entry: Entry): void {
        this.ownEntry(entry);
        if (typeof this.access !== 'function')
            throw denied();
        const current = captureContext(this.access);
        if (!sameContext(current, entry.context))
            throw denied();
        const grant: unknown = current.can('pflege.plans.view');
        if (grant !== true) {
            if (grant instanceof Promise)
                void grant.catch(() => { });
            throw denied();
        }
        if (!sameContext(captureContext(this.access), entry.context))
            throw denied();
        this.ownEntry(entry);
    }
    private gate(entry: Entry): void {
        if (!entry.valid)
            throw denied();
        if (entry.checking) {
            entry.valid = false;
            throw denied();
        }
        entry.checking = true;
        try {
            this.authority(entry);
            // SDK and mode accessors can invalidate the native permission read. Inspect authority AFTER both,
            // including expiry without render and refresh with the same SDK/IDs; no old grant may revive.
            if (getSupabaseClient() !== entry.db || getServiceMode() !== 'supabase')
                throw denied();
            this.authority(entry);
            // A native can/context callback may in turn change mode. Recheck it, then inspect native grants
            // once more because the mode accessor itself may expire/refresh them. Bounded checks, no retry.
            if (getServiceMode() !== 'supabase')
                throw denied();
            this.authority(entry);
            // The mode/context callbacks may have replaced the SDK after its earlier comparison.
            // Compare it again before delivery/dispatch; a change closes this receipt permanently.
            if (getSupabaseClient() !== entry.db || getServiceMode() !== 'supabase' || getSupabaseClient() !== entry.db)
                throw denied();
            this.authority(entry);
            this.ownEntry(entry);
        }
        catch (error) {
            entry.valid = false;
            throw error;
        }
        finally {
            entry.checking = false;
        }
    }
    async read(): Promise<ServiceResult<PressurePreventionReceipt>> {
        let entry: Entry | null = null;
        const serial = ++this.serial;
        try {
            if (!this.alive || typeof this.access !== 'function')
                throw denied();
            const context = captureContext(this.access), db = getSupabaseClient();
            if (!db)
                throw denied();
            entry = { serial, lifetime: this.lifetime, valid: true, checking: false, context, db, originals: null };
            this.gate(entry);
            const dispatch = async (build: () => PromiseLike<unknown>): Promise<unknown> => {
                this.gate(entry!);
                const query = build();
                const result = await withServiceQueryTimeout(new Promise<unknown>((resolve, reject) => { try {
                    const then = query?.then, sameThen = query?.then;
                    if (typeof then !== 'function' || sameThen !== then)
                        throw denied();
                    this.gate(entry!);
                    Reflect.apply(then, query, [resolve, reject]);
                }
                catch (error) {
                    reject(error);
                } }));
                this.gate(entry!);
                const resultData = response(result);
                this.gate(entry!);
                return resultData;
            };
            const nativeScope = (table: string) => fromUnknownTable(db, table).select('*').eq('tenant_id', context.owner.tenantId).eq('subject_type', 'client').eq('subject_id', context.clientId).eq('client_id', context.clientId);
            const markers = page(await dispatch(() => nativeScope('body_map_markers').eq('id', context.markerId)), context, null, 'marker');
            this.gate(entry);
            if (markers.length !== 1)
                throw denied();
            const pools = {} as {
                assessments: ClientNativeRow[];
                history: ClientNativeRow[];
            };
            for (const [kind, table] of Object.entries({ assessments: 'pressure_injury_assessments', history: 'body_map_finding_history' }) as [
                'assessments' | 'history',
                string
            ][]) {
                const rows: ClientNativeRow[] = [];
                let cursor: string | null = null;
                for (;;) {
                    const raw = await dispatch(() => { let query = nativeScope(table).eq('marker_id', context.markerId).order('id', { ascending: true }).limit(200); if (cursor !== null)
                        query = query.gt('id', cursor); return query; });
                    const delivered = page(raw, context, cursor, kind);
                    this.gate(entry);
                    if (!delivered.length)
                        break;
                    rows.push(...delivered);
                    cursor = String(delivered[delivered.length - 1].id).toLowerCase();
                }
                pools[kind] = rows;
            }
            this.gate(entry);
            entry.originals = freezeClientNativeOriginal({ marker: markers[0], ...pools });
            this.gate(entry);
            const receipt = Object.freeze({ kind: 'pressure_prevention_originals' as const, assessmentCount: pools.assessments.length, historyCount: pools.history.length });
            this.receipts.set(receipt, entry);
            return { ok: true, data: receipt };
        }
        catch (error) {
            if (entry)
                entry.valid = false;
            return { ok: false, error: error instanceof Error ? error.message : 'Der eigene Originalbestand ist ungeklärt.' };
        }
    }
    /** Exact minted receipt only. Observed loss is permanent; a matching regrant requires a fresh read. */
    current(receipt: PressurePreventionReceipt): boolean { const entry = this.receipts.get(receipt); if (!entry)
        return false; try {
        this.gate(entry);
        return entry.originals !== null;
    }
    catch {
        return false;
    } }
    /** For private projection/controller composition only, never a shared DTO/UI/AI sidecar. */
    currentOriginals(receipt: PressurePreventionReceipt): PressurePreventionRawOriginals | null { const entry = this.receipts.get(receipt); if (!entry)
        return null; try {
        this.gate(entry);
        return entry.originals;
    }
    catch {
        return null;
    } }
}
