// Generated native presentation from src/lib/pflege/supplyWorkspaceDraft.web.ts. Update through scripts/port-native-workspaces.mjs.
import {nativeStructuredClone as structuredClone} from '@/lib/platform/nativeWorkflowEnvironment.native';
import { supplyId, supplyJson, supplyKinds, supplyObject, supplyVersion, type SupplyKind, type SupplyScope } from "./supplyWorkspaceDomain.native.ts";
import { sameWoundJson } from './woundCareDomain.ts';
export type SupplyDraft = {
    version: typeof supplyVersion;
    scope: SupplyScope;
    headId: string | null;
    kind: SupplyKind;
    occurredAt: string;
    note: string;
    values: Record<string, string>;
    selected: Record<string, {
        id: string;
        value: unknown;
    }>;
};
type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export function supplyDraftKey(scope: SupplyScope) { if (!Object.values(scope).every(supplyId))
    throw Error('Ungültiger Entwurfskontext.'); return `caresuite.case-supply.draft.v1:${scope.tenantId}:${scope.actorId}:${scope.clientId}`; }
function validate(v: unknown, scope: SupplyScope): asserts v is SupplyDraft {
    if (!supplyObject(v) || Object.keys(v).sort().join(',') !== 'headId,kind,note,occurredAt,scope,selected,values,version' || v.version !== supplyVersion || !sameWoundJson(v.scope, scope) || !(v.headId === null || supplyId(v.headId)) || !supplyKinds.includes(v.kind as SupplyKind) || typeof v.note !== 'string' || typeof v.occurredAt !== 'string' || !supplyObject(v.values) || Object.values(v.values).some(x => typeof x !== 'string') || !supplyObject(v.selected))
        throw Error('Der lokale Materialentwurf ist beschädigt. Er wird nicht still überschrieben.');
    if (v.kind === 'key' && (/\b(pin|passwort|kennwort|türcode|zugangscode)\b/i.test(String(v.values.reference ?? '')) || /^\s*[0-9]{4,12}\s*$/.test(String(v.values.reference ?? ''))))
        throw Error('Zugangscodes oder PIN dürfen auch nicht im lokalen Entwurf gespeichert werden.');
    for (const r of Object.values(v.selected))
        if (!supplyObject(r) || Object.keys(r).sort().join(',') !== 'id,value' || typeof r.id !== 'string')
            throw Error('Die Entwurfsauswahl ist beschädigt.');
    supplyJson(v);
}
export function saveSupplyDraft(store: Store, draft: SupplyDraft) { validate(draft, draft.scope); const key = supplyDraftKey(draft.scope), raw = JSON.stringify(draft); store.setItem(key, raw); if (store.getItem(key) !== raw)
    throw Error('Der Entwurf wurde nicht zuverlässig gesichert.'); }
export function restoreSupplyDraft(store: Store, scope: SupplyScope, headId: string | null, isCurrent: (field: string, value: unknown) => boolean): {
    draft: SupplyDraft;
    changed: boolean;
} | null {
    const raw = store.getItem(supplyDraftKey(scope));
    if (raw === null)
        return null;
    const draft: unknown = JSON.parse(raw);
    validate(draft, scope);
    const changed = draft.headId !== headId || Object.entries(draft.selected).some(([field, r]) => !isCurrent(field, r.value));
    return { draft: { ...structuredClone(draft), headId, selected: changed ? {} : structuredClone(draft.selected) }, changed };
}
export function discardSupplyDraft(store: Store, scope: SupplyScope) { const key = supplyDraftKey(scope); store.removeItem(key); if (store.getItem(key) !== null)
    throw Error('Der lokale Entwurf konnte nicht entfernt werden.'); }
