import assert from 'node:assert/strict';
import test from 'node:test';
import { projectPartnerExchangeEvidence } from '../../src/lib/connect/partnerExchangeEvidence.ts';

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const hash = (c) => c.repeat(64);
const at = (n) => `2026-10-14T16:00:00.${String(n).padStart(6, '0')}Z`;
const base = (overrides = {}) => ({
  tenantId: id(1), clientId: id(2),
  partner: { partnerId: id(3), endpointId: id(4), providerKey: 'partner-a', contractId: id(5), contractVersion: 2, contractStatus: 'active', checkedAt: at(1) },
  specification: { specificationId: id(6), specificationVersion: ' 2.4 ', schemaSha256: hash('a'), checkedAt: at(2) },
  assignment: { assignmentId: id(7), sourceEntityId: id(8), partnerId: id(3), endpointId: id(4), contractId: id(5), contractVersion: 2, specificationId: id(6), specificationVersion: ' 2.4 ', schemaSha256: hash('a'), payloadSha256: hash('b'), recordCount: 3, assignedAt: at(3) },
  transfer: { transferId: id(9), assignmentId: id(7), actorId: id(10), state: 'sent', providerReceiptId: ' provider-receipt ', occurredAt: at(4) },
  acknowledgement: { acknowledgementId: id(11), transferId: id(9), partnerId: id(3), endpointId: id(4), state: 'accepted', payloadSha256: hash('b'), recordCount: 3, acknowledgedAt: at(5) },
  reconciliation: { reconciliationId: id(12), assignmentId: id(7), actorId: id(13), result: 'match', payloadSha256: hash('b'), recordCount: 3, reconciledAt: at(6) },
  errors: [], ...overrides,
});

test('success requires the intended recipient, exact payload and later matching reconciliation', () => {
  const result = projectPartnerExchangeEvidence(base());
  assert.equal(result.state, 'confirmed_correct_assignment');
  assert.equal(result.successConfirmed, true);
  assert.equal(result.dataAtIntendedRecipient, 'confirmed');
  assert.equal(result.providerKey, 'partner-a');
  assert.equal(result.specificationVersion, ' 2.4 ');
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.openErrorIds));
});

test('provider transport receipt without recipient acknowledgement is never success', () => {
  const result = projectPartnerExchangeEvidence(base({ acknowledgement: null, reconciliation: null }));
  assert.equal(result.state, 'sent_unconfirmed');
  assert.equal(result.successConfirmed, false);
  assert.equal(result.dataAtIntendedRecipient, 'not_confirmed');
});

test('failed, uncertain and not-sent transfers retain distinct non-success states', () => {
  for (const [transferState, expected] of [['failed', 'failed'], ['uncertain', 'uncertain'], ['not_sent', 'not_sent']]) {
    const result = projectPartnerExchangeEvidence(base({ transfer: { ...base().transfer, state: transferState, providerReceiptId: null }, acknowledgement: null, reconciliation: null }));
    assert.equal(result.state, expected);
    assert.equal(result.successConfirmed, false);
  }
});

test('foreign partner, endpoint, transfer or assignment bindings fail closed', () => {
  for (const changed of [
    { assignment: { ...base().assignment, partnerId: id(99) } },
    { acknowledgement: { ...base().acknowledgement, endpointId: id(99) } },
    { acknowledgement: { ...base().acknowledgement, transferId: id(99) } },
    { reconciliation: { ...base().reconciliation, assignmentId: id(99) } },
  ]) assert.throws(() => projectPartnerExchangeEvidence(base(changed)), /Originalzuordnung/);
});

test('accepted receipt with different payload or count remains unconfirmed', () => {
  for (const acknowledgement of [
    { ...base().acknowledgement, payloadSha256: hash('c') },
    { ...base().acknowledgement, recordCount: 2 },
  ]) {
    const result = projectPartnerExchangeEvidence(base({ acknowledgement }));
    assert.equal(result.state, 'sent_unconfirmed');
    assert.equal(result.successConfirmed, false);
  }
});

test('mismatched or pending reconciliation cannot confirm correct assignment', () => {
  for (const reconciliation of [
    { ...base().reconciliation, result: 'mismatch' },
    { ...base().reconciliation, result: 'pending' },
    { ...base().reconciliation, payloadSha256: hash('c') },
  ]) assert.equal(projectPartnerExchangeEvidence(base({ reconciliation })).successConfirmed, false);
});

test('inactive contract and unresolved error both block success without erasing evidence', () => {
  assert.equal(projectPartnerExchangeEvidence(base({ partner: { ...base().partner, contractStatus: 'suspended' } })).successConfirmed, false);
  const errorId = id(20);
  const result = projectPartnerExchangeEvidence(base({ errors: [{ errorId, stage: 'transfer', code: 'temporary-provider-error', recordedAt: at(4), resolvedAt: null }] }));
  assert.deepEqual(result.openErrorIds, [errorId]);
  assert.equal(result.successConfirmed, false);
});

test('native identities, own values, microsecond times and causal order are mandatory', () => {
  assert.throws(() => projectPartnerExchangeEvidence(base({ tenantId: 'tenant' })), /native UUID/);
  assert.throws(() => projectPartnerExchangeEvidence(base({ transfer: { ...base().transfer, occurredAt: '2026-10-14T16:00:00Z' } })), /ISO-Zeitpunkt/);
  assert.throws(() => projectPartnerExchangeEvidence(base({ acknowledgement: { ...base().acknowledgement, acknowledgedAt: at(3) } })), /vorherigen Versand/);
  const getter = base();
  Object.defineProperty(getter.assignment, 'payloadSha256', { get: () => hash('b'), enumerable: true });
  assert.throws(() => projectPartnerExchangeEvidence(getter), /Originalwert/);
});
