import type { ColorMode } from '@/design/tokens/colors';
import {
  MAIN_MODULE_RAIL,
  ZENTRALE_OVERVIEW_MODULE_KEYS,
  getActiveOverviewModuleKeys,
  type ModuleNavContext,
} from '@/lib/navigation/mainmodulerail';
import { resolveMainModuleAccent } from '@/lib/navigation/mainModuleAccent';
import type { DashboardKpi, DashboardModuleOverviewRow } from '@/types/dashboard';
import type { MainModuleKey } from '@/types/navigation/platform';
import {
  buildZentraleKpisFromMetrics,
  type BusinessDashboardMetrics,
} from '@/lib/dashboard/businessDashboardMetrics';
import { extractKpiSuffixFromId, resolveZentraleKpiRoute } from '@/lib/dashboard/zentraleKpiRoutes';
import { resolveZentraleModuleKpiIcon } from '@/lib/dashboard/zentraleModuleKpiIcons';

export type ZentraleModuleOverviewRow = DashboardModuleOverviewRow;

export const ZENTRALE_KPIS_PER_MODULE = 5;
export const ZENTRALE_MODULE_OVERVIEW_KPI_COUNT = 30;

export const ZENTRALE_MODULE_OVERVIEW_MODULES = ZENTRALE_OVERVIEW_MODULE_KEYS;

const MODULE_KPI_SUFFIXES: Record<MainModuleKey, readonly string[]> = {
  zentrale: [],
  office: ['clients-active', 'invoices', 'employees-active', 'appointments-week', 'clients-new'],
  assist: ['assignments', 'service-records', 'tasks', 'messages', 'documents-review'],
  pflege: ['clients-active', 'budget-warnings', 'tasks', 'portal-requests', 'clients-new'],
  stationaer: ['clients-total', 'clients-active', 'appointments-week', 'portal-users', 'employees-active'],
  beratung: ['clients-active', 'appointments-week', 'messages', 'tasks', 'clients-new'],
  akademie: ['modules', 'portal-users', 'employees-active', 'documents-review', 'tasks'],
  admin: [],
};

function stripParentheticalText(text: string): string {
  return text.replace(/\s*\([^)]*\)/g, '').trim();
}

function pickModuleKpis(
  allKpis: DashboardKpi[],
  moduleKey: MainModuleKey,
  idPrefix: 'kpi' | 'office-kpi',
  accentColor: string,
): DashboardKpi[] {
  const kpiById = new Map(allKpis.map((kpi) => [kpi.id, kpi]));
  const suffixes = MODULE_KPI_SUFFIXES[moduleKey];

  return suffixes.map((suffix) => {
    const id = `${idPrefix}-${suffix}`;
    const kpi = kpiById.get(id);
    if (!kpi) {
      throw new Error(`Missing KPI ${id} for module ${moduleKey}`);
    }
    return {
      ...kpi,
      label: stripParentheticalText(kpi.label),
      icon: resolveZentraleModuleKpiIcon(moduleKey, suffix) ?? kpi.icon,
      accentColor,
      route: resolveZentraleKpiRoute(moduleKey, extractKpiSuffixFromId(id)),
    };
  });
}

export function buildZentraleModuleOverviewRows(
  metrics: BusinessDashboardMetrics,
  mode: ColorMode = 'dark',
  idPrefix: 'kpi' | 'office-kpi' = 'kpi',
  context?: ModuleNavContext,
): ZentraleModuleOverviewRow[] {
  const allKpis = buildZentraleKpisFromMetrics(metrics, idPrefix);
  const moduleKeys = context?.tenantId
    ? getActiveOverviewModuleKeys(context)
    : [...ZENTRALE_OVERVIEW_MODULE_KEYS];

  return moduleKeys.map((moduleKey) => {
    const railItem = MAIN_MODULE_RAIL.find((item) => item.key === moduleKey);
    const accentColor = resolveMainModuleAccent(moduleKey, mode);
    const kpis = pickModuleKpis(allKpis, moduleKey, idPrefix, accentColor);

    return {
      moduleKey,
      label: railItem?.label ?? moduleKey,
      accentColor,
      kpis,
    };
  });
}
