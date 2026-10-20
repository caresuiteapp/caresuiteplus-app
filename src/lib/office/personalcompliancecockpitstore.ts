import type { EmployeeAbsence } from '@/types/modules/employeeAbsence';
import type { EmployeeOffboardingSession } from '@/types/modules/employeeOffboarding';
import type { PersonalComplianceAuditEvent } from '@/types/modules/personalComplianceCockpit';
import type { EmployeeTrainingRecord } from '@/types/modules/training';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';

export type InventoryAssignmentRecord = {
  id: string;
  tenantId: string;
  employeeId: string;
  itemName: string;
  category: 'uniform' | 'equipment' | 'keys' | 'other';
  status: 'issued' | 'return_pending' | 'returned' | 'lost' | 'damaged';
  issuedAt: string | null;
  returnDueAt: string | null;
  updatedAt: string;
};

export type PersonalComplianceStoreState = {
  trainingRecords: EmployeeTrainingRecord[];
  offboardingSessions: EmployeeOffboardingSession[];
  inventoryAssignments: InventoryAssignmentRecord[];
  absences: EmployeeAbsence[];
  auditEvents: PersonalComplianceAuditEvent[];
};

export const PERSONAL_COMPLIANCE_STORE: PersonalComplianceStoreState = {
  trainingRecords: [],
  offboardingSessions: [],
  inventoryAssignments: [],
  absences: [],
  auditEvents: [],
};

let trainingCounter = 0;
let offboardingCounter = 0;
let inventoryCounter = 0;
let absenceCounter = 0;
let auditCounter = 0;

export function nextPersonalComplianceAuditId(): string {
  auditCounter += 1;
  return `pc-audit-${auditCounter}`;
}

export function filterPersonalComplianceByTenant<T extends { tenantId: string }>(
  items: T[],
  tenantId: string,
): T[] {
  return items.filter((item) => item.tenantId === tenantId);
}

export function appendPersonalComplianceAuditEvent(
  event: Omit<PersonalComplianceAuditEvent, 'id' | 'createdAt'>,
): PersonalComplianceAuditEvent {
  const full: PersonalComplianceAuditEvent = {
    id: nextPersonalComplianceAuditId(),
    createdAt: new Date().toISOString(),
    ...event,
  };
  PERSONAL_COMPLIANCE_STORE.auditEvents.push(full);
  return full;
}

export function listPersonalComplianceAuditEvents(
  tenantId: string,
  employeeId?: string,
): PersonalComplianceAuditEvent[] {
  if (!tenantId?.trim()) return [];
  return filterPersonalComplianceByTenant(PERSONAL_COMPLIANCE_STORE.auditEvents, tenantId).filter(
    (e) => !employeeId || e.employeeId === employeeId,
  );
}

