// Generated native presentation from src/lib/pflege/fallRiskReviewOriginals.web.ts. Update through scripts/port-native-workspaces.mjs.
import type { ServiceResult } from '@/types';
import { getSupabaseClient } from "../supabase/client.ts";
import { getServiceMode } from '@/lib/services/mode';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { withServiceQueryTimeout } from '@/lib/services/queryTimeout';
import { carePermissionOwner, sameCarePermissionOwner, type CarePermissionAuth, type CarePermissionOwner } from "../permissions/carePermissionOwner.native.ts";
import { cloneClientNativeOriginal, freezeClientNativeOriginal, type ClientNativeRow } from "../clients/clientRecordNativeOriginal.native.ts";
import { MentalHealthOriginalReader, currentMentalHealthOriginalsWeb, isCurrentMentalHealthOriginalContextWeb, type MentalHealthReceipt, type MentalHealthRawOriginals } from "../careAssessment/mentalHealthOriginals.native.ts";
import { woundUuid } from './woundCareDomain';
export const FALL_REVIEW_READ_KEYS = ['pflege.plans.view', 'pflege.risks.view', 'pflege.audit.view'] as const;
export type FallRiskReviewReadKey = typeof FALL_REVIEW_READ_KEYS[number];
/** Latest native hook origin and can, not a copied list, old query envelope or role-default grant. */
export type FallRiskReviewAccess = {
    auth: CarePermissionAuth;
    tenantId: string | null;
    clientId: string;
    assessmentId: string;
    permissions: readonly unknown[];
    can: (key: FallRiskReviewReadKey) => boolean;
};
/** A genuinely empty opaque token. Counts and originals are separate query-free private operations. */
export type FallRiskReviewReceipt = Readonly<Record<never, never>>;
export type FallRiskReviewRawOriginals = Readonly<{
    sis: MentalHealthRawOriginals;
    audits: readonly ClientNativeRow[];
}>;
type Context = {
    owner: CarePermissionOwner;
    clientId: string;
    assessmentId: string;
    origin: readonly unknown[];
};
type Entry = {
    serial: number;
    lifetime: number;
    valid: boolean;
    checking: boolean;
    context: Context;
    db: NonNullable<ReturnType<typeof getSupabaseClient>>;
    sis: MentalHealthRawOriginals;
    originals: FallRiskReviewRawOriginals | null;
};
type ReaderState = {
    alive: boolean;
    lifetime: number;
    serial: number;
    readonly access: () => FallRiskReviewAccess;
    readonly sisReader: MentalHealthOriginalReader;
    readonly sisReceipt: MentalHealthReceipt;
    readonly receipts: WeakMap<FallRiskReviewReceipt, Entry>;
};
const readers = new WeakMap<object, ReaderState>();
const denied = () => Error('Der eigene vollständige Sturzrisiko-Prüfungsbestand ist nicht aktuell oder nicht freigegeben.');
const plain = (value: unknown): value is ClientNativeRow => !!value && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
function own(value: unknown, key: string, optional = false): unknown {
    if (!plain(value))
        throw denied();
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor) {
        if (optional)
            return undefined;
        throw denied();
    }
    if (!descriptor.enumerable || !('value' in descriptor))
        throw denied();
    return descriptor.value;
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
    auth: CarePermissionAuth;
    owner: CarePermissionOwner | null;
    clientId: string;
    assessmentId: string;
    db: unknown;
};
function expectedContext(input: unknown): ExpectedContext {
    const keys = ['auth', 'tenantId', 'clientId', 'assessmentId', 'sdk'];
    if (!plain(input) || Reflect.ownKeys(input).some(k => typeof k !== 'string' || !keys.includes(k)))
        throw denied();
    const auth = captureAuth(own(input, 'auth')), tenantId = own(input, 'tenantId'), clientId = own(input, 'clientId'), assessmentId = own(input, 'assessmentId'), db = own(input, 'sdk');
    if (tenantId !== null && !woundUuid(tenantId) || !woundUuid(clientId) || !woundUuid(assessmentId) || db !== null && typeof db !== 'object')
        throw denied();
    return { auth, owner: carePermissionOwner(auth, tenantId as string | null, false), clientId, assessmentId, db };
}
function captureAccess(getAccess: () => FallRiskReviewAccess): {
    context: Context;
    can: FallRiskReviewAccess['can'];
    auth: CarePermissionAuth;
} {
    const input = getAccess(), auth = captureAuth(own(input, 'auth'));
    const tenantId = own(input, 'tenantId'), clientId = own(input, 'clientId'), assessmentId = own(input, 'assessmentId'), origin = own(input, 'permissions'), can = own(input, 'can'), copy = cloneClientNativeOriginal(origin);
    if (!Array.isArray(copy) || !Object.isFrozen(origin) || copy.some(key => typeof key !== 'string') || !FALL_REVIEW_READ_KEYS.every(key => copy.includes(key)))
        throw denied();
    const owner = carePermissionOwner(auth, typeof tenantId === 'string' ? tenantId : null, false);
    if (!owner || owner.demo || !woundUuid(clientId) || !woundUuid(assessmentId) || typeof can !== 'function')
        throw denied();
    return { context: { owner, clientId, assessmentId, origin: origin as readonly unknown[] }, can: can as FallRiskReviewAccess['can'], auth };
}
const same = (a: Context, b: Context) => sameCarePermissionOwner(a.owner, b.owner) && a.clientId === b.clientId && a.assessmentId === b.assessmentId && a.origin === b.origin;
function scopeSis(sis: MentalHealthRawOriginals, context: Context): void {
    const row = sis.assessment;
    if (own(row, 'tenant_id') !== context.owner.tenantId || own(row, 'id') !== context.assessmentId || own(row, 'subject_type') !== 'client' || own(row, 'subject_id') !== context.clientId)
        throw denied();
}
function response(value: unknown): unknown {
    const row = cloneClientNativeOriginal(value);
    if (!plain(row) || !Object.hasOwn(row, 'data') || !Object.hasOwn(row, 'error') || row.error !== null || !Object.hasOwn(row, 'status') || !Number.isSafeInteger(row.status) || Number(row.status) < 200 || Number(row.status) >= 300)
        throw denied();
    return row.data;
}
function snapshotScope(value: unknown, context: Context): void {
    // Unknown/null JSON is preserved. Supplied known scope cannot contradict this own client pool.
    if (!plain(value))
        return;
    if (Object.hasOwn(value, 'tenant_id') && value.tenant_id !== context.owner.tenantId || Object.hasOwn(value, 'client_id') && value.client_id !== context.clientId)
        throw denied();
}
function page(value: unknown, context: Context, cursor: string | null): readonly ClientNativeRow[] {
    const rows = cloneClientNativeOriginal(value);
    if (!Array.isArray(rows))
        throw denied();
    let previous = cursor;
    for (const row of rows) {
        if (!plain(row) || !woundUuid(own(row, 'id')) || own(row, 'tenant_id') !== context.owner.tenantId || own(row, 'client_id') !== context.clientId || own(row, 'entity_type') !== 'care_risk')
            throw denied();
        const id = String(row.id).toLowerCase();
        if (previous !== null && id <= previous)
            throw denied();
        previous = id;
        if (Object.hasOwn(row, 'before_data'))
            snapshotScope(row.before_data, context);
        if (Object.hasOwn(row, 'after_data'))
            snapshotScope(row.after_data, context);
    }
    return freezeClientNativeOriginal(rows);
}
/** Additional whole own-client care_risk audit originals. No SIS reread, native target FK,
 * active Pflegecase, clinical event/plan/reassessment link, immutable as-of or DB atomicity is proven. */
