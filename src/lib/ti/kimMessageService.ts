import type { RoleKey, ServiceResult } from '@/types';
import type { KIMMessageDetail, KIMMessageStatus } from '@/types/modules/ti';
import {
  TI_DEMO_TENANT,
  appendTIAuditEvent,
  getKIMMessageDetail,
  updateKIMMessageStatus,
} from '@/data/demo/ti';
import { enforcePermission } from '@/lib/permissions';
import { getServiceMode } from '@/lib/services/mode';
import { kimAttachmentsSupabaseRepository, kimMessagesSupabaseRepository } from '@/lib/ti/repositories';
import { assertTenantForMode } from '@/lib/tenant/tenantResolver';
import { checkTIConsent } from './tiConsentService';

export async function fetchKIMMessageDetail(
  tenantId: string,
  messageId: string,
  actorRoleKey?: RoleKey | null,
  actorName = 'System',
): Promise<ServiceResult<KIMMessageDetail>> {
  const denied = enforcePermission<KIMMessageDetail>(actorRoleKey, 'ti.kim.view');
  if (denied) return denied;

  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return { ok: false, error: tenantErr.error };

  const consentCheck = await checkTIConsent(tenantId, ['kim'], actorRoleKey);
  if (consentCheck.ok && !consentCheck.data.hasConsent) {
    return { ok: false, error: consentCheck.data.blockedReason ?? 'Einwilligung für KIM fehlt.' };
  }

  if (getServiceMode() === 'supabase') {
    const message = await kimMessagesSupabaseRepository.getById(tenantId, messageId);
    if (!message.ok) return message;
    if (!message.data) return { ok: false, error: 'Nachricht nicht gefunden.' };

    let detail: KIMMessageDetail = {
      ...message.data,
      attachments: [],
    };

    if (message.data.status === 'unread') {
      const updated = await kimMessagesSupabaseRepository.updateStatus(tenantId, messageId, 'read');
      if (updated.ok) {
        detail = { ...updated.data, attachments: [] };
      }
    }

    const attachments = await kimAttachmentsSupabaseRepository.listForMessage(tenantId, messageId);
    if (attachments.ok) {
      detail.attachments = attachments.data;
    }

    return { ok: true, data: detail };
  }

  if (tenantId !== TI_DEMO_TENANT) return { ok: false, error: 'Mandant nicht gefunden.' };

  const detail = getKIMMessageDetail(messageId);
  if (!detail) return { ok: false, error: 'Nachricht nicht gefunden.' };

  await new Promise((r) => setTimeout(r, 140));

  if (detail.status === 'unread') {
    updateKIMMessageStatus(messageId, 'read');
    detail.status = 'read';
  }

  appendTIAuditEvent({
    tenantId,
    action: 'message_opened',
    actorId: null,
    actorName,
    resourceType: 'kim_message',
    resourceId: messageId,
    details: `KIM-Nachricht geöffnet: ${detail.subject}`,
    ipAddress: null,
  });

  return { ok: true, data: detail };
}

export async function updateKIMMessageStatusService(
  tenantId: string,
  messageId: string,
  status: KIMMessageStatus,
  actorRoleKey?: RoleKey | null,
  actorName = 'System',
): Promise<ServiceResult<KIMMessageDetail>> {
  const denied = enforcePermission<KIMMessageDetail>(actorRoleKey, 'ti.kim.manage');
  if (denied) return denied;

  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return { ok: false, error: tenantErr.error };

  if (getServiceMode() === 'supabase') {
    const updated = await kimMessagesSupabaseRepository.updateStatus(tenantId, messageId, status);
    if (!updated.ok) return updated;

    const attachments = await kimAttachmentsSupabaseRepository.listForMessage(tenantId, messageId);
    const detail: KIMMessageDetail = {
      ...updated.data,
      attachments: attachments.ok ? attachments.data : [],
    };
    return { ok: true, data: detail };
  }

  if (tenantId !== TI_DEMO_TENANT) return { ok: false, error: 'Mandant nicht gefunden.' };

  const updated = updateKIMMessageStatus(messageId, status);
  if (!updated) return { ok: false, error: 'Nachricht nicht gefunden.' };

  appendTIAuditEvent({
    tenantId,
    action: 'message_status_changed',
    actorId: null,
    actorName,
    resourceType: 'kim_message',
    resourceId: messageId,
    details: `Status geändert auf: ${status}`,
    ipAddress: null,
  });

  const detail = getKIMMessageDetail(messageId);
  return { ok: true, data: detail! };
}
