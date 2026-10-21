import assert from 'node:assert/strict';
import test from 'node:test';
import { projectClinicalConfigurationActivationEvidence } from '../../src/lib/organization/clinicalConfigurationActivationEvidence.web.ts';

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const sha = (character) => character.repeat(64);
const at = (n) => `2026-10-15T18:00:00.${String(n).padStart(6, '0')}Z`;
const serviceType = (n, serviceCode) => ({ serviceTypeId: id(n), code: serviceCode, catalogVersion: '3.2.1', catalogSha256: sha('b') });
const binding = (capturedAt) => ({ bindingId: id(50), tenantId: id(1), activeConfigurationId: id(40), activeConfigurationVersion: '2.4.0', revision: 7, recordSha256: sha('e'), capturedAt });
const base = (override = {}) => ({
  tenantId: id(1),
  configuration: {
    configurationId: id(10), tenantId: id(1),
    serviceModel: { modelId: id(11), code: 'ambulant.sgb-xi', version: '2.0.0', modelSha256: sha('a') },
    serviceTypes: [serviceType(20, 'care.basic'), serviceType(21, 'care.medication')],
    documentationModel: { modelId: id(30), code: 'sis.ambulant', version: '4.1.0', modelSha256: sha('c') },
    version: '5.0.0-rc.1', recordSha256: sha('d'), revision: 3, createdAt: at(1),
  },
  validationReport: {
    reportId: id(60), tenantId: id(1), configurationId: id(10), configurationVersion: '5.0.0-rc.1', configurationSha256: sha('d'),
    rulesetVersion: '7.0.0', rulesetSha256: sha('f'),
    issues: [
      { code: 'documentation.field-required', path: '$.documentationModel', severity: 'error', message: 'Pflichtfeld fehlt.', ruleVersion: '7.0.0' },
      { code: 'service-type.incompatible', path: '$.serviceTypes[1]', severity: 'error', message: 'Leistungsart ist inkompatibel.', ruleVersion: '7.0.0' },
    ],
    evaluatedAt: at(2),
  },
  activeBindingBefore: binding(at(3)),
  activationAttempt: {
    requestId: id(70), tenantId: id(1), configurationId: id(10), configurationVersion: '5.0.0-rc.1', configurationSha256: sha('d'), validationReportId: id(60),
    actorProfileId: id(71), permissionKey: 'organization.clinical-configuration.activate', expectedBindingRevision: 7, bindingRevision: 7, status: 'rejected',
    reasonCodes: ['documentation.field-required', 'service-type.incompatible'], activatedConfigurationId: null, activatedConfigurationVersion: null, activationCommittedAt: null,
    policyVersion: '2.1.0', policySha256: sha('1'), requestedAt: at(4), decidedAt: at(5),
  },
  activeBindingAfter: binding(at(6)),
  evaluatedAt: at(7),
  ...override,
});

test('invalid configuration is rejected without changing the active binding or inferring acceptance', () => {
  const result = projectClinicalConfigurationActivationEvidence(base());
  assert.deepEqual(result.validationIssueCodes, ['documentation.field-required', 'service-type.incompatible']);
  assert.equal(result.bindingRevision, 7);
  assert.deepEqual([
    result.invalidActivationPrevented, result.bindingActivationInferred, result.functionalAcceptanceInferred,
    result.careAcceptanceInferred, result.designAcceptanceInferred, result.legalAcceptanceInferred,
  ], [true, false, false, false, false, false]);
  assert.ok(Object.isFrozen(result) && Object.isFrozen(result.validationIssueCodes));
});

test('configuration preserves tenant, service model, service types, documentation model, and exact version', () => {
  const value = base();
  assert.throws(() => projectClinicalConfigurationActivationEvidence({ ...value, configuration: { ...value.configuration, tenantId: id(9) } }), /nicht zum Mandanten/);
  assert.throws(() => projectClinicalConfigurationActivationEvidence({ ...value, configuration: { ...value.configuration, serviceTypes: [] } }), /Leistungsarten fehlen/);
  assert.throws(() => projectClinicalConfigurationActivationEvidence({ ...value, configuration: { ...value.configuration, documentationModel: { ...value.configuration.documentationModel, version: 'latest' } } }), /nicht exakt versioniert/);
});

