import { visitExecutionKinds, visitExecutionVersion, visitJson, type VisitExecutionKind } from './visitExecutionWorkspaceDomain.web.ts';

export type VisitDraftScope = { tenantId: string; stopId: string; actorId: string };
export type VisitDraft = { version: typeof visitExecutionVersion; scope: VisitDraftScope; headId: string | null; kind: VisitExecutionKind; occurredAt: string; note: string; values: Record<string, string>; selected: Record<string, unknown>; updatedAt: string };
type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>;
const prefix = 'caresuite.visit-execution-workspace.v1:';
const key = (scope: VisitDraftScope) => `${prefix}${scope.tenantId}:${scope.stopId}:${scope.actorId}`;
const sameScope = (a: VisitDraftScope, b: VisitDraftScope) => a.tenantId === b.tenantId && a.stopId === b.stopId && a.actorId === b.actorId;

export function saveVisitDraft(storage: Storage, input: Omit<VisitDraft, 'updatedAt'>) { const value: VisitDraft = { ...structuredClone(input), updatedAt: new Date().toISOString() }; visitJson(value); storage.setItem(key(value.scope), JSON.stringify(value)); return value; }
export function restoreVisitDraft(storage: Storage, scope: VisitDraftScope, headId: string | null, selectedCurrent: (value: unknown) => boolean) { const raw = storage.getItem(key(scope)); if (!raw) return null; let value: VisitDraft; try { value = JSON.parse(raw); } catch { throw Error('Der lokale Einsatzentwurf ist beschädigt.'); } if (value.version !== visitExecutionVersion || !sameScope(value.scope, scope) || !visitExecutionKinds.includes(value.kind) || typeof value.note !== 'string' || typeof value.occurredAt !== 'string' || !value.values || !value.selected || typeof value.updatedAt !== 'string') throw Error('Der lokale Einsatzentwurf gehört nicht zu dieser aktuellen Fassung.'); visitJson(value); const changed = value.headId !== headId; const selected = Object.fromEntries(Object.entries(value.selected).filter(([, selectedValue]) => !changed && selectedCurrent(selectedValue))); return { draft: { ...structuredClone(value), headId, selected }, changed };
}
export function discardVisitDraft(storage: Storage, scope: VisitDraftScope) { storage.removeItem(key(scope)); }