function seedDemoPersonalComplianceData(): void {
  if (PERSONAL_COMPLIANCE_STORE.trainingRecords.length > 0) return;

  const now = '2026-06-16T12:00:00.000Z';

  const mandatoryCourses = [
    { courseId: 'course-datenschutz', employeeId: 'employee-001' },
    { courseId: 'course-schweigepflicht', employeeId: 'employee-001' },
    { courseId: 'course-datenschutz', employeeId: 'employee-002' },
    { courseId: 'course-schweigepflicht', employeeId: 'employee-002' },
    { courseId: 'course-datenschutz', employeeId: 'employee-003' },
  ];

  for (const entry of mandatoryCourses) {
    trainingCounter += 1;
    const completed = entry.employeeId !== 'employee-003';
    PERSONAL_COMPLIANCE_STORE.trainingRecords.push({
      id: `tr-${trainingCounter}`,
      tenantId: DEMO_TENANT_ID,
      employeeId: entry.employeeId,
      courseId: entry.courseId,
      status: completed ? 'passed' : 'required',
      assignedAt: '2025-01-01T09:00:00.000Z',
      startedAt: completed ? '2025-01-02T09:00:00.000Z' : null,
      completedAt: completed ? '2025-01-02T10:00:00.000Z' : null,
      passedAt: completed ? '2025-01-02T10:00:00.000Z' : null,
      validUntil: completed ? '2027-01-02' : null,
      proofDocumentId: completed ? `doc-tr-${trainingCounter}` : null,
      verifiedBy: completed ? 'HR Admin' : null,
      verifiedAt: completed ? '2025-01-03T09:00:00.000Z' : null,
      waivedBy: null,
      waivedReason: null,
      progressPercent: completed ? 100 : 0,
      scorePercent: completed ? 100 : null,
      absenceId: null,
      academyEnrollmentId: null,
      rejectionReason: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  offboardingCounter += 1;
  PERSONAL_COMPLIANCE_STORE.offboardingSessions.push({
    id: `off-${offboardingCounter}`,
    tenantId: DEMO_TENANT_ID,
    employeeId: 'employee-006',
    overallStatus: 'in_progress',
    currentStepKey: 'inventory_return',
    exitDate: '2026-05-01',
    terminationType: 'voluntary',
    internalReason: 'Standortwechsel',
    responsibleUserId: 'demo-user',
    startedAt: '2026-05-02T08:00:00.000Z',
    completedAt: null,
    lastSavedAt: now,
    createdAt: now,
    updatedAt: now,
  });

  inventoryCounter += 1;
  PERSONAL_COMPLIANCE_STORE.inventoryAssignments.push({
    id: `inv-${inventoryCounter}`,
    tenantId: DEMO_TENANT_ID,
    employeeId: 'employee-006',
    itemName: 'Dienstkleidung Set',
    category: 'uniform',
    status: 'return_pending',
    issuedAt: '2024-06-01',
    returnDueAt: '2026-05-15',
    updatedAt: now,
  });

  absenceCounter += 1;
  PERSONAL_COMPLIANCE_STORE.absences.push({
    id: `abs-pc-${absenceCounter}`,
    tenantId: DEMO_TENANT_ID,
    employeeId: 'employee-002',
    absenceType: 'sick_leave',
    status: 'active',
    startsAt: '2026-06-14T00:00:00.000Z',
    endsAt: '2026-06-20T23:59:59.000Z',
    requestedDays: 5,
    replacementRequired: true,
    internalNotes: 'AU eingereicht',
    employeeVisibleNote: '',
    sickDetails: null,
    auDocumentId: null,
    certificateDocumentId: null,
    hideDetailsFromAdmin: false,
    allDay: true,
    rejectedBy: null,
    rejectedAt: null,
    rejectionReason: null,
    cancelledAt: null,
    qualificationUpdated: false,
    updatedBy: null,
    createdBy: 'employee-002',
    approvedBy: 'demo-user',
    approvedAt: '2026-06-14T07:00:00.000Z',
    createdAt: '2026-06-14T06:30:00.000Z',
    updatedAt: now,
  });
}

export function ensurePersonalComplianceDemoSeed(): void {
  seedDemoPersonalComplianceData();
}

export function resetPersonalComplianceStore(): void {
  PERSONAL_COMPLIANCE_STORE.trainingRecords.length = 0;
  PERSONAL_COMPLIANCE_STORE.offboardingSessions.length = 0;
  PERSONAL_COMPLIANCE_STORE.inventoryAssignments.length = 0;
  PERSONAL_COMPLIANCE_STORE.absences.length = 0;
  PERSONAL_COMPLIANCE_STORE.auditEvents.length = 0;
  trainingCounter = 0;
  offboardingCounter = 0;
  inventoryCounter = 0;
  absenceCounter = 0;
  auditCounter = 0;
}

export function listTrainingRecordsForTenant(tenantId: string, employeeId?: string): EmployeeTrainingRecord[] {
  ensurePersonalComplianceDemoSeed();
  return filterPersonalComplianceByTenant(PERSONAL_COMPLIANCE_STORE.trainingRecords, tenantId).filter(
    (r) => !employeeId || r.employeeId === employeeId,
  );
}

export function listOffboardingSessionsForTenant(
  tenantId: string,
  employeeId?: string,
): EmployeeOffboardingSession[] {
  ensurePersonalComplianceDemoSeed();
  return filterPersonalComplianceByTenant(PERSONAL_COMPLIANCE_STORE.offboardingSessions, tenantId).filter(
    (s) => !employeeId || s.employeeId === employeeId,
  );
}

export function listInventoryAssignmentsForTenant(
  tenantId: string,
  employeeId?: string,
): InventoryAssignmentRecord[] {
  ensurePersonalComplianceDemoSeed();
  return filterPersonalComplianceByTenant(PERSONAL_COMPLIANCE_STORE.inventoryAssignments, tenantId).filter(
    (a) => !employeeId || a.employeeId === employeeId,
  );
}

export function listPersonalComplianceAbsencesForTenant(
  tenantId: string,
  employeeId?: string,
): EmployeeAbsence[] {
  ensurePersonalComplianceDemoSeed();
  return filterPersonalComplianceByTenant(PERSONAL_COMPLIANCE_STORE.absences, tenantId).filter(
    (a) => !employeeId || a.employeeId === employeeId,
  );
}
