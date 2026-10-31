// Generated native presentation from src/lib/careAssessment/assessmentPathWorkspaceForm.web.ts. Update through scripts/port-native-workspaces.mjs.
import { captureAssessmentWorkspaceJson } from "./assessmentWorkspaceTransport.native.ts";
import { freezeClientNativeOriginal } from "../clients/clientRecordNativeOriginal.native.ts";
import { assessmentPathDefinitions, assessmentPathKinds, assessmentPathSupportedWriteKinds, assessmentPathVersion, decodeAssessmentPathContext, validateAssessmentPathWriteCommand, type AssessmentPathCommand, type AssessmentPathContext, type AssessmentPathKind, type AssessmentPathSource, type AssessmentPathState } from "./assessmentPathWorkspaceDomain.native.ts";
export type AssessmentPathDraft = {
    version: typeof assessmentPathVersion;
    scope: {
        tenantId: string;
        assessmentId: string;
        actorId: string;
    };
    headId: string | null;
    kind: AssessmentPathKind;
    occurredAt: string;
    note: string;
    values: Record<string, string>;
    selected: Record<string, {
        id: string;
        value: AssessmentPathSource;
    }>;
};
export const assessmentPathGroups = [...new Set(assessmentPathKinds.map(kind => assessmentPathDefinitions[kind].group))];
export const assessmentPathKindsForGroup = (group: string) => assessmentPathKinds.filter(kind => assessmentPathDefinitions[kind].group === group);
export const assessmentPathFields = (kind: AssessmentPathKind) => assessmentPathDefinitions[kind].fields;
export const assessmentPathSourceFields = (kind: AssessmentPathKind) => assessmentPathDefinitions[kind].sources;
export function assessmentPathSourceOptions(input: {
    kinds: readonly string[];
    eventKinds?: readonly string[];
}, value: AssessmentPathContext) { const field = captureAssessmentWorkspaceJson(input), context = decodeAssessmentPathContext(value, value); return context.sources.rows.filter(row => field.kinds.includes(row.kind) && (!field.eventKinds || !row.kind.endsWith('_path_event') || field.eventKinds.includes(String((row.snapshot.command as Record<string, unknown>)?.kind)))).map(row => { const label = [row.snapshot.title, row.snapshot.name, row.snapshot.subject, row.snapshot.reference, row.snapshot.status].find(v => typeof v === 'string' && v.trim()), revision = [row.snapshot.version, row.snapshot.state].find(v => typeof v === 'string' || typeof v === 'number'); return { id: `${row.kind}:${row.id}`, label: [typeof label === 'string' ? label : row.kind, revision === undefined ? '' : String(revision), row.id].filter(Boolean).join(' · '), value: row }; }); }
export function buildAssessmentPathCommand(input: AssessmentPathDraft, prior: AssessmentPathState, requestId: string, eventId: string): AssessmentPathCommand { const draft = captureAssessmentWorkspaceJson(input), state = captureAssessmentWorkspaceJson(prior); if (!assessmentPathSupportedWriteKinds.some(kind => kind === draft.kind))
    throw Error('Diese fachliche Vorgangsart ist für neue Schreibvorgänge noch gesperrt.'); if (draft.version !== assessmentPathVersion || draft.headId !== state.headId)
    throw Error('Der Entwurf gehört nicht zum aktuell bestätigten Verlaufskopf.'); const payload: Record<string, unknown> = { ...draft.values }; for (const [key, value] of Object.entries(draft.selected))
    payload[key] = value.value; const command: AssessmentPathCommand = { version: assessmentPathVersion, requestId, eventId, tenantId: draft.scope.tenantId, assessmentId: draft.scope.assessmentId, actorId: draft.scope.actorId, expectedHeadId: state.headId, kind: draft.kind, occurredAt: draft.occurredAt, note: draft.note, payload }; validateAssessmentPathWriteCommand(command); return freezeClientNativeOriginal(command); }
