import { getSupabaseClient } from '@/lib/supabase/client';
import { clearConsultationDrafts } from './workspaceDrafts';
import type { ConsultationCommand, ConsultationMutationResult, ConsultationWorkspace } from './workspaceModel';
type RpcResult = {
    data: unknown;
    error: {
        code?: string;
        message: string;
    } | null;
};
type WorkspaceRpc = {
    rpc(name: string, args: Record<string, unknown>): PromiseLike<RpcResult>;
};
export class ConsultationWorkspaceError extends Error {
    constructor(message: string, public readonly code: string = 'unknown') { super(message); }
}
function explain(code: string | undefined, message: string): string {
    if (code === '40001')
        return 'Der Eintrag wurde zwischenzeitlich geändert. Ihr Entwurf bleibt erhalten. Laden Sie den aktuellen Stand und gleichen Sie die Änderungen ab.';
    if (code === '42501')
        return 'Für diesen Vorgang fehlt die Berechtigung oder die Zuweisung ist nicht mehr gültig.';
    if (code === 'PGRST202' || code === '42883' || code === '42P01')
        return 'Der Beratungsarbeitsplatz ist auf diesem Server noch nicht eingerichtet. Bitte wenden Sie sich an die Verwaltung.';
    if (/fetch|network|connection|timeout/i.test(message))
        return 'Die Übertragung konnte nicht bestätigt werden. Ihr Entwurf bleibt geöffnet. Bitte erneut versuchen.';
    if (code === '23514' || code === 'P0001' || code === '22023')
        return message;
    return 'Der Vorgang konnte nicht gespeichert werden. Bitte erneut versuchen.';
}
let observedClient: ReturnType<typeof getSupabaseClient> = null;
async function call(name: string, args: Record<string, unknown>): Promise<unknown> {
    const client = getSupabaseClient();
    if (!client)
        throw new ConsultationWorkspaceError('Die Verbindung zum Beratungsarbeitsplatz ist nicht eingerichtet.');
    if (observedClient !== client) {
        observedClient = client;
        client.auth.onAuthStateChange(event => { if (event === 'SIGNED_OUT')
            clearConsultationDrafts(); });
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    let result: RpcResult;
    try {
        result = await Promise.race([
            (client as unknown as WorkspaceRpc).rpc(name, args),
            new Promise<never>((_, reject) => {
                timer = setTimeout(() => reject(new ConsultationWorkspaceError(
                    'Die Antwort des Servers steht noch aus. Bitte prüfen Sie den Serverstand oder versuchen Sie die Übertragung erneut.', 'timeout',
                )), 20000);
            }),
        ]);
    } finally {
        if (timer) clearTimeout(timer);
    }
    if (result.error)
        throw new ConsultationWorkspaceError(explain(result.error.code, result.error.message), result.error.code);
    if (result.data == null)
        throw new ConsultationWorkspaceError('Der Server hat keinen gespeicherten Stand bestätigt.');
    return result.data;
}
export async function loadConsultationWorkspace(tenantId: string, employeeView: boolean, caseId?: string | null): Promise<ConsultationWorkspace> {
    return await call('consultation_workspace_load', { p_tenant: tenantId, p_employee_view: employeeView, p_case: caseId ?? null }) as ConsultationWorkspace;
}
export async function mutateConsultationWorkspace(tenantId: string, command: ConsultationCommand): Promise<ConsultationMutationResult> {
    return await call('consultation_workspace_mutate', { p_tenant: tenantId, p_action: command.action,
        p_request: command.requestId, p_encounter: command.encounterId ?? null, p_version: command.expectedVersion ?? null,
        p_data: command.data }) as ConsultationMutationResult;
}
