import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { InvoicePdfData } from '@/lib/office/invoicePdfService.web';
import type { InvoiceOfficeDraft } from '@/lib/office/invoiceWorkspaceTypes.web';

const f = vi.hoisted(() => ({ query: vi.fn(), download: vi.fn(), renders: [] as Array<{ page: number; text: string; y: number }>, pages: 1 }));
vi.mock('@/lib/permissions', () => ({ enforcePermission: (role: string) => role === 'denied' ? { ok: false, error: 'Kein Zugriff.' } : null }));
vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => 'supabase' }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({ storage: { from: () => ({ download: f.download }) } }) }));
vi.mock('@/lib/supabase/untypedTable', () => ({ fromUnknownTable: (_client: unknown, table: string) => {
  const chain: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'order', 'limit']) chain[method] = () => chain;
  chain.maybeSingle = () => f.query(table);
  chain.then = (resolve: (value: unknown) => void) => Promise.resolve(f.query(table)).then(resolve);
  return chain;
} }));
vi.mock('@/lib/documents/centuryGothicPdf', () => ({ CARESUITE_PDF_FONT: 'test', registerCareSuitePdfFont: () => {}, createCareSuitePdfText: (pdf: { text: (...args: unknown[]) => void }) => (...args: unknown[]) => pdf.text(...args) }));
vi.mock('jspdf/dist/jspdf.es.min.js', () => ({ jsPDF: class {
  page = 1; pages: Array<{ width: number; height: number }> = [{ width: 210, height: 297 }];
  internal = { pageSize: { getWidth: () => this.pages[this.page - 1].width, getHeight: () => this.pages[this.page - 1].height } };
  setFont() {} setFontSize() {} setTextColor() {} setFillColor() {} setDrawColor() {} rect() {} roundedRect() {} line() {} setProperties() {} addImage() {}
  splitTextToSize(value: string, width: number) { return value.split('\n').flatMap(row => row.match(new RegExp(`.{1,${Math.max(1, Math.floor(width / 1.5))}}`, 'g')) || ['']); }
  text(value: string | string[], _x: number, y: number) { f.renders.push({ page: this.page, text: Array.isArray(value) ? value.join('\n') : value, y }); }
  addPage(_format?: string, orientation?: string) { this.pages.push(orientation === 'landscape' ? { width: 297, height: 210 } : { width: 210, height: 297 }); this.page = this.pages.length; f.pages = this.pages.length; }
  setPage(page: number) { this.page = page; } getNumberOfPages() { return this.pages.length; }
  output() { return new TextEncoder().encode('%PDF-1.7\n').buffer; }
} }));

import { draftToPdfInvoice, fetchInvoicePdfData, prepareOfficeInvoicePdf, renderInvoicePdfDocument, validateInvoicePdf } from '@/lib/office/invoicePdfService.web';

const tenant = '11111111-1111-4111-8111-111111111111';
const draft = (): InvoiceOfficeDraft => ({ requestId: '22222222-2222-4222-8222-222222222222', clientId: '33333333-3333-4333-8333-333333333333', invoiceNumber: '',
  invoiceDate: '2026-10-18', dueDate: '2026-10-31', servicePeriodStart: '2026-10-01', servicePeriodEnd: '2026-10-31',
  recipient: { name: 'Erika Muster', street: 'Beispielweg', houseNumber: '5', postalCode: '44623', city: 'Herne', country: 'Deutschland', email: '' },
  recipientType: 'client', billingParty: 'self_payer', notes: '', footerText: 'Steuerhinweis aus der Rechnung', includeProofs: false,
  lines: [{ description: 'Alltagsbegleitung', quantity: 4, unit: 'hour', unitPriceCents: 3275, taxRatePercent: 0, productKey: 'assist' }] });
const data = (): InvoicePdfData => ({ invoice: draftToPdfInvoice(tenant, draft()), company: { legalName: 'Testgesellschaft GmbH', street: 'Teststraße', houseNumber: '1', postalCode: '44623', city: 'Herne', country: 'Deutschland',
  phone: '', email: '', website: '', taxNumber: '123/456/789', vatId: '', registerCourt: '', registerNumber: '', ikNumber: '', representativeName: '',
  bankName: 'Testbank', iban: 'DE89370400440532013000', bic: '', logoUrl: '', footerText: '' } });

