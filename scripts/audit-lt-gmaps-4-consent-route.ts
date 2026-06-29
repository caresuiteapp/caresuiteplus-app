#!/usr/bin/env npx tsx
/**
 * LT.GMAPS.4 — Consent loop + route context audit (18 checks).
 * Usage: npx tsx scripts/audit-lt-gmaps-4-consent-route.ts
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

check('G4-01', 'saveEmployeeLocationConsent.ts', fileExists('src/features/liveTracking/saveEmployeeLocationConsent.ts'), 'idempotent consent upsert');
check('G4-02', 'getEmployeeLocationConsent.ts', fileExists('src/features/liveTracking/getEmployeeLocationConsent.ts'), 'consent read-back');
check('G4-03', 'buildEmployeePortalLiveRoute.ts', fileExists('src/features/liveTracking/buildEmployeePortalLiveRoute.ts'), 'live route builder');
check('G4-04', 'Uses resolveEmployeeLiveContext (save)', fileContains('src/features/liveTracking/saveEmployeeLocationConsent.ts', 'resolveEmployeeLiveContext'), 'canonical context');
check('G4-05', 'Uses resolveEmployeeLiveContext (route)', fileContains('src/features/liveTracking/buildEmployeePortalLiveRoute.ts', 'resolveEmployeeLiveContext'), 'no demo workflow');
check('G4-06', 'Idempotent read-back verify', fileContains('src/features/liveTracking/saveEmployeeLocationConsent.ts', 'verifyConsentReadBack'), 'persist verify');
check('G4-07', 'Migration 0202', fileExists('supabase/migrations/0202_live_tracking_consent_route_repair.sql'), 'RLS repair');
check('G4-08', 'portal_employee_assigned_visit_ids', fileContains('supabase/migrations/0202_live_tracking_consent_route_repair.sql', 'portal_employee_assigned_visit_ids'), 'visit scope fn');
check('G4-09', 'Hook uses saveEmployeeLocationConsent', fileContains('src/hooks/useEmployeePortalVisitExecution.ts', 'saveEmployeeLocationConsent'), 'consent wiring');
check('G4-10', 'Hook uses buildEmployeePortalLiveRoute', fileContains('src/hooks/useEmployeePortalVisitExecution.ts', 'buildEmployeePortalLiveRoute'), 'route wiring');
check('G4-11', 'No buildEmployeePortalRoute in hook', !fileContains('src/hooks/useEmployeePortalVisitExecution.ts', 'buildEmployeePortalRoute'), 'removed demo route');
check('G4-12', 'Consent from liveContext', fileContains('src/hooks/useEmployeePortalVisitExecution.ts', 'liveContext?.consentStatus.granted'), 'no refetch overwrite');
check('G4-13', 'Consent button disabled while loading', fileContains('src/components/portal/EmployeePortalLocationConsentBanner.tsx', 'disabled={loading}'), 'double-click guard');
check('G4-14', 'Timer empty labels', fileContains('src/components/portal/EmployeePortalLiveTimersPanel.tsx', 'Noch nicht gestartet'), 'timer UX');
check('G4-15', 'Pause empty label', fileContains('src/components/portal/EmployeePortalLiveTimersPanel.tsx', 'Keine Pause erfasst'), 'pause UX');
check('G4-16', 'Preflight doc', fileExists('docs/audit/lt-gmaps-4-consent-route-preflight.md'), 'preflight');
check('G4-17', 'Abnahmebericht', fileExists('docs/audit/lt-gmaps-4-consent-route-abnahmebericht.md'), 'abnahmebericht');
check('G4-18', 'Unit tests', fileExists('src/__tests__/liveTracking/liveTrackingLtGmaps4.test.ts'), 'vitest coverage');

const passed = checks.filter((c) => c.ok).length;
const failed = checks.filter((c) => !c.ok);

console.log('\n=== LT.GMAPS.4 Consent + Route Audit ===\n');
for (const c of checks) {
  console.log(`${c.ok ? '✓' : '✗'} [${c.id}] ${c.label}`);
  if (!c.ok) console.log(`    → ${c.detail}`);
}
console.log(`\nErgebnis: ${passed}/${checks.length} bestanden\n`);

process.exit(failed.length > 0 ? 1 : 0);
