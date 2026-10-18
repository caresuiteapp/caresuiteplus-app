// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash, webcrypto } from 'node:crypto';
import { inspectOfficeEInvoiceImport, OFFICE_EINVOICE_IMPORT_LIMITS, parseOfficeEInvoiceXml } from '@/lib/office/eInvoiceImport.web';

const encode = (text: string) => new TextEncoder().encode(text);
const profile = 'urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0';
const ubl = (prefix = 'x', credit = false) => `<?xml version="1.0" encoding="UTF-8"?>
<${prefix}:${credit ? 'CreditNote' : 'Invoice'} xmlns:${prefix}="urn:oasis:names:specification:ubl:schema:xsd:${credit ? 'CreditNote' : 'Invoice'}-2"
 xmlns:b="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" xmlns:a="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2">
 <b:CustomizationID>${profile}</b:CustomizationID><b:ProfileID>process</b:ProfileID><b:ID>RE-2026-17</b:ID>
 <b:IssueDate>2026-10-18</b:IssueDate><b:DocumentCurrencyCode>EUR</b:DocumentCurrencyCode>
 <a:AccountingSupplierParty><a:Party><a:PartyLegalEntity><b:RegistrationName>Firma &amp; Partner</b:RegistrationName></a:PartyLegalEntity>
 <a:PostalAddress><b:StreetName>Testweg 7</b:StreetName><b:CityName>Herne</b:CityName><b:PostalZone>44623</b:PostalZone><a:Country><b:IdentificationCode>DE</b:IdentificationCode></a:Country></a:PostalAddress>
 <a:PartyTaxScheme><b:CompanyID>DE123456789</b:CompanyID><a:TaxScheme><b:ID>VAT</b:ID></a:TaxScheme></a:PartyTaxScheme></a:Party></a:AccountingSupplierParty>
 <a:AccountingCustomerParty><a:Party><b:EndpointID schemeID="EM">rechnung@example.test</b:EndpointID><a:PartyName><b:Name>Empfänger</b:Name></a:PartyName></a:Party></a:AccountingCustomerParty>
 <a:TaxTotal><b:TaxAmount currencyID="EUR">19.00</b:TaxAmount></a:TaxTotal>
 <a:LegalMonetaryTotal><b:TaxExclusiveAmount>100.00</b:TaxExclusiveAmount><b:TaxInclusiveAmount>119.00</b:TaxInclusiveAmount><b:PayableAmount>119.00</b:PayableAmount></a:LegalMonetaryTotal>
 <a:${credit ? 'CreditNoteLine' : 'InvoiceLine'}><b:ID>1</b:ID><b:${credit ? 'CreditedQuantity' : 'InvoicedQuantity'} unitCode="HUR">2</b:${credit ? 'CreditedQuantity' : 'InvoicedQuantity'}><b:LineExtensionAmount>100.00</b:LineExtensionAmount>
 <a:Item><b:Name>&lt;script&gt;Kein HTML&lt;/script&gt;</b:Name><a:ClassifiedTaxCategory><b:ID>S</b:ID><b:Percent>19</b:Percent></a:ClassifiedTaxCategory></a:Item><a:Price><b:PriceAmount>50.00</b:PriceAmount></a:Price></a:${credit ? 'CreditNoteLine' : 'InvoiceLine'}>
</${prefix}:${credit ? 'CreditNote' : 'Invoice'}>`;

