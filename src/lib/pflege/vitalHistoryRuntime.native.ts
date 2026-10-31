// Generated native presentation from src/lib/pflege/vitalHistoryRuntime.web.ts. Update through scripts/port-native-workspaces.mjs.
import { assertVitalSdkOwnerWeb } from "./vitalSdkOwner.native.ts";
import { carePermissionOwner, carePermissionOwnerIsCurrent, sameCarePermissionOwner, type CarePermissionAuth, type CarePermissionOwner } from "../permissions/carePermissionOwner.native.ts";
import { getSupabaseClient } from "../supabase/client.ts";
import { getServiceMode } from '../services/mode';
import { cloneClientNativeOriginal as clone } from "../clients/clientRecordNativeOriginal.native.ts";
export type VitalHistoryRuntimeWeb = Readonly<Record<never, never>>;
export type VitalHistoryReadLeaseWeb = Readonly<Record<never, never>>;
export type VitalHistoryFetchWeb = Readonly<Record<never, never>>;
type Can = (key: 'pflege.vitals.view') => unknown;
type PermissionSource = {
    tenantId: unknown;
    roleKey: unknown;
    can: Can;
};
export type VitalHistoryRuntimeInputWeb = {
    auth(): CarePermissionAuth;
    tenantId(): unknown;
    clientId(): unknown;
    permissions(): PermissionSource;
    alive(): boolean;
};
type SDK = NonNullable<ReturnType<typeof getSupabaseClient>>;
type Runtime = {
    input: VitalHistoryRuntimeInputWeb;
    closed: boolean;
    checking: boolean;
    capturing: boolean;
    reentered: boolean;
    generation: number;
    active: Lease | null;
};
type Lease = {
    runtime: Runtime;
    owner: CarePermissionOwner;
    client: SDK;
    authUserId: string | null;
    clientId: string;
    permissionSource: PermissionSource;
    can: Can;
    closed: boolean;
    checking: boolean;
    token: VitalHistoryReadLeaseWeb;
};
type Fetch = {
    lease: Lease;
    generation: number;
    closed: boolean;
};
const runtimes = new WeakMap<object, Runtime>(), leases = new WeakMap<object, Lease>(), fetches = new WeakMap<object, Fetch>();
const failure = () => Error('Aktueller eigener nativer Lesezugriff auf den ganzen Klientenverlauf fehlt.');
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
function record(value: unknown): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value)))
    throw failure(); return value as Record<string, unknown>; }
function field(value: unknown, key: string): unknown { const descriptor = Object.getOwnPropertyDescriptor(record(value), key); if (!descriptor)
    return undefined; if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value'))
    throw failure(); return descriptor.value; }
function grant(value: unknown) { if (value === true)
    return true; if (value instanceof Promise)
    void Promise.prototype.then.call(value, undefined, () => { }); return false; }
function auth(value: unknown): CarePermissionAuth { const identity = (input: unknown, profile = false) => input == null ? null : { id: field(input, 'id'), roleKey: field(input, 'roleKey'), ...(profile ? { tenantId: field(input, 'tenantId') } : {}) }, profile = field(value, 'profile'), user = field(value, 'user'), session = field(value, 'session'), bootstrap = field(value, 'profileBootstrapError'), portal = field(value, 'portalSession'); if (bootstrap !== null && typeof bootstrap !== 'string' || portal !== null && portal !== undefined)
    throw failure(); return { authReady: field(value, 'authReady'), isAuthenticated: field(value, 'isAuthenticated'), isLoading: field(value, 'isLoading'), profileBootstrapError: bootstrap, portalSession: portal, profile: identity(profile, true), user: identity(user), session: session == null ? null : { user: identity(field(session, 'user')), accessToken: field(session, 'accessToken'), expiresAt: field(session, 'expiresAt') } } as CarePermissionAuth; }
