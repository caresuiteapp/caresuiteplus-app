import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import {
  assertCanFinalizeDocument,
  buildDocumentCiCss,
  buildDocumentFooterHtml,
  buildMandatoryDisclosureLines,
  calculateLogoDimensions,
  createEmptyDocumentContext,
  renderTemplate,
} from '@/features/documents/templateEngine';
import {
  resetTenantDocumentSettingsStore,
  resolveInvoiceRecipient,
  seedTenantDocumentSettingsForTest,
} from '@/lib/documents';

const TENANT_A = DEMO_TENANT_ID;
const TENANT_B = '00000000-0000-4000-8000-000000000099';

describe('document CI & layout', () => {
  beforeEach(() => {
    resetTenantDocumentSettingsStore();
    seedTenantDocumentSettingsForTest(TENANT_A);
    seedTenantDocumentSettingsForTest(TENANT_B, {
      primaryColor: '#047857',
      accentColor: '#10B981',
      logoUrl: 'https://example.com/tenant-b.png',
    });
  });

  afterEach(() => {
    resetTenantDocumentSettingsStore();
  });

  it('Logo wird nicht verzerrt', () => {
    const dims = calculateLogoDimensions({
      widthMm: 45,
      naturalWidthPx: 300,
      naturalHeightPx: 100,
    });
    expect(dims.widthMm).toBe(45);
    expect(dims.heightMm).toBe(15);
    const aspectOriginal = 100 / 300;
    const aspectRendered = dims.heightMm / dims.widthMm;
    expect(aspectRendered).toBeCloseTo(aspectOriginal, 5);
  });

  it('Footer enthält Pflichtangaben bei Geschäftsbriefen', () => {
    const context = createEmptyDocumentContext({
      tenantId: TENANT_A,
      entityType: 'invoice',
      entityId: 'bl-1',
    });
    context.company.legal_name = 'CareSuite Demo GmbH';
    context.company.street = 'Musterstraße 1';
    context.company.zip = '10115';
    context.company.city = 'Berlin';
    context.company.register_court = 'Amtsgericht Berlin';
    context.company.register_number = 'HRB 123456';
    context.company.managing_director = 'Max Mustermann';
    context.company.phone = '+49 30 123456';

    const lines = buildMandatoryDisclosureLines(context);
    expect(lines.some((l) => l.includes('CareSuite Demo GmbH'))).toBe(true);
    expect(lines.some((l) => l.includes('Registergericht'))).toBe(true);

    const settings = seedTenantDocumentSettingsForTest(TENANT_A);
    const footer = buildDocumentFooterHtml({
      settings,
      context,
      documentType: 'business_letter',
    });
    expect(footer).toContain('cs-footer-disclosures');
    expect(footer).toContain('CareSuite Demo GmbH');
  });

  it('Rechnung blockiert ohne Bankverbindung, wenn erforderlich', () => {
    const settings = seedTenantDocumentSettingsForTest(TENANT_A, {
      bankName: '',
      iban: '',
      ciEnforcementEnabled: true,
    });
    const context = createEmptyDocumentContext({
      tenantId: TENANT_A,
      entityType: 'invoice',
      entityId: 'inv-1',
    });
    context.invoice.number = 'RE-1';
    context.invoice.date = '2026-06-15';
    context.invoice.service_period = '06/2026';
    context.invoice.net_total = '100';
    context.invoice.gross_total = '119';
    context.invoice.tax_total = '19';
    context.invoice.due_date = '2026-06-29';
    context.recipient.full_name = 'Test';
    context.recipient.address = 'Str. 1, 10115 Berlin';
    context.company.legal_name = 'Firma GmbH';
    context.company.tax_id = '123';

    const check = assertCanFinalizeDocument({
      documentType: 'invoice',
      context,
      templateVersion: { htmlTemplate: '<p>Rechnung</p>' },
      tenantDocumentSettings: settings,
    });
    expect(check.allowed).toBe(false);
    expect(check.validation.issues.some((i) => i.code === 'invoice_bank_missing' || i.code === 'ci_bank_missing')).toBe(true);
  });

  it('Betreueradresse wird bevorzugt, wenn als Rechnungsempfänger markiert', () => {
    const resolved = resolveInvoiceRecipient({
      kind: 'self_payer',
      client: {
        full_name: 'Helga Schneider',
        street: 'Klientenweg 1',
        zip: '10115',
        city: 'Berlin',
      },
      representative: {
        full_name: 'Maria Schneider',
        street: 'Betreuerstraße 9',
        zip: '10117',
        city: 'Berlin',
        is_invoice_recipient: true,
      },
    });
    expect(resolved.kind).toBe('guardian');
    expect(resolved.fullName).toBe('Maria Schneider');
    expect(resolved.address).toContain('Betreuerstraße 9');
  });

  it('Kostenträgeradresse wird verwendet, wenn Kostenträger Rechnungsempfänger ist', () => {
    const resolved = resolveInvoiceRecipient({
      kind: 'cost_carrier',
      client: { full_name: 'Helga Schneider', street: 'Klientenweg 1', zip: '10115', city: 'Berlin' },
      cost_carrier: {
        name: 'AOK Nordost',
        street: 'Kassenstraße 1',
        zip: '10557',
        city: 'Berlin',
      },
    });
    expect(resolved.kind).toBe('cost_carrier');
    expect(resolved.fullName).toBe('AOK Nordost');
    expect(resolved.address).toContain('Kassenstraße 1');
  });

  it('CI-Farben erscheinen in Preview', async () => {
    const settings = seedTenantDocumentSettingsForTest(TENANT_A, {
      primaryColor: '#FF0000',
      accentColor: '#00FF00',
    });
    const context = createEmptyDocumentContext({
      tenantId: TENANT_A,
      entityType: 'invoice',
      entityId: 'inv-prev',
    });
    context.company.name = 'Preview GmbH';

    const result = renderTemplate(
      { htmlTemplate: '<p>Inhalt</p>' },
      { context, documentType: 'invoice', tenantDocumentSettings: settings },
    );
    expect(result.html).toContain('#FF0000');
    expect(result.html).toContain('#00FF00');
    expect(result.html).toContain('cs-page-header');
  });

  it('Mandant A sieht nicht CI von Mandant B', () => {
    const settingsA = seedTenantDocumentSettingsForTest(TENANT_A);
    const settingsB = seedTenantDocumentSettingsForTest(TENANT_B, {
      primaryColor: '#047857',
      accentColor: '#10B981',
      logoUrl: 'https://example.com/tenant-b.png',
    });

    expect(settingsA.primaryColor).toBe('#1E40AF');
    expect(settingsB.primaryColor).toBe('#047857');
    expect(settingsA.logoUrl).not.toBe(settingsB.logoUrl);

    const cssA = buildDocumentCiCss(settingsA);
    const cssB = buildDocumentCiCss(settingsB);
    expect(cssA).toContain('#1E40AF');
    expect(cssB).toContain('#047857');
    expect(cssA).not.toContain('#047857');
  });
});
