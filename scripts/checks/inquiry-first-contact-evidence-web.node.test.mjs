import assert from 'node:assert/strict';
import test from 'node:test';
import { projectInquiryFirstContactEvidence } from '../../src/lib/clients/inquiryFirstContactEvidence.web.ts';

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const at = (n) => `2026-10-15T23:55:00.${String(n).padStart(6, '0')}Z`;
const base = (outcome = 'deferred') => ({
  context: { tenantId: id(1), locationId: id(2), profileId: id(3), permissionKey: 'office.inquiries.manage' },
  inquiry: { inquiryId: id(10), tenantId: id(1), locationId: id(2), sourceCode: 'phone', concern: 'Ambulante Versorgung anfragen', callback: { requested: true, channelCode: 'phone', contactValue: '+49 30 123456', dueAt: at(7) }, urgencyCode: 'soon', revision: 4, receivedAt: at(1) },
  decision: { eventId: id(11), inquiryId: id(10), tenantId: id(1), locationId: id(2), profileId: id(3), outcome, reasonCode: outcome === 'accepted' ? null : 'capacity_check', reasonText: outcome === 'accepted' ? null : 'Kapazitaet und Einsatzgebiet pruefen', expectedRevision: 4, newRevision: 5, decidedAt: at(5) },
  evaluatedAt: at(9),
});

test('deferred first contact preserves inquiry, callback and exact revision', () => {
  const result = projectInquiryFirstContactEvidence(base());
  assert.deepEqual([result.tenantId, result.inquiryId, result.outcome, result.revision, result.callbackOpen], [id(1), id(10), 'deferred', 5, true]);
  assert.deepEqual([result.clientCreatedInferred, result.clinicalAcceptanceInferred, result.functionalAcceptanceInferred, result.careAcceptanceInferred, result.designAcceptanceInferred, result.legalAcceptanceInferred], [false, false, false, false, false, false]);
  assert.ok(Object.isFrozen(result));
});
test('accepted and rejected remain explicit distinct outcomes', () => {
  const accepted = base('accepted');
  assert.equal(projectInquiryFirstContactEvidence(accepted).outcome, 'accepted');
  const rejected = base('rejected');
  assert.equal(projectInquiryFirstContactEvidence(rejected).outcome, 'rejected');
});
test('tenant, location, profile and inquiry identity bind the decision', () => {
  const input = base(); input.decision.tenantId = id(99);
  assert.throws(() => projectInquiryFirstContactEvidence(input), /bindet Anfrage und aktuellen Kontext/);
});
test('source, concern, urgency and callback originals are required', () => {
  const input = base(); input.inquiry.concern = '  '; assert.throws(() => projectInquiryFirstContactEvidence(input), /Anliegen/);
  const noCallback = base('accepted'); noCallback.inquiry.callback = { requested: false, channelCode: 'phone', contactValue: null, dueAt: null };
  assert.throws(() => projectInquiryFirstContactEvidence(noCallback), /ohne Rueckrufwunsch/);
});
test('deferred outcome requires a concrete callback after decision', () => {
  const missing = base(); missing.inquiry.callback = { requested: false, channelCode: null, contactValue: null, dueAt: null };
  assert.throws(() => projectInquiryFirstContactEvidence(missing), /konkreten Rueckrufbeleg/);
  const early = base(); early.inquiry.callback.dueAt = at(4); assert.throws(() => projectInquiryFirstContactEvidence(early), /Mikrosekundenfolge/);
});
test('non-acceptance requires a coded and textual reason while acceptance forbids one', () => {
  const rejected = base('rejected'); rejected.decision.reasonText = null; assert.throws(() => projectInquiryFirstContactEvidence(rejected), /Entscheidungsbegruendung/);
  const accepted = base('accepted'); accepted.decision.reasonCode = 'capacity'; assert.throws(() => projectInquiryFirstContactEvidence(accepted), /Annahme darf keinen/);
});
test('decision must advance exactly the loaded native revision', () => {
  const stale = base(); stale.decision.expectedRevision = 3; assert.throws(() => projectInquiryFirstContactEvidence(stale), /Revisionsstand/);
  const jump = base(); jump.decision.newRevision = 6; assert.throws(() => projectInquiryFirstContactEvidence(jump), /Revisionsstand/);
});
test('exact schemas and microsecond chronology fail closed', () => {
  assert.throws(() => projectInquiryFirstContactEvidence({ ...base(), clientId: id(30) }), /nicht erlaubte Felder/);
  const future = base(); future.decision.decidedAt = at(10); assert.throws(() => projectInquiryFirstContactEvidence(future), /Mikrosekundenfolge/);
});
