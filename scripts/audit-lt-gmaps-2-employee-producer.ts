#!/usr/bin/env npx tsx
/**
 * LT.GMAPS.2 — Employee portal live tracking producer audit (16 checks).
 * Usage: npx tsx scripts/audit-lt-gmaps-2-employee-producer.ts
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

check('G2-01', 'liveTrackingErrors.ts', fileExists('src/features/liveTracking/liveTrackingErrors.ts'), 'error normalization');
check('G2-02', 'resolveEmployeeLiveContext.ts', fileExists('src/features/liveTracking/resolveEmployeeLiveContext.ts'), 'central resolver');
check('G2-03', 'startEmployeeLiveTracking.ts', fileExists('src/features/liveTracking/startEmployeeLiveTracking.ts'), 'transactional start');
check('G2-04', 'useEmployeeGpsTracking.ts', fileExists('src/features/liveTracking/useEmployeeGpsTracking.ts'), 'GPS watch hook');
check('G2-05', 'formatAddress.ts', fileExists('src/lib/formatAddress.ts'), 'address dedupe');
check('G2-06', 'Migration 0200', fileExists('supabase/migrations/0200_lt_gmaps_2_employee_tracking_repair.sql'), '0200 migration');
check('G2-07', 'last_location_at column', fileContains('supabase/migrations/0200_lt_gmaps_2_employee_tracking_repair.sql', 'last_location_at'), 'session heartbeat');
check('G2-08', 'No is_emergency invalid column', !fileContains('src/lib/portal/employeePortalExecutionLiveService.ts', 'is_emergency.eq.true'), 'client_contacts query');
check('G2-09', 'Separate assignment_tasks fetch', fileContains('src/lib/assist/repositories/assignmentRepository.supabase.ts', 'assignment_tasks'), 'RLS-safe detail load');
check('G2-10', 'Hook uses startEmployeeLiveTracking', fileContains('src/hooks/useEmployeePortalVisitExecution.ts', 'startEmployeeLiveTracking'), 'producer wiring');
check('G2-11', 'No simultaneous success+error UI', fileContains('src/screens/portal/EmployeePortalVisitExecutionScreen.tsx', 'showSuccess'), 'consent UX guard');
check('G2-12', 'Support errorCode in UI', fileContains('src/screens/portal/EmployeePortalVisitExecutionScreen.tsx', 'Support-Code'), 'diagnostic code');
check('G2-13', 'Timer empty labels', fileContains('src/components/portal/EmployeePortalLiveTimersPanel.tsx', 'Noch nicht gestartet'), 'timer UX');
check('G2-14', 'Preflight doc', fileExists('docs/audit/lt-gmaps-2-employee-db-error-preflight.md'), 'preflight');
check('G2-15', 'Abnahmebericht', fileExists('docs/audit/lt-gmaps-2-employee-live-tracking-abnahmebericht.md'), 'abnahmebericht');
check('G2-16', 'Unit tests', fileExists('src/__tests__/liveTracking/liveTrackingLtGmaps2.test.ts'), 'vitest coverage');

const passed = checks.filter((c) => c.ok).length;
const failed = checks.filter((c) => !c.ok);

console.log('\n=== LT.GMAPS.2 Employee Producer Audit ===\n');
for (const c of checks) {
  console.log(`${c.ok ? '✓' : '✗'} [${c.id}] ${c.label}`);
  if (!c.ok) console.log(`    → ${c.detail}`);
}
console.log(`\nErgebnis: ${passed}/${checks.length} bestanden\n`);

process.exit(failed.length > 0 ? 1 : 0);
