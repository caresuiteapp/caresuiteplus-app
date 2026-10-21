import assert from 'node:assert/strict';
import test from 'node:test';
import { projectCompleteListPerformanceEvidence } from '../../src/lib/performance/completeListPerformanceEvidence.web.ts';

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const sha = (c) => c.repeat(64);
const at = (n) => `2026-10-15T00:30:00.${String(n).padStart(6, '0')}Z`;
const ids = [id(10), id(11), id(12)];
const makePages = (scenarioId, rows, offset = 0) => rows.map((rowIds, index) => ({ pageId: id(100 + offset + index), scenarioId, index,
  cursorIn: index ? rows[index - 1].at(-1) : null, cursorOut: index === rows.length - 1 ? null : rowIds.at(-1), rowIds,
  responseSha256: sha('c'), startedAt: at(2 + offset + index * 2), completedAt: at(3 + offset + index * 2), responseMs: 120 }));
const makeScenario = (n, kind, expectedRecordIds, pageRows) => ({ scenarioId: id(20 + n), tenantId: id(1), releaseCandidateId: id(2),
  buildSha256: sha('a'), snapshotId: id(3), kind, criteriaSha256: sha(String(n + 2)), expectedRecordIds,
  pages: makePages(id(20 + n), pageRows, n * 10) });
const base = (overrides = {}) => {
  const scenarios = [makeScenario(0, 'unfiltered', ids, [ids.slice(0, 2), ids.slice(2)]), makeScenario(1, 'search', [ids[1]], [[ids[1]]]), makeScenario(2, 'filter', [ids[0], ids[2]], [[ids[0]], [ids[2]]])];
  const measurements = scenarios.flatMap((scenario, si) => ['wide', 'narrow'].map((profile, pi) => ({ measurementId: id(300 + si * 2 + pi), scenarioId: scenario.scenarioId,
    tenantId: id(1), releaseCandidateId: id(2), buildSha256: sha('a'), snapshotId: id(3), profile, browserEngine: 'chromium',
    browserVersion: '142.0.7444.2', interactiveMs: 400, traceSha256: sha('d'), screenshotSha256: sha('e'), measuredAt: at(70 + si * 2 + pi),
    recordCount: scenario.expectedRecordIds.length, listComplete: true, controlsUsable: true })));
  return { tenantId: id(1), releaseCandidateId: id(2), buildSha256: sha('a'), snapshotId: id(3), datasetSha256: sha('b'), recordIds: ids,
    budgets: { maxPageResponseMs: 500, maxInteractiveMs: 1000 }, scenarios, measurements,
    review: { reviewId: id(90), tenantId: id(1), releaseCandidateId: id(2), buildSha256: sha('a'), snapshotId: id(3), reviewerProfileId: id(91),
      permissionKey: 'performance.browser.review', permissionEvidenceId: id(92), reviewedAt: at(90), decision: 'approved', measurementCount: measurements.length },
    evaluatedAt: at(99), ...overrides };
};

test('complete pages and wide narrow budgets bind one immutable snapshot without acceptance inference', () => {
  const result = projectCompleteListPerformanceEvidence(base());
  assert.deepEqual([result.status, result.recordCount, result.scenarioCount], ['evidence_complete', 3, 3]);
  assert.deepEqual([result.functionalAcceptanceInferred, result.careAcceptanceInferred, result.designAcceptanceInferred, result.legalAcceptanceInferred], [false, false, false, false]);
  assert.ok(Object.isFrozen(result));
});

test('unfiltered scenario must contain every original exactly once in strict order', () => {
  const b = base();
  assert.throws(() => projectCompleteListPerformanceEvidence({ ...b, scenarios: b.scenarios.map((s, i) => i ? s : { ...s, expectedRecordIds: ids.slice(0, 2) }) }), /vollstaendig/);
  assert.throws(() => projectCompleteListPerformanceEvidence({ ...b, recordIds: [ids[1], ids[0], ids[2]] }), /strikt aufsteigend/);
});

