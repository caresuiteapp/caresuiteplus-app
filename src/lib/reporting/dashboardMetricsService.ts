import type {
  KpiAvailability,
  KpiMetricValue,
  ReportingDashboardKind,
  ReportingDashboardSnapshot,
  ReportingDateRange,
  ReportingMetricsRawBundle,
} from '@/types/reporting/metrics';
import { DATA_QUALITY_AREA_ROUTES } from '@/lib/admin/dataQualityService';
import { formatCurrency } from '@/lib/office';
import { getKpiDefinition, getKpisForDashboard, KPI_DEFINITIONS } from './kpiDefinitions';
import {
  attachDataQualityRoutes,
  filterKpiMetricsForRole,
  summarizeDashboardAccess,
} from './metricAccessControl';
import type { RoleKey } from '@/types/core/auth';

function formatCount(value: number | null): string {
  if (value === null) return '—';
  return String(value);
}

function formatPercent(value: number | null): string {
  if (value === null) return '—';
  return `${value} %`;
}

function resolveAvailability(
  kpiId: string,
  bundle: ReportingMetricsRawBundle,
): { availability: KpiAvailability; reason?: string } {
  const def = getKpiDefinition(kpiId);
  if (!def) return { availability: 'prepared', reason: 'KPI-Definition fehlt.' };

  const tableReady = bundle.tableAvailability[def.dataSource];
  if (tableReady === false) {
    return {
      availability: 'prepared',
      reason: `Datenquelle „${def.dataSource}" noch nicht angebunden.`,
    };
  }
  if (tableReady === undefined && def.dataSource !== 'connect_integrations') {
    return {
      availability: 'prepared',
      reason: `Datenquelle „${def.dataSource}" nicht verifiziert.`,
    };
  }
  return { availability: 'active' };
}