function invoke(runtime: Runtime, callback: () => unknown) { if (runtime.closed || runtime.reentered)
    throw failure(); const result = Reflect.apply(callback, runtime.input, []); if (result instanceof Promise) {
    void Promise.prototype.then.call(result, undefined, () => { });
    throw failure();
} if (runtime.closed || runtime.reentered)
    throw failure(); return result; }
function scope(runtime: Runtime) { const tenantId = invoke(runtime, runtime.input.tenantId), clientId = invoke(runtime, runtime.input.clientId); if (!uuid(tenantId) || !uuid(clientId))
    throw failure(); const owner = carePermissionOwner(auth(invoke(runtime, runtime.input.auth)), tenantId, false); if (!owner || typeof owner.accessToken !== 'string' || !owner.accessToken || !Number.isSafeInteger(owner.expiresAt ?? 0) || !grant(invoke(runtime, runtime.input.alive)))
    throw failure(); const permissionSource = record(invoke(runtime, runtime.input.permissions)) as PermissionSource, can = field(permissionSource, 'can'); if (field(permissionSource, 'tenantId') !== owner.tenantId || field(permissionSource, 'roleKey') !== owner.roleKey || typeof can !== 'function' || !grant(Reflect.apply(can, permissionSource, ['pflege.vitals.view'])))
    throw failure(); return { owner, clientId, permissionSource, can: can as Can }; }
function native(lease: Lease) { for (let round = 0; round < 3; round++) {
    if (getServiceMode() !== 'supabase' || getSupabaseClient() !== lease.client)
        throw failure();
} if (lease.closed || lease.runtime.closed || lease.runtime.reentered || lease.runtime.active !== lease || !carePermissionOwnerIsCurrent(lease.owner))
    throw failure(); }
function match(lease: Lease, current: ReturnType<typeof scope>) { if (!sameCarePermissionOwner(lease.owner, current.owner) || lease.clientId !== current.clientId || !grant(Reflect.apply(lease.can, lease.permissionSource, ['pflege.vitals.view'])))
    throw failure(); }
function current(lease: Lease) { const runtime = lease.runtime; if (lease.closed || runtime.closed || runtime.active !== lease)
    throw failure(); if (runtime.checking || lease.checking) {
    runtime.reentered = true;
    runtime.closed = true;
    lease.closed = true;
    throw failure();
} runtime.checking = true; lease.checking = true; try {
    native(lease);
    match(lease, scope(runtime));
    native(lease);
    match(lease, scope(runtime));
    native(lease);
    const final = scope(runtime);
    match(lease, final);
    native(lease);
    const finalOwn = scope(runtime);
    match(lease, finalOwn);
    if (!grant(Reflect.apply(finalOwn.can, finalOwn.permissionSource, ['pflege.vitals.view'])) || !grant(Reflect.apply(lease.can, lease.permissionSource, ['pflege.vitals.view'])) || lease.closed || runtime.closed || runtime.reentered || runtime.active !== lease || !carePermissionOwnerIsCurrent(lease.owner))
        throw failure();
}
catch (error) {
    lease.closed = true;
    throw error;
}
finally {
    runtime.checking = false;
    lease.checking = false;
} }
export function createVitalHistoryRuntimeWeb(input: VitalHistoryRuntimeInputWeb): VitalHistoryRuntimeWeb { const supplied = record(input), keys = ['auth', 'tenantId', 'clientId', 'permissions', 'alive'], captured: Record<string, unknown> = {}; if (Reflect.ownKeys(supplied).length !== keys.length)
    throw failure(); for (const key of keys) {
    const callback = field(supplied, key);
    if (typeof callback !== 'function')
        throw failure();
    captured[key] = callback;
} const token = Object.freeze({}); runtimes.set(token, { input: Object.freeze(captured) as unknown as VitalHistoryRuntimeInputWeb, closed: false, checking: false, capturing: false, reentered: false, generation: 0, active: null }); return token; }
export function captureVitalHistoryReadWeb(token: VitalHistoryRuntimeWeb): VitalHistoryReadLeaseWeb | null { const runtime = runtimes.get(token); if (!runtime || runtime.closed || runtime.reentered)
    return null; if (runtime.capturing || runtime.checking) {
    runtime.closed = true;
    runtime.reentered = true;
    return null;
} if (runtime.active) {
    try {
        current(runtime.active);
        return runtime.active.token;
    }
    catch {
        runtime.active.closed = true;
        runtime.active = null;
    }
} runtime.capturing = true; try {
    const captured = scope(runtime), client = getSupabaseClient();
    if (!client || getServiceMode() !== 'supabase')
        throw failure();
    const token = Object.freeze({}), lease: Lease = { runtime, ...captured, client, token, authUserId: null, closed: false, checking: false };
    runtime.active = lease;
    current(lease);
    leases.set(token, lease);
    return token;
}
catch {
    runtime.active?.closed && (runtime.active = null);
    return null;
}
finally {
    runtime.capturing = false;
} }
export function assertVitalHistoryReadWeb(token: VitalHistoryReadLeaseWeb): void { const lease = leases.get(token); if (!lease)
    throw failure(); current(lease); }
