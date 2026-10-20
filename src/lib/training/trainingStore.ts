import type {
  EmployeeTrainingCertificate,
  EmployeeTrainingRecord,
  TrainingAuditEvent,
  TrainingCourse,
  TrainingReminder,
  TrainingRequirement,
} from '@/types/modules/training';
import {
  DEMO_EMPLOYEE_TRAINING_CERTIFICATES,
  DEMO_EMPLOYEE_TRAINING_RECORDS,
  DEMO_TRAINING_AUDIT_EVENTS,
  DEMO_TRAINING_COURSES,
  DEMO_TRAINING_REMINDERS,
  DEMO_TRAINING_REQUIREMENTS,
} from '@/data/demo/training';

export type TrainingStoreState = {
  courses: TrainingCourse[];
  requirements: TrainingRequirement[];
  records: EmployeeTrainingRecord[];
  certificates: EmployeeTrainingCertificate[];
  reminders: TrainingReminder[];
  auditEvents: TrainingAuditEvent[];
};

export const TRAINING_STORE: TrainingStoreState = {
  courses: [],
  requirements: [],
  records: [],
  certificates: [],
  reminders: [],
  auditEvents: [],
};

let auditCounter = 0;

export function nextTrainingAuditId(): string {
  auditCounter += 1;
  return `tr-audit-gen-${auditCounter}`;
}

export function seedTrainingDemoStore(): void {
  TRAINING_STORE.courses = DEMO_TRAINING_COURSES.map((c) => ({ ...c }));
  TRAINING_STORE.requirements = DEMO_TRAINING_REQUIREMENTS.map((r) => ({ ...r }));
  TRAINING_STORE.records = DEMO_EMPLOYEE_TRAINING_RECORDS.map((r) => ({ ...r }));
  TRAINING_STORE.certificates = DEMO_EMPLOYEE_TRAINING_CERTIFICATES.map((c) => ({ ...c }));
  TRAINING_STORE.reminders = DEMO_TRAINING_REMINDERS.map((r) => ({ ...r }));
  TRAINING_STORE.auditEvents = DEMO_TRAINING_AUDIT_EVENTS.map((e) => ({ ...e }));
}

export function resetTrainingStoreForTests(): void {
  TRAINING_STORE.courses = [];
  TRAINING_STORE.requirements = [];
  TRAINING_STORE.records = [];
  TRAINING_STORE.certificates = [];
  TRAINING_STORE.reminders = [];
  TRAINING_STORE.auditEvents = [];
  auditCounter = 0;
}

export function appendTrainingAuditEvent(event: Omit<TrainingAuditEvent, 'id' | 'createdAt' | 'updatedAt'>): TrainingAuditEvent {
  const full: TrainingAuditEvent = {
    ...event,
    id: nextTrainingAuditId(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  TRAINING_STORE.auditEvents.unshift(full);
  return full;
}

export function getTrainingRecordsForTenant(tenantId: string): EmployeeTrainingRecord[] {
  return TRAINING_STORE.records.filter((r) => r.tenantId === tenantId);
}

export function getTrainingCoursesForTenant(tenantId: string): TrainingCourse[] {
  return TRAINING_STORE.courses.filter((c) => c.tenantId === tenantId);
}

export function getTrainingCertificatesForTenant(tenantId: string): EmployeeTrainingCertificate[] {
  return TRAINING_STORE.certificates.filter((c) => c.tenantId === tenantId);
}
