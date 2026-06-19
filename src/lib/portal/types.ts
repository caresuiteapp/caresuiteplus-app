import type { RoleKey } from '@/types';
import type { PortalClientCareProfile } from '@/lib/portal/engine/portalFeatureAccess';

/** Care modules that compose the adaptive Klient:innenportal. */
export type PortalModuleKey = 'assist' | 'pflege' | 'stationaer' | 'beratung';

/** Portal actor sub-roles for visibility filtering. */
export type PortalActorRole =
  | 'client'
  | 'relative'
  | 'guardian'
  | 'invoice_recipient';

export type ClientModuleAssignment = {
  moduleKey: PortalModuleKey;
  isPrimary: boolean;
  isActive: boolean;
  assignedAt: string;
};

export type PortalFeature = {
  moduleKey: PortalModuleKey | 'global';
  featureKey: string;
  label: string;
  description: string;
  navGroup: 'module' | 'global';
  sortOrder: number;
  /** When false, feature stays accessible via KPI/modals but is omitted from sidebar nav. */
  showInPrimaryNav?: boolean;
};

export type PortalWidget = {
  moduleKey: PortalModuleKey | 'global';
  widgetKey: string;
  title: string;
  description: string;
  emptyState: string;
  priority: number;
  featureKey: string | null;
  sortOrder: number;
};

export type PortalVisibilityRule = {
  moduleKey: PortalModuleKey;
  featureKey: string;
  portalRole: PortalActorRole;
  isVisible: boolean;
  requiresRelease: boolean;
};

export type PortalLiveMetrics = {
  upcomingAppointments: number;
  documents: number;
  openMessages: number;
};

/** Per-widget live KPI values keyed by widgetKey from portal_widget_registry. */
export type PortalWidgetMetrics = Partial<Record<string, number>>;

export type PortalContext = {
  tenantId: string;
  clientId: string;
  roleKey: RoleKey;
  portalRole: PortalActorRole;
  displayName: string;
  tenantName: string;
  modules: ClientModuleAssignment[];
  primaryModule: PortalModuleKey | null;
  activeModuleKeys: PortalModuleKey[];
  features: PortalFeature[];
  visibleFeatures: PortalFeature[];
  widgets: PortalWidget[];
  metrics: PortalLiveMetrics;
  widgetMetrics: PortalWidgetMetrics;
  hasModuleAssignments: boolean;
  visibilityRules: PortalVisibilityRule[];
  careProfile: PortalClientCareProfile;
};

export type PortalNavItem = {
  key: string;
  label: string;
  icon: string;
  href: string;
  moduleKey?: PortalModuleKey;
  navGroup: 'overview' | 'module' | 'global';
};

export type PortalDashboardWidget = PortalWidget & {
  visible: boolean;
  metricValue?: number | null;
};

export type PortalTerminology = {
  greetingLabel: string;
  appointmentLabel: string;
  appointmentLabelPlural: string;
  personLabel: string;
  careTeamLabel: string;
  moduleLabel: string;
};
