import type { ModalStackEntry } from '@/types/modalNavigation';

const PREFIX = 'caresuite.web.windows.v1.';
const memory = new Map<string, { scope: string; entries: ModalStackEntry[] }>();

export function saveWebModalSnapshot(scope: string, entries: ModalStackEntry[]): string | undefined {
  if (!entries.length) return undefined;
  const token = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  const snapshot = { scope, entries };
  memory.set(token, snapshot);
  if (memory.size > 80) memory.delete(memory.keys().next().value!);
  try { window.sessionStorage.setItem(PREFIX + token, JSON.stringify(snapshot)); } catch { /* In-document navigation remains available. */ }
  return token;
}

export function readWebModalSnapshot(scope: string, token: unknown): ModalStackEntry[] {
  if (typeof token !== 'string' || !/^[a-z0-9-]{1,80}$/.test(token)) return [];
  try {
    const snapshot = memory.get(token) ?? JSON.parse(window.sessionStorage.getItem(PREFIX + token) ?? 'null');
    if (!snapshot || snapshot.scope !== scope || !Array.isArray(snapshot.entries)) return [];
    if (!snapshot.entries.every((entry: ModalStackEntry) => typeof entry?.id === 'string' && typeof entry.title === 'string' && typeof entry.modalKey === 'string' && /^[\w.-]{1,100}$/.test(entry.modalKey))) return [];
    return snapshot.entries;
  } catch { return []; }
}
