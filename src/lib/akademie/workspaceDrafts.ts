import type { AcademyCommand } from './workspaceModel';

let activeScope: string | null = null;
let pending: AcademyCommand | null = null;
const listeners = new Set<() => void>();

function changed() { for (const listener of listeners) listener(); }

/** Memory only. The scope contains tenant, authenticated user, account and view; no token. */
export function activateAcademyDraftScope(scope: string) {
  if (scope === activeScope) return;
  pending = null;
  activeScope = scope;
  changed();
}

export function getPendingAcademyCommand(scope: string): AcademyCommand | null {
  return scope === activeScope && pending ? structuredClone(pending) : null;
}

/** Never replace an unresolved request with edited data or a new request ID. */
export function rememberPendingAcademyCommand(scope: string, command: AcademyCommand): boolean {
  if (scope !== activeScope) return false;
  if (pending) return JSON.stringify(pending) === JSON.stringify(command);
  pending = structuredClone(command);
  changed();
  return true;
}

export function clearPendingAcademyCommand(scope: string) {
  if (scope !== activeScope || !pending) return;
  pending = null;
  changed();
}

export function clearAcademyDrafts() {
  activeScope = null;
  pending = null;
  changed();
}

export function subscribeAcademyDrafts(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
