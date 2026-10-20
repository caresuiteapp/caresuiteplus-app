import type { EmployeeOffboardingSession } from '@/types/modules/employeeOffboarding';
import type { EmployeeAbsence } from '@/types/modules/employeeAbsence';
import {
  DEMO_OFFBOARDING_SESSIONS,
  DEMO_PERSONNEL_ABSENCES,
} from '@/data/demo/personalComplianceCockpit';

export type PersonalComplianceStoreState = {
  offboardingSessions: EmployeeOffboardingSession[];
  seededAbsences: EmployeeAbsence[];
};

export const PERSONAL_COMPLIANCE_STORE: PersonalComplianceStoreState = {
  offboardingSessions: [],
  seededAbsences: [],
};

export function filterByTenant<T extends { tenantId: string }>(items: T[], tenantId: string): T[] {
  if (!tenantId?.trim()) return [];
  return items.filter((item) => item.tenantId === tenantId);
}

export function listOffboardingSessionsForTenant(tenantId: string): EmployeeOffboardingSession[] {
  return filterByTenant(PERSONAL_COMPLIANCE_STORE.offboardingSessions, tenantId).filter(
    (s) => s.overallStatus !== 'completed',
  );
}

export function listPersonnelAbsencesForTenant(tenantId: string): EmployeeAbsence[] {
  return filterByTenant(PERSONAL_COMPLIANCE_STORE.seededAbsences, tenantId);
}

export function seedPersonalComplianceDemoStore(): void {
  PERSONAL_COMPLIANCE_STORE.offboardingSessions = DEMO_OFFBOARDING_SESSIONS.map((s) => ({ ...s }));
  PERSONAL_COMPLIANCE_STORE.seededAbsences = DEMO_PERSONNEL_ABSENCES.map((a) => ({ ...a }));
}

export function resetPersonalComplianceStore(): void {
  PERSONAL_COMPLIANCE_STORE.offboardingSessions = [];
  PERSONAL_COMPLIANCE_STORE.seededAbsences = [];
}
