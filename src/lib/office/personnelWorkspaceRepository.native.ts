// Generated native presentation from src/lib/office/personnelWorkspaceRepository.web.ts. Update through scripts/port-native-workspaces.mjs.
import {nativeStructuredClone as structuredClone} from '@/lib/platform/nativeWorkflowEnvironment.native';
import { decodePersonnelContext, decodePersonnelReceipt, personnelBaseRights, personnelId, personnelObject, personnelVersion, validatePersonnelCommand, type PersonnelCommand, type PersonnelContext, type PersonnelReceipt, type PersonnelRow } from "./personnelWorkspaceDomain.native.ts";
import type { HandoverAuthority, HandoverSdk } from "../pflege/caseHandoverRepository.native.ts";
export type PersonnelAuthority = HandoverAuthority;
export type PersonnelResult<T> = {
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
const unavailable = 'Sitzung, aktuelle Personalrechte oder vollständige Originalbelege sind nicht bestätigt.';
const fail = <T>(error = unavailable): PersonnelResult<T> => ({ ok: false, error });
export function createPersonnelRepository(options: Options) {
    const current = (a: PersonnelAuthority, sdk?: HandoverSdk) => { if (!a.isCurrent() || a.expiresAt !== null && a.expiresAt <= Date.now() || sdk && options.getSdk() !== sdk)
        throw Error(unavailable); };
    async function authority(a: PersonnelAuthority) { current(a); const sdk = options.getSdk(); if (!sdk)
        throw Error(unavailable); const session = await options.query(sdk.auth.getSession(), 'Personalsitzung prüfen'); current(a, sdk); const s = session.data.session; if (session.error || !s || s.user.id !== a.actorId || s.access_token !== a.accessToken || s.expires_at !== undefined && s.expires_at * 1000 <= Date.now())
        throw Error(unavailable); const user = await options.query(sdk.auth.getUser(a.accessToken), 'Personalkonto bestätigen'); current(a, sdk); if (user.error || user.data.user?.id !== a.actorId)
        throw Error(unavailable); return sdk; }
    const args = (a: PersonnelAuthority, employeeId?: string) => ({ p_tenant_id: a.tenantId, p_actor_id: a.actorId, ...(employeeId ? { p_employee_id: employeeId } : {}) });
    async function call(a: PersonnelAuthority, name: string, p: PersonnelRow) { const sdk = await authority(a); current(a, sdk); const r = await options.query(sdk.rpc(name, p), 'Vollständige Personalakte lesen'); current(a, sdk); if (r.error)
        throw Error(unavailable); return r.data; }
    return {
        async employees(a: PersonnelAuthority): Promise<PersonnelResult<PersonnelRow[]>> { try {
            const v = await call(a, 'web_personnel_employees', args(a));
            if (!personnelObject(v) || Object.keys(v).length !== 5 || v.version !== personnelVersion || v.tenantId !== a.tenantId || v.actorId !== a.actorId || !Array.isArray(v.employees) || v.count !== v.employees.length || v.employees.length > 10000)
                throw Error(unavailable);
            const ids = new Set<string>();
            for (const r of v.employees) {
                if (!personnelObject(r) || Object.keys(r).sort().join(',') !== 'first_name,id,last_name,status,tenant_id' || !personnelId(r.id) || r.tenant_id !== a.tenantId || ids.has(r.id))
                    throw Error(unavailable);
                ids.add(r.id);
            }
            return { ok: true, data: structuredClone(v.employees) };
        }
        catch {
            return fail();
        } },
        async context(a: PersonnelAuthority, employeeId: string): Promise<PersonnelResult<PersonnelContext>> { try {
            if (!personnelId(employeeId))
                throw Error(unavailable);
            const v = await call(a, 'web_personnel_context', args(a, employeeId));
            return { ok: true, data: decodePersonnelContext(v, { tenantId: a.tenantId, employeeId, actorId: a.actorId }) };
        }
        catch (e) {
            return fail(e instanceof Error ? e.message : unavailable);
        } },
        async commit(a: PersonnelAuthority, command: PersonnelCommand): Promise<PersonnelResult<PersonnelReceipt>> { const c = structuredClone(command); let sent = false; try {
            validatePersonnelCommand(c);
            if (c.tenantId !== a.tenantId || c.actorId !== a.actorId)
                throw Error(unavailable);
            const sdk = await authority(a);
            current(a, sdk);
            sent = true;
            const r = await options.query(sdk.rpc('web_commit_personnel_event', { p_command: c }), 'Personalereignis verbindlich speichern');
            current(a, sdk);
            if (r.error) {
                const code = personnelObject(r.error) ? String(r.error.code ?? '') : '';
                const rejected = r.data === null && ['22007', '22008', '22023', '22P02', '23514', '23505', '40001', '42501', 'P0P01'].includes(code);
                return { ok: false, error: rejected ? 'Der Personalvorgang wurde vollständig abgewiesen. Aktuelle Fassung und Originale erneut prüfen.' : 'Die Speicherantwort ist unklar. Den gesicherten Vorgang ausschließlich lesend prüfen.', ...(rejected ? { rejected: true } : { uncertain: true }) };
            }
            return { ok: true, data: decodePersonnelReceipt(r.data, c) };
        }
        catch (e) {
            return { ok: false, error: e instanceof Error ? e.message : unavailable, ...(sent ? { uncertain: true } : { rejected: true }) };
        } },
        async confirm(a: PersonnelAuthority, command: PersonnelCommand): Promise<PersonnelResult<PersonnelReceipt>> { const c = structuredClone(command); try {
            validatePersonnelCommand(c);
            if (c.tenantId !== a.tenantId || c.actorId !== a.actorId)
                throw Error(unavailable);
            const v = await call(a, 'web_confirm_personnel_event', { ...args(a, c.employeeId), p_request_id: c.requestId, p_command: c });
            return { ok: true, data: decodePersonnelReceipt(v, c) };
        }
        catch {
            return { ok: false, uncertain: true, error: 'Die passende native Quittung ist noch nicht bestätigt. Die Anfrage bleibt gesichert und wird nicht erneut gesendet.' };
        } }
    };
}
export { personnelBaseRights };