const cii = (guideline = 'urn:cen.eu:en16931:2017') => `<?xml version="1.0"?>
<z:CrossIndustryInvoice xmlns:z="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
 xmlns:r="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
 xmlns:u="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
 <z:ExchangedDocumentContext><r:GuidelineSpecifiedDocumentContextParameter><r:ID>${guideline}</r:ID></r:GuidelineSpecifiedDocumentContextParameter></z:ExchangedDocumentContext>
 <z:ExchangedDocument><r:ID>CII-42</r:ID><r:TypeCode>380</r:TypeCode><r:IssueDateTime><u:DateTimeString format="102">20261018</u:DateTimeString></r:IssueDateTime></z:ExchangedDocument>
 <z:SupplyChainTradeTransaction>
 <r:IncludedSupplyChainTradeLineItem><r:AssociatedDocumentLineDocument><r:LineID>1</r:LineID></r:AssociatedDocumentLineDocument><r:SpecifiedTradeProduct><r:Name>Leistung</r:Name></r:SpecifiedTradeProduct>
 <r:SpecifiedLineTradeAgreement><r:NetPriceProductTradePrice><r:ChargeAmount>100.00</r:ChargeAmount></r:NetPriceProductTradePrice></r:SpecifiedLineTradeAgreement>
 <r:SpecifiedLineTradeDelivery><r:BilledQuantity unitCode="C62">1</r:BilledQuantity></r:SpecifiedLineTradeDelivery>
 <r:SpecifiedLineTradeSettlement><r:ApplicableTradeTax><r:CategoryCode>S</r:CategoryCode><r:RateApplicablePercent>19</r:RateApplicablePercent></r:ApplicableTradeTax>
 <r:SpecifiedTradeSettlementLineMonetarySummation><r:LineTotalAmount>100.00</r:LineTotalAmount></r:SpecifiedTradeSettlementLineMonetarySummation></r:SpecifiedLineTradeSettlement></r:IncludedSupplyChainTradeLineItem>
 <r:ApplicableHeaderTradeAgreement><r:SellerTradeParty><r:Name>Verkäufer</r:Name><r:SpecifiedTaxRegistration><r:ID schemeID="VA">DE123456789</r:ID></r:SpecifiedTaxRegistration></r:SellerTradeParty><r:BuyerTradeParty><r:Name>Käufer</r:Name></r:BuyerTradeParty></r:ApplicableHeaderTradeAgreement>
 <r:ApplicableHeaderTradeSettlement><r:InvoiceCurrencyCode>EUR</r:InvoiceCurrencyCode><r:SpecifiedTradeSettlementHeaderMonetarySummation><r:TaxBasisTotalAmount>100.00</r:TaxBasisTotalAmount><r:TaxTotalAmount currencyID="EUR">19.00</r:TaxTotalAmount><r:GrandTotalAmount>119.00</r:GrandTotalAmount><r:DuePayableAmount>119.00</r:DuePayableAmount></r:SpecifiedTradeSettlementHeaderMonetarySummation></r:ApplicableHeaderTradeSettlement>
 </z:SupplyChainTradeTransaction></z:CrossIndustryInvoice>`;
const file = (name: string, bytes: Uint8Array) => ({ name, size: bytes.length, async arrayBuffer() { return new Uint8Array(bytes).buffer; } });

beforeEach(() => { vi.stubGlobal('crypto', webcrypto); });
afterEach(() => { delete window.CareSuiteInvoiceXmlV1; vi.unstubAllGlobals(); });

