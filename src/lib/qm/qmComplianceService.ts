import type { RoleKey, ServiceResult } from '@/types';
import { assertTenantForMode } from '@/lib/tenant/tenantResolver';
import { qmDemoRepository } from './qmRepository.demo';
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
  await new Promise((r) => setTimeout(r, 100));
  return qmDemoRepository.listLegalReferences(tenantId);
}

export async function fetchQmCompliance(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<QmComplianceRequirement[]>> {
  const denied = enforceQmPermission<QmComplianceRequirement[]>(actorRoleKey, QM_VIEW);
  if (denied) return denied;
  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return { ok: false, error: tenantErr.error };
  await new Promise((r) => setTimeout(r, 100));
  return qmDemoRepository.listCompliance(tenantId);
}

export function canManageCompliance(actorRoleKey?: RoleKey | null): boolean {
  return enforceQmPermission(actorRoleKey, QM_MANAGE_COMPLIANCE) === null;
}

export function canManageLegal(actorRoleKey?: RoleKey | null): boolean {
  return enforceQmPermission(actorRoleKey, QM_MANAGE_LEGAL) === null;
}
