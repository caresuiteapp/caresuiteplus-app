import type { PortalModuleKey, PortalWidget } from '@/lib/portal/types';
import { PORTAL_MODULE_PRIORITY } from './portalModuleKeys';

/** Static widget registry — mirrors migration 0099 seed. */
export const PORTAL_WIDGET_REGISTRY: PortalWidget[] = [
  { moduleKey: 'global', widgetKey: 'messages_kpi', title: 'Nachrichten', description: 'Offene Nachrichten', emptyState: 'Noch keine Nachrichten.', priority: 100, featureKey: 'messages', sortOrder: 10 },
  { moduleKey: 'global', widgetKey: 'documents_kpi', title: 'Dokumente', description: 'Freigegebene Dokumente', emptyState: 'Noch keine Dokumente freigegeben.', priority: 90, featureKey: 'documents', sortOrder: 20 },
  { moduleKey: 'global', widgetKey: 'appointments_kpi', title: 'Termine', description: 'Anstehende Termine', emptyState: 'Keine Termine geplant.', priority: 80, featureKey: 'appointments', sortOrder: 30 },
  { moduleKey: 'assist', widgetKey: 'assist_next_visit', title: 'Nächster Assist-Termin', description: 'Ihr nächster geplanter Besuch', emptyState: 'Noch kein Assist-Termin geplant.', priority: 60, featureKey: 'appointments', sortOrder: 10 },
  { moduleKey: 'assist', widgetKey: 'assist_trips', title: 'Assist-Fahrten', description: 'Geplante Fahrten', emptyState: 'Keine Fahrten geplant.', priority: 50, featureKey: 'trips', sortOrder: 20 },
  { moduleKey: 'pflege', widgetKey: 'pflege_care_plan', title: 'Pflegeplan', description: 'Aktueller Pflegeplan', emptyState: 'Pflegeplan noch nicht freigegeben.', priority: 10, featureKey: 'care_plan', sortOrder: 10 },
  { moduleKey: 'pflege', widgetKey: 'pflege_vitals', title: 'Vitalwerte', description: 'Letzte Vitalwerte', emptyState: 'Noch keine Vitalwerte freigegeben.', priority: 20, featureKey: 'vitals', sortOrder: 20 },
  { moduleKey: 'pflege', widgetKey: 'pflege_medications', title: 'Medikation', description: 'Medikationsübersicht', emptyState: 'Medikationsplan noch nicht freigegeben.', priority: 30, featureKey: 'medications', sortOrder: 30 },
  { moduleKey: 'stationaer', widgetKey: 'stationaer_meals', title: 'Speiseplan', description: 'Heutiger Speiseplan', emptyState: 'Speiseplan noch nicht verfügbar.', priority: 40, featureKey: 'meals', sortOrder: 10 },
  { moduleKey: 'stationaer', widgetKey: 'stationaer_activities', title: 'Aktivitäten', description: 'Anstehende Aktivitäten', emptyState: 'Keine Aktivitäten geplant.', priority: 45, featureKey: 'activities', sortOrder: 20 },
  { moduleKey: 'beratung', widgetKey: 'beratung_next_session', title: 'Nächste Beratung', description: 'Ihr nächstes Beratungsgespräch', emptyState: 'Noch kein Beratungstermin geplant.', priority: 55, featureKey: 'consultations', sortOrder: 10 },
  { moduleKey: 'beratung', widgetKey: 'beratung_cases', title: 'Beratungsfälle', description: 'Laufende Beratungsfälle', emptyState: 'Keine aktiven Beratungsfälle.', priority: 50, featureKey: 'cases', sortOrder: 20 },
];

export function getWidgetsForModules(modules: PortalModuleKey[]): PortalWidget[] {
  const moduleSet = new Set<PortalModuleKey | 'global'>([...modules, 'global' as const]);
  return PORTAL_WIDGET_REGISTRY.filter((w) => moduleSet.has(w.moduleKey));
}

/** Lower priority number = shown first. Pflege widgets surface before other modules. */
export function compareWidgetOrder(
  a: PortalWidget,
  b: PortalWidget,
  activeModules: PortalModuleKey[],
): number {
  const moduleRank = (key: PortalModuleKey | 'global') =>
    key === 'global' ? 0 : PORTAL_MODULE_PRIORITY[key];

  const activeSet = new Set(activeModules);
  const aActive = a.moduleKey === 'global' || activeSet.has(a.moduleKey);
  const bActive = b.moduleKey === 'global' || activeSet.has(b.moduleKey);
  if (aActive !== bActive) return aActive ? -1 : 1;

  const rankDiff = moduleRank(a.moduleKey) - moduleRank(b.moduleKey);
  if (rankDiff !== 0) return rankDiff;

  const priorityDiff = a.priority - b.priority;
  if (priorityDiff !== 0) return priorityDiff;

  return a.sortOrder - b.sortOrder;
}