export function closeVitalHistoryReadWeb(token: VitalHistoryReadLeaseWeb) { const lease = leases.get(token); if (lease)
    lease.closed = true; }
export function closeVitalHistoryRuntimeWeb(token: VitalHistoryRuntimeWeb) { const runtime = runtimes.get(token); if (runtime) {
    runtime.closed = true;
    runtime.generation++;
    if (runtime.active)
        runtime.active.closed = true;
} }
/** Query start retires all prior results synchronously. No SharedQuery/cache token can mint this frame. */
export function beginVitalHistoryFetchWeb(token: VitalHistoryReadLeaseWeb): VitalHistoryFetchWeb { const lease = leases.get(token); if (!lease)
    throw failure(); current(lease); const frame = Object.freeze({}); fetches.set(frame, { lease, generation: ++lease.runtime.generation, closed: false }); return frame; }
export function assertVitalHistoryFetchWeb(frame: VitalHistoryFetchWeb, token: VitalHistoryReadLeaseWeb): void { const fetch = fetches.get(frame), lease = leases.get(token); if (!fetch || !lease || fetch.lease !== lease || fetch.closed || fetch.generation !== lease.runtime.generation)
    throw failure(); current(lease); if (fetch.closed || fetch.generation !== lease.runtime.generation || lease.runtime.active !== lease)
    throw failure(); }
export function closeVitalHistoryFetchWeb(frame: VitalHistoryFetchWeb) { const fetch = fetches.get(frame); if (fetch)
    fetch.closed = true; }
/** Internal minimal SDK/UUID bridge. No credentials, clinical RawDTO or write/actor authority. */
export function vitalHistoryReadContextWeb(frame: VitalHistoryFetchWeb, token: VitalHistoryReadLeaseWeb) { assertVitalHistoryFetchWeb(frame, token); const fetch = fetches.get(frame)!; return Object.freeze({ client: fetch.lease.client, tenantId: fetch.lease.owner.tenantId, clientId: fetch.lease.clientId }); }
export async function assertVitalHistorySessionWeb(frame: VitalHistoryFetchWeb, token: VitalHistoryReadLeaseWeb): Promise<void> { const fetch = fetches.get(frame); if (!fetch)
    throw failure(); const lease = fetch.lease; try {
    const current = () => assertVitalHistoryFetchWeb(frame, token);
    current();
    lease.authUserId = await assertVitalSdkOwnerWeb({ client: lease.client, owner: lease.owner, current, pinnedAuthId: lease.authUserId });
    current();
}
catch (error) {
    if (!fetch.closed && fetch.generation === lease.runtime.generation && lease.runtime.active === lease)
        lease.closed = true;
    closeVitalHistoryFetchWeb(frame);
    throw error;
} }
