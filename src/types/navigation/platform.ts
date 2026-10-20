import type { RoleKey } from '../core/auth';

export type MainModuleKey =
  | 'zentrale'
  | 'office'
  | 'assist'
  | 'pflege'
  | 'stationaer'
  | 'beratung'
  | 'akademie'
  | 'admin';

export type ModuleNavItem = {
  key: string;
  label: string;
  icon: string;
  href: string;
  badge?: string | number;
  allowedRoles?: RoleKey[];
  /** On web/desktop open PlatformModal instead of router.push */
  openInModal?: boolean;
  /** Key into MODULE_NAV_MODAL_SCREENS */
  modalKey?: string;
};

export type ModuleNavGroup = {
  title: string;
  items: ModuleNavItem[];
};

export type ModuleNavConfig = {
  moduleKey: MainModuleKey;
  label: string;
  groups: ModuleNavGroup[];
};

export type MainModuleRailItem = {
  key: MainModuleKey;
  label: string;
  icon: string;
  path: string;
  accentColor: string;
};
