import type { TimeAuditLogEntry } from '@/types/modules/timeTracking';
import {
  appendAuditLog,
  getLastAuditHash,
  listAuditLogs,
  nextTimeTrackingId,
} from './timeTrackingStore';

function simpleHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return `h${Math.abs(hash).toString(16)}`;
}

export function writeTimeAuditLog(input: {
  tenantId: string;
  workdayId?: string | null;
  entityType: string;
  entityId: string;
  action: string;
  actorId: string | null;
  summary: string;
  metadata?: Record<string, string | number | boolean | null>;
}): TimeAuditLogEntry {
  const prevHash = getLastAuditHash(input.tenantId, input.workdayId);
  const createdAt = new Date().toISOString();
  const payload = JSON.stringify({
    tenantId: input.tenantId,
    workdayId: input.workdayId,
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    actorId: input.actorId,
    summary: input.summary,
    metadata: input.metadata ?? {},
    prevHash,
    createdAt,
  });
  const entry: TimeAuditLogEntry = {
    id: nextTimeTrackingId('audit'),
    tenantId: input.tenantId,
    workdayId: input.workdayId ?? null,
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    actorId: input.actorId,
    summary: input.summary,
    metadata: input.metadata ?? {},
    prevHash,
    entryHash: simpleHash(payload),
    createdAt,
  };
  appendAuditLog(entry);
  return entry;
}

export function listTimeAuditLogs(tenantId: string, workdayId?: string): TimeAuditLogEntry[] {
  return listAuditLogs(tenantId, workdayId);
}

/** Audit logs are append-only — corrections create new entries, never mutate history. */
export function verifyAuditChain(tenantId: string, workdayId?: string): boolean {
  const logs = listAuditLogs(tenantId, workdayId);
  let prev: string | null = null;
  for (const log of logs) {
    if (log.prevHash !== prev) return false;
    prev = log.entryHash;
  }
  return true;
}
