import type { RoleKey } from '@/types/core/auth';
import type { PermissionKey } from '@/types/permissions';
import type {
  KpiMetricValue,
  ReportingDashboardKind,
  ReportingDashboardSnapshot,
} from '@/types/reporting/metrics';
import type { WorkspaceAccessContext } from '@/types/permissions/workspace';
import { DATA_QUALITY_AREA_ROUTES } from '@/lib/admin/dataQualityService';
import { hasPermission } from '@/lib/permissions/check';
import { permissionError } from '@/lib/permissions/check';
import {
  buildWorkspaceAccessContext,
} from '@/lib/permissions/workspaceAccess';
import {
  isClientPortalRole,
  isEmployeePortalRole,
  isPortalOnlyRole,
} from '@/lib/permissions/workspaceRoles';
import { getKpisForDashboard } from './kpiDefinitions';

const CEO_ROLES = new Set<RoleKey>(['business_admin']);
const ADMIN_ROLES = new Set<RoleKey>(['business_manager', 'dispatch']);
const BILLING_ROLES = new Set<RoleKey>(['billing']);
const QM_ROLES = new Set<RoleKey>(['business_manager', 'nurse']);
const EMPLOYEE_ROLES = new Set<RoleKey>(['employee_portal', 'caregiver', 'nurse']);

export function resolveReportingDashboardForRole(roleKey: RoleKey | null): ReportingDashboardKind | null {
  if (!roleKey || isClientPortalRole(roleKey)) return null;
  if (CEO_ROLES.has(roleKey)) return 'ceo';
  if (BILLING_ROLES.has(roleKey)) return 'billing';
  if (QM_ROLES.has(roleKey) && roleKey === 'nurse') return 'qm';
  if (EMPLOYEE_ROLES.has(roleKey) && !ADMIN_ROLES.has(roleKey) && roleKey !== 'business_admin') {
    if (roleKey === 'employee_portal' || roleKey === 'caregiver') return 'employee';
  }
  if (ADMIN_ROLES.has(roleKey)) return 'admin';
  if (roleKey === 'business_manager') return 'ceo';
  return 'admin';
}

export function enforceReportingDashboardPermission<T>(
  roleKey: RoleKey | null | undefined,
  kind: ReportingDashboardKind,
): import('@/types').ServiceResult<T> | null {
  if (!roleKey) {
    return { ok: false, error: 'Sie sind nicht angemeldet. Bitte melden Sie sich an.' };
  }

  const allowedByKind: Record<ReportingDashboardKind, PermissionKey[]> = {
    ceo: ['business.reporting.view'],
    admin: ['business.reporting.view', 'dashboard.view', 'assist.assignments.view'],
    billing: ['business.reporting.view', 'office.invoices.view'],
    qm: ['business.reporting.view', 'qm.view'],
    employee: ['business.reporting.view', 'assist.execution.manage', 'portal.employee.appointments.view'],
    export_center: ['business.reporting.view', 'business.reporting.create'],
  };

  const keys = allowedByKind[kind];
  if (keys.some((key) => hasPermission(roleKey, key))) {
    return null;
  }

  return {
    ok: false,
    error: permissionError(roleKey, keys[0]!) ?? 'Reporting nicht freigegeben.',
  };
}

export function canAccessReportingDashboard(
  ctx: WorkspaceAccessContext,
  kind: ReportingDashboardKind,
): { allowed: boolean; message?: string } {
  if (!ctx.userId?.trim()) return { allowed: false, message: 'Anmeldung erforderlich.' };
  if (!ctx.tenantId?.trim()) return { allowed: false, message: 'Mandant fehlt.' };
  if (isClientPortalRole(ctx.roleKey)) {
    return { allowed: false, message: 'Klient:innenportal hat keinen Zugriff auf Führungs-Dashboards.' };
  }

  const permissionBlock = enforceReportingDashboardPermission(ctx.roleKey, kind);
  if (permissionBlock && !permissionBlock.ok) {
    return { allowed: false, message: permissionBlock.error };
  }

  const resolved = resolveReportingDashboardForRole(ctx.roleKey);
  if (!resolved && kind !== 'export_center') {
    return { allowed: false, message: 'Kein Dashboard für diese Rolle.' };
  }

  if (kind === 'ceo' && !CEO_ROLES.has(ctx.roleKey!) && ctx.roleKey !== 'business_manager') {
    if (!hasPermission(ctx.roleKey, 'business.reporting.view')) {
      return { allowed: false, message: 'Geschäftsführer-Dashboard nur für Inhaber:in und Management.' };
    }
  }
  if (kind === 'employee' && !isEmployeePortalRole(ctx.roleKey) && ctx.roleKey !== 'caregiver') {
    return { allowed: false, message: 'Mitarbeiter-Dashboard nur für Mitarbeitendenrollen.' };
  }

  return { allowed: true };
}

export function filterKpiMetricsForRole(
  metrics: KpiMetricValue[],
  roleKey: RoleKey | null,
  dashboardKind: ReportingDashboardKind,
): KpiMetricValue[] {
  const allowedIds = new Set(getKpisForDashboard(dashboardKind).map((k) => k.id));
  let filtered = metrics.filter((m) => allowedIds.has(m.kpiId));

  if (isEmployeePortalRole(roleKey) || roleKey === 'caregiver') {
    filtered = filtered.filter((m) => m.category !== 'billing');
  }
  if (roleKey === 'billing') {
    filtered = filtered.filter(
      (m) =>
        m.category === 'billing' ||
        m.category === 'service_records' ||
        m.category === 'budget' ||
        m.kpiId === 'service_records_billing_ready',
    );
  }
  if (roleKey === 'nurse' && dashboardKind === 'qm') {
    filtered = filtered.filter(
      (m) =>
        m.category === 'quality_risk' ||
        m.category === 'documentation' ||
        m.category === 'signatures',
    );
  }

  return filtered.filter((m) => !m.label.toLowerCase().includes('gesundheitsdaten'));
}

export function attachDataQualityRoutes(metrics: KpiMetricValue[]): KpiMetricValue[] {
  return metrics.map((m) => {
    if (m.availability !== 'incomplete' && m.availability !== 'prepared') return m;
    const area = getKpisForDashboard('ceo').find((d) => d.id === m.kpiId)?.dataQualityArea;
    if (!area || !(area in DATA_QUALITY_AREA_ROUTES)) return m;
    return {
      ...m,
      dataQualityRoute: DATA_QUALITY_AREA_ROUTES[area as keyof typeof DATA_QUALITY_AREA_ROUTES],
    };
  });
}

export function buildMetricAccessContext(
  input: Partial<WorkspaceAccessContext> & { tenantId?: string | null },
): WorkspaceAccessContext {
  return buildWorkspaceAccessContext(input);
}

export function summarizeDashboardAccess(
  snapshot: ReportingDashboardSnapshot,
  roleKey: RoleKey | null,
): ReportingDashboardSnapshot {
  return {
    ...snapshot,
    kpis: attachDataQualityRoutes(filterKpiMetricsForRole(snapshot.kpis, roleKey, snapshot.kind)),
  };
}

export { CEO_ROLES, ADMIN_ROLES, BILLING_ROLES, QM_ROLES, EMPLOYEE_ROLES };
