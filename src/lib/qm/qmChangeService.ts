import type { RoleKey, ServiceResult } from '@/types';
import { assertTenantForMode } from '@/lib/tenant/tenantResolver';
import { qmDemoRepository } from './qmRepository.demo';
import { enforceQmPermission, QM_VIEW } from './qmPermissions';
import type { QmChange, QmChangeType } from './qm.types';

export async function fetchQmChanges(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<QmChange[]>> {
  const denied = enforceQmPermission<QmChange[]>(actorRoleKey, QM_VIEW);
  if (denied) return denied;
  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return { ok: false, error: tenantErr.error };
  await new Promise((r) => setTimeout(r, 100));
  return qmDemoRepository.listChanges(tenantId);
}

export async function createQmChange(
  tenantId: string,
  input: { title: string; changeType: QmChangeType; documentId: string | null; description: string; requestedBy: string },
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<QmChange>> {
  const denied = enforceQmPermission<QmChange>(actorRoleKey, QM_VIEW);
  if (denied) return denied;
  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return { ok: false, error: tenantErr.error };
  return qmDemoRepository.createChange(tenantId, {
    ...input,
    status: 'open',
    completedAt: null,
  });
}
