import assert from 'node:assert/strict';
import test from 'node:test';
import { projectCaseConferenceEvidence } from '../../src/lib/pflege/caseConferenceEvidence.ts';

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const at = (n) => `2026-10-14T17:00:00.${String(n).padStart(6, '0')}Z`;
const participant = (n, overrides = {}) => ({ participantId: id(n), profileId: id(n + 20), roleSnapshot: ` Rolle ${n} `, permissionEvidenceId: id(n + 40), permission: 'allowed', checkedAt: at(1), ...overrides });
const base = (overrides = {}) => ({
  tenantId: id(1), clientId: id(2), conferenceId: id(3), reasonSourceId: id(4), reason: ' Anlass im Original ', heldAt: at(2),
  participants: [participant(5), participant(6)],
  decisions: [{ decisionId: id(7), recordedByParticipantId: id(5), decision: ' Beschluss im Original ', followUpTaskId: id(8), decidedAt: at(3) }],
  tasks: [{ taskId: id(8), decisionId: id(7), responsibleParticipantId: id(6), state: 'completed', dueAt: at(4), completedAt: at(5) }],
  results: [{ resultId: id(9), taskId: id(8), verifierParticipantId: id(5), verifierProfileId: id(25), outcome: 'achieved', evidenceId: id(10), evidenceSha256: 'a'.repeat(64), occurredAt: at(6), verifiedAt: at(7) }],
  ...overrides,
});

test('decision is verified only through responsible completed task and later evidence review', () => {
  const result = projectCaseConferenceEvidence(base());
  assert.equal(result.state, 'all_decisions_verified');
  assert.equal(result.allDecisionsVerified, true);
  assert.equal(result.decisions[0].responsibleParticipantId, id(6));
  assert.equal(result.decisions[0].outcome, 'verified_achieved');
  assert.equal(result.clinicalCompletionInferred, false);
  assert.equal(result.reason, ' Anlass im Original ');
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.decisions));
});

test('attendance and recorded decision never imply implementation or clinical completion', () => {
  const result = projectCaseConferenceEvidence(base({ tasks: [{ ...base().tasks[0], state: 'open', completedAt: null }], results: [] }));
  assert.equal(result.state, 'open');
  assert.equal(result.decisions[0].outcome, 'open');
  assert.equal(result.clinicalCompletionInferred, false);
});

test('partial or not-achieved latest result keeps decision unverified', () => {
  for (const outcome of ['partial', 'not_achieved']) {
    const result = projectCaseConferenceEvidence(base({ results: [{ ...base().results[0], outcome }] }));
    assert.equal(result.decisions[0].outcome, 'not_achieved');
    assert.equal(result.allDecisionsVerified, false);
  }
});

test('foreign or denied participants cannot record, own, or verify conference work', () => {
  assert.throws(() => projectCaseConferenceEvidence(base({ decisions: [{ ...base().decisions[0], recordedByParticipantId: id(99) }] })), /berechtigter Teilnehmer/);
  assert.throws(() => projectCaseConferenceEvidence(base({ tasks: [{ ...base().tasks[0], responsibleParticipantId: id(99) }] })), /Teilnehmerzustaendigkeit/);
  assert.throws(() => projectCaseConferenceEvidence(base({ participants: [participant(5, { permission: 'denied' }), participant(6)], results: [] })), /Beschlussakteur/);
  assert.throws(() => projectCaseConferenceEvidence(base({ results: [{ ...base().results[0], verifierProfileId: id(99) }] })), /Teilnehmerbeleg/);
});

test('decision and follow-up task require exact unique bidirectional bindings', () => {
  assert.throws(() => projectCaseConferenceEvidence(base({ tasks: [{ ...base().tasks[0], decisionId: id(99) }] })), /gegenseitig gebunden/);
  assert.throws(() => projectCaseConferenceEvidence(base({ tasks: [...base().tasks, { ...base().tasks[0], taskId: id(11) }] })), /Ungebundene Folgeaufgabe/);
  assert.throws(() => projectCaseConferenceEvidence(base({ decisions: [...base().decisions, { ...base().decisions[0], decisionId: id(12) }] })), /doppelte native Kennungen/);
});

test('result cannot precede task completion and completed task needs an explicit completed time', () => {
  assert.throws(() => projectCaseConferenceEvidence(base({ results: [{ ...base().results[0], occurredAt: at(4), verifiedAt: at(4) }] })), /vorherigen Aufgabenabschluss/);
  assert.throws(() => projectCaseConferenceEvidence(base({ tasks: [{ ...base().tasks[0], completedAt: null }] })), /widersprechen/);
  assert.throws(() => projectCaseConferenceEvidence(base({ tasks: [{ ...base().tasks[0], state: 'open' }] })), /widersprechen/);
});

test('latest result controls the verifiable outcome while preserving distinct result identities', () => {
  const first = { ...base().results[0], resultId: id(11), outcome: 'not_achieved', occurredAt: at(5), verifiedAt: at(6) };
  const result = projectCaseConferenceEvidence(base({ results: [first, base().results[0]] }));
  assert.equal(result.decisions[0].latestResultId, id(9));
  assert.equal(result.decisions[0].outcome, 'verified_achieved');
  assert.throws(() => projectCaseConferenceEvidence(base({ results: [base().results[0], base().results[0]] })), /doppelte native Kennungen/);
});

test('native own identities and complete microsecond chronology fail closed', () => {
  assert.throws(() => projectCaseConferenceEvidence(base({ clientId: 'client' })), /native UUID/);
  assert.throws(() => projectCaseConferenceEvidence(base({ heldAt: '2026-10-14T17:00:00Z' })), /ISO-Zeitpunkt/);
  assert.throws(() => projectCaseConferenceEvidence(base({ decisions: [{ ...base().decisions[0], decidedAt: at(1) }] })), /vor der Besprechung/);
  const getter = base();
  Object.defineProperty(getter, 'reason', { get: () => 'Anlass', enumerable: true });
  assert.throws(() => projectCaseConferenceEvidence(getter), /Originalwert/);
});
