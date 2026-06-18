import type { RoleKey, ServiceResult } from '@/types';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { logOfficeMessageAuditEvent } from '@/lib/office/officemessageauditservice';

/** Stub: Chat-Export mit Audit-Protokollierung (Live-Backend folgt). */
export async function exportOfficeMessageThread(
  tenantId: string,
  threadId: string,
  actorRoleKey?: RoleKey | null,
  actorName?: string | null,
): Promise<ServiceResult<{ exported: boolean; format: 'audit_stub' }>> {
  const denied = enforcePermission<{ exported: boolean; format: 'audit_stub' }>(
    actorRoleKey,
    'office.access',
  );
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  void logOfficeMessageAuditEvent({
    tenantId,
    action: 'office_message_export_requested',
    summary: 'Chat-Export angefordert (Stub).',
    actorName: actorName ?? 'Office',
    threadId,
  });

  return { ok: true, data: { exported: true, format: 'audit_stub' } };
}
