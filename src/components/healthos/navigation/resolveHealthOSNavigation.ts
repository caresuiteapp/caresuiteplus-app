import type { RoleKey } from '@/types/core/auth';
import type { ShellTabConfig } from '@/types/navigation/shell';
import {
  HEALTHOS_NAV_BY_ROLE,
  type HealthOSNavRoleKey,
} from './healthosNavigationConfig';
import type { HealthOSNavItem, HealthOSNavVisibility } from './types';

export function resolveNavVisibility(item: HealthOSNavItem): HealthOSNavVisibility {
  return item.visibility ?? 'visible';
}

export function isNavItemRenderable(item: HealthOSNavItem): boolean {
  const visibility = resolveNavVisibility(item);
  return visibility === 'visible' || visibility === 'disabled';
}

export function filterNavItemsByRole(
  items: HealthOSNavItem[],
  userRoles: RoleKey[] = [],
): HealthOSNavItem[] {
  return items.filter((item) => {
    if (!isNavItemRenderable(item)) return false;
    if (!item.allowedRoles?.length) return true;
    return item.allowedRoles.some((role) => userRoles.includes(role));
  });
}

export function getHealthOSNavConfig(role: HealthOSNavRoleKey) {
  return HEALTHOS_NAV_BY_ROLE[role];
}

export function getVisibleNavItemsForRole(
  role: HealthOSNavRoleKey,
  userRoles: RoleKey[] = [],
): HealthOSNavItem[] {
  const config = getHealthOSNavConfig(role);
  return config.groups.flatMap((group) => filterNavItemsByRole(group.items, userRoles));
}

export function getNavAreaKeys(role: HealthOSNavRoleKey): string[] {
  return getVisibleNavItemsForRole(role).map((item) => item.key);
}

export function toShellTabConfig(item: HealthOSNavItem): ShellTabConfig | null {
  if (resolveNavVisibility(item) !== 'visible' || !item.href) return null;
  return {
    key: item.key,
    label: item.label,
    icon: item.icon,
    href: item.href,
    allowedRoles: item.allowedRoles,
  };
}

export function toMobileShellTabs(
  role: HealthOSNavRoleKey,
  userRoles: RoleKey[] = [],
): ShellTabConfig[] {
  return getVisibleNavItemsForRole(role, userRoles)
    .map(toShellTabConfig)
    .filter((tab): tab is ShellTabConfig => tab !== null);
}
