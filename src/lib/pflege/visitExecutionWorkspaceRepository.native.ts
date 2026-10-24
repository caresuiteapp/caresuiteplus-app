// Generated native presentation from src/lib/pflege/visitExecutionWorkspaceRepository.web.ts. Update through scripts/port-native-workspaces.mjs.
import {nativeStructuredClone as structuredClone} from '@/lib/platform/nativeWorkflowEnvironment.native';
import type { HandoverAuthority, HandoverSdk } from "./caseHandoverRepository.native.ts";
import { decodeVisitContext, decodeVisitReceipt, visitExecutionVersion, visitId, visitObject, validateVisitCommand, type VisitCommand, type VisitContext, type VisitReceipt, type VisitRow } from "./visitExecutionWorkspaceDomain.native.ts";
export type VisitAuthority = HandoverAuthority;
export type VisitResult<T> = {
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
const unavailable = 'Sitzung, aktuelle Einsatzrechte oder vollständige Originalbelege sind nicht bestätigt.';
const fail = <T>(error = unavailable): VisitResult<T> => ({ ok: false, error });
export function createVisitExecutionRepository(options: Options) {
    const current = (authority: VisitAuthority, sdk?: HandoverSdk) => { if (!authority.isCurrent() || authority.expiresAt !== null && authority.expiresAt <= Date.now() || sdk && options.getSdk() !== sdk)
        throw Error(unavailable); };
    async function authorize(authority: VisitAuthority) { current(authority); const sdk = options.getSdk(); if (!sdk)
        throw Error(unavailable); const session = await options.query(sdk.auth.getSession(), 'Einsatzsitzung prüfen'); current(authority, sdk); const active = session.data.session; if (session.error || !active || active.user.id !== authority.actorId || active.access_token !== authority.accessToken || active.expires_at !== undefined && active.expires_at * 1000 <= Date.now())
        throw Error(unavailable); const user = await options.query(sdk.auth.getUser(authority.accessToken), 'Einsatzkonto bestätigen'); current(authority, sdk); if (user.error || user.data.user?.id !== authority.actorId)
        throw Error(unavailable); return sdk; }
    const args = (authority: VisitAuthority, stopId?: string) => ({ p_tenant_id: authority.tenantId, p_actor_id: authority.actorId, ...(stopId ? { p_stop_id: stopId } : {}) });
    async function call(authority: VisitAuthority, name: string, payload: VisitRow) { const sdk = await authorize(authority); const result = await options.query(sdk.rpc(name, payload), 'Vollständigen Einsatzbestand lesen'); current(authority, sdk); if (result.error)
        throw Error(unavailable); return result.data; }
    return {
        async stops(authority: VisitAuthority): Promise<VisitResult<VisitRow[]>> { try {
            const value = await call(authority, 'web_visit_execution_stops', args(authority));
            if (!visitObject(value) || value.version !== visitExecutionVersion || value.tenantId !== authority.tenantId || value.actorId !== authority.actorId || !Array.isArray(value.stops) || value.count !== value.stops.length || value.stops.length > 10000)
                throw Error(unavailable);
            const ids = new Set<string>();
            for (const row of value.stops) {
                if (!visitObject(row) || !visitId(row.id) || row.tenant_id !== authority.tenantId || ids.has(row.id))
                    throw Error(unavailable);
                ids.add(row.id);
            }
            return { ok: true, data: structuredClone(value.stops) };
        }
        catch {
            return fail();
        } },
        async context(authority: VisitAuthority, stopId: string): Promise<VisitResult<VisitContext>> { try {
            if (!visitId(stopId))
                throw Error(unavailable);
            const value = await call(authority, 'web_visit_execution_context', args(authority, stopId));
            return { ok: true, data: decodeVisitContext(value, { tenantId: authority.tenantId, stopId, actorId: authority.actorId }) };
        }
        catch (error) {
            return fail(error instanceof Error ? error.message : unavailable);
        } },
        async commit(authority: VisitAuthority, command: VisitCommand): Promise<VisitResult<VisitReceipt>> { const copy = structuredClone(command); let sent = false; try {
            validateVisitCommand(copy);
            if (copy.tenantId !== authority.tenantId || copy.actorId !== authority.actorId)
                throw Error(unavailable);
            const sdk = await authorize(authority);
            sent = true;
            const result = await options.query(sdk.rpc('web_commit_visit_execution_event', { p_command: copy }), 'Einsatzereignis verbindlich speichern');
            current(authority, sdk);
            if (result.error) {
                const code = visitObject(result.error) ? String(result.error.code ?? '') : '';
                const rejected = result.data === null && ['22007', '22008', '22023', '22P02', '23514', '23505', '40001', '42501', 'P0P01'].includes(code);
                return { ok: false, error: rejected ? 'Der Einsatzvorgang wurde vollständig abgewiesen. Aktuelle Originale und Pflichtangaben neu prüfen.' : 'Die Speicherantwort ist unklar. Die gesicherte Anfrage ausschließlich lesend prüfen.', ...(rejected ? { rejected: true } : { uncertain: true }) };
            }
            return { ok: true, data: decodeVisitReceipt(result.data, copy) };
        }
        catch (error) {
            return { ok: false, error: error instanceof Error ? error.message : unavailable, ...(sent ? { uncertain: true } : { rejected: true }) };
        } },
        async confirm(authority: VisitAuthority, command: VisitCommand): Promise<VisitResult<VisitReceipt>> { const copy = structuredClone(command); try {
            validateVisitCommand(copy);
            if (copy.tenantId !== authority.tenantId || copy.actorId !== authority.actorId)
                throw Error(unavailable);
            const value = await call(authority, 'web_confirm_visit_execution_event', { ...args(authority, copy.stopId), p_request_id: copy.requestId, p_command: copy });
            return { ok: true, data: decodeVisitReceipt(value, copy) };
        }
        catch {
            return { ok: false, uncertain: true, error: 'Die passende native Einsatzquittung ist noch nicht bestätigt. Die Anfrage bleibt gesichert und wird nicht erneut gesendet.' };
        } },
    };
}
