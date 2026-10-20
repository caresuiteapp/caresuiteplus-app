import type { RoleKey } from '@/types';
import type { PermissionKey } from '@/types/permissions';
import { enforcePermission } from './enforce';

export type PermissionMatrixCase = {
  roleKey: RoleKey | null;
  permission: PermissionKey;
  shouldAllow: boolean;
};

const MATRIX: PermissionMatrixCase[] = [
  { roleKey: null, permission: 'dashboard.view', shouldAllow: false },
  { roleKey: 'business_admin', permission: 'dashboard.view', shouldAllow: true },
  { roleKey: 'business_admin', permission: 'office.access', shouldAllow: true },
  { roleKey: 'employee_portal', permission: 'office.access', shouldAllow: false },
  { roleKey: 'employee_portal', permission: 'portal.employee.messages.view', shouldAllow: true },
  { roleKey: 'client_portal', permission: 'portal.client.messages.view', shouldAllow: true },
  { roleKey: 'billing', permission: 'office.invoices.view', shouldAllow: true },
  { roleKey: 'nurse', permission: 'assist.execution.view', shouldAllow: true },
  { roleKey: 'counselor', permission: 'beratung.cases.view', shouldAllow: true },
  { roleKey: 'akademie_admin', permission: 'akademie.courses.view', shouldAllow: true },
];

/** WP089 — Permission-Enforcement Test-Matrix */
export function runPermissionMatrix(cases: PermissionMatrixCase[] = MATRIX): {
  passed: number;
  failed: number;
  failures: string[];
} {
  let passed = 0;
  let failed = 0;
  const failures: string[] = [];

  for (const testCase of cases) {
    const denied = enforcePermission(testCase.roleKey, testCase.permission);
    const allowed = denied === null;
    if (allowed === testCase.shouldAllow) {
      passed += 1;
    } else {
      failed += 1;
      failures.push(
        `${String(testCase.roleKey)} / ${testCase.permission}: expected ${testCase.shouldAllow ? 'allow' : 'deny'}`,
      );
    }
  }

  return { passed, failed, failures };
}
