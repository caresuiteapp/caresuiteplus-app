// Generated native presentation from src/lib/pflege/careQualityVisitOriginals.web.ts. Update through scripts/port-native-workspaces.mjs.
import type { ServiceResult } from '@/types';
import { getSupabaseClient } from "../supabase/client.ts";
import { getServiceMode } from '@/lib/services/mode';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { withServiceQueryTimeout } from '@/lib/services/queryTimeout';
import { carePermissionOwner, sameCarePermissionOwner, type CarePermissionAuth, type CarePermissionOwner } from "../permissions/carePermissionOwner.native.ts";
import { cloneClientNativeOriginal, freezeClientNativeOriginal, type ClientNativeRow } from "../clients/clientRecordNativeOriginal.native.ts";
import { woundUuid } from './woundCareDomain';
export const VISIT_ORIGINAL_READ_KEYS = ['pflege.visits.view', 'pflege.plans.view', 'pflege.audit.view', 'office.clients.view_sensitive'] as const;
export type VisitOriginalReadKey = typeof VISIT_ORIGINAL_READ_KEYS[number];
/** The same actual native-hook read origin and live can must be supplied; a role-default list is not a grant. */
export type CareQualityVisitOriginalAccess = {
    auth: CarePermissionAuth;
    tenantId: string | null;
    clientId: string;
    permissions: readonly unknown[];
    can: (key: VisitOriginalReadKey) => boolean;
};
export type CareQualityVisitOriginalReceipt = Readonly<Record<never, never>>;
export const VISIT_ORIGINAL_POOLS = { visits: 'care_quality_visits', audits: 'care_audit_events', plans: 'care_plans' } as const;
export type VisitOriginalPool = keyof typeof VISIT_ORIGINAL_POOLS;
export type CareQualityVisitRawOriginals = Readonly<Record<VisitOriginalPool, readonly ClientNativeRow[]>>;
type Context = {
    owner: CarePermissionOwner;
    clientId: string;
    origin: readonly unknown[];
};
type Entry = {
    serial: number;
    lifetime: number;
    valid: boolean;
    checking: boolean;
    context: Context;
    db: NonNullable<ReturnType<typeof getSupabaseClient>>;
    originals: CareQualityVisitRawOriginals | null;
};
type ReaderState = {
    alive: boolean;
    lifetime: number;
    serial: number;
    readonly access: () => CareQualityVisitOriginalAccess;
    readonly receipts: WeakMap<CareQualityVisitOriginalReceipt, Entry>;
};
// Constructor membership, source state and minted receipts are module-owned, never public/overridable fields.
const readers = new WeakMap<object, ReaderState>();
const denied = () => Error('Die eigenen Visitenoriginale sind nicht aktuell oder nicht zum Lesen freigegeben.');
const plain = (value: unknown): value is ClientNativeRow => !!value && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
function own(value: unknown, key: string, optional = false): unknown {
    if (!plain(value))
        throw denied();
    const d = Object.getOwnPropertyDescriptor(value, key);
    if (!d) {
        if (optional)
            return undefined;
        throw denied();
    }
    if (!d.enumerable || !('value' in d))
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
    if (!woundUuid(id) || roleKey !== undefined && roleKey !== null && typeof roleKey !== 'string')
        throw denied();
    return { id, roleKey };
}
function captureAuth(raw: unknown): CarePermissionAuth {
    const profile = own(raw, 'profile'), session = own(raw, 'session'), p = identity(profile);
    const authReady = own(raw, 'authReady'), isAuthenticated = own(raw, 'isAuthenticated'), isLoading = own(raw, 'isLoading'), profileBootstrapError = own(raw, 'profileBootstrapError'), portalSession = own(raw, 'portalSession');
    if (typeof authReady !== 'boolean' || typeof isAuthenticated !== 'boolean' || typeof isLoading !== 'boolean' || profileBootstrapError !== null && typeof profileBootstrapError !== 'string' || portalSession !== null)
        throw denied();
    const user = identity(own(raw, 'user')), s = session === null ? null : { user: identity(own(session, 'user'))!, accessToken: own(session, 'accessToken'), expiresAt: own(session, 'expiresAt') };
    if (s && (typeof s.accessToken !== 'string' || s.expiresAt !== null && (typeof s.expiresAt !== 'number' || !Number.isFinite(s.expiresAt))))
        throw denied();
    const tenantId = p === null ? null : own(profile, 'tenantId');
    if (tenantId !== null && typeof tenantId !== 'string')
        throw denied();
    return { authReady, isAuthenticated, isLoading, profileBootstrapError, portalSession, profile: p === null ? null : { ...p, tenantId }, user, session: s as CarePermissionAuth['session'] };
}
type ExpectedContext = {
    owner: CarePermissionOwner | null;
    clientId: string;
    db: unknown;
};
function expectedContext(input: unknown): ExpectedContext {
    const keys = ['auth', 'tenantId', 'clientId', 'sdk'];
    if (!plain(input) || Reflect.ownKeys(input).some(k => typeof k !== 'string' || !keys.includes(k)))
        throw denied();
    const auth = captureAuth(own(input, 'auth')), tenantId = own(input, 'tenantId'), clientId = own(input, 'clientId'), db = own(input, 'sdk');
    if (tenantId !== null && !woundUuid(tenantId) || !woundUuid(clientId) || db !== null && typeof db !== 'object')
        throw denied();
    return { owner: carePermissionOwner(auth, tenantId as string | null, false), clientId, db };
}
function capture(getAccess: () => CareQualityVisitOriginalAccess): {
    context: Context;
    can: CareQualityVisitOriginalAccess['can'];
} {
    const access = getAccess(), auth = captureAuth(own(access, 'auth'));
    const tenantId = own(access, 'tenantId'), clientId = own(access, 'clientId'), origin = own(access, 'permissions'), can = own(access, 'can'), copy = cloneClientNativeOriginal(origin);
    if (!Array.isArray(copy) || !Object.isFrozen(origin) || copy.some(key => typeof key !== 'string') || !VISIT_ORIGINAL_READ_KEYS.every(key => copy.includes(key)))
        throw denied();
    const owner = carePermissionOwner(auth, typeof tenantId === 'string' ? tenantId : null, false);
    if (!owner || owner.demo || !woundUuid(clientId) || typeof can !== 'function')
        throw denied();
    return { context: { owner, clientId, origin: origin as readonly unknown[] }, can: can as CareQualityVisitOriginalAccess['can'] };
}
const same = (a: Context, b: Context) => sameCarePermissionOwner(a.owner, b.owner) && a.clientId === b.clientId && a.origin === b.origin;
const nullableId = (row: ClientNativeRow, key: string) => { const value = own(row, key); if (value !== null && !woundUuid(value))
    throw denied(); };
