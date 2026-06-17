import type { ServiceResult } from '@/types';
import type { RoleKey } from '@/types';
import type { PermissionKey } from '@/types/permissions';
import type { OfficeRecipientType } from '@/types/office/officeCompose';
import { buildOfficeThreadPayload } from '@/lib/communication/officeComposeRouting';
import { appendDomainMessage } from '@/data/demo/portalMessageStore';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { messagesSupabaseRepository } from '@/features/communication/repositories/messages.supabase';
import { threadsSupabaseRepository } from '@/features/communication/repositories/threads.supabase';
import {
  OFFICE_COMPOSE_MIN_BODY_LENGTH,
  OFFICE_COMPOSE_MIN_SUBJECT_LENGTH,
  validateOfficeComposeMessage,
} from '@/lib/communication/officeComposeValidation';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { runService } from '@/lib/services/serviceRunner';
import { getSupabaseClient } from '@/lib/supabase/client';

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
  profileId?: string;
  requireRecipient?: boolean;
  recipientType?: OfficeRecipientType | null;
  recipientId?: string | null;
  recipientLabel?: string;
};

export type DomainMessageResult = {
  id: string;
  subject: string;
  body: string;
};

function resolveRecipientName(input: DomainMessageInput): string {
  if (input.recipientLabel?.trim()) return input.recipientLabel.trim();
  if (input.recipientName?.trim()) return input.recipientName.trim();
  return 'Empfänger';
}

async function persistLiveOfficeMessage(
  tenantId: string,
  input: DomainMessageInput,
): Promise<ServiceResult<DomainMessageResult>> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return {
      ok: false,
      error:
        'Nachrichtenversand erfordert eine Datenbankverbindung. Bitte Supabase konfigurieren oder den Administrator kontaktieren.',
    };
  }

  const subject = input.subject.trim();
  const body = input.body.trim();
  const senderName = input.senderName ?? 'CareSuite';
  const now = new Date().toISOString();

  const threadResult = await threadsSupabaseRepository.create(
    tenantId,
    buildOfficeThreadPayload(input, input.profileId),
  );
  if (!threadResult.ok) return threadResult;

  const thread = threadResult.data;
  const messageResult = await messagesSupabaseRepository.create(tenantId, {
    tenantId,
    threadId: thread.id,
    senderType: 'business_user',
    senderUserId: input.profileId ?? null,
    senderPortalSessionId: null,
    senderDisplayName: senderName,
    contentType: 'text',
    bodyText: body,
    hasAttachments: false,
    hasVoice: false,
    emojiReactionsCount: 0,
    status: 'sent',
    isInternalNote: false,
    isVisibleToBusiness: true,
    isVisibleToEmployee: thread.allowEmployeeReplies,
    isVisibleToClient: thread.allowClientReplies,
    isVisibleToRelative: thread.allowRelativeReplies,
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

  await threadsSupabaseRepository.update(tenantId, thread.id, {
    last_message_id: messageResult.data.id,
    last_message_at: now,
    last_message_by_display_name: senderName,
    preview_text: body.slice(0, 120),
    updated_at: now,
  });

  return {
    ok: true,
    data: {
      id: messageResult.data.id,
      subject,
      body,
    },
  };
}

export async function sendDomainMessage(
  input: DomainMessageInput,
): Promise<ServiceResult<DomainMessageResult>> {
  const denied = enforcePermission<DomainMessageResult>(input.actorRoleKey, input.permission);
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(input.tenantId);
  if (tenantBlock) return tenantBlock;

  return runService(async () => {
    if (getServiceMode() === 'demo' && input.tenantId !== DEMO_TENANT_ID) {
      return { ok: false, error: 'Mandant nicht gefunden.' };
    }

    const validationError = validateOfficeComposeMessage({
      subject: input.subject,
      body: input.body,
      requireRecipient: input.requireRecipient,
      recipientType: input.recipientType,
      recipientId: input.recipientId,
    });
    if (validationError) {
      return { ok: false, error: validationError };
    }

    const subject = input.subject.trim();
    const body = input.body.trim();

    if (subject.length < OFFICE_COMPOSE_MIN_SUBJECT_LENGTH) {
      return {
        ok: false,
        error: `Betreff muss mindestens ${OFFICE_COMPOSE_MIN_SUBJECT_LENGTH} Zeichen haben.`,
      };
    }
    if (body.length < OFFICE_COMPOSE_MIN_BODY_LENGTH) {
      return { ok: false, error: 'Nachricht darf nicht leer sein.' };
    }

    if (getServiceMode() === 'supabase') {
      return persistLiveOfficeMessage(input.tenantId, input);
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
      recipientName: resolveRecipientName(input),
    });

    return {
      ok: true,
      data: { id: saved.id, subject: saved.subject, body: saved.body },
    };
  });
}
