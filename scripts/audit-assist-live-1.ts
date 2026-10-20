#!/usr/bin/env npx tsx
/**
 * ASSIST.LIVE.1 — Assist live employee monitoring audit.
 * Usage: npx tsx scripts/audit-assist-live-1.ts
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

check(
  'AL1-01',
  'getAssistLiveMonitoring.ts',
  fileExists('src/features/assistLive/getAssistLiveMonitoring.ts'),
  'single source of truth',
);

check(
  'AL1-02',
  'useAssistLiveMonitoring.ts',
  fileExists('src/features/assistLive/useAssistLiveMonitoring.ts'),
  'unified hook',
);

check(
  'AL1-03',
  'Screen nutzt useAssistLiveMonitoring',
  fileContains('src/screens/assist/AssistLiveStatusScreen.tsx', 'useAssistLiveMonitoring'),
  'AssistLiveStatusScreen',
);

check(
  'AL1-04',
  'Sidebar nutzt useAssistLiveMonitoring',
  fileContains('src/components/layout/platform/rightcontextpanel.tsx', 'useAssistLiveMonitoring'),
  'rightcontextpanel',
);

check(
  'AL1-05',
  'Supabase-Pfad: fetchVisitDispositionList',
  fileContains('src/features/assistLive/getAssistLiveMonitoring.ts', 'fetchVisitDispositionList'),
  'visit list not fetchDayMonitor guard',
);

check(
  'AL1-06',
  'Kein guardLiveDemoFeature in Monitoring',
  !fileContains('src/features/assistLive/getAssistLiveMonitoring.ts', 'guardLiveDemoFeature'),
  'no live demo block',
);

check(
  'AL1-07',
  'Migration 0204',
  fileExists('supabase/migrations/0204_assist_live_monitoring_rls.sql'),
  '0204_assist_live_monitoring_rls.sql',
);

check(
  'AL1-08',
  'useVisibilityAwarePolling im Hook',
  fileContains('src/features/assistLive/useAssistLiveMonitoring.ts', 'useVisibilityAwarePolling'),
  'polling',
);

check(
  'AL1-09',
  'useManagedSupabaseChannel im Hook',
  fileContains('src/features/assistLive/useAssistLiveMonitoring.ts', 'useManagedSupabaseChannel'),
  'realtime',
);

check(
  'AL1-10',
  'mapMarkers in Overview',
  fileContains('src/features/assistLive/getAssistLiveMonitoring.ts', 'mapMarkers'),
  'map marker builder',
);

check(
  'AL1-11',
  'Preflight doc',
  fileExists('docs/audit/assist-live-1-preflight.md'),
  'assist-live-1-preflight.md',
);

check(
  'AL1-12',
  'Tests',
  fileExists('src/__tests__/assist/assistLiveMonitoring.test.ts'),
  'assistLiveMonitoring.test.ts',
);

const passed = checks.filter((c) => c.ok).length;
const failed = checks.filter((c) => !c.ok);

console.log('\n=== ASSIST.LIVE.1 Audit ===\n');
for (const c of checks) {
  console.log(`${c.ok ? 'PASS' : 'FAIL'} ${c.id} ${c.label} — ${c.detail}`);
}
console.log(`\n${passed}/${checks.length} passed\n`);
if (failed.length > 0) process.exit(1);
