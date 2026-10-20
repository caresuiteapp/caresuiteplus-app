import type { DashboardKpi } from '@/types/dashboard';
import type { WorkflowStatus } from '@/types/core/base';

/** WP581 — Architektur & Datenmodell Roadmap */
export type RoadmapPhase = 'discovery' | 'pilot' | 'launch' | 'scale';

export type RoadmapListItem = {
  id: string;
  tenantId: string;
  title: string;
  phase: RoadmapPhase;
  quarter: string;
  status: WorkflowStatus;
  updatedAt: string;
};

export type RoadmapDetail = RoadmapListItem & {
  summary: string;
  owner: string;
  market: string;
  successCriteria: string[];
};

export type RoadmapHubSnapshot = {
  tenantId: string;
  activeMilestones: number;
  launchReadinessPercent: number;
  kpis: DashboardKpi[];
  phases: { phase: RoadmapPhase; label: string; count: number }[];
  generatedAt: string;
};

export const ROADMAP_PHASE_LABELS: Record<RoadmapPhase, string> = {
  discovery: 'Discovery',
  pilot: 'Pilot',
  launch: 'Markteintritt',
  scale: 'Skalierung',
};
