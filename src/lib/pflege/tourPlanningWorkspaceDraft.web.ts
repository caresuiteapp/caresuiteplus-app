import { sameWoundJson } from './woundCareDomain.ts';
import { tourPlanningId, tourPlanningJson, tourPlanningKinds, tourPlanningObject, tourPlanningVersion, tourPlanningLegacyVersion, type TourPlanningKind, type TourPlanningScope } from './tourPlanningWorkspaceDomain.web.ts';

export type TourPlanningDraft = {
  version: typeof tourPlanningVersion | typeof tourPlanningLegacyVersion; scope: TourPlanningScope; headId: string | null;
  kind: TourPlanningKind; occurredAt: string; note: string; values: Record<string, string>;
  selected: Record<string, { id: string; value: unknown }>;
};
type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export function tourPlanningDraftKey(scope: TourPlanningScope) {
  if (!Object.values(scope).every(tourPlanningId)) throw Error('Ungültiger Planungsentwurfskontext.');
  return `caresuite.tour-planning-workspace.draft.v1:${scope.tenantId}:${scope.actorId}:${scope.planId}`;
}
function validate(value: unknown, scope: TourPlanningScope): asserts value is TourPlanningDraft {
  if (!tourPlanningObject(value) || Object.keys(value).sort().join(',') !== 'headId,kind,note,occurredAt,scope,selected,values,version' || ![tourPlanningVersion, tourPlanningLegacyVersion].includes(value.version as typeof tourPlanningVersion) || !sameWoundJson(value.scope, scope) || !(value.headId === null || tourPlanningId(value.headId)) || !tourPlanningKinds.includes(value.kind as TourPlanningKind) || typeof value.note !== 'string' || typeof value.occurredAt !== 'string' || !tourPlanningObject(value.values) || Object.values(value.values).some((entry) => typeof entry !== 'string') || !tourPlanningObject(value.selected)) throw Error('Der lokale Tourenplanungsentwurf ist beschädigt. Er wird nicht still überschrieben.');
  for (const selected of Object.values(value.selected)) if (!tourPlanningObject(selected) || Object.keys(selected).sort().join(',') !== 'id,value' || typeof selected.id !== 'string') throw Error('Die Entwurfsauswahl ist beschädigt.');
  tourPlanningJson(value);
}
export function saveTourPlanningDraft(store: Store, draft: TourPlanningDraft) { validate(draft, draft.scope); const key = tourPlanningDraftKey(draft.scope); const raw = JSON.stringify(draft); store.setItem(key, raw); if (store.getItem(key) !== raw) throw Error('Der Tourenplanungsentwurf wurde nicht zuverlässig gesichert.'); }
export function restoreTourPlanningDraft(store: Store, scope: TourPlanningScope, headId: string | null, isCurrent: (field: string, value: unknown) => boolean) { const raw = store.getItem(tourPlanningDraftKey(scope)); if (raw === null) return null; const draft: unknown = JSON.parse(raw); validate(draft, scope); const changed = draft.version !== tourPlanningVersion || draft.headId !== headId || Object.entries(draft.selected).some(([field, selected]) => !isCurrent(field, selected.value)); return { draft: { ...structuredClone(draft), version: tourPlanningVersion, headId, selected: changed ? {} : structuredClone(draft.selected) }, changed }; }
export function discardTourPlanningDraft(store: Store, scope: TourPlanningScope) { const key = tourPlanningDraftKey(scope); store.removeItem(key); if (store.getItem(key) !== null) throw Error('Der Tourenplanungsentwurf konnte nicht entfernt werden.'); }
