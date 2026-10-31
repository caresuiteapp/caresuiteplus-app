// Generated native presentation from src/lib/pflege/vitalDetailWriteRuntime.web.ts. Update through scripts/port-native-workspaces.mjs.
import { cloneClientNativeOriginal as clone, freezeClientNativeOriginal as freeze, sameClientNativeOriginal as same } from "../clients/clientRecordNativeOriginal.native.ts";
import { carePermissionOwner, carePermissionOwnerIsCurrent, type CarePermissionOwner, type CarePermissionAuth } from "../permissions/carePermissionOwner.native.ts";
import { getSupabaseClient } from "../supabase/client.ts";
import { getServiceMode } from '../services/mode';
import { createVitalDetailRuntimeWeb, captureVitalDetailReadWeb, assertVitalDetailReadWeb, assertVitalDetailSessionWeb, closeVitalDetailReadWeb, type VitalDetailReadLeaseWeb } from "./vitalDetailRuntime.native.ts";
import { fetchVitalDetailOriginalReadWeb, vitalDetailOriginalsWeb, vitalDetailProjectionWeb, type VitalDetailOriginalReadWeb, type VitalDetailOriginalsWeb } from "./vitalDetailOriginalRead.native.ts";
import { validateVitalFollowUp, type VitalFollowUpPayload } from './vitalMeasurementDomain.ts';
import { validateVitalInvalidation, type VitalInvalidationPayload } from './vitalHistoryDomain.ts';
import { woundInstant } from './woundCareDomain.ts';
import { vitalFollowUpChronologyError, validVitalActualTimeField } from "./vitalTimeDisplay.native.ts";
import { executeVitalDetailNativeWriteWeb, isOwnVitalDetailWriteOutcomeWeb, isSettledVitalDetailWriteOutcomeWeb, vitalDetailOwnWriteOriginalWeb } from "./vitalDetailNativeWrite.native.ts";
import type { VitalNativeReceiptScopeWeb } from "./vitalNativeWriteReceipt.native.ts";
type SDK = NonNullable<ReturnType<typeof getSupabaseClient>>;
type Can = (key: 'pflege.vitals.view' | 'pflege.vitals.manage') => unknown;
type Row = Readonly<Record<string, unknown>>;
export type VitalDetailOperationWeb = 'follow_up' | 'invalidation';
export type VitalDetailPayloadWeb = VitalFollowUpPayload | VitalInvalidationPayload;
export type VitalDetailWriteLiveWeb = {
    owner: CarePermissionOwner | null;
    auth: CarePermissionAuth;
    permissions: {
        tenantId: unknown;
        roleKey: unknown;
        can: Can;
    };
};
export type VitalDetailReadOriginWeb = Readonly<Record<never, never>>;
export type VitalDetailDeliveredReadWeb = Readonly<Record<never, never>>;
type Origin = {
    token: VitalDetailReadOriginWeb;
    can: Can;
    owner: CarePermissionOwner;
    id: number;
};
type Read = {
    token: VitalDetailDeliveredReadWeb;
    lease: VitalDetailReadLeaseWeb;
    receipt: VitalDetailOriginalReadWeb;
    originals: VitalDetailOriginalsWeb;
    projection: Row | null;
    ticket: number;
    origin: Origin;
};
type Pending = {
    id: string;
    payload: VitalDetailPayloadWeb;
    clientId: string;
    kind: VitalDetailOperationWeb;
    source: VitalDetailOriginalsWeb;
};
type Acknowledged = {
    id: string;
    source: 'confirmed_original' | 'stored_original';
    request: Pending;
    original: unknown;
};
type Store = {
    pending: Pending | null;
    ack: Acknowledged | null;
    archive: readonly Acknowledged[];
    conflict: boolean;
    flight: {
        runtime: VitalDetailWriteRuntimeWeb;
        token: object;
        version: number;
        frame: object;
    } | null;
    uncertain: boolean;
    version: number;
    epoch: number;
};
type Stores = {
    follow_up: Store;
    invalidation: Store;
    listeners: Set<() => void>;
};
export type VitalDetailWriteCaptureWeb = Readonly<Record<never, never>>;
type NativeBridge = {
    receiptScope: (kind: VitalDetailOperationWeb, id: string) => VitalNativeReceiptScopeWeb;
    beginRequest: (kind: VitalDetailOperationWeb, id: string, value: unknown, replay: boolean, frame: unknown) => VitalDetailPayloadWeb;
    assertRequest: (kind: VitalDetailOperationWeb, id: string, value: unknown, frame: unknown) => SDK;
    assertSession: (kind: VitalDetailOperationWeb, id: string, value: VitalDetailPayloadWeb, frame: unknown) => Promise<void>;
    flightToken: (kind: VitalDetailOperationWeb, id: string) => object | null;
    settle: (kind: VitalDetailOperationWeb, id: string, result: {
        ok: boolean;
        uncertain?: boolean;
        data?: {
            id: string;
        };
    }, replay: boolean, token: object | null) => void;
};
const nativeAuthorities = new WeakMap<object, NativeBridge>();
const uiAuthorities = new WeakMap<object, Readonly<Record<string, unknown>>>();
const uiCaptures = new WeakMap<object, object>();
const journals = new Map<string, Stores>();
const ownedRuntimes = new WeakSet<object>();
export function isOwnVitalDetailWriteRuntimeWeb(value: unknown) { return !!value && typeof value === 'object' && ownedRuntimes.has(value); }
const retryTokens = new WeakMap<object, {
    runtime: VitalDetailWriteRuntimeWeb;
    store: Store;
    pending: Pending;
}>();
const draftTokens = new WeakMap<object, {
    runtime: VitalDetailWriteRuntimeWeb;
    store: Store;
    kind: VitalDetailOperationWeb;
    ack: Store['ack'];
    version: number;
    read: Read;
    can: Can;
}>();
const formFrames = new WeakMap<object, {
    runtime: VitalDetailWriteRuntimeWeb;
    kind: VitalDetailOperationWeb;
    epoch: number;
    can: Can;
    read: Read | null;
    closed: boolean;
}>();
const closeTokens = new WeakMap<object, {
    runtime: VitalDetailWriteRuntimeWeb;
    origin: Origin;
    ticket: number;
    versions: readonly number[];
}>();
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const equalId = (a: unknown, b: unknown) => uuid(a) && uuid(b) && a.toLowerCase() === b.toLowerCase();
const roles = new Set(['business_admin', 'business_manager', 'billing', 'dispatch', 'nurse', 'caregiver', 'counselor', 'akademie_admin']);
const failure = () => Error('Der aktuelle eigene Messungs- und Originalanfragenbezug ist nicht bestätigt.');
function field(value: unknown, key: string): unknown { if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value)))
    throw failure(); const descriptor = Object.getOwnPropertyDescriptor(value, key); if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value'))
    throw failure(); return descriptor.value; }
