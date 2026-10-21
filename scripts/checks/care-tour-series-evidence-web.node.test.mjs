import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { stripTypeScriptTypes } from 'node:module';

const root = path.resolve(import.meta.dirname, '../..');
const read = relative => fs.readFile(path.join(root, relative), 'utf8');

async function loadEvidence() {
  const source = await read('src/lib/pflege/careTourSeriesEvidence.web.ts');
  return import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source, { mode: 'transform' })).toString('base64')}#${Date.now()}`);
}

test('series boundary is immutable and rejects cross-module inference', async () => {
  const { getCareTourSeriesEvidence } = await loadEvidence();
  const evidence = getCareTourSeriesEvidence();
  assert.ok(Object.isFrozen(evidence) && Object.isFrozen(evidence.missingEvidence));
  assert.equal(evidence.singleEditMayRewriteSeries, false);
  assert.equal(evidence.assistanceRecurrenceIsCareTourProof, false);
  assert.strictEqual(getCareTourSeriesEvidence(), evidence);
});

test('care tour schema stores a single date and wall-clock stop times without series identity', async () => {
  const sql = await read('supabase/migrations/20260812210000_pfleger_operations_workspace_live_r1.sql');
  const tours = sql.match(/CREATE TABLE IF NOT EXISTS public\.care_tours \([\s\S]*?\n\);/)?.[0] ?? '';
  const stops = sql.match(/CREATE TABLE IF NOT EXISTS public\.care_tour_stops \([\s\S]*?\n\);/)?.[0] ?? '';
  assert.match(tours, /tour_date DATE NOT NULL/);
  assert.match(stops, /planned_start TIME NOT NULL/);
  assert.match(stops, /planned_end TIME NOT NULL/);
  assert.doesNotMatch(`${tours}\n${stops}`, /recurrence|series_id|occurrence_date|exception_date|timezone|holiday/i);
});

test('care tour creation accepts one date but no recurrence or exception payload', async () => {
  const sql = await read('supabase/patches/ambulatory_care_tour_workflow.sql');
  const create = sql.match(/CREATE OR REPLACE FUNCTION care_private\.create_tour\([\s\S]*?END \$\$;/)?.[0] ?? '';
  assert.match(create, /p_payload->>'tourDate'/);
  assert.doesNotMatch(create, /p_payload->>'(?:recurrence|rrule|seriesId|weekdays|holidayRule|exceptionDate|timezone)'/i);
});

test('care tour service exposes no series or occurrence mutation endpoint', async () => {
  const service = await read('src/lib/pflege/careTourPlanningService.ts');
  assert.match(service, /createCareTour/);
  assert.doesNotMatch(service, /createCareTourSeries|updateCareTourOccurrence|detachCareTourOccurrence|updateCareTourSeries/);
});

test('assist recurrence is separate and cannot prove a care tour series', async () => {
  const recurrence = await read('src/lib/assist/visitRecurrenceExpansion.ts');
  const migration = await read('supabase/migrations/0164_assist_catalog_template_foundation.sql');
  assert.match(recurrence, /VisitRecurrenceJson/);
  assert.match(migration, /recurrence_json JSONB/);
  assert.doesNotMatch(`${recurrence}\n${migration}`, /care_tours|care_tour_stops/);
});

test('holiday events are assist calendar hints without a care-tour decision', async () => {
  const calendar = await read('src/lib/calendar/assistCalendarOperationalEvents.ts');
  assert.match(calendar, /getGermanPublicHolidays\(year, 'NW'\)/);
  assert.match(calendar, /moduleKey: 'assist'/);
  assert.doesNotMatch(calendar, /care_tours|care_tour_stops|create_ambulatory_care_tour/);
});

test('care tour creation has no versioned timezone or daylight-saving policy', async () => {
  const sql = await read('supabase/patches/ambulatory_care_tour_workflow.sql');
  const create = sql.match(/CREATE OR REPLACE FUNCTION care_private\.create_tour\([\s\S]*?END \$\$;/)?.[0] ?? '';
  assert.match(create, /start_at time; end_at time; day date/);
  assert.doesNotMatch(create, /AT TIME ZONE|SET timezone|utc_offset|timezone_version/i);
});

test('visible Web/Desktop boundary is integrated without query write or native behaviour change', async () => {
  const screen = await read('src/screens/pflege/CareTourPlanningScreen.tsx');
  const web = await read('src/components/pflege/CareTourSeriesEvidencePanel.web.tsx');
  const native = await read('src/components/pflege/CareTourSeriesEvidencePanel.tsx');
  assert.match(screen, /<CareTourSeriesEvidencePanel \/>/);
  assert.match(web, /Einzelne Tour ist keine Serie/);
  assert.match(web, /Feiertag und Einzeländerung separat entscheiden/);
  assert.doesNotMatch(web, /supabase|\.from\(|\.rpc\(|useAsyncQuery|Date\.now|new Date/);
  assert.match(native, /return null/);
});
