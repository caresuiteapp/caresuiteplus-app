// Generated native presentation from src/lib/careAssessment/carePlanPathWorkspaceDraft.web.ts. Update through scripts/port-native-workspaces.mjs.
import { captureAssessmentWorkspaceJson } from "./assessmentWorkspaceTransport.native.ts";
import { sameClientNativeOriginal } from "../clients/clientRecordNativeOriginal.native.ts";
import { carePlanPathVersion, carePlanPathDefinitions, carePlanPathKinds, carePlanPathSource, type CarePlanPathSource } from "./carePlanPathWorkspaceDomain.native.ts";
import type { CarePlanPathDraft } from "./carePlanPathWorkspaceForm.native.ts";
type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type Scope = {
    tenantId: string;
    assessmentId: string;
    actorId: string;
};
const uuid = (v: unknown) => typeof v === 'string' && v.length === 36 && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
function scopeOf(input: Scope) { const s = captureAssessmentWorkspaceJson(input); if (!object(s) || Object.keys(s).sort().join(',') !== 'actorId,assessmentId,tenantId' || ![s.tenantId, s.assessmentId, s.actorId].every(uuid))
    throw Error('Der eigene lokale Pflegeplanpfadkontext ist unvollständig.'); return s; }
export function carePlanPathDraftKey(input: Scope) { const scope = scopeOf(input); return `caresuite.care-plan-path-workspace.v2:${scope.tenantId}:${scope.assessmentId}:${scope.actorId}`; }
function decode(input: unknown, scope: Scope): CarePlanPathDraft { const d = captureAssessmentWorkspaceJson(input) as CarePlanPathDraft; if (!object(d) || Object.keys(d).sort().join(',') !== 'headId,kind,note,occurredAt,scope,selected,values,version' || d.version !== carePlanPathVersion || !sameClientNativeOriginal(scopeOf(d.scope), scopeOf(scope)) || !carePlanPathKinds.includes(d.kind) || d.headId !== null && !uuid(d.headId) || typeof d.note !== 'string' || d.note.length > 4000 || typeof d.occurredAt !== 'string' || d.occurredAt.length > 100 || !object(d.values) || !object(d.selected))
    throw Error('Der gesicherte Entwurf ist beschädigt und wird nicht ersetzt.'); const definition = carePlanPathDefinitions[d.kind]; for (const [k, v] of Object.entries(d.values))
    if (!definition.fields.some(f => f.key === k) || typeof v !== 'string' || v.length > 8000)
        throw Error('Die ursprünglichen Entwurfsfelder sind ungeklärt.'); for (const [k, v] of Object.entries(d.selected)) {
    const rule = definition.sources.find(f => f.key === k);
    if (!rule || !object(v) || Object.keys(v).sort().join(',') !== 'id,value' || typeof v.id !== 'string')
        throw Error('Die ursprüngliche Originalauswahl ist ungeklärt.');
    carePlanPathSource(v.value);
    if (!rule.kinds.includes(v.value.kind) || v.id !== v.value.id && v.id !== `${v.value.kind}:${v.value.id}`)
        throw Error('Die ursprüngliche Originalauswahl gehört nicht zum Entwurf.');
} return d; }
export function saveCarePlanPathDraft(store: Store, input: CarePlanPathDraft) { const captured = captureAssessmentWorkspaceJson(input), draft = decode(captured, captured.scope), key = carePlanPathDraftKey(draft.scope), previous = store.getItem(key); if (previous !== null)
    decode(JSON.parse(previous), draft.scope); const raw = JSON.stringify(draft); if (store.getItem(key) !== previous)
    throw Error('Ein anderer Vorgang hat den lokalen Entwurf verändert.'); store.setItem(key, raw); if (store.getItem(key) !== raw)
    throw Error('Der Entwurf konnte nicht unverändert gesichert werden.'); }
export function restoreCarePlanPathDraft(store: Store, input: Scope, headId: string | null, current: (source: CarePlanPathSource) => boolean) { const scope = scopeOf(input), raw = store.getItem(carePlanPathDraftKey(scope)); if (raw === null)
    return null; if (headId !== null && !uuid(headId))
    throw Error('Der aktuelle Verlaufskopf ist ungültig.'); const draft = decode(JSON.parse(raw), scope), changed = draft.headId !== headId || Object.values(draft.selected).some(x => current(x.value) !== true); return { draft: { ...draft, headId, selected: changed ? {} : draft.selected }, changed }; }
export function discardCarePlanPathDraft(store: Store, input: Scope) { const scope = scopeOf(input), key = carePlanPathDraftKey(scope), raw = store.getItem(key); if (raw === null)
    return; decode(JSON.parse(raw), scope); if (store.getItem(key) !== raw)
    throw Error('Ein anderer Vorgang hat den lokalen Entwurf ersetzt.'); store.removeItem(key); if (store.getItem(key) !== null)
    throw Error('Der eigene Entwurf konnte nicht abgeschlossen werden.'); }
