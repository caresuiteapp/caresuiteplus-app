// Generated native presentation from src/lib/careAssessment/assessmentPathWorkspaceDraft.web.ts. Update through scripts/port-native-workspaces.mjs.
import {nativeStructuredClone as structuredClone} from '@/lib/platform/nativeWorkflowEnvironment.native';
import { assessmentPathVersion, type AssessmentPathSource } from "./assessmentPathWorkspaceDomain.native.ts";
import type { AssessmentPathDraft } from "./assessmentPathWorkspaceForm.native.ts";
type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type Scope = {
    tenantId: string;
    assessmentId: string;
    actorId: string;
};
const uuid = /^[0-9a-f-]{36}$/;
export function assessmentPathDraftKey(scope: Scope) { if (!Object.values(scope).every(x => uuid.test(x)))
    throw Error('Lokaler Assessmentpfadkontext ist ungültig.'); return `caresuite.assessment-path-workspace.v1:${scope.tenantId}:${scope.assessmentId}:${scope.actorId}`; }
export function saveAssessmentPathDraft(store: Store, draft: AssessmentPathDraft) { const raw = JSON.stringify(draft), key = assessmentPathDraftKey(draft.scope); store.setItem(key, raw); if (store.getItem(key) !== raw)
    throw Error('Assessmentpfadentwurf konnte nicht zuverlässig gesichert werden.'); }
export function restoreAssessmentPathDraft(store: Store, scope: Scope, headId: string | null, current: (value: AssessmentPathSource) => boolean) { const raw = store.getItem(assessmentPathDraftKey(scope)); if (raw === null)
    return null; const value: unknown = JSON.parse(raw); if (typeof value !== 'object' || value === null)
    throw Error('Gesicherter Assessmentpfadentwurf ist beschädigt.'); const draft = value as AssessmentPathDraft; if (draft.version !== assessmentPathVersion || JSON.stringify(draft.scope) !== JSON.stringify(scope) || typeof draft.note !== 'string' || typeof draft.values !== 'object' || typeof draft.selected !== 'object')
    throw Error('Gesicherter Assessmentpfadentwurf ist beschädigt.'); const changed = draft.headId !== headId || Object.values(draft.selected).some(x => !current(x.value)); return { draft: { ...structuredClone(draft), headId, selected: changed ? {} : structuredClone(draft.selected) }, changed }; }
export function discardAssessmentPathDraft(store: Store, scope: Scope) { const key = assessmentPathDraftKey(scope); store.removeItem(key); if (store.getItem(key) !== null)
    throw Error('Assessmentpfadentwurf konnte nicht entfernt werden.'); }