test('page gaps duplicates order and cursor changes fail closed', () => {
  for (const mutate of [
    (p) => ({ ...p, rowIds: [ids[1], ids[0]] }), (p) => ({ ...p, rowIds: [ids[0], ids[0]] }), (p) => ({ ...p, cursorOut: id(99) }),
  ]) { const b = base(); const first = b.scenarios[0]; assert.throws(() => projectCompleteListPerformanceEvidence({ ...b,
    scenarios: [{ ...first, pages: [mutate(first.pages[0]), first.pages[1]] }, ...b.scenarios.slice(1)] }), /Luecken|Cursor|Seitenbeleg/); }
});

test('search and filter scenarios are both mandatory and snapshot bounded', () => {
  const b = base();
  assert.throws(() => projectCompleteListPerformanceEvidence({ ...b, scenarios: b.scenarios.slice(0, 2) }), /gemeinsam/);
  assert.throws(() => projectCompleteListPerformanceEvidence({ ...b, scenarios: b.scenarios.map((s, i) => i === 1 ? { ...s, expectedRecordIds: [id(99)] } : s) }), /snapshotgebunden/);
});

test('page response and browser interaction budgets are enforced', () => {
  const b = base(); const first = b.scenarios[0];
  assert.throws(() => projectCompleteListPerformanceEvidence({ ...b, scenarios: [{ ...first, pages: [{ ...first.pages[0], responseMs: 501 }, first.pages[1]] }, ...b.scenarios.slice(1)] }), /Antwortbudget/);
  assert.throws(() => projectCompleteListPerformanceEvidence({ ...b, measurements: b.measurements.map((m, i) => i ? m : { ...m, interactiveMs: 1001 }) }), /Budget/);
});

test('every scenario requires exact wide and narrow complete usable browser measurements', () => {
  const b = base(), measurements = b.measurements.slice(0, -1);
  assert.throws(() => projectCompleteListPerformanceEvidence({ ...b, measurements, review: { ...b.review, measurementCount: measurements.length } }), /Unvollstaendige/);
  assert.equal(projectCompleteListPerformanceEvidence({ ...b, measurements, review: null }).status, 'evidence_incomplete');
  assert.throws(() => projectCompleteListPerformanceEvidence({ ...b, measurements: b.measurements.map((m, i) => i ? m : { ...m, listComplete: false }) }), /Vollstaendigkeit/);
});

test('bindings independent review permission and event order fail closed', () => {
  const b = base();
  assert.throws(() => projectCompleteListPerformanceEvidence({ ...b, scenarios: b.scenarios.map((s, i) => i ? s : { ...s, tenantId: id(99) }) }), /nicht exakt/);
  assert.throws(() => projectCompleteListPerformanceEvidence({ ...b, review: { ...b.review, permissionKey: 'design.browser.review' } }), /Berechtigung/);
  assert.throws(() => projectCompleteListPerformanceEvidence({ ...b, review: { ...b.review, reviewedAt: at(1) } }), /kausalen Ereignisfolge/);
});

test('native identities exact shapes own values hashes versions and duplicate profiles are enforced', () => {
  const b = base();
  assert.throws(() => projectCompleteListPerformanceEvidence({ ...b, snapshotId: 'snapshot' }), /native UUID/);
  assert.throws(() => projectCompleteListPerformanceEvidence({ ...b, extra: true }), /nicht erlaubte/);
  const inherited = Object.create({ buildSha256: sha('a') }); Object.assign(inherited, b); delete inherited.buildSha256;
  assert.throws(() => projectCompleteListPerformanceEvidence(inherited), /Originaldatensatz/);
  assert.throws(() => projectCompleteListPerformanceEvidence({ ...b, datasetSha256: 'bad' }), /SHA-256/);
  assert.throws(() => projectCompleteListPerformanceEvidence({ ...b, measurements: [...b.measurements, { ...b.measurements[0], measurementId: id(999) }] }), /doppeltes Szenarioprofil/);
});
