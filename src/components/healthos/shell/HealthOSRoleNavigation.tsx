import type { RoleKey } from '@/types/core/auth';
import {
  getHealthOSNavConfig,
  filterNavItemsByRole,
  type HealthOSNavRoleKey,
} from '../navigation';
import { HealthOSDesktopSidebar } from './HealthOSDesktopSidebar';
import { HealthOSMobileBottomNav } from './HealthOSMobileBottomNav';
import { toMobileShellTabs } from '../navigation/resolveHealthOSNavigation';

type SidebarProps = {
  role: HealthOSNavRoleKey;
  userRoles?: RoleKey[];
  accentColor?: string;
  collapsed?: boolean;
  testID?: string;
};

type MobileProps = {
  role: HealthOSNavRoleKey;
  userRoles?: RoleKey[];
  accentColor?: string;
  testID?: string;
};

function resolveFilteredGroups(role: HealthOSNavRoleKey, userRoles: RoleKey[] = []) {
  const config = getHealthOSNavConfig(role);
  return config.groups.map((group) => ({
    ...group,
    items: filterNavItemsByRole(group.items, userRoles),
  }));
}

/** Renders role-based navigation from central HealthOS config. */
export function HealthOSRoleNavigationSidebar({
  role,
  userRoles,
  accentColor,
  collapsed,
  testID,
}: SidebarProps) {
  const groups = resolveFilteredGroups(role, userRoles);
  return (
    <HealthOSDesktopSidebar
      groups={groups}
      accentColor={accentColor}
      collapsed={collapsed}
      testID={testID ?? `healthos-role-nav-${role}`}
    />
  );
}

export function HealthOSRoleNavigationMobile({
  role,
  userRoles,
  accentColor,
  testID,
}: MobileProps) {
  const tabs = toMobileShellTabs(role, userRoles);
  return (
    <HealthOSMobileBottomNav
      tabs={tabs}
      accentColor={accentColor}
      testID={testID ?? `healthos-role-mobile-nav-${role}`}
    />
  );
}
