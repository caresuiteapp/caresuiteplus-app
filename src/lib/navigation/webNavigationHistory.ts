import { safeWebReturnPath } from './webLoginReturn';

type Entry = { id: string; path: string };
type History = { entries: Entry[]; index: number };
const KEY = 'caresuite.web.page-history.v1';
const MAX_ENTRIES = 80;

export function currentWebPath(): string {
  return typeof window === 'undefined' ? '/' : window.location.pathname + window.location.search + window.location.hash;
}

function internalPath(path: string): boolean {
  return path === '/' || safeWebReturnPath(path) !== null;
}

function read(scope: string): History {
  try {
    const value = JSON.parse(window.sessionStorage.getItem(KEY) ?? 'null');
    if (value?.scope === scope && Array.isArray(value.entries) && value.entries.length <= MAX_ENTRIES && Number.isInteger(value.index) && value.index >= 0 && value.index < value.entries.length && value.entries.every((entry: Entry) => typeof entry.id === 'string' && typeof entry.path === 'string' && internalPath(entry.path))) return value;
  } catch { /* Browser storage may be disabled. */ }
  return { entries: [], index: -1 };
}

/** Match Expo's history IDs, including their preserved ID after a reload. */
export function recordWebPage(scope: string): void {
  if (typeof window === 'undefined' || !scope) return;
  const id = window.history.state?.id;
  const path = currentWebPath();
  if (typeof id !== 'string' || !internalPath(path)) return;
  const history = read(scope);
  const existing = history.entries.findIndex(entry => entry.id === id);
  if (existing >= 0) {
    history.index = existing;
    history.entries[existing] = { id, path };
  } else {
    history.entries = [...history.entries.slice(0, history.index + 1), { id, path }].slice(-MAX_ENTRIES);
    history.index = history.entries.length - 1;
  }
  try { window.sessionStorage.setItem(KEY, JSON.stringify({ scope, ...history })); } catch { /* Normal routing still works. */ }
}

/** Browser Back can restore a page even when Expo's in-memory stack was reloaded. */
export function goBackWebPage(scope: string): boolean {
  if (!canGoBackWebPage(scope)) return false;
  window.history.back();
  return true;
}

export function canGoBackWebPage(scope: string): boolean {
  if (typeof window === 'undefined' || !scope) return false;
  const history = read(scope);
  const current = history.entries[history.index];
  if (history.index < 1 || current?.id !== window.history.state?.id || current.path !== currentWebPath()) return false;
  return true;
}
