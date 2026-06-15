import type { DashboardKpi } from '@/types/dashboard';
import type { WorkflowStatus } from '@/types/core/base';

/** WP501 — Architektur & Datenmodell Reporting */
export type ReportCategory = 'pdl' | 'quality' | 'finance' | 'operations';

export type ReportListItem = {
  id: string;
  tenantId: string;
  title: string;
  category: ReportCategory;
  period: string;
  status: WorkflowStatus;
  updatedAt: string;
};

export type ReportDetail = ReportListItem & {
  summary: string;
  kpiSnapshot: DashboardKpi[];
};

export type PdlOpenTask = {
  id: string;
  title: string;
  priority: 'high' | 'medium' | 'low';
  dueDate: string;
  assignee: string;
};

export type PdlRisk = {
  id: string;
  label: string;
  severity: 'critical' | 'warning' | 'info';
  hint: string;
};

export type PdlCockpitSnapshot = {
  tenantId: string;
  kpis: DashboardKpi[];
  openTasks: PdlOpenTask[];
  risks: PdlRisk[];
  generatedAt: string;
};