test('service types require native distinct identities, stable codes, catalogs, and ordering', () => {
  const value = base();
  assert.throws(() => projectClinicalConfigurationActivationEvidence({ ...value, configuration: { ...value.configuration, serviceTypes: [serviceType(21, 'care.medication'), serviceType(20, 'care.basic')] } }), /stabil/);
  assert.throws(() => projectClinicalConfigurationActivationEvidence({ ...value, configuration: { ...value.configuration, serviceTypes: [serviceType(20, 'care.basic'), serviceType(21, 'care.basic')] } }), /Dubletten/);
  assert.throws(() => projectClinicalConfigurationActivationEvidence({ ...value, configuration: { ...value.configuration, serviceTypes: [{ ...serviceType(20, 'care.basic'), catalogSha256: 'x' }] } }), /SHA-256/);
});

test('validation report must bind exactly to configuration identity, version, and checksum', () => {
  const value = base();
  assert.throws(() => projectClinicalConfigurationActivationEvidence({ ...value, validationReport: { ...value.validationReport, configurationId: id(99) } }), /nicht exakt an/);
  assert.throws(() => projectClinicalConfigurationActivationEvidence({ ...value, validationReport: { ...value.validationReport, configurationVersion: '5.0.1' } }), /nicht exakt an/);
  assert.throws(() => projectClinicalConfigurationActivationEvidence({ ...value, validationReport: { ...value.validationReport, configurationSha256: sha('9') } }), /nicht exakt an/);
});

test('only nonempty, unique, stably ordered blocking errors prove invalidity', () => {
  const value = base();
  assert.throws(() => projectClinicalConfigurationActivationEvidence({ ...value, validationReport: { ...value.validationReport, issues: [] } }), /mindestens einen Fehler/);
  assert.throws(() => projectClinicalConfigurationActivationEvidence({ ...value, validationReport: { ...value.validationReport, issues: [{ ...value.validationReport.issues[0], severity: 'warning' }] } }), /nur blockierende/);
  assert.throws(() => projectClinicalConfigurationActivationEvidence({ ...value, validationReport: { ...value.validationReport, issues: [value.validationReport.issues[1], value.validationReport.issues[0]] } }), /stabil sortiert/);
});

test('activation attempt requires permission and exact configuration and report binding', () => {
  const value = base();
  assert.throws(() => projectClinicalConfigurationActivationEvidence({ ...value, activationAttempt: { ...value.activationAttempt, permissionKey: 'organization.clinical-configuration.read' } }), /berechtigung fehlt/);
  assert.throws(() => projectClinicalConfigurationActivationEvidence({ ...value, activationAttempt: { ...value.activationAttempt, validationReportId: id(99) } }), /nicht exakt an/);
  assert.throws(() => projectClinicalConfigurationActivationEvidence({ ...value, activationAttempt: { ...value.activationAttempt, configurationSha256: sha('9') } }), /nicht exakt an/);
});

test('invalid activation stays fail-closed with unchanged revision, null commit, and exact reason codes', () => {
  const value = base();
  assert.throws(() => projectClinicalConfigurationActivationEvidence({ ...value, activationAttempt: { ...value.activationAttempt, bindingRevision: 8 } }), /Bindungsrevision veraendert/);
  assert.throws(() => projectClinicalConfigurationActivationEvidence({ ...value, activationAttempt: { ...value.activationAttempt, status: 'activated', activatedConfigurationId: id(10), activatedConfigurationVersion: '5.0.0-rc.1', activationCommittedAt: at(5) } }), /nicht fail-closed/);
  assert.throws(() => projectClinicalConfigurationActivationEvidence({ ...value, activationAttempt: { ...value.activationAttempt, reasonCodes: ['documentation.field-required'] } }), /nicht exakt den Validierungsfehlern/);
  assert.throws(() => projectClinicalConfigurationActivationEvidence({ ...value, activeBindingAfter: { ...value.activeBindingAfter, activeConfigurationId: id(10) } }), /bindung veraendert/);
});

test('configuration, validation, binding, attempt, and decision preserve microsecond chronology and own values', () => {
  const value = base();
  assert.throws(() => projectClinicalConfigurationActivationEvidence({ ...value, validationReport: { ...value.validationReport, evaluatedAt: at(0) } }), /Mikrosekundenfolge/);
  assert.throws(() => projectClinicalConfigurationActivationEvidence({ ...value, activeBindingAfter: { ...value.activeBindingAfter, capturedAt: at(4) } }), /Mikrosekundenfolge/);
  assert.throws(() => projectClinicalConfigurationActivationEvidence({ ...value, configuration: { ...value.configuration, accepted: true } }), /nicht erlaubte Felder/);
  const getter = { ...value.activationAttempt };
  Object.defineProperty(getter, 'policySha256', { enumerable: true, get: () => sha('1') });
  assert.throws(() => projectClinicalConfigurationActivationEvidence({ ...value, activationAttempt: getter }), /Originalwert/);
});
