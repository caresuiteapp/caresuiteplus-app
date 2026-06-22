import type { RoleKey, ServiceResult } from '@/types';
import { assertTenantForMode } from '@/lib/tenant/tenantResolver';
import { blockDemoOnlyInLiveMode } from '@/lib/services/liveServiceGuard';
import { enforceQmPermission, QM_EXPORT, QM_VIEW } from './qmPermissions';
import type { QmExportJob } from './qm.types';

export async function fetchQmExportJobs(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<QmExportJob[]>> {
  const denied = enforceQmPermission<QmExportJob[]>(actorRoleKey, QM_VIEW);
  if (denied) return denied;
  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return { ok: false, error: tenantErr.error };
  const liveBlock = blockDemoOnlyInLiveMode<QmExportJob[]>('QM-Export');
  if (liveBlock) return liveBlock;
  return { ok: true, data: [] };
}

export async function createQmExportJob(
  tenantId: string,
  input: { packageId: string | null; documentIds: string[]; format: 'pdf' | 'zip' },
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<QmExportJob>> {
  const denied = enforceQmPermission<QmExportJob>(actorRoleKey, QM_EXPORT);
  if (denied) return denied;
  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return { ok: false, error: tenantErr.error };
  const liveBlock = blockDemoOnlyInLiveMode<QmExportJob>('QM-Export');
  if (liveBlock) return liveBlock;
  return { ok: false, error: 'QM-Export im Live-Modus noch nicht vollständig angebunden.' };
}

export async function getQmExportJob(
  tenantId: string,
  jobId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<QmExportJob>> {
  const denied = enforceQmPermission<QmExportJob>(actorRoleKey, QM_VIEW);
  if (denied) return denied;
  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return { ok: false, error: tenantErr.error };
  const liveBlock = blockDemoOnlyInLiveMode<QmExportJob>('QM-Export');
  if (liveBlock) return liveBlock;
  return { ok: false, error: 'Export-Job nicht gefunden.' };
}
