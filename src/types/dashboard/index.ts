import type { WorkflowStatus } from '../core/base';
import type { RoleKey } from '../core/auth';

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
  statusCards: DashboardStatusCard[];
  quickActions: DashboardQuickAction[];
  activities: DashboardActivity[];
};
