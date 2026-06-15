import type { DashboardKpi } from '@/types/dashboard';
import type { WorkflowStatus } from '@/types/core/base';

/** WP541 — Architektur & Datenmodell Security/DSGVO */
export type SecurityCategory = 'dsgvo' | 'access' | 'performance' | 'audit';

export type SecurityListItem = {
  id: string;
  tenantId: string;
  title: string;
  category: SecurityCategory;
  severity: 'critical' | 'warning' | 'info';
  status: WorkflowStatus;
  updatedAt: string;
};

export type SecurityDetail = SecurityListItem & {
  summary: string;
  remediation: string;
  owner: string;
  dueDate: string;
  performanceMs?: number;
};

export type SecurityHubSnapshot = {
  tenantId: string;
  dsgvoScorePercent: number;
  openFindings: number;
  performanceKpis: DashboardKpi[];
  kpis: DashboardKpi[];
  generatedAt: string;
};
