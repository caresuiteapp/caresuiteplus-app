import type { RoleKey, ServiceResult } from '@/types';
import { assertTenantForMode } from '@/lib/tenant/tenantResolver';
import { qmDemoRepository } from './qmRepository.demo';
import { enforceQmPermission, QM_CREATE_MEASURE, QM_VIEW } from './qmPermissions';
import type { QmMeasure } from './qm.types';

export async function fetchQmMeasures(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<QmMeasure[]>> {
  const denied = enforceQmPermission<QmMeasure[]>(actorRoleKey, QM_VIEW);
  if (denied) return denied;
  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return { ok: false, error: tenantErr.error };
  await new Promise((r) => setTimeout(r, 100));
  return qmDemoRepository.listMeasures(tenantId);
}

export async function createQmMeasure(
  tenantId: string,
  input: Pick<QmMeasure, 'title' | 'auditId' | 'dueAt' | 'assignedTo' | 'description'>,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<QmMeasure>> {
  const denied = enforceQmPermission<QmMeasure>(actorRoleKey, QM_CREATE_MEASURE);
  if (denied) return denied;
  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return { ok: false, error: tenantErr.error };
  return qmDemoRepository.createMeasure(tenantId, {
    ...input,
    status: 'open',
    completedAt: null,
  });
}
