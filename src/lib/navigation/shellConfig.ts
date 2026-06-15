import type { AppShellArea, ModuleSwitcherItem, ShellTabConfig } from '@/types/navigation/shell';
import type { RoleKey } from '@/types';
import { MODULE_NAV_CONFIG } from '@/data/demo/navigation';
import { PRODUCT_LABELS } from '@/data/demo/products';
import { getEffectiveModuleAccess } from '@/lib/modules/moduleAccessService';
import {
  isModuleScopeVisible,
  resolveModuleNavState,
} from '@/lib/modules/moduleVisibilityService';
import type { ProductKey } from '@/types';

export const OFFICE_TABS: ShellTabConfig[] = [
  { key: 'index', label: 'Übersicht', icon: '🏠', href: '/office' },
  { key: 'clients', label: 'Klient:innen', icon: '👥', href: '/office/clients' },
  { key: 'employees', label: 'Team', icon: '👤', href: '/office/employees' },
  { key: 'appointments', label: 'Termine', icon: '📅', href: '/office/appointments' },
  { key: 'invoices', label: 'Rechnungen', icon: '🧾', href: '/office/invoices' },
  { key: 'documents', label: 'Dokumente', icon: '📄', href: '/office/documents' },
  { key: 'messages', label: 'Nachrichten', icon: '💬', href: '/office/messages' },
  { key: 'modules', label: 'Module', icon: '🧩', href: '/business/office/modules' },
];

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
  { key: 'office', label: 'Office', icon: '🏢', href: '/office', moduleScopeKey: 'office' },
  {
    key: 'messages',
    label: 'Nachrichten',
    icon: '💬',
    href: '/business/messages',
    moduleScopeKey: 'communication',
  },
  { key: 'templates', label: 'Vorlagen', icon: '📝', href: '/business/templates', moduleScopeKey: 'templates' },
  {
    key: 'reporting',
    label: 'PDL',
    icon: '📈',
    href: '/business/reporting',
    moduleScopeKey: 'reporting',
  },
  { key: 'ops', label: 'Betrieb', icon: '🚀', href: '/business/ops', moduleScopeKey: 'ops' },
  { key: 'modules', label: 'Module', icon: '🧩', href: '/business/modules', moduleScopeKey: 'modules_hub' },
  {
    key: 'subscription',
    label: 'Plattform',
    icon: '🆓',
    href: '/business/subscription',
    moduleScopeKey: 'subscription',
  },
  {
    key: 'platform',
    label: 'Plattform',
    icon: '🤖',
    href: '/business/platform',
    moduleScopeKey: 'platform',
  },
  {
    key: 'integrations',
    label: 'Integrationen',
    icon: '🔌',
    href: '/business/integrations',
    moduleScopeKey: 'integrations',
  },
];

export const PORTAL_EMPLOYEE_TABS: ShellTabConfig[] = [
  { key: 'index', label: 'Übersicht', icon: '🏠', href: '/portal/employee' },
  { key: 'assignments', label: 'Einsätze', icon: '📅', href: '/portal/employee/assignments' },
  { key: 'messages', label: 'Nachrichten', icon: '💬', href: '/portal/employee/messages' },
  { key: 'documents', label: 'Dokumente', icon: '📄', href: '/portal/employee/documents' },
  { key: 'profile', label: 'Profil', icon: '👤', href: '/portal/employee/profile' },
];

export const PORTAL_CLIENT_TABS: ShellTabConfig[] = [
  { key: 'index', label: 'Übersicht', icon: '🏠', href: '/portal/client' },
  { key: 'appointments', label: 'Termine', icon: '📅', href: '/portal/client/appointments' },
  { key: 'messages', label: 'Nachrichten', icon: '💬', href: '/portal/client/messages' },
  { key: 'documents', label: 'Dokumente', icon: '📄', href: '/portal/client/documents' },
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
    if (tab.allowedRoles?.length && context.roleKey) {
      if (!tab.allowedRoles.includes(context.roleKey)) return false;
    }
    if (!tab.moduleScopeKey) return true;
    return isModuleScopeVisible(tab.moduleScopeKey, context);
  });
}

export function getModuleSwitcherItems(
  tenantId: string,
  roleKey?: RoleKey | null,
): ModuleSwitcherItem[] {
  if (!tenantId?.trim()) return [];
  const access = getEffectiveModuleAccess(tenantId);
  const context = { tenantId, roleKey };

  return (Object.keys(MODULE_NAV_CONFIG) as ProductKey[])
    .map((key) => {
      const config = MODULE_NAV_CONFIG[key];
      const moduleAccess = access.find((entry) => entry.productKey === key);
      const navState = resolveModuleNavState(key, context);
      return {
        productKey: key,
        label: PRODUCT_LABELS[key],
        icon: config.icon,
        description: config.description,
        path: config.path,
        accentColor: config.accentColor,
        isActive: moduleAccess?.isEffective ?? false,
        visibilityStatus: navState.effectiveStatus,
        isVisible: navState.isVisible,
        isNavigable: navState.isNavigable,
        badgeLabel: navState.badgeLabel,
      };
    })
    .filter((item) => item.isVisible);
}

/** Ermittelt aktiven Tab-Key aus dem Pfad (für Custom TabBar). */
export function resolveActiveTabKey(pathname: string, tabs: ShellTabConfig[]): string {
  const normalized = pathname.split('?')[0].replace(/\/$/, '') || '/';
  const sorted = [...tabs].sort((a, b) => b.href.length - a.href.length);
  const match = sorted.find(
    (tab) => normalized === tab.href || normalized.startsWith(`${tab.href}/`),
  );
  return match?.key ?? tabs[0]?.key ?? 'index';
}
