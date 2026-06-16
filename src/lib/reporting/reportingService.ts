import type { RoleKey, ServiceResult } from '@/types';
import type { PdlCockpitSnapshot, ReportDetail, ReportListItem } from '@/types/reporting';
import type {
  ReportingDashboardKind,
  ReportingDashboardSnapshot,
  ReportingDateRangePreset,
} from '@/types/reporting/metrics';
import {
  demoReportList,
  getDemoPdlCockpit,
  getDemoReportDetail,
} from '@/data/demo/reportingDemo';
import { enforcePermission } from '@/lib/permissions';
import { getServiceMode } from '@/lib/services/mode';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { reportingSupabaseRepository } from '@/lib/services/repositories/reportingRepository.supabase';
import { buildReportingDashboardSnapshot } from '@/lib/reporting/dashboardMetricsService';
import {
  buildMetricAccessContext,
  canAccessReportingDashboard,
  enforceReportingDashboardPermission,
  resolveReportingDashboardForRole,
} from '@/lib/reporting/metricAccessControl';
import { resolveReportingDateRange } from '@/lib/reporting/reportingDateRangeUtils';
import { fetchDemoReportingMetrics } from '@/lib/reporting/reportingRepository.demo';
import { reportingMetricsSupabaseRepository } from '@/lib/reporting/reportingMetricsRepository.supabase';
import { isDemoMode } from '@/lib/supabase/config';

/** WP507 — Service-Schicht Reporting */
export async function fetchPdlCockpit(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<PdlCockpitSnapshot>> {
  const denied = enforcePermission<PdlCockpitSnapshot>(actorRoleKey, 'business.reporting.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    return reportingSupabaseRepository.getCockpitMapped(tenantId);
  }

  await new Promise((r) => setTimeout(r, 200));
  return { ok: true, data: getDemoPdlCockpit() };
}

export async function fetchReportList(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<ReportListItem[]>> {
  const denied = enforcePermission<ReportListItem[]>(actorRoleKey, 'business.reporting.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    return reportingSupabaseRepository.listMapped(tenantId);
  }

  await new Promise((r) => setTimeout(r, 180));
  return { ok: true, data: demoReportList };
}

export async function fetchReportDetail(
  tenantId: string,
  reportId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<ReportDetail>> {
  const denied = enforcePermission<ReportDetail>(actorRoleKey, 'business.reporting.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    return reportingSupabaseRepository.getDetailMapped(reportId, tenantId);
  }

  const detail = getDemoReportDetail(reportId);
  if (!detail) return { ok: false, error: 'Bericht nicht gefunden.' };
  await new Promise((r) => setTimeout(r, 160));
  return { ok: true, data: detail };
}

export async function createReportDraft(
  tenantId: string,
  title: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<{ id: string }>> {
  const denied = enforcePermission<{ id: string }>(actorRoleKey, 'business.reporting.create');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (!title.trim()) return { ok: false, error: 'Titel ist erforderlich.' };

  if (getServiceMode() === 'supabase') {
    return reportingSupabaseRepository.create(tenantId, { title: title.trim() });
  }

  await new Promise((r) => setTimeout(r, 250));
  const id = `report-${Date.now().toString(36)}`;
  demoReportList.unshift({
    id,
    tenantId,
    title: title.trim(),
    category: 'pdl',
    period: 'Aktuell',
    status: 'entwurf',
    updatedAt: new Date().toISOString(),
  });
  return { ok: true, data: { id } };
}

export type FetchReportingDashboardOptions = {
  dashboardKind?: ReportingDashboardKind;
  dateRangePreset?: ReportingDateRangePreset;
  customFrom?: string;
  customTo?: string;
  employeeId?: string | null;
};

/** Prompt 70 — Rollenbasiertes Reporting-Dashboard */
export async function fetchReportingDashboard(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
  options: FetchReportingDashboardOptions = {},
): Promise<ServiceResult<ReportingDashboardSnapshot>> {
  const kind = options.dashboardKind ?? resolveReportingDashboardForRole(actorRoleKey ?? null);
  if (!kind) {
    return { ok: false, error: 'Kein Reporting-Dashboard für diese Rolle.' };
  }

  const denied = enforceReportingDashboardPermission<ReportingDashboardSnapshot>(actorRoleKey, kind);
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const accessCtx = buildMetricAccessContext({
    tenantId,
    roleKey: actorRoleKey ?? null,
    userId: 'reporting-user',
    employeeId: options.employeeId ?? null,
    isDemoMode: isDemoMode(),
    usesDemoFallback: getServiceMode() !== 'supabase',
  });
  const access = canAccessReportingDashboard(accessCtx, kind);
  if (!access.allowed) {
    return { ok: false, error: access.message ?? 'Zugriff verweigert.' };
  }

  const dateRange = resolveReportingDateRange(
    options.dateRangePreset ?? 'current_month',
    options.customFrom,
    options.customTo,
  );

  const preparedOnly = getServiceMode() !== 'supabase';
  const metricsResult =
    getServiceMode() === 'supabase'
      ? await reportingMetricsSupabaseRepository.fetchMetrics(tenantId, dateRange)
      : await fetchDemoReportingMetrics(tenantId, dateRange);

  if (!metricsResult.ok) return metricsResult;

  const snapshot = buildReportingDashboardSnapshot(
    metricsResult.data,
    kind,
    actorRoleKey ?? null,
    preparedOnly,
  );

  return { ok: true, data: snapshot };
}

export async function fetchCeoDashboard(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
  options?: Omit<FetchReportingDashboardOptions, 'dashboardKind'>,
): Promise<ServiceResult<ReportingDashboardSnapshot>> {
  return fetchReportingDashboard(tenantId, actorRoleKey, { ...options, dashboardKind: 'ceo' });
}

export async function fetchBillingReportingDashboard(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
  options?: Omit<FetchReportingDashboardOptions, 'dashboardKind'>,
): Promise<ServiceResult<ReportingDashboardSnapshot>> {
  return fetchReportingDashboard(tenantId, actorRoleKey, { ...options, dashboardKind: 'billing' });
}
