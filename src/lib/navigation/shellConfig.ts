import type { AppShellArea, ModuleSwitcherItem, ShellTabConfig } from '@/types/navigation/shell';
import type { RoleKey } from '@/types';
import { MODULE_NAV_CONFIG } from '@/data/navigation/moduleNavConfig';
import { PRODUCT_LABELS } from '@/data/constants/productLabels';
import { getEffectiveModuleAccess } from '@/lib/modules/moduleAccessService';
import {
  isModuleScopeVisible,
  resolveModuleNavState,
} from '@/lib/modules/moduleVisibilityService';
import {
  getTenantModuleSettingsCache,
  isProductEnabledInTenantSettings,
  isTenantCenterProductKey,
} from '@/lib/tenant/tenantModuleSettingsCache';
import type { ProductKey } from '@/types';
import { buildOfficeTabs } from './officeNavigation';
import { buildEmployeePortalPrimaryTabs } from './employeePortalNavigation';

export const OFFICE_TABS: ShellTabConfig[] = buildOfficeTabs();

export const ASSIST_TABS: ShellTabConfig[] = [
  { key: 'index', label: 'Übersicht', icon: '🏠', href: '/assist' },
  { key: 'assignments', label: 'Einsätze', icon: '📋', href: '/assist/assignments' },
  { key: 'durchfuehrung', label: 'Durchführung', icon: '✅', href: '/assist/durchfuehrung' },
  { key: 'nachweise', label: 'Nachweise', icon: '📝', href: '/assist/nachweise' },
  { key: 'fahrten', label: 'Fahrten', icon: '🚗', href: '/assist/fahrten' },
  { key: 'calendar', label: 'Kalender', icon: '📅', href: '/assist/calendar' },
];

export const PFLEGE_TABS: ShellTabConfig[] = [
  { key: 'index', label: 'Übersicht', icon: '🏠', href: '/pflege' },
  { key: 'plans', label: 'Pflegepläne', icon: '📋', href: '/pflege/plans' },
  { key: 'vitalwerte', label: 'Vitalwerte', icon: '❤️', href: '/pflege/vitalwerte' },
];

export const BERATUNG_TABS: ShellTabConfig[] = [
  { key: 'index', label: 'Übersicht', icon: '🏠', href: '/beratung' },
  { key: 'cases', label: 'Fälle', icon: '📋', href: '/beratung/cases' },
];

export const AKADEMIE_TABS: ShellTabConfig[] = [
  { key: 'index', label: 'Übersicht', icon: '🏠', href: '/akademie' },
  { key: 'courses', label: 'Kurse', icon: '🎓', href: '/akademie/courses' },
];

export const STATIONAER_TABS: ShellTabConfig[] = [
  { key: 'index', label: 'Übersicht', icon: '🏠', href: '/stationaer' },
  { key: 'bewohner', label: 'Bewohner:innen', icon: '🏥', href: '/stationaer/bewohner' },
];

export const BUSINESS_TABS: ShellTabConfig[] = [
  { key: 'index', label: 'Dashboard', icon: '📊', href: '/business' },
  {
    key: 'schedule',
    label: 'Dienstplan',
    icon: '📅',
    href: '/pflege/dienstplaene',
    moduleScopeKey: 'pflege',
    allowedRoles: ['business_admin', 'business_manager', 'dispatch', 'nurse', 'caregiver', 'counselor'],
  },
  {
    key: 'clients',
    label: 'Klient:innen',
    icon: '👥',
    href: '/office/clients',
    moduleScopeKey: 'office',
    allowedRoles: ['business_admin', 'business_manager', 'billing', 'dispatch', 'nurse', 'caregiver', 'counselor'],
  },
  {
    key: 'employees',
    label: 'Mitarbeitende',
    icon: '👤',
    href: '/office/employees',
    moduleScopeKey: 'office',
    allowedRoles: ['business_admin', 'business_manager', 'billing', 'dispatch', 'nurse', 'caregiver', 'counselor'],
  },
  {
    key: 'messages',
    label: 'Nachrichten',
    icon: '💬',
    href: '/office/messages?audience=employees&view=chats&chatAge=new',
    moduleScopeKey: 'communication',
    allowedRoles: ['business_admin', 'business_manager', 'billing', 'dispatch', 'nurse', 'caregiver', 'counselor'],
  },
  {
    key: 'more',
    label: 'Mehr',
    icon: '⋯',
    href: '/business/modules',
    moduleScopeKey: 'modules_hub',
    allowedRoles: ['business_admin', 'business_manager', 'billing', 'dispatch', 'nurse', 'caregiver', 'counselor'],
  },
];

