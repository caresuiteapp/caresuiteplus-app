import type { ServiceResult } from '@/types';
import type { ClientDocumentRecord } from '@/types/modules/client';
import { getDemoClientFullDetail } from '@/data/demo/clients';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { runService } from '@/lib/services/serviceRunner';
import { assertDemoTenant, getClientExtendedRepository, isDemoClientBackend } from './clientBackend';

export async function fetchClientDocuments(
  tenantId: string,
  clientId: string,
): Promise<ServiceResult<ClientDocumentRecord[]>> {
  return runService(async () => {
    if (!isDemoClientBackend()) {
      return getClientExtendedRepository().fetchDocuments(tenantId, clientId);
    }

    const denied = assertDemoTenant(tenantId);
    if (denied) return denied;
    const full = getDemoClientFullDetail(clientId);
    if (!full) return { ok: false, error: SERVICE_ERRORS.clientNotFound };
    return { ok: true, data: full.documents };
  }, { delayMs: 200 });
}