describe('structured invoice preview', () => {
  it('reads namespaces independently of prefixes and keeps XML text inert', () => {
    const result = parseOfficeEInvoiceXml(encode(ubl('arbitrary')));
    expect(result.syntax).toBe('ubl_invoice'); expect(result.profileId).toBe(profile);
    expect(result.seller).toMatchObject({ name: 'Firma & Partner', vatId: 'DE123456789', city: 'Herne' });
    expect(result.buyer).toMatchObject({ endpointId: 'rechnung@example.test', endpointScheme: 'EM' });
    expect(result.lines[0]).toMatchObject({ name: '<script>Kein HTML</script>', quantity: '2', unitCode: 'HUR', lineTotal: '100.00', taxRate: '19' });
    expect(result.totals).toEqual({ payable: '119.00', taxExclusive: '100.00', taxInclusive: '119.00', tax: '19.00' });
    expect(result.warnings.join(' ')).toContain('Normprüfung'); expect(result).not.toHaveProperty('validated');
  });
  it('recognises credit notes without silently reversing their amounts', () => {
    const result = parseOfficeEInvoiceXml(encode(ubl('credit', true)));
    expect(result.syntax).toBe('ubl_credit_note'); expect(result.lines[0].quantity).toBe('2'); expect(result.totals.payable).toBe('119.00');
  });
  it('accepts non-ASCII namespace prefixes and displays the explicit price base', () => {
    const xml = ubl('rechnungÄ').replace('<b:PriceAmount>50.00</b:PriceAmount>', '<b:PriceAmount>50.00</b:PriceAmount><b:BaseQuantity unitCode="HUR">100</b:BaseQuantity>');
    const result = parseOfficeEInvoiceXml(encode(xml)); expect(result.invoiceNumber).toBe('RE-2026-17');
    expect(result.lines[0]).toMatchObject({ priceBaseQuantity: '100', priceBaseUnitCode: 'HUR' });
  });
  it('reads CII parties, lines, date and totals through exact namespaces', () => {
    const result = parseOfficeEInvoiceXml(encode(cii()));
    expect(result).toMatchObject({ syntax: 'cii', invoiceNumber: 'CII-42', issueDate: '2026-10-18', currency: 'EUR' });
    expect(result.seller.vatId).toBe('DE123456789'); expect(result.lines[0].unitPrice).toBe('100.00');
  });
  it.each(['urn:factur-x.eu:1p0:minimum', 'urn:factur-x.eu:1p0:basicwl'])('flags excluded profile %s but preserves a readable preview', id => {
    const result = parseOfficeEInvoiceXml(encode(cii(id)));
    expect(result.profileSupport).toBe('excluded'); expect(result.warnings.join(' ')).toContain('keine vollständigen');
  });
  it('does not mistake a profile name containing xrechnung for a recognised identifier', () => {
    expect(parseOfficeEInvoiceXml(encode(ubl().replace(profile, 'https://untrusted.test/xrechnung_3.0'))).profileSupport).toBe('unknown');
  });
  it('does not use values smuggled through a different namespace', () => {
    const result = parseOfficeEInvoiceXml(encode(ubl().replace('<b:ID>RE-2026-17</b:ID>', '<b:ID xmlns:b="urn:attacker">FAKE</b:ID>')));
    expect(result.invoiceNumber).toBe(''); expect(result.warnings.join(' ')).toContain('fehlen');
  });
  it('rejects duplicated authoritative fields instead of choosing an invoice number', () => {
    expect(() => parseOfficeEInvoiceXml(encode(ubl().replace('<b:ID>RE-2026-17</b:ID>', '<b:ID>A</b:ID><b:ID>B</b:ID>')))).toThrow('mehrfach');
  });
  it('rejects arbitrary XML even when its filename or element name says invoice', () => {
    expect(() => parseOfficeEInvoiceXml(encode('<Invoice xmlns="urn:attacker"><ID>1</ID></Invoice>'))).toThrow('keine unterstützte');
  });
  it.each([
    '<!DOCTYPE Invoice SYSTEM "https://attacker.test/schema.dtd"><Invoice/>',
    '<!DOCTYPE Invoice [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><Invoice>&xxe;</Invoice>',
    '<!DOCTYPE Invoice [<!ENTITY a "spam"><!ENTITY b "&a;&a;">]><Invoice>&b;</Invoice>',
    '<?xml-stylesheet href="https://attacker.test/transform.xsl"?><Invoice/>',
    '<Invoice>&external;</Invoice>', '<Invoice><a></Invoice>', '<Invoice/><Invoice/>',
  ])('rejects unsafe or malformed XML before any external processing', xml => {
    expect(() => parseOfficeEInvoiceXml(encode(xml))).toThrow();
  });
  it('rejects XInclude rather than showing a document missing external content', () => {
    expect(() => parseOfficeEInvoiceXml(encode(ubl().replace('</x:Invoice>', '<xi:include xmlns:xi="http://www.w3.org/2001/XInclude" href="https://attacker.test"/></x:Invoice>')))).toThrow('Externe');
  });
  it('rejects deep, huge and excessively long data', () => {
    expect(() => parseOfficeEInvoiceXml(encode('<a>'.repeat(65) + '</a>'.repeat(65)))).toThrow('verschachtelte');
    expect(() => parseOfficeEInvoiceXml(new Uint8Array(OFFICE_EINVOICE_IMPORT_LIMITS.xmlBytes + 1))).toThrow('5 MB');
    expect(() => parseOfficeEInvoiceXml(encode(ubl().replace('RE-2026-17', 'X'.repeat(8193))))).toThrow('Textlänge');
  });
  it('rejects a mismatched or unsupported encoding instead of silently replacing characters', () => {
    expect(() => parseOfficeEInvoiceXml(encode(ubl().replace('UTF-8', 'ISO-8859-1')))).toThrow('Zeichenkodierung');
    expect(() => parseOfficeEInvoiceXml(Uint8Array.from([0xff, 0xfe, 1]))).toThrow('Zeichenkodierung');
  });
  it('reads UTF-16 originals without rewriting them', async () => {
    const text = ubl().replace('UTF-8', 'UTF-16'); const bytes = new Uint8Array(2 + text.length * 2); bytes.set([0xff, 0xfe]);
    const view = new DataView(bytes.buffer); for (let i = 0; i < text.length; i += 1) view.setUint16(2 + i * 2, text.charCodeAt(i), true);
    const result = await inspectOfficeEInvoiceImport(file('rechnung.xml', bytes));
    expect(result.preview.invoiceNumber).toBe('RE-2026-17'); expect(result.originalBytes).toEqual(bytes); expect(result.xmlBytes).toEqual(bytes);
  });
});

