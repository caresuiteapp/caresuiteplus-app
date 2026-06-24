import type { RoleKey } from '../core/auth';
import type { ProductKey } from '../core/tenant';

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
  moduleScopeKey?: string;
  /** Nur für bestimmte Rollen sichtbar */
  allowedRoles?: RoleKey[];
};

export type ModuleSwitcherItem = {
  productKey: ProductKey;
  label: string;
  icon: string;
  description: string;
  path: string;
  accentColor: string;
  isActive: boolean;
};
