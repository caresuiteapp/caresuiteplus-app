import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import {
  buildDocumentContext,
  createEmptyDocumentContext,
  extractPlaceholders,
  renderTemplate,
  resetDocumentContextRepository,
  sanitizeTemplateHtml,
  validateDocumentByType,
  validateKnownPlaceholders,
  validateRequiredFields,
} from '@/features/documents/templateEngine';
import { getServiceMode } from '@/lib/services/mode';

const TENANT = DEMO_TENANT_ID;

describe('document templateEngine', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    resetDocumentContextRepository();
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetDocumentContextRepository();
  });

  it('erkennt Platzhalter in HTML', () => {
    const html = '<p>{{company.name}} — {{client.full_name}} — Seite {{page.number}}</p>';
    expect(extractPlaceholders(html)).toEqual(['client.full_name', 'company.name', 'page.number']);
  });

  it('meldet unbekannte Platzhalter als Fehler', () => {
    const result = validateKnownPlaceholders(['company.name', 'unknown.field']);
    expect(result.status).toBe('error');
    expect(result.issues.some((i) => i.placeholderKey === 'unknown.field')).toBe(true);
  });

  it('ersetzt bekannte Platzhalter beim Rendern', () => {
    const context = createEmptyDocumentContext({
      tenantId: TENANT,
      entityType: 'invoice',
      entityId: 'inv-1',
    });
    context.company.name = 'Test GmbH';
    context.client.full_name = 'Max Mustermann';
    context.invoice.number = 'RE-2026-001';

    const result = renderTemplate(
      {
        htmlTemplate: '<h1>{{company.name}}</h1><p>{{client.full_name}} — {{invoice.number}}</p>',
        cssTemplate: '.cs-document-root { font-family: sans-serif; }',
      },
      { context, documentType: 'invoice' },
    );

    expect(result.html).toContain('Test GmbH');
    expect(result.html).toContain('Max Mustermann');
    expect(result.html).toContain('RE-2026-001');
    expect(result.unresolvedPlaceholders).toHaveLength(0);
  });

  it('erkennt fehlende Pflichtfelder', () => {
    const context = createEmptyDocumentContext({
      tenantId: TENANT,
      entityType: 'invoice',
      entityId: 'inv-1',
    });

    const result = validateRequiredFields(
      {
        requiredFields: [
          {
            fieldKey: 'invoice.number',
            label: 'Rechnungsnummer',
            dataPath: 'invoice.number',
            isRequired: true,
            errorMessage: 'Rechnungsnummer fehlt.',
          },
        ],
      },
      context,
    );

    expect(result.status).toBe('error');
    expect(result.issues[0]?.fieldKey).toBe('invoice.number');
  });

  it('blockiert script-Tags in HTML', () => {
    const { html, blocked } = sanitizeTemplateHtml('<p>OK</p><script>alert(1)</script>');
    expect(html).not.toContain('<script');
    expect(blocked.some((b) => b.code === 'blocked_tag')).toBe(true);
  });

  it('blockiert inline onclick Handler', () => {
    const { blocked } = sanitizeTemplateHtml('<button onclick="steal()">Klick</button>');
    expect(blocked.some((b) => b.code === 'blocked_event_handler')).toBe(true);
  });

  it('validiert Rechnung ohne Rechnungsnummer nicht', () => {
    const context = createEmptyDocumentContext({
      tenantId: TENANT,
      entityType: 'invoice',
      entityId: 'inv-1',
    });
    const result = validateDocumentByType('invoice', context);
    expect(result.status).toBe('error');
    expect(result.issues.some((i) => i.fieldKey === 'invoice.number')).toBe(true);
  });

  it('validiert Vertrag ohne Vertragsparteien nicht', () => {
    const context = createEmptyDocumentContext({
      tenantId: TENANT,
      entityType: 'contract',
      entityId: 'c-1',
    });
    const result = validateDocumentByType('contract', context);
    expect(result.status).toBe('error');
    expect(result.issues.length).toBeGreaterThanOrEqual(2);
  });

  it('validiert Leistungsnachweis ohne Zeiten nicht', () => {
    const context = createEmptyDocumentContext({
      tenantId: TENANT,
      entityType: 'service_record',
      entityId: 'sr-1',
    });
    const result = validateDocumentByType('service_record', context);
    expect(result.status).toBe('error');
    expect(result.issues.some((i) => i.fieldKey === 'visit.start_time')).toBe(true);
    expect(result.issues.some((i) => i.fieldKey === 'visit.end_time')).toBe(true);
  });

  it('validiert Dokumentation ohne Text nicht', () => {
    const context = createEmptyDocumentContext({
      tenantId: TENANT,
      entityType: 'care_documentation',
      entityId: 'doc-1',
    });
    const result = validateDocumentByType('care_documentation', context);
    expect(result.status).toBe('error');
    expect(result.issues.some((i) => i.fieldKey === 'document.content')).toBe(true);
  });

  it('Production Mode nutzt keinen Demo-Fallback für Document Context', async () => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'false');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');

    expect(getServiceMode()).toBe('supabase');

    const result = await buildDocumentContext('invoice', 'inv-live-1', TENANT);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('kein Demo-Fallback');
    }
  });
});
