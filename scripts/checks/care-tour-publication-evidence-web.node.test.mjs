import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { stripTypeScriptTypes } from 'node:module';

const root = path.resolve(import.meta.dirname, '../..');
const read = relative => fs.readFile(path.join(root, relative), 'utf8');

async function loadEvidence() {
  const source = await read('src/lib/pflege/careTourPublicationEvidence.web.ts');
  return import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source, { mode: 'transform' })).toString('base64')}#${Date.now()}`);
}

test('publication boundary is immutable and rejects receipt inference', async () => {
  const { getCareTourPublicationEvidence } = await loadEvidence();
  const evidence = getCareTourPublicationEvidence();
  assert.ok(Object.isFrozen(evidence) && Object.isFrozen(evidence.missingEvidence));
  assert.equal(evidence.statusMayStandForReceipt, false);
  assert.equal(evidence.aggregateConfirmationMayStandForPersonalReceipt, false);
  assert.strictEqual(getCareTourPublicationEvidence(), evidence);
});

test('tour schema supports published status without a versioned publication snapshot', async () => {
  const sql = await read('supabase/migrations/20260812210000_pfleger_operations_workspace_live_r1.sql');
  const tours = sql.match(/CREATE TABLE IF NOT EXISTS public\.care_tours \([\s\S]*?\n\);/)?.[0] ?? '';
  assert.match(tours, /status TEXT NOT NULL DEFAULT 'draft'/);
  assert.match(tours, /published/);
  assert.doesNotMatch(tours, /plan_version|published_snapshot|publication_version|current_plan_version/i);
});

test('publish transition changes status but creates no immutable plan version', async () => {
  const sql = await read('supabase/patches/ambulatory_care_tour_workflow.sql');
  const advance = sql.match(/CREATE OR REPLACE FUNCTION care_private\.advance_tour\([\s\S]*?END \$\$;/)?.[0] ?? '';
  assert.match(advance, /r\.status='draft' AND p_status='published'/);
  assert.match(advance, /r\.status IS DISTINCT FROM p_expected_status/);
  assert.match(advance, /UPDATE public\.care_tours SET status=p_status,updated_by=auth\.uid\(\),updated_at=clock_timestamp\(\)/);
  assert.doesNotMatch(advance, /plan_version|published_snapshot|publication_version/i);
});

test('tour events record action and time without recipient delivery or acknowledgement', async () => {
  const sql = await read('supabase/patches/ambulatory_care_tour_workflow.sql');
  const events = sql.match(/CREATE TABLE IF NOT EXISTS public\.care_tour_events \([\s\S]*?\n\);/)?.[0] ?? '';
  assert.match(events, /action text NOT NULL/);
  assert.match(events, /occurred_at timestamptz NOT NULL/);
  assert.doesNotMatch(events, /recipient|delivery|delivered|acknowledg|receipt|plan_version/i);
});

test('tour service exposes neither publication version nor personal receipt', async () => {
  const service = await read('src/lib/pflege/careTourPlanningService.ts');
  const tourType = service.match(/export type CareTour = \{[\s\S]*?\n\};/)?.[0] ?? '';
  assert.match(tourType, /status: string/);
  assert.doesNotMatch(tourType, /planVersion|publishedSnapshot|recipient|delivery|acknowledgement|receipt/);
  assert.match(service, /p_status: status, p_expected_status: expectedStatus/);
});

test('event mapping preserves action and occurrence but cannot map receipt metadata', async () => {
  const service = await read('src/lib/pflege/careTourPlanningService.ts');
  const mapping = service.match(/events\.push\(\{[\s\S]*?\}\);/)?.[0] ?? '';
  assert.match(mapping, /action: text\(event\.action\)/);
  assert.match(mapping, /occurredAt: text\(event\.occurred_at\)/);
  assert.doesNotMatch(mapping, /recipient|delivery|acknowledgement|receipt|planVersion/);
});

test('employee portal visibility and tour start are not personal plan acknowledgement', async () => {
  const portal = await read('src/components/pflege/PortalCarePanels.tsx');
  assert.match(portal, /tr\.status === 'published'/);
  assert.match(portal, /title="Tour starten"/);
  assert.doesNotMatch(portal, /Planversion|Planfassung|Kenntnisnahme|Zustellbeleg|Empfangsquittung/);
});

test('visible Web/Desktop boundary is integrated without query write or native behaviour change', async () => {
  const screen = await read('src/screens/pflege/CareTourPlanningScreen.tsx');
  const web = await read('src/components/pflege/CareTourPublicationEvidencePanel.web.tsx');
  const native = await read('src/components/pflege/CareTourPublicationEvidencePanel.tsx');
  assert.match(screen, /<CareTourPublicationEvidencePanel \/>/);
  assert.match(web, /Veröffentlicht ist nicht zugestellt/);
  assert.match(web, /Aktuelle Planfassung persönlich nachweisen/);
  assert.doesNotMatch(web, /supabase|\.from\(|\.rpc\(|useAsyncQuery|Date\.now|new Date/);
  assert.match(native, /return null/);
});
