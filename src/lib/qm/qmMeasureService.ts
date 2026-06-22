import type { RoleKey, ServiceResult } from '@/types';
import { assertTenantForMode } from '@/lib/tenant/tenantResolver';
import { blockDemoOnlyInLiveMode } from '@/lib/services/liveServiceGuard';
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
  const liveBlock = blockDemoOnlyInLiveMode<QmMeasure[]>('QM-Maßnahmen');
  if (liveBlock) return liveBlock;
  return { ok: true, data: [] };
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
  const liveBlock = blockDemoOnlyInLiveMode<QmMeasure>('QM-Maßnahmen');
  if (liveBlock) return liveBlock;
  return { ok: false, error: 'QM-Maßnahmen im Live-Modus noch nicht vollständig angebunden.' };
}
