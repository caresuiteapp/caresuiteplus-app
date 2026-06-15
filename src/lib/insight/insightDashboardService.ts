import type { RoleKey, ServiceResult } from '@/types';
import type {
  InsightDashboardStats,
  InsightExportDetail,
  InsightExportItem,
  InsightSnapshotDetail,
  InsightSnapshotItem,
  InsightDataSourceItem,
  InsightDataSourceDetail,
} from '@/types/modules/insight';
import {
  getDemoInsightExports,
  getDemoInsightExportDetail,
  getDemoInsightSnapshotDetail,
  getDemoInsightSnapshots,
  getDemoInsightDataSources,
  getDemoInsightDataSourceDetail,
} from '@/data/demo/insightDemo';
import { enforcePermission } from '@/lib/permissions';
import { guardLiveDemoFeature } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';

async function demoDelay(ms = 180): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

export async function fetchInsightDashboardStats(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<InsightDashboardStats>> {
  const denied = enforcePermission<InsightDashboardStats>(actorRoleKey, 'dashboard.view');
  if (denied) return denied;

  const blocked = guardLiveDemoFeature<InsightDashboardStats>(tenantId, 'InsightCenter');
  if (blocked) return blocked;

  await demoDelay();
  const snapshots = getDemoInsightSnapshots();
  const exports = getDemoInsightExports();
  return {
    ok: true,
    data: {
      configuredDashboards: snapshots.length,
      savedReports: snapshots.length,
      scheduledExports: exports.length,
      dataSourcesReady: 0,
    },
  };
}

export async function fetchInsightSnapshots(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<InsightSnapshotItem[]>> {
  const denied = enforcePermission<InsightSnapshotItem[]>(actorRoleKey, 'dashboard.view');
  if (denied) return denied;

  if (getServiceMode() === 'supabase') {
    const blocked = guardLiveDemoFeature<InsightSnapshotItem[]>(tenantId, 'InsightCenter-Snapshots');
    if (blocked) return blocked;
  }

  await demoDelay(120);
  return { ok: true, data: getDemoInsightSnapshots() };
}

export async function fetchInsightSnapshotDetail(
  tenantId: string,
  snapshotId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<InsightSnapshotDetail>> {
  const denied = enforcePermission<InsightSnapshotDetail>(actorRoleKey, 'dashboard.view');
  if (denied) return denied;

  if (getServiceMode() === 'supabase') {
    const blocked = guardLiveDemoFeature<InsightSnapshotDetail>(tenantId, 'InsightCenter-Snapshot-Detail');
    if (blocked) return blocked;
  }

  await demoDelay(100);
  const detail = getDemoInsightSnapshotDetail(snapshotId);
  if (!detail) {
    return { ok: false, error: 'Snapshot nicht gefunden.' };
  }
  return { ok: true, data: detail };
}

export async function fetchInsightExports(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<InsightExportItem[]>> {
  const denied = enforcePermission<InsightExportItem[]>(actorRoleKey, 'dashboard.view');
  if (denied) return denied;

  if (getServiceMode() === 'supabase') {
    const blocked = guardLiveDemoFeature<InsightExportItem[]>(tenantId, 'InsightCenter-Exports');
    if (blocked) return blocked;
  }

  await demoDelay(100);
  return { ok: true, data: getDemoInsightExports() };
}

export async function fetchInsightExportDetail(
  tenantId: string,
  exportId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<InsightExportDetail>> {
  const denied = enforcePermission<InsightExportDetail>(actorRoleKey, 'dashboard.view');
  if (denied) return denied;

  if (getServiceMode() === 'supabase') {
    const blocked = guardLiveDemoFeature<InsightExportDetail>(tenantId, 'InsightCenter-Export-Detail');
    if (blocked) return blocked;
  }

  await demoDelay(100);
  const detail = getDemoInsightExportDetail(exportId);
  if (!detail) {
    return { ok: false, error: 'Export nicht gefunden.' };
  }
  return { ok: true, data: detail };
}

export async function fetchInsightDataSources(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<InsightDataSourceItem[]>> {
  const denied = enforcePermission<InsightDataSourceItem[]>(actorRoleKey, 'dashboard.view');
  if (denied) return denied;

  if (getServiceMode() === 'supabase') {
    const blocked = guardLiveDemoFeature<InsightDataSourceItem[]>(tenantId, 'InsightCenter-DataSources');
    if (blocked) return blocked;
  }

  await demoDelay(100);
  return { ok: true, data: getDemoInsightDataSources() };
}

export async function fetchInsightDataSourceDetail(
  tenantId: string,
  sourceId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<InsightDataSourceDetail>> {
  const denied = enforcePermission<InsightDataSourceDetail>(actorRoleKey, 'dashboard.view');
  if (denied) return denied;

  if (getServiceMode() === 'supabase') {
    const blocked = guardLiveDemoFeature<InsightDataSourceDetail>(tenantId, 'InsightCenter-DataSource-Detail');
    if (blocked) return blocked;
  }

  await demoDelay(100);
  const detail = getDemoInsightDataSourceDetail(sourceId);
  if (!detail) {
    return { ok: false, error: 'Datenquelle nicht gefunden.' };
  }
  return { ok: true, data: detail };
}