export class FallRiskReviewOriginalReader {
    constructor(getAccess: () => FallRiskReviewAccess, sisReader: MentalHealthOriginalReader, sisReceipt: MentalHealthReceipt) { readers.set(this, { alive: false, lifetime: 0, serial: 0, access: getAccess, sisReader, sisReceipt, receipts: new WeakMap() }); }
    mount(): void { const state = readers.get(this); if (state && !state.alive) {
        state.alive = true;
        state.lifetime++;
    } }
    dispose(): void { const state = readers.get(this); if (state) {
        state.alive = false;
        state.lifetime++;
        state.serial++;
    } }
    async read(): Promise<ServiceResult<FallRiskReviewReceipt>> {
        const state = readers.get(this);
        if (!state)
            return { ok: false, error: denied().message };
        let entry: Entry | null = null;
        const serial = ++state.serial;
        try {
            if (!state.alive || !(state.sisReader instanceof MentalHealthOriginalReader))
                throw denied();
            const sis = currentMentalHealthOriginalsWeb(state.sisReader, state.sisReceipt), { context } = captureAccess(state.access), db = getSupabaseClient();
            if (!sis || !db)
                throw denied();
            scopeSis(sis, context);
            entry = { serial, lifetime: state.lifetime, valid: true, checking: false, context, db, sis, originals: null };
            gate(state, entry);
            const audits: ClientNativeRow[] = [];
            let cursor: string | null = null;
            for (;;) {
                gate(state, entry);
                let query = fromUnknownTable(db, 'care_audit_events').select('*').eq('tenant_id', context.owner.tenantId).eq('client_id', context.clientId).eq('entity_type', 'care_risk').order('id', { ascending: true }).limit(200);
                if (cursor !== null)
                    query = query.gt('id', cursor);
                const result = await withServiceQueryTimeout(new Promise<unknown>((resolve, reject) => { try {
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
                const data = response(result);
                gate(state, entry);
                const rows = page(data, context, cursor);
                gate(state, entry);
                if (!rows.length)
                    break;
                audits.push(...rows);
                cursor = String(rows[rows.length - 1].id).toLowerCase();
            }
            entry.originals = freezeClientNativeOriginal({ sis, audits });
            gate(state, entry);
            const receipt = Object.freeze({});
            state.receipts.set(receipt, entry);
            return { ok: true, data: receipt };
        }
        catch (error) {
            if (entry)
                entry.valid = false;
            return { ok: false, error: error instanceof Error ? error.message : 'Der eigene Risiko-Prüfungsbestand ist ungeklärt.' };
        }
    }
    current(receipt: FallRiskReviewReceipt): boolean { return currentFallRiskReviewOriginalsWeb(this, receipt) !== null; }
    counts(receipt: FallRiskReviewReceipt): Readonly<{
        audits: number;
    }> | null { const raw = currentFallRiskReviewOriginalsWeb(this, receipt); return raw ? Object.freeze({ audits: raw.audits.length }) : null; }
    currentOriginals(receipt: FallRiskReviewReceipt): FallRiskReviewRawOriginals | null { return currentFallRiskReviewOriginalsWeb(this, receipt); }
    boundSis(receipt: FallRiskReviewReceipt, reader: MentalHealthOriginalReader, sisReceipt: MentalHealthReceipt): boolean { return isCurrentFallRiskReviewSisBindingWeb(this, receipt, reader, sisReceipt); }
}
function ownEntry(state: ReaderState, entry: Entry): void { if (!entry.valid || !state.alive || entry.lifetime !== state.lifetime || entry.serial !== state.serial)
    throw denied(); }
function authority(state: ReaderState, entry: Entry): void {
    ownEntry(state, entry);
    // Let the original reader observe actual owner/origin/plan-right loss too; a matching restore
    // must not make an old SIS generation usable merely because this additional gate failed first.
    if (!(state.sisReader instanceof MentalHealthOriginalReader) || currentMentalHealthOriginalsWeb(state.sisReader, state.sisReceipt) !== entry.sis)
        throw denied();
    const current = captureAccess(state.access);
    if (!same(current.context, entry.context))
        throw denied();
    for (const key of FALL_REVIEW_READ_KEYS) {
        const grant: unknown = current.can(key);
        if (grant !== true) {
            if (grant instanceof Promise)
                void grant.catch(() => { });
            throw denied();
        }
    }
    if (!same(captureAccess(state.access).context, entry.context))
        throw denied();
    if (!(state.sisReader instanceof MentalHealthOriginalReader) || currentMentalHealthOriginalsWeb(state.sisReader, state.sisReceipt) !== entry.sis)
        throw denied();
    // The bound SIS gate invokes SDK/mode accessors too. Inspect all three native rights afterwards.
    const after = captureAccess(state.access);
    if (!same(after.context, entry.context))
        throw denied();
    for (const key of FALL_REVIEW_READ_KEYS) {
        const grant: unknown = after.can(key);
        if (grant !== true) {
            if (grant instanceof Promise)
                void grant.catch(() => { });
            throw denied();
        }
    }
    if (!same(captureAccess(state.access).context, entry.context))
        throw denied();
    // Exact M owner/session/SDK scope is intrinsic to this F read, not inferred from shared row IDs.
    if (!isCurrentMentalHealthOriginalContextWeb(state.sisReader, state.sisReceipt, entry.sis, { auth: after.auth, tenantId: entry.context.owner.tenantId, clientId: entry.context.clientId, assessmentId: entry.context.assessmentId, sdk: entry.db }))
        throw denied();
    // M's fixed context gate also inspects its own SDK/can. Check F's three current rights afterwards.
    const final = captureAccess(state.access);
    if (!same(final.context, entry.context))
        throw denied();
    for (const key of FALL_REVIEW_READ_KEYS) {
        const grant: unknown = final.can(key);
        if (grant !== true) {
            if (grant instanceof Promise)
                void grant.catch(() => { });
            throw denied();
        }
    }
    if (!same(captureAccess(state.access).context, entry.context))
        throw denied();
    scopeSis(entry.sis, entry.context);
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
export function currentFallRiskReviewOriginalsWeb(reader: unknown, receipt: unknown): FallRiskReviewRawOriginals | null {
    if (!reader || typeof reader !== 'object')
        return null;
    const state = readers.get(reader), entry = state?.receipts.get(receipt as FallRiskReviewReceipt);
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
/** Fixed original association, never a dynamically supplied boundSis answer. */
export function isCurrentFallRiskReviewSisBindingWeb(reader: unknown, receipt: unknown, sisReader: unknown, sisReceipt: unknown): boolean {
    if (!reader || typeof reader !== 'object')
        return false;
    const state = readers.get(reader), entry = state?.receipts.get(receipt as FallRiskReviewReceipt);
    if (!state || !entry)
        return false;
    try {
        gate(state, entry);
        return entry.originals !== null && sisReader === state.sisReader && sisReceipt === state.sisReceipt;
    }
    catch {
        return false;
    }
}
export function isCurrentFallRiskReviewOriginalContextWeb(reader: unknown, receipt: unknown, exactRaw: unknown, expected: unknown): boolean {
    let wanted: ExpectedContext;
    try {
        wanted = expectedContext(expected);
    }
    catch {
        return false;
    }
    if (!reader || typeof reader !== 'object')
        return false;
    const state = readers.get(reader), entry = state?.receipts.get(receipt as FallRiskReviewReceipt);
    if (!state || !entry)
        return false;
    try {
        gate(state, entry);
    }
    catch {
        return false;
    }
    if (entry.originals === null || entry.originals !== exactRaw || !wanted.owner || !sameCarePermissionOwner(entry.context.owner, wanted.owner) || entry.context.clientId !== wanted.clientId || entry.context.assessmentId !== wanted.assessmentId || entry.db !== wanted.db)
        return false;
    // Reconstruct only the already descriptor-captured native data, never reread caller getters.
    const nativeExpected = { auth: wanted.auth, tenantId: wanted.owner.tenantId, clientId: wanted.clientId, assessmentId: wanted.assessmentId, sdk: wanted.db };
    if (!isCurrentMentalHealthOriginalContextWeb(state.sisReader, state.sisReceipt, entry.sis, nativeExpected))
        return false;
    try {
        gate(state, entry);
        return entry.originals === exactRaw;
    }
    catch {
        return false;
    }
}
