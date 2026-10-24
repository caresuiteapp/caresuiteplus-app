// Generated native presentation from src/lib/pflege/careDocumentationPathWorkspaceDraft.web.ts. Update through scripts/port-native-workspaces.mjs.
import {nativeStructuredClone as structuredClone} from '@/lib/platform/nativeWorkflowEnvironment.native';
import { careDocumentationPathVersion, type CareDocumentationPathSource } from "./careDocumentationPathWorkspaceDomain.native.ts";
import type { CareDocumentationPathDraft } from "./careDocumentationPathWorkspaceForm.native.ts";
type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type Scope = {
    tenantId: string;
    clientId: string;
    actorId: string;
};
const uuid = /^[0-9a-f-]{36}$/;
export function careDocumentationPathDraftKey(scope: Scope) { if (!Object.values(scope).every(x => uuid.test(x)))
    throw Error('Lokaler Dokumentationspfadkontext ist ungültig.'); return `caresuite.care-documentation-path-workspace.v1:${scope.tenantId}:${scope.clientId}:${scope.actorId}`; }
export function saveCareDocumentationPathDraft(store: Store, draft: CareDocumentationPathDraft) { const raw = JSON.stringify(draft), key = careDocumentationPathDraftKey(draft.scope); store.setItem(key, raw); if (store.getItem(key) !== raw)
    throw Error('Dokumentationspfadentwurf konnte nicht zuverlässig gesichert werden.'); }
export function restoreCareDocumentationPathDraft(store: Store, scope: Scope, headId: string | null, current: (value: CareDocumentationPathSource) => boolean) { const raw = store.getItem(careDocumentationPathDraftKey(scope)); if (raw === null)
    return null; const value: unknown = JSON.parse(raw); if (typeof value !== 'object' || value === null)
    throw Error('Gesicherter Dokumentationspfadentwurf ist beschädigt.'); const draft = value as CareDocumentationPathDraft; if (draft.version !== careDocumentationPathVersion || JSON.stringify(draft.scope) !== JSON.stringify(scope) || typeof draft.note !== 'string' || typeof draft.values !== 'object' || typeof draft.selected !== 'object')
    throw Error('Gesicherter Dokumentationspfadentwurf ist beschädigt.'); const changed = draft.headId !== headId || Object.values(draft.selected).some(x => !current(x.value)); return { draft: { ...structuredClone(draft), headId, selected: changed ? {} : structuredClone(draft.selected) }, changed }; }
export function discardCareDocumentationPathDraft(store: Store, scope: Scope) { const key = careDocumentationPathDraftKey(scope); store.removeItem(key); if (store.getItem(key) !== null)
    throw Error('Dokumentationspfadentwurf konnte nicht entfernt werden.'); }
