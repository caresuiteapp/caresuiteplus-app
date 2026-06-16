import type {
  AbsenceAuditEvent,
  AbsenceStatus,
  AbsenceType,
  EmployeeAbsence,
  EmployeeAbsenceRequest,
  EmployeeAvailability,
  EmployeeAvailabilityRule,
  ReplacementRequest,
  VacationBalance,
  VacationEntitlement,
} from '@/types/modules/employeeAbsence';

export type PlanningAbsenceBlock = {
  employeeId: string;
  startsAt: string;
  endsAt: string;
  absenceType: AbsenceType;
  absenceId: string;
};

export type AbsenceStoreState = {
  absences: EmployeeAbsence[];
  requests: EmployeeAbsenceRequest[];
  availability: EmployeeAvailability[];
  availabilityRules: EmployeeAvailabilityRule[];
  replacementRequests: ReplacementRequest[];
  auditEvents: AbsenceAuditEvent[];
  entitlements: VacationEntitlement[];
  balances: VacationBalance[];
};

export const ABSENCE_STORE: AbsenceStoreState = {
  absences: [],
  requests: [],
  availability: [],
  availabilityRules: [],
  replacementRequests: [],
  auditEvents: [],
  entitlements: [],
  balances: [],
};

const PLANNING_BLOCK_STATUSES: ReadonlySet<AbsenceStatus> = new Set([
  'approved',
  'active',
  'requires_review',
]);

const PLANNING_BLOCK_TYPES: ReadonlySet<AbsenceType> = new Set([
  'vacation',
  'sick_leave',
  'child_sick_leave',
  'unpaid_leave',
  'training',
  'public_holiday',
  'blocked_time',
  'appointment',
  'no_availability',
  'suspension',
  'other',
]);

let absenceCounter = 0;
let requestCounter = 0;
let availabilityCounter = 0;
let ruleCounter = 0;
let replacementCounter = 0;
let auditCounter = 0;
let entitlementCounter = 0;
let balanceCounter = 0;

export function nextAbsenceId(): string {
  absenceCounter += 1;
  return `abs-${absenceCounter}`;
}

export function nextAbsenceRequestId(): string {
  requestCounter += 1;
  return `abs-req-${requestCounter}`;
}

export function nextAvailabilityId(): string {
  availabilityCounter += 1;
  return `avail-${availabilityCounter}`;
}

export function nextAvailabilityRuleId(): string {
  ruleCounter += 1;
  return `avail-rule-${ruleCounter}`;
}

export function nextReplacementRequestId(): string {
  replacementCounter += 1;
  return `repl-${replacementCounter}`;
}

export function nextAbsenceAuditId(): string {
  auditCounter += 1;
  return `abs-audit-${auditCounter}`;
}

export function nextEntitlementId(): string {
  entitlementCounter += 1;
  return `vac-ent-${entitlementCounter}`;
}

export function nextBalanceId(): string {
  balanceCounter += 1;
  return `vac-bal-${balanceCounter}`;
}

export function filterByTenant<T extends { tenantId: string }>(items: T[], tenantId: string): T[] {
  if (!tenantId?.trim()) return [];
  return items.filter((item) => item.tenantId === tenantId);
}

export function getAbsenceById(tenantId: string, absenceId: string): EmployeeAbsence | undefined {
  const record = ABSENCE_STORE.absences.find((a) => a.id === absenceId);
  if (!record || record.tenantId !== tenantId) return undefined;
  return record;
}

export function listAbsencesForTenant(tenantId: string, employeeId?: string): EmployeeAbsence[] {
  return filterByTenant(ABSENCE_STORE.absences, tenantId).filter(
    (a) => !employeeId || a.employeeId === employeeId,
  );
}

/** Aktive Abwesenheitsblöcke für Einsatzplanungs-Konfliktprüfung */
export function getPlanningBlockAbsences(tenantId: string): PlanningAbsenceBlock[] {
  return filterByTenant(ABSENCE_STORE.absences, tenantId)
    .filter((a) => PLANNING_BLOCK_STATUSES.has(a.status) && PLANNING_BLOCK_TYPES.has(a.absenceType))
    .map((a) => ({
      employeeId: a.employeeId,
      startsAt: a.startsAt,
      endsAt: a.endsAt,
      absenceType: a.absenceType,
      absenceId: a.id,
    }));
}

export function getEmployeeAvailabilityBlocks(
  tenantId: string,
): Array<{ employeeId: string; startsAt: string; endsAt: string }> {
  return filterByTenant(ABSENCE_STORE.availability, tenantId).map((slot) => ({
    employeeId: slot.employeeId,
    startsAt: slot.startsAt,
    endsAt: slot.endsAt,
  }));
}

export function resetAbsenceStore(): void {
  ABSENCE_STORE.absences.length = 0;
  ABSENCE_STORE.requests.length = 0;
  ABSENCE_STORE.availability.length = 0;
  ABSENCE_STORE.availabilityRules.length = 0;
  ABSENCE_STORE.replacementRequests.length = 0;
  ABSENCE_STORE.auditEvents.length = 0;
  ABSENCE_STORE.entitlements.length = 0;
  ABSENCE_STORE.balances.length = 0;
  absenceCounter = 0;
  requestCounter = 0;
  availabilityCounter = 0;
  ruleCounter = 0;
  replacementCounter = 0;
  auditCounter = 0;
  entitlementCounter = 0;
  balanceCounter = 0;
}
