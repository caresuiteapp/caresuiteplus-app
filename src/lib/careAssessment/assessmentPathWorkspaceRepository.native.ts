// Generated native presentation from src/lib/careAssessment/assessmentPathWorkspaceRepository.web.ts. Update through scripts/port-native-workspaces.mjs.
import {confirmNativeWorkspaceAction,runNativeWorkspaceEffect} from '@/lib/platform/nativeWorkspaceActions.native';
import { freezeClientNativeOriginal, sameClientNativeOriginal } from "../clients/clientRecordNativeOriginal.native.ts";
import { createAssessmentWorkspaceTransport, captureAssessmentWorkspaceJson, type AssessmentWorkspaceTransportOptions } from "./assessmentWorkspaceTransport.native.ts";
import { assessmentPathSupportedWriteKinds, decodeAssessmentPathContext, decodeAssessmentPathReceipt, validateAssessmentPathCommand, validateAssessmentPathWriteCommand, type AssessmentPathCommand, type AssessmentPathContext, type AssessmentPathReceipt } from "./assessmentPathWorkspaceDomain.native.ts";
export type AssessmentPathAuthority = {
    tenantId: string;
    assessmentId: string;
    actorId: string;
    accessToken: string;
    expiresAt: number | null;
    isCurrent(): boolean;
};
export type AssessmentPathResult<T> = {
    ok: true;
    data: T;
} | {
    ok: false;
    error: string;
    rejected?: boolean;
    uncertain?: boolean;
};
const unavailable = 'Eigene aktuelle Sitzung und vollständige Assessmentoriginale sind nicht bestätigt.';
export function createAssessmentPathRepository(options: AssessmentWorkspaceTransportOptions) {
    const args = (a: {
        tenantId: string;
        assessmentId: string;
        actorId: string;
    }) => ({ p_tenant_id: a.tenantId, p_assessment_id: a.assessmentId, p_actor_id: a.actorId });
    const capture = (input: AssessmentPathCommand) => { const copy = freezeClientNativeOriginal(captureAssessmentWorkspaceJson(input)); validateAssessmentPathCommand(copy); return copy; };
    const sameScope = (command: AssessmentPathCommand, scope: {
        tenantId: string;
        assessmentId: string;
        actorId: string;
    }) => { if (command.tenantId !== scope.tenantId || command.assessmentId !== scope.assessmentId || command.actorId !== scope.actorId)
        throw Error(unavailable); };
    return {
        async context(authority: AssessmentPathAuthority): Promise<AssessmentPathResult<AssessmentPathContext>> { try {
            const guard = await createAssessmentWorkspaceTransport(authority, options);
            const read = async () => { await guard.check(); const response = await guard.read('web_assessment_path_v2_context', args(guard.scope), 'Assessmentoriginale vollständig lesen'); await guard.check(); if (response.error !== null)
                throw Error(unavailable); return decodeAssessmentPathContext(response.data, guard.scope); };
            const first = await read(), last = await read();
            if (!sameClientNativeOriginal({ ...first, loadedAt: null }, { ...last, loadedAt: null }))
                throw Error('Der vollständige Assessmentbestand wurde während des Ladens geändert. Neu laden.');
            await guard.current();
            return { ok: true, data: last };
        }
        catch (error) {
            return { ok: false, error: error instanceof Error ? error.message : unavailable };
        } },
        async commit(authority: AssessmentPathAuthority, input: AssessmentPathCommand): Promise<AssessmentPathResult<AssessmentPathReceipt>> { let sent = false; try {
            const copy = capture(input);
            validateAssessmentPathWriteCommand(copy);
            if (!assessmentPathSupportedWriteKinds.some(kind => kind === copy.kind))
                throw Error('Neue klinische Handlungen oder Freigaben sind in diesem Ablauf noch gesperrt.');
            const guard = await createAssessmentWorkspaceTransport(authority, options);
            sameScope(copy, guard.scope);
            await guard.current();
            sent = true;
            const response = await guard.read('web_commit_assessment_path_v2_event', { p_command: copy }, 'Assessmentvorgang unverändert speichern');
            await guard.check();
            if (response.error !== null) {
                const error = response.error as Record<string, unknown> | null, code = error && typeof error === 'object' ? error.code : null, rejected = response.data === null && ['22007', '22008', '22023', '22P02', '23503', '23505', '23514', '40001', '40P01', '42501', 'P0P01'].includes(String(code));
                return { ok: false, error: rejected ? 'Die Transaktion wurde vollständig abgewiesen. Originale neu laden.' : 'Der Schreibausgang ist ungeklärt. Nur die ursprüngliche Quittung prüfen.', ...(rejected ? { rejected: true } : { uncertain: true }) };
            }
            const data = decodeAssessmentPathReceipt(response.data, copy);
            await guard.current();
            return { ok: true, data };
        }
        catch (error) {
            return { ok: false, error: error instanceof Error ? error.message : unavailable, ...(sent ? { uncertain: true } : { rejected: true }) };
        } },
        async confirm(authority: AssessmentPathAuthority, input: AssessmentPathCommand): Promise<AssessmentPathResult<AssessmentPathReceipt>> { try {
            const copy = capture(input), guard = await createAssessmentWorkspaceTransport(authority, options);
            sameScope(copy, guard.scope);
            const response = await guard.read('web_confirm_assessment_path_v2_event', { ...args(guard.scope), p_request_id: copy.requestId, p_command: copy }, 'Eigene ursprüngliche Assessmentquittung lesen');
            await guard.check();
            if (response.error !== null)
                throw Error(unavailable);
            const data = decodeAssessmentPathReceipt(response.data, copy);
            await guard.current();
            return { ok: true, data };
        }
        catch (error) {
            return { ok: false, uncertain: true, error: error instanceof Error ? error.message : unavailable };
        } },
    };
}
