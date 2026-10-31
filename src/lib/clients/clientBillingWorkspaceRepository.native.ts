// Generated native presentation from src/lib/clients/clientBillingWorkspaceRepository.web.ts. Update through scripts/port-native-workspaces.mjs.
import {nativeStructuredClone as structuredClone} from '@/lib/platform/nativeWorkflowEnvironment.native';
import type { HandoverSdk } from "../pflege/caseHandoverRepository.native.ts";
import { decodeClientBillingContext, decodeClientBillingReceipt, validateClientBillingCommand, type ClientBillingCommand, type ClientBillingContext, type ClientBillingReceipt } from "./clientBillingWorkspaceDomain.native.ts";
export type ClientBillingAuthority = {
    tenantId: string;
    clientId: string;
    actorId: string;
    accessToken: string;
    expiresAt: number | null;
    isCurrent(): boolean;
};
export type ClientBillingResult<T> = {
    ok: true;
    data: T;
} | {
    ok: false;
    error: string;
    rejected?: boolean;
    uncertain?: boolean;
};
type Options = {
    getSdk(): HandoverSdk | null;
    query<T>(request: PromiseLike<T>, operation: string): Promise<T>;
};
const unavailable = 'Sitzung, aktuelle Rechnungsrechte oder vollständige Abrechnungsoriginale sind nicht bestätigt.';
export function createClientBillingRepository(options: Options) {
    const current = (authority: ClientBillingAuthority, sdk?: HandoverSdk) => { if (!authority.isCurrent() || authority.expiresAt !== null && authority.expiresAt <= Date.now() || sdk && options.getSdk() !== sdk)
        throw Error(unavailable); };
    async function authorize(authority: ClientBillingAuthority) { current(authority); const sdk = options.getSdk(); if (!sdk)
        throw Error(unavailable); const session = await options.query(sdk.auth.getSession(), 'Abrechnungssitzung prüfen'); current(authority, sdk); const own = session.data.session; if (session.error || !own || own.user.id !== authority.actorId || own.access_token !== authority.accessToken || own.expires_at !== undefined && own.expires_at * 1000 <= Date.now())
        throw Error(unavailable); const user = await options.query(sdk.auth.getUser(authority.accessToken), 'Abrechnungskonto bestätigen'); current(authority, sdk); if (user.error || user.data.user?.id !== authority.actorId)
        throw Error(unavailable); return sdk; }
    const args = (authority: ClientBillingAuthority) => ({ p_tenant_id: authority.tenantId, p_client_id: authority.clientId, p_actor_id: authority.actorId });
    return {
        async context(authority: ClientBillingAuthority): Promise<ClientBillingResult<ClientBillingContext>> { try {
            const sdk = await authorize(authority);
            const result = await options.query(sdk.rpc('web_client_billing_context', args(authority)), 'Abrechnungsoriginale lesen');
            current(authority, sdk);
            if (result.error)
                throw Error(unavailable);
            return { ok: true, data: decodeClientBillingContext(result.data, authority) };
        }
        catch (error) {
            return { ok: false, error: error instanceof Error ? error.message : unavailable };
        } },
        async commit(authority: ClientBillingAuthority, command: ClientBillingCommand): Promise<ClientBillingResult<ClientBillingReceipt>> { const copy = structuredClone(command); let sent = false; try {
            validateClientBillingCommand(copy);
            if (copy.tenantId !== authority.tenantId || copy.clientId !== authority.clientId || copy.actorId !== authority.actorId)
                throw Error(unavailable);
            const sdk = await authorize(authority);
            sent = true;
            const result = await options.query(sdk.rpc('web_commit_client_billing_event', { p_command: copy }), 'Abrechnungsvorgang speichern');
            current(authority, sdk);
            if (result.error) {
                const code = typeof result.error === 'object' && result.error !== null ? String(Object.getOwnPropertyDescriptor(result.error, 'code')?.value ?? '') : '';
                const rejected = result.data === null && ['22007', '22008', '22023', '22P02', '23503', '23505', '23514', '40001', '40P01', '42501', 'P0P01'].includes(code);
                return { ok: false, error: rejected ? 'Der Vorgang wurde vollständig abgewiesen. Originale neu laden.' : 'Der Schreibausgang ist unklar. Nur die gesicherte native Quittung prüfen.', ...(rejected ? { rejected: true } : { uncertain: true }) };
            }
            return { ok: true, data: decodeClientBillingReceipt(result.data, copy) };
        }
        catch (error) {
            return { ok: false, error: error instanceof Error ? error.message : unavailable, ...(sent ? { uncertain: true } : { rejected: true }) };
        } },
        async confirm(authority: ClientBillingAuthority, command: ClientBillingCommand): Promise<ClientBillingResult<ClientBillingReceipt>> { const copy = structuredClone(command); try {
            validateClientBillingCommand(copy);
            const sdk = await authorize(authority);
            const result = await options.query(sdk.rpc('web_confirm_client_billing_event', { ...args(authority), p_request_id: copy.requestId, p_command: copy }), 'Abrechnungsquittung lesen');
            current(authority, sdk);
            if (result.error)
                throw Error(unavailable);
            return { ok: true, data: decodeClientBillingReceipt(result.data, copy) };
        }
        catch {
            return { ok: false, uncertain: true, error: 'Die passende native Quittung ist noch nicht bestätigt. Die Anfrage bleibt gesichert und wird nicht erneut gesendet.' };
        } },
    };
}
