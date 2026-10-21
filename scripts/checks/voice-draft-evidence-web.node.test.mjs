import assert from 'node:assert/strict';
import test from 'node:test';
import { projectVoiceDraftEvidence } from '../../src/lib/innovation/voiceDraftEvidence.web.ts';
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const sha = (c) => c.repeat(64);
const at = (n) => `2026-10-15T01:00:00.${String(n).padStart(6, '0')}Z`;
const base = (overrides = {}) => ({ tenantId: id(1), clientId: id(2), releaseCandidateId: id(3), buildSha256: sha('a'), draftId: id(4), draftSha256: sha('b'),
  consent: { consentId: id(5), tenantId: id(1), clientId: id(2), purpose: 'care_documentation_voice_draft', decision: 'granted', decidedAt: at(1), revokedAt: null },
  capture: { captureId: id(6), tenantId: id(1), clientId: id(2), releaseCandidateId: id(3), buildSha256: sha('a'), consentId: id(5), capturedByProfileId: id(7), permissionKey: 'pflege.voice_drafts.capture', permissionEvidenceId: id(8), startedAt: at(2), endedAt: at(3), recordingSha256: sha('c') },
  transcript: { transcriptId: id(9), captureId: id(6), engine: 'local-stt', engineVersion: '2.1.0', transcriptSha256: sha('d'), segmentIds: [id(10), id(11)], generatedAt: at(4) },
  speakerAssignments: [10, 11].map((n, i) => ({ assignmentId: id(20 + i), transcriptId: id(9), segmentId: id(n), personId: id(30 + i), assignedByProfileId: id(40), assignedAt: at(5 + i), manualConfirmation: true })),
  review: { reviewId: id(50), draftId: id(4), draftSha256: sha('b'), transcriptId: id(9), transcriptSha256: sha('d'), reviewerProfileId: id(51), permissionKey: 'pflege.voice_drafts.review', permissionEvidenceId: id(52), reviewedAt: at(8), decision: 'approved', segmentCount: 2 },
  persistence: { persistenceId: id(60), draftId: id(4), draftSha256: sha('b'), reviewId: id(50), storedDocumentId: id(61), receiptSha256: sha('e'), persistedAt: at(9) }, evaluatedAt: at(10), ...overrides });

test('explicit consent manual person attribution review and later persistence stay distinct', () => {
  const r = projectVoiceDraftEvidence(base()); assert.equal(r.status, 'persisted_after_confirmation');
  assert.deepEqual([r.clinicalPerformanceInferred, r.taskCompletionInferred, r.functionalAcceptanceInferred, r.careAcceptanceInferred, r.designAcceptanceInferred, r.legalAcceptanceInferred], [false, false, false, false, false, false]); assert.ok(Object.isFrozen(r));
});
test('recording requires exact purpose case candidate build permission and effective consent', () => {
  for (const mutate of [b => ({ ...b, consent: { ...b.consent, decision: 'denied' } }), b => ({ ...b, capture: { ...b.capture, clientId: id(99) } }), b => ({ ...b, capture: { ...b.capture, permissionKey: 'pflege.read' } }), b => ({ ...b, consent: { ...b.consent, revokedAt: at(3) } })]) assert.throws(() => projectVoiceDraftEvidence(mutate(base())), /Freigabe|Aufnahme/);
});
test('transcript must bind capture concrete engine version checksum segments and chronology', () => {
  assert.throws(() => projectVoiceDraftEvidence({ ...base(), transcript: { ...base().transcript, captureId: id(99) } }), /nicht an die Aufnahme/);
  assert.throws(() => projectVoiceDraftEvidence({ ...base(), transcript: { ...base().transcript, engineVersion: 'latest' } }), /Engine und Version/);
  assert.throws(() => projectVoiceDraftEvidence({ ...base(), transcript: { ...base().transcript, generatedAt: at(2) } }), /Ereignisfolge/);
});
test('every segment requires one native manually confirmed person assignment', () => {
  const b = base(); assert.throws(() => projectVoiceDraftEvidence({ ...b, speakerAssignments: b.speakerAssignments.slice(0, 1) }), /Nicht alle/);
  assert.throws(() => projectVoiceDraftEvidence({ ...b, speakerAssignments: b.speakerAssignments.map((a, i) => i ? a : { ...a, manualConfirmation: false }) }), /nicht manuell/);
  assert.throws(() => projectVoiceDraftEvidence({ ...b, speakerAssignments: b.speakerAssignments.map((a, i) => i ? { ...a, segmentId: id(10) } : a) }), /doppelt/);
});
test('draft cannot persist without an approved exact professional review', () => {
  const b = base(); assert.throws(() => projectVoiceDraftEvidence({ ...b, review: null }), /nicht vor fachlicher/);
  assert.throws(() => projectVoiceDraftEvidence({ ...b, review: { ...b.review, decision: 'rejected' } }), /nicht vor fachlicher/);
  assert.throws(() => projectVoiceDraftEvidence({ ...b, review: { ...b.review, draftSha256: sha('f') } }), /nicht exakt/);
});
test('pending rejected approved and persisted states remain explicit', () => {
  const b = base(); assert.equal(projectVoiceDraftEvidence({ ...b, review: null, persistence: null }).status, 'awaiting_professional_review');
  assert.equal(projectVoiceDraftEvidence({ ...b, review: { ...b.review, decision: 'rejected' }, persistence: null }).status, 'professionally_rejected');
  assert.equal(projectVoiceDraftEvidence({ ...b, persistence: null }).status, 'confirmed_not_persisted');
});
test('review and persistence permission bindings counts and microsecond order fail closed', () => {
  const b = base(); assert.throws(() => projectVoiceDraftEvidence({ ...b, review: { ...b.review, permissionKey: 'pflege.voice_drafts.capture' } }), /nicht exakt/);
  assert.throws(() => projectVoiceDraftEvidence({ ...b, review: { ...b.review, segmentCount: 1 } }), /nicht exakt/);
  assert.throws(() => projectVoiceDraftEvidence({ ...b, persistence: { ...b.persistence, persistedAt: at(7) } }), /Ereignisfolge/);
});
test('native identities exact shapes own values and hashes fail closed', () => {
  const b = base(); assert.throws(() => projectVoiceDraftEvidence({ ...b, clientId: 'client' }), /native UUID/); assert.throws(() => projectVoiceDraftEvidence({ ...b, extra: true }), /nicht erlaubte/);
  const inherited = Object.create({ buildSha256: sha('a') }); Object.assign(inherited, b); delete inherited.buildSha256; assert.throws(() => projectVoiceDraftEvidence(inherited), /Originaldatensatz/);
  assert.throws(() => projectVoiceDraftEvidence({ ...b, draftSha256: 'bad' }), /SHA-256/);
});
