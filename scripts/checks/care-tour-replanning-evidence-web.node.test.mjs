import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { stripTypeScriptTypes } from 'node:module';

const root = path.resolve(import.meta.dirname, '../..');
const read = relative => fs.readFile(path.join(root, relative), 'utf8');

async function loadEvidence() {
  const source = await read('src/lib/pflege/careTourReplanningEvidence.web.ts');
  return import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source, { mode: 'transform' })).toString('base64')}#${Date.now()}`);
}

test('replanning boundary is immutable and forbids silent automatic replacement', async () => {
  const { getCareTourReplanningEvidence } = await loadEvidence();
  const evidence = getCareTourReplanningEvidence();
  assert.ok(Object.isFrozen(evidence) && Object.isFrozen(evidence.missingEvidence));
  assert.equal(evidence.startedVisitMayBeOverwritten, false);
  assert.equal(evidence.silentAutomaticReplan, false);
  assert.strictEqual(getCareTourReplanningEvidence(), evidence);
});

test('tour status transition uses expected status but is not a schedule-version guard', async () => {
  const sql = await read('supabase/patches/ambulatory_care_tour_workflow.sql');
  const advance = sql.match(/CREATE OR REPLACE FUNCTION care_private\.advance_tour\([\s\S]*?END \$\$;/)?.[0] ?? '';
  assert.match(advance, /r\.status IS DISTINCT FROM p_expected_status/);
  assert.match(advance, /FOR UPDATE/);
  assert.doesNotMatch(advance, /expected_updated_at|expected_version|schedule_version|previous_snapshot/);
});

test('tour cancellation requires a reason and cannot cancel an in-progress tour', async () => {
  const sql = await read('supabase/patches/ambulatory_care_tour_workflow.sql');
  const advance = sql.match(/CREATE OR REPLACE FUNCTION care_private\.advance_tour\([\s\S]*?END \$\$;/)?.[0] ?? '';
  assert.match(advance, /r\.status IN\('draft','published'\) AND p_status='cancelled'/);
  assert.match(advance, /Ein Absagegrund ist erforderlich/);
  assert.doesNotMatch(advance, /r\.status='in_progress' AND p_status='cancelled'/);
});

test('started stop keeps actual timestamps while cancellation requires a note', async () => {
  const sql = await read('supabase/patches/ambulatory_care_tour_workflow.sql');
  const advance = sql.match(/CREATE OR REPLACE FUNCTION care_private\.advance_stop\([\s\S]*?END \$\$;/)?.[0] ?? '';
  assert.match(advance, /actual_started_at=CASE WHEN p_status='in_progress' THEN clock_timestamp\(\)/);
  assert.match(advance, /actual_ended_at=CASE WHEN p_status IN\('completed','cancelled'\)/);
  assert.match(advance, /Durchführungsnachweis bzw\. Ausfallgrund ist erforderlich/);
});

test('available RPCs expose creation and status advance but no atomic replan', async () => {
  const sql = await read('supabase/patches/ambulatory_care_tour_workflow.sql');
  assert.match(sql, /create_ambulatory_care_tour/);
  assert.match(sql, /advance_ambulatory_care_tour/);
  assert.match(sql, /advance_ambulatory_care_stop/);
  assert.doesNotMatch(sql, /replan_ambulatory|reschedule_ambulatory|replace_tour_employee/);
});

test('tour service has no employee time or order mutation endpoint', async () => {
  const service = await read('src/lib/pflege/careTourPlanningService.ts');
  assert.match(service, /createCareTour/);
  assert.match(service, /updateCareTourStatus/);
  assert.match(service, /updateCareTourStopStatus/);
  assert.doesNotMatch(service, /updateCareTourAssignment|rescheduleCareTour|replaceCareTourEmployee/);
});

test('tour events record transitions but no addressed notification delivery evidence', async () => {
  const sql = await read('supabase/patches/ambulatory_care_tour_workflow.sql');
  const table = sql.match(/CREATE TABLE IF NOT EXISTS public\.care_tour_events \([\s\S]*?\n\);/)?.[0] ?? '';
  assert.match(table, /action text/);
  assert.match(table, /occurred_at timestamptz/);
  assert.doesNotMatch(table, /recipient_id|channel|delivery_status|delivered_at|notification_id/);
});

test('visible Web/Desktop boundary is integrated without query write or native behaviour change', async () => {
  const screen = await read('src/screens/pflege/CareTourPlanningScreen.tsx');
  const web = await read('src/components/pflege/CareTourReplanningEvidencePanel.web.tsx');
  const native = await read('src/components/pflege/CareTourReplanningEvidencePanel.tsx');
  assert.match(screen, /<CareTourReplanningEvidencePanel \/>/);
  assert.match(web, /Statuswechsel ist keine Umplanung/);
  assert.match(web, /Begonnene Besuche nicht still ersetzen/);
  assert.doesNotMatch(web, /supabase|\.from\(|\.rpc\(|useAsyncQuery|Date\.now|new Date/);
  assert.match(native, /return null/);
});
