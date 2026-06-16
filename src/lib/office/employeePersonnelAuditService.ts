import type { RoleKey } from '@/types/core/auth';
import type { EmployeeAuditEvent, EmployeeMasterData } from '@/types/modules/employeePersonnelFile';

const auditStore = new Map<string, EmployeeAuditEvent[]>();
let auditCounter = 0;

export function resetEmployeePersonnelAuditStore(): void {
  auditStore.clear();
  auditCounter = 0;
}

export function appendEmployeeAuditEvent(
  input: Omit<EmployeeAuditEvent, 'id' | 'createdAt' | 'updatedAt'>,
): EmployeeAuditEvent {
  auditCounter += 1;
  const event: EmployeeAuditEvent = {
    ...input,
    id: `emp-audit-${auditCounter}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const list = auditStore.get(input.employeeId) ?? [];
  list.unshift(event);
  auditStore.set(input.employeeId, list);
  return event;
}

export function getEmployeeAuditEvents(employeeId: string): EmployeeAuditEvent[] {
  return auditStore.get(employeeId) ?? [];
}

export function buildMasterDataAuditDiff(
  before: EmployeeMasterData,
  after: EmployeeMasterData,
): Record<string, { before: string | null; after: string | null }> {
  const changes: Record<string, { before: string | null; after: string | null }> = {};
  const keys = Object.keys(after) as (keyof EmployeeMasterData)[];

  for (const key of keys) {
    const prev = before[key];
    const next = after[key];
    const prevStr = prev == null ? null : String(prev);
    const nextStr = next == null ? null : String(next);
    if (prevStr !== nextStr) {
      changes[key] = { before: prevStr, after: nextStr };
    }
  }

  return changes;
}

export function auditEmployeeMasterDataChange(input: {
  tenantId: string;
  employeeId: string;
  actorId: string | null;
  actorRole: RoleKey | null;
  before: EmployeeMasterData;
  after: EmployeeMasterData;
}): EmployeeAuditEvent | null {
  const fieldChanges = buildMasterDataAuditDiff(input.before, input.after);
  if (Object.keys(fieldChanges).length === 0) return null;

  return appendEmployeeAuditEvent({
    tenantId: input.tenantId,
    employeeId: input.employeeId,
    action: 'master_data_updated',
    actorId: input.actorId,
    actorRole: input.actorRole,
    summary: `Stammdaten geändert (${Object.keys(fieldChanges).join(', ')}).`,
    fieldChanges,
  });
}
