/** Prompt 70 — Reporting KPIs & Executive Dashboard types */

export type ReportingDateRangePreset =
  | 'today'
  | 'yesterday'
  | 'current_week'
  | 'last_week'
  | 'current_month'
  | 'last_month'
  | 'quarter'
  | 'year'
  | 'custom';

export type ReportingDateRange = {
  preset: ReportingDateRangePreset;
  from: string;
  to: string;
  label: string;
};

export type KpiCategory =
  | 'assignments'
  | 'documentation'
  | 'signatures'
  | 'service_records'
  | 'billing'
  | 'budget'
  | 'employees'
  | 'clients'
  | 'quality_risk'
  | 'growth_management';

export type ReportingDashboardKind =
  | 'ceo'
  | 'admin'
  | 'billing'
  | 'qm'
  | 'employee'
  | 'export_center';

export type KpiAvailability = 'active' | 'prepared' | 'incomplete';

export type KpiDataSource =
  | 'assignments'
  | 'assignment_tasks'
  | 'assignment_status_events'
  | 'assignment_documentation'
  | 'assignment_signatures'
  | 'service_records'
  | 'billable_items'
  | 'invoice_drafts'
  | 'invoices'
  | 'payments'
  | 'client_budgets'
  | 'budget_transactions'
  | 'management_tasks'
  | 'problem_reports'
  | 'emergency_reports'
  | 'clients'
  | 'employees'
  | 'messages'
  | 'generated_documents'
  | 'connect_integrations';

export type KpiTrendDirection = 'up' | 'down' | 'neutral';

export type KpiDefinition = {
  id: string;
  category: KpiCategory;
  label: string;
  description: string;
  dataSource: KpiDataSource;
  dashboards: ReportingDashboardKind[];
  drilldownRoute?: string;
  dataQualityArea?: string;
  containsHealthData?: boolean;
  valueFormat?: 'count' | 'currency' | 'percent' | 'duration';
};

export type KpiMetricValue = {
  kpiId: string;
  label: string;
  category: KpiCategory;
  value: number | null;
  displayValue: string;
  availability: KpiAvailability;
  incompleteReason?: string;
  dataSource: KpiDataSource;
  periodLabel: string;
  trend?: { direction: KpiTrendDirection; label: string };
  drilldownRoute?: string;
  dataQualityRoute?: string;
};

export type ReportingDashboardSnapshot = {
  kind: ReportingDashboardKind;
  tenantId: string;
  dateRange: ReportingDateRange;
  kpis: KpiMetricValue[];
  generatedAt: string;
  preparedOnly: boolean;
  activeCount: number;
  preparedCount: number;
  incompleteCount: number;
};

export type ReportingMetricsRawBundle = {
  tenantId: string;
  dateRange: ReportingDateRange;
  /** Table availability for live mode — false means KPI stays prepared */
  tableAvailability: Partial<Record<KpiDataSource, boolean>>;
  assignments: {
    total: number;
    planned: number;
    started: number;
    completed: number;
    cancelled: number;
    missed: number;
    openWithoutEmployee: number;
    overrun: number;
    onTimeStart: number;
  };
  documentation: {
    complete: number;
    missing: number;
    incomplete: number;
    corrections: number;
  };
  signatures: {
    complete: number;
    missing: number;
    exception: number;
  };
  serviceRecords: {
    created: number;
    signed: number;
    reviewPending: number;
    approved: number;
    rejected: number;
    corrected: number;
    billingReady: number;
  };
  billing: {
    billingReadyCents: number;
    draftCount: number;
    invoicedCents: number;
    openCents: number;
    overdueCount: number;
    reminderCount: number;
    blockerCount: number;
    nonBillableCount: number;
    selfPayerCents: number;
    carrierCents: number;
  };
  budget: {
    activeCount: number;
    exceededCount: number;
    warningCount: number;
    unusedCount: number;
    consumedCents: number;
    availableCents: number;
  };
  employees: {
    activeCount: number;
    withOpenDocs: number;
    withCorrections: number;
    withDelays: number;
    utilizationPercent: number | null;
  };
  clients: {
    active: number;
    newInPeriod: number;
    paused: number;
    archived: number;
    openDocs: number;
  };
  qualityRisk: {
    complaints: number;
    emergencies: number;
    problems: number;
    noShows: number;
    repeatCorrections: number;
    qmTasksOpen: number;
    criticalAssignments: number;
  };
  growth: {
    assignmentsTrend: number | null;
    clientsTrend: number | null;
    revenuePreparedCents: number;
    revenueInvoicedCents: number;
    connectPrepared: number;
  };
};
