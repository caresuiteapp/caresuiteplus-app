#!/usr/bin/env npx tsx
/**
 * PERF.1 — Thermal / battery performance audit.
 * Usage: npx tsx scripts/audit-perf-thermal.ts
 */
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname ?? '.', '..');
const OUT = join(ROOT, 'docs/audit/perf-1-thermal-audit-output.md');

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

function fileNotContains(rel: string, needle: string): boolean {
  return !fileContains(rel, needle);
}

// Phase 1 — preflight doc
check(
  'P1-01',
  'Preflight audit doc',
  fileExists('docs/audit/perf-1-thermal-preflight.md'),
  'docs/audit/perf-1-thermal-preflight.md',
);

// Phase 2 — device profile
check(
  'P1-02',
  'devicePerformance.ts',
  fileExists('src/lib/performance/devicePerformance.ts') &&
    fileContains('src/lib/performance/devicePerformance.ts', 'getDevicePerformanceProfile'),
  'getDevicePerformanceProfile',
);

check(
  'P1-03',
  'All performance profiles defined',
  fileContains('src/lib/performance/devicePerformance.ts', 'activeTrackingSaver') &&
    fileContains('src/lib/performance/devicePerformance.ts', 'mobileBatterySaver'),
  'profile enum',
);

// Phase 3 — CSS classes
check(
  'P1-04',
  'Performance CSS classes',
  fileContains('src/lib/performance/performanceCss.ts', 'performance-mobile') &&
    fileContains('src/lib/performance/performanceCss.ts', 'disable-heavy-effects'),
  'CSS reduction classes',
);

check(
  'P1-05',
  'PerformanceProvider wired in root layout',
  fileContains('app/_layout.tsx', 'PerformanceProvider'),
  'app/_layout.tsx',
);

// Phase 4 — singleton GPS
check(
  'P1-06',
  'useSingleGeolocationWatch.ts',
  fileExists('src/features/liveTracking/useSingleGeolocationWatch.ts'),
  'singleton GPS hook',
);

check(
  'P1-07',
  'useEmployeeGpsTracking uses singleton',
  fileContains('src/features/liveTracking/useEmployeeGpsTracking.ts', 'acquireGeolocationWatch'),
  'refactored GPS tracking',
);

// Phase 5 — maps
check(
  'P1-08',
  'useStableGoogleMap.ts',
  fileExists('src/components/maps/useStableGoogleMap.ts'),
  'stable map hook',
);

check(
  'P1-09',
  'useStableMapMarkers.ts',
  fileExists('src/components/maps/useStableMapMarkers.ts'),
  'stable markers hook',
);

check(
  'P1-10',
  'useVisibleMapPolling.ts',
  fileExists('src/components/maps/useVisibleMapPolling.ts'),
  'visible map polling',
);

check(
  'P1-11',
  'GoogleMapsLiveMap uses stable hooks',
  fileContains('src/components/maps/GoogleMapsLiveMap.web.tsx', 'useStableGoogleMap'),
  'map integration',
);

// Phase 6 — polling/realtime
check(
  'P1-12',
  'useVisibilityAwarePolling.ts',
  fileExists('src/lib/polling/useVisibilityAwarePolling.ts'),
  'visibility polling',
);

check(
  'P1-13',
  'useLiveRefresh visibility-aware',
  fileContains('src/hooks/core/useLiveRefresh.ts', 'createVisibilityAwareInterval'),
  'useLiveRefresh',
);

check(
  'P1-14',
  'useManagedSupabaseChannel.ts',
  fileExists('src/lib/realtime/useManagedSupabaseChannel.ts'),
  'managed channel hook',
);

check(
  'P1-15',
  'channelManager demo poll visibility-aware',
  fileContains('src/lib/realtime/channelManager.ts', 'createVisibilityAwareInterval'),
  'channelManager',
);

// Phase 7 — render hotspots
check(
  'P1-16',
  'GoogleMapsLiveMap memoized',
  fileContains('src/components/maps/GoogleMapsLiveMap.web.tsx', 'memo('),
  'React.memo on map',
);

check(
  'P1-17',
  'Assist live status uses visibility polling',
  fileContains('src/hooks/useAssistLiveStatus.ts', 'useVisibilityAwarePolling'),
  'useAssistLiveStatus',
);

// Phase 9 — floating AI
check(
  'P1-18',
  'AiMiniPanel lazy loaded',
  fileContains('src/ai/GlobalAiProvider.tsx', 'lazy(') &&
    fileContains('src/ai/GlobalAiProvider.tsx', 'AiMiniPanel'),
  'GlobalAiProvider',
);

check(
  'P1-19',
  'VoiceOrb mobile motion reduction',
  fileContains('src/ai/VoiceOrbCore.tsx', 'allowMotion'),
  'VoiceOrbCore',
);

// Phase 10 — diagnostics
check(
  'P1-20',
  'performanceDiagnostics.ts',
  fileExists('src/lib/performance/performanceDiagnostics.ts'),
  'diagnostics module',
);

// Phase 11 — iOS Safari
check(
  'P1-21',
  'iOS Safari CSS reductions',
  fileContains('src/lib/performance/performanceCss.ts', 'performance-ios-safari'),
  'iOS Safari CSS',
);

// Phase 12 — tests
check(
  'P1-22',
  'perf1 unit tests',
  fileExists('src/__tests__/performance/perf1Thermal.test.ts'),
  'perf1Thermal.test.ts',
);

// Anti-patterns — no raw 10s live poll constant
check(
  'P1-23',
  'Live tracking poll relaxed to 15s',
  fileContains('src/hooks/core/useLiveRefresh.ts', 'LIVE_TRACKING_POLL_MS = 15_000'),
  '15s poll constant',
);

check(
  'P1-24',
  'Mobile background animation disabled in root',
  fileContains('app/_layout.tsx', 'backgroundAnimated'),
  'conditional aurora',
);

check(
  'P1-25',
  'GlassSurface respects performance profile',
  fileContains('src/components/ui/effects/glasssurface.tsx', 'shouldUseHeavyEffects'),
  'glasssurface.tsx',
);

// Phase 15 — abnahme doc placeholder
check(
  'P1-26',
  'Abnahmebericht doc',
  fileExists('docs/audit/perf-1-thermal-abnahmebericht.md'),
  'perf-1-thermal-abnahmebericht.md',
);

const passed = checks.filter((c) => c.ok).length;
const failed = checks.filter((c) => !c.ok);

const lines = [
  '# PERF.1 Thermal Audit Output',
  '',
  `Generated: ${new Date().toISOString()}`,
  '',
  `**Ergebnis: ${passed}/${checks.length} bestanden**`,
  '',
  '## Checks',
  '',
  ...checks.map(
    (c) => `- ${c.ok ? '✓' : '✗'} **[${c.id}]** ${c.label}${c.ok ? '' : ` — ${c.detail}`}`,
  ),
  '',
];

if (failed.length > 0) {
  lines.push('## Failed', '', ...failed.map((c) => `- ${c.id}: ${c.detail}`), '');
}

writeFileSync(OUT, lines.join('\n'), 'utf8');

console.log('\n=== PERF.1 Thermal Audit ===\n');
for (const c of checks) {
  console.log(`${c.ok ? '✓' : '✗'} [${c.id}] ${c.label}`);
  if (!c.ok) console.log(`    → ${c.detail}`);
}
console.log(`\nErgebnis: ${passed}/${checks.length} bestanden`);
console.log(`Report: ${OUT}\n`);

process.exit(failed.length > 0 ? 1 : 0);
