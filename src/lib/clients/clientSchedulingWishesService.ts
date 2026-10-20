import type { ServiceResult } from '@/types';
import type {
  ClientSchedulingWishes,
  ClientSchedulingWishesInput,
} from '@/types/modules/client/clientSchedulingWishes';
import { getDemoClientFullDetail, upsertDemoClientFullDetail } from '@/data/demo/clients';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { runService } from '@/lib/services/serviceRunner';
import { assertDemoTenant, getClientExtendedRepository, isDemoClientBackend } from './clientBackend';

export async function fetchClientSchedulingWishes(
  tenantId: string,
  clientId: string,
): Promise<ServiceResult<ClientSchedulingWishes | null>> {
  return runService(async () => {
    if (!isDemoClientBackend()) {
      return getClientExtendedRepository().fetchSchedulingWishes(tenantId, clientId);
    }

    const denied = assertDemoTenant(tenantId);
    if (denied) return denied;
    const full = getDemoClientFullDetail(clientId);
    if (!full) return { ok: false, error: SERVICE_ERRORS.clientNotFound };
    return { ok: true, data: full.schedulingWishes ?? null };
  }, { delayMs: 150 });
}

export async function saveClientSchedulingWishes(
  tenantId: string,
  clientId: string,
  input: ClientSchedulingWishesInput,
): Promise<ServiceResult<ClientSchedulingWishes>> {
  return runService(async () => {
    if (!isDemoClientBackend()) {
      return getClientExtendedRepository().upsertSchedulingWishes(tenantId, clientId, input);
    }

    const denied = assertDemoTenant(tenantId);
    if (denied) return denied;
    const full = getDemoClientFullDetail(clientId);
    if (!full) return { ok: false, error: SERVICE_ERRORS.clientNotFound };

    const now = new Date().toISOString();
    const wishes: ClientSchedulingWishes = {
      id: full.schedulingWishes?.id ?? `wish-${clientId}`,
      tenantId,
      clientId,
      ...input,
      createdAt: full.schedulingWishes?.createdAt ?? now,
      updatedAt: now,
    };

    upsertDemoClientFullDetail({ ...full, schedulingWishes: wishes, updatedAt: now });
    return { ok: true, data: wishes };
  }, { delayMs: 150 });
}
