import type { RoleKey } from '@/types/core/auth';
import type { PersonalComplianceAuditEvent } from '@/types/modules/personalComplianceCockpit';

const auditStore: PersonalComplianceAuditEvent[] = [];
let auditCounter = 0;

export function resetPersonalComplianceAuditStore(): void {
  auditStore.length = 0;
  auditCounter = 0;
}

export function appendPersonalComplianceAuditEvent(
  input: Omit<PersonalComplianceAuditEvent, 'id' | 'createdAt'>,
): PersonalComplianceAuditEvent {
  auditCounter += 1;
  const event: PersonalComplianceAuditEvent = {
    ...input,
    id: `pc-audit-${auditCounter}`,
    createdAt: new Date().toISOString(),
  };
  auditStore.unshift(event);
  return event;
}

export function listPersonalComplianceAuditEvents(
  tenantId: string,
  employeeId?: string,
): PersonalComplianceAuditEvent[] {
  return auditStore.filter(
    (e) => e.tenantId === tenantId && (!employeeId || e.employeeId === employeeId),
  );
}

export function auditPersonalComplianceView(input: {
  tenantId: string;
  actorId: string | null;
  actorRole: RoleKey | null;
  kpiCount: number;
  riskCount: number;
}): PersonalComplianceAuditEvent {
  return appendPersonalComplianceAuditEvent({
    tenantId: input.tenantId,
    action: 'cockpit_viewed',
    employeeId: null,
    actorId: input.actorId,
    actorRole: input.actorRole,
    summary: `Personal-Compliance-Cockpit geöffnet (${input.kpiCount} KPIs, ${input.riskCount} Risiken).`,
  });
}

export function auditPersonalComplianceTaskCreated(input: {
  tenantId: string;
  employeeId: string;
  taskId: string;
  actorId: string | null;
  actorRole: RoleKey | null;
  title: string;
}): PersonalComplianceAuditEvent {
  return appendPersonalComplianceAuditEvent({
    tenantId: input.tenantId,
    action: 'personnel_task_created',
    employeeId: input.employeeId,
    actorId: input.actorId,
    actorRole: input.actorRole,
    summary: `Personalaufgabe erstellt: ${input.title}`,
    metadata: { taskId: input.taskId },
  });
}
