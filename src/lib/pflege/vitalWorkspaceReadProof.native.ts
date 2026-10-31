// Generated native presentation from src/lib/pflege/vitalWorkspaceReadProof.web.ts. Update through scripts/port-native-workspaces.mjs.
import { cloneClientNativeOriginal, freezeClientNativeOriginal, sameClientNativeOriginal } from "../clients/clientRecordNativeOriginal.native.ts";
import { vitalCareReviewInstantMicros } from "./vitalCareReview.native.ts";
export type VitalWorkspaceReadScopeWeb = Readonly<{
    tenantId: string;
    clientId: string;
    measurementId: string;
    actorId: string;
}>;
type Position = Readonly<{
    at: string;
    id: string;
}>;
type Page<T> = {
    rows: T[];
    nextCursorRecordedAt: string | null;
    nextCursorId: string | null;
    stateFingerprint: string;
};
const unavailable = 'Der vollständige aktuelle Vitalbestand konnte nicht einheitlich bestätigt werden.';
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const fingerprint = (v: unknown): v is string => typeof v === 'string' && /^sha256:[0-9a-f]{64}$/.test(v);
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const proofs = new WeakMap<object, {
    scope: string;
    fingerprint: string;
}>();
function scopeKey(scope: VitalWorkspaceReadScopeWeb): string { const ids = [scope.tenantId, scope.clientId, scope.measurementId, scope.actorId]; if (!ids.every(uuid))
    throw Error(unavailable); return ids.map(x => x.toLowerCase()).join(':'); }
function remember<T extends object>(value: T, scope: VitalWorkspaceReadScopeWeb, token: string): T { if (!fingerprint(token))
    throw Error(unavailable); freezeClientNativeOriginal(value); proofs.set(value, { scope: scopeKey(scope), fingerprint: token }); return value; }
/** A negative freshness check, never an authorization or a permission to perform clinical work. */
export function sameVitalWorkspaceProofWeb(...values: unknown[]): boolean {
    if (values.length < 2)
        return false;
    let first: {
        scope: string;
        fingerprint: string;
    } | undefined;
    for (const value of values) {
        if (!value || typeof value !== 'object')
            return false;
        const proof = proofs.get(value);
        if (!proof || first && (proof.scope !== first.scope || proof.fingerprint !== first.fingerprint))
            return false;
        first = proof;
    }
    return true;
}
function position(value: Position): {
    at: bigint;
    id: string;
} { const at = vitalCareReviewInstantMicros(value.at); if (at === null || !uuid(value.id))
    throw Error(unavailable); return { at, id: value.id.toLowerCase() }; }
function older(value: Position, prior: Position): boolean { const x = position(value), y = position(prior); return x.at < y.at || x.at === y.at && x.id < y.id; }
function capturePage<T>(input: unknown, decode: (value: unknown) => T, rowPosition: (value: T) => Position, prior: Position | null, maxRows: number): Page<T> {
    const page = cloneClientNativeOriginal(input);
    if (!object(page) || Object.keys(page).sort().join(',') !== 'nextCursorId,nextCursorRecordedAt,rows,stateFingerprint' || !Array.isArray(page.rows) || page.rows.length > maxRows || !fingerprint(page.stateFingerprint))
        throw Error(unavailable);
    const rows: T[] = [];
    let previous = prior;
    for (const raw of page.rows) {
        const row = decode(raw), at = rowPosition(row);
        position(at);
        if (previous && !older(at, previous))
            throw Error(unavailable);
        rows.push(row);
        previous = at;
    }
    if (rows.length === 0) {
        if (page.nextCursorRecordedAt !== null || page.nextCursorId !== null)
            throw Error(unavailable);
    }
    else {
        if (typeof page.nextCursorRecordedAt !== 'string' || !uuid(page.nextCursorId))
            throw Error(unavailable);
        const cursor = position({ at: page.nextCursorRecordedAt, id: page.nextCursorId }), last = position(previous!);
        if (cursor.at !== last.at || cursor.id !== last.id)
            throw Error(unavailable);
    }
    return { rows, nextCursorRecordedAt: page.nextCursorRecordedAt as string | null, nextCursorId: page.nextCursorId as string | null, stateFingerprint: page.stateFingerprint };
}
/** Every page, including the empty terminator and final head reread, must attest the same complete ledger. */
export async function readCompleteVitalHistoryWeb<T>(scope: VitalWorkspaceReadScopeWeb, load: (at: string | null, id: string | null) => Promise<unknown>, decode: (value: unknown) => T, rowPosition: (value: T) => Position, identity: (value: T) => string = value => rowPosition(value).id): Promise<T[]> {
    scopeKey(scope);
    const rows: T[] = [], identities = new Set<string>();
    let prior: Position | null = null, first: Page<T> | null = null, complete = false;
    for (let page = 0; page < 100; page++) {
        const next: Page<T> = capturePage<T>(await load(prior?.at ?? null, prior?.id ?? null), decode, rowPosition, prior, 100);
        if (first && next.stateFingerprint !== first.stateFingerprint)
            throw Error(unavailable);
        if (!first)
            first = cloneClientNativeOriginal(next);
        if (next.rows.length === 0) {
            complete = true;
            break;
        }
        for (const row of next.rows) {
            const id = identity(row);
            if (!uuid(id) || identities.has(id.toLowerCase()))
                throw Error(unavailable);
            identities.add(id.toLowerCase());
            rows.push(row);
        }
        prior = { at: next.nextCursorRecordedAt!, id: next.nextCursorId! };
    }
    if (!complete || !first)
        throw Error('Der Vitalbestand überschreitet die sicher vollständig lesbare Grenze.');
    const final = capturePage(await load(null, null), decode, rowPosition, null, 100);
    if (!sameClientNativeOriginal(first, final))
        throw Error(unavailable);
    return remember(rows, scope, first.stateFingerprint);
}
/** Source DTO stays unchanged; two independently attested head reads bind its nine native pools. */
export async function readVitalSourcesWithProofWeb<T extends object, H>(scope: VitalWorkspaceReadScopeWeb, loadHead: () => Promise<unknown>, loadSources: () => Promise<unknown>, decodeHead: (value: unknown) => H, rowPosition: (value: H) => Position, validate: (value: unknown) => string | null): Promise<T> {
    scopeKey(scope);
    const before = capturePage(await loadHead(), decodeHead, rowPosition, null, 1), sources = cloneClientNativeOriginal(await loadSources()), issue = validate(sources);
    if (issue)
        throw Error(issue);
    const after = capturePage(await loadHead(), decodeHead, rowPosition, null, 1);
    if (!sameClientNativeOriginal(before, after) || !object(sources))
        throw Error(unavailable);
    return remember(sources as T, scope, before.stateFingerprint);
}