function snapshotScope(value: unknown, context: Context): void {
    // Legacy scalar/array/partial JSON is preserved as opaque. Supplied own native scope must not be foreign.
    if (!plain(value))
        return;
    if (Object.hasOwn(value, 'tenant_id') && woundUuid(value.tenant_id) && value.tenant_id.toLowerCase() !== context.owner.tenantId.toLowerCase() || Object.hasOwn(value, 'client_id') && woundUuid(value.client_id) && value.client_id.toLowerCase() !== context.clientId.toLowerCase())
        throw denied();
}
function page(input: unknown, context: Context, cursor: string | null, pool: VisitOriginalPool): readonly ClientNativeRow[] {
    const rows = cloneClientNativeOriginal(input);
    if (!Array.isArray(rows))
        throw denied();
    let previous = cursor;
    for (const row of rows) {
        if (!plain(row) || !woundUuid(own(row, 'id')) || own(row, 'tenant_id') !== context.owner.tenantId || own(row, 'client_id') !== context.clientId)
            throw denied();
        const id = String(row.id).toLowerCase();
        if (previous !== null && id <= previous)
            throw denied();
        previous = id;
        if (pool !== 'plans')
            nullableId(row, 'care_plan_id');
        if (pool === 'audits') {
            if (own(row, 'entity_type') !== 'care_quality_visit')
                throw denied();
            nullableId(row, 'entity_id');
            for (const key of ['before_data', 'after_data'])
                if (Object.hasOwn(row, key))
                    snapshotScope(row[key], context);
        }
    }
    return freezeClientNativeOriginal(rows);
}
function response(input: unknown): unknown {
    const result = cloneClientNativeOriginal(input);
    if (!plain(result) || !Object.hasOwn(result, 'data') || !Object.hasOwn(result, 'error') || result.error !== null || Object.hasOwn(result, 'status') && (!Number.isSafeInteger(result.status) || Number(result.status) < 200 || Number(result.status) >= 300))
        throw denied();
    return result.data;
}
/** Three explicitly scoped delivered native pools, not an atomic DB snapshot, an as-of revision register,
 * active care case, employee identity, clinical performance or task/approval grant. SELECT only. */
