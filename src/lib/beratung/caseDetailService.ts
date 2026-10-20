import type { RoleKey, ServiceResult } from '@/types';
import type { CounselingCaseDetail } from '@/types/modules/beratung';
import { getDemoCounselingCaseById } from '@/data/demo/counselingCases';
import { demoClients } from '@/data/demo/clients';
import { demoEmployees } from '@/data/demo/employees';
import { enforcePermission } from '@/lib/permissions';
import { CLIENT_STATUS_HINTS } from '@/lib/services';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';

function clientName(clientId: string | null): string {
  if (!clientId) return 'Anonym';
  const client = demoClients.find((c) => c.id === clientId);
  return client ? `${client.firstName} ${client.lastName}` : 'Unbekannt';
}

function counselorName(counselorProfileId: string): string {
  const employee = demoEmployees.find((e) => e.id === counselorProfileId);
  return employee ? `${employee.firstName} ${employee.lastName}` : 'Unbekannt';
}

function enrichCase(
  seed: NonNullable<ReturnType<typeof getDemoCounselingCaseById>>,
): CounselingCaseDetail {
  return {
    ...seed,
    clientName: clientName(seed.clientId),
    counselorName: counselorName(seed.counselorProfileId),
    nextActionHint: CLIENT_STATUS_HINTS[seed.status],
  };
}

export async function fetchCounselingCaseDetail(
  caseId: string,
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CounselingCaseDetail>> {
  const denied = enforcePermission<CounselingCaseDetail>(
    actorRoleKey,
    'beratung.cases.view',
  );
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  await new Promise((r) => setTimeout(r, 240));

  const seed = getDemoCounselingCaseById(caseId);
  if (!seed) {
    return { ok: false, error: 'Beratungsfall nicht gefunden.' };
  }

  return { ok: true, data: enrichCase(seed) };
}
