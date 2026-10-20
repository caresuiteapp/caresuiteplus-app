import type { RoleKey } from '@/types';
import type { PermissionKey } from '@/types/permissions';
import type { TIPermission } from '@/types/modules/ti';
import { checkPermission, enforcePermission } from '@/lib/permissions';

const TI_PERMISSION_MAP: Record<TIPermission, PermissionKey> = {
  'ti.view': 'ti.view',
  'ti.admin': 'ti.admin',
  'ti.kim.view': 'ti.kim.view',
  'ti.kim.manage': 'ti.kim.manage',
  'ti.consent.manage': 'ti.consent.manage',
  'ti.audit.view': 'ti.audit.view',
  'ti.provider.manage': 'ti.provider.manage',
  'ti.egk.view': 'ti.egk.view',
  'ti.epa.view': 'ti.epa.view',
  'ti.emp.view': 'ti.emp.view',
  'ti.erezept.view': 'ti.erezept.view',
};

export function hasTIPermission(
  roleKey: RoleKey | null | undefined,
  permission: TIPermission,
): boolean {
  const key = TI_PERMISSION_MAP[permission];
  return checkPermission(roleKey, key).allowed;
}

export function enforceTIPermission<T>(
  roleKey: RoleKey | null | undefined,
  permission: TIPermission,
) {
  const key = TI_PERMISSION_MAP[permission];
  return enforcePermission<T>(roleKey, key);
}

export function canAccessKIM(roleKey: RoleKey | null | undefined): boolean {
  return hasTIPermission(roleKey, 'ti.kim.view');
}

export function canManageProviders(roleKey: RoleKey | null | undefined): boolean {
  return hasTIPermission(roleKey, 'ti.provider.manage');
}

export function canViewAudit(roleKey: RoleKey | null | undefined): boolean {
  return hasTIPermission(roleKey, 'ti.audit.view');
}

export function canManageConsent(roleKey: RoleKey | null | undefined): boolean {
  return hasTIPermission(roleKey, 'ti.consent.manage');
}

export const TI_PERMISSION_LABELS: Record<TIPermission, string> = {
  'ti.view': 'TI-Modul ansehen',
  'ti.admin': 'TI-Administration',
  'ti.kim.view': 'KIM-Postfach ansehen',
  'ti.kim.manage': 'KIM-Nachrichten verwalten',
  'ti.consent.manage': 'TI-Einwilligungen verwalten',
  'ti.audit.view': 'TI-Audit-Log ansehen',
  'ti.provider.manage': 'TI-Provider verwalten',
  'ti.egk.view': 'eGK-Daten ansehen',
  'ti.epa.view': 'ePA-Zugriff ansehen',
  'ti.emp.view': 'eMP-Medikationsplan ansehen',
  'ti.erezept.view': 'E-Rezept ansehen',
};
