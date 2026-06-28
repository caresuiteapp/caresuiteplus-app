#!/usr/bin/env npx tsx
/**
 * LT.GMAPS.1 — Live tracking + Google Maps production audit script.
 * Usage: npx tsx scripts/audit-live-tracking-gmaps.ts
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

// Phase 2 — central resolver
check(
  'LT-01',
  'resolveLiveAssignment.ts vorhanden',
  fileExists('src/features/liveTracking/resolveLiveAssignment.ts'),
  'src/features/liveTracking/resolveLiveAssignment.ts',
);

// Phase 3 — migration
check(
  'LT-02',
  'Migration 0199 vorhanden',
  fileExists('supabase/migrations/0199_live_tracking_gmaps_repair.sql'),
  '0199_live_tracking_gmaps_repair.sql',
);

check(
  'LT-03',
  'Migration: resolve_live_assignment RPC',
  fileContains('supabase/migrations/0199_live_tracking_gmaps_repair.sql', 'resolve_live_assignment'),
  'resolve_live_assignment function',
);

check(
  'LT-04',
  'Migration: tenant_runtime_settings',
  fileContains('supabase/migrations/0199_live_tracking_gmaps_repair.sql', 'tenant_runtime_settings'),
  'tenant_runtime_settings table',
);

// Phase 4 — maps runtime
check(
  'LT-05',
  'getGoogleMapsBrowserKey.ts vorhanden',
  fileExists('src/lib/maps/getGoogleMapsBrowserKey.ts'),
  'runtime key resolver',
);

check(
  'LT-06',
  'maps-runtime-config Edge Function',
  fileExists('supabase/functions/maps-runtime-config/index.ts'),
  'edge function',
);

check(
  'LT-07',
  'Kein API-Key im Repo (.env.example ohne GOOGLE key)',
  !fileContains('.env.example', 'AIza') && !fileContains('.env', 'AIza'),
  'no hardcoded Google API keys',
);

// Phase 5-8 — central queries
check(
  'LT-08',
  'getOfficeLiveEmployees.ts',
  fileExists('src/features/liveTracking/getOfficeLiveEmployees.ts'),
  'office live employees query',
);

check(
  'LT-09',
  'getAssistLiveStatus.ts',
  fileExists('src/features/liveTracking/getAssistLiveStatus.ts'),
  'assist live status query',
);

check(
  'LT-10',
  'getClientLiveVisitLocation.ts',
  fileExists('src/features/liveTracking/getClientLiveVisitLocation.ts'),
  'client live visit query',
);

// Phase 9 — realtime + polling
check(
  'LT-11',
  'LIVE_TRACKING_POLL_MS = 10s',
  fileContains('src/hooks/core/useLiveRefresh.ts', 'LIVE_TRACKING_POLL_MS = 10_000'),
  '10s polling constant',
);

check(
  'LT-12',
  'Employee portal realtime: assist_tracking_sessions',
  fileContains('src/lib/realtime/presets.ts', 'assist_tracking_sessions'),
  'realtime subscription',
);

const passed = checks.filter((c) => c.ok).length;
const failed = checks.filter((c) => !c.ok);

console.log('\n=== LT.GMAPS.1 Live Tracking Audit ===\n');
for (const c of checks) {
  console.log(`${c.ok ? '✓' : '✗'} [${c.id}] ${c.label}`);
  if (!c.ok) console.log(`    → ${c.detail}`);
}
console.log(`\nErgebnis: ${passed}/${checks.length} bestanden\n`);

process.exit(failed.length > 0 ? 1 : 0);
