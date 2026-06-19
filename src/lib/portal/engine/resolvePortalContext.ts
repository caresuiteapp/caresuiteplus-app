import type { RoleKey } from '@/types';
import type {
  ClientModuleAssignment,
  PortalContext,
  PortalFeature,
  PortalLiveMetrics,
  PortalModuleKey,
  PortalVisibilityRule,
  PortalWidget,
  PortalWidgetMetrics,
} from '@/lib/portal/types';
import { fetchClientPortalLiveMetrics } from '@/lib/portal/clientPortalDashboardLive';
import { fetchClientModuleAssignments } from '@/lib/portal/clientModuleAssignmentService';
import { fetchPortalClientCareProfile } from '@/lib/portal/portalClientCareService';
import { fetchTenantDisplayName } from '@/lib/tenant/tenantDisplayName';
import { fetchPortalWidgetData } from './fetchPortalWidgetData';
import { getFeaturesForModules, PORTAL_FEATURE_MATRIX } from './portalFeatureMatrix';
import {
  applyPortalFeatureGates,
  EMPTY_PORTAL_CARE_PROFILE,
  type PortalClientCareProfile,
} from './portalFeatureAccess';
import { filterVisibleFeatures, resolvePortalActorRole } from './portalVisibility';
import { getWidgetsForModules, PORTAL_WIDGET_REGISTRY } from './portalWidgetRegistry';
import { isPortalModuleKey, sortPortalModules } from './portalModuleKeys';

export type ResolvePortalContextInput = {
  tenantId: string;
  clientId: string;
  roleKey: RoleKey;
  displayName: string;
  tenantNameHint?: string | null;
};

const EMPTY_METRICS: PortalLiveMetrics = {
  upcomingAppointments: 0,
  documents: 0,
  openMessages: 0,
};

function metricsToWidgetMetrics(metrics: PortalLiveMetrics): PortalWidgetMetrics {
  return {
    messages_kpi: metrics.openMessages,
    documents_kpi: metrics.documents,
    appointments_kpi: metrics.upcomingAppointments,
  };
}

function resolvePrimaryModule(
  assignments: ClientModuleAssignment[],
): PortalModuleKey | null {
  const primary = assignments.find((a) => a.isPrimary && a.isActive);
  if (primary) return primary.moduleKey;
  const active = assignments.filter((a) => a.isActive);
  if (active.length === 0) return null;
  return sortPortalModules(active.map((a) => a.moduleKey))[0];
}

function mapVisibilityRules(rows: Record<string, unknown>[]): PortalVisibilityRule[] {
  return rows
    .map((row) => ({
      moduleKey: String(row.module_key ?? ''),
      featureKey: String(row.feature_key ?? ''),
      portalRole: String(row.portal_role ?? 'client') as PortalVisibilityRule['portalRole'],
      isVisible: row.is_visible !== false,
      requiresRelease: row.requires_release === true,
    }))
    .filter(
      (rule): rule is PortalVisibilityRule =>
        isPortalModuleKey(rule.moduleKey) && rule.featureKey.length > 0,
    );
}

async function fetchVisibilityRules(
  tenantId: string,
): Promise<PortalVisibilityRule[]> {
  const { getSupabaseClient } = await import('@/lib/supabase/client');
  const { isMissingTableError } = await import('@/lib/supabase/missingtablefallback');
  const client = getSupabaseClient();
  if (!client) return [];

  const { data, error } = await client
    .from('portal_visibility_rules')
    .select('module_key, feature_key, portal_role, is_visible, requires_release')
    .eq('tenant_id', tenantId);

  if (error) {
    if (!isMissingTableError(error)) {
      console.warn('[resolvePortalContext] portal_visibility_rules:', error.message);
    }
    return [];
  }

  return mapVisibilityRules((data ?? []) as Record<string, unknown>[]);
}

