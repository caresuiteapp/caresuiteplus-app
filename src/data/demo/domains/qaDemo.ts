import type { QaDetail, QaHubSnapshot, QaListItem } from '@/types/qa';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';

export const QA_DEMO_TENANT = DEMO_TENANT_ID;

export const qaDemoList: QaListItem[] = [
  {
    id: 'qa-001',
    tenantId: QA_DEMO_TENANT,
    title: 'Pilot: PDL-Cockpit KPI-Refresh',
    kind: 'pilot',
    priority: 'high',
    status: 'in_bearbeitung',
    updatedAt: '2026-06-11T13:00:00.000Z',
  },
  {
    id: 'qa-002',
    tenantId: QA_DEMO_TENANT,
    title: 'Bug: Session-Timeout nach 15 Min',
    kind: 'bug',
    priority: 'critical',
    status: 'in_bearbeitung',
    updatedAt: '2026-06-10T17:30:00.000Z',
  },
  {
    id: 'qa-003',
    tenantId: QA_DEMO_TENANT,
    title: 'Coverage: Service-Layer E2E',
    kind: 'coverage',
    priority: 'medium',
    status: 'in_bearbeitung',
    updatedAt: '2026-06-09T10:00:00.000Z',
  },
];

const qaDetails: Record<string, QaDetail> = {
  'qa-001': {
    ...qaDemoList[0],
    summary: 'Pilotbetrieb Pflegedienst Nord — wöchentlicher KPI-Abgleich.',
    reporter: 'PDL Schmidt',
    module: 'reporting',
  },
  'qa-002': {
    ...qaDemoList[1],
    summary: 'Business-Portal meldet unerwarteten Logout.',
    reporter: 'QA Team',
    module: 'auth',
    stepsToReproduce: '1. Login Business\n2. 15 Min inaktiv\n3. Aktion auslösen → Redirect Login',
  },
  'qa-003': {
    ...qaDemoList[2],
    summary: 'Vitest E2E für domainMessageService und Repos.',
    reporter: 'Dev Team',
    module: 'platform',
    coveragePercent: 68,
  },
};

export function getQaHubSnapshot(): QaHubSnapshot {
  const pilotItems = qaDemoList.filter((q) => q.kind === 'pilot');
  const donePilot = pilotItems.filter((q) => q.status === 'abgeschlossen').length;
  return {
    tenantId: QA_DEMO_TENANT,
    pilotProgressPercent: pilotItems.length ? Math.round((donePilot / pilotItems.length) * 100) : 0,
    openBugs: qaDemoList.filter((q) => q.kind === 'bug' && q.status !== 'abgeschlossen').length,
    testCoveragePercent: 68,
    kpis: [
      { id: 'k1', label: 'Offene Bugs', value: 1, subValue: '1 kritisch', icon: '🐛', accentColor: '#EF4444' },
      { id: 'k2', label: 'Pilot-Fortschritt', value: '50%', subValue: '1/2 Tasks', icon: '🧪', accentColor: '#FFB020' },
      { id: 'k3', label: 'Test-Coverage', value: '68%', subValue: 'Ziel 75%', icon: '✅', accentColor: '#22C55E' },
    ],
    generatedAt: new Date().toISOString(),
  };
}

export function getQaDetail(id: string): QaDetail | null {
  return qaDetails[id] ?? null;
}

export function createQaItem(title: string, kind: QaListItem['kind']): { id: string } {
  const id = `qa-${Date.now().toString(36)}`;
  const item: QaListItem = {
    id,
    tenantId: QA_DEMO_TENANT,
    title: title.trim(),
    kind,
    priority: kind === 'bug' ? 'high' : 'medium',
    status: 'entwurf',
    updatedAt: new Date().toISOString(),
  };
  qaDemoList.unshift(item);
  qaDetails[id] = {
    ...item,
    summary: 'Neuer QA-Eintrag — Details ergänzen.',
    reporter: 'Unbekannt',
    module: 'general',
  };
  return { id };
}
