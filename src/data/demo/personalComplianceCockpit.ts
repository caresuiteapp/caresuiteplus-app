import type { EmployeeOffboardingSession } from '@/types/modules/employeeOffboarding';
import type { EmployeeAbsence } from '@/types/modules/employeeAbsence';
import { DEMO_TENANT_ID } from './tenant';

const REFERENCE = new Date('2026-06-16T12:00:00.000Z');

function isoDaysFromRef(days: number): string {
  return new Date(REFERENCE.getTime() + days * 86_400_000).toISOString();
}

export const DEMO_OFFBOARDING_SESSIONS: EmployeeOffboardingSession[] = [
  {
    id: 'off-session-006',
    tenantId: DEMO_TENANT_ID,
    employeeId: 'employee-006',
    overallStatus: 'in_progress',
    currentStepKey: 'inventory_return',
    exitDate: '2026-05-01',
    terminationType: 'employer_initiated',
    internalReason: 'Personalabbau',
    responsibleUserId: 'profile-admin',
    startedAt: isoDaysFromRef(-45),
    completedAt: null,
    lastSavedAt: isoDaysFromRef(-2),
    createdAt: isoDaysFromRef(-45),
    updatedAt: isoDaysFromRef(-2),
  },
];

export const DEMO_PERSONNEL_ABSENCES: EmployeeAbsence[] = [
  {
    id: 'abs-pc-002',
    tenantId: DEMO_TENANT_ID,
    employeeId: 'employee-002',
    absenceType: 'sick_leave',
    status: 'active',
    startsAt: isoDaysFromRef(-3),
    endsAt: isoDaysFromRef(4),
    allDay: true,
    internalNotes: 'AU bis Freitag',
    employeeVisibleNote: 'Krankheitsbedingt abwesend',
    sickDetails: 'Erkältung mit AU',
    auDocumentId: 'doc-au-002',
    certificateDocumentId: null,
    replacementRequired: true,
    hideDetailsFromAdmin: false,
    requestedDays: 5,
    approvedBy: 'profile-admin',
    approvedAt: isoDaysFromRef(-3),
    rejectedBy: null,
    rejectedAt: null,
    rejectionReason: null,
    cancelledAt: null,
    qualificationUpdated: false,
    createdBy: 'profile-admin',
    updatedBy: 'profile-admin',
    createdAt: isoDaysFromRef(-3),
    updatedAt: isoDaysFromRef(-1),
  },
  {
    id: 'abs-pc-008',
    tenantId: DEMO_TENANT_ID,
    employeeId: 'employee-008',
    absenceType: 'vacation',
    status: 'approved',
    startsAt: isoDaysFromRef(-1),
    endsAt: isoDaysFromRef(6),
    allDay: true,
    internalNotes: '',
    employeeVisibleNote: 'Urlaub',
    sickDetails: null,
    auDocumentId: null,
    certificateDocumentId: null,
    replacementRequired: false,
    hideDetailsFromAdmin: false,
    requestedDays: 5,
    approvedBy: 'profile-admin',
    approvedAt: isoDaysFromRef(-10),
    rejectedBy: null,
    rejectedAt: null,
    rejectionReason: null,
    cancelledAt: null,
    qualificationUpdated: false,
    createdBy: 'employee-008',
    updatedBy: 'profile-admin',
    createdAt: isoDaysFromRef(-10),
    updatedAt: isoDaysFromRef(-10),
  },
];

export const PERSONAL_COMPLIANCE_REFERENCE_DATE = REFERENCE;