function ownerValue(value: unknown): CarePermissionOwner { const owner = clone(value) as CarePermissionOwner; if (!owner || !uuid(owner.tenantId) || !uuid(owner.profileId) || !roles.has(owner.roleKey) || owner.demo !== false || typeof owner.accessToken !== 'string' || !owner.accessToken || !Number.isSafeInteger(owner.expiresAt ?? 0) || !carePermissionOwnerIsCurrent(owner) || Object.keys(owner).length !== 6)
    throw failure(); return freeze(owner); }
function authProjection(value: unknown): CarePermissionAuth { const optional = (source: unknown, key: string) => { if (!source || typeof source !== 'object' || Array.isArray(source) || ![Object.prototype, null].includes(Object.getPrototypeOf(source)))
    throw failure(); const descriptor = Object.getOwnPropertyDescriptor(source, key); if (!descriptor)
    return undefined; if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value'))
    throw failure(); return descriptor.value; }; const identity = (source: unknown, profile = false) => source == null ? null : { id: optional(source, 'id'), roleKey: optional(source, 'roleKey'), ...(profile ? { tenantId: optional(source, 'tenantId') } : {}) }; const profile = optional(value, 'profile'), user = optional(value, 'user'), session = optional(value, 'session'), portalSession = optional(value, 'portalSession'), bootstrap = optional(value, 'profileBootstrapError'); if (portalSession !== null && portalSession !== undefined || bootstrap !== null && typeof bootstrap !== 'string')
    throw failure(); return { authReady: optional(value, 'authReady'), isAuthenticated: optional(value, 'isAuthenticated'), isLoading: optional(value, 'isLoading'), profileBootstrapError: bootstrap, portalSession, profile: identity(profile, true), user: identity(user), session: session == null ? null : { user: identity(optional(session, 'user')), accessToken: optional(session, 'accessToken'), expiresAt: optional(session, 'expiresAt') } } as CarePermissionAuth; }
function grant(value: unknown) { if (value === true)
    return true; if (value instanceof Promise)
    void Promise.prototype.then.call(value, undefined, () => { }); return false; }
function payloadValue(kind: VitalDetailOperationWeb, value: unknown): VitalDetailPayloadWeb { const captured = clone(value) as Record<string, unknown>, keys = kind === 'follow_up' ? ['measurementId', 'observedAt', 'observation', 'action', 'responsiblePerson', 'outcome', 'nextReviewAt'] : ['measurementId', 'reason']; if (!captured || typeof captured !== 'object' || Array.isArray(captured) || Object.keys(captured).length !== keys.length || keys.some(key => !Object.hasOwn(captured, key) || typeof captured[key] !== 'string') || !uuid(captured.measurementId))
    throw failure(); return freeze(captured) as VitalDetailPayloadWeb; }
const store = (): Store => ({ pending: null, ack: null, archive: Object.freeze([]), conflict: false, flight: null, uncertain: false, version: 0, epoch: 0 });
const notify = (stores: Stores) => { for (const listener of [...stores.listeners])
    try {
        listener();
    }
    catch { } };
