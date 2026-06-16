import type { AssignmentListItem, AssignmentPlan } from '@/types/modules/assist';
import type { WorkflowStatus } from '@/types';
import { demoClients } from './clients';
import { demoEmployees } from './employees';
import { DEMO_TENANT_ID } from './tenant';

function hoursFromNow(hours: number): string {
  return new Date(Date.now() + hours * 3_600_000).toISOString();
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfToday(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

function clientName(clientId: string): string {
  const client = demoClients.find((c) => c.id === clientId);
  return client ? `${client.firstName} ${client.lastName}` : 'Unbekannt';
}

function employeeName(employeeId: string): string {
  const employee = demoEmployees.find((e) => e.id === employeeId);
  return employee ? `${employee.firstName} ${employee.lastName}` : 'Unbekannt';
}

type AssignmentSeed = Omit<
  AssignmentPlan,
  'clientName' | 'employeeName' | 'nextActionHint' | 'allowedStatusActions'
>;

const ASSIGNMENT_SEEDS: AssignmentSeed[] = [
  {
    id: 'assign-001',
    tenantId: DEMO_TENANT_ID,
    clientId: 'client-001',
    employeeId: 'employee-001',
    appointmentId: 'appt-001',
    title: 'Alltagsbegleitung',
    scheduledStart: hoursFromNow(2),
    scheduledEnd: hoursFromNow(4),
    status: 'aktiv',
    location: 'Musterstraße 12, Berlin',
    notes: 'Einkauf und Spaziergang im Park.',
    createdAt: '2026-06-01T08:00:00.000Z',
    updatedAt: '2026-06-01T08:00:00.000Z',
    visibility: 'team',
    sensitivity: 'care',
  },
  {
    id: 'assign-002',
    tenantId: DEMO_TENANT_ID,
    clientId: 'client-002',
    employeeId: 'employee-002',
    appointmentId: 'appt-002',
    title: 'Pflegevisit',
    scheduledStart: hoursFromNow(24),
    scheduledEnd: hoursFromNow(25),
    status: 'entwurf',
    location: 'Friedrichshain, Berlin',
    notes: 'Erstbesuch, Medikamentenplan abstimmen.',
    createdAt: '2026-06-01T08:00:00.000Z',
    updatedAt: '2026-06-01T08:00:00.000Z',
    visibility: 'team',
    sensitivity: 'health',
  },
  {
    id: 'assign-003',
    tenantId: DEMO_TENANT_ID,
    clientId: 'client-005',
    employeeId: 'employee-003',
    appointmentId: 'appt-003',
    title: 'Haushaltsführung',
    scheduledStart: hoursFromNow(-2),
    scheduledEnd: hoursFromNow(0),
    status: 'abgeschlossen',
    location: 'Wedding, Berlin',
    notes: 'Wäsche und Küche erledigt.',
    createdAt: '2026-05-30T08:00:00.000Z',
    updatedAt: '2026-06-01T08:00:00.000Z',
    visibility: 'team',
    sensitivity: 'care',
  },
  {
    id: 'assign-004',
    tenantId: DEMO_TENANT_ID,
    clientId: 'client-010',
    employeeId: 'employee-001',
    appointmentId: 'appt-004',
    title: 'Spaziergang & Gespräch',
    scheduledStart: hoursFromNow(48),
    scheduledEnd: hoursFromNow(50),
    status: 'in_bearbeitung',
    location: 'Königs Wusterhausen',
    notes: 'Begleitung zum Hausarzt, Rückfahrt inklusive.',
    createdAt: '2026-06-01T08:00:00.000Z',
    updatedAt: '2026-06-01T08:00:00.000Z',
    visibility: 'team',
    sensitivity: 'care',
  },
  {
    id: 'assign-005',
    tenantId: DEMO_TENANT_ID,
    clientId: 'client-003',
    employeeId: 'employee-004',
    appointmentId: null,
    title: 'Behördengang',
    scheduledStart: hoursFromNow(5),
    scheduledEnd: hoursFromNow(7),
    status: 'aktiv',
    location: 'Potsdam, Rathaus',
    notes: 'Formulare für Pflegegrad mitbringen.',
    createdAt: '2026-06-02T09:00:00.000Z',
    updatedAt: '2026-06-02T09:00:00.000Z',
    visibility: 'team',
    sensitivity: 'internal',
  },
  {
    id: 'assign-006',
    tenantId: DEMO_TENANT_ID,
    clientId: 'client-011',
    employeeId: 'employee-003',
    appointmentId: null,
    title: 'Morgenroutine',
    scheduledStart: hoursFromNow(1),
    scheduledEnd: hoursFromNow(3),
    status: 'in_bearbeitung',
    location: 'Berlin-Steglitz',
    notes: 'Frühstück, Medikamente, leichte Gymnastik.',
    createdAt: '2026-06-02T07:00:00.000Z',
    updatedAt: '2026-06-02T07:30:00.000Z',
    visibility: 'team',
    sensitivity: 'health',
  },
  {
    id: 'assign-007',
    tenantId: DEMO_TENANT_ID,
    clientId: 'client-006',
    employeeId: 'employee-006',
    appointmentId: null,
    title: 'Abschlussbesuch',
    scheduledStart: hoursFromNow(-5),
    scheduledEnd: hoursFromNow(-3),
    status: 'abgeschlossen',
    location: 'Oranienburg',
    notes: 'Betreuung beendet, Übergabe an Angehörige.',
    createdAt: '2026-05-28T08:00:00.000Z',
    updatedAt: '2026-06-01T12:00:00.000Z',
    visibility: 'team',
    sensitivity: 'care',
  },
  {
    id: 'assign-008',
    tenantId: DEMO_TENANT_ID,
    clientId: 'client-012',
    employeeId: 'employee-002',
    appointmentId: null,
    title: 'Wocheneinkauf',
    scheduledStart: hoursFromNow(72),
    scheduledEnd: hoursFromNow(74),
    status: 'entwurf',
    location: 'Falkensee',
    notes: 'Einkaufsliste liegt im Büro.',
    createdAt: '2026-06-03T08:00:00.000Z',
    updatedAt: '2026-06-03T08:00:00.000Z',
    visibility: 'team',
    sensitivity: 'care',
  },
  {
    id: 'assign-009',
    tenantId: DEMO_TENANT_ID,
    clientId: 'client-004',
    employeeId: 'employee-005',
    appointmentId: null,
    title: 'Erstgespräch Alltagsbegleitung',
    scheduledStart: hoursFromNow(6),
    scheduledEnd: hoursFromNow(7),
    status: 'aktiv',
    location: 'Berlin-Neukölln',
    notes: 'Neuer Klient, Bedarfsermittlung.',
    createdAt: '2026-06-02T10:00:00.000Z',
    updatedAt: '2026-06-02T10:00:00.000Z',
    visibility: 'team',
    sensitivity: 'internal',
  },
  {
    id: 'assign-010',
    tenantId: DEMO_TENANT_ID,
    clientId: 'client-007',
    employeeId: 'employee-001',
    appointmentId: null,
    title: 'Archivierung Nachbereitung',
    scheduledStart: hoursFromNow(36),
    scheduledEnd: hoursFromNow(37),
    status: 'fehlerhaft',
    location: 'Berlin-Kreuzberg',
    notes: 'Dokumentation unvollständig — Rückfrage nötig.',
    createdAt: '2026-05-20T08:00:00.000Z',
    updatedAt: '2026-06-01T14:00:00.000Z',
    visibility: 'team',
    sensitivity: 'care',
  },
];

function enrichPlan(plan: AssignmentSeed): AssignmentPlan {
  return {
    ...plan,
    clientName: clientName(plan.clientId),
    employeeName: employeeName(plan.employeeId),
    nextActionHint: '',
    allowedStatusActions: [],
  };
}

let assignmentStore: AssignmentSeed[] = ASSIGNMENT_SEEDS.map((seed) => ({ ...seed }));

export function getDemoAssignmentSeeds(): AssignmentSeed[] {
  return assignmentStore.map((plan) => ({ ...plan }));
}

export function getDemoAssignmentListItems(): AssignmentListItem[] {
  return assignmentStore.map((plan) => ({
    id: plan.id,
    tenantId: plan.tenantId,
    clientId: plan.clientId,
    employeeId: plan.employeeId,
    title: plan.title,
    scheduledStart: plan.scheduledStart,
    scheduledEnd: plan.scheduledEnd,
    status: plan.status,
    location: plan.location,
    clientName: clientName(plan.clientId),
    employeeName: employeeName(plan.employeeId),
    updatedAt: plan.updatedAt,
  }));
}

export function getDemoAssignmentSeedById(id: string): AssignmentSeed | null {
  const plan = assignmentStore.find((a) => a.id === id);
  return plan ? { ...plan } : null;
}

export function updateDemoAssignmentSeedStatus(
  id: string,
  newStatus: WorkflowStatus,
): AssignmentSeed | null {
  const index = assignmentStore.findIndex((a) => a.id === id);
  if (index < 0) return null;

  assignmentStore[index] = {
    ...assignmentStore[index],
    status: newStatus,
    updatedAt: new Date().toISOString(),
  };
  return { ...assignmentStore[index] };
}

export function updateDemoAssignmentFields(
  id: string,
  patch: Partial<Pick<AssignmentSeed, 'title' | 'location' | 'notes' | 'status'>>,
): AssignmentSeed | null {
  const index = assignmentStore.findIndex((a) => a.id === id);
  if (index < 0) return null;
  assignmentStore[index] = {
    ...assignmentStore[index]!,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  return { ...assignmentStore[index]! };
}

export function isAssignmentToday(scheduledStart: string): boolean {
  const start = new Date(scheduledStart);
  return start >= startOfToday() && start <= endOfToday();
}

export function isAssignmentUpcoming(scheduledStart: string): boolean {
  return new Date(scheduledStart) > endOfToday();
}

export function createDemoAssignmentSeed(input: {
  clientId: string;
  employeeId: string;
  title: string;
  scheduledStart: string;
  scheduledEnd: string;
  location: string;
  notes?: string | null;
}): AssignmentSeed {
  const id = `assign-${Date.now()}`;
  const now = new Date().toISOString();
  const seed: AssignmentSeed = {
    id,
    tenantId: DEMO_TENANT_ID,
    clientId: input.clientId,
    employeeId: input.employeeId,
    appointmentId: null,
    title: input.title,
    scheduledStart: input.scheduledStart,
    scheduledEnd: input.scheduledEnd,
    status: 'entwurf',
    location: input.location,
    notes: input.notes ?? null,
    createdAt: now,
    updatedAt: now,
    visibility: 'team',
    sensitivity: 'care',
  };
  assignmentStore = [seed, ...assignmentStore];
  return { ...seed };
}

export const demoAssignments = ASSIGNMENT_SEEDS.map(enrichPlan);
