import { describe, expect, it } from 'vitest';
import {
  createUnavailableEInvoiceValidationReport,
  getOfficeEInvoiceReleaseDecision,
  OFFICE_EINVOICE_VALIDATION_CAPABILITY,
  type OfficeEInvoiceValidationReport,
} from '@/lib/office/eInvoiceValidation.web';

const hash = 'a'.repeat(64);
const profile = 'urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0';
const report = (): OfficeEInvoiceValidationReport => ({
  schemaVersion: 1, status: 'valid', documentSha256: hash,
  syntax: 'ubl_invoice', profileId: profile, source: 'server',
  engine: { name: 'test-fixture-engine', version: '1.0' },
  ruleSet: { name: 'test-fixture-rules', version: '1.0', sha256: 'b'.repeat(64) },
  checks: [{ kind: 'syntax', status: 'passed' }, { kind: 'xsd', status: 'passed' }, { kind: 'business_rules', status: 'passed' }],
  findings: [], checkedAt: '2026-10-18T09:00:00Z', serverValidationId: 'test-fixture-only',
});

describe('E-Rechnungsprüfung und Freigabegrenze', () => {
  it('does not equate successful parsing with full validation', () => {
    const value = createUnavailableEInvoiceValidationReport({ documentSha256: hash, syntax: 'ubl_invoice', profileId: profile, syntaxParsed: true });
    expect(value.status).toBe('unavailable');
    expect(value.checks).toEqual([{ kind: 'syntax', status: 'passed' }, { kind: 'xsd', status: 'not_run' }, { kind: 'business_rules', status: 'not_run' }]);
    expect(value.engine).toBeNull();
    expect(value.checkedAt).toBeNull();
    expect(getOfficeEInvoiceReleaseDecision(value, hash, profile).allowed).toBe(false);
  });

  it('requires the exact original byte hash and chosen profile', () => {
    expect(getOfficeEInvoiceReleaseDecision(report(), 'c'.repeat(64), profile).reason).toBe('different_document');
    expect(getOfficeEInvoiceReleaseDecision(report(), hash, 'different-profile').reason).toBe('different_profile');
    expect(() => createUnavailableEInvoiceValidationReport({ documentSha256: '', syntax: 'cii', profileId: profile, syntaxParsed: false })).toThrow('SHA-256');
  });

  it.each(['syntax', 'xsd', 'business_rules'] as const)('requires an actual completed %s check', kind => {
    const value = report();
    value.checks = value.checks.filter(check => check.kind !== kind);
    expect(getOfficeEInvoiceReleaseDecision(value, hash, profile).reason).toBe('incomplete_checks');
  });

  it('cannot hide a failed or contradictory check behind a valid status', () => {
    const value = report();
    value.checks = [...value.checks, { kind: 'xsd', status: 'failed' }];
    expect(getOfficeEInvoiceReleaseDecision(value, hash, profile).reason).toBe('invalid');
    value.checks = [...report().checks, { kind: 'xsd', status: 'passed' }];
    expect(getOfficeEInvoiceReleaseDecision(value, hash, profile).reason).toBe('incomplete_checks');
  });

  it('requires engine, rules and execution provenance', () => {
    const value = report();
    value.engine = null;
    expect(getOfficeEInvoiceReleaseDecision(value, hash, profile).reason).toBe('incomplete_checks');
    value.engine = report().engine;
    value.ruleSet = { name: 'rules', version: '1', sha256: '' };
    expect(getOfficeEInvoiceReleaseDecision(value, hash, profile).reason).toBe('incomplete_checks');
  });

  it('rejects client reports and cannot be enabled with forged server-looking JSON', () => {
    const value = report();
    value.source = 'browser';
    expect(getOfficeEInvoiceReleaseDecision(value, hash, profile).reason).toBe('untrusted_report');
    value.source = 'server';
    expect(getOfficeEInvoiceReleaseDecision(value, hash, profile)).toMatchObject({ allowed: false, reason: 'validator_unavailable' });
    expect(OFFICE_EINVOICE_VALIDATION_CAPABILITY.available).toBe(false);
    expect(OFFICE_EINVOICE_VALIDATION_CAPABILITY.serverIssuanceAvailable).toBe(false);
  });
});
