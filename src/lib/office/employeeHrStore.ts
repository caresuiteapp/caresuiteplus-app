import type { EmployeeHrAuditEvent, EmployeeHrCase, EmployeeHrCaseEvent } from '@/types/modules/employeeHr';

export type EmployeeHrStore = {
  cases: EmployeeHrCase[];
  caseEvents: EmployeeHrCaseEvent[];
  auditEvents: EmployeeHrAuditEvent[];
  numberSeq: Map<string, number>;
};

export const HR_STORE: EmployeeHrStore = {
  cases: [],
  caseEvents: [],
  auditEvents: [],
  numberSeq: new Map(),
};

let caseCounter = 0;
let caseEventCounter = 0;
let auditCounter = 0;

export function nextHrCaseId(): string {
  caseCounter += 1;
  return `hr-case-${caseCounter}`;
}

export function nextHrCaseEventId(): string {
  caseEventCounter += 1;
  return `hr-cevt-${caseEventCounter}`;
}

export function nextHrAuditId(): string {
  auditCounter += 1;
  return `hr-audit-${auditCounter}`;
}

export function filterHrByTenant<T extends { tenantId: string }>(items: T[], tenantId: string): T[] {
  return items.filter((item) => item.tenantId === tenantId);
}

export function getHrCaseById(tenantId: string, caseId: string): EmployeeHrCase | undefined {
  const item = HR_STORE.cases.find((c) => c.id === caseId);
  if (!item || item.tenantId !== tenantId) return undefined;
  return item;
}

export function listHrCasesForTenant(
  tenantId: string,
  filter?: { employeeId?: string; areaKey?: EmployeeHrCase['areaKey']; status?: EmployeeHrCase['status'] },
): EmployeeHrCase[] {
  let items = filterHrByTenant(HR_STORE.cases, tenantId);
  if (filter?.employeeId) items = items.filter((c) => c.employeeId === filter.employeeId);
  if (filter?.areaKey) items = items.filter((c) => c.areaKey === filter.areaKey);
  if (filter?.status) items = items.filter((c) => c.status === filter.status);
  return items;
}

export function resetEmployeeHrStore(): void {
  HR_STORE.cases.length = 0;
  HR_STORE.caseEvents.length = 0;
  HR_STORE.auditEvents.length = 0;
  HR_STORE.numberSeq.clear();
  caseCounter = 0;
  caseEventCounter = 0;
  auditCounter = 0;
}
