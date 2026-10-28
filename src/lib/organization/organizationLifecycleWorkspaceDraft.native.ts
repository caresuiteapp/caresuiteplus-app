// Generated native presentation from src/lib/organization/organizationLifecycleWorkspaceDraft.web.ts. Update through scripts/port-native-workspaces.mjs.
import {nativeStructuredClone as structuredClone} from '@/lib/platform/nativeWorkflowEnvironment.native';
import { organizationLifecycleVersion, type OrganizationLifecycleSource } from "./organizationLifecycleWorkspaceDomain.native.ts";
import type { OrganizationLifecycleDraft } from "./organizationLifecycleWorkspaceForm.native.ts";
type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type Scope = {
    tenantId: string;
    actorId: string;
};
const uuid = /^[0-9a-f-]{36}$/;
export function organizationLifecycleDraftKey(scope: Scope) { if (!Object.values(scope).every(x => uuid.test(x)))
    throw Error('Lokaler Organisations- und Stammdatenkontext ist ungültig.'); return `caresuite.organization-lifecycle-workspace.v1:${scope.tenantId}:${scope.actorId}`; }
export function saveOrganizationLifecycleDraft(store: Store, draft: OrganizationLifecycleDraft) { const raw = JSON.stringify(draft), key = organizationLifecycleDraftKey(draft.scope); store.setItem(key, raw); if (store.getItem(key) !== raw)
    throw Error('Organisations- und Stammdatenentwurf konnte nicht zuverlässig gesichert werden.'); }
export function restoreOrganizationLifecycleDraft(store: Store, scope: Scope, headId: string | null, current: (value: OrganizationLifecycleSource) => boolean) { const raw = store.getItem(organizationLifecycleDraftKey(scope)); if (raw === null)
    return null; const value: unknown = JSON.parse(raw); if (typeof value !== 'object' || value === null)
    throw Error('Gesicherter Organisations- und Stammdatenentwurf ist beschädigt.'); const draft = value as OrganizationLifecycleDraft; if (draft.version !== organizationLifecycleVersion || JSON.stringify(draft.scope) !== JSON.stringify(scope) || typeof draft.note !== 'string' || typeof draft.values !== 'object' || typeof draft.selected !== 'object')
    throw Error('Gesicherter Organisations- und Stammdatenentwurf ist beschädigt.'); const changed = draft.headId !== headId || Object.values(draft.selected).some(x => !current(x.value)); return { draft: { ...structuredClone(draft), headId, selected: changed ? {} : structuredClone(draft.selected) }, changed }; }
export function discardOrganizationLifecycleDraft(store: Store, scope: Scope) { const key = organizationLifecycleDraftKey(scope); store.removeItem(key); if (store.getItem(key) !== null)
    throw Error('Organisations- und Stammdatenentwurf konnte nicht entfernt werden.'); }
