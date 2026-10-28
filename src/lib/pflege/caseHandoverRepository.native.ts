// Generated native presentation from src/lib/pflege/caseHandoverRepository.web.ts. Update through scripts/port-native-workspaces.mjs.
import {nativeStructuredClone as structuredClone} from '@/lib/platform/nativeWorkflowEnvironment.native';
import { caseHandoverVersion, decodeCaseHandoverContext, decodeCaseHandoverHistory, decodeCaseHandoverReceipt, handoverObject, validateCaseHandoverCommand, type CaseHandoverCommand, type CaseHandoverContext, type CaseHandoverReceipt, type CaseHandoverState, type NativeRow, } from "./caseHandoverDomain.native.ts";
import { woundUuid } from './woundCareDomain.ts';
import type { HandoverResult, HandoverScope } from "./caseHandoverWorkflow.native.ts";
export type HandoverSdk = {
    auth: {
        getSession(): Promise<{
            data: {
                session: {
                    user: {
                        id: string;
                    };
                    access_token: string;
                    expires_at?: number;
                } | null;
            };
            error: unknown;
        }>;
        getUser(token: string): Promise<{
            data: {
                user: {
                    id: string;
                } | null;
            };
            error: unknown;
        }>;
    };
    rpc(name: string, args: NativeRow): PromiseLike<{
        data: unknown;
        error: unknown;
        status?: number;
    }>;
};
export type HandoverAuthority = {
    tenantId: string;
    actorId: string;
    accessToken: string;
    expiresAt: number | null;
    isCurrent(): boolean;
};
type Options = {
    getSdk(): HandoverSdk | null;
    query<T>(request: PromiseLike<T>, operation: string): Promise<T>;
};
const unavailable = 'Der aktuelle Übergabekontext konnte nicht vollständig bestätigt werden.';
const failResult = <T>(error = unavailable): HandoverResult<T> => ({ ok: false, error });
const message = (e: unknown) => e instanceof Error ? e.message : unavailable;
/** Injectable SDK boundary: session, token, native user and generation checked around every await. */
export function createCaseHandoverRepository(options: Options) {
    function current(a: HandoverAuthority, sdk?: HandoverSdk) {
        if (!a.isCurrent() || a.expiresAt !== null && a.expiresAt <= Date.now() || sdk && options.getSdk() !== sdk)
            throw Error(unavailable);
    }
    async function authority(a: HandoverAuthority) {
        current(a);
        const sdk = options.getSdk();
        if (!sdk)
            throw Error(unavailable);
        const session = await options.query(sdk.auth.getSession(), 'Übergabesitzung prüfen');
        current(a, sdk);
        const s = session.data.session;
        if (session.error || !s || s.user.id !== a.actorId || s.access_token !== a.accessToken || s.expires_at !== undefined && s.expires_at * 1000 <= Date.now())
            throw Error(unavailable);
        const user = await options.query(sdk.auth.getUser(a.accessToken), 'Übergabekonto bestätigen');
        current(a, sdk);
        if (user.error || user.data.user?.id !== a.actorId)
            throw Error(unavailable);
        return sdk;
    }
    async function call(a: HandoverAuthority, name: string, args: NativeRow) {
        const sdk = await authority(a);
        current(a, sdk);
        const result = await options.query(sdk.rpc(name, args), 'Übergabe vollständig laden');
        current(a, sdk);
        if (result.error)
            throw Error(unavailable);
        return result.data;
    }
    const args = (a: HandoverAuthority, clientId: string | null = null) => ({ p_tenant_id: a.tenantId, p_actor_id: a.actorId, ...(clientId ? { p_client_id: clientId } : {}) });
    function scope(a: HandoverAuthority, clientId: string): HandoverScope {
        if (![a.tenantId, a.actorId, clientId].every(v => woundUuid(v) && v === v.toLowerCase()))
            throw Error(unavailable);
        return { tenantId: a.tenantId, actorId: a.actorId, clientId };
    }
    return {
        async clients(a: HandoverAuthority): Promise<HandoverResult<NativeRow[]>> {
            try {
                const v = await call(a, 'web_case_handover_clients', args(a));
                if (!handoverObject(v) || Object.keys(v).length !== 5 || v.version !== caseHandoverVersion || v.tenantId !== a.tenantId || v.actorId !== a.actorId || !Array.isArray(v.clients) || v.count !== v.clients.length || v.clients.length > 10000)
                    return failResult();
                const seen = new Set<string>();
                for (const row of v.clients) {
                    if (!handoverObject(row) || !woundUuid(row.id) || row.id !== row.id.toLowerCase() || row.tenant_id !== a.tenantId || seen.has(row.id))
                        return failResult();
                    seen.add(row.id);
                }
                return { ok: true, data: structuredClone(v.clients) };
            }
            catch (e) {
                return failResult(message(e));
            }
        },
        async context(a: HandoverAuthority, clientId: string): Promise<HandoverResult<CaseHandoverContext>> {
            try {
                const ownScope = scope(a, clientId), data = await call(a, 'web_case_handover_context', args(a, clientId));
                return { ok: true, data: decodeCaseHandoverContext(data, ownScope) };
            }
            catch (e) {
                return failResult(message(e));
            }
        },
        async list(a: HandoverAuthority, clientId: string): Promise<HandoverResult<CaseHandoverState[]>> {
            try {
                const s = scope(a, clientId), v = await call(a, 'web_case_handover_list', args(a, clientId));
                if (!handoverObject(v) || Object.keys(v).length !== 5 || v.version !== caseHandoverVersion || v.tenantId !== a.tenantId || v.clientId !== clientId || !Array.isArray(v.rows) || v.count !== v.rows.length || v.rows.length > 1000)
                    return failResult();
                const seen = new Set<string>(), rows = v.rows.map(h => {
                    if (!handoverObject(h) || !woundUuid(h.handoverId) || seen.has(h.handoverId))
                        throw Error(unavailable);
                    seen.add(h.handoverId);
                    return decodeCaseHandoverHistory(h, { ...s, handoverId: h.handoverId });
                });
                return { ok: true, data: rows };
            }
            catch (e) {
                return failResult(message(e));
            }
        },
        async history(a: HandoverAuthority, clientId: string, handoverId: string): Promise<HandoverResult<CaseHandoverState>> {
            try {
                const s = scope(a, clientId);
                if (!woundUuid(handoverId))
                    return failResult();
                const data = await call(a, 'web_case_handover_history', { ...args(a, clientId), p_handover_id: handoverId });
                return { ok: true, data: decodeCaseHandoverHistory(data, { ...s, handoverId }) };
            }
            catch (e) {
                return failResult(message(e));
            }
        },
        async commit(a: HandoverAuthority, command: CaseHandoverCommand): Promise<HandoverResult<CaseHandoverReceipt>> {
            const captured = structuredClone(command);
            let dispatched = false;
            try {
                validateCaseHandoverCommand(captured);
                if (captured.actorId !== a.actorId || captured.tenantId !== a.tenantId)
                    throw Error(unavailable);
                const sdk = await authority(a);
                current(a, sdk);
                dispatched = true;
                const result = await options.query(sdk.rpc('web_commit_case_handover', { p_command: captured }), 'Übergabe verbindlich speichern');
                current(a, sdk);
                if (result.error) {
                    // Only explicit transaction rollback codes with no returned data establish rejection.
                    const code = handoverObject(result.error) ? String(result.error.code ?? '') : '';
                    const rejected = result.data === null && ['22007', '22008', '22023', '22P02', '23514', '23505', '40001', '40P01', '42501', 'P0H01'].includes(code);
                    return { ok: false, error: rejected ? 'Die Anfrage wurde vollständig abgewiesen. Aktuelle Quellen und Fassung erneut prüfen.' : 'Die Speicherantwort ist unklar. Die gesicherte Anfrage ausschließlich lesend prüfen.', ...(rejected ? { rejected: true } : { uncertain: true }) };
                }
                return { ok: true, data: decodeCaseHandoverReceipt(result.data, captured) };
            }
            catch (e) {
                return { ok: false, error: message(e), ...(dispatched ? { uncertain: true } : { rejected: true }) };
            }
        },
        async confirm(a: HandoverAuthority, command: CaseHandoverCommand): Promise<HandoverResult<CaseHandoverReceipt>> {
            const captured = structuredClone(command);
            try {
                validateCaseHandoverCommand(captured);
                if (captured.actorId !== a.actorId || captured.tenantId !== a.tenantId)
                    throw Error(unavailable);
                const data = await call(a, 'web_confirm_case_handover', { ...args(a, captured.clientId), p_request_id: captured.requestId, p_command: captured });
                return { ok: true, data: decodeCaseHandoverReceipt(data, captured) };
            }
            catch {
                return { ok: false, uncertain: true, error: 'Für genau diese Anfrage konnte noch keine passende native Quittung bestätigt werden. Sie bleibt gesichert und wird nicht erneut gesendet.' };
            }
        },
    };
}
