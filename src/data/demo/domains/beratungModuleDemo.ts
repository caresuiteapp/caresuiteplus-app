import type { WorkflowStatus } from '@/types';
import { demoEmployees } from '../employees';
import { getDemoCounselingCaseListItems } from '../counselingCases';
import { DEMO_TENANT_ID } from '../tenant';

export type CounselingProtocolListItem = {
  id: string;
  tenantId: string;
  caseId: string;
  caseSubject: string;
  clientName: string;
  counselorName: string;
  recordedAt: string;
  excerpt: string;
  status: WorkflowStatus;
};

export type CounselingFollowUpItem = {
  id: string;
  tenantId: string;
  caseId: string;
  caseSubject: string;
  clientName: string;
  dueAt: string;
  assigneeName: string;
  note: string;
  status: WorkflowStatus;
};

export type BeratungModuleSettings = {
  anonymousCasesEnabled: boolean;
  appointmentRemindersEnabled: boolean;
  protocolTemplatesEnabled: boolean;
  portalCaseUpdatesEnabled: boolean;
};

export type BeratungReportKpi = {
  id: string;
  label: string;
  value: string | number;
  subValue?: string;
  accentColor: string;
};

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

const cases = getDemoCounselingCaseListItems();

const PROTOCOLS: CounselingProtocolListItem[] = [
  {
    id: 'proto-001',
    tenantId: DEMO_TENANT_ID,
    caseId: 'case-001',
    caseSubject: cases.find((c) => c.id === 'case-001')?.subject ?? 'Pflegegrad-Antrag',
    clientName: cases.find((c) => c.id === 'case-001')?.clientName ?? 'Unbekannt',
    counselorName: cases.find((c) => c.id === 'case-001')?.counselorName ?? 'Unbekannt',
    recordedAt: daysAgo(2),
    excerpt: 'Unterlagen für MD-Begutachtung zusammengestellt. Termin am 15.06. bestätigt.',
    status: 'aktiv',
  },
  {
    id: 'proto-002',
    tenantId: DEMO_TENANT_ID,
    caseId: 'case-002',
    caseSubject: cases.find((c) => c.id === 'case-002')?.subject ?? 'Entlastungsleistungen',
    clientName: cases.find((c) => c.id === 'case-002')?.clientName ?? 'Unbekannt',
    counselorName: cases.find((c) => c.id === 'case-002')?.counselorName ?? 'Unbekannt',
    recordedAt: daysAgo(1),
    excerpt: 'Angehörige über Entlastungsbudget informiert. Antrag wird vorbereitet.',
    status: 'in_bearbeitung',
  },
  {
    id: 'proto-003',
    tenantId: DEMO_TENANT_ID,
    caseId: 'case-004',
    caseSubject: cases.find((c) => c.id === 'case-004')?.subject ?? 'Demenz — Angehörigengruppe',
    clientName: cases.find((c) => c.id === 'case-004')?.clientName ?? 'Unbekannt',
    counselorName: cases.find((c) => c.id === 'case-004')?.counselorName ?? 'Unbekannt',
    recordedAt: daysAgo(0),
    excerpt: 'Erstgespräch geführt. Einladung zur Gruppe per Post versendet.',
    status: 'aktiv',
  },
];

const FOLLOW_UPS: CounselingFollowUpItem[] = [
  {
    id: 'fu-001',
    tenantId: DEMO_TENANT_ID,
    caseId: 'case-001',
    caseSubject: 'Pflegegrad-Antrag vorbereiten',
    clientName: cases.find((c) => c.id === 'case-001')?.clientName ?? 'Unbekannt',
    dueAt: daysFromNow(2),
    assigneeName: `${demoEmployees[4]?.firstName ?? 'Sabine'} ${demoEmployees[4]?.lastName ?? 'Muster'}`,
    note: 'MD-Termin vorbereiten, Arztbericht anfordern',
    status: 'aktiv',
  },
  {
    id: 'fu-002',
    tenantId: DEMO_TENANT_ID,
    caseId: 'case-002',
    caseSubject: 'Entlastungsleistungen klären',
    clientName: cases.find((c) => c.id === 'case-002')?.clientName ?? 'Unbekannt',
    dueAt: daysFromNow(5),
    assigneeName: `${demoEmployees[4]?.firstName ?? 'Sabine'} ${demoEmployees[4]?.lastName ?? 'Muster'}`,
    note: 'Kostenträger-Rückmeldung abwarten',
    status: 'in_bearbeitung',
  },
  {
    id: 'fu-003',
    tenantId: DEMO_TENANT_ID,
    caseId: 'case-006',
    caseSubject: 'Vollmachten und Betreuung',
    clientName: cases.find((c) => c.id === 'case-006')?.clientName ?? 'Unbekannt',
    dueAt: daysFromNow(3),
    assigneeName: `${demoEmployees[5]?.firstName ?? 'Markus'} ${demoEmployees[5]?.lastName ?? 'Vogel'}`,
    note: 'Vollmacht beim Betreuer nachfordern',
    status: 'fehlerhaft',
  },
];

const DEFAULT_SETTINGS: BeratungModuleSettings = {
  anonymousCasesEnabled: true,
  appointmentRemindersEnabled: true,
  protocolTemplatesEnabled: false,
  portalCaseUpdatesEnabled: true,
};

const REPORT_KPIS: BeratungReportKpi[] = [
  { id: 'bkpi-1', label: 'Offene Fälle', value: 4, subValue: 'Demo-Mandant', accentColor: '#62F3FF' },
  { id: 'bkpi-2', label: 'Wiedervorlagen', value: 3, subValue: 'Diese Woche', accentColor: '#FF9500' },
  { id: 'bkpi-3', label: 'Termine', value: 3, subValue: 'Anstehend', accentColor: '#AF52DE' },
  { id: 'bkpi-4', label: 'Abgeschlossen', value: 1, subValue: 'Diesen Monat', accentColor: '#34C759' },
];

export function getDemoCounselingProtocols(): CounselingProtocolListItem[] {
  return PROTOCOLS.map((item) => ({ ...item }));
}

export function getDemoCounselingFollowUps(): CounselingFollowUpItem[] {
  return FOLLOW_UPS.map((item) => ({ ...item }));
}

export function getDemoBeratungSettings(): BeratungModuleSettings {
  return { ...DEFAULT_SETTINGS };
}

export function getDemoBeratungReportKpis(): BeratungReportKpi[] {
  return REPORT_KPIS.map((item) => ({ ...item }));
}
