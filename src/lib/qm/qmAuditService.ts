import type { RoleKey, ServiceResult } from '@/types';
import { assertTenantForMode } from '@/lib/tenant/tenantResolver';
import { qmDemoRepository } from './qmRepository.demo';
import { enforceQmPermission, QM_CREATE_AUDIT, QM_VIEW } from './qmPermissions';
import type { QmAudit } from './qm.types';

export async function fetchQmAudits(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<QmAudit[]>> {
  const denied = enforceQmPermission<QmAudit[]>(actorRoleKey, QM_VIEW);
  if (denied) return denied;
  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return { ok: false, error: tenantErr.error };
  await new Promise((r) => setTimeout(r, 100));
  return qmDemoRepository.listAudits(tenantId);
}

export async function createQmAudit(
  tenantId: string,
  input: Pick<QmAudit, 'title' | 'auditType' | 'scheduledAt' | 'auditorName' | 'summary'>,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<QmAudit>> {
  const denied = enforceQmPermission<QmAudit>(actorRoleKey, QM_CREATE_AUDIT);
  if (denied) return denied;
  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return { ok: false, error: tenantErr.error };
  return qmDemoRepository.createAudit(tenantId, {
    ...input,
    status: 'planned',
    completedAt: null,
    findingsCount: 0,
  });
}
