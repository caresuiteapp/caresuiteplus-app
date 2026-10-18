import { calculateOfficeInvoiceLines, isOfficeInvoiceDate, type OfficeInvoice, type OfficeInvoiceIssuePreview } from './invoiceWorkspaceTypes.web';
import { calculateOfficeEInvoiceTaxGroups, knownOfficeEInvoiceCountryCode, validateOfficeEInvoiceMetadata } from './eInvoiceModel.web';
import type { OfficeEInvoiceAttachment, OfficeEInvoiceDraftLine, OfficeEInvoiceFinding, OfficeEInvoiceMetadata, OfficeEInvoiceTaxGroup } from './eInvoiceTypes.web';

export const OFFICE_XRECHNUNG_CUSTOMIZATION = 'urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0';
export const OFFICE_XRECHNUNG_PROCESS = 'urn:fdc:peppol.eu:2017:poacc:billing:01:1.0';
export type OfficeEInvoiceUblSource = Pick<OfficeInvoice, 'id' | 'status' | 'invoiceDate' | 'dueDate' | 'servicePeriodStart' | 'servicePeriodEnd' | 'amountCents' | 'notes' | 'footerText' | 'includeProofs' | 'selectedProofIds'> & { lines: OfficeEInvoiceDraftLine[] };
export type PreparedOfficeInvoiceUbl = {
  xml: string; bytes: Uint8Array; fileName: string; format: 'xrechnung'; customizationId: string;
  validation: { status: 'not_validated'; message: string }; taxGroups: OfficeEInvoiceTaxGroup[];
  totals: { netCents: number; taxCents: number; totalCents: number };
};
const field = (company: Record<string, unknown>, name: string): string => typeof company[name] === 'string' ? company[name].trim() : '';
const cents = (value: number): string => { if (!Number.isSafeInteger(value)) throw new Error('Der Geldbetrag ist ungültig.'); return `${Math.floor(value / 100)}.${String(value % 100).padStart(2, '0')}`; };
const decimal = (value: number): string => value.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
/** XML 1.0 valid Unicode only; rejected input is never silently removed or repaired. */
export function escapeOfficeInvoiceXml(value: string): string {
  for (const character of value) {
    const code = character.codePointAt(0)!;
    if (!(code === 9 || code === 10 || code === 13 || (code >= 32 && code <= 0xd7ff) || (code >= 0xe000 && code <= 0xfffd) || (code >= 0x10000 && code <= 0x10ffff))) throw new Error('Ein Rechnungsfeld enthält ein für XML unzulässiges Zeichen.');
  }
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
const tag = (name: string, value: string): string => `<${name}>${escapeOfficeInvoiceXml(value)}</${name}>`;
const amount = (name: string, value: number): string => `<cbc:${name} currencyID="EUR">${cents(value)}</cbc:${name}>`;
const optionalTag = (name: string, value: string): string => value ? tag(name, value) : '';
function validIban(value: string): boolean {
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(value)) return false;
  const reordered = `${value.slice(4)}${value.slice(0, 4)}`.replace(/[A-Z]/g, letter => String(letter.charCodeAt(0) - 55));
  let remainder = 0;
  for (const digit of reordered) remainder = (remainder * 10 + Number(digit)) % 97;
  return remainder === 1;
}
export function inspectOfficeInvoiceUblSource(invoice: OfficeEInvoiceUblSource, preview: OfficeInvoiceIssuePreview, metadata: OfficeEInvoiceMetadata): OfficeEInvoiceFinding[] {
  const findings = validateOfficeEInvoiceMetadata(metadata, invoice.lines);
  const add = (condition: boolean, code: string, message: string) => { if (!condition) findings.push({ code, message }); };
  add(invoice.status === 'draft', 'DRAFT_ONLY', 'XML darf nur aus einem gespeicherten Entwurf vorbereitet werden. Für ausgestellte Rechnungen ist ausschließlich das archivierte Original zulässig.');
  add(metadata.format === 'xrechnung', 'FORMAT', 'Für diesen Entwurf wurde XRechnung noch nicht ausgewählt.');
  add(!!preview.invoiceNumber.trim() && preview.invoiceNumber.length <= 120, 'INVOICE_NUMBER', 'Die serverseitig vorgesehene Rechnungsnummer fehlt.');
  add(!!preview.sourceRevision.trim(), 'SOURCE_REVISION', 'Die bestätigte Datenfassung fehlt. Bitte die Vorschau neu laden.');
  for (const [value, label] of [[invoice.invoiceDate, 'Rechnungsdatum'], [invoice.dueDate, 'Fälligkeitsdatum'], [invoice.servicePeriodStart, 'Leistungsbeginn'], [invoice.servicePeriodEnd, 'Leistungsende']]) add(!!value && isOfficeInvoiceDate(value), 'DATE', `${label} fehlt oder ist ungültig.`);
  add(!!invoice.dueDate && invoice.dueDate >= invoice.invoiceDate, 'DUE_DATE', 'Die Fälligkeit liegt vor dem Rechnungsdatum.');
  add(!!invoice.servicePeriodStart && !!invoice.servicePeriodEnd && invoice.servicePeriodStart <= invoice.servicePeriodEnd, 'SERVICE_PERIOD', 'Der Leistungszeitraum ist widersprüchlich.');
  const company = preview.companySnapshot;
  for (const [name, label] of [['legalName', 'Firmenname'], ['street', 'Straße'], ['postalCode', 'Postleitzahl'], ['city', 'Ort']]) add(!!field(company, name), 'SELLER_ADDRESS', `Aussteller: ${label} fehlt in den bestätigten Unternehmensdaten.`);
  const sellerCountry = knownOfficeEInvoiceCountryCode(field(company, 'country'));
  if (sellerCountry) add(sellerCountry === metadata.sellerCountryCode, 'SELLER_COUNTRY_MISMATCH', 'Das Länderkürzel des Ausstellers widerspricht der bestätigten Unternehmensanschrift.');
  const outsideScope = invoice.lines.some(line => line.eInvoiceTax?.category === 'O');
  add(!!field(company, 'taxNumber') || (!outsideScope && !!field(company, 'vatId')), 'SELLER_TAX_ID', 'Die bestätigte Steuernummer beziehungsweise zulässige Umsatzsteuer-ID des Ausstellers fehlt.');
  add(!!metadata.sellerIdentifier.trim() || !!field(company, 'registerNumber') || (!outsideScope && !!field(company, 'vatId')), 'SELLER_IDENTIFIER', 'Die Lieferantenkennung, Handelsregisterkennung oder zulässige Umsatzsteuer-ID des Ausstellers fehlt. Eine Steuernummer allein ersetzt diese Kennung nicht.');
  add(validIban(field(company, 'iban').replace(/\s/g, '')), 'IBAN', 'Für die unterstützte Überweisung fehlt eine gültige IBAN in den bestätigten Unternehmensdaten.');
  if (invoice.lines.some(line => line.eInvoiceTax?.category === 'S' || line.eInvoiceTax?.category === 'Z' || line.eInvoiceTax?.category === 'AE')) add(!!field(company, 'vatId') || !!field(company, 'taxNumber'), 'TAX_IDENTIFIER', 'Die erforderliche steuerliche Kennung des Ausstellers fehlt.');
  for (const [index, line] of invoice.lines.entries()) {
    add(!!line.description.trim() && line.description.length <= 2000, 'LINE_DESCRIPTION', `Position ${index + 1}: Die Beschreibung fehlt oder ist zu lang.`);
    if (line.serviceDate) add(isOfficeInvoiceDate(line.serviceDate) && line.serviceDate >= (invoice.servicePeriodStart || '') && line.serviceDate <= (invoice.servicePeriodEnd || ''), 'LINE_SERVICE_DATE', `Position ${index + 1}: Das Leistungsdatum liegt außerhalb des Rechnungszeitraums.`);
  }
  try {
    const totals = calculateOfficeEInvoiceTaxGroups(invoice.lines);
    add(totals.totalCents > 0 && invoice.amountCents === totals.totalCents, 'TOTAL', 'Die XML-Summe stimmt nicht mit der gespeicherten Rechnung überein.');
  } catch (error) { findings.push({ code: 'AMOUNTS', message: error instanceof Error ? error.message : 'Die Beträge konnten nicht geprüft werden.' }); }
  return findings;
}
function address(name: string, street: string, house: string, postal: string, city: string, country: string): string {
  return `<cac:${name}>${tag('cbc:StreetName', [street, house].filter(Boolean).join(' '))}${tag('cbc:CityName', city)}${tag('cbc:PostalZone', postal)}<cac:Country>${tag('cbc:IdentificationCode', country)}</cac:Country></cac:${name}>`;
}
function taxScheme(id: string, scheme: 'VAT' | 'FC'): string {
  return `<cac:PartyTaxScheme>${tag('cbc:CompanyID', id)}<cac:TaxScheme>${tag('cbc:ID', scheme)}</cac:TaxScheme></cac:PartyTaxScheme>`;
}
function taxCategory(group: OfficeEInvoiceTaxGroup, kind: 'ClassifiedTaxCategory' | 'TaxCategory'): string {
  return `<cac:${kind}>${tag('cbc:ID', group.category)}${group.ratePercent == null ? (kind === 'TaxCategory' ? tag('cbc:Percent', '0') : '') : tag('cbc:Percent', decimal(group.ratePercent))}${kind === 'TaxCategory' ? optionalTag('cbc:TaxExemptionReasonCode', group.exemptionReasonCode) + optionalTag('cbc:TaxExemptionReason', group.exemptionReason) : ''}<cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:${kind}>`;
}
/** Generates UBL from a fresh draft snapshot. The caller must validate and atomically archive issue-mode output before releasing it. */
export function prepareOfficeInvoiceUbl(invoice: OfficeEInvoiceUblSource, preview: OfficeInvoiceIssuePreview, metadata: OfficeEInvoiceMetadata, attachments: OfficeEInvoiceAttachment[] = [], mode: 'draft' | 'issue' = 'draft'): PreparedOfficeInvoiceUbl {
  const findings = inspectOfficeInvoiceUblSource(invoice, preview, metadata);
  if (findings.length) throw new Error(findings.map(finding => finding.message).join(' '));
  const selected = invoice.includeProofs ? invoice.selectedProofIds : [];
  if (new Set(selected).size !== selected.length || attachments.length !== selected.length || new Set(attachments.map(item => item.id)).size !== attachments.length || selected.some(id => !attachments.some(item => item.id === id)) || (invoice.includeProofs && !selected.length) || (!invoice.includeProofs && invoice.selectedProofIds.length)) throw new Error('Die XML-Anlagen stimmen nicht mit der gespeicherten Auswahl der Leistungsnachweise überein.');
  let attachmentBytes = 0;
  const documents = selected.map(id => {
    const item = attachments.find(entry => entry.id === id)!;
    if (item.mimeType !== 'application/pdf' || !item.fileName || item.fileName.length > 200 || /[\/\\\u0000-\u001f]/.test(item.fileName) || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(item.base64) || !item.base64.startsWith('JVBERi0')) throw new Error('Ein Leistungsnachweis liegt nicht als gültige unveränderte PDF-Anlage vor.');
    attachmentBytes += item.base64.length * 3 / 4;
    if (attachmentBytes > 20 * 1024 * 1024) throw new Error('Die XML-Anlagen überschreiten die zulässige Gesamtgröße von 20 MB.');
    return `<cac:AdditionalDocumentReference>${tag('cbc:ID', item.id)}${optionalTag('cbc:DocumentDescription', item.description)}<cac:Attachment><cbc:EmbeddedDocumentBinaryObject mimeCode="application/pdf" filename="${escapeOfficeInvoiceXml(item.fileName)}">${item.base64}</cbc:EmbeddedDocumentBinaryObject></cac:Attachment></cac:AdditionalDocumentReference>`;
  }).join('');
  const company = preview.companySnapshot, buyer = metadata.buyer;
  const calculated = calculateOfficeInvoiceLines(invoice.lines), totals = calculateOfficeEInvoiceTaxGroups(invoice.lines);
  const outsideScope = totals.groups.some(group => group.category === 'O');
  const supplier = `<cac:AccountingSupplierParty><cac:Party><cbc:EndpointID schemeID="${escapeOfficeInvoiceXml(metadata.sellerEndpoint.schemeId)}">${escapeOfficeInvoiceXml(metadata.sellerEndpoint.value)}</cbc:EndpointID>${metadata.sellerIdentifier ? `<cac:PartyIdentification>${tag('cbc:ID', metadata.sellerIdentifier)}</cac:PartyIdentification>` : ''}${address('PostalAddress', field(company, 'street'), field(company, 'houseNumber'), field(company, 'postalCode'), field(company, 'city'), metadata.sellerCountryCode)}${!outsideScope && field(company, 'vatId') ? taxScheme(field(company, 'vatId'), 'VAT') : ''}${field(company, 'taxNumber') ? taxScheme(field(company, 'taxNumber'), 'FC') : ''}<cac:PartyLegalEntity>${tag('cbc:RegistrationName', field(company, 'legalName'))}${field(company, 'registerNumber') ? tag('cbc:CompanyID', [field(company, 'registerCourt'), field(company, 'registerNumber')].filter(Boolean).join(' ')) : ''}</cac:PartyLegalEntity><cac:Contact>${tag('cbc:Name', metadata.sellerContact.name)}${tag('cbc:Telephone', metadata.sellerContact.phone)}${tag('cbc:ElectronicMail', metadata.sellerContact.email)}</cac:Contact></cac:Party></cac:AccountingSupplierParty>`;
  const customer = `<cac:AccountingCustomerParty><cac:Party><cbc:EndpointID schemeID="${escapeOfficeInvoiceXml(metadata.buyerEndpoint.schemeId)}">${escapeOfficeInvoiceXml(metadata.buyerEndpoint.value)}</cbc:EndpointID>${address('PostalAddress', buyer.street, buyer.houseNumber, buyer.postalCode, buyer.city, metadata.buyerCountryCode)}${!outsideScope && metadata.buyerVatId ? taxScheme(metadata.buyerVatId, 'VAT') : ''}<cac:PartyLegalEntity>${tag('cbc:RegistrationName', buyer.name)}${optionalTag('cbc:CompanyID', metadata.buyerLegalRegistrationId)}</cac:PartyLegalEntity></cac:Party></cac:AccountingCustomerParty>`;
  const payment = `<cac:PaymentMeans><cbc:PaymentMeansCode>58</cbc:PaymentMeansCode>${tag('cbc:PaymentID', preview.invoiceNumber)}<cac:PayeeFinancialAccount>${tag('cbc:ID', field(company, 'iban').replace(/\s/g, ''))}${tag('cbc:Name', field(company, 'legalName'))}${field(company, 'bic') ? `<cac:FinancialInstitutionBranch>${tag('cbc:ID', field(company, 'bic').replace(/\s/g, ''))}</cac:FinancialInstitutionBranch>` : ''}</cac:PayeeFinancialAccount></cac:PaymentMeans>`;
  const taxTotal = `<cac:TaxTotal>${amount('TaxAmount', totals.taxCents)}${totals.groups.map(group => `<cac:TaxSubtotal>${amount('TaxableAmount', group.netCents)}${amount('TaxAmount', group.taxCents)}${taxCategory(group, 'TaxCategory')}</cac:TaxSubtotal>`).join('')}</cac:TaxTotal>`;
  const monetaryTotal = `<cac:LegalMonetaryTotal>${amount('LineExtensionAmount', totals.netCents)}${amount('TaxExclusiveAmount', totals.netCents)}${amount('TaxInclusiveAmount', totals.totalCents)}${amount('PayableAmount', totals.totalCents)}</cac:LegalMonetaryTotal>`;
  const lines = calculated.lines.map((line, index) => {
    const tax = invoice.lines[index].eInvoiceTax!;
    const group = totals.groups.find(entry => entry.category === tax.category && entry.ratePercent === (tax.category === 'O' ? null : line.taxRatePercent))!;
    return `<cac:InvoiceLine>${tag('cbc:ID', String(index + 1))}<cbc:InvoicedQuantity unitCode="${escapeOfficeInvoiceXml(tax.unitCode)}">${decimal(line.quantity)}</cbc:InvoicedQuantity>${amount('LineExtensionAmount', line.netCents)}${line.serviceDate ? `<cac:InvoicePeriod>${tag('cbc:StartDate', line.serviceDate)}${tag('cbc:EndDate', line.serviceDate)}</cac:InvoicePeriod>` : ''}<cac:Item>${tag('cbc:Name', line.description)}${taxCategory(group, 'ClassifiedTaxCategory')}</cac:Item><cac:Price>${amount('PriceAmount', line.unitPriceCents)}<cbc:BaseQuantity unitCode="${escapeOfficeInvoiceXml(tax.unitCode)}">1</cbc:BaseQuantity></cac:Price></cac:InvoiceLine>`;
  }).join('');
  const note = [mode === 'draft' ? 'ENTWURF – keine ausgestellte Rechnung. Die vollständige technische Formatvalidierung steht aus.' : '', invoice.footerText].filter(Boolean).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">${tag('cbc:CustomizationID', OFFICE_XRECHNUNG_CUSTOMIZATION)}${tag('cbc:ProfileID', OFFICE_XRECHNUNG_PROCESS)}${tag('cbc:ID', preview.invoiceNumber)}${tag('cbc:IssueDate', invoice.invoiceDate)}${tag('cbc:DueDate', invoice.dueDate!)}<cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>${optionalTag('cbc:Note', note)}<cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>${tag('cbc:BuyerReference', metadata.buyerReference)}<cac:InvoicePeriod>${tag('cbc:StartDate', invoice.servicePeriodStart!)}${tag('cbc:EndDate', invoice.servicePeriodEnd!)}</cac:InvoicePeriod>${documents}${supplier}${customer}${payment}${taxTotal}${monetaryTotal}${lines}</Invoice>`;
  const bytes = new TextEncoder().encode(xml);
  if (bytes.length > 30 * 1024 * 1024) throw new Error('Der XML-Entwurf überschreitet die zulässige Größe von 30 MB.');
  return { xml, bytes, fileName: `${preview.invoiceNumber.replace(/[^\p{L}\p{N}_.-]+/gu, '_') || invoice.id}${mode === 'draft' ? '_ENTWURF' : ''}.xml`, format: 'xrechnung', customizationId: OFFICE_XRECHNUNG_CUSTOMIZATION,
    validation: { status: 'not_validated', message: mode === 'draft' ? 'XML-Entwurf erstellt. Keine vollständige XSD- und Geschäftsregelprüfung; nicht ausgestellt.' : 'XML erstellt. Vollständige Formatvalidierung und atomare Freigabe stehen noch aus.' }, taxGroups: totals.groups,
    totals: { netCents: totals.netCents, taxCents: totals.taxCents, totalCents: totals.totalCents } };
}
