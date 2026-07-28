import type { RoleKey, ServiceResult } from '@/types';
import type { PermissionKey } from '@/types/permissions';
import { appendDomainMessage } from '@/data/demo/portalMessageStore';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { messagesSupabaseRepository } from '@/features/communication/repositories/messages.supabase';
import { threadsSupabaseRepository } from '@/features/communication/repositories/threads.supabase';
import { buildOfficeThreadPayload } from '@/lib/communication/officeComposeRouting';
import { validateOfficeComposeMessage } from '@/lib/communication/officeComposeValidation';
import { enforcePermission } from '@/lib/permissions';
import { getServiceMode } from '@/lib/services/mode';
import { runService } from '@/lib/services/serviceRunner';

export type DomainMessageInput = {
  wpNumber: number;
  domain: string;
  tenantId: string;
  actorRoleKey: RoleKey | null | undefined;
  permission: PermissionKey;
  audienceScope: 'office' | 'portal';
  subject: string;
  body: string;
  senderName?: string;
  recipientName?: string;
  requireRecipient?: boolean;
  recipientType?: string;
  recipientId?: string;
  recipientLabel?: string;
};

export type DomainMessageResult = {
  id: string;
  subject: string;
  body: string;
};

export async function sendDomainMessage(
  input: DomainMessageInput,
): Promise<ServiceResult<DomainMessageResult>> {
  const denied = enforcePermission<DomainMessageResult>(input.actorRoleKey, input.permission);
  if (denied) return denied;

  return runService(async () => {
    const subject = input.subject.trim();
    const body = input.body.trim();
    const validationError = validateOfficeComposeMessage({
      subject,
      body,
      requireRecipient: input.requireRecipient,
      recipientType: input.recipientType as
        | 'client'
        | 'employee'
        | 'team'
        | 'internal'
        | undefined,
      recipientId: input.recipientId,
    });
    if (validationError) {
      return { ok: false, error: validationError };
    }

    if (getServiceMode() === 'supabase') {
      const now = new Date().toISOString();
      const threadPayload = buildOfficeThreadPayload(
        {
          subject,
          audienceScope: input.audienceScope,
          recipientType: input.recipientType as
            | 'client'
            | 'employee'
            | 'team'
            | 'internal'
            | undefined,
          recipientId: input.recipientId,
          recipientLabel: input.recipientLabel,
          recipientName: input.recipientName,
        },
      );
      const threadResult = await threadsSupabaseRepository.create(input.tenantId, {
        ...threadPayload,
        previewText: body.slice(0, 120),
        lastMessageAt: now,
        lastMessageByDisplayName: input.senderName ?? 'CareSuite',
      });
      if (!threadResult.ok) return threadResult;

      const messageResult = await messagesSupabaseRepository.create(input.tenantId, {
        tenantId: input.tenantId,
        threadId: threadResult.data.id,
        senderType: 'business_user',
        senderUserId: null,
        senderPortalSessionId: null,
        senderDisplayName: input.senderName ?? 'CareSuite',
        contentType: 'text',
        bodyText: body,
        hasAttachments: false,
        hasVoice: false,
        emojiReactionsCount: 0,
        status: 'sent',
        isInternalNote: threadResult.data.isInternalOnly,
        isVisibleToBusiness: true,
        isVisibleToEmployee: threadResult.data.isPortalVisible && threadResult.data.threadType === 'employee',
        isVisibleToClient: threadResult.data.isPortalVisible && threadResult.data.threadType === 'client',
        isVisibleToRelative: threadResult.data.isPortalVisible && threadResult.data.threadType === 'relative',
        sentAt: now,
        deliveredAt: now,
        readAt: null,
        editedAt: null,
        editedBy: null,
        deletedAt: null,
        deletedBy: null,
        deleteReason: null,
        replyToMessageId: null,
      });
      if (!messageResult.ok) return messageResult;

      await threadsSupabaseRepository.update(input.tenantId, threadResult.data.id, {
        last_message_id: messageResult.data.id,
        last_message_at: now,
        last_message_by_display_name: input.senderName ?? 'CareSuite',
        preview_text: body.slice(0, 120),
      });

      return {
        ok: true,
        data: { id: messageResult.data.id, subject, body },
      };
    }

    if (input.tenantId !== DEMO_TENANT_ID) {
      return { ok: false, error: 'Mandant nicht gefunden.' };
    }

    await new Promise((r) => setTimeout(r, 180));

    const saved = appendDomainMessage({
      tenantId: input.tenantId,
      domain: input.domain,
      wpNumber: input.wpNumber,
      audienceScope: input.audienceScope,
      subject,
      body,
      senderName: input.senderName ?? 'CareSuite Demo',
      recipientName: input.recipientName ?? 'Empfänger',
    });

    return {
      ok: true,
      data: { id: saved.id, subject: saved.subject, body: saved.body },
    };
  });
}
