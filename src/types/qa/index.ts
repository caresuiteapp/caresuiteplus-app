import type { DashboardKpi } from '@/types/dashboard';
import type { WorkflowStatus } from '@/types/core/base';

/** WP561 — Architektur & Datenmodell QA/Pilot */
export type QaItemKind = 'pilot' | 'bug' | 'coverage';

export type QaListItem = {
  id: string;
  tenantId: string;
  title: string;
  kind: QaItemKind;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: WorkflowStatus;
  updatedAt: string;
};

export type QaDetail = QaListItem & {
  summary: string;
  reporter: string;
  module: string;
  stepsToReproduce?: string;
  coveragePercent?: number;
};

export type QaHubSnapshot = {
  tenantId: string;
  pilotProgressPercent: number;
  openBugs: number;
  testCoveragePercent: number;
  kpis: DashboardKpi[];
  generatedAt: string;
};
