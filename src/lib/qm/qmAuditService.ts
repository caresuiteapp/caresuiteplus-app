import type { RoleKey, ServiceResult } from '@/types';
import { assertTenantForMode } from '@/lib/tenant/tenantResolver';
import { blockDemoOnlyInLiveMode } from '@/lib/services/liveServiceGuard';
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
  const liveBlock = blockDemoOnlyInLiveMode<QmAudit[]>('QM-Audits');
  if (liveBlock) return liveBlock;
  return { ok: true, data: [] };
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
  const liveBlock = blockDemoOnlyInLiveMode<QmAudit>('QM-Audits');
  if (liveBlock) return liveBlock;
  return { ok: false, error: 'QM-Audits im Live-Modus noch nicht vollständig angebunden.' };
}
