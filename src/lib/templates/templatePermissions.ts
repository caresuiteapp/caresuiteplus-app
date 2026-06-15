import type { PermissionKey } from '@/types/permissions';

export const TEMPLATE_VIEW_PERMISSION: PermissionKey = 'office.catalogs.view';
export const TEMPLATE_EDIT_PERMISSION: PermissionKey = 'office.catalogs.edit';

export function canViewTemplates(roleKey: string | null | undefined): boolean {
  return roleKey != null;
}

export function canEditTemplates(roleKey: string | null | undefined): boolean {
  return roleKey === 'business_admin' || roleKey === 'business_manager';
}
