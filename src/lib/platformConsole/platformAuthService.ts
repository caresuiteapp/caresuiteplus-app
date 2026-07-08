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
