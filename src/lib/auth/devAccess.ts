import type { RoleKey } from '@/types';

const ADMIN_ROLES: RoleKey[] = ['business_admin', 'business_manager'];

const isDevBuild = typeof __DEV__ !== 'undefined' && __DEV__;

export function canAccessDeveloperTools(roleKey?: RoleKey | null): boolean {
  if (isDevBuild) return true;
  if (!roleKey) return false;
  return ADMIN_ROLES.includes(roleKey);
}
