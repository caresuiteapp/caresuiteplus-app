import type {
  PortalContext,
  PortalDashboardWidget,
  PortalModuleKey,
  PortalWidgetMetrics,
} from '@/lib/portal/types';
import { compareWidgetOrder, getWidgetsForModules } from './portalWidgetRegistry';
import { isFeatureVisible } from './portalVisibility';

function metricForWidget(
  widgetKey: string,
  widgetMetrics: PortalWidgetMetrics,
): number | null {
  const value = widgetMetrics[widgetKey];
  return value !== undefined ? value : null;
}

export function buildPortalDashboard(
  context: Pick<
    PortalContext,
    'activeModuleKeys' | 'visibleFeatures' | 'widgets' | 'widgetMetrics' | 'portalRole'
  >,
  options?: {
    activeModuleFilter?: PortalModuleKey | 'all';
    visibilityRules?: Parameters<typeof isFeatureVisible>[3];
  },
): PortalDashboardWidget[] {
  const moduleFilter = options?.activeModuleFilter ?? 'all';
  const rules = options?.visibilityRules ?? [];

  const widgets =
    context.widgets.length > 0
      ? context.widgets
      : getWidgetsForModules(context.activeModuleKeys);

  const visibleFeatureKeys = new Set(
    context.visibleFeatures.map((f) => `${f.moduleKey}:${f.featureKey}`),
  );

  const filtered = widgets.filter((widget) => {
    if (moduleFilter !== 'all' && widget.moduleKey !== 'global' && widget.moduleKey !== moduleFilter) {
      return false;
    }
    if (!context.activeModuleKeys.includes(widget.moduleKey) && widget.moduleKey !== 'global') {
      return false;
    }
    if (widget.featureKey) {
      const featureVisible =
        widget.moduleKey === 'global'
          ? context.visibleFeatures.some((f) => f.featureKey === widget.featureKey)
          : visibleFeatureKeys.has(`${widget.moduleKey}:${widget.featureKey}`) &&
            isFeatureVisible(
              widget.moduleKey as PortalModuleKey,
              widget.featureKey,
              context.portalRole,
              rules,
            );
      if (!featureVisible) return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) =>
    compareWidgetOrder(a, b, context.activeModuleKeys),
  );

  return sorted.map((widget) => ({
    ...widget,
    visible: true,
    metricValue: metricForWidget(widget.widgetKey, context.widgetMetrics),
  }));
}