function mapKpiValue(
  kpiId: string,
  bundle: ReportingMetricsRawBundle,
  dateRange: ReportingDateRange,
): KpiMetricValue {
  const def = getKpiDefinition(kpiId)!;
  const { availability, reason } = resolveAvailability(kpiId, bundle);
  const periodLabel = dateRange.label;

  let value: number | null = null;
  let displayValue = '—';

  if (availability === 'active') {
    switch (kpiId) {
      case 'assignments_total':
        value = bundle.assignments.total;
        break;
      case 'assignments_planned':
        value = bundle.assignments.planned;
        break;
      case 'assignments_completed':
        value = bundle.assignments.completed;
        break;
      case 'assignments_open_no_employee':
        value = bundle.assignments.openWithoutEmployee;
        break;
      case 'assignments_on_time_start':
        value = bundle.assignments.onTimeStart;
        break;
      case 'documentation_complete':
        value = bundle.documentation.complete;
        break;
      case 'documentation_missing':
        value = bundle.documentation.missing;
        break;
      case 'documentation_corrections':
        value = bundle.documentation.corrections;
        break;
      case 'signatures_complete':
        value = bundle.signatures.complete;
        break;
      case 'signatures_missing':
        value = bundle.signatures.missing;
        break;
      case 'service_records_billing_ready':
        value = bundle.serviceRecords.billingReady;
        break;
      case 'service_records_review_pending':
        value = bundle.serviceRecords.reviewPending;
        break;
      case 'billing_revenue_prepared':
        value = bundle.growth.revenuePreparedCents;
        displayValue = formatCurrency(bundle.growth.revenuePreparedCents);
        break;
      case 'billing_revenue_invoiced':
        value = bundle.growth.revenueInvoicedCents;
        displayValue = formatCurrency(bundle.growth.revenueInvoicedCents);
        break;
      case 'billing_open_amount':
        value = bundle.billing.openCents;
        displayValue = formatCurrency(bundle.billing.openCents);
        break;
      case 'billing_overdue':
        value = bundle.billing.overdueCount;
        break;
      case 'billing_drafts':
        value = bundle.billing.draftCount;
        break;
      case 'billing_blockers':
        value = bundle.billing.blockerCount;
        break;
      case 'budget_exceeded':
        value = bundle.budget.exceededCount;
        break;
      case 'budget_warning':
        value = bundle.budget.warningCount;
        break;
      case 'budget_available':
        value = bundle.budget.availableCents;
        displayValue = formatCurrency(bundle.budget.availableCents);
        break;
      case 'employees_active':
        value = bundle.employees.activeCount;
        break;
      case 'employees_utilization':
        value = bundle.employees.utilizationPercent;
        displayValue = formatPercent(bundle.employees.utilizationPercent);
        break;
      case 'employees_open_docs':
        value = bundle.employees.withOpenDocs;
        break;
      case 'clients_active':
        value = bundle.clients.active;
        break;
      case 'clients_new':
        value = bundle.clients.newInPeriod;
        break;
      case 'quality_complaints':
        value = bundle.qualityRisk.complaints;
        break;
      case 'quality_emergencies':
        value = bundle.qualityRisk.emergencies;
        break;
      case 'quality_qm_tasks':
        value = bundle.qualityRisk.qmTasksOpen;
        break;
      case 'quality_critical_assignments':
        value = bundle.qualityRisk.criticalAssignments;
        break;
      case 'growth_assignments_trend':
        value = bundle.growth.assignmentsTrend;
        break;
      case 'growth_clients_trend':
        value = bundle.growth.clientsTrend;
        break;
      case 'growth_connect_prepared':
        value = bundle.growth.connectPrepared;
        break;
      case 'export_center_prepared':
        value = null;
        break;
      default:
        value = null;
    }

    if (displayValue === '—' && def.valueFormat === 'currency' && value !== null) {
      displayValue = formatCurrency(value);
    } else if (displayValue === '—' && def.valueFormat === 'percent' && value !== null) {
      displayValue = formatPercent(value);
    } else if (displayValue === '—') {
      displayValue = formatCount(value);
    }
  } else {
    displayValue = availability === 'prepared' ? 'Vorbereitet' : 'Unvollständig';
  }

  const dataQualityRoute =
    def.dataQualityArea && def.dataQualityArea in DATA_QUALITY_AREA_ROUTES
      ? DATA_QUALITY_AREA_ROUTES[def.dataQualityArea as keyof typeof DATA_QUALITY_AREA_ROUTES]
      : undefined;

  return {
    kpiId,
    label: def.label,
    category: def.category,
    value: availability === 'active' ? value : null,
    displayValue,
    availability,
    incompleteReason: reason,
    dataSource: def.dataSource,
    periodLabel,
    drilldownRoute: def.drilldownRoute,
    dataQualityRoute,
  };
}

export function buildKpiMetricsFromBundle(
  bundle: ReportingMetricsRawBundle,
  dashboardKind: ReportingDashboardKind,
): KpiMetricValue[] {
  const defs = getKpisForDashboard(dashboardKind);
  return defs.map((d) => mapKpiValue(d.id, bundle, bundle.dateRange));
}

export function buildReportingDashboardSnapshot(
  bundle: ReportingMetricsRawBundle,
  kind: ReportingDashboardKind,
  roleKey: RoleKey | null,
  preparedOnly: boolean,
): ReportingDashboardSnapshot {
  const kpis = attachDataQualityRoutes(
    filterKpiMetricsForRole(buildKpiMetricsFromBundle(bundle, kind), roleKey, kind),
  );

  return {
    kind,
    tenantId: bundle.tenantId,
    dateRange: bundle.dateRange,
    kpis,
    generatedAt: new Date().toISOString(),
    preparedOnly,
    activeCount: kpis.filter((k) => k.availability === 'active').length,
    preparedCount: kpis.filter((k) => k.availability === 'prepared').length,
    incompleteCount: kpis.filter((k) => k.availability === 'incomplete').length,
  };
}

export function applyRoleDashboardSummary(
  snapshot: ReportingDashboardSnapshot,
  roleKey: RoleKey | null,
): ReportingDashboardSnapshot {
  return summarizeDashboardAccess(snapshot, roleKey);
}

export function listAllKpiDefinitions() {
  return KPI_DEFINITIONS;
}

export function verifyKpiHasDataSource(kpiId: string): boolean {
  const def = getKpiDefinition(kpiId);
  return def != null && def.dataSource.length > 0;
}
