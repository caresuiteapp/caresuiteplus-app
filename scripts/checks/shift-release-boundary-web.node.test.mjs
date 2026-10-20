import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { stripTypeScriptTypes } from 'node:module';

const root = path.resolve(import.meta.dirname, '../..');
const read = relative => fs.readFile(path.join(root, relative), 'utf8');
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

async function loadBoundary() {
  let source = await read('src/lib/pflege/shiftReleaseBoundary.web.ts');
  source = source.replace(/^import type .*;\n/gm, '');
  const js = stripTypeScriptTypes(source, { mode: 'transform' });
  return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}#${Date.now()}`);
}

const row = (n, status, extra = {}) => ({
  id: id(n), tenantId: id(1), employeeId: id(20 + n), employeeName: `Pflegekraft ${n}`,
  roleLabel: 'Pflegefachkraft', shiftDate: '2026-10-13', startTime: '07:00', endTime: '15:00',
  location: 'Ambulant', status, updatedAt: '2026-10-12 20:00:00.123456+00', ...extra,
});

test('supplied row summary stays immutable and separates draft, release and office confirmation', async () => {
  const { buildShiftReleaseBoundary } = await loadBoundary();
  const result = buildShiftReleaseBoundary([row(1, 'entwurf'), row(2, 'geplant'), row(3, 'bestaetigt')]);
  assert.deepEqual([result.drafts, result.released, result.officeConfirmed], [1, 1, 1]);
  assert.equal(result.suppliedRows, 3);
  assert.ok(Object.isFrozen(result) && Object.isFrozen(result.releaseChecks) && Object.isFrozen(result.missingPlanEvidence));
});

test('office confirmation never becomes employee receipt, actual duty or completed work evidence', async () => {
  const { buildShiftReleaseBoundary } = await loadBoundary();
  const result = buildShiftReleaseBoundary([row(1, 'bestaetigt')]);
  assert.equal(result.officeConfirmed, 1);
  assert.match(result.missingPlanEvidence.join(' '), /Empfangsbestätigung/);
  assert.equal(Object.hasOwn(result, 'received'), false);
  assert.equal(Object.hasOwn(result, 'worked'), false);
});

test('missing native employee identity remains unresolved instead of being inferred from snapshot name', async () => {
  const { buildShiftReleaseBoundary } = await loadBoundary();
  assert.equal(buildShiftReleaseBoundary([row(1, 'geplant', { employeeId: null })]).unresolvedEmployees, 1);
});

test('duplicate rows and mixed tenants make the delivered read set untrusted', async () => {
  const { buildShiftReleaseBoundary } = await loadBoundary();
  assert.equal(buildShiftReleaseBoundary([row(1, 'entwurf'), row(1, 'entwurf')]).integrity, 'untrusted');
  assert.equal(buildShiftReleaseBoundary([row(1, 'entwurf'), row(2, 'entwurf', { tenantId: id(2) })]).integrity, 'untrusted');
});

test('publish transition checks current row, availability, blocked slots and workforce absence before release', async () => {
  const sql = await read('supabase/patches/ambulatory_care_operations.sql');
  assert.match(sql, /r\.updated_at IS DISTINCT FROM p_expected_at/);
  assert.match(sql, /PERFORM care_private\.check_staff_planning\(t,r\.employee_id,r\.shift_date,r\.start_time,r\.end_time\)/);
  assert.match(sql, /calendar_employee_month_plans/);
  assert.match(sql, /v->>'kind'='available'/);
  assert.match(sql, /s->>'kind'='blocked'/);
  assert.match(sql, /FROM public\.workforce_absences a/);
});

test('publish transition rejects overlap or insufficient standard rest and direct authenticated writes', async () => {
  const sql = await read('supabase/patches/ambulatory_care_operations.sql');
  assert.match(sql, /s\.status IN\('published','confirmed','in_progress','completed'\)/);
  assert.match(sql, /ends\+interval '11 hours'/);
  assert.match(sql, /starts-interval '11 hours'/);
  assert.match(sql, /REVOKE ALL ON public\.care_staff_shifts FROM PUBLIC,anon,authenticated/);
  assert.match(sql, /GRANT SELECT ON public\.care_staff_shifts TO authenticated/);
});

test('release uses controlled RPC while preserving microsecond expected timestamp', async () => {
  const service = await read('src/lib/pflege/shiftScheduleService.ts');
  assert.match(service, /callCareOperationsRpc\(tenantId, 'advance_ambulatory_care_shift', \{ p_id: item\.id, p_expected_at: item\.updatedAt/);
  assert.doesNotMatch(service, /fromUnknownTable\([^\n]*care_staff_shifts[^\n]*\)\.update/);
});

test('visible Web/Desktop boundary is integrated without adding a query or changing native behaviour', async () => {
  const screen = await read('src/screens/pflege/ShiftScheduleListScreen.tsx');
  const web = await read('src/components/pflege/ShiftReleaseEvidencePanel.web.tsx');
  const native = await read('src/components/pflege/ShiftReleaseEvidencePanel.tsx');
  assert.match(screen, /<ShiftReleaseEvidencePanel items=\{items\} \/>/);
  assert.match(web, /Freigabe ist nicht Planempfang/);
  assert.match(web, /keinen\s+Empfangsbeleg der Pflegekraft/);
  assert.doesNotMatch(web, /supabase|\.from\(|\.rpc\(|Date\.now|new Date/);
  assert.match(native, /return null/);
});
