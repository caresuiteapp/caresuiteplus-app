// Generated native presentation from src/lib/pflege/careDocumentationPathWorkspaceForm.web.ts. Update through scripts/port-native-workspaces.mjs.
import {nativeStructuredClone as structuredClone} from '@/lib/platform/nativeWorkflowEnvironment.native';
import { careDocumentationPathDefinitions, careDocumentationPathKinds, careDocumentationPathVersion, validateCareDocumentationPathCommand, type CareDocumentationPathCommand, type CareDocumentationPathContext, type CareDocumentationPathKind, type CareDocumentationPathSource, type CareDocumentationPathState } from "./careDocumentationPathWorkspaceDomain.native.ts";
export type CareDocumentationPathDraft = {
    version: typeof careDocumentationPathVersion;
    scope: {
        tenantId: string;
        clientId: string;
        actorId: string;
    };
    headId: string | null;
    kind: CareDocumentationPathKind;
    occurredAt: string;
    note: string;
    values: Record<string, string>;
    selected: Record<string, {
        id: string;
        value: CareDocumentationPathSource;
    }>;
};
export const careDocumentationPathGroups = [...new Set(careDocumentationPathKinds.map(kind => careDocumentationPathDefinitions[kind].group))];
export const careDocumentationPathKindsForGroup = (group: string) => careDocumentationPathKinds.filter(kind => careDocumentationPathDefinitions[kind].group === group);
export const careDocumentationPathFields = (kind: CareDocumentationPathKind) => careDocumentationPathDefinitions[kind].fields;
export const careDocumentationPathSourceFields = (kind: CareDocumentationPathKind) => careDocumentationPathDefinitions[kind].sources;
export const careDocumentationPathSourceOptions = (field: {
    kinds: readonly string[];
    eventKinds?: readonly string[];
}, context: CareDocumentationPathContext) => context.sources.rows.filter(row => field.kinds.includes(row.kind) && (!field.eventKinds || typeof row.snapshot.command === 'object' && row.snapshot.command !== null && !Array.isArray(row.snapshot.command) && field.eventKinds.includes(String((row.snapshot.command as Record<string, unknown>).kind)))).map(row => ({ id: `${row.kind}:${row.id}`, label: [String(row.snapshot.title ?? row.snapshot.name ?? row.snapshot.subject ?? row.snapshot.reference ?? row.snapshot.status ?? row.kind), String(row.snapshot.version ?? row.snapshot.state ?? ''), row.id].filter(Boolean).join(' · '), value: row }));
export function buildCareDocumentationPathCommand(draft: CareDocumentationPathDraft, state: CareDocumentationPathState, requestId: string, eventId: string): CareDocumentationPathCommand { const payload: Record<string, unknown> = { ...draft.values }; for (const [key, value] of Object.entries(draft.selected))
    payload[key] = structuredClone(value.value); const command: CareDocumentationPathCommand = { version: careDocumentationPathVersion, requestId, eventId, tenantId: draft.scope.tenantId, clientId: draft.scope.clientId, actorId: draft.scope.actorId, expectedHeadId: state.headId, kind: draft.kind, occurredAt: draft.occurredAt, note: draft.note, payload }; validateCareDocumentationPathCommand(command); return command; }
