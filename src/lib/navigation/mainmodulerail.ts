import { resolveMainModuleAccent } from '@/lib/navigation/mainModuleAccent';
import { hasEffectiveModuleGateAccess } from '@/lib/modules/moduleAccessService';
import { resolveModuleNavState } from '@/lib/modules/moduleVisibilityService';
import {
  getTenantModuleSettingsCache,
  hasAnyTenantCenterModuleEnabled,
  isProductEnabledInTenantSettings,
  isTenantCenterProductKey,
} from '@/lib/tenant/tenantModuleSettingsCache';
import type { RoleKey, ProductKey } from '@/types';
import type { TenantModuleSettings } from '@/types/tenant/tenantCenter';
import type { MainModuleKey, MainModuleRailItem } from '@/types/navigation/platform';

/** Produktmodule in der Zentrale-Übersicht (ohne Zentrale/Admin). */
export const ZENTRALE_OVERVIEW_MODULE_KEYS: readonly MainModuleKey[] = [
  'office',
  'assist',
  'pflege',
  'stationaer',
  'beratung',
  'akademie',
] as const;

const ALWAYS_VISIBLE_RAIL_KEYS: readonly MainModuleKey[] = ['zentrale', 'admin'];

export type ModuleNavContext = {
  tenantId: string;
  roleKey?: RoleKey | null;
  tenantModules?: TenantModuleSettings | null;
};

function isProductModuleKey(key: MainModuleKey): key is ProductKey {
  return key !== 'zentrale' && key !== 'admin';
}

/** Mandant: Lizenz + Mandanten-Center-Toggles + Katalog-Sichtbarkeit. */
export function isMainModuleActiveForTenant(
  moduleKey: MainModuleKey,
  context: ModuleNavContext,
): boolean {
  if (ALWAYS_VISIBLE_RAIL_KEYS.includes(moduleKey)) return true;
  if (!isProductModuleKey(moduleKey)) return false;
  if (!context.tenantId?.trim()) return false;

  const navState = resolveModuleNavState(moduleKey, context);
  if (!navState.isVisible) return false;

  const tenantModules =
    context.tenantModules ?? getTenantModuleSettingsCache(context.tenantId);

  if (moduleKey === 'office') {
    return (
      hasAnyTenantCenterModuleEnabled(tenantModules) &&
      hasEffectiveModuleGateAccess(moduleKey, context.tenantId)
    );
  }

  if (isTenantCenterProductKey(moduleKey)) {
    if (!isProductEnabledInTenantSettings(tenantModules, moduleKey)) {
      return false;
    }
  }

  return hasEffectiveModuleGateAccess(moduleKey, context.tenantId);
}

export function getActiveOverviewModuleKeys(context: ModuleNavContext): MainModuleKey[] {
  return ZENTRALE_OVERVIEW_MODULE_KEYS.filter((key) =>
    isMainModuleActiveForTenant(key, context),
  );
}

export function getVisibleMainModuleRailItems(context: ModuleNavContext): MainModuleRailItem[] {
  return MAIN_MODULE_RAIL.filter((item) => isMainModuleActiveForTenant(item.key, context));
}

/** Fixed main-module rail — icons only, no detail navigation. */
export const MAIN_MODULE_RAIL: readonly MainModuleRailItem[] = [
  {
    key: 'zentrale',
    label: 'Zentrale',
    icon: '🏠',
    path: '/business',
    accentColor: resolveMainModuleAccent('zentrale'),
  },
  {
    key: 'office',
    label: 'Office',
    icon: '🏢',
    path: '/office',
    accentColor: resolveMainModuleAccent('office'),
  },
  {
    key: 'assist',
    label: 'Assist',
    icon: '🤝',
    path: '/assist',
    accentColor: resolveMainModuleAccent('assist'),
  },
  {
    key: 'pflege',
    label: 'Pflege',
    icon: '💊',
    path: '/pflege',
    accentColor: resolveMainModuleAccent('pflege'),
  },
  {
    key: 'stationaer',
    label: 'Stationär',
    icon: '🏥',
    path: '/stationaer',
    accentColor: resolveMainModuleAccent('stationaer'),
  },
  {
    key: 'beratung',
    label: 'Beratung',
    icon: '💬',
    path: '/beratung',
    accentColor: resolveMainModuleAccent('beratung'),
  },
  {
    key: 'akademie',
    label: 'Akademie',
    icon: '🎓',
    path: '/akademie',
    accentColor: resolveMainModuleAccent('akademie'),
  },
  {
    key: 'admin',
    label: 'Admin',
    icon: '⚙️',
    path: '/settings',
    accentColor: resolveMainModuleAccent('admin'),
  },
] as const;
