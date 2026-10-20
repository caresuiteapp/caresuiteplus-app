import type { RoleKey, ServiceResult } from '@/types';
import type {
  ClientMessageRecipient,
  ClientMessageStatus,
  ClientMessageType,
  ClientPortalAuditEvent,
  ClientPortalContext,
  ClientPortalMessage,
} from '@/types/portal/clientPortalDomain';
import {
  buildWorkspaceAccessContext,
  canAccessClientPortal,
  canDirectEmployeeClientChat,
} from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { enforcePermission } from '@/lib/permissions';

const MESSAGES = new Map<string, ClientPortalMessage>();
const AUDIT_EVENTS: ClientPortalAuditEvent[] = [];
let messageCounter = 0;
let auditCounter = 0;

function nowIso(): string {
  return new Date().toISOString();
}

function audit(input: Omit<ClientPortalAuditEvent, 'id' | 'createdAt'>): ClientPortalAuditEvent {
  auditCounter += 1;
  const event: ClientPortalAuditEvent = {
    id: `cp-audit-${auditCounter}`,
    createdAt: nowIso(),
    ...input,
  };
  AUDIT_EVENTS.push(event);
  return event;
}

function assertPortalContext(ctx: ClientPortalContext): ServiceResult<never> | null {
  const access = canAccessClientPortal(
    buildWorkspaceAccessContext({
      userId: ctx.profileId,
      tenantId: ctx.tenantId,
      roleKey: ctx.roleKey,
      clientId: ctx.clientId,
      profileId: ctx.profileId,
      sharedClientIds: ctx.sharedClientIds,
    }),
  );
  if (!access.allowed) {
    return { ok: false, error: access.message ?? 'Kein Portalzugriff.' };
  }
  return null;
}

export async function sendClientPortalMessage(input: {
  ctx: ClientPortalContext;
  recipient: ClientMessageRecipient;
  messageType: ClientMessageType;
  subject: string;
  body: string;
  assignmentId?: string | null;
  status?: ClientMessageStatus;
}): Promise<ServiceResult<ClientPortalMessage>> {
  const denied = enforcePermission<ClientPortalMessage>(input.ctx.roleKey, 'portal.client.messages.reply');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(input.ctx.tenantId);
  if (tenantBlock) return tenantBlock;

  const portalBlock = assertPortalContext(input.ctx);
  if (portalBlock) return portalBlock;

  const employeeChat = canDirectEmployeeClientChat(
    buildWorkspaceAccessContext({
      userId: input.ctx.profileId,
      tenantId: input.ctx.tenantId,
      roleKey: input.ctx.roleKey,
    }),
  );
  if (employeeChat.allowed) {
    return { ok: false, error: 'Direkte Mitarbeiter-Kommunikation ist nicht freigegeben.' };
  }

  if (!input.body.trim()) {
    return { ok: false, error: 'Nachricht darf nicht leer sein.' };
  }

  messageCounter += 1;
  const threadId = `thread-${input.ctx.clientId}-${input.recipient}`;
  const message: ClientPortalMessage = {
    id: `cp-msg-${messageCounter}`,
    tenantId: input.ctx.tenantId,
    clientId: input.ctx.clientId,
    threadId,
    recipient: input.recipient,
    messageType: input.messageType,
    status: input.status ?? 'sent',
    subject: input.subject.trim(),
    body: input.body.trim(),
    sentByProfileId: input.ctx.profileId,
    assignmentId: input.assignmentId ?? null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  MESSAGES.set(message.id, message);

  audit({
    tenantId: input.ctx.tenantId,
    clientId: input.ctx.clientId,
    action: 'client_message_sent',
    actorProfileId: input.ctx.profileId,
    summary: `Nachricht an ${input.recipient} gesendet (${input.messageType}).`,
    metadata: { messageId: message.id, recipient: input.recipient },
  });

  return { ok: true, data: message };
}

export function listClientPortalMessages(ctx: ClientPortalContext): ClientPortalMessage[] {
  return [...MESSAGES.values()].filter(
    (m) =>
      m.tenantId === ctx.tenantId &&
      (m.clientId === ctx.clientId || ctx.sharedClientIds.includes(m.clientId)),
  );
}

export function countOpenClientPortalMessages(ctx: ClientPortalContext): number {
  return listClientPortalMessages(ctx).filter(
    (m) => m.status === 'sent' || m.status === 'received' || m.status === 'read',
  ).length;
}

export function getClientPortalAuditTrail(tenantId: string, clientId?: string): ClientPortalAuditEvent[] {
  return AUDIT_EVENTS.filter(
    (e) => e.tenantId === tenantId && (!clientId || e.clientId === clientId),
  );
}

export function resetClientMessagePortalStore(): void {
  MESSAGES.clear();
  AUDIT_EVENTS.length = 0;
  messageCounter = 0;
  auditCounter = 0;
}

export function resolvePortalRole(roleKey: RoleKey): ClientPortalContext['portalRole'] {
  if (roleKey === 'client_portal') return 'client';
  return 'family_contact';
}

export function buildClientPortalContext(input: {
  tenantId: string;
  profileId: string;
  roleKey: RoleKey;
  clientId?: string | null;
  sharedClientIds?: string[];
  portalRole?: ClientPortalContext['portalRole'];
}): ClientPortalContext | null {
  if (!input.clientId?.trim()) return null;
  return {
    tenantId: input.tenantId,
    clientId: input.clientId,
    profileId: input.profileId,
    roleKey: input.roleKey,
    portalRole: input.portalRole ?? resolvePortalRole(input.roleKey),
    sharedClientIds: input.sharedClientIds ?? [],
  };
}
