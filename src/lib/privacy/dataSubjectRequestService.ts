import type { ServiceResult } from '@/types';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { notifyAdminsOfNewDataSubjectRequest } from './dataSubjectRequestAdminNotify';
import { isDataSubjectRequestBackendReady } from './dataRequestConfig';
import { dataSubjectRequestsSupabaseRepository } from './dataSubjectRequests.supabase';
import type { DataSubjectRequest, SubmitDataSubjectRequestInput } from './dataSubjectRequest.types';

function backendUnavailable<T>(): ServiceResult<T> {
  return {
    ok: false,
    error: 'Online-Einreichung ist im Demo-Modus nicht verfügbar. Nutzen Sie Support-E-Mail.',
  };
}

export async function submitDataSubjectRequest(
  tenantId: string,
  profileId: string | null,
  input: SubmitDataSubjectRequestInput,
): Promise<ServiceResult<DataSubjectRequest>> {
  if (!isDataSubjectRequestBackendReady()) {
    return backendUnavailable();
  }

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const name = input.requesterName.trim();
  const email = input.requesterEmail.trim();
  if (!name) {
    return { ok: false, error: 'Bitte geben Sie Ihren Namen an.' };
  }
  if (!email || !email.includes('@')) {
    return { ok: false, error: 'Bitte geben Sie eine gültige E-Mail-Adresse an.' };
  }

  const result = await dataSubjectRequestsSupabaseRepository.submit(tenantId, {
    ...input,
    requesterName: name,
    requesterEmail: email,
    profileId: profileId ?? undefined,
  });

  if (result.ok) {
    void notifyAdminsOfNewDataSubjectRequest(tenantId, result.data);
  }

  return result;
}
