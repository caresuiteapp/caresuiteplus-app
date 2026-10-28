// Generated native presentation from src/lib/clients/clientLifecycleWorkspaceDraft.web.ts. Update through scripts/port-native-workspaces.mjs.
import {nativeStructuredClone as structuredClone} from '@/lib/platform/nativeWorkflowEnvironment.native';
import { clientLifecycleVersion, type ClientLifecycleSource } from "./clientLifecycleWorkspaceDomain.native.ts";
import type { ClientLifecycleDraft } from "./clientLifecycleWorkspaceForm.native.ts";
type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type Scope = {
    tenantId: string;
    clientId: string;
    actorId: string;
};
const uuid = /^[0-9a-f-]{36}$/;
export function clientLifecycleDraftKey(scope: Scope) { if (!Object.values(scope).every(x => uuid.test(x)))
    throw Error('Lokaler Klientenstammdatenkontext ist ungültig.'); return `caresuite.client-lifecycle-workspace.v1:${scope.tenantId}:${scope.clientId}:${scope.actorId}`; }
export function saveClientLifecycleDraft(store: Store, draft: ClientLifecycleDraft) { const raw = JSON.stringify(draft), key = clientLifecycleDraftKey(draft.scope); store.setItem(key, raw); if (store.getItem(key) !== raw)
    throw Error('Klientenstammdatenentwurf konnte nicht zuverlässig gesichert werden.'); }
export function restoreClientLifecycleDraft(store: Store, scope: Scope, headId: string | null, current: (value: ClientLifecycleSource) => boolean) { const raw = store.getItem(clientLifecycleDraftKey(scope)); if (raw === null)
    return null; const value: unknown = JSON.parse(raw); if (typeof value !== 'object' || value === null)
    throw Error('Gesicherter Klientenstammdatenentwurf ist beschädigt.'); const draft = value as ClientLifecycleDraft; if (draft.version !== clientLifecycleVersion || JSON.stringify(draft.scope) !== JSON.stringify(scope) || typeof draft.note !== 'string' || typeof draft.values !== 'object' || typeof draft.selected !== 'object')
    throw Error('Gesicherter Klientenstammdatenentwurf ist beschädigt.'); const changed = draft.headId !== headId || Object.values(draft.selected).some(x => !current(x.value)); return { draft: { ...structuredClone(draft), headId, selected: changed ? {} : structuredClone(draft.selected) }, changed }; }
export function discardClientLifecycleDraft(store: Store, scope: Scope) { const key = clientLifecycleDraftKey(scope); store.removeItem(key); if (store.getItem(key) !== null)
    throw Error('Klientenstammdatenentwurf konnte nicht entfernt werden.'); }
