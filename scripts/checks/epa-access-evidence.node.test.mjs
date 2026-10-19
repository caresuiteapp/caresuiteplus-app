import assert from 'node:assert/strict';
import test from 'node:test';
import { projectEPAAccessReview } from '../../src/lib/ti/epaAccessEvidence.ts';

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const base = (overrides = {}) => ({
  tenantId: id(1),
  clientId: id(2),
  providerId: id(3),
  permission: {
    actorId: id(4),
    permission: 'ti.epa.view',
    decision: 'allowed',
    checkedAt: '2026-10-14T12:00:00.000001Z',
  },
  consent: { consentId: id(5), scope: 'epa', status: 'granted', version: 3 },
  procedure: {
    specificationId: ' candidate-procedure ',
    specificationVersion: ' candidate-version ',
    checkedAt: '2026-10-14T12:00:00.000002Z',
  },
  requestedDataScope: ['document_metadata', 'document_content'],
  protocol: {
    requestId: id(6),
    eventId: id(7),
    actorId: id(4),
    recordedAt: '2026-10-14T12:00:00.000003Z',
    eventType: 'epa_access_prepared',
  },
  technicalReview: 'pending',
  legalReview: 'not_provided',
  ...overrides,
});

test('ePA review preserves native bindings, candidate procedure and explicit scope', () => {
  const input = base();
  const review = projectEPAAccessReview(input);
  assert.equal(review.tenantId, input.tenantId);
  assert.equal(review.clientId, input.clientId);
  assert.equal(review.providerId, input.providerId);
  assert.equal(review.candidateSpecificationId, input.procedure.specificationId);
  assert.equal(review.candidateSpecificationVersion, input.procedure.specificationVersion);
  assert.deepEqual(review.requestedDataScope, input.requestedDataScope);
  assert.ok(Object.isFrozen(review));
  assert.ok(Object.isFrozen(review.requestedDataScope));
});

test('permission, consent, procedure, data scope and protocol remain separate evidence', () => {
  const review = projectEPAAccessReview(base());
  assert.equal(review.permissionDecision, 'allowed');
  assert.equal(review.consentStatus, 'granted');
  assert.equal(review.procedureCurrency, 'not_verified');
  assert.equal(review.dataScopeApproval, 'not_confirmed');
  assert.equal(review.protocolEvidence, 'recorded');
});

test('even approved technical and legal reviews never release or execute ePA access', () => {
  const review = projectEPAAccessReview(base({ technicalReview: 'approved', legalReview: 'approved' }));
  assert.equal(review.releaseStatus, 'not_released');
  assert.equal(review.accessExecution, 'not_performed');
  assert.equal(review.procedureCurrency, 'not_verified');
  assert.equal(review.dataScopeApproval, 'not_confirmed');
});

test('denied permission and non-granted consent are recorded without being converted into release', () => {
  for (const status of ['pending', 'revoked', 'expired']) {
    const review = projectEPAAccessReview(base({
      permission: { ...base().permission, decision: 'denied' },
      consent: { ...base().consent, status },
    }));
    assert.equal(review.permissionDecision, 'denied');
    assert.equal(review.consentStatus, status);
    assert.equal(review.releaseStatus, 'not_released');
  }
});

test('foreign, malformed and getter-backed identities fail closed', () => {
  assert.throws(() => projectEPAAccessReview(base({ tenantId: 'tenant' })), /native UUID/);
  assert.throws(() => projectEPAAccessReview(base({
    protocol: { ...base().protocol, actorId: id(9) },
  })), /verschiedene Akteure/);
  const getterBacked = base();
  Object.defineProperty(getterBacked, 'clientId', { get: () => id(2), enumerable: true });
  assert.throws(() => projectEPAAccessReview(getterBacked), /Originalwert/);
});

test('ambiguous, duplicate and unsupported data scopes fail closed', () => {
  for (const requestedDataScope of [
    [],
    ['document_content', 'document_content'],
    ['all_documents'],
    'document_content',
  ]) assert.throws(() => projectEPAAccessReview(base({ requestedDataScope })));
});

test('timestamps require timezone, microseconds, valid calendar and evidence-before-protocol order', () => {
  for (const changed of [
    { permission: { ...base().permission, checkedAt: '2026-10-14T12:00:00Z' } },
    { procedure: { ...base().procedure, checkedAt: '2026-02-30T12:00:00.000001Z' } },
    { protocol: { ...base().protocol, recordedAt: '2026-10-14T12:00:00.000000Z' } },
  ]) assert.throws(() => projectEPAAccessReview(base(changed)));
});