async function fetchFeatureMatrixFromDb(): Promise<PortalFeature[] | null> {
  const { getSupabaseClient } = await import('@/lib/supabase/client');
  const { isMissingTableError } = await import('@/lib/supabase/missingtablefallback');
  const client = getSupabaseClient();
  if (!client) return null;

  const { data, error } = await client
    .from('portal_feature_matrix')
    .select('module_key, feature_key, label, description, nav_group, sort_order')
    .eq('is_active', true)
    .order('sort_order');

  if (error) {
    if (!isMissingTableError(error)) {
      console.warn('[resolvePortalContext] portal_feature_matrix:', error.message);
    }
    return null;
  }

  if (!data?.length) return null;

  return (data as Record<string, unknown>[])
    .filter((row) => isPortalModuleKey(String(row.module_key ?? '')))
    .map((row) => ({
      moduleKey: String(row.module_key) as PortalModuleKey,
      featureKey: String(row.feature_key ?? ''),
      label: String(row.label ?? ''),
      description: String(row.description ?? ''),
      navGroup: (row.nav_group === 'global' ? 'global' : 'module') as 'global' | 'module',
      sortOrder: Number(row.sort_order ?? 0),
    }));
}

async function fetchWidgetRegistryFromDb(): Promise<PortalWidget[] | null> {
  const { getSupabaseClient } = await import('@/lib/supabase/client');
  const { isMissingTableError } = await import('@/lib/supabase/missingtablefallback');
  const client = getSupabaseClient();
  if (!client) return null;

  const { data, error } = await client
    .from('portal_widget_registry')
    .select('module_key, widget_key, title, description, empty_state, priority, feature_key, sort_order')
    .eq('is_active', true)
    .order('sort_order');

  if (error) {
    if (!isMissingTableError(error)) {
      console.warn('[resolvePortalContext] portal_widget_registry:', error.message);
    }
    return null;
  }

  if (!data?.length) return null;

  return (data as Record<string, unknown>[])
    .filter(
      (row) =>
        String(row.module_key ?? '') === 'global' ||
        isPortalModuleKey(String(row.module_key ?? '')),
    )
    .map((row) => ({
      moduleKey: String(row.module_key) as PortalModuleKey | 'global',
      widgetKey: String(row.widget_key ?? ''),
      title: String(row.title ?? ''),
      description: String(row.description ?? ''),
      emptyState: String(row.empty_state ?? ''),
      priority: Number(row.priority ?? 50),
      featureKey: row.feature_key ? String(row.feature_key) : null,
      sortOrder: Number(row.sort_order ?? 0),
    }));
}

