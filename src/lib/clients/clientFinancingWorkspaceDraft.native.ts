// Generated native presentation from src/lib/clients/clientFinancingWorkspaceDraft.web.ts. Update through scripts/port-native-workspaces.mjs.
import {nativeStructuredClone as structuredClone} from '@/lib/platform/nativeWorkflowEnvironment.native';
import { clientFinancingWorkspaceVersion, type ClientFinancingSource } from "./clientFinancingWorkspaceDomain.native.ts";
import type { ClientFinancingDraft } from "./clientFinancingWorkspaceForm.native.ts";
type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type Scope = {
    tenantId: string;
    clientId: string;
    actorId: string;
};
const id = /^[0-9a-f-]{36}$/;
export function clientFinancingDraftKey(scope: Scope) { if (!Object.values(scope).every(value => id.test(value)))
    throw Error('Lokaler Finanzierungskontext ist ungültig.'); return `caresuite.client-financing-workspace.v1:${scope.tenantId}:${scope.actorId}:${scope.clientId}`; }
export function saveClientFinancingDraft(store: Store, draft: ClientFinancingDraft) { const raw = JSON.stringify(draft); store.setItem(clientFinancingDraftKey(draft.scope), raw); if (store.getItem(clientFinancingDraftKey(draft.scope)) !== raw)
    throw Error('Finanzierungsentwurf konnte nicht zuverlässig gesichert werden.'); }
export function restoreClientFinancingDraft(store: Store, scope: Scope, headId: string | null, current: (source: ClientFinancingSource) => boolean): {
    draft: ClientFinancingDraft;
    changed: boolean;
} | null { const raw = store.getItem(clientFinancingDraftKey(scope)); if (raw === null)
    return null; const value: unknown = JSON.parse(raw); if (typeof value !== 'object' || value === null) {
    throw Error('Gesicherter Finanzierungsentwurf ist beschädigt.');
} const draft = value as ClientFinancingDraft; if (draft.version !== clientFinancingWorkspaceVersion || JSON.stringify(draft.scope) !== JSON.stringify(scope) || typeof draft.note !== 'string' || typeof draft.values !== 'object' || typeof draft.selected !== 'object')
    throw Error('Gesicherter Finanzierungsentwurf ist beschädigt.'); const changed = draft.headId !== headId || Object.values(draft.selected).some(selection => !current(selection.value)); return { draft: { ...structuredClone(draft), headId, selected: changed ? {} : structuredClone(draft.selected) }, changed }; }
export function discardClientFinancingDraft(store: Store, scope: Scope) { const key = clientFinancingDraftKey(scope); store.removeItem(key); if (store.getItem(key) !== null)
    throw Error('Finanzierungsentwurf konnte nicht entfernt werden.'); }
