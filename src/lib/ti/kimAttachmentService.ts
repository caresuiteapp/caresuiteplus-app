import type { RoleKey, ServiceResult } from '@/types';
import type { KIMAttachment, KIMAttachmentImportRequest } from '@/types/modules/ti';
import { TI_DEMO_TENANT, appendTIAuditEvent, demoKIMAttachments } from '@/data/demo/ti';
import { enforcePermission } from '@/lib/permissions';
import { getServiceMode } from '@/lib/services/mode';
import { kimAttachmentsSupabaseRepository } from '@/lib/ti/repositories';
import { assertTenantForMode } from '@/lib/tenant/tenantResolver';

export async function requestKIMAttachmentImport(
  tenantId: string,
  request: KIMAttachmentImportRequest,
  actorRoleKey?: RoleKey | null,
  actorName = 'System',
): Promise<ServiceResult<KIMAttachment>> {
  const denied = enforcePermission<KIMAttachment>(actorRoleKey, 'ti.kim.manage');
  if (denied) return denied;

  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return { ok: false, error: tenantErr.error };

  if (!request.confirmed) {
    return {
      ok: false,
      error: 'Import erfordert manuelle Bestätigung — OCR/AI-Vorschläge sind nicht bindend.',
    };
  }

  if (getServiceMode() === 'supabase') {
    const result = await kimAttachmentsSupabaseRepository.updateImportStatus(
      tenantId,
      request.attachmentId,
      'imported',
    );
    if (!result.ok) return result;
    return { ok: true, data: result.data };
  }

  if (tenantId !== TI_DEMO_TENANT) return { ok: false, error: 'Mandant nicht gefunden.' };

  const attachment = demoKIMAttachments.find((a) => a.id === request.attachmentId);
  if (!attachment) return { ok: false, error: 'Anhang nicht gefunden.' };

  await new Promise((r) => setTimeout(r, 250));

  attachment.importStatus = 'imported';
  attachment.updatedAt = new Date().toISOString();

  appendTIAuditEvent({
    tenantId,
    action: 'attachment_import_confirmed',
    actorId: null,
    actorName,
    resourceType: 'kim_attachment',
    resourceId: request.attachmentId,
    details: request.assignToClientId
      ? `Anhang importiert und Klient:in zugeordnet: ${request.assignToClientId}`
      : 'Anhang manuell importiert',
    ipAddress: null,
  });

  return { ok: true, data: { ...attachment } };
}

export async function fetchKIMAttachmentsForMessage(
  tenantId: string,
  messageId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<KIMAttachment[]>> {
  const denied = enforcePermission<KIMAttachment[]>(actorRoleKey, 'ti.kim.view');
  if (denied) return denied;

  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return { ok: false, error: tenantErr.error };

  if (getServiceMode() === 'supabase') {
    return kimAttachmentsSupabaseRepository.listForMessage(tenantId, messageId);
  }

  if (tenantId !== TI_DEMO_TENANT) return { ok: false, error: 'Mandant nicht gefunden.' };

  const attachments = demoKIMAttachments.filter((a) => a.messageId === messageId);
  return { ok: true, data: attachments };
}
