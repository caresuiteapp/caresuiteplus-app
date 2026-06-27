import AsyncStorage from '@react-native-async-storage/async-storage';

export type PortalWelcomeKind = 'employee' | 'client';

const PENDING_KEY = 'portal-welcome-pending';
const SEEN_PREFIX = 'portal-welcome-seen';

let pendingPortalWelcome: PortalWelcomeKind | null = null;

export function markPortalWelcomePending(kind: PortalWelcomeKind): void {
  pendingPortalWelcome = kind;
  void AsyncStorage.setItem(PENDING_KEY, kind).catch(() => undefined);
}

export function peekPortalWelcomePending(): PortalWelcomeKind | null {
  return pendingPortalWelcome;
}

export async function hydratePortalWelcomePending(): Promise<PortalWelcomeKind | null> {
  if (pendingPortalWelcome) return pendingPortalWelcome;
  try {
    const raw = await AsyncStorage.getItem(PENDING_KEY);
    if (raw === 'employee' || raw === 'client') {
      pendingPortalWelcome = raw;
      return raw;
    }
  } catch {
    /* ignore storage errors */
  }
  return null;
}

export function clearPortalWelcomePending(): void {
  pendingPortalWelcome = null;
  void AsyncStorage.removeItem(PENDING_KEY).catch(() => undefined);
}

function seenStorageKey(kind: PortalWelcomeKind, accountId: string): string {
  return `${SEEN_PREFIX}:${kind}:${accountId}`;
}

export async function markPortalWelcomeSeen(
  kind: PortalWelcomeKind,
  accountId: string,
): Promise<void> {
  if (!accountId.trim()) return;
  await AsyncStorage.setItem(seenStorageKey(kind, accountId), new Date().toISOString());
  clearPortalWelcomePending();
}

export async function isPortalWelcomeSeen(
  kind: PortalWelcomeKind,
  accountId: string,
): Promise<boolean> {
  if (!accountId.trim()) return false;
  try {
    const value = await AsyncStorage.getItem(seenStorageKey(kind, accountId));
    return Boolean(value);
  } catch {
    return false;
  }
}
