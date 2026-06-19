import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AuthLoginType } from '@/lib/auth/auth.types';
import type { RoleKey } from '@/types';

const STORAGE_KEY = 'caresuite.portal.session.v1';

export type PortalSessionRecord = {
  sessionToken: string;
  tenantId: string;
  loginType: AuthLoginType;
  roleKey: RoleKey;
  expiresAt: string;
  accountId: string;
  /** Cached client display label for welcome text (real name, not portal username). */
  displayName?: string | null;
  /** Cached tenant label when direct tenants SELECT is blocked by RLS. */
  tenantName?: string | null;
  employeeId?: string | null;
  clientId?: string | null;
  relativeContactId?: string | null;
};

let memorySession: PortalSessionRecord | null = null;

export function getActivePortalSession(): PortalSessionRecord | null {
  if (!memorySession) return null;
  if (new Date(memorySession.expiresAt).getTime() <= Date.now()) {
    memorySession = null;
    return null;
  }
  return memorySession;
}

export async function loadPortalSession(): Promise<PortalSessionRecord | null> {
  if (memorySession) {
    return getActivePortalSession();
  }

  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as PortalSessionRecord;
    memorySession = parsed;
    return getActivePortalSession();
  } catch {
    await AsyncStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export async function savePortalSession(session: PortalSessionRecord): Promise<void> {
  memorySession = session;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export async function clearPortalSession(): Promise<void> {
  memorySession = null;
  await AsyncStorage.removeItem(STORAGE_KEY);
}
