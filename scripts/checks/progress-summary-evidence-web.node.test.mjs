import assert from 'node:assert/strict';
import test from 'node:test';
import { projectProgressSummaryEvidence } from '../../src/lib/innovation/progressSummaryEvidence.web.ts';

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const sha = (char) => char.repeat(64);
const at = (n) => `2026-10-15T06:00:00.${String(n).padStart(6, '0')}Z`;

const base = (overrides = {}) => ({
  tenantId: id(1), clientId: id(2), releaseCandidateId: id(3), buildSha256: sha('a'),
  snapshot: { snapshotId: id(4), tenantId: id(1), clientId: id(2), releaseCandidateId: id(3), buildSha256: sha('a'), snapshotSha256: sha('b'), requirementCount: 2, capturedAt: at(5) },
  requirements: [
    { requirementId: id(10), fieldCode: 'blood-pressure-systolic', unitCode: 'mm[Hg]' },
    { requirementId: id(11), fieldCode: 'body-weight', unitCode: 'kg' },
  ],
  sources: [{ sourceId: id(20), tenantId: id(1), clientId: id(2), sourceRecordId: id(21), sourceType: 'confirmed-vital-measurement', sourceVersion: '2.1.0', sourceSha256: sha('c'), recordedAt: at(2) }],
  confirmedData: [{ dataPointId: id(30), requirementId: id(10), sourceId: id(20), sourceRecordId: id(21), sourceSha256: sha('c'), fieldCode: 'blood-pressure-systolic', value: 128, unitCode: 'mm[Hg]', observedAt: at(2), confirmedAt: at(3), confirmedByProfileId: id(31), permissionKey: 'pflege.progress.confirm', permissionEvidenceId: id(32) }],
  summary: {
    summaryId: id(40), snapshotId: id(4), snapshotSha256: sha('b'), modelId: 'evidence-linked-progress-summary', modelVersion: '1.0.0',
    statements: [{ statementId: id(41), text: 'Der bestaetigte systolische Messwert betraegt 128 mmHg.', dataPointIds: [id(30)], sourceIds: [id(20)], unitCodes: ['mm[Hg]'] }],
    missingData: [{ requirementId: id(11), fieldCode: 'body-weight', unitCode: 'kg', reason: 'Im Snapshot liegt kein bestaetigter Gewichtsdatensatz vor.', detectedAt: at(6) }],
    summarySha256: sha('d'), createdAt: at(7), clinicalTrendAsserted: false, carePerformanceAsserted: false, taskCompletionAsserted: false,
  },
  review: { reviewId: id(50), summaryId: id(40), summarySha256: sha('d'), reviewerProfileId: id(51), permissionKey: 'pflege.progress.review', permissionEvidenceId: id(52), decision: 'confirmed', rationale: 'Quellen, Einheiten, Zeitbezug und Datenluecke wurden einzeln geprueft.', reviewedAt: at(8) },
  evaluatedAt: at(9),
  ...overrides,
});

