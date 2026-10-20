import type { DashboardKpi } from '@/types/dashboard';
import type { WorkflowStatus } from '@/types/core/base';

/** WP521 — Architektur & Datenmodell Release */
export type EnvProfileKey = 'development' | 'staging' | 'production';

export type EnvProfile = {
  key: EnvProfileKey;
  label: string;
  apiBaseUrl: string;
  supabaseUrl: string;
  featuresEnabled: string[];
};

export type VersionManifest = {
  appVersion: string;
  buildNumber: string;
  channel: 'internal' | 'beta' | 'store';
  releasedAt: string;
  gitCommit: string;
};

export type ReleaseListItem = {
  id: string;
  tenantId: string;
  title: string;
  env: EnvProfileKey;
  status: WorkflowStatus;
  checklistDone: number;
  checklistTotal: number;
  updatedAt: string;
};

export type ReleaseDetail = ReleaseListItem & {
  summary: string;
  checklist: { id: string; label: string; done: boolean; assignee: string }[];
  manifest: VersionManifest;
};

export type ReleaseHubSnapshot = {
  tenantId: string;
  manifest: VersionManifest;
  envProfiles: EnvProfile[];
  kpis: DashboardKpi[];
  pendingChecklists: number;
  generatedAt: string;
};
