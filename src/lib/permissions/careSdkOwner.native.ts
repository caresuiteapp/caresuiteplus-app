// Generated native presentation from src/lib/permissions/careSdkOwner.web.ts. Update through scripts/port-native-workspaces.mjs.
import { cloneClientNativeOriginal } from "../clients/clientRecordNativeOriginal.native.ts";
import type { CarePermissionOwner } from "./carePermissionOwner.native.ts";
import { requireCareWorkspaceAuthorityWeb, type CareWorkspaceAuthoritySdkWeb } from "../pflege/careWorkspaceAuthority.native.ts";
import { withServiceQueryTimeout, NATIVE_SERVICE_QUERY_TIMEOUT_MS } from '../services/queryTimeout.ts';
const failure = () => new Error('Authentifiziertes Konto, internes Profil und eigener Mandant sind nicht gemeinsam bestätigt.');
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const record = (value: unknown): Record<string, unknown> => { if (!value || typeof value !== 'object' || Array.isArray(value))
    throw failure(); return value as Record<string, unknown>; };
/** Local preflight; each clinical RPC must still authorize its own current server session. */
export async function assertCareSdkOwnerWeb(input: {
    client: unknown;
    owner: CarePermissionOwner;
    current(): void;
    pinnedAuthId: string | null;
}): Promise<string> {
    const { owner, current } = input, sdk = input.client as CareWorkspaceAuthoritySdkWeb;
    current();
    if (!sdk || !uuid(owner.profileId) || !uuid(owner.tenantId) || owner.demo !== false || !owner.accessToken || !Number.isSafeInteger(owner.expiresAt) || owner.expiresAt! <= Date.now())
        throw failure();
    const auth = sdk.auth;
    current();
    const getSession = auth.getSession, getUser = auth.getUser, rpc = sdk.rpc;
    current();
    if (typeof getSession !== 'function' || typeof getUser !== 'function' || typeof rpc !== 'function' || auth.getSession !== getSession || auth.getUser !== getUser || sdk.rpc !== rpc)
        throw failure();
    current();
    let rawAuthId: string | null = input.pinnedAuthId;
    const call = async (method: Function, receiver: unknown, args: unknown[]) => { current(); const request = Reflect.apply(method, receiver, args); current(); const result = cloneClientNativeOriginal(await withServiceQueryTimeout(Promise.resolve(request), 'Eigenes Konto bestätigen', NATIVE_SERVICE_QUERY_TIMEOUT_MS)); current(); const response = record(result); if (response.error !== null)
        throw failure(); return response; };
    const facade: CareWorkspaceAuthoritySdkWeb = { auth: {
            getSession: async () => { const response = await call(getSession, auth, []), session = record(record(response.data).session), user = record(session.user); if (!uuid(user.id) || rawAuthId !== null && rawAuthId !== user.id || session.access_token !== owner.accessToken || !Number.isSafeInteger(session.expires_at) || Number(session.expires_at) * 1000 !== owner.expiresAt || Number(session.expires_at) * 1000 <= Date.now())
                throw failure(); rawAuthId = user.id; current(); return response as unknown as Awaited<ReturnType<CareWorkspaceAuthoritySdkWeb['auth']['getSession']>>; },
            getUser: async (token) => { if (token !== owner.accessToken)
                throw failure(); const response = await call(getUser, auth, [token]), user = record(record(response.data).user); if (user.id !== rawAuthId || user.is_anonymous === true)
                throw failure(); return response as unknown as Awaited<ReturnType<CareWorkspaceAuthoritySdkWeb['auth']['getUser']>>; },
        }, rpc: async (name, args) => { if (!['resolve_current_profile_id', 'current_tenant_id'].includes(name))
            throw failure(); return await call(rpc, sdk, [name, args]) as unknown as Awaited<ReturnType<CareWorkspaceAuthoritySdkWeb['rpc']>>; } };
    await requireCareWorkspaceAuthorityWeb({ tenantId: owner.tenantId, actorId: owner.profileId, isCurrent: () => { current(); return true; } }, () => { current(); return facade; }, (request, operation) => withServiceQueryTimeout(Promise.resolve(request), operation, NATIVE_SERVICE_QUERY_TIMEOUT_MS), failure().message);
    current();
    if (rawAuthId === null)
        throw failure();
    return rawAuthId;
}
