import type { RoleKey } from '../core/auth';
import type { ProductKey } from '../core/tenant';
import type { ModuleScopeKey, ModuleVisibilityStatus } from '../modules/visibility';

export type AppShellArea =
  | 'business'
  | 'office'
  | 'assist'
  | 'pflege'
  | 'beratung'
  | 'akademie'
  | 'stationaer'
  | 'portal_employee'
  | 'portal_client';

export type ShellTabConfig = {
  key: string;
  label: string;
  icon: string;
  href: string;
  /** Nur für bestimmte Rollen sichtbar */
  allowedRoles?: RoleKey[];
  /** Modul-Sichtbarkeit — fehlt = immer sichtbar (z. B. Dashboard) */
  moduleScopeKey?: ModuleScopeKey;
};

export type ModuleSwitcherItem = {
  productKey: ProductKey;
  label: string;
  icon: string;
  description: string;
  path: string;
  accentColor: string;
  isActive: boolean;
  visibilityStatus: ModuleVisibilityStatus;
  isVisible: boolean;
  isNavigable: boolean;
  badgeLabel?: string;
};
