import type { RoleKey, ServiceResult } from '@/types';
import { assertTenantForMode } from '@/lib/tenant/tenantResolver';
import { qmDemoRepository } from './qmRepository.demo';
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
import { createQmExportJob } from './qmExportService';

export async function fetchMdAuditPackages(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<MdAuditPackage[]>> {
  const denied = enforceQmPermission<MdAuditPackage[]>(actorRoleKey, QM_VIEW);
  if (denied) return denied;
  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return { ok: false, error: tenantErr.error };
  await new Promise((r) => setTimeout(r, 120));
  return qmDemoRepository.listMdPackages(tenantId);
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
  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return { ok: false, error: tenantErr.error };

  const pkgResult = await qmDemoRepository.getMdPackage(tenantId, packageId);
  if (!pkgResult.ok) return pkgResult;
  if (!pkgResult.data) return { ok: false, error: 'MD-Mappe nicht gefunden.' };

  const itemsResult = await qmDemoRepository.listMdPackageItems(tenantId, packageId);
  if (!itemsResult.ok) return itemsResult;

  return { ok: true, data: { pkg: pkgResult.data, items: itemsResult.data } };
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
  return qmDemoRepository.createMdPackage(tenantId, {
    title: input.title,
    inspectionYear: input.inspectionYear,
    notes: input.notes ?? '',
  });
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
  return qmDemoRepository.setMdPackageItems(tenantId, packageId, documentIds);
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
  return qmDemoRepository.updateMdPackage(tenantId, packageId, {
    datenschutzConfirmed: true,
    status: 'pending_approval',
  });
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

  const items = await qmDemoRepository.listMdPackageItems(tenantId, packageId);
  if (!items.ok) return items;
  const docIds = items.data.map((i) => i.documentId);

  const exportResult = await createQmExportJob(
    tenantId,
    { packageId, documentIds: docIds, format: 'pdf' },
    actorRoleKey,
  );
  if (!exportResult.ok) return exportResult;

  return qmDemoRepository.updateMdPackage(tenantId, packageId, {
    status: 'approved',
    approvedAt: new Date().toISOString(),
    approvedBy,
    exportJobId: exportResult.data.id,
  });
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
  return qmDemoRepository.createShareToken(tenantId, packageId, expiresInDays);
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
  return qmDemoRepository.revokeShareToken(tenantId, tokenId);
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
  return qmDemoRepository.listMdAccessLogs(tenantId, packageId);
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
  const tokenResult = await qmDemoRepository.getShareTokenByValue(token);
  if (!tokenResult.ok) return tokenResult;
  if (!tokenResult.data) {
    return { ok: false, error: 'Ungültiger Freigabe-Link.' };
  }

  const t = tokenResult.data;
  const tenantId = t.tenantId;

  if (t.revokedAt) {
    await qmDemoRepository.logMdAccess(tenantId, {
      tokenId: t.id,
      packageId: t.packageId,
      accessedAt: new Date().toISOString(),
      ipAddress: meta?.ipAddress ?? null,
      userAgent: meta?.userAgent ?? null,
      success: false,
      reason: 'Token widerrufen',
    });
    return { ok: false, error: 'Freigabe wurde widerrufen.' };
  }

  if (new Date(t.expiresAt) < new Date()) {
    await qmDemoRepository.logMdAccess(tenantId, {
      tokenId: t.id,
      packageId: t.packageId,
      accessedAt: new Date().toISOString(),
      ipAddress: meta?.ipAddress ?? null,
      userAgent: meta?.userAgent ?? null,
      success: false,
      reason: 'Token abgelaufen',
    });
    return { ok: false, error: 'Freigabe-Link ist abgelaufen.' };
  }

  const pkgResult = await qmDemoRepository.getMdPackage(tenantId, t.packageId);
  if (!pkgResult.ok) return pkgResult;
  if (!pkgResult.data) return { ok: false, error: 'MD-Mappe nicht gefunden.' };

  const itemsResult = await qmDemoRepository.listMdPackageItems(tenantId, t.packageId);
  if (!itemsResult.ok) return itemsResult;

  await qmDemoRepository.logMdAccess(tenantId, {
    tokenId: t.id,
    packageId: t.packageId,
    accessedAt: new Date().toISOString(),
    ipAddress: meta?.ipAddress ?? null,
    userAgent: meta?.userAgent ?? null,
    success: true,
    reason: null,
  });

  return {
    ok: true,
    data: { package: pkgResult.data, items: itemsResult.data, token: t },
  };
}
