import type { RoleKey } from '@/types/core/auth';

/** Navigation item visibility — hidden items are omitted from live UI. */
export type HealthOSNavVisibility = 'visible' | 'disabled' | 'hidden';

export type HealthOSNavRole =
  | 'office'
  | 'assist'
  | 'employee_portal'
  | 'client_portal';

export type HealthOSNavItem = {
  key: string;
  label: string;
  icon: string;
  /** Route reference only — no redirects applied by HealthOS layer. */
  href?: string;
  visibility?: HealthOSNavVisibility;
  allowedRoles?: RoleKey[];
  /** Internal planning note — never rendered in UI. */
  planningNote?: string;
};

export type HealthOSNavGroup = {
  title: string;
  items: HealthOSNavItem[];
};

export type HealthOSNavConfig = {
  role: HealthOSNavRole;
  label: string;
  groups: HealthOSNavGroup[];
};
