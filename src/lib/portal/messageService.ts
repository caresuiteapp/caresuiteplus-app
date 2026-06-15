import type { RoleKey, ServiceResult } from '@/types';
import type { MessageDetail, MessageListItem } from '@/types/portal/communication';
import type { PortalScope } from '@/types/portal';
import {
  getMutablePortalMessages,
  markDemoPortalMessageRead,
  replyToDemoPortalMessage,
  replyToDemoOfficeMessage,
} from '@/data/demo/portalMessageStore';
import { demoPortalMessages } from '@/data/demo/messages';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { runService } from '@/lib/services/serviceRunner';
import { filterPortalEntities, resolvePortalScope } from './portalVisibility';

const SIMULATED_DELAY_MS = 350;

function isClientPortalRole(roleKey: RoleKey | null): boolean {
  return roleKey === 'client_portal' || roleKey === 'family_portal';
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type MessageSeed = (typeof demoPortalMessages)[number];

function mapMessageListItem(msg: MessageSeed): MessageListItem {
  return {
    id: msg.id,
    subject: msg.subject,
    body: msg.body,
    senderName: msg.senderName,
    recipientName: msg.recipientName,
    direction: msg.direction,
    readAt: msg.readAt,
    status: msg.status,
    updatedAt: msg.updatedAt,
    visibility: msg.visibility,
    sensitivity: msg.sensitivity,
  };
}

export async function fetchPortalMessages(
  profileId: string,
  roleKey: RoleKey | null,
  options?: { simulateError?: boolean; simulateEmpty?: boolean },
): Promise<ServiceResult<MessageListItem[]>> {
  return runService(async () => {
    await delay(SIMULATED_DELAY_MS);

    if (options?.simulateError) {
      return {
        ok: false,
        error: 'Nachrichten konnten nicht geladen werden. Bitte erneut versuchen.',
      };
    }

    if (!profileId || !roleKey) {
      return { ok: false, error: 'Kein Profil für Nachrichtenabruf vorhanden.' };
    }

    if (options?.simulateEmpty) {
      return { ok: true, data: [] };
    }

    const employeeDenied = enforcePermission<MessageListItem[]>(
      roleKey,
      'portal.employee.messages.view',
    );
    if (employeeDenied && roleKey === 'employee_portal') return employeeDenied;

    const clientDenied = enforcePermission<MessageListItem[]>(
      roleKey,
      'portal.client.messages.view',
    );
    if (clientDenied && isClientPortalRole(roleKey)) return clientDenied;

    const scope: PortalScope = resolvePortalScope(roleKey);
    const portalMessages = getMutablePortalMessages().filter((msg) => msg.audienceScope === 'portal');
    const visible = filterPortalEntities(portalMessages, profileId, scope);

    return { ok: true, data: visible.map(mapMessageListItem) };
  });
}

export async function fetchPortalMessageDetail(
  messageId: string,
  profileId: string,
  roleKey: RoleKey | null,
): Promise<ServiceResult<MessageDetail>> {
  const employeeDenied = enforcePermission<MessageDetail>(
    roleKey,
    'portal.employee.messages.view',
  );
  if (employeeDenied && roleKey === 'employee_portal') return employeeDenied;

  const clientDenied = enforcePermission<MessageDetail>(roleKey, 'portal.client.messages.view');
  if (clientDenied && isClientPortalRole(roleKey)) return clientDenied;

  return runService(async () => {
    await delay(SIMULATED_DELAY_MS);

    if (!profileId || !roleKey) {
      return { ok: false, error: 'Kein Profil für Nachrichtenabruf vorhanden.' };
    }

    const scope = resolvePortalScope(roleKey);
    const portalMessages = getMutablePortalMessages().filter((msg) => msg.audienceScope === 'portal');
    const visible = filterPortalEntities(portalMessages, profileId, scope);
    const msg = visible.find((m) => m.id === messageId);

    if (!msg) {
      return { ok: false, error: 'Nachricht nicht gefunden oder nicht freigegeben.' };
    }

    if (!msg.readAt) {
      markDemoPortalMessageRead(messageId);
    }

    const updated = getMutablePortalMessages().find((m) => m.id === messageId) ?? msg;

    return {
      ok: true,
      data: {
        ...mapMessageListItem(updated),
        channel: updated.channel,
        createdAt: updated.createdAt,
        canReply:
          roleKey === 'employee_portal' ||
          scope === 'portal_employee' ||
          isClientPortalRole(roleKey),
      },
    };
  });
}

export async function replyToPortalMessage(
  messageId: string,
  profileId: string,
  roleKey: RoleKey | null,
  replyBody: string,
): Promise<ServiceResult<MessageDetail>> {
  if (roleKey === 'employee_portal') {
    const denied = enforcePermission<MessageDetail>(roleKey, 'portal.employee.messages.reply');
    if (denied) return denied;
  } else if (isClientPortalRole(roleKey)) {
    const denied = enforcePermission<MessageDetail>(roleKey, 'portal.client.messages.reply');
    if (denied) return denied;
  } else {
    return { ok: false, error: 'Keine Berechtigung zum Antworten.' };
  }

  return runService(async () => {
    await delay(SIMULATED_DELAY_MS);

    if (!replyBody.trim()) {
      return { ok: false, error: 'Bitte geben Sie eine Antwort ein.' };
    }

    const scope = resolvePortalScope(roleKey);
    const portalMessages = getMutablePortalMessages().filter((msg) => msg.audienceScope === 'portal');
    const visible = filterPortalEntities(portalMessages, profileId, scope);
    const msg = visible.find((m) => m.id === messageId);

    if (!msg) {
      return { ok: false, error: 'Nachricht nicht gefunden.' };
    }

    const reply = replyToDemoPortalMessage(messageId, replyBody);
    if (!reply) {
      return { ok: false, error: 'Antwort konnte nicht gesendet werden.' };
    }

    return {
      ok: true,
      data: {
        ...mapMessageListItem(reply),
        channel: reply.channel,
        createdAt: reply.createdAt,
        canReply: false,
      },
    };
  });
}

export async function fetchOfficeMessages(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
  options?: { simulateError?: boolean; simulateEmpty?: boolean },
): Promise<ServiceResult<MessageListItem[]>> {
  const denied = enforcePermission<MessageListItem[]>(actorRoleKey, 'office.messages.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  return runService(async () => {
    await delay(SIMULATED_DELAY_MS);

    if (options?.simulateError) {
      return {
        ok: false,
        error: 'Office-Nachrichten konnten nicht geladen werden. Bitte erneut versuchen.',
      };
    }

    if (options?.simulateEmpty) {
      return { ok: true, data: [] };
    }

    const data = getMutablePortalMessages()
      .filter((msg) => msg.audienceScope === 'office')
      .map(mapMessageListItem);

    return { ok: true, data };
  });
}

