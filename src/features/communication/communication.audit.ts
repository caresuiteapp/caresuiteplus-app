import { appendDemoAudit, getDemoAuditEvents } from './communication.demoStore';
import type { CommunicationAuditAction, CommunicationAuditEvent } from './communication.types';

export type AppendAuditInput = {
  tenantId: string;
  userId?: string | null;
  portalSessionId?: string | null;
  action: CommunicationAuditAction;
  entityType: string;
  entityId: string;
  threadId?: string | null;
  messageId?: string | null;
  clientId?: string | null;
  employeeId?: string | null;
  result?: 'success' | 'blocked' | 'failed';
  metadata?: Record<string, unknown> | null;
};

export function appendCommunicationAudit(input: AppendAuditInput): CommunicationAuditEvent {
  const now = new Date().toISOString();
  const event: CommunicationAuditEvent = {
    id: `audit-comm-${Date.now()}`,
    tenantId: input.tenantId,
    userId: input.userId ?? null,
    portalSessionId: input.portalSessionId ?? null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    threadId: input.threadId ?? null,
    messageId: input.messageId ?? null,
    clientId: input.clientId ?? null,
    employeeId: input.employeeId ?? null,
    result: input.result ?? 'success',
    metadata: input.metadata ?? null,
    createdAt: now,
    updatedAt: now,
  };
  appendDemoAudit(event);
  return event;
}

export function listCommunicationAuditEvents(tenantId: string): CommunicationAuditEvent[] {
  return getDemoAuditEvents()
    .filter((e) => e.tenantId === tenantId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
