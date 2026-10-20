import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import {
  assertCanFinalizeDocument,
  buildSystemPlaceholderRegistry,
  createEmptyDocumentContext,
  renderTemplate,
  resetDocumentContextRepository,
  searchPlaceholders,
  validateDocumentByType,
  validateKnownPlaceholders,
} from '@/features/documents/templateEngine';

const TENANT = DEMO_TENANT_ID;

describe('placeholder management', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    resetDocumentContextRepository();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetDocumentContextRepository();
  });

  it('Placeholder Registry lädt', () => {
    const registry = buildSystemPlaceholderRegistry();
    expect(registry.size).toBeGreaterThan(50);
    expect(registry.has('company.name')).toBe(true);
    expect(registry.has('invoice.number')).toBe(true);
  });

  it('Suche funktioniert', () => {
    const results = searchPlaceholders({ query: 'rechnung' });
    expect(results.some((e) => e.key.startsWith('invoice.'))).toBe(true);

    const byGroup = searchPlaceholders({ group: 'signature' });
    expect(byGroup.every((e) => e.group === 'signature')).toBe(true);
    expect(byGroup.length).toBeGreaterThan(0);
  });

  it('unbekannter Platzhalter wird erkannt', () => {
    const result = validateKnownPlaceholders(['company.name', 'foo.bar']);
    expect(result.status).toBe('error');
    expect(result.issues.some((i) => i.placeholderKey === 'foo.bar')).toBe(true);
  });

  it('Pflichtfelder Rechnung werden geprüft', () => {
    const context = createEmptyDocumentContext({
      tenantId: TENANT,
      entityType: 'invoice',
      entityId: 'inv-1',
    });
    const result = validateDocumentByType('invoice', context);
    expect(result.status).toBe('error');
    expect(result.issues.some((i) => i.fieldKey === 'invoice.number')).toBe(true);
    expect(result.issues.some((i) => i.fieldKey === 'company.iban')).toBe(true);
  });

  it('Pflichtfelder Vertrag werden geprüft', () => {
    const context = createEmptyDocumentContext({
      tenantId: TENANT,
      entityType: 'contract',
      entityId: 'c-1',
    });
    const result = validateDocumentByType('contract', context);
    expect(result.status).toBe('error');
    expect(result.issues.some((i) => i.fieldKey === 'contract.start_date')).toBe(true);
    expect(result.issues.some((i) => i.fieldKey === 'contract.privacy_clause')).toBe(true);
  });

  it('Pflichtfelder Leistungsnachweis werden geprüft', () => {
    const context = createEmptyDocumentContext({
      tenantId: TENANT,
      entityType: 'service_record',
      entityId: 'sr-1',
    });
    const result = validateDocumentByType('service_record', context);
    expect(result.status).toBe('error');
    expect(result.issues.some((i) => i.fieldKey === 'visit.duration')).toBe(true);
    expect(result.issues.some((i) => i.fieldKey === 'visit.budget_reference')).toBe(true);
  });

  it('Pflichtfelder Dokumentation werden geprüft', () => {
    const context = createEmptyDocumentContext({
      tenantId: TENANT,
      entityType: 'care_documentation',
      entityId: 'doc-1',
    });
    const result = validateDocumentByType('care_documentation', context);
    expect(result.status).toBe('error');
    expect(result.issues.some((i) => i.fieldKey === 'document.content')).toBe(true);
  });

  it('Live-Vorschau erhält Fehlerliste', () => {
    const context = createEmptyDocumentContext({
      tenantId: TENANT,
      entityType: 'invoice',
      entityId: 'inv-1',
    });
    const result = renderTemplate(
      { htmlTemplate: '<p>{{invoice.number}} — {{client.full_name}}</p>' },
      { context, documentType: 'invoice' },
    );
    expect(result.validation.status).toBe('error');
    expect(result.missingRequiredFields.length).toBeGreaterThan(0);
    expect(result.html).toContain('cs-placeholder-unresolved');
  });

  it('Finalisierung wird bei Fehlern blockiert', () => {
    const context = createEmptyDocumentContext({
      tenantId: TENANT,
      entityType: 'invoice',
      entityId: 'inv-1',
    });
    const check = assertCanFinalizeDocument({
      documentType: 'invoice',
      context,
      templateVersion: { htmlTemplate: '<p>{{invoice.number}}</p>' },
    });
    expect(check.allowed).toBe(false);
    expect(check.validation.status).toBe('error');
  });
});