export class CareQualityVisitOriginalReader {
    constructor(getAccess: () => CareQualityVisitOriginalAccess) { readers.set(this, { alive: false, lifetime: 0, serial: 0, access: getAccess, receipts: new WeakMap() }); }
    mount(): void { const state = readers.get(this); if (state && !state.alive) {
        state.alive = true;
        state.lifetime++;
    } }
    dispose(): void { const state = readers.get(this); if (state) {
        state.alive = false;
        state.lifetime++;
        state.serial++;
    } }
    async read(): Promise<ServiceResult<CareQualityVisitOriginalReceipt>> {
        const state = readers.get(this);
        if (!state)
            return { ok: false, error: denied().message };
        const serial = ++state.serial;
        let entry: Entry | null = null;
        try {
            if (!state.alive || typeof state.access !== 'function')
                throw denied();
            const { context } = capture(state.access), db = getSupabaseClient();
            if (!db)
                throw denied();
            entry = { serial, lifetime: state.lifetime, valid: true, checking: false, context, db, originals: null };
            gate(state, entry);
            const pools = {} as Record<VisitOriginalPool, ClientNativeRow[]>;
            for (const [pool, table] of Object.entries(VISIT_ORIGINAL_POOLS) as [
                VisitOriginalPool,
                string
            ][]) {
                const originals: ClientNativeRow[] = [];
                let cursor: string | null = null;
                for (;;) {
                    gate(state, entry);
                    let query = fromUnknownTable(db, table).select('*').eq('tenant_id', context.owner.tenantId).eq('client_id', context.clientId).order('id', { ascending: true }).limit(200);
                    if (pool === 'audits')
                        query = query.eq('entity_type', 'care_quality_visit');
                    if (cursor !== null)
                        query = query.gt('id', cursor);
                    const raw = await withServiceQueryTimeout(new Promise<unknown>((resolve, reject) => { try {
                        const then = query?.then, sameThen = query?.then;
                        if (typeof then !== 'function' || sameThen !== then)
                            throw denied();
                        gate(state, entry!);
                        Reflect.apply(then, query, [resolve, reject]);
                    }
                    catch (error) {
                        reject(error);
                    } }));
                    gate(state, entry);
                    const data = response(raw);
                    gate(state, entry);
                    const delivered = page(data, context, cursor, pool);
                    gate(state, entry);
                    if (!delivered.length)
                        break;
                    originals.push(...delivered);
                    cursor = String(delivered[delivered.length - 1].id).toLowerCase();
                }
                pools[pool] = originals;
            }
            entry.originals = freezeClientNativeOriginal(pools);
            gate(state, entry);
            const receipt = Object.freeze({});
            state.receipts.set(receipt, entry);
            return { ok: true, data: receipt };
        }
        catch (error) {
            if (entry)
                entry.valid = false;
            return { ok: false, error: error instanceof Error ? error.message : 'Die eigenen Visitenoriginale sind ungeklärt.' };
        }
    }
    current(receipt: CareQualityVisitOriginalReceipt): boolean { return currentCareQualityVisitOriginalsWeb(this, receipt) !== null; }
    /** Private composition only. Never place raw originals or credentials in UI/Query DTO/AI props. */
    currentOriginals(receipt: CareQualityVisitOriginalReceipt): CareQualityVisitRawOriginals | null { return currentCareQualityVisitOriginalsWeb(this, receipt); }
    counts(receipt: CareQualityVisitOriginalReceipt): Readonly<Record<VisitOriginalPool, number>> | null { const raw = currentCareQualityVisitOriginalsWeb(this, receipt); return raw ? Object.freeze({ visits: raw.visits.length, audits: raw.audits.length, plans: raw.plans.length }) : null; }
}
function ownEntry(state: ReaderState, entry: Entry): void { if (!entry.valid || !state.alive || entry.lifetime !== state.lifetime || entry.serial !== state.serial)
    throw denied(); }
