import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { stripTypeScriptTypes } from 'node:module';

const root = path.resolve(import.meta.dirname, '../..');
const read = relative => fs.readFile(path.join(root, relative), 'utf8');

async function loadEvidence() {
  const source = await read('src/lib/pflege/worktimeRuleEvidence.web.ts');
  const js = stripTypeScriptTypes(source, { mode: 'transform' });
  return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}#${Date.now()}`);
}

test('technical defaults are immutable and never become a binding rule version', async () => {
  const { buildWorktimeRuleEvidence } = await loadEvidence();
  const evidence = buildWorktimeRuleEvidence();
  assert.ok(Object.isFrozen(evidence) && Object.isFrozen(evidence.technicalRules));
  assert.deepEqual(evidence.technicalRules.map(rule => rule.minutes), [600, 30, 45, 660]);
  assert.equal(evidence.bindingBasisId, null);
  assert.equal(evidence.bindingBasisVersion, null);
});

test('source review is explicit but cannot assert legal approval or an exception', async () => {
  const { buildWorktimeRuleEvidence } = await loadEvidence();
  const evidence = buildWorktimeRuleEvidence();
  assert.equal(evidence.reviewedOn, '2026-10-12');
  assert.equal(evidence.reviewScope, 'amtliche Fundstellen, keine Rechtsfreigabe');
  assert.equal(evidence.legalApproval, false);
  assert.equal(evidence.exceptionApproved, false);
  assert.deepEqual(evidence.officialSources.map(source => source.section), ['§ 3 ArbZG', '§ 4 ArbZG', '§ 5 ArbZG', '§ 7 ArbZG']);
  assert.ok(evidence.officialSources.every(source => source.url.startsWith('https://www.gesetze-im-internet.de/arbzg/')));
});

test('care shift validation enforces technical daily and pause limits', async () => {
  const domain = await read('src/lib/pflege/ambulatoryOperationsDomain.ts');
  assert.match(domain, /if \(work > 600\)/);
  assert.match(domain, /work > 540 \? 45 : work > 360 \? 30 : 0/);
  assert.match(domain, /pause > 0 && pause < 15/);
});

test('controlled shift SQL limits work and continuous segments but stores no basis version', async () => {
  const sql = await read('supabase/patches/ambulatory_care_operations.sql');
  assert.match(sql, /work>600/);
  assert.match(sql, /work>540 THEN 45 WHEN work>360 THEN 30/);
  assert.match(sql, /EXTRACT\(EPOCH FROM\(pause_at-st\)\)\/60>360/);
  assert.match(sql, /interval '11 hours'/);
  const shiftInsert = sql.match(/INSERT INTO public\.care_staff_shifts\(([^)]*)\)/)?.[1] ?? '';
  assert.doesNotMatch(shiftInsert, /basis|rule_version|exception/);
});

test('WFM warnings use the same standard thresholds without a version input', async () => {
  const engine = await read('src/lib/wfm/wfmRuleEngine.ts');
  assert.match(engine, /MAX_DAILY_MINUTES = 10 \* 60/);
  assert.match(engine, /MIN_REST_MINUTES = 11 \* 60/);
  assert.match(engine, /BREAK_6H_REQUIRED = 30/);
  assert.match(engine, /BREAK_9H_REQUIRED = 45/);
  assert.doesNotMatch(engine, /bindingBasisVersion|ruleVersionId/);
});

test('stored violations do not bind the evaluated legal or tariff basis', async () => {
  const migration = await read('supabase/migrations/0194_wfm_checkin_and_rules.sql');
  const table = migration.match(/CREATE TABLE IF NOT EXISTS public\.workforce_rule_violations \(([\s\S]*?)\n\);/)?.[1] ?? '';
  assert.match(table, /rule_key/);
  assert.match(table, /work_date/);
  assert.doesNotMatch(table, /basis_id|basis_version|valid_from|exception_id/);
});

test('missing evidence keeps average, applicability, exceptions and history open', async () => {
  const { buildWorktimeRuleEvidence } = await loadEvidence();
  const text = buildWorktimeRuleEvidence().missingEvidence.join(' ');
  assert.match(text, /Ausgleichszeitraum/);
  assert.match(text, /Betrieb und Beschäftigte/);
  assert.match(text, /Ausnahme/);
  assert.match(text, /Originalhistorie/);
});

test('visible Web/Desktop boundary is integrated without query or native behaviour change', async () => {
  const screen = await read('src/screens/pflege/AmbulatoryConfigurationScreen.tsx');
  const web = await read('src/components/pflege/WorktimeRuleEvidencePanel.web.tsx');
  const native = await read('src/components/pflege/WorktimeRuleEvidencePanel.tsx');
  assert.match(screen, /<WorktimeRuleEvidencePanel \/>/);
  assert.match(web, /Technischer Standard ist keine Rechtsfreigabe/);
  assert.match(web, /Geltende Grundlage nicht gebunden/);
  assert.doesNotMatch(web, /supabase|\.from\(|\.rpc\(|Date\.now|new Date/);
  assert.match(native, /return null/);
});
