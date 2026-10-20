import type { PermissionKey } from '@/types/permissions';
import type { RoleKey } from '@/types/core/auth';
import { enforcePermission } from '@/lib/permissions';
import type { ServiceResult } from '@/types';

export const QM_VIEW = 'qm.view' as PermissionKey;
export const QM_MANAGE_HANDBOOK = 'qm.manage_handbook' as PermissionKey;
export const QM_CREATE_DOCUMENT = 'qm.create_document' as PermissionKey;
export const QM_EDIT_DOCUMENT = 'qm.edit_document' as PermissionKey;
export const QM_APPROVE_DOCUMENT = 'qm.approve_document' as PermissionKey;
export const QM_ARCHIVE_DOCUMENT = 'qm.archive_document' as PermissionKey;
export const QM_VIEW_VERSIONS = 'qm.view_versions' as PermissionKey;
export const QM_MANAGE_LEGAL = 'qm.manage_legal_references' as PermissionKey;
export const QM_MANAGE_COMPLIANCE = 'qm.manage_compliance' as PermissionKey;
export const QM_CREATE_AUDIT = 'qm.create_audit' as PermissionKey;
export const QM_CLOSE_AUDIT = 'qm.close_audit' as PermissionKey;
export const QM_CREATE_MEASURE = 'qm.create_measure' as PermissionKey;
export const QM_CLOSE_MEASURE = 'qm.close_measure' as PermissionKey;
export const QM_USE_AI = 'qm.use_ai_assistant' as PermissionKey;
export const QM_CREATE_MD_PACKAGE = 'qm.create_md_package' as PermissionKey;
export const QM_APPROVE_MD_PACKAGE = 'qm.approve_md_package' as PermissionKey;
export const QM_SHARE_MD_PACKAGE = 'qm.share_md_package' as PermissionKey;
export const QM_REVOKE_MD_PACKAGE = 'qm.revoke_md_package' as PermissionKey;
export const QM_VIEW_MD_LOGS = 'qm.view_md_access_logs' as PermissionKey;
export const QM_EXPORT = 'qm.export_qm_documents' as PermissionKey;
export const QM_MANAGE_SETTINGS = 'qm.manage_settings' as PermissionKey;

export function enforceQmPermission<T>(
  roleKey: RoleKey | null | undefined,
  permission: PermissionKey,
): ServiceResult<T> | null {
  return enforcePermission<T>(roleKey, permission);
}

export const QM_ALL_PERMISSIONS: PermissionKey[] = [
  QM_VIEW,
  QM_MANAGE_HANDBOOK,
  QM_CREATE_DOCUMENT,
  QM_EDIT_DOCUMENT,
  QM_APPROVE_DOCUMENT,
  QM_ARCHIVE_DOCUMENT,
  QM_VIEW_VERSIONS,
  QM_MANAGE_LEGAL,
  QM_MANAGE_COMPLIANCE,
  QM_CREATE_AUDIT,
  QM_CLOSE_AUDIT,
  QM_CREATE_MEASURE,
  QM_CLOSE_MEASURE,
  QM_USE_AI,
  QM_CREATE_MD_PACKAGE,
  QM_APPROVE_MD_PACKAGE,
  QM_SHARE_MD_PACKAGE,
  QM_REVOKE_MD_PACKAGE,
  QM_VIEW_MD_LOGS,
  QM_EXPORT,
  QM_MANAGE_SETTINGS,
];

export const QM_VIEW_ONLY: PermissionKey[] = [QM_VIEW, QM_VIEW_VERSIONS];

export const QM_QMB_PERMISSIONS: PermissionKey[] = [
  ...QM_VIEW_ONLY,
  QM_MANAGE_HANDBOOK,
  QM_CREATE_DOCUMENT,
  QM_EDIT_DOCUMENT,
  QM_APPROVE_DOCUMENT,
  QM_MANAGE_LEGAL,
  QM_MANAGE_COMPLIANCE,
  QM_CREATE_AUDIT,
  QM_CLOSE_AUDIT,
  QM_CREATE_MEASURE,
  QM_CLOSE_MEASURE,
  QM_USE_AI,
  QM_CREATE_MD_PACKAGE,
  QM_APPROVE_MD_PACKAGE,
  QM_SHARE_MD_PACKAGE,
  QM_VIEW_MD_LOGS,
  QM_EXPORT,
];

export const QM_PDL_PERMISSIONS: PermissionKey[] = [
  ...QM_VIEW_ONLY,
  QM_CREATE_DOCUMENT,
  QM_EDIT_DOCUMENT,
  QM_MANAGE_COMPLIANCE,
  QM_CREATE_AUDIT,
  QM_CREATE_MEASURE,
  QM_CLOSE_MEASURE,
  QM_USE_AI,
  QM_CREATE_MD_PACKAGE,
  QM_APPROVE_MD_PACKAGE,
  QM_EXPORT,
];
