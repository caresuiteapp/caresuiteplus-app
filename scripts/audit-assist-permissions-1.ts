#!/usr/bin/env npx tsx
/**
 * ASSIST.PERMISSIONS.1 — Employee permission onboarding + arrived fallback audit (22 checks).
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname ?? '.', '..');
type CheckResult = { id: string; label: string; ok: boolean; detail: string };
const checks: CheckResult[] = [];

function check(id: string, label: string, ok: boolean, detail: string) {
  checks.push({ id, label, ok, detail });
}

function fileExists(rel: string): boolean {
  return existsSync(join(ROOT, rel));
}

function fileContains(rel: string, needle: string): boolean {
  if (!fileExists(rel)) return false;
  return readFileSync(join(ROOT, rel), 'utf8').includes(needle);
}

check('AP1-01', 'Preflight doc', fileExists('docs/audit/assist-permissions-1-preflight.md'), 'preflight');
check('AP1-02', 'employeePermissionCenter', fileExists('src/features/employeePermissions/employeePermissionCenter.ts'), 'center');
check('AP1-03', 'getEmployeePermissionOverview', fileContains('src/features/employeePermissions/employeePermissionCenter.ts', 'getEmployeePermissionOverview'), 'overview');
check('AP1-04', 'requestLocationPermissionOnce', fileContains('src/features/employeePermissions/employeePermissionCenter.ts', 'requestLocationPermissionOnce'), 'once');
check('AP1-05', 'needsPermissionOnboarding', fileContains('src/features/employeePermissions/employeePermissionCenter.ts', 'needsPermissionOnboarding'), 'onboarding gate');
check('AP1-06', 'EmployeePermissionOnboarding UI', fileExists('src/components/portal/EmployeePermissionOnboarding.tsx'), 'ui');
check('AP1-07', 'Migration 0206', fileExists('supabase/migrations/0206_employee_permission_onboarding.sql'), 'ddl');
check('AP1-08', 'employee_permission_states table', fileContains('supabase/migrations/0206_employee_permission_onboarding.sql', 'employee_permission_states'), 'states');
check('AP1-09', 'employee_consent_bundle table', fileContains('supabase/migrations/0206_employee_permission_onboarding.sql', 'employee_consent_bundle'), 'bundle');
check('AP1-10', 'arrived_without_gps event type', fileContains('supabase/migrations/0206_employee_permission_onboarding.sql', 'arrived_without_gps'), 'audit event');
check('AP1-11', 'markArrived fallback', fileContains('src/features/assistWorkflow/markArrived.ts', 'arrived_without_gps'), 'no block');
check('AP1-12', 'Hook does not block on GPS deny', !fileContains('src/hooks/useEmployeePortalVisitExecution.ts', 'if (!pos.ok && localConsent?.granted)'), 'hook fix');
check('AP1-13', 'requestLocationPermissionOnce in startDrive', fileContains('src/hooks/useEmployeePortalVisitExecution.ts', 'requestLocationPermissionOnce'), 'strategic prompt');
check('AP1-14', 'arrivalProof on snapshot', fileContains('src/types/modules/employeePortalTracking.ts', 'arrivalProof'), 'type');
check('AP1-15', 'Portal shell onboarding', fileContains('src/components/portal/EmployeePortalShell.tsx', 'EmployeePermissionOnboarding'), 'shell');
check('AP1-16', 'Yellow warning UI', fileContains('src/screens/portal/EmployeePortalVisitExecutionScreen.tsx', 'localWarning'), 'warning not blocker');
check('AP1-17', 'Assist live arrival proof', fileContains('src/screens/assist/AssistLiveStatusScreen.tsx', 'arrivalProof'), 'office');
check('AP1-18', 'Persistence audit events', fileContains('src/lib/portal/employeePortalVisitTrackingPersistence.ts', 'arrived_without_gps'), 'persist');
check('AP1-19', 'Unit tests', fileExists('src/__tests__/employeePermissions/assistPermissions1.test.ts'), 'vitest');
check('AP1-20', '0205 not duplicated', !fileContains('supabase/migrations/0206_employee_permission_onboarding.sql', 'CREATE TABLE IF NOT EXISTS public.employee_location_consents'), '0205 untouched');
check('AP1-21', 'Abnahmebericht', fileExists('docs/audit/assist-permissions-1-abnahmebericht.md'), 'abnahme');
check('AP1-22', 'TypeScript event types', fileContains('src/types/assistExecutionPersistence.ts', 'arrived_manual'), 'types');

const passed = checks.filter((c) => c.ok).length;
const failed = checks.filter((c) => !c.ok);

console.log('\n=== ASSIST.PERMISSIONS.1 Audit ===\n');
for (const c of checks) {
  console.log(`${c.ok ? '✓' : '✗'} [${c.id}] ${c.label}`);
  if (!c.ok) console.log(`    → ${c.detail}`);
}
console.log(`\nErgebnis: ${passed}/${checks.length} bestanden\n`);
process.exit(failed.length > 0 ? 1 : 0);
