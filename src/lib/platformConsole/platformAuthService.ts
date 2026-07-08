import type { ServiceResult } from '@/types/core/base';
import type { PlatformUser } from '@/types/platformConsole';
import { getServiceMode } from '@/lib/services/mode';
import { platformRpc } from './platformSupabaseClient';

type RpcCurrentUserResponse = {
  isPlatformUser: boolean;
  id?: string;
  userId?: string;
  email?: string;
  fullName?: string | null;
  role?: PlatformUser['role'];
  status?: PlatformUser['status'];
  lastLoginAt?: string | null;
};

let demoPlatformUser: PlatformUser | null = null;

export function setDemoPlatformUser(user: PlatformUser | null): void {
  demoPlatformUser = user;
}

export function resetDemoPlatformStore(): void {
  demoPlatformUser = null;
}

export async function fetchPlatformCurrentUser(): Promise<ServiceResult<PlatformUser | null>> {
  if (getServiceMode() === 'demo') {
    return { ok: true, data: demoPlatformUser };
  }

  const { data, error } = await platformRpc<RpcCurrentUserResponse>('platform_get_current_user');
  if (error) {
    if (error.message.includes('platform_forbidden') || error.code === '42501') {
      return { ok: true, data: null };
    }
    return { ok: false, error: error.message };
  }

  const payload = data as RpcCurrentUserResponse | null;
  if (!payload?.isPlatformUser || !payload.id || !payload.userId || !payload.role) {
    return { ok: true, data: null };
  }

  return {
    ok: true,
    data: {
      id: payload.id,
      userId: payload.userId,
      email: payload.email ?? '',
      fullName: payload.fullName ?? null,
      role: payload.role,
      status: payload.status ?? 'active',
      lastLoginAt: payload.lastLoginAt ?? null,
    },
  };
}

export async function isPlatformUserActive(): Promise<boolean> {
  const result = await fetchPlatformCurrentUser();
  return result.ok && result.data?.status === 'active';
}

export type PlatformSignInResult =
  | { ok: true; user: PlatformUser }
  | { ok: false; error: string; code?: 'invalid_credentials' | 'no_platform_access' | 'platform_disabled' | 'network' };

export async function signInPlatformConsole(
  email: string,
  password: string,
): Promise<PlatformSignInResult> {
  const trimmedEmail = email.trim();
  if (!trimmedEmail || !password) {
    return { ok: false, error: 'Bitte E-Mail und Passwort eingeben.', code: 'invalid_credentials' };
  }

  if (getServiceMode() === 'demo') {
    if (demoPlatformUser?.status === 'active' && demoPlatformUser.email === trimmedEmail.toLowerCase()) {
      return { ok: true, user: demoPlatformUser };
    }
    return { ok: false, error: 'Kein Platform-Zugriff für diese Zugangsdaten.', code: 'no_platform_access' };
  }

  const { signInWithPassword } = await import('@/lib/supabase/authService');
  const sessionResult = await signInWithPassword(trimmedEmail, password);
  if (!sessionResult.ok) {
    const code = sessionResult.error.includes('Netzwerk') ? 'network' : 'invalid_credentials';
    return { ok: false, error: sessionResult.error, code };
  }

  const platformResult = await fetchPlatformCurrentUser();
  if (!platformResult.ok) {
    return { ok: false, error: platformResult.error, code: 'network' };
  }

  if (!platformResult.data) {
    return {
      ok: false,
      error: 'Kein Platform-Zugriff. Dieser Bereich ist nur für autorisierte Plattformadministratoren.',
      code: 'no_platform_access',
    };
  }

  if (platformResult.data.status !== 'active') {
    return {
      ok: false,
      error: 'Ihr Platform-Zugriff ist deaktiviert oder widerrufen.',
      code: 'platform_disabled',
    };
  }

  return { ok: true, user: platformResult.data };
}
