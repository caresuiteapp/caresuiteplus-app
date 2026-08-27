import type { AuthLoginType } from '@/lib/auth/auth.types';
import { sensitiveAuthStorage } from '@/lib/security/sensitiveAuthStorage';
import type { RoleKey } from '@/types';

const STORAGE_KEY = 'caresuite.portal.session.v1';

export type PortalSessionRecord = {
  sessionToken: string;
  tenantId: string;
  loginType: AuthLoginType;
  roleKey: RoleKey;
  expiresAt: string;
  accountId: string;
  /** True until the employee sets a permanent password after OTP login. */
  mustChangePassword?: boolean;
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

function isPortalSessionRecord(value: unknown): value is PortalSessionRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<PortalSessionRecord>;
  return (
    typeof record.sessionToken === 'string' &&
    record.sessionToken.length >= 16 &&
    typeof record.tenantId === 'string' &&
    record.tenantId.length > 0 &&
    typeof record.accountId === 'string' &&
    record.accountId.length > 0 &&
    typeof record.expiresAt === 'string' &&
    Number.isFinite(new Date(record.expiresAt).getTime()) &&
    ['employee_portal', 'client_portal', 'relative_portal'].includes(String(record.loginType)) &&
    ['employee_portal', 'client_portal', 'family_portal'].includes(String(record.roleKey))
  );
}

export async function loadPortalSession(): Promise<PortalSessionRecord | null> {
  if (memorySession) {
    return getActivePortalSession();
  }

  const raw = await sensitiveAuthStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isPortalSessionRecord(parsed)) {
      await sensitiveAuthStorage.removeItem(STORAGE_KEY);
      return null;
    }
    if (new Date(parsed.expiresAt).getTime() <= Date.now()) {
      await sensitiveAuthStorage.removeItem(STORAGE_KEY);
      return null;
    }
    memorySession = parsed;
    return getActivePortalSession();
  } catch {
    await sensitiveAuthStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export async function savePortalSession(session: PortalSessionRecord): Promise<void> {
  memorySession = session;
  await sensitiveAuthStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export async function clearPortalSession(): Promise<void> {
  memorySession = null;
  await sensitiveAuthStorage.removeItem(STORAGE_KEY);
}
