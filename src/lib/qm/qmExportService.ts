import type { RoleKey, ServiceResult } from '@/types';
import { assertTenantForMode } from '@/lib/tenant/tenantResolver';
import { qmDemoRepository } from './qmRepository.demo';
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
  await new Promise((r) => setTimeout(r, 100));
  return qmDemoRepository.listExportJobs(tenantId);
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
  return qmDemoRepository.createExportJob(tenantId, input);
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
  const jobs = await qmDemoRepository.listExportJobs(tenantId);
  if (!jobs.ok) return jobs;
  const job = jobs.data.find((j) => j.id === jobId);
  if (!job) return { ok: false, error: 'Export-Job nicht gefunden.' };
  return { ok: true, data: job };
}
