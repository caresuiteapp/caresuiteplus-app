import { describe, expect, it } from 'vitest';
import { calculateOfficeInvoiceLines, isOfficeInvoiceDate, validateOfficeInvoiceDraft } from '@/lib/office/invoiceWorkspaceTypes.web';
import type { InvoiceOfficeDraft, OfficeInvoiceDraftLine } from '@/lib/office/invoiceWorkspaceTypes.web';

const clientId = '11111111-1111-4111-8111-111111111111';
function line(extra: Partial<OfficeInvoiceDraftLine> = {}): OfficeInvoiceDraftLine {
  return { description: 'Alltagsbegleitung', quantity: 1, unit: 'Stunde', unitPriceCents: 3275, taxRatePercent: 0, productKey: 'assist', ...extra };
}
function draft(extra: Partial<InvoiceOfficeDraft> = {}): InvoiceOfficeDraft {
  return { requestId: '22222222-2222-4222-8222-222222222222', clientId, invoiceNumber: '', invoiceDate: '2026-10-18', dueDate: '2026-11-01',
    servicePeriodStart: '2026-10-01', servicePeriodEnd: '2026-10-31', recipient: { name: 'Ada Beispiel', street: 'Musterweg', houseNumber: '4', postalCode: '44623', city: 'Herne', country: 'Deutschland', email: '' },
    recipientType: 'client', billingParty: 'self_payer', notes: '', footerText: '', includeProofs: false, lines: [line()], ...extra };
}
describe('Office invoice drafts use complete explicit input', () => {
  it('accepts a new manual draft without consuming a final number or requiring proofs', () => {
    expect(validateOfficeInvoiceDraft(draft())).toEqual([]);
  });
  it('rejects impossible dates and reversed period/due dates', () => {
    expect(isOfficeInvoiceDate('2026-02-29')).toBe(false); expect(isOfficeInvoiceDate('2028-02-29')).toBe(true);
    expect(validateOfficeInvoiceDraft(draft({ invoiceDate: '2026-02-29', dueDate: '2026-02-01', servicePeriodEnd: '2026-09-30' })).join(' ')).toMatch(/Rechnungsdatum.*Fälligkeitsdatum.*Leistungszeitraums/);
  });
  it('requires optimistic revision when updating an existing draft', () => {
    expect(validateOfficeInvoiceDraft(draft({ id: clientId })).join(' ')).toContain('Bearbeitungsstand');
    expect(validateOfficeInvoiceDraft(draft({ id: clientId, expectedUpdatedAt: '2026-10-18T08:00:00Z' }))).toEqual([]);
  });
  it('does not allow unidentified clients or request identifiers', () => {
    expect(validateOfficeInvoiceDraft(draft({ clientId: 'unknown', requestId: '' })).join(' ')).toMatch(/Speicherkennung.*Klienten/);
  });
  it('requires a recipient address even when no proofs are attached', () => {
    const value = draft(); value.recipient.street = '';
    expect(validateOfficeInvoiceDraft(value).join(' ')).toContain('Anschrift');
  });
  it('requires an explicit billing party and recipient type', () => {
    expect(validateOfficeInvoiceDraft(draft({ recipientType: undefined, billingParty: undefined } as unknown as Partial<InvoiceOfficeDraft>)).join(' ')).toMatch(/Empfängerart.*Kostenträger/);
  });
  it('rejects invalid email without requiring an email for postal invoices', () => {
    const value = draft(); value.recipient.email = 'not-an-email';
    expect(validateOfficeInvoiceDraft(value).join(' ')).toContain('E-Mail-Adresse');
  });
  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, 1.001])('rejects an unsupported line quantity %s', quantity => {
    expect(validateOfficeInvoiceDraft(draft({ lines: [line({ quantity })] })).join(' ')).toContain('Menge');
  });
  it.each([-1, 1.1, Number.NaN])('rejects an invalid cent price %s', unitPriceCents => {
    expect(validateOfficeInvoiceDraft(draft({ lines: [line({ unitPriceCents })] })).join(' ')).toContain('Einzelpreis');
  });
  it('rejects missing lines and zero invoice value but permits a free supplementary line', () => {
    expect(validateOfficeInvoiceDraft(draft({ lines: [] })).join(' ')).toContain('Mindestens');
    expect(validateOfficeInvoiceDraft(draft({ lines: [line({ unitPriceCents: 0 })] })).join(' ')).toContain('größer als null');
    expect(validateOfficeInvoiceDraft(draft({ lines: [line(), line({ unitPriceCents: 0 })] }))).toEqual([]);
  });
  it('requires a current source revision and rejects double billing inside one invoice', () => {
    expect(validateOfficeInvoiceDraft(draft({ lines: [line({ serviceRecordId: clientId })] })).join(' ')).toContain('neu geladen');
    const source = line({ serviceRecordId: clientId, sourceUpdatedAt: '2026-10-18T08:00:00Z' });
    expect(validateOfficeInvoiceDraft(draft({ lines: [source, source] })).join(' ')).toContain('bereits enthalten');
  });
  it('rejects proofs selected while attachments are off and duplicate proof IDs', () => {
    const selectedProofIds = [`record:${clientId}`];
    expect(validateOfficeInvoiceDraft(draft({ selectedProofIds })).join(' ')).toContain('ausgeschaltet');
    expect(validateOfficeInvoiceDraft(draft({ includeProofs: true, selectedProofIds: [...selectedProofIds, ...selectedProofIds] })).join(' ')).toContain('Auswahl');
  });
  it('checks the service date is inside the selected period', () => {
    expect(validateOfficeInvoiceDraft(draft({ lines: [line({ serviceDate: '2026-11-01' })] })).join(' ')).toContain('außerhalb');
  });
});
describe('Office invoice cent arithmetic', () => {
  it('rounds half cents in decimal arithmetic instead of floating-point under-rounding', () => {
    const result = calculateOfficeInvoiceLines([line({ quantity: 0.29, unitPriceCents: 50, taxRatePercent: 0 })]);
    expect(result.netCents).toBe(15);
  });
  it('rounds tax per line and then sums the persisted line amounts', () => {
    const result = calculateOfficeInvoiceLines([line({ unitPriceCents: 10, taxRatePercent: 19 }), line({ unitPriceCents: 10, taxRatePercent: 19 })]);
    expect(result.netCents).toBe(20); expect(result.taxCents).toBe(4); expect(result.totalCents).toBe(24);
  });
  it('keeps a mixed taxable/untaxed invoice exact', () => {
    const result = calculateOfficeInvoiceLines([line({ quantity: 2.5 }), line({ unitPriceCents: 1000, taxRatePercent: 19 })]);
    expect(result.netCents).toBe(9188); expect(result.taxCents).toBe(190); expect(result.totalCents).toBe(9378);
  });
  it('rejects amounts outside the persisted numeric column range', () => {
    expect(() => calculateOfficeInvoiceLines([line({ quantity: 1000000, unitPriceCents: 100000000 })])).toThrow('zu groß');
  });
  it('does not coerce nonfinite or negative values into valid totals', () => {
    expect(() => calculateOfficeInvoiceLines([line({ unitPriceCents: Number.NaN })])).toThrow();
    expect(() => calculateOfficeInvoiceLines([line({ quantity: -1 })])).toThrow();
  });
});