test('confirmed summary links evidence and exposes missing data without clinical inference', () => {
  const result = projectProgressSummaryEvidence(base());
  assert.equal(result.status, 'professionally_confirmed');
  assert.deepEqual([result.confirmedDataCount, result.missingDataCount, result.statementCount], [1, 1, 1]);
  assert.deepEqual([result.clinicalTrendInferred, result.carePerformanceInferred, result.taskCompletionInferred, result.functionalAcceptanceInferred, result.careAcceptanceInferred, result.designAcceptanceInferred, result.legalAcceptanceInferred], [false, false, false, false, false, false, false]);
  assert.ok(Object.isFrozen(result));
});
test('snapshot binds exact tenant case candidate build and complete requirements', () => {
  const value = base();
  for (const snapshot of [{ ...value.snapshot, clientId: id(99) }, { ...value.snapshot, buildSha256: sha('9') }, { ...value.snapshot, requirementCount: 3 }]) {
    assert.throws(() => projectProgressSummaryEvidence({ ...value, snapshot }), /Verlaufssnapshot|Anforderungssumme/);
  }
});
test('sources preserve native tenant case record hash version and source time', () => {
  const value = base();
  assert.throws(() => projectProgressSummaryEvidence({ ...value, sources: [{ ...value.sources[0], tenantId: id(99) }] }), /Quelle gehoert/);
  assert.throws(() => projectProgressSummaryEvidence({ ...value, sources: [{ ...value.sources[0], sourceVersion: 'latest' }] }), /Quellenfassung/);
  assert.throws(() => projectProgressSummaryEvidence({ ...value, sources: [{ ...value.sources[0], recordedAt: at(6) }], confirmedData: [{ ...value.confirmedData[0], observedAt: at(6) }] }), /Snapshot-Zeitbezug/);
});
test('confirmed data retains exact requirement source unit permission and microsecond chronology', () => {
  const value = base();
  assert.throws(() => projectProgressSummaryEvidence({ ...value, confirmedData: [{ ...value.confirmedData[0], sourceSha256: sha('9') }] }), /nicht exakt/);
  assert.throws(() => projectProgressSummaryEvidence({ ...value, confirmedData: [{ ...value.confirmedData[0], unitCode: 'kPa' }] }), /Einheit/);
  assert.throws(() => projectProgressSummaryEvidence({ ...value, confirmedData: [{ ...value.confirmedData[0], permissionKey: 'pflege.progress.read' }] }), /Bestaetigungsberechtigung/);
  assert.throws(() => projectProgressSummaryEvidence({ ...value, confirmedData: [{ ...value.confirmedData[0], confirmedAt: at(1) }] }), /Zeitbezug/);
});
test('every statement links concrete data sources and units completely', () => {
  const value = base();
  assert.throws(() => projectProgressSummaryEvidence({ ...value, summary: { ...value.summary, statements: [{ ...value.summary.statements[0], dataPointIds: [] }] } }), /keinen konkreten Datenbeleg/);
  assert.throws(() => projectProgressSummaryEvidence({ ...value, summary: { ...value.summary, statements: [{ ...value.summary.statements[0], sourceIds: [] }] } }), /nicht vollstaendig/);
  assert.throws(() => projectProgressSummaryEvidence({ ...value, summary: { ...value.summary, statements: [{ ...value.summary.statements[0], unitCodes: ['kPa'] }] } }), /nicht vollstaendig/);
});
test('every unconfirmed requirement is marked missing exactly once with original unit', () => {
  const value = base();
  assert.throws(() => projectProgressSummaryEvidence({ ...value, summary: { ...value.summary, missingData: [] } }), /nicht jede unbelegte/);
  assert.throws(() => projectProgressSummaryEvidence({ ...value, summary: { ...value.summary, missingData: [{ ...value.summary.missingData[0], unitCode: 'g' }] } }), /bewahrt Feld und Einheit/);
  assert.throws(() => projectProgressSummaryEvidence({ ...value, summary: { ...value.summary, missingData: [value.summary.missingData[0], value.summary.missingData[0]] } }), /doppelt markiert/);
});
test('summary cannot assert trend performance or task completion', () => {
  const value = base();
  for (const field of ['clinicalTrendAsserted', 'carePerformanceAsserted', 'taskCompletionAsserted']) {
    assert.throws(() => projectProgressSummaryEvidence({ ...value, summary: { ...value.summary, [field]: true } }), /keinen klinischen Trend/);
  }
});
test('pending rejected and confirmed review states remain distinct and permission bound', () => {
  const value = base();
  assert.equal(projectProgressSummaryEvidence({ ...value, review: null }).status, 'awaiting_professional_review');
  assert.equal(projectProgressSummaryEvidence({ ...value, review: { ...value.review, decision: 'rejected' } }).status, 'professionally_rejected');
  assert.throws(() => projectProgressSummaryEvidence({ ...value, review: { ...value.review, summarySha256: sha('9') } }), /nicht exakt/);
  assert.throws(() => projectProgressSummaryEvidence({ ...value, review: { ...value.review, permissionKey: 'pflege.progress.read' } }), /nicht exakt/);
});
