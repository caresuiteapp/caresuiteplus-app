import { describe, expect, it } from 'vitest';
import { assessOfficeEInvoiceRequirement, calculateOfficeEInvoiceTaxGroups, createEmptyOfficeEInvoiceLineTax, createEmptyOfficeEInvoiceMetadata, normalizeOfficeEInvoiceMetadata, validateOfficeEInvoiceMetadata } from '@/lib/office/eInvoiceModel.web';
import { escapeOfficeInvoiceXml, prepareOfficeInvoiceUbl, type OfficeEInvoiceUblSource } from '@/lib/office/eInvoiceUbl.web';
import type { OfficeEInvoiceDraftLine, OfficeEInvoiceMetadata } from '@/lib/office/eInvoiceTypes.web';

const line = (patch: Partial<OfficeEInvoiceDraftLine> = {}): OfficeEInvoiceDraftLine => ({ id: 'line-1', description: 'Haushaltsdienst', quantity: 2, unit: 'Stunde', unitPriceCents: 10000, taxRatePercent: 19, productKey: 'assist',
  eInvoiceTax: { category: 'S', unitCode: 'HUR', exemptionReason: '', exemptionReasonCode: '', legalBasis: 'none' }, ...patch });
function metadata(): OfficeEInvoiceMetadata {
  return { ...createEmptyOfficeEInvoiceMetadata(), format: 'xrechnung', buyer: { name: 'Beispiel Einkauf GmbH', street: 'Teststraße', houseNumber: '2', postalCode: '10115', city: 'Berlin', country: 'Deutschland', email: 'rechnung@example.org' }, buyerConfirmed: true,
    buyerCountryCode: 'DE', buyerReference: 'EINKAUF-2026', buyerEndpoint: { schemeId: 'EM', value: 'rechnung@example.org' }, sellerIdentifier: 'LIEFERANT-TEST', sellerCountryCode: 'DE', sellerEndpoint: { schemeId: 'EM', value: 'verkauf@example.org' },
    sellerContact: { name: 'Testkontakt', phone: '+49 30 123456', email: 'verkauf@example.org' }, legal: { recipientKind: 'b2b', buyerBusinessUse: 'yes', sellerDomestic: 'yes', buyerDomestic: 'yes', sellerSmallBusiness: 'no',
      smallAmountRuleEligible: 'no', passengerTicket: 'no', transmissionDate: '2026-10-18', priorYearRevenueCents: null, priorYearRevenueYear: null, pdfConsent: 'yes' } };
}
const invoice = (patch: Partial<OfficeEInvoiceUblSource> = {}): OfficeEInvoiceUblSource => ({ id: 'invoice-test', status: 'draft', invoiceDate: '2026-10-18', dueDate: '2026-11-01', servicePeriodStart: '2026-10-01', servicePeriodEnd: '2026-10-15', amountCents: 23800, notes: '', footerText: '', includeProofs: false, selectedProofIds: [], lines: [line()], ...patch });
const preview = { invoiceNumber: 'RE-2026-0001', sourceRevision: 'frozen-test-snapshot', companySnapshot: { legalName: 'Beispiel Dienste GmbH', street: 'Testweg', houseNumber: '1', postalCode: '10115', city: 'Berlin', country: 'Deutschland', taxNumber: '27/123/45678', vatId: '', iban: 'DE89370400440532013000', bic: 'COBADEFFXXX' } };
const assessment = (data = metadata(), patch: Record<string, unknown> = {}) => assessOfficeEInvoiceRequirement(data, { ...invoice(), totalCents: 23800, ...patch });