beforeEach(() => { vi.clearAllMocks(); f.renders.length = 0; f.pages = 1; });
describe('Web invoice PDF truth and pagination', () => {
  it('previews an unsaved draft without ID or invoice number and without allocating either', async () => {
    const payload = data();
    expect(validateInvoicePdf(payload).errors).toEqual([]);
    const rendered = await renderInvoicePdfDocument(payload);
    expect(rendered.fileName).toMatch(/^Entwurf_/);
    expect(f.renders.some(row => row.text.includes('ENTWURF'))).toBe(true);
    expect(f.query).not.toHaveBeenCalled();
    expect(payload.invoice.invoiceNumber).toBe('');
  });
  it('requires issued identity, exact cents and mathematically correct tax', () => {
    const payload = data(); payload.invoice.status = 'ready';
    payload.invoice.amountCents += 1; payload.invoice.lineItems[0].taxRatePercent = 19;
    const errors = validateInvoicePdf(payload).errors;
    expect(errors).toContain('Eindeutige Rechnungs-ID fehlt.');
    expect(errors).toContain('Eindeutige Rechnungsnummer fehlt.');
    expect(errors).toContain('Positionssumme und Rechnungsbetrag stimmen nicht überein.');
    expect(errors.some(error => error.startsWith('Position 1:'))).toBe(true);
  });
  it('does not invent tax exemption claims for a zero percent rate', async () => {
    const payload = data(); payload.invoice.taxNotice = '';
    const result = await renderInvoicePdfDocument(payload);
    expect(result.validation.warnings.some(value => value.includes('Begründung'))).toBe(true);
    expect(f.renders.some(row => row.text.includes('Umsatzsteuerfreie Leistung'))).toBe(false);
  });
  it('paginates long positions and notes and marks every annex and invoice page as a draft', async () => {
    const payload = data(); payload.invoice.lineItems[0].description = 'Lange Leistungsbeschreibung '.repeat(90); payload.invoice.notes = 'Vereinbarte Einzelheiten '.repeat(110);
    payload.annexPages = [{ title: 'LN-1', sourcePage: 1, sourcePages: 1, dataUrl: 'data:image/png;base64,AA==', width: 1500, height: 1000 }];
    await renderInvoicePdfDocument(payload);
    expect(f.pages).toBeGreaterThan(3);
    for (let page = 1; page <= f.pages; page++) expect(f.renders.some(row => row.page === page && row.text === 'ENTWURF · NICHT VERSENDET')).toBe(true);
    expect(f.renders.some(row => row.text.includes('Anlage · PDF-Kopie'))).toBe(true);
    expect(f.renders.filter(row => row.text.includes('Lange Leistungsbeschreibung')).every(row => row.y <= 253)).toBe(true);
  });
  it('uses frozen company data without loading current company information', async () => {
    const payload = data(); payload.invoice.companySnapshot = payload.company;
    const result = await fetchInvoicePdfData(tenant, payload.invoice, 'business_admin');
    expect(result.ok && result.data.company).toEqual(payload.company);
    expect(f.query).not.toHaveBeenCalled();
  });
  it('fails if supplementary company data cannot be read', async () => {
    f.query.mockImplementation((table: string) => table === 'tenants' ? { data: { name: 'Testgesellschaft' }, error: null } : { data: null, error: { message: 'denied' } });
    const result = await fetchInvoicePdfData(tenant, data().invoice, 'business_admin');
    expect(result.ok).toBe(false);
  });
  it('does not reconstruct a missing issued archive from current company data', async () => {
    const invoice = { ...data().invoice, id: 'invoice-1', status: 'sent' as const };
    const result = await prepareOfficeInvoicePdf(tenant, invoice, 'business_admin');
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toContain('keine archivierte PDF');
    expect(f.query).not.toHaveBeenCalled();
  });
  it('rejects a swapped archive path before downloading bytes', async () => {
    f.query.mockResolvedValue({ data: { id: 'invoice-1', tenant_id: tenant, pdf_file_path: `tenant/${tenant}/different.pdf` }, error: null });
    const result = await prepareOfficeInvoicePdf(tenant, { ...data().invoice, id: 'invoice-1', status: 'sent', pdfStoragePath: `tenant/${tenant}/invoices/one.pdf` }, 'business_admin');
    expect(result.ok).toBe(false); expect(f.download).not.toHaveBeenCalled();
  });
});
