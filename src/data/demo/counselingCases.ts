import type { CounselingListItem, CounselingCase } from '@/types/modules/beratung';
import type { WorkflowStatus } from '@/types';
import { demoClients } from './clients';
import { demoEmployees } from './employees';
import { DEMO_TENANT_ID } from './tenant';

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

function clientName(clientId: string | null): string {
  if (!clientId) return 'Anonym';
  const client = demoClients.find((c) => c.id === clientId);
  return client ? `${client.firstName} ${client.lastName}` : 'Unbekannt';
}

function counselorName(counselorProfileId: string): string {
  const employee = demoEmployees.find((e) => e.id === counselorProfileId);
  return employee ? `${employee.firstName} ${employee.lastName}` : 'Unbekannt';
}

type CaseSeed = CounselingCase;

const CASE_SEEDS: CaseSeed[] = [
  {
    id: 'case-001',
    tenantId: DEMO_TENANT_ID,
    clientId: 'client-001',
    counselorProfileId: 'employee-005',
    subject: 'Pflegegrad-Antrag vorbereiten',
    category: 'Sozialberatung',
    openedAt: daysAgo(14),
    closedAt: null,
    nextAppointmentAt: daysFromNow(2),
    status: 'aktiv',
    summary: 'Unterstützung bei Antragsstellung und Dokumentensammlung.',
    createdAt: daysAgo(14),
    updatedAt: daysAgo(1),
    visibility: 'team',
    sensitivity: 'internal',
  },
  {
    id: 'case-002',
    tenantId: DEMO_TENANT_ID,
    clientId: 'client-003',
    counselorProfileId: 'employee-005',
    subject: 'Entlastungsleistungen klären',
    category: 'Familienberatung',
    openedAt: daysAgo(7),
    closedAt: null,
    nextAppointmentAt: daysFromNow(5),
    status: 'in_bearbeitung',
    summary: 'Angehörige informieren über Entlastungsbudget und Verfügbarkeit.',
    createdAt: daysAgo(7),
    updatedAt: daysAgo(2),
    visibility: 'team',
    sensitivity: 'care',
  },
  {
    id: 'case-003',
    tenantId: DEMO_TENANT_ID,
    clientId: 'client-007',
    counselorProfileId: 'employee-006',
    subject: 'Wohnraumanpassung',
    category: 'Wohnberatung',
    openedAt: daysAgo(21),
    closedAt: daysAgo(3),
    nextAppointmentAt: null,
    status: 'abgeschlossen',
    summary: 'Barrierefreie Badlösung empfohlen, Kostenträger informiert.',
    createdAt: daysAgo(21),
    updatedAt: daysAgo(3),
    visibility: 'team',
    sensitivity: 'internal',
  },
  {
    id: 'case-004',
    tenantId: DEMO_TENANT_ID,
    clientId: 'client-010',
    counselorProfileId: 'employee-005',
    subject: 'Demenz — Angehörigengruppe',
    category: 'Psychoedukation',
    openedAt: daysAgo(3),
    closedAt: null,
    nextAppointmentAt: daysFromNow(1),
    status: 'aktiv',
    summary: 'Erstgespräch, Einladung zur Gruppe versendet.',
    createdAt: daysAgo(3),
    updatedAt: daysAgo(1),
    visibility: 'team',
    sensitivity: 'health',
  },
  {
    id: 'case-005',
    tenantId: DEMO_TENANT_ID,
    clientId: null,
    counselorProfileId: 'employee-006',
    subject: 'Telefonische Erstberatung',
    category: 'Erstberatung',
    openedAt: daysAgo(1),
    closedAt: null,
    nextAppointmentAt: daysFromNow(7),
    status: 'entwurf',
    summary: 'Anonyme Anfrage — Termin zur Klärung vereinbart.',
    createdAt: daysAgo(1),
    updatedAt: daysAgo(1),
    visibility: 'team',
    sensitivity: 'internal',
  },
  {
    id: 'case-006',
    tenantId: DEMO_TENANT_ID,
    clientId: 'client-012',
    counselorProfileId: 'employee-005',
    subject: 'Vollmachten und Betreuung',
    category: 'Rechtsberatung',
    openedAt: daysAgo(10),
    closedAt: null,
    nextAppointmentAt: null,
    status: 'fehlerhaft',
    summary: 'Vollmacht unvollständig — Rückfrage beim Betreuer nötig.',
    createdAt: daysAgo(10),
    updatedAt: daysAgo(4),
    visibility: 'team',
    sensitivity: 'internal',
  },
];

let caseStore: CaseSeed[] = CASE_SEEDS.map((seed) => ({ ...seed }));

export function getDemoCounselingCaseListItems(): CounselingListItem[] {
  return caseStore.map((item) => ({
    id: item.id,
    tenantId: item.tenantId,
    subject: item.subject,
    category: item.category,
    openedAt: item.openedAt,
    nextAppointmentAt: item.nextAppointmentAt,
    status: item.status,
    updatedAt: item.updatedAt,
    clientName: clientName(item.clientId),
    counselorName: counselorName(item.counselorProfileId),
  }));
}

export function getDemoCounselingCaseById(id: string): CaseSeed | null {
  const item = caseStore.find((c) => c.id === id);
  return item ? { ...item } : null;
}

export function createDemoCounselingCase(input: {
  subject: string;
  category?: string;
  counselorProfileId?: string;
}): CaseSeed {
  const now = new Date().toISOString();
  const item: CaseSeed = {
    id: `case-${Date.now().toString(36)}`,
    tenantId: DEMO_TENANT_ID,
    clientId: null,
    counselorProfileId: input.counselorProfileId ?? 'employee-005',
    subject: input.subject.trim(),
    category: input.category ?? 'Allgemein',
    openedAt: now,
    closedAt: null,
    nextAppointmentAt: daysFromNow(14),
    status: 'entwurf',
    summary: null,
    createdAt: now,
    updatedAt: now,
    visibility: 'team',
    sensitivity: 'internal',
  };
  caseStore = [item, ...caseStore];
  return { ...item };
}

export function updateDemoCounselingCase(
  id: string,
  patch: Partial<Pick<CaseSeed, 'subject' | 'category' | 'summary' | 'status'>>,
): CaseSeed | null {
  const index = caseStore.findIndex((c) => c.id === id);
  if (index < 0) return null;
  const now = new Date().toISOString();
  caseStore[index] = {
    ...caseStore[index]!,
    ...patch,
    updatedAt: now,
  };
  return { ...caseStore[index]! };
}

export function isCaseOpen(status: WorkflowStatus): boolean {
  return status !== 'abgeschlossen' && status !== 'gesperrt';
}

export function isAppointmentUpcoming(nextAppointmentAt: string | null): boolean {
  if (!nextAppointmentAt) return false;
  return new Date(nextAppointmentAt) > new Date();
}

export function isCaseClosedThisMonth(closedAt: string | null): boolean {
  if (!closedAt) return false;
  const closed = new Date(closedAt);
  const now = new Date();
  return closed.getMonth() === now.getMonth() && closed.getFullYear() === now.getFullYear();
}

export const demoCounselingCases = CASE_SEEDS;
