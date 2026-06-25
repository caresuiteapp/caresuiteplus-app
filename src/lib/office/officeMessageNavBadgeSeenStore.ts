/** Session-only: new message threads considered "seen" for nav badge purposes. */

import type { OfficeMessageAudience, OfficeMessengerView } from '@/types/office/messaging';

export type OfficeMessageNavMessengerView = {
  audience: OfficeMessageAudience;
  view: OfficeMessengerView;
};

const STORAGE_KEY = 'office_message_nav_seen_threads';

type SeenByTenant = Record<string, string[]>;

const seenByTenant = new Map<string, Set<string>>();
const listeners = new Set<() => void>();
let messengerView: OfficeMessageNavMessengerView | null = null;

function readWebStorage(): SeenByTenant {
  if (typeof globalThis.sessionStorage === 'undefined') return {};
  try {
    const raw = globalThis.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as SeenByTenant;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeWebStorage(entries: SeenByTenant): void {
  if (typeof globalThis.sessionStorage === 'undefined') return;
  try {
    globalThis.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    /* quota / private mode — in-memory only */
  }
}

function persist(): void {
  const entries: SeenByTenant = {};
  for (const [tenantId, ids] of seenByTenant.entries()) {
    entries[tenantId] = [...ids];
  }
  writeWebStorage(entries);
}

function notify(): void {
  listeners.forEach((listener) => listener());
}

function hydrateFromWeb(): void {
  for (const [tenantId, ids] of Object.entries(readWebStorage())) {
    seenByTenant.set(tenantId, new Set(ids));
  }
}

function ensureTenantSet(tenantId: string): Set<string> {
  let set = seenByTenant.get(tenantId);
  if (!set) {
    set = new Set<string>();
    seenByTenant.set(tenantId, set);
  }
  return set;
}

hydrateFromWeb();

export function subscribeOfficeMessageNavBadgeSeenStore(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getOfficeMessageNavBadgeMessengerView(): OfficeMessageNavMessengerView | null {
  return messengerView;
}

export function setOfficeMessageNavBadgeMessengerView(view: OfficeMessageNavMessengerView | null): void {
  messengerView = view;
  notify();
}

export function getSeenOfficeMessageNavThreadIds(tenantId: string): ReadonlySet<string> {
  return ensureTenantSet(tenantId);
}

export function markOfficeMessageNavThreadsSeen(tenantId: string, threadIds: readonly string[]): void {
  if (!tenantId || threadIds.length === 0) return;
  const set = ensureTenantSet(tenantId);
  let changed = false;
  for (const id of threadIds) {
    if (!id || set.has(id)) continue;
    set.add(id);
    changed = true;
  }
  if (!changed) return;
  persist();
  notify();
}

export function resetOfficeMessageNavBadgeSeenStore(): void {
  seenByTenant.clear();
  messengerView = null;
  writeWebStorage({});
  notify();
}
