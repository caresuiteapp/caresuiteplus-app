import { Platform } from 'react-native';
import { isConsultationWorkspaceEnabled } from '@/lib/beratung/workspaceRelease';
import { isUnreleasedModuleKey } from '@/lib/modules/constants';
import { PORTAL_MODULE_LABELS } from '@/lib/portal/engine/portalModuleKeys';
import type { ProductKey } from '@/types';

export const employeePortalWorkspaces = ['assist', 'pflege', 'beratung', 'akademie', 'office'] as const;
export type EmployeePortalWorkspace = typeof employeePortalWorkspaces[number];

export const employeePortalWorkspaceLabels = PORTAL_MODULE_LABELS;

export function employeePortalWorkspaceReleased(key: EmployeePortalWorkspace): boolean {
  if (isUnreleasedModuleKey(key)) return false;
  return key !== 'beratung' || (Platform.OS === 'web' && isConsultationWorkspaceEnabled());
}

/** Empty pre-existing personnel records retain the original Assist workspace. */
export function employeePortalPersonalProducts(products: readonly string[]): readonly string[] {
  return products.length ? products : ['assist'];
}

export function availableEmployeePortalWorkspaces(
  products: readonly string[],
  tenantAllows: (key: ProductKey) => boolean,
): EmployeePortalWorkspace[] {
  const personal = employeePortalPersonalProducts(products);
  return employeePortalWorkspaces.filter(key =>
    personal.includes(key) && employeePortalWorkspaceReleased(key) && tenantAllows(key),
  );
}

export function employeePortalWorkspaceStorageKey(tenantId: string, accountId: string, employeeId: string): string {
  return `caresuite.employee-portal.workspace.v1.${encodeURIComponent(JSON.stringify([tenantId, accountId, employeeId]))}`;
}

export function resolveEmployeePortalWorkspace(
  available: readonly EmployeePortalWorkspace[],
  saved: string | null,
): EmployeePortalWorkspace | null {
  return available.find(key => key === saved) ?? available[0] ?? null;
}
