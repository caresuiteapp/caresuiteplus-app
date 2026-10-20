import type { ProductKey, RoleKey } from '@/types';

/** Plattform-Reifegrad eines Moduls — unabhängig von Mandanten-Freischaltung. */
export type ModuleVisibilityStatus =
  | 'live'
  | 'beta'
  | 'internal'
  | 'coming_soon'
  | 'disabled';

/** Produktmodule + Business-Bereiche mit eigener Sichtbarkeit. */
export type ModuleScopeKey =
  | ProductKey
  | 'communication'
  | 'templates'
  | 'reporting'
  | 'ops'
  | 'ti'
  | 'platform'
  | 'integrations'
  | 'connect'
  | 'insight'
  | 'qm'
  | 'release'
  | 'roadmap'
  | 'security'
  | 'qa'
  | 'subscription'
  | 'modules_hub'
  | 'admin';

export type ModuleVisibilityCatalogEntry = {
  scopeKey: ModuleScopeKey;
  status: ModuleVisibilityStatus;
  label: string;
  hint?: string;
};

export type ModuleNavState = {
  scopeKey: ModuleScopeKey;
  catalogStatus: ModuleVisibilityStatus;
  effectiveStatus: ModuleVisibilityStatus;
  isVisible: boolean;
  isNavigable: boolean;
  isTenantActive: boolean;
  badgeLabel?: string;
  blockReason?: string;
};

export type ModuleVisibilityContext = {
  tenantId?: string | null;
  roleKey?: RoleKey | null;
};
