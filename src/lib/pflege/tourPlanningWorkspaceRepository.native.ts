// Generated native presentation from src/lib/pflege/tourPlanningWorkspaceRepository.web.ts. Update through scripts/port-native-workspaces.mjs.
import {nativeStructuredClone as structuredClone} from '@/lib/platform/nativeWorkflowEnvironment.native';
import { decodePlanningInbox, type PlanningInboxEntry } from "./tourPlanningInbox.native.ts";
import type { HandoverAuthority, HandoverSdk } from "./caseHandoverRepository.native.ts";
import { decodeTourPlanningContext, decodeTourPlanningReceipt, tourPlanningId, tourPlanningObject, tourPlanningVersion, validateTourPlanningCommand, type TourPlanningCommand, type TourPlanningContext, type TourPlanningReceipt, type TourPlanningRow } from "./tourPlanningWorkspaceDomain.native.ts";
export type TourPlanningAuthority = HandoverAuthority;
export type TourPlanningResult<T> = {
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
const unavailable = 'Sitzung, aktuelle Planungsrechte oder vollständige Originalbelege sind nicht bestätigt.';
const fail = <T>(error = unavailable): TourPlanningResult<T> => ({ ok: false, error });
export function createTourPlanningRepository(options: Options) {
    const current = (authority: TourPlanningAuthority, sdk?: HandoverSdk) => { if (!authority.isCurrent() || authority.expiresAt !== null && authority.expiresAt <= Date.now() || sdk && options.getSdk() !== sdk)
        throw Error(unavailable); };
    async function authorize(authority: TourPlanningAuthority) {
        current(authority);
        const sdk = options.getSdk();
        if (!sdk)
            throw Error(unavailable);
        const session = await options.query(sdk.auth.getSession(), 'Planungssitzung prüfen');
        current(authority, sdk);
        const currentSession = session.data.session;
        if (session.error || !currentSession || currentSession.user.id !== authority.actorId || currentSession.access_token !== authority.accessToken || currentSession.expires_at !== undefined && currentSession.expires_at * 1000 <= Date.now())
            throw Error(unavailable);
        const user = await options.query(sdk.auth.getUser(authority.accessToken), 'Planungskonto bestätigen');
        current(authority, sdk);
        if (user.error || user.data.user?.id !== authority.actorId)
            throw Error(unavailable);
        return sdk;
    }
    const argumentsFor = (authority: TourPlanningAuthority, planId?: string) => ({ p_tenant_id: authority.tenantId, p_actor_id: authority.actorId, ...(planId ? { p_plan_id: planId } : {}) });
    async function call(authority: TourPlanningAuthority, name: string, payload: TourPlanningRow) { const sdk = await authorize(authority); current(authority, sdk); const result = await options.query(sdk.rpc(name, payload), 'Vollständige Tourenplanung lesen'); current(authority, sdk); if (result.error)
        throw Error(unavailable); return result.data; }
    return {
        async inbox(authority: TourPlanningAuthority): Promise<TourPlanningResult<PlanningInboxEntry[]>> {
            try {
                const value = await call(authority, 'web_my_tour_publications', argumentsFor(authority));
                return { ok: true, data: decodePlanningInbox(value, authority) };
            }
            catch {
                return fail('Persönliche Planfassungen konnten unter den aktuellen Rechten nicht vollständig gelesen werden.');
            }
        },
        async plans(authority: TourPlanningAuthority): Promise<TourPlanningResult<TourPlanningRow[]>> {
            try {
                const value = await call(authority, 'web_tour_planning_plans', argumentsFor(authority));
                if (!tourPlanningObject(value) || Object.keys(value).length !== 5 || value.version !== tourPlanningVersion || value.tenantId !== authority.tenantId || value.actorId !== authority.actorId || !Array.isArray(value.plans) || value.count !== value.plans.length || value.plans.length > 10000)
                    throw Error(unavailable);
                const ids = new Set<string>();
                for (const row of value.plans) {
                    if (!tourPlanningObject(row) || Object.keys(row).sort().join(',') !== 'employee_name_snapshot,id,name,status,tenant_id,tour_date,updated_at' || !tourPlanningId(row.id) || row.tenant_id !== authority.tenantId || ids.has(row.id))
                        throw Error(unavailable);
                    ids.add(row.id);
                }
                return { ok: true, data: structuredClone(value.plans) };
            }
            catch {
                return fail();
            }
        },
        async context(authority: TourPlanningAuthority, planId: string): Promise<TourPlanningResult<TourPlanningContext>> {
            try {
                if (!tourPlanningId(planId))
                    throw Error(unavailable);
                const value = await call(authority, 'web_tour_planning_context', argumentsFor(authority, planId));
                return { ok: true, data: decodeTourPlanningContext(value, { tenantId: authority.tenantId, planId, actorId: authority.actorId }) };
            }
            catch (error) {
                return fail(error instanceof Error ? error.message : unavailable);
            }
        },
        async commit(authority: TourPlanningAuthority, command: TourPlanningCommand): Promise<TourPlanningResult<TourPlanningReceipt>> {
            const copy = structuredClone(command);
            let sent = false;
            try {
                validateTourPlanningCommand(copy);
                if (copy.version !== tourPlanningVersion)
                    throw Error('Ältere Originalanfragen dürfen ausschließlich lesend bestätigt werden.');
                if (copy.tenantId !== authority.tenantId || copy.actorId !== authority.actorId)
                    throw Error(unavailable);
                const sdk = await authorize(authority);
                current(authority, sdk);
                sent = true;
                const result = await options.query(sdk.rpc('web_commit_tour_planning_event', { p_command: copy }), 'Planungsereignis verbindlich speichern');
                current(authority, sdk);
                if (result.error) {
                    const rawCode = typeof result.error === 'object' && result.error !== null ? Object.getOwnPropertyDescriptor(result.error, 'code')?.value : undefined;
                    const code = typeof rawCode === 'string' ? rawCode : '';
                    const rejected = result.data === null && ['22007', '22008', '22023', '22P02', '23514', '23505', '40001', '40P01', '42501', 'P0P01'].includes(code);
                    return { ok: false, error: rejected ? 'Der Planungsvorgang wurde vollständig abgewiesen. Aktuelle Fassung und Originale erneut prüfen.' : 'Die Speicherantwort ist unklar. Den gesicherten Vorgang ausschließlich lesend prüfen.', ...(rejected ? { rejected: true } : { uncertain: true }) };
                }
                return { ok: true, data: decodeTourPlanningReceipt(result.data, copy) };
            }
            catch (error) {
                return { ok: false, error: error instanceof Error ? error.message : unavailable, ...(sent ? { uncertain: true } : { rejected: true }) };
            }
        },
        async confirm(authority: TourPlanningAuthority, command: TourPlanningCommand): Promise<TourPlanningResult<TourPlanningReceipt>> {
            const copy = structuredClone(command);
            try {
                validateTourPlanningCommand(copy);
                if (copy.tenantId !== authority.tenantId || copy.actorId !== authority.actorId)
                    throw Error(unavailable);
                const value = await call(authority, 'web_confirm_tour_planning_event', { ...argumentsFor(authority, copy.planId), p_request_id: copy.requestId, p_command: copy });
                return { ok: true, data: decodeTourPlanningReceipt(value, copy) };
            }
            catch {
                return { ok: false, uncertain: true, error: 'Die passende native Planungsquittung ist noch nicht bestätigt. Die Anfrage bleibt gesichert und wird nicht erneut gesendet.' };
            }
        },
    };
}
