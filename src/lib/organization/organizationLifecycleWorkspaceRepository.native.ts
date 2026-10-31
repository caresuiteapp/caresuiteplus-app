// Generated native presentation from src/lib/organization/organizationLifecycleWorkspaceRepository.web.ts. Update through scripts/port-native-workspaces.mjs.
import {nativeStructuredClone as structuredClone} from '@/lib/platform/nativeWorkflowEnvironment.native';
import type { HandoverSdk } from "../pflege/caseHandoverRepository.native.ts";
import { decodeOrganizationLifecycleContext, decodeOrganizationLifecycleReceipt, validateOrganizationLifecycleCommand, type OrganizationLifecycleCommand, type OrganizationLifecycleContext, type OrganizationLifecycleReceipt } from "./organizationLifecycleWorkspaceDomain.native.ts";
export type OrganizationLifecycleAuthority = {
    tenantId: string;
    actorId: string;
    accessToken: string;
    expiresAt: number | null;
    isCurrent(): boolean;
};
export type OrganizationLifecycleResult<T> = {
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
const unavailable = 'Sitzung, aktuelle Organisations- und Stammdatenrechte oder vollständige Organisations- und Stammdatenoriginale sind nicht bestätigt.';
export function createOrganizationLifecycleRepository(options: Options) {
    const current = (a: OrganizationLifecycleAuthority, sdk?: HandoverSdk) => { if (!a.isCurrent() || a.expiresAt !== null && a.expiresAt <= Date.now() || sdk && options.getSdk() !== sdk)
        throw Error(unavailable); };
    async function authorize(a: OrganizationLifecycleAuthority) { current(a); const sdk = options.getSdk(); if (!sdk)
        throw Error(unavailable); const session = await options.query(sdk.auth.getSession(), 'Organisations- und Stammdatensitzung prüfen'); current(a, sdk); const own = session.data.session; if (session.error || !own || own.user.id !== a.actorId || own.access_token !== a.accessToken || own.expires_at !== undefined && own.expires_at * 1000 <= Date.now())
        throw Error(unavailable); const user = await options.query(sdk.auth.getUser(a.accessToken), 'Organisations- und Stammdatenkonto bestätigen'); current(a, sdk); if (user.error || user.data.user?.id !== a.actorId)
        throw Error(unavailable); return sdk; }
    const args = (a: OrganizationLifecycleAuthority) => ({ p_tenant_id: a.tenantId, p_actor_id: a.actorId });
    return {
        async context(a: OrganizationLifecycleAuthority): Promise<OrganizationLifecycleResult<OrganizationLifecycleContext>> { try {
            const sdk = await authorize(a), result = await options.query(sdk.rpc('web_organization_lifecycle_workspace_context', args(a)), 'Organisations- und Stammdatenoriginale lesen');
            current(a, sdk);
            if (result.error)
                throw Error(unavailable);
            return { ok: true, data: decodeOrganizationLifecycleContext(result.data, a) };
        }
        catch (error) {
            return { ok: false, error: error instanceof Error ? error.message : unavailable };
        } },
        async commit(a: OrganizationLifecycleAuthority, command: OrganizationLifecycleCommand): Promise<OrganizationLifecycleResult<OrganizationLifecycleReceipt>> { const copy = structuredClone(command); let sent = false; try {
            validateOrganizationLifecycleCommand(copy);
            if (copy.tenantId !== a.tenantId || copy.actorId !== a.actorId)
                throw Error(unavailable);
            const sdk = await authorize(a);
            sent = true;
            const result = await options.query(sdk.rpc('web_commit_organization_lifecycle_event', { p_command: copy }), 'Organisations- und Stammdatenvorgang speichern');
            current(a, sdk);
            if (result.error) {
                const code = typeof result.error === 'object' && result.error !== null ? String(Object.getOwnPropertyDescriptor(result.error, 'code')?.value ?? '') : '';
                const rejected = result.data === null && ['22007', '22008', '22023', '22P02', '23503', '23505', '23514', '40001', '40P01', '42501', 'P0P01'].includes(code);
                return { ok: false, error: rejected ? 'Der Vorgang wurde vollständig abgewiesen. Originale neu laden.' : 'Der Schreibausgang ist unklar. Nur die gesicherte native Quittung prüfen.', ...(rejected ? { rejected: true } : { uncertain: true }) };
            }
            return { ok: true, data: decodeOrganizationLifecycleReceipt(result.data, copy) };
        }
        catch (error) {
            return { ok: false, error: error instanceof Error ? error.message : unavailable, ...(sent ? { uncertain: true } : { rejected: true }) };
        } },
        async confirm(a: OrganizationLifecycleAuthority, command: OrganizationLifecycleCommand): Promise<OrganizationLifecycleResult<OrganizationLifecycleReceipt>> { const copy = structuredClone(command); try {
            validateOrganizationLifecycleCommand(copy);
            const sdk = await authorize(a), result = await options.query(sdk.rpc('web_confirm_organization_lifecycle_event', { ...args(a), p_request_id: copy.requestId, p_command: copy }), 'Organisations- und Stammdatenquittung lesen');
            current(a, sdk);
            if (result.error)
                throw Error(unavailable);
            return { ok: true, data: decodeOrganizationLifecycleReceipt(result.data, copy) };
        }
        catch {
            return { ok: false, uncertain: true, error: 'Die passende native Quittung ist noch nicht bestätigt. Die Anfrage bleibt gesichert und wird nicht erneut gesendet.' };
        } }
    };
}