export const PORTAL_EMPLOYEE_TABS: ShellTabConfig[] = buildEmployeePortalPrimaryTabs();

export const PORTAL_CLIENT_TABS: ShellTabConfig[] = [
  { key: 'appointments', label: 'Einsätze', icon: '📅', href: '/portal/client/appointments' },
  { key: 'documents', label: 'Dokumente', icon: '📄', href: '/portal/client/documents' },
  { key: 'messages', label: 'Nachrichten', icon: '💬', href: '/portal/client/messages' },
  { key: 'profile', label: 'Profil', icon: '👤', href: '/portal/client/profile' },
];

export function getTabsForArea(
  area: AppShellArea,
  context: { tenantId?: string | null; roleKey?: RoleKey | null } = {},
): ShellTabConfig[] {
  const tabs = (() => {
    switch (area) {
      case 'business':
        return BUSINESS_TABS;
      case 'office':
        return OFFICE_TABS;
      case 'assist':
        return ASSIST_TABS;
      case 'pflege':
        return PFLEGE_TABS;
      case 'beratung':
        return BERATUNG_TABS;
      case 'akademie':
        return AKADEMIE_TABS;
      case 'stationaer':
        return STATIONAER_TABS;
      case 'portal_employee':
        return PORTAL_EMPLOYEE_TABS;
      case 'portal_client':
        return PORTAL_CLIENT_TABS;
      default:
        return [];
    }
  })();

  return tabs.filter((tab) => {
    if (tab.allowedRoles?.length) {
      if (!context.roleKey || !tab.allowedRoles.includes(context.roleKey)) return false;
    }
    if (!tab.moduleScopeKey) return true;
    return isModuleScopeVisible(tab.moduleScopeKey as import('@/types/modules/visibility').ModuleScopeKey, context);
  });
}

export function getModuleSwitcherItems(
  tenantId: string,
  roleKey?: RoleKey | null,
): ModuleSwitcherItem[] {
  if (!tenantId?.trim()) return [];
  const access = getEffectiveModuleAccess(tenantId);
  const context = { tenantId, roleKey };
  const tenantModules = getTenantModuleSettingsCache(tenantId);

  return (Object.keys(MODULE_NAV_CONFIG) as ProductKey[])
    .map((key) => {
      const config = MODULE_NAV_CONFIG[key];
      const moduleAccess = access.find((entry) => entry.productKey === key);
      const navState = resolveModuleNavState(key, context);
      const tenantCenterActive =
        !isTenantCenterProductKey(key) ||
        isProductEnabledInTenantSettings(tenantModules, key);
      return {
        productKey: key,
        label: PRODUCT_LABELS[key],
        icon: config.icon,
        description: config.description,
        path: config.path,
        accentColor: config.accentColor,
        isActive: (moduleAccess?.isEffective ?? false) && tenantCenterActive,
        visibilityStatus: navState.effectiveStatus,
        isVisible: navState.isVisible,
        isNavigable: navState.isNavigable,
        badgeLabel: navState.badgeLabel,
      };
    })
    .filter((item) => item.isVisible && item.isActive);
}

/** Ermittelt aktiven Tab-Key aus dem Pfad (für Custom TabBar). */
export function resolveActiveTabKey(pathname: string, tabs: ShellTabConfig[]): string {
  const normalized = pathname.split('?')[0].replace(/\/$/, '') || '/';
  const sorted = [...tabs].sort(
    (a, b) => b.href.split('?')[0].length - a.href.split('?')[0].length,
  );
  const match = sorted.find((tab) => {
    const href = tab.href.split('?')[0].replace(/\/$/, '') || '/';
    return normalized === href || normalized.startsWith(`${href}/`);
  });
  return match?.key ?? tabs[0]?.key ?? 'index';
}