/** Loads modules, role, permissions, and live metrics for the portal session. */
export async function resolvePortalContext(
  input: ResolvePortalContextInput,
): Promise<PortalContext> {
  const portalRole = resolvePortalActorRole(input.roleKey);

  const [assignmentsResult, metrics, tenantName, visibilityRules, careProfile, dbFeatures, dbWidgets] =
    await Promise.all([
      fetchClientModuleAssignments(input.tenantId, input.clientId),
      fetchClientPortalLiveMetrics(input.tenantId, input.clientId).catch(() => EMPTY_METRICS),
      input.tenantNameHint?.trim()
        ? Promise.resolve(input.tenantNameHint.trim())
        : fetchTenantDisplayName(input.tenantId),
      fetchVisibilityRules(input.tenantId),
      fetchPortalClientCareProfile(input.tenantId, input.clientId),
      fetchFeatureMatrixFromDb(),
      fetchWidgetRegistryFromDb(),
    ]);

  const assignments = assignmentsResult.ok ? assignmentsResult.data : [];
  const assignmentLoadFailed = !assignmentsResult.ok;
  const activeModuleKeys = sortPortalModules(
    assignments.filter((a) => a.isActive).map((a) => a.moduleKey),
  );
  const primaryModule = resolvePrimaryModule(assignments);
  const hasModuleAssignments = !assignmentLoadFailed && activeModuleKeys.length > 0;
  const resolvedMetrics = metrics ?? EMPTY_METRICS;

  const widgetMetrics = hasModuleAssignments
    ? await fetchPortalWidgetData({
        tenantId: input.tenantId,
        clientId: input.clientId,
        activeModuleKeys,
        metrics: resolvedMetrics,
      }).catch(() => metricsToWidgetMetrics(resolvedMetrics))
    : metricsToWidgetMetrics(resolvedMetrics);

  const features = dbFeatures ?? PORTAL_FEATURE_MATRIX;
  const widgets = dbWidgets ?? PORTAL_WIDGET_REGISTRY;
  const moduleFeatures = hasModuleAssignments
    ? getFeaturesForModules(activeModuleKeys)
    : [];
  const baseVisibleFeatures = hasModuleAssignments
    ? filterVisibleFeatures(activeModuleKeys, portalRole, visibilityRules)
    : [];
  const visibleFeatures = hasModuleAssignments
    ? applyPortalFeatureGates({
        activeModuleKeys,
        portalRole,
        visibilityRules,
        careProfile,
        baseVisibleFeatures,
      })
    : [];

  return {
    tenantId: input.tenantId,
    clientId: input.clientId,
    roleKey: input.roleKey,
    portalRole,
    displayName: input.displayName,
    tenantName,
    modules: assignments,
    primaryModule,
    activeModuleKeys,
    features: hasModuleAssignments ? moduleFeatures : features.filter(() => false),
    visibleFeatures,
    widgets: hasModuleAssignments ? getWidgetsForModules(activeModuleKeys) : [],
    metrics: resolvedMetrics,
    widgetMetrics,
    hasModuleAssignments,
    visibilityRules,
    careProfile,
  };
}

/** Pure resolver for tests — no I/O. */
export function resolvePortalContextFromData(input: {
  tenantId: string;
  clientId: string;
  roleKey: RoleKey;
  displayName: string;
  tenantName: string;
  assignments: ClientModuleAssignment[];
  metrics?: PortalLiveMetrics;
  widgetMetrics?: PortalWidgetMetrics;
  visibilityRules?: PortalVisibilityRule[];
  careProfile?: PortalClientCareProfile;
}): PortalContext {
  const portalRole = resolvePortalActorRole(input.roleKey);
  const activeModuleKeys = sortPortalModules(
    input.assignments.filter((a) => a.isActive).map((a) => a.moduleKey),
  );
  const primaryModule = resolvePrimaryModule(input.assignments);
  const hasModuleAssignments = activeModuleKeys.length > 0;
  const rules = input.visibilityRules ?? [];
  const careProfile = input.careProfile ?? EMPTY_PORTAL_CARE_PROFILE;
  const resolvedMetrics = input.metrics ?? EMPTY_METRICS;
  const baseVisibleFeatures = hasModuleAssignments
    ? filterVisibleFeatures(activeModuleKeys, portalRole, rules)
    : [];
  const visibleFeatures = hasModuleAssignments
    ? applyPortalFeatureGates({
        activeModuleKeys,
        portalRole,
        visibilityRules: rules,
        careProfile,
        baseVisibleFeatures,
      })
    : [];

  return {
    tenantId: input.tenantId,
    clientId: input.clientId,
    roleKey: input.roleKey,
    portalRole,
    displayName: input.displayName,
    tenantName: input.tenantName,
    modules: input.assignments,
    primaryModule,
    activeModuleKeys,
    features: hasModuleAssignments ? getFeaturesForModules(activeModuleKeys) : [],
    visibleFeatures,
    widgets: hasModuleAssignments ? getWidgetsForModules(activeModuleKeys) : [],
    metrics: resolvedMetrics,
    widgetMetrics: input.widgetMetrics ?? metricsToWidgetMetrics(resolvedMetrics),
    hasModuleAssignments,
    visibilityRules: rules,
    careProfile,
  };
}