export async function replyToOfficeMessage(
  messageId: string,
  tenantId: string,
  actorRoleKey: RoleKey | null | undefined,
  replyBody: string,
  senderName?: string,
): Promise<ServiceResult<MessageDetail>> {
  const denied = enforcePermission<MessageDetail>(actorRoleKey, 'office.access');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  return runService(async () => {
    await delay(SIMULATED_DELAY_MS);

    if (!replyBody.trim()) {
      return { ok: false, error: 'Bitte geben Sie eine Antwort ein.' };
    }
    if (replyBody.trim().length < 10) {
      return { ok: false, error: 'Antwort muss mindestens 10 Zeichen haben.' };
    }

    const msg = getMutablePortalMessages().find(
      (m) => m.id === messageId && m.audienceScope === 'office',
    );

    if (!msg) {
      return { ok: false, error: 'Nachricht nicht gefunden.' };
    }

    const reply = replyToDemoOfficeMessage(
      messageId,
      replyBody,
      senderName ?? 'Office CareSuite',
    );
    if (!reply) {
      return { ok: false, error: 'Antwort konnte nicht gesendet werden.' };
    }

    return {
      ok: true,
      data: {
        ...mapMessageListItem(reply),
        channel: reply.channel,
        createdAt: reply.createdAt,
        canReply: true,
      },
    };
  });
}

export async function fetchOfficeMessageDetail(
  messageId: string,
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<MessageDetail>> {
  const denied = enforcePermission<MessageDetail>(actorRoleKey, 'office.messages.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  return runService(async () => {
    await delay(SIMULATED_DELAY_MS);

    const msg = getMutablePortalMessages().find(
      (m) => m.id === messageId && m.audienceScope === 'office',
    );

    if (!msg) {
      return { ok: false, error: 'Nachricht nicht gefunden.' };
    }

    if (!msg.readAt) {
      markDemoPortalMessageRead(messageId);
    }

    const updated = getMutablePortalMessages().find((m) => m.id === messageId) ?? msg;

    return {
      ok: true,
      data: {
        ...mapMessageListItem(updated),
        channel: updated.channel,
        createdAt: updated.createdAt,
        canReply: true,
      },
    };
  });
}

export async function fetchUnreadMessageCount(
  profileId: string,
  roleKey: RoleKey | null,
): Promise<ServiceResult<number>> {
  const result = await fetchPortalMessages(profileId, roleKey);
  if (!result.ok) return result;
  const count = result.data.filter((m) => !m.readAt).length;
  return { ok: true, data: count };
}

export { DEMO_TENANT_ID };
