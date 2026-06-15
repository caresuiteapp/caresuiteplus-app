import type { Protocol, FollowUp } from '@/types/modules/beratung';
import { DEMO_TENANT_ID } from './tenant';

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

const PROTOCOLS: (Protocol & { caseSubject: string })[] = [
  {
    id: 'proto-001',
    tenantId: DEMO_TENANT_ID,
    caseId: 'case-001',
    caseSubject: 'Pflegegrad-Antrag vorbereiten',
    content: 'Erstgespräch geführt. MD-Unterlagen angefordert. Nächster Termin mit Angehörigen vereinbart.',
    recordedAt: daysAgo(10),
    status: 'abgeschlossen',
    createdAt: daysAgo(10),
    updatedAt: daysAgo(10),
    visibility: 'team',
    sensitivity: 'internal',
  },
  {
    id: 'proto-002',
    tenantId: DEMO_TENANT_ID,
    caseId: 'case-002',
    caseSubject: 'Entlastungsleistungen klären',
    content: 'Budget erläutert. Verhinderungspflege und Kurzzeitpflege besprochen.',
    recordedAt: daysAgo(5),
    status: 'aktiv',
    createdAt: daysAgo(5),
    updatedAt: daysAgo(2),
    visibility: 'team',
    sensitivity: 'care',
  },
  {
    id: 'proto-003',
    tenantId: DEMO_TENANT_ID,
    caseId: 'case-003',
    caseSubject: 'Wohnraumanpassung',
    content: 'Kostenvoranschlag Sanitärbetrieb übermittelt. Fördermittelberatung abgeschlossen.',
    recordedAt: daysAgo(20),
    status: 'abgeschlossen',
    createdAt: daysAgo(20),
    updatedAt: daysAgo(4),
    visibility: 'team',
    sensitivity: 'internal',
  },
];

const FOLLOW_UPS: FollowUp[] = [
  {
    id: 'follow-001',
    tenantId: DEMO_TENANT_ID,
    caseId: 'case-001',
    caseSubject: 'Pflegegrad-Antrag vorbereiten',
    dueAt: daysFromNow(2),
    assigneeName: 'Julia Meier',
    status: 'aktiv',
    note: 'MD-Bericht nachreichen',
    createdAt: daysAgo(3),
    updatedAt: daysAgo(1),
  },
  {
    id: 'follow-002',
    tenantId: DEMO_TENANT_ID,
    caseId: 'case-002',
    caseSubject: 'Entlastungsleistungen klären',
    dueAt: daysFromNow(5),
    assigneeName: 'Julia Meier',
    status: 'in_bearbeitung',
    note: 'Rückruf Angehörige',
    createdAt: daysAgo(2),
    updatedAt: daysAgo(1),
  },
  {
    id: 'follow-003',
    tenantId: DEMO_TENANT_ID,
    caseId: 'case-004',
    caseSubject: 'Pflegekasse Kontakt',
    dueAt: daysFromNow(1),
    assigneeName: 'Markus Stein',
    status: 'aktiv',
    note: 'Leistungsnachweis prüfen',
    createdAt: daysAgo(1),
    updatedAt: daysAgo(0),
  },
];

export function getDemoCounselingProtocols(): (Protocol & { caseSubject: string })[] {
  return PROTOCOLS.map((p) => ({ ...p }));
}

export function addDemoCounselingProtocol(
  input: Pick<Protocol, 'caseId' | 'content' | 'status'> & { caseSubject: string },
): Protocol & { caseSubject: string } {
  const now = new Date().toISOString();
  const protocol: Protocol & { caseSubject: string } = {
    id: `proto-${Date.now()}`,
    tenantId: DEMO_TENANT_ID,
    caseId: input.caseId,
    caseSubject: input.caseSubject,
    content: input.content,
    recordedAt: now,
    status: input.status,
    createdAt: now,
    updatedAt: now,
    visibility: 'team',
    sensitivity: 'internal',
  };
  PROTOCOLS.unshift(protocol);
  return { ...protocol };
}

export function getDemoProtocolById(id: string): (Protocol & { caseSubject: string }) | null {
  const protocol = PROTOCOLS.find((p) => p.id === id);
  return protocol ? { ...protocol } : null;
}

export function getDemoFollowUps(): FollowUp[] {
  return FOLLOW_UPS.map((f) => ({ ...f }));
}

export function getDemoFollowUpById(id: string): FollowUp | null {
  const followUp = FOLLOW_UPS.find((f) => f.id === id);
  return followUp ? { ...followUp } : null;
}

export function countProtocolsThisMonth(): number {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  return PROTOCOLS.filter((p) => new Date(p.recordedAt).getTime() >= monthStart.getTime()).length;
}

export function countDueFollowUps(): number {
  const in7Days = Date.now() + 7 * 86_400_000;
  return FOLLOW_UPS.filter((f) => new Date(f.dueAt).getTime() <= in7Days && f.status !== 'abgeschlossen').length;
}
