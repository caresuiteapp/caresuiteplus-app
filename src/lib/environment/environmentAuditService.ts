import type { EnvironmentAuditEvent, EnvironmentAuditEventType, EnvironmentMode } from '@/types/environment';

let auditCounter = 0;
const AUDIT_EVENTS: EnvironmentAuditEvent[] = [];

export function logEnvironmentAuditEvent(input: {
  tenantId?: string | null;
  eventType: EnvironmentAuditEventType;
  mode: EnvironmentMode;
  summary: string;
  metadata?: Record<string, string>;
}): EnvironmentAuditEvent {
  auditCounter += 1;
  const event: EnvironmentAuditEvent = {
    id: `env-audit-${auditCounter}`,
    tenantId: input.tenantId ?? null,
    eventType: input.eventType,
    mode: input.mode,
    summary: input.summary,
    metadata: input.metadata,
    createdAt: new Date().toISOString(),
  };
  AUDIT_EVENTS.push(event);
  return event;
}

export function getEnvironmentAuditTrail(tenantId?: string | null): EnvironmentAuditEvent[] {
  if (!tenantId) return [...AUDIT_EVENTS];
  return AUDIT_EVENTS.filter((event) => event.tenantId === tenantId);
}

export function resetEnvironmentAuditStore(): void {
  AUDIT_EVENTS.length = 0;
  auditCounter = 0;
}
