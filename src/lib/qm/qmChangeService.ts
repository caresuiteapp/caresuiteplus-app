import type { RoleKey, ServiceResult } from '@/types';
import { assertTenantForMode } from '@/lib/tenant/tenantResolver';
import { blockDemoOnlyInLiveMode } from '@/lib/services/liveServiceGuard';
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
  const liveBlock = blockDemoOnlyInLiveMode<QmChange[]>('QM-Änderungen');
  if (liveBlock) return liveBlock;
  return { ok: true, data: [] };
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
  const liveBlock = blockDemoOnlyInLiveMode<QmChange>('QM-Änderungen');
  if (liveBlock) return liveBlock;
  return { ok: false, error: 'QM-Änderungen im Live-Modus noch nicht vollständig angebunden.' };
}
