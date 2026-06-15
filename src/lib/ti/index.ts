import type { RoleKey, ServiceResult } from '@/types';
import type { TIDashboardSnapshot } from '@/types/modules/ti';
import { TI_DEMO_TENANT, getTIDashboardSnapshot } from '@/data/demo/ti';
import { enforcePermission } from '@/lib/permissions';

export async function fetchTIDashboard(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<TIDashboardSnapshot>> {
  const denied = enforcePermission<TIDashboardSnapshot>(actorRoleKey, 'ti.view');
  if (denied) return denied;
  if (tenantId !== TI_DEMO_TENANT) return { ok: false, error: 'Mandant nicht gefunden.' };
  await new Promise((r) => setTimeout(r, 160));
  return { ok: true, data: getTIDashboardSnapshot() };
}

export {
  fetchTIAuditLog,
  exportTIAuditLog,
  appendTIAudit,
} from './tiAuditService';
export {
  fetchTIConsents,
  checkTIConsent,
  grantTIConsentService,
  revokeTIConsentService,
} from './tiConsentService';
export {
  hasTIPermission,
  enforceTIPermission,
  canAccessKIM,
  canManageProviders,
  canViewAudit,
  canManageConsent,
  TI_PERMISSION_LABELS,
} from './tiPermissionService';
export {
  fetchTIProviders,
  checkTIProviderConnection,
  updateTIProviderConfig,
} from './tiProviderService';
export { fetchKIMMailbox, fetchKIMMailboxes } from './kimMailboxService';
export {
  fetchKIMMessageDetail,
  updateKIMMessageStatusService,
} from './kimMessageService';
export {
  requestKIMAttachmentImport,
  fetchKIMAttachmentsForMessage,
} from './kimAttachmentService';
