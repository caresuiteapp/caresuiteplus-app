import type { ConnectAuditEntryDraft, ConnectExecutionContext } from '@/types/connect/gateway';
import type { ConnectAdapterResult } from '@/types/connect/gateway';

const preparedAuditLog: ConnectAuditEntryDraft[] = [];

/** In-Memory-Vorbereitung — persistiert später via connect_audit_events / Edge Function. */
export function recordConnectAuditDraft(entry: ConnectAuditEntryDraft): ConnectAuditEntryDraft {
  preparedAuditLog.push(entry);
  return entry;
}

export function getPreparedConnectAuditLog(): readonly ConnectAuditEntryDraft[] {
  return preparedAuditLog;
}

export function clearPreparedConnectAuditLog(): void {
  preparedAuditLog.length = 0;
}

export function buildConnectAuditDraft(
  context: ConnectExecutionContext,
  action: string,
  result: ConnectAdapterResult,
  entityType = 'connect_action',
  entityId: string | null = null,
): ConnectAuditEntryDraft {
  return {
    tenantId: context.tenantId,
    integrationId: context.integrationId,
    providerKey: context.providerKey,
    actorUserId: context.userId,
    action,
    entityType,
    entityId,
    summary: result.message,
    blocked: Boolean(result.blocked),
    demo: Boolean(result.demo),
  };
}
