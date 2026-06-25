import type { PermissionKey } from '@/types';
import type { PermissionCatalogEntry, PermissionMatrixAction } from '@/types/permissions/rbac';
import { ACTION_SUFFIXES } from './permissionMatrixBuilder';

export type PermissionOverrideDraft = {
  permissionKey: PermissionKey;
  allowed: boolean;
};

export function resolveRoleBasePermissions(
  rolePermissions: PermissionKey[],
): PermissionKey[] {
  return [...new Set(rolePermissions)].sort();
}

export function diffPermissionsToOverrides(
  basePermissions: PermissionKey[],
  desiredPermissions: PermissionKey[],
): PermissionOverrideDraft[] {
  const base = new Set(basePermissions);
  const desired = new Set(desiredPermissions);
  const overrides: PermissionOverrideDraft[] = [];

  for (const key of desired) {
    if (!base.has(key)) {
      overrides.push({ permissionKey: key, allowed: true });
    }
  }

  for (const key of base) {
    if (!desired.has(key)) {
      overrides.push({ permissionKey: key, allowed: false });
    }
  }

  return overrides;
}

export function applyOverridesToBase(
  basePermissions: PermissionKey[],
  overrides: PermissionOverrideDraft[],
): PermissionKey[] {
  const set = new Set(basePermissions);
  for (const override of overrides) {
    if (override.allowed) {
      set.add(override.permissionKey);
    } else {
      set.delete(override.permissionKey);
    }
  }
  return [...set].sort();
}

export function findPermissionKeyForAreaAction(
  areaKey: string,
  action: PermissionMatrixAction,
  catalog: PermissionCatalogEntry[],
  availableKeys: PermissionKey[],
): PermissionKey | null {
  const candidates = catalog.filter(
    (entry) =>
      availableKeys.includes(entry.key) &&
      (entry.key === areaKey || entry.key.startsWith(`${areaKey}.`)),
  );

  for (const suffix of ACTION_SUFFIXES[action]) {
    const match = candidates.find((entry) => entry.key.split('.').pop() === suffix);
    if (match) return match.key;
  }

  if (action === 'read') {
    const viewMatch = candidates.find((entry) => entry.key.endsWith('.view'));
    if (viewMatch) return viewMatch.key;
  }

  if (action === 'edit') {
    const manageMatch = candidates.find((entry) => entry.key.includes('.manage'));
    if (manageMatch) return manageMatch.key;
  }

  return candidates[0]?.key ?? null;
}

export function hasCriticalPermissionChanges(
  catalog: PermissionCatalogEntry[],
  before: PermissionKey[],
  after: PermissionKey[],
): boolean {
  const beforeSet = new Set(before);
  const afterSet = new Set(after);
  const changedKeys = new Set<PermissionKey>();

  for (const key of before) {
    if (!afterSet.has(key)) changedKeys.add(key);
  }
  for (const key of after) {
    if (!beforeSet.has(key)) changedKeys.add(key);
  }

  for (const key of changedKeys) {
    const entry = catalog.find((item) => item.key === key);
    if (entry?.riskLevel === 'critical' || entry?.riskLevel === 'high') {
      return true;
    }
  }

  return false;
}

export function validateCriticalChangeReason(
  catalog: PermissionCatalogEntry[],
  before: PermissionKey[],
  after: PermissionKey[],
  reason: string | null | undefined,
): string | null {
  if (!hasCriticalPermissionChanges(catalog, before, after)) return null;
  if (!reason?.trim()) {
    return 'Für kritische oder hochriskante Rechteänderungen ist eine Begründung erforderlich.';
  }
  return null;
}