describe('exact original and embedded XML preservation', () => {
  const originalPdf = encode('%PDF-1.7\noriginal bytes retained\n%%EOF');
  it('hashes the exact input bytes, including comments and whitespace', async () => {
    const original = encode(ubl() + '\n<!-- original -->\n'); const result = await inspectOfficeEInvoiceImport(file('rechnung.xml', original));
    expect(result.originalBytes).toEqual(original); expect(result.xmlBytes).toEqual(original);
    expect(result.originalSha256).toBe(createHash('sha256').update(original).digest('hex')); expect(result.xmlSha256).toBe(result.originalSha256);
    expect(result.sourceKind).toBe('xml');
  });
  it('extracts one invoice attachment while keeping the original PDF independent of PDF.js buffer ownership', async () => {
    const embedded = encode(cii());
    window.CareSuiteInvoiceXmlV1 = { async extractAttachments(buffer) { buffer.fill(0); return [{ name: 'factur-x.xml', bytes: embedded }, { name: 'readme.txt', bytes: encode('Information') }]; } };
    const result = await inspectOfficeEInvoiceImport(file('rechnung.pdf', originalPdf));
    expect(result.originalBytes).toEqual(originalPdf); expect(result.xmlBytes).toEqual(embedded);
    expect(result.originalSha256).toBe(createHash('sha256').update(originalPdf).digest('hex'));
    expect(result.extractionProvenance).toMatchObject({ method: 'pdfjs_embedded_attachment', attachmentName: 'factur-x.xml', attachmentCount: 2, containerConformityChecked: false });
    expect(result.warnings.join(' ')).toContain('Signaturen');
  });
  it('rejects a regular PDF without claiming an e-invoice', async () => {
    window.CareSuiteInvoiceXmlV1 = { async extractAttachments() { return []; } };
    await expect(inspectOfficeEInvoiceImport(file('normal.pdf', originalPdf))).rejects.toThrow('gewöhnliche PDF');
  });
  it('rejects ambiguous multiple invoice attachments even if filenames suggest a preferred invoice', async () => {
    window.CareSuiteInvoiceXmlV1 = { async extractAttachments() { return [{ name: 'factur-x.xml', bytes: encode(cii()) }, { name: 'other.xml', bytes: encode(ubl()) }]; } };
    await expect(inspectOfficeEInvoiceImport(file('rechnung.pdf', originalPdf))).rejects.toThrow('mehrere Rechnungs-XML');
  });
  it('rejects a malformed second XML instead of silently selecting the first invoice', async () => {
    window.CareSuiteInvoiceXmlV1 = { async extractAttachments() { return [{ name: 'factur-x.xml', bytes: encode(cii()) }, { name: 'other.xml', bytes: encode('<!DOCTYPE dangerous><a/>') }]; } };
    await expect(inspectOfficeEInvoiceImport(file('rechnung.pdf', originalPdf))).rejects.toThrow('sicher gelesen');
  });
  it('rejects forged file sizes and oversized files before reading', async () => {
    await expect(inspectOfficeEInvoiceImport({ ...file('rechnung.xml', encode(ubl())), size: 1 })).rejects.toThrow('vollständig');
    const read = vi.fn(); await expect(inspectOfficeEInvoiceImport({ name: 'x.pdf', size: 10 * 1024 * 1024 + 1, arrayBuffer: read })).rejects.toThrow('10 MB'); expect(read).not.toHaveBeenCalled();
  });
});
