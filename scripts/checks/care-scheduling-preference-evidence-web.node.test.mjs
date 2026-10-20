import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { stripTypeScriptTypes } from 'node:module';

const root = path.resolve(import.meta.dirname, '../..');
const read = relative => fs.readFile(path.join(root, relative), 'utf8');

async function loadEvidence() {
  const source = await read('src/lib/pflege/careSchedulingPreferenceEvidence.web.ts');
  const js = stripTypeScriptTypes(source, { mode: 'transform' });
  return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}#${Date.now()}`);
}

test('boundary is immutable and never upgrades schedule or name into agreement', async () => {
  const { getCareSchedulingPreferenceEvidence } = await loadEvidence();
  const evidence = getCareSchedulingPreferenceEvidence();
  assert.ok(Object.isFrozen(evidence) && Object.isFrozen(evidence.missingEvidence));
  assert.equal(evidence.existingScheduleMayProveAgreement, false);
  assert.equal(evidence.employeeNameMayProveReferenceCare, false);
  assert.equal(evidence.automaticRelease, false);
  assert.strictEqual(getCareSchedulingPreferenceEvidence(), evidence);
});

test('stored scheduling wishes are preferences without agreement source validity version or priority', async () => {
  const sql = await read('supabase/migrations/0072_client_scheduling_wishes_and_address_fields.sql');
  assert.match(sql, /preferred_days/);
  assert.match(sql, /preferred_time_slots/);
  assert.match(sql, /time_from/);
  assert.match(sql, /time_to/);
  assert.match(sql, /assignments_per_week/);
  assert.doesNotMatch(sql, /agreement_source|agreed_from|agreed_until|effective_from|version|priority/);
});

test('wishes service upserts current state and audit summary without immutable agreement history', async () => {
  const repository = await read('src/lib/clients/repositories/clientExtendedRepository.supabase.ts');
  const method = repository.match(/async upsertSchedulingWishes\([\s\S]*?\n  \},/)?.[0] ?? '';
  assert.match(method, /\.upsert\(payload, \{ onConflict: 'client_id' \}\)/);
  assert.match(method, /Einsatz-Wünsche aktualisiert/);
  assert.doesNotMatch(method, /previous_id|sequence|agreement_snapshot|supersed/);
});

test('office UI explicitly presents data as general wishes rather than a concrete agreement', async () => {
  const panel = await read('src/components/office/ClientSchedulingWishesPanel.tsx');
  assert.match(panel, /Allgemeine Planungswünsche/);
  assert.match(panel, /Wünsche speichern/);
  assert.doesNotMatch(panel, /Vereinbarung bestätigen|Bezugsteam zusichern|Abweichungsgrund/);
});

test('separate client preferences hold employee IDs but no reference-team agreement', async () => {
  const sql = await read('supabase/migrations/0010_client_extended.sql');
  const table = sql.match(/CREATE TABLE IF NOT EXISTS public\.client_preferences \([\s\S]*?\n\);/)?.[0] ?? '';
  assert.match(table, /preferred_employee_ids/);
  assert.match(table, /excluded_employee_ids/);
  assert.doesNotMatch(table, /reference_team|primary_caregiver|agreement|priority|valid_from|supersed/);
});

test('care tour stops do not bind wishes agreements priorities or deviation reasons', async () => {
  const service = await read('src/lib/pflege/careTourPlanningService.ts');
  const stop = service.match(/export type CareTourStop = \{[\s\S]*?\n\};/)?.[0] ?? '';
  assert.match(stop, /plannedStart/);
  assert.match(stop, /plannedEnd/);
  assert.doesNotMatch(stop, /preference|agreement|priority|referenceTeam|deviationReason/);
});

test('prepared tour insert does not snapshot preference or expose a pre-acceptance deviation', async () => {
  const sql = await read('supabase/patches/ambulatory_care_tour_workflow.sql');
  const create = sql.match(/CREATE OR REPLACE FUNCTION care_private\.create_tour\(p_payload jsonb\)[\s\S]*?END \$\$;/)?.[0] ?? '';
  assert.match(create, /planned_start/);
  assert.match(create, /planned_end/);
  assert.doesNotMatch(create, /client_scheduling_wishes|client_preferences|agreement|priority|deviation_reason/);
});

test('visible Web/Desktop boundary is integrated without query write or native behaviour change', async () => {
  const screen = await read('src/screens/pflege/CareTourPlanningScreen.tsx');
  const web = await read('src/components/pflege/CareSchedulingPreferenceEvidencePanel.web.tsx');
  const native = await read('src/components/pflege/CareSchedulingPreferenceEvidencePanel.tsx');
  assert.match(screen, /<CareSchedulingPreferenceEvidencePanel \/>/);
  assert.match(web, /Wunsch ist keine Terminvereinbarung/);
  assert.match(web, /Bezugspflege nicht zugesichert/);
  assert.doesNotMatch(web, /supabase|\.from\(|\.rpc\(|useAsyncQuery|Date\.now|new Date/);
  assert.match(native, /return null/);
});
