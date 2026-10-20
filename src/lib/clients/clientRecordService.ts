import type { ServiceResult } from '@/types';
import type { ClientCareContext } from '@/lib/clients/clientIntakeFieldRules';
import { getClientRecordTabsForClientContext } from '@/lib/clients/clientIntakeFieldRules';
import type { ClientFullDetail } from '@/types/modules/client';
import { getDemoClientCareContexts } from '@/data/demo/clients/intakeRecords';
import { fetchClientFullDetail } from './clientFullDetailService';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { runService } from '@/lib/services/serviceRunner';
import { assertDemoTenant, getClientExtendedRepository, isDemoClientBackend } from './clientBackend';

export type ClientRecordView = {
  detail: ClientFullDetail;
  careContexts: ClientCareContext[];
  tabs: ReturnType<typeof getClientRecordTabsForClientContext>;
};

const CONTEXT_MAP: Record<string, ClientCareContext[]> = {
  'client-001': ['daily_assistance', 'support_care'],
  'client-002': ['ambulatory_care', 'support_care'],
  'client-003': ['ambulatory_care'],
  'client-004': ['consulting'],
  'client-005': ['stationary_care', 'support_care'],
  'client-006': ['stationary_care'],
  'client-007': ['consulting', 'daily_assistance'],
  'client-008': ['ambulatory_care'],
  'client-009': ['ambulatory_care'],
  'client-010': ['daily_assistance', 'companionship'],
};

export async function resolveCareContextsForClient(
  tenantId: string,
  clientId: string,
): Promise<ClientCareContext[]> {
  if (!isDemoClientBackend()) {
    const result = await getClientExtendedRepository().fetchCareContexts(tenantId, clientId);
    if (result.ok && result.data.length > 0) return result.data;
    return ['daily_assistance'];
  }

  const fromIntake = getDemoClientCareContexts(clientId);
  if (fromIntake.length > 0) return fromIntake;
  return CONTEXT_MAP[clientId] ?? ['daily_assistance'];
}

export async function fetchClientRecord(
  tenantId: string,
  clientId: string,
): Promise<ServiceResult<ClientRecordView>> {
  return runService(async () => {
    const detailResult = await fetchClientFullDetail(tenantId, clientId);
    if (!detailResult.ok) return detailResult;

    if (isDemoClientBackend()) {
      const denied = assertDemoTenant(tenantId);
      if (denied) return denied;
    }

    const detail = detailResult.data;
    if (!detail) return { ok: false, error: SERVICE_ERRORS.clientNotFound };

    const careContexts = await resolveCareContextsForClient(tenantId, clientId);
    const tabs = getClientRecordTabsForClientContext(careContexts);

    return {
      ok: true,
      data: { detail, careContexts, tabs },
    };
  }, { delayMs: 250 });
}

export async function fetchClientRecordKpis(
  tenantId: string,
  clientId: string,
): Promise<ServiceResult<Record<string, number>>> {
  return runService(async () => {
    const detailResult = await fetchClientFullDetail(tenantId, clientId);
    if (!detailResult.ok) return detailResult;

    const full = detailResult.data;
    return {
      ok: true,
      data: {
        documents: full.documents?.length ?? full.contextCounts?.documents ?? 0,
        appointments: full.contextCounts?.appointments ?? 0,
        invoices: full.contextCounts?.invoices ?? 0,
        assignments: full.contextCounts?.assignments ?? 0,
        tasks: full.tasks?.length ?? 0,
        consents: full.consents?.filter((c) => c.granted).length ?? 0,
      },
    };
  }, { delayMs: 150 });
}