function authority(state: ReaderState, entry: Entry): void {
    ownEntry(state, entry);
    const current = capture(state.access);
    if (!same(current.context, entry.context))
        throw denied();
    for (const key of VISIT_ORIGINAL_READ_KEYS) {
        const grant: unknown = current.can(key);
        if (grant !== true) {
            if (grant instanceof Promise)
                void grant.catch(() => { });
            throw denied();
        }
    }
    if (!same(capture(state.access).context, entry.context))
        throw denied();
    ownEntry(state, entry);
}
function gate(state: ReaderState, entry: Entry): void {
    if (!entry.valid)
        throw denied();
    if (entry.checking) {
        entry.valid = false;
        throw denied();
    }
    entry.checking = true;
    try {
        authority(state, entry);
        if (getSupabaseClient() !== entry.db || getServiceMode() !== 'supabase')
            throw denied();
        authority(state, entry);
        if (getServiceMode() !== 'supabase')
            throw denied();
        authority(state, entry);
        ownEntry(state, entry);
        if (getSupabaseClient() !== entry.db)
            throw denied();
        authority(state, entry);
        // Bounded final identity observations after mode, then native grants/lifetime. No arbitrary getter atomics.
        if (getServiceMode() !== 'supabase' || getSupabaseClient() !== entry.db)
            throw denied();
        authority(state, entry);
        ownEntry(state, entry);
    }
    catch (error) {
        entry.valid = false;
        throw error;
    }
    finally {
        entry.checking = false;
    }
}
/** Fixed module-owned recognition and lookup. A prototype, overridden method or copied receipt is not a mint. */
export function currentCareQualityVisitOriginalsWeb(reader: unknown, receipt: CareQualityVisitOriginalReceipt): CareQualityVisitRawOriginals | null {
    if (!reader || typeof reader !== 'object')
        return null;
    const state = readers.get(reader), entry = state?.receipts.get(receipt);
    if (!state || !entry)
        return null;
    try {
        gate(state, entry);
        return entry.originals;
    }
    catch {
        return null;
    }
}
export function isCurrentCareQualityVisitOriginalContextWeb(reader: unknown, receipt: unknown, exactRaw: unknown, expected: unknown): boolean {
    let wanted: ExpectedContext;
    try {
        wanted = expectedContext(expected);
    }
    catch {
        return false;
    }
    if (!reader || typeof reader !== 'object')
        return false;
    const state = readers.get(reader), entry = state?.receipts.get(receipt as CareQualityVisitOriginalReceipt);
    if (!state || !entry)
        return false;
    try {
        gate(state, entry);
    }
    catch {
        return false;
    }
    if (entry.originals === null || entry.originals !== exactRaw || !wanted.owner || !sameCarePermissionOwner(entry.context.owner, wanted.owner) || entry.context.clientId !== wanted.clientId || entry.db !== wanted.db)
        return false;
    try {
        gate(state, entry);
        return entry.originals === exactRaw;
    }
    catch {
        return false;
    }
}
