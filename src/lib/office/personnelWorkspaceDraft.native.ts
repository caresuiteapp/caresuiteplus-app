// Generated native presentation from src/lib/office/personnelWorkspaceDraft.web.ts. Update through scripts/port-native-workspaces.mjs.
import {nativeStructuredClone as structuredClone} from '@/lib/platform/nativeWorkflowEnvironment.native';
import { personnelId, personnelJson, personnelKinds, personnelObject, personnelVersion, type PersonnelKind, type PersonnelScope } from "./personnelWorkspaceDomain.native.ts";
import { sameWoundJson } from '../pflege/woundCareDomain.ts';
export type PersonnelDraft = {
    version: typeof personnelVersion;
    scope: PersonnelScope;
    headId: string | null;
    kind: PersonnelKind;
    occurredAt: string;
    note: string;
    values: Record<string, string>;
    selected: Record<string, {
        id: string;
        value: unknown;
    }>;
};
type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export function personnelDraftKey(s: PersonnelScope) { if (!Object.values(s).every(personnelId))
    throw Error('Ungültiger Personalentwurfskontext.'); return `caresuite.personnel-workspace.draft.v1:${s.tenantId}:${s.actorId}:${s.employeeId}`; }
function validate(v: unknown, s: PersonnelScope): asserts v is PersonnelDraft { if (!personnelObject(v) || Object.keys(v).sort().join(',') !== 'headId,kind,note,occurredAt,scope,selected,values,version' || v.version !== personnelVersion || !sameWoundJson(v.scope, s) || !(v.headId === null || personnelId(v.headId)) || !personnelKinds.includes(v.kind as PersonnelKind) || typeof v.note !== 'string' || typeof v.occurredAt !== 'string' || !personnelObject(v.values) || Object.values(v.values).some(x => typeof x !== 'string') || !personnelObject(v.selected))
    throw Error('Der lokale Personalentwurf ist beschädigt. Er wird nicht still überschrieben.'); for (const r of Object.values(v.selected))
    if (!personnelObject(r) || Object.keys(r).sort().join(',') !== 'id,value' || typeof r.id !== 'string')
        throw Error('Die Entwurfsauswahl ist beschädigt.'); personnelJson(v); }
export function savePersonnelDraft(store: Store, draft: PersonnelDraft) { validate(draft, draft.scope); const key = personnelDraftKey(draft.scope), raw = JSON.stringify(draft); store.setItem(key, raw); if (store.getItem(key) !== raw)
    throw Error('Der Entwurf wurde nicht zuverlässig gesichert.'); }
export function restorePersonnelDraft(store: Store, scope: PersonnelScope, headId: string | null, isCurrent: (field: string, value: unknown) => boolean) { const raw = store.getItem(personnelDraftKey(scope)); if (raw === null)
    return null; const d: unknown = JSON.parse(raw); validate(d, scope); const changed = d.headId !== headId || Object.entries(d.selected).some(([k, r]) => !isCurrent(k, r.value)); return { draft: { ...structuredClone(d), headId, selected: changed ? {} : structuredClone(d.selected) }, changed }; }
export function discardPersonnelDraft(store: Store, scope: PersonnelScope) { const key = personnelDraftKey(scope); store.removeItem(key); if (store.getItem(key) !== null)
    throw Error('Der lokale Personalentwurf konnte nicht entfernt werden.'); }
