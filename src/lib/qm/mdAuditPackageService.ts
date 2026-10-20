import type { RoleKey, ServiceResult } from '@/types';
import { assertTenantForMode } from '@/lib/tenant/tenantResolver';
import { blockDemoOnlyInLiveMode, guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { qmSupabaseRepository } from './qmRepository.supabase';
import { qmDemoRepository } from './qmRepository.demo';
import { getServiceMode } from '@/lib/services/mode';
import {
  enforceQmPermission,
  QM_APPROVE_MD_PACKAGE,
  QM_CREATE_MD_PACKAGE,
  QM_REVOKE_MD_PACKAGE,
  QM_SHARE_MD_PACKAGE,
  QM_VIEW,
  QM_VIEW_MD_LOGS,
} from './qmPermissions';
import type {
  MdAccessLogEntry,
  MdAuditPackage,
  MdAuditPackageItem,
  MdShareToken,
} from './qm.types';
export async function fetchMdAuditPackages(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<MdAuditPackage[]>> {
  const denied = enforceQmPermission<MdAuditPackage[]>(actorRoleKey, QM_VIEW);
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  if (getServiceMode() === 'demo') return qmDemoRepository.listMdPackages(tenantId);
  const result = await qmSupabaseRepository.listMdPackages(tenantId);
  if (!result.ok) return result as ServiceResult<MdAuditPackage[]>;
  return { ok: true, data: result.data as MdAuditPackage[] };
}

export async function fetchMdAuditPackage(
  tenantId: string,
  packageId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<{ pkg: MdAuditPackage; items: MdAuditPackageItem[] }>> {
  const denied = enforceQmPermission<{ pkg: MdAuditPackage; items: MdAuditPackageItem[] }>(
    actorRoleKey,
    QM_VIEW,
  );
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  if (getServiceMode() === 'demo') {
    const pkg = await qmDemoRepository.getMdPackage(tenantId, packageId);
    if (!pkg.ok) return pkg as ServiceResult<{ pkg: MdAuditPackage; items: MdAuditPackageItem[] }>;
    if (!pkg.data) return { ok: false, error: 'MD-Mappe nicht gefunden.' };
    const items = await qmDemoRepository.listMdPackageItems(tenantId, packageId);
    if (!items.ok) return items as ServiceResult<{ pkg: MdAuditPackage; items: MdAuditPackageItem[] }>;
    return { ok: true, data: { pkg: pkg.data, items: items.data } };
  }
  const liveBlock = blockDemoOnlyInLiveMode<{ pkg: MdAuditPackage; items: MdAuditPackageItem[] }>(
    'MD-Audit-Mappe',
  );
  if (liveBlock) return liveBlock;
  return { ok: false, error: 'MD-Audit-Mappe im Live-Modus noch nicht vollständig angebunden.' };
}

export async function createMdAuditPackage(
  tenantId: string,
  input: { title: string; inspectionYear: number; notes?: string },
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<MdAuditPackage>> {
  const denied = enforceQmPermission<MdAuditPackage>(actorRoleKey, QM_CREATE_MD_PACKAGE);
  if (denied) return denied;
  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return { ok: false, error: tenantErr.error };
  if (getServiceMode() === 'demo') {
    return qmDemoRepository.createMdPackage(tenantId, { ...input, notes: input.notes ?? '' });
  }
  const liveBlock = blockDemoOnlyInLiveMode<MdAuditPackage>('MD-Audit-Mappe');
  if (liveBlock) return liveBlock;
  return { ok: false, error: 'MD-Audit-Mappe im Live-Modus noch nicht vollständig angebunden.' };
}

export async function selectMdPackageDocuments(
  tenantId: string,
  packageId: string,
  documentIds: string[],
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<MdAuditPackageItem[]>> {
  const denied = enforceQmPermission<MdAuditPackageItem[]>(actorRoleKey, QM_CREATE_MD_PACKAGE);
  if (denied) return denied;
  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return { ok: false, error: tenantErr.error };
  if (getServiceMode() === 'demo') return qmDemoRepository.setMdPackageItems(tenantId, packageId, documentIds);
  const liveBlock = blockDemoOnlyInLiveMode<MdAuditPackageItem[]>('MD-Audit-Mappe');
  if (liveBlock) return liveBlock;
  return { ok: false, error: 'MD-Audit-Mappe im Live-Modus noch nicht vollständig angebunden.' };
}

export async function confirmMdPackageDatenschutz(
  tenantId: string,
  packageId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<MdAuditPackage>> {
  const denied = enforceQmPermission<MdAuditPackage>(actorRoleKey, QM_CREATE_MD_PACKAGE);
  if (denied) return denied;
  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return { ok: false, error: tenantErr.error };
  if (getServiceMode() === 'demo') return qmDemoRepository.updateMdPackage(tenantId, packageId, { datenschutzConfirmed: true });
  const liveBlock = blockDemoOnlyInLiveMode<MdAuditPackage>('MD-Audit-Mappe');
  if (liveBlock) return liveBlock;
  return { ok: false, error: 'MD-Audit-Mappe im Live-Modus noch nicht vollständig angebunden.' };
}

export async function approveMdAuditPackage(
  tenantId: string,
  packageId: string,
  approvedBy: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<MdAuditPackage>> {
  const denied = enforceQmPermission<MdAuditPackage>(actorRoleKey, QM_APPROVE_MD_PACKAGE);
  if (denied) return denied;
  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return { ok: false, error: tenantErr.error };
  if (getServiceMode() === 'demo') {
    const exportJob = await qmDemoRepository.createExportJob(tenantId, { packageId, documentIds: [], format: 'pdf' });
    if (!exportJob.ok) return exportJob as ServiceResult<MdAuditPackage>;
    return qmDemoRepository.updateMdPackage(tenantId, packageId, {
      status: 'approved',
      approvedAt: new Date().toISOString(),
      approvedBy,
      exportJobId: exportJob.data.id,
    });
  }
  const liveBlock = blockDemoOnlyInLiveMode<MdAuditPackage>('MD-Audit-Mappe');
  if (liveBlock) return liveBlock;
  return { ok: false, error: 'MD-Audit-Mappe im Live-Modus noch nicht vollständig angebunden.' };
}

export async function generateMdShareToken(
  tenantId: string,
  packageId: string,
  expiresInDays: number,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<MdShareToken>> {
  const denied = enforceQmPermission<MdShareToken>(actorRoleKey, QM_SHARE_MD_PACKAGE);
  if (denied) return denied;
  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return { ok: false, error: tenantErr.error };
  if (getServiceMode() === 'demo') return qmDemoRepository.createShareToken(tenantId, packageId, expiresInDays);
  const liveBlock = blockDemoOnlyInLiveMode<MdShareToken>('MD-Audit-Mappe');
  if (liveBlock) return liveBlock;
  return { ok: false, error: 'MD-Audit-Mappe im Live-Modus noch nicht vollständig angebunden.' };
}

export async function revokeMdShareToken(
  tenantId: string,
  tokenId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<MdShareToken>> {
  const denied = enforceQmPermission<MdShareToken>(actorRoleKey, QM_REVOKE_MD_PACKAGE);
  if (denied) return denied;
  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return { ok: false, error: tenantErr.error };
  if (getServiceMode() === 'demo') return qmDemoRepository.revokeShareToken(tenantId, tokenId);
  const liveBlock = blockDemoOnlyInLiveMode<MdShareToken>('MD-Audit-Mappe');
  if (liveBlock) return liveBlock;
  return { ok: false, error: 'MD-Audit-Mappe im Live-Modus noch nicht vollständig angebunden.' };
}

export async function fetchMdAccessLogs(
  tenantId: string,
  packageId?: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<MdAccessLogEntry[]>> {
  const denied = enforceQmPermission<MdAccessLogEntry[]>(actorRoleKey, QM_VIEW_MD_LOGS);
  if (denied) return denied;
  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return { ok: false, error: tenantErr.error };
  if (getServiceMode() === 'demo') return qmDemoRepository.listMdAccessLogs(tenantId, packageId);
  const liveBlock = blockDemoOnlyInLiveMode<MdAccessLogEntry[]>('MD-Audit-Mappe');
  if (liveBlock) return liveBlock;
  return { ok: true, data: [] };
}

export type MdShareViewResult = {
  package: MdAuditPackage;
  items: MdAuditPackageItem[];
  token: MdShareToken;
};

export async function validateMdShareToken(
  token: string,
  meta?: { ipAddress?: string; userAgent?: string },
): Promise<ServiceResult<MdShareViewResult>> {
  if (getServiceMode() === 'demo') {
    const tokenResult = await qmDemoRepository.getShareTokenByValue(token);
    if (!tokenResult.ok || !tokenResult.data) return { ok: false, error: 'Freigabe-Link ungültig.' };
    const shareToken = tokenResult.data;
    if (shareToken.revokedAt || new Date(shareToken.expiresAt).getTime() <= Date.now()) {
      return { ok: false, error: 'Freigabe-Link ist abgelaufen oder widerrufen.' };
    }
    const pkg = await qmDemoRepository.getMdPackage(shareToken.tenantId, shareToken.packageId);
    const items = await qmDemoRepository.listMdPackageItems(shareToken.tenantId, shareToken.packageId);
    if (!pkg.ok || !pkg.data || !items.ok) return { ok: false, error: 'MD-Mappe nicht gefunden.' };
    await qmDemoRepository.logMdAccess(shareToken.tenantId, {
      packageId: shareToken.packageId,
      tokenId: shareToken.id,
      accessedAt: new Date().toISOString(),
      success: true,
      ipAddress: meta?.ipAddress ?? null,
      userAgent: meta?.userAgent ?? null,
      reason: null,
    });
    return { ok: true, data: { package: pkg.data, items: items.data, token: shareToken } };
  }
  const liveBlock = blockDemoOnlyInLiveMode<MdShareViewResult>('MD-Audit-Mappe');
  if (liveBlock) return liveBlock;
  return { ok: false, error: 'MD-Audit-Mappe im Live-Modus noch nicht vollständig angebunden.' };
}
