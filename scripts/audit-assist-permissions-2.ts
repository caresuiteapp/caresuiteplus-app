#!/usr/bin/env npx tsx
/**
 * ASSIST.PERMISSIONS.2 — Persistent consent + markArrived DB repair audit (24 checks).
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

check('AP2-01', 'Preflight doc', fileExists('docs/audit/assist-permissions-2-preflight.md'), 'preflight');
check('AP2-02', 'permissionConsentVersion.ts', fileExists('src/features/employeePermissions/permissionConsentVersion.ts'), 'version');
check('AP2-03', 'Canonical bundle version', fileContains('src/features/employeePermissions/permissionConsentVersion.ts', '2026-06-employee-portal-v1'), 'version key');
check('AP2-04', 'getEmployeeConsentBundle.ts', fileExists('src/features/employeePermissions/getEmployeeConsentBundle.ts'), 'read');
check('AP2-05', 'saveEmployeeConsentBundle.ts', fileExists('src/features/employeePermissions/saveEmployeeConsentBundle.ts'), 'write');
check('AP2-06', 'needsPermissionOnboarding module', fileExists('src/features/employeePermissions/needsPermissionOnboarding.ts'), 'gate');
check('AP2-07', 'getEmployeePermissionOverview module', fileExists('src/features/employeePermissions/getEmployeePermissionOverview.ts'), 'overview');
check('AP2-08', 'Migration 0207', fileExists('supabase/migrations/0207_assist_permissions_2_consent_repair.sql'), 'ddl');
check('AP2-08b', 'Migration 0208 dual-role RLS', fileExists('supabase/migrations/0208_assist_permissions_2b_dual_role_portal_rls.sql'), 'ddl');
check('AP2-08c', 'is_employee_portal_rls_context helper', fileContains('supabase/migrations/0208_assist_permissions_2b_dual_role_portal_rls.sql', 'is_employee_portal_rls_context'), 'helper');
check('AP2-09', 'Bundle version TEXT migration', fileContains('supabase/migrations/0207_assist_permissions_2_consent_repair.sql', 'ALTER COLUMN bundle_version TYPE TEXT'), 'text version');
check('AP2-10', 'Onboarding DB hydrate', fileContains('src/components/portal/EmployeePermissionOnboarding.tsx', 'getEmployeeConsentBundle'), 'hydrate');
check('AP2-11', 'Internal consent always persisted', fileContains('src/components/portal/EmployeePermissionOnboarding.tsx', 'persistInternalLocationConsent'), 'scope save');
check('AP2-12', 'markArrived execution state upsert', fileContains('src/features/assistWorkflow/markArrived.ts', 'upsertAssistVisitExecutionState'), 'exec state');
check('AP2-13', 'markArrived idempotent arrived', fileContains('src/features/assistWorkflow/markArrived.ts', "fromStatus === 'angekommen'"), 'idempotent');
check('AP2-14', 'No duplicate persist in transition', fileContains('src/features/assistWorkflow/markArrived.ts', 'skipStatusPersistence: true'), 'single persist');
check('AP2-15', 'Structured workflow errors', fileContains('src/features/assistWorkflow/markArrived.ts', 'assistWorkflowErrorToResult'), 'errors');
check('AP2-16', 'arrived_without_gps events', fileContains('src/lib/portal/employeePortalVisitTrackingPersistence.ts', 'arrived_without_gps'), 'audit');
check('AP2-17', 'Unit tests AP2', fileExists('src/__tests__/employeePermissions/assistPermissions2.test.ts'), 'vitest');
check('AP2-18', '0205 not duplicated', !fileContains('supabase/migrations/0207_assist_permissions_2_consent_repair.sql', 'CREATE TABLE IF NOT EXISTS public.employee_location_consents'), '0205 untouched');
check('AP2-19', '0206 not duplicated', !fileContains('supabase/migrations/0207_assist_permissions_2_consent_repair.sql', 'CREATE TABLE IF NOT EXISTS public.employee_consent_bundle'), '0206 repair only');
check('AP2-20', 'Read-back on bundle save', fileContains('src/features/employeePermissions/saveEmployeeConsentBundle.ts', 'readBack'), 'verify');
check('AP2-21', 'Location consent from DB in overview', fileContains('src/features/employeePermissions/getEmployeeConsentBundle.ts', 'fetchEmployeeLocationConsentRecord'), 'source of truth');
check('AP2-22', 'Abnahmebericht', fileExists('docs/audit/assist-permissions-2-abnahmebericht.md'), 'abnahme');
check('AP2-23', 'PERMISSIONS.1 hook regression', !fileContains('src/hooks/useEmployeePortalVisitExecution.ts', 'if (!pos.ok && localConsent?.granted)'), 'hook fix kept');
check('AP2-24', 'Execution state persistence module', fileExists('src/features/assistWorkflow/assistVisitExecutionStatePersistence.ts'), 'module');

const passed = checks.filter((c) => c.ok).length;
const failed = checks.filter((c) => !c.ok);

console.log('\n=== ASSIST.PERMISSIONS.2 Audit ===\n');
for (const c of checks) {
  console.log(`${c.ok ? '✓' : '✗'} [${c.id}] ${c.label}`);
  if (!c.ok) console.log(`    → ${c.detail}`);
}
console.log(`\nErgebnis: ${passed}/${checks.length} bestanden\n`);
process.exit(failed.length > 0 ? 1 : 0);
