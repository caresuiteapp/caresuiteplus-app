import type { WorkflowStatus } from '../core/base';
import type { RoleKey } from '../core/auth';
import type { OfficeAreaShortcut } from '@/lib/office/officeAreaShortcuts';

export type DashboardScope = 'business' | 'office' | 'portal_employee' | 'portal_client' | 'portal_family';

export type DashboardKpi = {
  id: string;
  label: string;
  value: string | number;
  subValue?: string;
  icon: string;
  accentColor: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  /** Live list/detail route for module overview cards. */
  route?: string;
};

export type DashboardModuleOverviewRow = {
  moduleKey: string;
  label: string;
  accentColor: string;
  kpis: DashboardKpi[];
};

export type DashboardStatusCard = {
  id: string;
  title: string;
  description: string;
  status: WorkflowStatus;
  count?: number;
  sensitivity?: 'internal' | 'care' | 'health';
};

export type DashboardQuickAction = {
  id: string;
  label: string;
  icon: string;
  route?: string;
  variant?: 'primary' | 'secondary';
};

export type DashboardActivity = {
  id: string;
  icon: string;
  title: string;
  subtitle?: string;
  timestamp: string;
  status?: WorkflowStatus;
  type: 'client' | 'employee' | 'assignment' | 'invoice' | 'care' | 'document' | 'system';
};

export type DashboardSnapshot = {
  scope: DashboardScope;
  roleKey: RoleKey;
  tenantName: string;
  tenantId: string;
  greeting: string;
  heroSubtitle: string;
  /** Fachmodul- oder Bereichskontext, z. B. CareSuite+ Office */
  moduleLabel?: string;
  primaryAction: DashboardQuickAction;
  kpis: DashboardKpi[];
  /** Module-grouped KPI rows for Zentrale overview (6 modules × 5 KPIs). */
  moduleOverviewRows?: DashboardModuleOverviewRow[];
  statusCards: DashboardStatusCard[];
  quickActions: DashboardQuickAction[];
  activities: DashboardActivity[];
  /** Office Arbeitsbereiche with optional live counts — never demo-sourced in supabase mode. */
  areaShortcuts?: OfficeAreaShortcut[];
  /** H3 — read-only Office Command Center metrics passthrough (no write paths). */
  officeReadMetrics?: OfficeCommandCenterReadMetrics;
};

/** Subset of dashboard repository metrics for Office Command Center display only. */
export type OfficeCommandCenterReadMetrics = {
  assignmentsToday: number;
  appointmentsToday: number;
  executionBlockers: number;
  budgetWarnings: number;
  openServiceRecords: number;
  documentsForReview: number;
  draftInvoices: number;
  openInvoices: number;
  activeEmployees: number;
  openTasks: number;
  overdueTasks: number;
  tableAvailability: {
    assignments: boolean;
    budgets: boolean;
    serviceRecords: boolean;
    documents: boolean;
    invoices: boolean;
    employees: boolean;
    appointments: boolean;
  };
};
