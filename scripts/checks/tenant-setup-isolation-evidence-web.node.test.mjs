import assert from 'node:assert/strict';
import test from 'node:test';
import { projectTenantSetupIsolationEvidence } from '../../src/lib/organization/tenantSetupIsolationEvidence.web.ts';

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const sha = (c) => c.repeat(64);
const at = (n) => `2026-10-15T10:00:00.${String(n).padStart(6, '0')}Z`;

const address = (tenant, service, n, primary = true) => ({
  addressId: id(n), tenantId: id(tenant), serviceId: id(service), kind: 'service', street: 'Pflegeweg',
  houseNumber: String(n), postalCode: '10115', city: 'Berlin', countryCode: 'DE', isPrimary: primary,
});
const setup = (tenant, service, n) => ({
  operationId: id(n), tenantId: id(tenant), serviceId: id(service), serviceName: `Dienst ${service}`,
  branchId: id(n + 1), branchName: `Niederlassung ${service}`, ikNumber: String(260000000 + service),
  addresses: [address(tenant, service, n + 2)], responsibleProfileId: id(n + 3), responsibilityRole: 'Pflegedienstleitung',
  requestSha256: sha('a'), receiptSha256: sha('b'), revision: 1, createdAt: at(1), committedAt: at(2),
});
const denial = (sourceTenant, sourceService, targetTenant, targetService, n) => ({
  requestId: id(n), requesterTenantId: id(sourceTenant), requesterServiceId: id(sourceService),
  targetTenantId: id(targetTenant), targetServiceId: id(targetService), targetResourceId: id(n + 1),
  permissionKey: 'organization.service.read', policyVersion: '1.0.0', policySha256: sha('c'), decision: 'denied',
  denialCode: 'tenant_scope_mismatch', returnedRowCount: 0, decisionEvidenceId: id(n + 2), requestedAt: at(3), decidedAt: at(4),
});
const base = (override = {}) => ({
  setups: [setup(1, 11, 101), setup(2, 22, 201)],
  crossAccessDenials: [denial(1, 11, 2, 22, 301), denial(2, 22, 1, 11, 401)],
  evaluatedAt: at(5),
  ...override,
});

test('two complete service receipts and both denied directions yield only isolation evidence', () => {
  const result = projectTenantSetupIsolationEvidence(base());
  assert.deepEqual(result.tenantIds, [id(1), id(2)]);
  assert.deepEqual(result.serviceIds, [id(11), id(22)]);
  assert.equal(result.bidirectionalIsolationEvidenced, true);
  assert.equal(result.returnedRowCount, 0);
  assert.deepEqual([result.setupCompletedInferred, result.dataCreatedInferred, result.functionalAcceptanceInferred, result.careAcceptanceInferred, result.designAcceptanceInferred, result.legalAcceptanceInferred], [false, false, false, false, false, false]);
  assert.ok(Object.isFrozen(result) && Object.isFrozen(result.tenantIds) && Object.isFrozen(result.serviceIds));
});

test('exactly two natively distinct tenant and service identities are mandatory', () => {
  const b = base();
  assert.throws(() => projectTenantSetupIsolationEvidence({ ...b, setups: [b.setups[0]] }), /genau zwei/);
  assert.throws(() => projectTenantSetupIsolationEvidence({ ...b, setups: [b.setups[0], { ...b.setups[1], tenantId: id(1), addresses: [{ ...b.setups[1].addresses[0], tenantId: id(1) }] }] }), /getrennte Mandanten/);
  assert.throws(() => projectTenantSetupIsolationEvidence({ ...b, setups: [b.setups[0], { ...b.setups[1], serviceId: id(11), addresses: [{ ...b.setups[1].addresses[0], serviceId: id(11) }] }] }), /Dienstkennungen/);
});

test('service branch IK and responsible person remain mandatory original fields', () => {
  const b = base();
  for (const [field, value] of [['branchName', ''], ['ikNumber', '123'], ['responsibleProfileId', 'profile'], ['responsibilityRole', '']]) {
    assert.throws(() => projectTenantSetupIsolationEvidence({ ...b, setups: [{ ...b.setups[0], [field]: value }, b.setups[1]] }));
  }
});

