import type { AcademyCommand } from './workspaceModel';

let activeOwner: string | null = null;
const scopes = new Set<string>();
const pending = new Map<string, AcademyCommand>();
const listeners = new Set<() => void>();

function changed() { for (const listener of listeners) listener(); }

/** Memory only. Office and learning windows of the same authenticated account can coexist. */
export function activateAcademyDraftScope(scope: string, owner = scope) {
  if (owner !== activeOwner) {
    pending.clear();
    scopes.clear();
    activeOwner = owner;
  }
  if (scopes.has(scope)) return;
  scopes.add(scope);
  changed();
}

export function getPendingAcademyCommand(scope: string): AcademyCommand | null {
  const command = pending.get(scope);
  return command ? structuredClone(command) : null;
}

/** Never replace an unresolved request with edited data or a new request ID. */
export function rememberPendingAcademyCommand(scope: string, command: AcademyCommand): boolean {
  if (!scopes.has(scope)) return false;
  const unresolved = pending.get(scope);
  if (unresolved) return JSON.stringify(unresolved) === JSON.stringify(command);
  pending.set(scope, structuredClone(command));
  changed();
  return true;
}

export function clearPendingAcademyCommand(scope: string) {
  if (pending.delete(scope)) changed();
}

export function clearAcademyDrafts() {
  activeOwner = null;
  scopes.clear();
  pending.clear();
  changed();
}

export function subscribeAcademyDrafts(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