describe('Office e-invoice explicit facts and safe UBL output', () => {
  it('does not infer domestic residence, tax exemption or buyer from a payer', () => {
    const empty = createEmptyOfficeEInvoiceMetadata();
    expect(empty.buyerCountryCode).toBe(''); expect(empty.sellerCountryCode).toBe(''); expect(empty.legal.recipientKind).toBe('unknown');
    expect(assessment(empty).status).toBe('review'); expect(createEmptyOfficeEInvoiceLineTax().category).toBe('');
    expect(normalizeOfficeEInvoiceMetadata(null)).toEqual(empty);
    expect(() => normalizeOfficeEInvoiceMetadata({ format: 'unsupported' })).toThrow();
    expect(() => normalizeOfficeEInvoiceMetadata({ version: 2 })).toThrow();
  });
  it('uses service and transmission periods, never invoice date alone', () => {
    expect(assessment().status).toBe('transition');
    const data = metadata(); data.legal.transmissionDate = '2028-01-02';
    expect(assessment(data).status).toBe('required');
    data.legal.transmissionDate = '2027-10-18'; data.legal.priorYearRevenueYear = 2026; data.legal.priorYearRevenueCents = 80000000;
    const period = { invoiceDate: '2027-10-18', servicePeriodStart: '2027-10-01', servicePeriodEnd: '2027-10-15' };
    expect(assessment(data, period).status).toBe('transition');
    data.legal.priorYearRevenueCents = 80000001; expect(assessment(data, period).status).toBe('required');
    data.legal.priorYearRevenueYear = 2025; expect(assessment(data, period).status).toBe('review');
    expect(assessment(metadata(), { servicePeriodStart: '2024-12-01', servicePeriodEnd: '2025-01-15' }).status).toBe('review');
  });
  it('keeps exceptions after 2028 and separates PDF consent', () => {
    const data = metadata(); data.legal.transmissionDate = '2028-10-18'; data.legal.recipientKind = 'b2c'; data.legal.buyerBusinessUse = 'no'; data.legal.pdfConsent = 'unknown';
    const result = assessment(data, { invoiceDate: '2028-10-18', servicePeriodStart: '2028-10-01', servicePeriodEnd: '2028-10-15' });
    expect(result.status).toBe('not_required'); expect(result.pdfPermitted).toBe(false); expect(result.consentMissing).toBe(true);
    data.legal.recipientKind = 'b2g'; expect(assessment(data).status).toBe('review');
  });
  it('does not grant an entire mixed invoice the healthcare exemption', () => {
    const taxFree = line({ taxRatePercent: 0, eInvoiceTax: { category: 'E', unitCode: 'HUR', exemptionReason: 'Steuerfrei nach § 4 Nr. 16 UStG', exemptionReasonCode: '', legalBasis: 'ustg_4_8_29' } });
    expect(assessment(metadata(), { lines: [taxFree] }).status).toBe('not_required');
    expect(assessment(metadata(), { lines: [taxFree, line()] }).status).toBe('transition');
    const unknown = line({ taxRatePercent: 0, eInvoiceTax: undefined });
    expect(assessment(metadata(), { lines: [unknown] }).status).toBe('review');
  });
  it('requires explicit small-amount eligibility and refuses reverse-charge shortcut', () => {
    const data = metadata(); data.legal.smallAmountRuleEligible = 'unknown'; expect(assessment(data).status).toBe('review');
    data.legal.smallAmountRuleEligible = 'yes'; expect(assessment(data).status).toBe('not_required');
    expect(assessment(data, { lines: [line({ taxRatePercent: 0, eInvoiceTax: { category: 'AE', unitCode: 'HUR', exemptionReason: 'Steuerschuldnerschaft des Leistungsempfängers', exemptionReasonCode: '', legalBasis: 'other' } })] }).status).toBe('review');
  });
  it('preserves existing cents and rejects a real line/group VAT rounding mismatch', () => {
    const tiny = line({ quantity: 1, unitPriceCents: 3, taxRatePercent: 19 });
    expect(() => calculateOfficeEInvoiceTaxGroups([tiny, tiny])).toThrow(/Rundung/);
    expect(calculateOfficeEInvoiceTaxGroups([line()])).toMatchObject({ netCents: 20000, taxCents: 3800, totalCents: 23800 });
  });
  it('generates deterministic escaped UBL from the confirmed actual buyer and frozen company', () => {
    const data = metadata(); data.buyer.name = 'Einkauf & Co. <Test>'; const original = invoice({ notes: 'SECRET_INTERNAL_NOTE' });
    const output = prepareOfficeInvoiceUbl(original, preview, data);
    expect(output.xml).toBe(prepareOfficeInvoiceUbl(original, preview, data).xml);
    expect(output.xml).toContain('Einkauf &amp; Co. &lt;Test&gt;'); expect(output.xml).toContain('<cbc:TaxAmount currencyID="EUR">38.00</cbc:TaxAmount>');
    expect(output.xml).toContain('urn:fdc:peppol.eu:2017:poacc:billing:01:1.0'); expect(output.xml).toContain('ENTWURF'); expect(output.xml).not.toContain('SECRET_INTERNAL_NOTE');
    expect(output.validation.status).toBe('not_validated'); expect(output.fileName).toContain('_ENTWURF.xml');
    expect(new TextDecoder().decode(output.bytes)).toBe(output.xml); expect(original.amountCents).toBe(23800);
    const release = prepareOfficeInvoiceUbl(original, preview, data, [], 'issue');
    expect(release.xml).not.toContain('ENTWURF'); expect(release.validation.status).toBe('not_validated'); expect(release.fileName).toBe('RE-2026-0001.xml');
  });
  it('rejects malformed XML characters and does not recreate issued invoices', () => {
    for (const value of ['nul\u0000', 'control\u000b', 'surrogate\ud800', '\uffff']) expect(() => escapeOfficeInvoiceXml(value)).toThrow();
    expect(escapeOfficeInvoiceXml('ä 😀\n')).toBe('ä 😀\n');
    expect(() => prepareOfficeInvoiceUbl(invoice({ status: 'sent' }), preview, metadata())).toThrow(/archivierte Original/);
    expect(() => prepareOfficeInvoiceUbl(invoice(), preview, { ...metadata(), sellerCountryCode: 'AT' })).toThrow(/Unternehmensanschrift/);
    expect(() => prepareOfficeInvoiceUbl(invoice(), preview, { ...metadata(), buyerCountryCode: 'FR' })).toThrow(/Ländername/);
    expect(() => prepareOfficeInvoiceUbl(invoice({ amountCents: 23801 }), preview, metadata())).toThrow(/Summe/);
  });
  it('does not substitute missing annexes or accept an unrelated selected proof', () => {
    const draft = invoice({ includeProofs: true, selectedProofIds: ['record:one'] });
    expect(() => prepareOfficeInvoiceUbl(draft, preview, metadata())).toThrow(/Anlagen/);
    const annex = { id: 'record:one', fileName: 'original.pdf', mimeType: 'application/pdf' as const, description: 'Signierter Originalnachweis', base64: 'JVBERi0xLjcKJSVFT0YK' };
    const output = prepareOfficeInvoiceUbl(draft, preview, metadata(), [annex]);
    expect(output.xml).toContain(annex.base64); expect(output.xml).toContain('Signierter Originalnachweis');
    expect(() => prepareOfficeInvoiceUbl(draft, preview, metadata(), [{ ...annex, id: 'record:two' }])).toThrow();
  });
  it('requires tax categories and appropriate identifiers; outside-scope omits VAT IDs and rate', () => {
    const data = metadata(); data.buyerVatId = 'DE123456789';
    const outside = line({ taxRatePercent: 0, eInvoiceTax: { category: 'O', unitCode: 'HUR', exemptionReason: 'Nicht im Inland steuerbar', exemptionReasonCode: '', legalBasis: 'other' } });
    const output = prepareOfficeInvoiceUbl(invoice({ lines: [outside], amountCents: 20000 }), { ...preview, companySnapshot: { ...preview.companySnapshot, vatId: 'DE987654321' } }, data);
    expect(output.xml).not.toContain('DE123456789'); expect(output.xml).not.toContain('DE987654321'); expect(output.xml).toContain('<cbc:Percent>0</cbc:Percent>'); expect(output.xml.split('<cac:InvoiceLine>')[1]).not.toContain('cbc:Percent');
    expect(validateOfficeEInvoiceMetadata(data, [line({ unit: 'day' })]).some(item => item.code === 'UNIT_MISMATCH')).toBe(true);
    expect(validateOfficeEInvoiceMetadata(data, [outside, line()]).some(item => item.code === 'OUTSIDE_SCOPE_MIX')).toBe(true);
    const reverse = line({ taxRatePercent: 0, eInvoiceTax: { ...outside.eInvoiceTax!, category: 'AE' } });
    expect(validateOfficeEInvoiceMetadata(metadata(), [reverse]).some(item => item.code === 'REVERSE_CHARGE_BUYER_ID')).toBe(true);
  });
});
