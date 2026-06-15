import type { ServiceResult } from '@/types';
import { SERVICE_ERRORS } from './errors';

type RunServiceOptions = {
  delayMs?: number;
};

export async function runService<T>(
  action: () => Promise<ServiceResult<T>>,
  options?: RunServiceOptions,
): Promise<ServiceResult<T>> {
  try {
    if (options?.delayMs) {
      await new Promise((resolve) => setTimeout(resolve, options.delayMs));
    }
    return await action();
  } catch {
    return { ok: false, error: SERVICE_ERRORS.unexpected };
  }
}

export function assertTenant(
  tenantId: string,
  expectedTenantId: string,
): { ok: false; error: string } | null {
  if (tenantId !== expectedTenantId) {
    return { ok: false, error: SERVICE_ERRORS.tenantDenied };
  }
  return null;
}
