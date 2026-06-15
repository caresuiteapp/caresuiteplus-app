import type { ProductKey, RoleKey } from '@/types';

export type RouteGroup =
  | 'public'
  | 'auth'
  | 'business'
  | 'module'
  | 'portal'
  | 'system'
  | 'settings';

export type AppRoute = {
  /** Expo-Router-Pfad */
  path: string;
  /** Deutscher Anzeigename */
  label: string;
  group: RouteGroup;
  /** Zugehöriges Modul (falls Modul-Route) */
  productKey?: ProductKey;
  /** Erforderliche Rollen (leer = alle authentifizierten) */
  allowedRoles?: RoleKey[];
  /** Auth erforderlich */
  requiresAuth: boolean;
  /** Kind-Routen für Navigation-Übersicht */
  children?: string[];
};

export type NavigationEntry = {
  path: string;
  label: string;
  description: string;
  icon: string;
  accentColor: string;
  requiresAuth: boolean;
  demoProfileId?: string;
};
