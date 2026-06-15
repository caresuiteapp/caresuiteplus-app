import type { RoadmapDetail, RoadmapHubSnapshot, RoadmapListItem } from '@/types/roadmap';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';

export const ROADMAP_DEMO_TENANT = DEMO_TENANT_ID;

export const roadmapDemoList: RoadmapListItem[] = [
  {
    id: 'rm-001',
    tenantId: ROADMAP_DEMO_TENANT,
    title: 'Version 1.0 — Pilotstart Ambulant',
    phase: 'pilot',
    quarter: 'Q2 2026',
    status: 'in_bearbeitung',
    updatedAt: '2026-06-11T12:00:00.000Z',
  },
  {
    id: 'rm-002',
    tenantId: ROADMAP_DEMO_TENANT,
    title: 'App Store Launch iOS/Android',
    phase: 'launch',
    quarter: 'Q3 2026',
    status: 'entwurf',
    updatedAt: '2026-06-01T09:00:00.000Z',
  },
  {
    id: 'rm-003',
    tenantId: ROADMAP_DEMO_TENANT,
    title: 'Stationär-Modul Discovery',
    phase: 'discovery',
    quarter: 'Q4 2026',
    status: 'entwurf',
    updatedAt: '2026-05-28T14:00:00.000Z',
  },
];

const roadmapDetails: Record<string, RoadmapDetail> = {
  'rm-001': {
    ...roadmapDemoList[0],
    summary: 'Pilot mit 3 ambulanten Pflegediensten in NRW.',
    owner: 'Product',
    market: 'Ambulant DE',
    successCriteria: ['10 aktive Mandanten', 'NPS > 40', '0 kritische Bugs'],
  },
  'rm-002': {
    ...roadmapDemoList[1],
    summary: 'Öffentlicher Markteintritt über App Store und Play Store.',
    owner: 'Growth',
    market: 'DACH Pflege',
    successCriteria: ['Store-Freigabe', 'Marketing-Landingpage', 'Support-SLA 24h'],
  },
  'rm-003': {
    ...roadmapDemoList[2],
    summary: 'Anforderungsworkshops mit 2 stationären Häusern.',
    owner: 'Research',
    market: 'Stationär DE',
    successCriteria: ['PRD Stationär', 'ROI-Modell', 'Stakeholder-Sign-off'],
  },
};

export function getRoadmapHubSnapshot(): RoadmapHubSnapshot {
  const phases = ['discovery', 'pilot', 'launch', 'scale'] as const;
  return {
    tenantId: ROADMAP_DEMO_TENANT,
    activeMilestones: roadmapDemoList.filter((r) => r.status === 'in_bearbeitung').length,
    launchReadinessPercent: 45,
    kpis: [
      { id: 'k1', label: 'Aktive Meilensteine', value: 1, subValue: 'Q2 2026', icon: '🎯', accentColor: '#7C5CFF' },
      { id: 'k2', label: 'Launch-Readiness', value: '45%', subValue: 'Store pending', icon: '🚀', accentColor: '#FF9500' },
    ],
    phases: phases.map((phase) => ({
      phase,
      label: phase,
      count: roadmapDemoList.filter((r) => r.phase === phase).length,
    })),
    generatedAt: new Date().toISOString(),
  };
}

export function getRoadmapDetail(id: string): RoadmapDetail | null {
  return roadmapDetails[id] ?? null;
}

export function createRoadmapMilestone(title: string, phase: RoadmapListItem['phase']): { id: string } {
  const id = `rm-${Date.now().toString(36)}`;
  const item: RoadmapListItem = {
    id,
    tenantId: ROADMAP_DEMO_TENANT,
    title: title.trim(),
    phase,
    quarter: 'Q3 2026',
    status: 'entwurf',
    updatedAt: new Date().toISOString(),
  };
  roadmapDemoList.unshift(item);
  roadmapDetails[id] = {
    ...item,
    summary: 'Neuer strategischer Meilenstein.',
    owner: 'Product',
    market: 'DACH',
    successCriteria: ['KPI definieren', 'Budget freigeben'],
  };
  return { id };
}