test('addresses stay bound to tenant and service and require one primary address', () => {
  const b = base();
  const foreign = { ...b.setups[0].addresses[0], tenantId: id(99) };
  assert.throws(() => projectTenantSetupIsolationEvidence({ ...b, setups: [{ ...b.setups[0], addresses: [foreign] }, b.setups[1]] }), /gehoert nicht/);
  const noPrimary = { ...b.setups[0].addresses[0], isPrimary: false };
  assert.throws(() => projectTenantSetupIsolationEvidence({ ...b, setups: [{ ...b.setups[0], addresses: [noPrimary] }, b.setups[1]] }), /genau eine Primaeradresse/);
  assert.throws(() => projectTenantSetupIsolationEvidence({ ...b, setups: [{ ...b.setups[0], addresses: [b.setups[0].addresses[0], { ...b.setups[0].addresses[0] }] }, b.setups[1]] }), /doppelte/);
});

test('setup receipts preserve checksums revision and microsecond chronology', () => {
  const b = base();
  assert.throws(() => projectTenantSetupIsolationEvidence({ ...b, setups: [{ ...b.setups[0], receiptSha256: 'receipt' }, b.setups[1]] }), /SHA-256/);
  assert.throws(() => projectTenantSetupIsolationEvidence({ ...b, setups: [{ ...b.setups[0], revision: 0 }, b.setups[1]] }), /positive sichere Revision/);
  assert.throws(() => projectTenantSetupIsolationEvidence({ ...b, setups: [{ ...b.setups[0], committedAt: at(0) }, b.setups[1]] }), /Mikrosekundenfolge/);
});

test('both denial receipts are directionally bound to requester and foreign target', () => {
  const b = base();
  assert.throws(() => projectTenantSetupIsolationEvidence({ ...b, crossAccessDenials: [{ ...b.crossAccessDenials[0], requesterServiceId: id(22) }, b.crossAccessDenials[1]] }), /anfragenden Dienst/);
  assert.throws(() => projectTenantSetupIsolationEvidence({ ...b, crossAccessDenials: [{ ...b.crossAccessDenials[0], targetTenantId: id(1) }, b.crossAccessDenials[1]] }), /fremden Zieldienst/);
  assert.throws(() => projectTenantSetupIsolationEvidence({ ...b, crossAccessDenials: [b.crossAccessDenials[1], b.crossAccessDenials[0]] }), /anfragenden Dienst/);
});

test('an allowed decision or returned foreign row can never evidence isolation', () => {
  const b = base();
  assert.throws(() => projectTenantSetupIsolationEvidence({ ...b, crossAccessDenials: [{ ...b.crossAccessDenials[0], decision: 'allowed' }, b.crossAccessDenials[1]] }), /nicht verweigert/);
  assert.throws(() => projectTenantSetupIsolationEvidence({ ...b, crossAccessDenials: [{ ...b.crossAccessDenials[0], returnedRowCount: 1 }, b.crossAccessDenials[1]] }), /keine Datenzeile/);
  assert.throws(() => projectTenantSetupIsolationEvidence({ ...b, crossAccessDenials: [{ ...b.crossAccessDenials[0], policyVersion: 'latest' }, b.crossAccessDenials[1]] }), /nicht exakt versioniert/);
});

test('denials must occur after both commits and preserve exact own values only', () => {
  const b = base();
  assert.throws(() => projectTenantSetupIsolationEvidence({ ...b, crossAccessDenials: [{ ...b.crossAccessDenials[0], requestedAt: at(1) }, b.crossAccessDenials[1]] }), /nach beiden Dienstanlagen/);
  assert.throws(() => projectTenantSetupIsolationEvidence({ ...b, crossAccessDenials: [{ ...b.crossAccessDenials[0], responseBody: 'secret' }, b.crossAccessDenials[1]] }), /nicht erlaubte Felder/);
  const accessor = { ...b.crossAccessDenials[0] };
  Object.defineProperty(accessor, 'denialCode', { enumerable: true, get: () => 'tenant_scope_mismatch' });
  assert.throws(() => projectTenantSetupIsolationEvidence({ ...b, crossAccessDenials: [accessor, b.crossAccessDenials[1]] }), /Originalwert/);
});