function storedRequestFields(kind: VitalDetailOperationWeb, row: Row, payload: VitalDetailPayloadWeb) { const instant = (value: unknown) => typeof value === 'string' ? woundInstant(value.replace(' ', 'T')) : null; if (instant(row.created_at) === null || typeof row.recorded_by_name !== 'string')
    return false; const nativeText = (value: string) => value.replace(/^ +| +$/g, ''); if (kind === 'invalidation')
    return row.reason === nativeText((payload as VitalInvalidationPayload).reason); const p = payload as VitalFollowUpPayload, observed = instant(p.observedAt); return observed !== null && instant(row.observed_at) === observed && row.observation === nativeText(p.observation) && row.action === nativeText(p.action) && row.responsible_person === nativeText(p.responsiblePerson) && row.outcome === p.outcome && (p.outcome === 'resolved' ? row.next_review_at === null : instant(p.nextReviewAt) !== null && instant(row.next_review_at) === instant(p.nextReviewAt)); }
function flagsBlocked(value: unknown) { const flags = clone(value) as Row; return !flags || ['loading', 'refreshing', 'error', 'refreshError', 'previewData', 'tableMissing', 'fromCache', 'partialDetail', 'usedDemoFallback'].some(key => !Object.hasOwn(flags, key) || flags[key] !== false); }
/** Private own sender/journal authority; the borrowed read token gives no actor or write grant. */
export class VitalDetailWriteRuntimeWeb {
    #rawAuthId: string | null = null;
    readonly #owner: CarePermissionOwner;
    readonly #sdk: SDK;
    readonly #live: () => VitalDetailWriteLiveWeb;
    readonly #measurementId: string;
    readonly #stores: Stores;
    #alive = true;
    #closed = false;
    #checking = false;
    #reentered = false;
    #ticket = 0;
    #origin: Origin | null = null;
    #read: Read | null = null;
    #presented: {
        token: unknown;
        blocked: boolean;
    } | null = null;
    #prepared: {
        kind: VitalDetailOperationWeb;
        payload: VitalDetailPayloadWeb;
        read: Read;
    } | null = null;
    constructor(owner: CarePermissionOwner, measurementId: string, live: () => VitalDetailWriteLiveWeb) {
        this.#owner = ownerValue(owner);
        if (!uuid(measurementId) || typeof live !== 'function' || Object.getPrototypeOf(live) !== Function.prototype)
            throw failure();
        this.#measurementId = measurementId;
        this.#live = live;
        const sdk = getSupabaseClient();
        if (!sdk || getServiceMode() !== 'supabase' || getSupabaseClient() !== sdk)
            throw failure();
        this.#sdk = sdk;
        const key = JSON.stringify([this.#owner.tenantId.toLowerCase(), this.#owner.profileId.toLowerCase(), this.#owner.roleKey, measurementId.toLowerCase()]);
        let own = journals.get(key);
        if (!own) {
            own = { follow_up: store(), invalidation: store(), listeners: new Set() };
            journals.set(key, own);
        }
        this.#stores = own;
        ownedRuntimes.add(this);
        nativeAuthorities.set(this, Object.freeze({ receiptScope: (kind, id) => { const pending = this.#stores[kind].pending; if (!pending || pending.id !== id)
                throw failure(); return freeze({ tenantId: this.#owner.tenantId, actorId: this.#owner.profileId, clientId: pending.clientId, measurementId: this.#measurementId, measurement: clone(pending.source.measurement) }); }, beginRequest: (kind, id, value, replay, frame) => this.#beginRequest(kind, id, value, replay, frame), assertRequest: (kind, id, value, frame) => this.#assertRequest(kind, id, value, frame), assertSession: (kind, id, value, frame) => this.#assertSession(kind, id, value, frame), flightToken: (kind, id) => this.#flightToken(kind, id), settle: (kind, id, result, replay, token) => this.#settle(kind, id, result, replay, token) }));
        uiAuthorities.set(this, Object.freeze({ tenantId: this.#tenantId, role: this.#role, id: this.#id, draftVersion: () => this.#draftVersion,
            canRead: () => this.#canRead(), canManage: () => this.#canManage(), captureReadOrigin: () => this.#captureReadOrigin(), readVersion: () => this.#readVersion,
            fetch: (origin: VitalDetailReadOriginWeb | null) => this.#fetch(origin), present: (value: unknown, flags: unknown) => this.#present(value, flags), view: (value?: unknown) => this.#view(value),
            mount: () => this.#mount(), dispose: () => this.#dispose(), subscribe: (callback: () => void) => this.#subscribe(callback), pendingState: () => this.#pendingState(), operationState: (kind: VitalDetailOperationWeb) => this.#operationState(kind),
            canPrepare: (kind: VitalDetailOperationWeb) => this.#canPrepare(kind), prepare: (kind: VitalDetailOperationWeb, value: unknown, frame: unknown) => this.#prepare(kind, value, frame), mayEdit: (kind: VitalDetailOperationWeb) => this.#mayEdit(kind),
            captureForm: (kind: VitalDetailOperationWeb) => this.#captureForm(kind), formCurrent: (kind: VitalDetailOperationWeb, frame: unknown) => this.#formCurrent(kind, frame), closeForm: (frame: unknown) => this.#closeForm(frame),
            execute: (kind: VitalDetailOperationWeb, id: string, payload: VitalDetailPayloadWeb, replay: boolean, frame: unknown) => executeVitalDetailNativeWriteWeb(this, kind, id, payload, replay, frame),
            known: (kind: VitalDetailOperationWeb) => this.#known(kind), reconcile: (kind: VitalDetailOperationWeb) => this.#reconcile(kind), captureRetry: (kind: VitalDetailOperationWeb) => this.#captureRetry(kind), retry: (kind: VitalDetailOperationWeb, original: unknown, frame: unknown) => this.#retry(kind, original, frame),
            captureClose: () => this.#captureClose(), mayClose: (original: unknown) => this.#mayClose(original), captureNewFollowUp: () => this.#captureNewFollowUp(), newFollowUp: (original: unknown) => this.#newFollowUp(original) }));
    }
    get #tenantId() { return this.#owner.tenantId; }
    get #id() { return this.#measurementId; }
    get #role() { return this.#owner.roleKey; }
    get #draftVersion() { return this.#stores.follow_up.epoch + ':' + this.#stores.invalidation.epoch; }
    #dispose() { this.#alive = false; this.#closed = true; this.#invalidateRead(); }
    #mount() { if (!this.#closed)
        this.#alive = true; }
    #invalidateRead() { if (this.#read)
        closeVitalDetailReadWeb(this.#read.lease); this.#ticket++; this.#read = null; this.#origin = null; this.#prepared = null; }
    #access() { const supplied = this.#live(), owner = ownerValue(field(supplied, 'owner')), permissions = field(supplied, 'permissions'), can = field(permissions, 'can'), auth = authProjection(field(supplied, 'auth')), actualOwner = carePermissionOwner(auth, owner.tenantId, false); if (!actualOwner || !same(owner, actualOwner))
        throw failure(); if (field(permissions, 'tenantId') !== owner.tenantId || field(permissions, 'roleKey') !== owner.roleKey || typeof can !== 'function' || Object.getPrototypeOf(can) !== Function.prototype)
        throw failure(); return { owner, auth, permissions, can: can as Can }; }
    /** SDK/Mode/callback access precedes final source-defined native grants and pure own lifetime. */
    #current(manage = false, captured?: Can) { if (this.#checking) {
        this.#reentered = true;
        this.#closed = true;
        throw failure();
    } this.#checking = true; let manageOnlyDenied = false; try {
        if (!this.#alive || this.#closed || this.#reentered)
            throw failure();
        const current = this.#access();
        if (!same(current.owner, this.#owner)) {
            this.#closed = true;
            throw failure();
        }
        if (!grant(current.can('pflege.vitals.view')) || captured && !grant(captured('pflege.vitals.view')))
            throw failure();
        const sdk = getSupabaseClient();
        if (sdk !== this.#sdk) {
            this.#closed = true;
            throw failure();
        }
        for (let inspection = 0; inspection < 3; inspection++) {
            if (getServiceMode() !== 'supabase' || getSupabaseClient() !== this.#sdk) {
                this.#closed = true;
                throw failure();
            }
        }
        const managed = !manage || grant(current.can('pflege.vitals.manage'));
        if (!grant(current.can('pflege.vitals.view')) || captured && !grant(captured('pflege.vitals.view')) || !this.#alive || this.#closed || this.#reentered || !carePermissionOwnerIsCurrent(this.#owner))
            throw failure();
        if (!managed) {
            manageOnlyDenied = true;
            throw failure();
        }
        return { sdk: this.#sdk, ...current };
    }
    catch (error) {
        if (!manageOnlyDenied)
            this.#invalidateRead();
        throw error;
    }
    finally {
        this.#checking = false;
    } }
    #captureForm(kind: VitalDetailOperationWeb) { try {
        if (!['follow_up', 'invalidation'].includes(kind))
            return null;
        const current = this.#current(), token = Object.freeze({});
        formFrames.set(token, { runtime: this, kind, epoch: this.#stores[kind].epoch, can: current.can, read: this.#read, closed: false });
        return token;
    }
    catch {
        return null;
    } }
    #assertForm(kind: VitalDetailOperationWeb, token: unknown, manage = false) { const frame = token && typeof token === 'object' ? formFrames.get(token) : null; if (!frame || frame.runtime !== this || frame.kind !== kind || frame.closed || frame.epoch !== this.#stores[kind].epoch)
        throw failure(); try {
        this.#current(manage, frame.can);
        if (frame.closed || frame.epoch !== this.#stores[kind].epoch || !this.#alive || this.#closed)
            throw failure();
        return frame;
    }
    catch (error) {
        frame.closed = true;
        throw error;
    } }
    #formCurrent(kind: VitalDetailOperationWeb, token: unknown) { try {
        this.#assertForm(kind, token);
        return true;
    }
    catch {
        return false;
    } }
    #closeForm(token: unknown) { const frame = token && typeof token === 'object' ? formFrames.get(token) : null; if (frame?.runtime === this)
        frame.closed = true; }
    #canRead() { try {
        this.#current();
        return true;
    }
    catch {
        return false;
    } }
    #canManage() { try {
        this.#current(true);
        return true;
    }
    catch {
        return false;
    } }
    #captureReadOrigin(): VitalDetailReadOriginWeb | null { try {
        const current = this.#current(), held = this.#origin;
        if (held && same(held.owner, current.owner) && grant(held.can('pflege.vitals.view')) && this.#alive && !this.#closed)
            return held.token;
        this.#invalidateRead();
        const origin = { token: Object.freeze({}), owner: current.owner, can: current.can, id: ++this.#ticket };
        this.#origin = origin;
        this.#assertOrigin(origin.token);
        return origin.token;
    }
    catch {
        return null;
    } }
    get #readVersion() { return this.#origin?.id ?? 0; }
    #assertOrigin(token: VitalDetailReadOriginWeb | null) { const origin = this.#origin; if (!origin || origin.token !== token)
        throw failure(); this.#current(false, origin.can); if (this.#origin !== origin || !this.#alive || this.#closed)
        throw failure(); return origin; }
    #makeLease(origin: Origin, ticket: number, expectedClientId?: string) { const runtime = createVitalDetailRuntimeWeb({ auth: () => this.#access().auth, tenantId: () => this.#owner.tenantId, measurementId: () => this.#measurementId, ...(expectedClientId ? { expectedClientId: () => expectedClientId } : {}), permissions: () => ({ tenantId: this.#owner.tenantId, roleKey: this.#owner.roleKey, can: key => grant(origin.can(key)) }), alive: () => this.#alive && !this.#closed && this.#origin === origin && ticket === this.#ticket }); const lease = captureVitalDetailReadWeb(runtime); if (!lease)
        throw failure(); return lease; }
    async #fetch(originToken: VitalDetailReadOriginWeb | null) { try {
        const origin = this.#assertOrigin(originToken), ticket = ++this.#ticket;
        this.#read = null;
        this.#prepared = null;
        const lease = this.#makeLease(origin, ticket);
        const receipt = await fetchVitalDetailOriginalReadWeb(lease);
        this.#assertOrigin(origin.token);
        if (ticket !== this.#ticket)
            throw failure();
        const originals = vitalDetailOriginalsWeb(receipt, lease), projection = vitalDetailProjectionWeb(receipt, lease);
        if (!originals)
            throw failure();
        this.#assertOrigin(origin.token);
        if (ticket !== this.#ticket)
            throw failure();
        const token = Object.freeze({});
        this.#read = { token, lease, receipt, originals, projection, ticket, origin };
        return { ok: true as const, data: token };
    }
    catch (error) {
        return { ok: false as const, error: error instanceof Error ? error.message : 'Originalmessung nicht bestätigt.' };
    } }
    #present(token: unknown, flags: unknown) { let blocked = true; try {
        blocked = flagsBlocked(flags);
    }
    catch { } this.#presented = { token, blocked }; }
    #currentRead(token: unknown = this.#presented?.token): Read { const own = this.#read, presented = this.#presented; if (!own || !presented || presented.blocked || presented.token !== token || own.token !== token || own.ticket !== this.#ticket || this.#origin !== own.origin)
        throw failure(); this.#assertOrigin(own.origin.token); assertVitalDetailReadWeb(own.lease); if (vitalDetailOriginalsWeb(own.receipt, own.lease) !== own.originals)
        throw failure(); this.#current(false, own.origin.can); if (this.#read !== own || this.#presented !== presented || own.ticket !== this.#ticket || presented.blocked)
        throw failure(); return own; }
    #view(token: unknown = this.#presented?.token): Row | null { try {
        return this.#currentRead(token).projection;
    }
    catch {
        return null;
    } }
    #canPrepare(kind: VitalDetailOperationWeb) { try {
        if (this.#pendingState().pending || this.#stores[kind].ack)
            return false;
        const own = this.#currentRead();
        this.#current(true, own.origin.can);
        if (!own.projection)
            return false;
        return kind === 'follow_up' ? validVitalActualTimeField(own.projection) : own.originals.invalidations.length === 0;
    }
    catch {
        return false;
    } }
    #prepare(kind: VitalDetailOperationWeb, value: unknown, frameToken: unknown) { try {
        const frame = this.#assertForm(kind, frameToken, true);
        if (!frame.read || this.#currentRead() !== frame.read)
            return false;
        const payload = payloadValue(kind, value);
        if (!equalId(payload.measurementId, this.#measurementId) || !this.#canPrepare(kind))
            return false;
        const read = this.#currentRead();
        const error = kind === 'follow_up' ? vitalFollowUpChronologyError(read.projection, (payload as VitalFollowUpPayload).observedAt) ?? validateVitalFollowUp(payload as VitalFollowUpPayload, typeof read.projection?.occurredAt === 'string' ? read.projection.occurredAt.replace(' ', 'T') : null) : validateVitalInvalidation(payload);
        if (error)
            return false;
        this.#current(true, read.origin.can);
        if (this.#currentRead() !== read)
            return false;
        this.#prepared = { kind, payload, read };
        return true;
    }
    catch {
        return false;
    } }
    #beginRequest(kind: VitalDetailOperationWeb, id: string, value: unknown, replay: boolean, frame: unknown) { this.#assertForm(kind, frame, true); const target = this.#stores[kind], payload = payloadValue(kind, value); if (target.conflict || !uuid(id) || !equalId(payload.measurementId, this.#measurementId) || this.#pendingState().busy)
        throw failure(); this.#current(true); if (replay) {
        if (!target.pending || target.pending.id !== id || !same(target.pending.payload, payload))
            throw failure();
    }
    else {
        const prepared = this.#prepared;
        if (this.#assertForm(kind, frame, true).read !== this.#currentRead())
            throw failure();
        if (target.ack || this.#pendingState().pending || !prepared || prepared.kind !== kind || !same(prepared.payload, payload) || this.#currentRead() !== prepared.read || !this.#canPrepare(kind))
            throw failure();
        const clientId = prepared.read.originals.measurement.client_id;
        if (!uuid(clientId))
            throw failure();
        target.pending = freeze({ id, payload, clientId, kind, source: prepared.read.originals });
    } try {
        this.#assertRequest(kind, id, payload, frame);
    }
    catch (error) {
        if (!replay)
            target.pending = null;
        throw error;
    } target.version++; target.flight = { runtime: this, token: Object.freeze({}), version: target.version, frame: frame as object }; target.uncertain = false; notify(this.#stores); return payload; }
    #assertRequest(kind: VitalDetailOperationWeb, id: string, value: unknown, frame: unknown) { this.#assertForm(kind, frame, true); const target = this.#stores[kind], payload = payloadValue(kind, value), pending = target.pending; if (target.conflict || !pending || pending.id !== id || !same(pending.payload, payload) || target.flight && (target.flight.runtime !== this || target.flight.frame !== frame) || !equalId(payload.measurementId, this.#measurementId))
        throw failure(); const current = this.#current(true); if (target.pending !== pending || !this.#alive || this.#closed || target.flight && (target.flight.runtime !== this || target.flight.frame !== frame))
        throw failure(); return current.sdk; }
    async #assertSession(kind: VitalDetailOperationWeb, id: string, payload: VitalDetailPayloadWeb, frame: unknown) { const target = this.#stores[kind], pending = target.pending; this.#assertRequest(kind, id, payload, frame); const current = this.#current(true), origin = { token: Object.freeze({}), can: current.can, owner: current.owner, id: this.#ticket }; const ticket = this.#ticket; const runtime = createVitalDetailRuntimeWeb({ auth: () => this.#access().auth, tenantId: () => this.#owner.tenantId, measurementId: () => this.#measurementId, expectedClientId: () => pending!.clientId, permissions: () => ({ tenantId: this.#owner.tenantId, roleKey: this.#owner.roleKey, can: key => grant(origin.can(key)) }), alive: () => this.#alive && !this.#closed && ticket === this.#ticket && target.pending === pending }); const lease = captureVitalDetailReadWeb(runtime); if (!lease)
        throw failure(); const rawAuthId = await assertVitalDetailSessionWeb(lease, this.#rawAuthId); this.#assertRequest(kind, id, payload, frame); this.#rawAuthId = rawAuthId; closeVitalDetailReadWeb(lease); }
    #flightToken(kind: VitalDetailOperationWeb, id: string) { const target = this.#stores[kind]; return target.pending?.id === id && target.flight?.runtime === this ? target.flight.token : null; }
    #settle(kind: VitalDetailOperationWeb, id: string, result: {
        ok: boolean;
        uncertain?: boolean;
        data?: {
            id: string;
        };
    }, replay: boolean, token: object | null) { const target = this.#stores[kind]; if (!token || target.flight?.token !== token || target.flight.runtime !== this || target.flight.version !== target.version || target.pending?.id !== id || !isOwnVitalDetailWriteOutcomeWeb(result, this, kind, id, replay, token))
        return; if (!isSettledVitalDetailWriteOutcomeWeb(result, this, kind, id, replay, token)) {
        target.uncertain = true;
        notify(this.#stores);
        return;
    } if (result.ok && uuid(result.data?.id)) {
        const fact = freeze({ id: result.data!.id, source: 'confirmed_original' as const, request: target.pending, original: vitalDetailOwnWriteOriginalWeb(result, this, kind, id, replay, token) });
        if (target.ack) {
            target.archive = Object.freeze([...target.archive, fact]);
            if (!equalId(target.ack.id, fact.id))
                target.conflict = true;
        }
        else
            target.ack = fact;
        if (!target.conflict)
            target.pending = null;
        this.#prepared = null;
    }
    else if (!target.conflict && (target.ack?.source === 'stored_original' || !replay && result.uncertain !== true)) {
        target.pending = null;
        this.#prepared = null;
    } target.flight = null; target.uncertain = !!target.pending; target.version++; notify(this.#stores); }
    #pendingState() { const entries = [this.#stores.follow_up, this.#stores.invalidation]; return Object.freeze({ pending: entries.some(s => !!s.pending), busy: entries.some(s => !!s.flight), uncertain: entries.some(s => !!s.pending && s.uncertain) }); }
    #operationState(kind: VitalDetailOperationWeb) { const s = this.#stores[kind]; return Object.freeze({ pending: !!s.pending, busy: !!s.flight, uncertain: !!s.pending && s.uncertain }); }
    #subscribe(listener: () => void) { const own = () => { if (this.#alive && !this.#closed)
        listener(); }; this.#stores.listeners.add(own); return () => { this.#stores.listeners.delete(own); }; }
    #captureRetry(kind: VitalDetailOperationWeb) { try {
        const target = this.#stores[kind];
        if (!target.pending || target.conflict || this.#pendingState().busy)
            return null;
        this.#current(true);
        const token = Object.freeze({});
        retryTokens.set(token, { runtime: this, store: target, pending: target.pending });
        return token;
    }
    catch {
        return null;
    } }
    async #retry(kind: VitalDetailOperationWeb, token: unknown, frame: unknown) { const own = token && typeof token === 'object' ? retryTokens.get(token) : null, target = this.#stores[kind]; if (!own || own.runtime !== this || own.store !== target || own.pending !== target.pending || this.#pendingState().busy || !this.#canManage())
        return { ok: false as const, uncertain: !!target.pending, error: 'Unveränderte Originalanfrage benötigt aktuelle eigene Rechte.' }; return executeVitalDetailNativeWriteWeb(this, kind, own.pending.id, own.pending.payload, true, frame); }
    #known(kind: VitalDetailOperationWeb) { try {
        this.#current();
        return !this.#stores[kind].conflict && this.#stores[kind].ack ? Object.freeze({ id: this.#stores[kind].ack!.id, source: this.#stores[kind].ack!.source }) : null;
    }
    catch {
        return null;
    } }
    /** This is a positive whole stored original request proof, never an absence or write grant. */
    #reconcile(kind: VitalDetailOperationWeb) { try {
        const target = this.#stores[kind], pending = target.pending ?? target.ack?.request;
        if (target.conflict)
            return false;
        if (!pending)
            return false;
        const own = this.#currentRead(), rows = kind === 'follow_up' ? own.originals.followUps : own.originals.invalidations;
        const candidates = rows.filter(row => equalId(row.request_id, pending.id));
        if (candidates.length !== 1)
            return false;
        const row = clone(candidates[0]) as Row;
        if (!uuid(row.id) || !equalId(row.tenant_id, this.#owner.tenantId) || !equalId(row.client_id, pending.clientId) || !equalId(row.measurement_id, this.#measurementId) || !equalId(row.recorded_by, this.#owner.profileId) || !same(row.creation_payload, pending.payload) || !storedRequestFields(kind, row, pending.payload) || !equalId(own.originals.measurement.client_id, pending.clientId))
            return false;
        this.#current();
        if (this.#currentRead() !== own || (target.pending ?? target.ack?.request) !== pending)
            return false;
        const fact = freeze({ id: row.id, source: 'stored_original' as const, request: pending, original: row });
        if (target.ack) {
            if (!equalId(target.ack.id, fact.id)) {
                target.archive = Object.freeze([...target.archive, fact]);
                target.conflict = true;
                target.pending = pending;
                target.uncertain = true;
            }
            else if (target.ack.source === 'stored_original') {
                if (!same(target.ack.original, row))
                    target.archive = Object.freeze([...target.archive, fact]);
            }
            else {
                target.archive = Object.freeze([...target.archive, target.ack]);
                target.ack = fact;
            }
        }
        else
            target.ack = fact;
        if (!target.flight && !target.conflict) {
            target.pending = null;
            target.uncertain = false;
            target.version++;
        }
        notify(this.#stores);
        return !target.conflict;
    }
    catch {
        return false;
    } }
    #captureNewFollowUp() { try {
        const target = this.#stores.follow_up, ack = target.ack;
        if (!ack || this.#pendingState().pending || this.#pendingState().busy)
            return null;
        const read = this.#currentRead();
        if (!read.projection || !validVitalActualTimeField(read.projection))
            return null;
        const current = this.#current(true, read.origin.can), token = Object.freeze({});
        draftTokens.set(token, { runtime: this, store: target, kind: 'follow_up', ack, version: target.version, read, can: current.can });
        return token;
    }
    catch {
        return null;
    } }
    #newFollowUp(token: unknown) { try {
        const own = token && typeof token === 'object' ? draftTokens.get(token) : null, target = this.#stores.follow_up;
        if (!own || own.runtime !== this || own.store !== target || own.ack !== target.ack || own.version !== target.version || this.#pendingState().pending || this.#pendingState().busy || this.#currentRead() !== own.read || !grant(own.can('pflege.vitals.view')) || !grant(own.can('pflege.vitals.manage')))
            return false;
        this.#current(true, own.can);
        if (own.ack !== target.ack || own.version !== target.version || this.#currentRead() !== own.read)
            return false;
        target.archive = Object.freeze([...target.archive, target.ack!]);
        target.ack = null;
        target.version++;
        target.epoch++;
        this.#invalidateRead();
        notify(this.#stores);
        return true;
    }
    catch {
        return false;
    } }
    #mayEdit(kind: VitalDetailOperationWeb) { return !this.#pendingState().pending && !this.#stores[kind].ack && this.#canPrepare(kind); }
    #captureClose() { try {
        if (this.#pendingState().pending || this.#pendingState().busy)
            return null;
        const origin = this.#origin;
        if (!origin)
            return null;
        this.#assertOrigin(origin.token);
        const token = Object.freeze({});
        closeTokens.set(token, { runtime: this, origin, ticket: this.#ticket, versions: [this.#stores.follow_up.version, this.#stores.invalidation.version] });
        return token;
    }
    catch {
        return null;
    } }
    #mayClose(token: unknown) { try {
        const own = token && typeof token === 'object' ? closeTokens.get(token) : null;
        if (!own || own.runtime !== this || own.origin !== this.#origin || own.ticket !== this.#ticket || !same(own.versions, [this.#stores.follow_up.version, this.#stores.invalidation.version]) || this.#pendingState().pending || this.#pendingState().busy)
            return false;
        this.#assertOrigin(own.origin.token);
        return own.ticket === this.#ticket && !this.#pendingState().pending;
    }
    catch {
        return false;
    } }
}
/** Native writer receives fixed constructor-minted closures, never mutable object methods. */
export function vitalDetailNativeWriteAuthorityWeb(runtime: unknown): NativeBridge | null { return runtime && typeof runtime === 'object' ? nativeAuthorities.get(runtime) ?? null : null; }
/** UI token has no RawOriginals/auth/journal fields; the returned fixed callbacks expose only display/flags. */
export function captureVitalDetailWriteViewWeb(runtime: VitalDetailWriteRuntimeWeb): VitalDetailWriteCaptureWeb { if (!ownedRuntimes.has(runtime))
    throw failure(); const token = Object.freeze({}); uiCaptures.set(token, runtime); return token; }
export function vitalDetailWriteActionsWeb(token: VitalDetailWriteCaptureWeb) {
    const runtime = uiCaptures.get(token), actions = runtime && uiAuthorities.get(runtime);
    if (!actions)
        throw failure();
    return actions as {
        readonly tenantId: string;
        readonly role: CarePermissionOwner['roleKey'];
        readonly id: string;
        draftVersion(): string;
        canRead(): boolean;
        canManage(): boolean;
        captureReadOrigin(): VitalDetailReadOriginWeb | null;
        readVersion(): number;
        fetch(origin: VitalDetailReadOriginWeb | null): Promise<{
            ok: true;
            data: VitalDetailDeliveredReadWeb;
        } | {
            ok: false;
            error: string;
        }>;
        present(token: unknown, flags: unknown): void;
        view(token?: unknown): Row | null;
        mount(): void;
        dispose(): void;
        subscribe(callback: () => void): () => void;
        pendingState(): Readonly<{
            pending: boolean;
            busy: boolean;
            uncertain: boolean;
        }>;
        operationState(kind: VitalDetailOperationWeb): Readonly<{
            pending: boolean;
            busy: boolean;
            uncertain: boolean;
        }>;
        canPrepare(kind: VitalDetailOperationWeb): boolean;
        prepare(kind: VitalDetailOperationWeb, value: unknown, frame: unknown): boolean;
        mayEdit(kind: VitalDetailOperationWeb): boolean;
        captureForm(kind: VitalDetailOperationWeb): object | null;
        formCurrent(kind: VitalDetailOperationWeb, frame: unknown): boolean;
        closeForm(frame: unknown): void;
        execute(kind: VitalDetailOperationWeb, id: string, payload: VitalDetailPayloadWeb, replay: boolean, frame: unknown): ReturnType<typeof executeVitalDetailNativeWriteWeb>;
        known(kind: VitalDetailOperationWeb): Readonly<{
            id: string;
            source: 'confirmed_original' | 'stored_original';
        }> | null;
        reconcile(kind: VitalDetailOperationWeb): boolean;
        captureRetry(kind: VitalDetailOperationWeb): object | null;
        retry(kind: VitalDetailOperationWeb, token: unknown, frame: unknown): ReturnType<typeof executeVitalDetailNativeWriteWeb>;
        captureClose(): object | null;
        mayClose(token: unknown): boolean;
        captureNewFollowUp(): object | null;
        newFollowUp(token: unknown): boolean;
    };
}
