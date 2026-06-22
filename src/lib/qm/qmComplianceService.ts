import type { RoleKey, ServiceResult } from '@/types';
import { assertTenantForMode } from '@/lib/tenant/tenantResolver';
import { blockDemoOnlyInLiveMode } from '@/lib/services/liveServiceGuard';
import { enforceQmPermission, QM_MANAGE_COMPLIANCE, QM_MANAGE_LEGAL, QM_VIEW } from './qmPermissions';
import type { QmComplianceRequirement, QmLegalReference } from './qm.types';

export async function fetchQmLegalReferences(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<QmLegalReference[]>> {
  const denied = enforceQmPermission<QmLegalReference[]>(actorRoleKey, QM_VIEW);
  if (denied) return denied;
  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return { ok: false, error: tenantErr.error };
  const liveBlock = blockDemoOnlyInLiveMode<QmLegalReference[]>('QM-Rechtsreferenzen');
  if (liveBlock) return liveBlock;
  return { ok: true, data: [] };
}

export async function fetchQmCompliance(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<QmComplianceRequirement[]>> {
  const denied = enforceQmPermission<QmComplianceRequirement[]>(actorRoleKey, QM_VIEW);
  if (denied) return denied;
  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return { ok: false, error: tenantErr.error };
  const liveBlock = blockDemoOnlyInLiveMode<QmComplianceRequirement[]>('QM-Compliance');
  if (liveBlock) return liveBlock;
  return { ok: true, data: [] };
}

export function canManageCompliance(actorRoleKey?: RoleKey | null): boolean {
  return enforceQmPermission(actorRoleKey, QM_MANAGE_COMPLIANCE) === null;
}

export function canManageLegal(actorRoleKey?: RoleKey | null): boolean {
  return enforceQmPermission(actorRoleKey, QM_MANAGE_LEGAL) === null;
}
