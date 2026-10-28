// Generated native presentation from src/lib/office/eInvoiceImport.web.ts. Update through scripts/port-native-workspaces.mjs.
import {nativeCrypto as crypto} from '@/lib/platform/nativeWorkflowEnvironment.native';
import { extractNativePdfAttachments } from '@/lib/platform/nativePdfInspection.native';
import { parseNativeInvoiceXml } from '@/lib/platform/nativeXmlParser.native';
/** Read-only, bounded inspection. Recognising a profile never proves standard conformity. */
export const OFFICE_EINVOICE_IMPORT_LIMITS = Object.freeze({ originalBytes: 10 * 1024 * 1024,
    xmlBytes: 5 * 1024 * 1024, attachmentBytes: 5 * 1024 * 1024, attachments: 32,
    elements: 30000, depth: 64, lines: 1000, fieldLength: 8192 });
export type OfficeEInvoiceParty = {
    name: string;
    addressLines: string[];
    postalCode: string;
    city: string;
    country: string;
    taxId: string;
    vatId: string;
    endpointId: string;
    endpointScheme: string;
};
export type OfficeEInvoiceLinePreview = {
    id: string;
    name: string;
    quantity: string;
    unitCode: string;
    unitPrice: string;
    priceBaseQuantity?: string;
    priceBaseUnitCode?: string;
    lineTotal: string;
    taxCategory: string;
    taxRate: string;
};
export type OfficeEInvoiceXmlPreview = {
    syntax: 'ubl_invoice' | 'ubl_credit_note' | 'cii';
    rootNamespace: string;
    profileId: string;
    profileLabel: string;
    profileSupport: 'supported' | 'excluded' | 'unknown';
    processId: string;
    invoiceNumber: string;
    invoiceTypeCode: string;
    issueDate: string;
    currency: string;
    dueDate?: string;
    buyerReference?: string;
    paymentReference?: string;
    seller: OfficeEInvoiceParty;
    buyer: OfficeEInvoiceParty;
    totals: {
        payable: string;
        taxExclusive: string;
        taxInclusive: string;
        tax: string;
    };
    lines: OfficeEInvoiceLinePreview[];
    warnings: string[];
};
export type OfficeEInvoiceImportInspection = {
    originalBytes: Uint8Array;
    xmlBytes: Uint8Array;
    originalSha256: string;
    xmlSha256: string;
    sourceKind: 'xml' | 'hybrid_pdf';
    originalFileName: string;
    xmlFileName: string;
    preview: OfficeEInvoiceXmlPreview;
    warnings: string[];
    extractionProvenance: {
        method: 'direct_xml' | 'pdfbox_embedded_attachment';
        attachmentName: string | null;
        attachmentCount: number;
        originalPreserved: true;
        containerConformityChecked: false;
    };
};
export type OfficeEInvoiceImportFile = {
    name: string;
    size: number;
    type?: string;
    arrayBuffer(): Promise<ArrayBuffer>;
};
type EmbeddedAttachment = {
    name: string;
    bytes: Uint8Array;
};
type AttachmentReader = {
    extractAttachments(bytes: Uint8Array): Promise<EmbeddedAttachment[]>;
};
declare global {
    interface Window {
        CareSuiteInvoiceXmlV1?: AttachmentReader;
    }
}
const NS = { invoice: 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
    credit: 'urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2',
    cbc: 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
    cac: 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
    cii: 'urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100',
    ram: 'urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100',
    udt: 'urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100' } as const;
const profiles: Record<string, {
    label: string;
    support: OfficeEInvoiceXmlPreview['profileSupport'];
}> = {
    'urn:cen.eu:en16931:2017': { label: 'EN 16931 (deklariert)', support: 'supported' },
    'urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0': { label: 'XRechnung 3.0 (deklariert)', support: 'supported' },
    'urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_2.3': { label: 'XRechnung 2.3 (deklariert)', support: 'supported' },
    'urn:cen.eu:en16931:2017#compliant#urn:factur-x.eu:1p0:basic': { label: 'ZUGFeRD / Factur-X BASIC (deklariert)', support: 'supported' },
    'urn:cen.eu:en16931:2017#compliant#urn:zugferd.de:2p0:basic': { label: 'ZUGFeRD BASIC (deklariert)', support: 'supported' },
    'urn:cen.eu:en16931:2017#conformant#urn:factur-x.eu:1p0:extended': { label: 'ZUGFeRD / Factur-X EXTENDED (deklariert)', support: 'supported' },
    'urn:cen.eu:en16931:2017#conformant#urn:zugferd.de:2p0:extended': { label: 'ZUGFeRD EXTENDED (deklariert)', support: 'supported' },
    'urn:factur-x.eu:1p0:minimum': { label: 'ZUGFeRD / Factur-X MINIMUM', support: 'excluded' },
    'urn:factur-x.eu:1p0:basicwl': { label: 'ZUGFeRD / Factur-X BASIC-WL', support: 'excluded' },
    'urn:zugferd.de:2p0:minimum': { label: 'ZUGFeRD MINIMUM', support: 'excluded' },
    'urn:zugferd.de:2p0:basicwl': { label: 'ZUGFeRD BASIC-WL', support: 'excluded' },
};
function decodeXml(bytes: Uint8Array): string {
    if (!bytes.length || bytes.length > OFFICE_EINVOICE_IMPORT_LIMITS.xmlBytes)
        throw new Error('Die XML-Datei ist leer oder überschreitet 5 MB.');
    let encoding: 'utf-8' | 'utf-16le' | 'utf-16be' = 'utf-8';
    if (bytes[0] === 0xff && bytes[1] === 0xfe || bytes[0] === 0x3c && bytes[1] === 0)
        encoding = 'utf-16le';
    if (bytes[0] === 0xfe && bytes[1] === 0xff || bytes[0] === 0 && bytes[1] === 0x3c)
        encoding = 'utf-16be';
    let xml: string;
    try {
        xml = new TextDecoder(encoding, { fatal: true }).decode(bytes);
    }
    catch {
        throw new Error('Die XML-Zeichenkodierung ist beschädigt. Unterstützt werden UTF-8 und UTF-16.');
    }
    const declared = xml.match(/^<\?xml\s[^?]*\bencoding\s*=\s*['"]([^'"]+)['"][^?]*\?>/i)?.[1]?.toLowerCase();
    if (declared && declared !== encoding && !(declared === 'utf-16' && encoding.startsWith('utf-16')) && !(declared === 'utf8' && encoding === 'utf-8')) {
        throw new Error('Die angegebene XML-Zeichenkodierung wird nicht unterstützt oder stimmt nicht mit der Datei überein.');
    }
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(xml))
        throw new Error('Die XML-Datei enthält unzulässige Steuerzeichen.');
    return xml;
}
/** Run BEFORE DOMParser: no DTD, entity definitions, external instructions or unbounded nesting. */
function preflightXml(xml: string): void {
    const stack: string[] = [];
    let index = 0;
    let elements = 0;
    let roots = 0;
    while (index < xml.length) {
        const open = xml.indexOf('<', index);
        const content = xml.slice(index, open < 0 ? xml.length : open);
        if ((!stack.length && content.trim()) || /&(?!(?:amp|lt|gt|apos|quot|#\d+|#x[0-9a-fA-F]+);)/.test(content)) {
            throw new Error('Die XML-Datei enthält ungültigen Text oder nicht erlaubte Entitäten.');
        }
        if (open < 0)
            break;
        if (xml.startsWith('<!--', open)) {
            const end = xml.indexOf('-->', open + 4);
            if (end < 0 || xml.slice(open + 4, end).includes('--'))
                throw new Error('Ein XML-Kommentar ist beschädigt.');
            index = end + 3;
            continue;
        }
        if (xml.startsWith('<![CDATA[', open)) {
            const end = xml.indexOf(']]>', open + 9);
            if (!stack.length || end < 0)
                throw new Error('Ein XML-Textbereich ist beschädigt.');
            index = end + 3;
            continue;
        }
        if (xml.startsWith('<?', open)) {
            const end = xml.indexOf('?>', open + 2);
            if (open !== 0 || end < 0 || !/^<\?xml\s/.test(xml.slice(open, end)))
                throw new Error('XML-Verarbeitungsanweisungen werden aus Sicherheitsgründen nicht eingelesen.');
            index = end + 2;
            continue;
        }
        if (xml.startsWith('<!', open))
            throw new Error('XML mit DTD oder Entitätsdefinitionen wird aus Sicherheitsgründen nicht eingelesen.');
        let close = open + 1;
        let quote = '';
        for (; close < xml.length; close += 1) {
            const char = xml[close];
            if (quote) {
                if (char === quote)
                    quote = '';
            }
            else if (char === '"' || char === "'")
                quote = char;
            else if (char === '>')
                break;
            else if (char === '<')
                throw new Error('Ein XML-Element ist beschädigt.');
        }
        if (close >= xml.length || quote)
            throw new Error('Ein XML-Element ist nicht abgeschlossen.');
        const tag = xml.slice(open + 1, close);
        const ending = tag.startsWith('/');
        const name = tag.match(ending ? /^\/([^\s/>]+)/ : /^([^\s/>]+)/)?.[1];
        if (!name || name.length > 512 || !/^[\p{L}_][\p{L}\p{N}\p{M}_.:\u00b7-]*$/u.test(name))
            throw new Error('Die XML-Datei enthält einen ungültigen Elementnamen.');
        if (ending) {
            if (!/^\/[^\s/>]+\s*$/.test(tag) || stack.pop() !== name)
                throw new Error('Die XML-Elemente sind nicht korrekt verschachtelt.');
        }
        else {
            elements += 1;
            if (elements > OFFICE_EINVOICE_IMPORT_LIMITS.elements || stack.length + 1 > OFFICE_EINVOICE_IMPORT_LIMITS.depth)
                throw new Error('Die XML-Datei enthält zu viele oder zu tief verschachtelte Elemente.');
            if (!stack.length && ++roots > 1)
                throw new Error('Die Datei enthält mehrere XML-Hauptelemente.');
            if (!tag.endsWith('/'))
                stack.push(name);
        }
        index = close + 1;
    }
    if (stack.length || roots !== 1)
        throw new Error('Die XML-Datei ist unvollständig.');
}
function children(parent: Element | null, ns: string, local: string): Element[] {
    return parent ? (Array.from(parent.childNodes).filter(child => child.nodeType === 1) as Element[]).filter(child => child.namespaceURI === ns && child.localName === local) : [];
}
function one(parent: Element | null, ns: string, local: string): Element | null {
    const found = children(parent, ns, local);
    if (found.length > 1)
        throw new Error(`Das XML-Feld ${local} ist mehrfach vorhanden und kann nicht eindeutig angezeigt werden.`);
    return found[0] ?? null;
}
function path(parent: Element | null, ns: string, ...names: string[]): Element | null {
    return names.reduce<Element | null>((node, name) => one(node, ns, name), parent);
}
function value(node: Element | null): string {
    if (!node)
        return '';
    if (Array.from(node.childNodes).some(child => child.nodeType === 1))
        throw new Error(`Das XML-Feld ${node.localName} enthält unerwartete Unterelemente.`);
    const result = (node.textContent ?? '').trim();
    if (result.length > OFFICE_EINVOICE_IMPORT_LIMITS.fieldLength)
        throw new Error('Ein Rechnungsfeld überschreitet die zulässige Textlänge.');
    return result;
}
const field = (parent: Element | null, ns: string, local: string) => value(one(parent, ns, local));
function ublParty(root: Element, type: string): OfficeEInvoiceParty {
    const party = path(root, NS.cac, type, 'Party');
    const address = one(party, NS.cac, 'PostalAddress');
    const endpoint = one(party, NS.cbc, 'EndpointID');
    const taxes = children(party, NS.cac, 'PartyTaxScheme');
    const taxValue = (vat: boolean) => {
        const matches = taxes.filter(tax => (field(one(tax, NS.cac, 'TaxScheme'), NS.cbc, 'ID') === 'VAT') === vat);
        return matches.map(tax => field(tax, NS.cbc, 'CompanyID')).filter(Boolean).join(', ');
    };
    return { name: field(one(party, NS.cac, 'PartyLegalEntity'), NS.cbc, 'RegistrationName') || field(one(party, NS.cac, 'PartyName'), NS.cbc, 'Name'),
        addressLines: [field(address, NS.cbc, 'StreetName'), field(address, NS.cbc, 'AdditionalStreetName'),
            ...children(address, NS.cac, 'AddressLine').map(line => field(line, NS.cbc, 'Line'))].filter(Boolean),
        postalCode: field(address, NS.cbc, 'PostalZone'), city: field(address, NS.cbc, 'CityName'),
        country: field(one(address, NS.cac, 'Country'), NS.cbc, 'IdentificationCode'),
        taxId: taxValue(false), vatId: taxValue(true), endpointId: value(endpoint), endpointScheme: endpoint?.getAttribute('schemeID') ?? '' };
}
function ciiParty(agreement: Element | null, type: string): OfficeEInvoiceParty {
    const party = one(agreement, NS.ram, type);
    const address = one(party, NS.ram, 'PostalTradeAddress');
    const endpoint = path(party, NS.ram, 'URIUniversalCommunication', 'URIID');
    const taxId = (scheme: string) => children(party, NS.ram, 'SpecifiedTaxRegistration')
        .map(tax => one(tax, NS.ram, 'ID')).filter(id => id?.getAttribute('schemeID') === scheme).map(value).join(', ');
    return { name: field(party, NS.ram, 'Name'),
        addressLines: ['LineOne', 'LineTwo', 'LineThree'].map(line => field(address, NS.ram, line)).filter(Boolean),
        postalCode: field(address, NS.ram, 'PostcodeCode'), city: field(address, NS.ram, 'CityName'), country: field(address, NS.ram, 'CountryID'),
        taxId: taxId('FC'), vatId: taxId('VA'), endpointId: value(endpoint), endpointScheme: endpoint?.getAttribute('schemeID') ?? '' };
}
function parseUbl(root: Element): Omit<OfficeEInvoiceXmlPreview, 'profileLabel' | 'profileSupport' | 'warnings'> {
    const credit = root.localName === 'CreditNote';
    const currency = field(root, NS.cbc, 'DocumentCurrencyCode');
    const totals = one(root, NS.cac, 'LegalMonetaryTotal');
    const lines = children(root, NS.cac, credit ? 'CreditNoteLine' : 'InvoiceLine');
    if (lines.length > OFFICE_EINVOICE_IMPORT_LIMITS.lines)
        throw new Error('Die Rechnung enthält mehr als 1.000 Positionen.');
    const taxAmounts = children(root, NS.cac, 'TaxTotal').map(tax => one(tax, NS.cbc, 'TaxAmount'))
        .filter(amount => amount && (!amount.getAttribute('currencyID') || amount.getAttribute('currencyID') === currency));
    if (taxAmounts.length > 1)
        throw new Error('Mehrere Steuer-Gesamtsummen in derselben Währung sind nicht eindeutig.');
    return { syntax: credit ? 'ubl_credit_note' : 'ubl_invoice', rootNamespace: root.namespaceURI ?? '',
        profileId: field(root, NS.cbc, 'CustomizationID'), processId: field(root, NS.cbc, 'ProfileID'),
        invoiceNumber: field(root, NS.cbc, 'ID'), invoiceTypeCode: field(root, NS.cbc, credit ? 'CreditNoteTypeCode' : 'InvoiceTypeCode'),
        issueDate: field(root, NS.cbc, 'IssueDate'), dueDate: field(root, NS.cbc, 'DueDate'), buyerReference: field(root, NS.cbc, 'BuyerReference'),
        paymentReference: children(root, NS.cac, 'PaymentMeans').map(payment => field(payment, NS.cbc, 'PaymentID')).filter(Boolean).join(', '),
        currency, seller: ublParty(root, 'AccountingSupplierParty'), buyer: ublParty(root, 'AccountingCustomerParty'),
        totals: { payable: field(totals, NS.cbc, 'PayableAmount'), taxExclusive: field(totals, NS.cbc, 'TaxExclusiveAmount'),
            taxInclusive: field(totals, NS.cbc, 'TaxInclusiveAmount'), tax: value(taxAmounts[0] ?? null) },
        lines: lines.map(line => {
            const quantity = one(line, NS.cbc, credit ? 'CreditedQuantity' : 'InvoicedQuantity');
            const item = one(line, NS.cac, 'Item');
            const tax = one(item, NS.cac, 'ClassifiedTaxCategory');
            const price = one(line, NS.cac, 'Price');
            const priceBase = one(price, NS.cbc, 'BaseQuantity');
            return { id: field(line, NS.cbc, 'ID'), name: field(item, NS.cbc, 'Name') || field(item, NS.cbc, 'Description'),
                quantity: value(quantity), unitCode: quantity?.getAttribute('unitCode') ?? '', unitPrice: field(price, NS.cbc, 'PriceAmount'),
                priceBaseQuantity: value(priceBase), priceBaseUnitCode: priceBase?.getAttribute('unitCode') ?? '',
                lineTotal: field(line, NS.cbc, 'LineExtensionAmount'), taxCategory: field(tax, NS.cbc, 'ID'), taxRate: field(tax, NS.cbc, 'Percent') };
        }) };
}
function parseCii(root: Element): Omit<OfficeEInvoiceXmlPreview, 'profileLabel' | 'profileSupport' | 'warnings'> {
    const context = one(root, NS.cii, 'ExchangedDocumentContext');
    const document = one(root, NS.cii, 'ExchangedDocument');
    const transaction = one(root, NS.cii, 'SupplyChainTradeTransaction');
    const agreement = one(transaction, NS.ram, 'ApplicableHeaderTradeAgreement');
    const settlement = one(transaction, NS.ram, 'ApplicableHeaderTradeSettlement');
    const totals = one(settlement, NS.ram, 'SpecifiedTradeSettlementHeaderMonetarySummation');
    const dateNode = one(one(document, NS.ram, 'IssueDateTime'), NS.udt, 'DateTimeString');
    const dateText = value(dateNode);
    const issueDate = dateNode?.getAttribute('format') === '102' && /^\d{8}$/.test(dateText)
        ? `${dateText.slice(0, 4)}-${dateText.slice(4, 6)}-${dateText.slice(6, 8)}` : dateText;
    const dueNode = one(path(settlement, NS.ram, 'SpecifiedTradePaymentTerms', 'DueDateDateTime'), NS.udt, 'DateTimeString');
    const dueText = value(dueNode);
    const dueDate = dueNode?.getAttribute('format') === '102' && /^\d{8}$/.test(dueText)
        ? `${dueText.slice(0, 4)}-${dueText.slice(4, 6)}-${dueText.slice(6, 8)}` : dueText;
    const currency = field(settlement, NS.ram, 'InvoiceCurrencyCode');
    const taxes = children(totals, NS.ram, 'TaxTotalAmount').filter(amount => !amount.getAttribute('currencyID') || amount.getAttribute('currencyID') === currency);
    if (taxes.length > 1)
        throw new Error('Mehrere Steuer-Gesamtsummen in derselben Währung sind nicht eindeutig.');
    const lines = children(transaction, NS.ram, 'IncludedSupplyChainTradeLineItem');
    if (lines.length > OFFICE_EINVOICE_IMPORT_LIMITS.lines)
        throw new Error('Die Rechnung enthält mehr als 1.000 Positionen.');
    return { syntax: 'cii', rootNamespace: root.namespaceURI ?? '',
        profileId: field(one(context, NS.ram, 'GuidelineSpecifiedDocumentContextParameter'), NS.ram, 'ID'),
        processId: field(one(context, NS.ram, 'BusinessProcessSpecifiedDocumentContextParameter'), NS.ram, 'ID'),
        invoiceNumber: field(document, NS.ram, 'ID'), invoiceTypeCode: field(document, NS.ram, 'TypeCode'), issueDate, dueDate,
        buyerReference: field(agreement, NS.ram, 'BuyerReference'), paymentReference: field(settlement, NS.ram, 'PaymentReference'), currency,
        seller: ciiParty(agreement, 'SellerTradeParty'), buyer: ciiParty(agreement, 'BuyerTradeParty'),
        totals: { payable: field(totals, NS.ram, 'DuePayableAmount'), taxExclusive: field(totals, NS.ram, 'TaxBasisTotalAmount'),
            taxInclusive: field(totals, NS.ram, 'GrandTotalAmount'), tax: value(taxes[0] ?? null) },
        lines: lines.map(line => {
            const delivery = one(line, NS.ram, 'SpecifiedLineTradeDelivery');
            const quantity = one(delivery, NS.ram, 'BilledQuantity');
            const lineSettlement = one(line, NS.ram, 'SpecifiedLineTradeSettlement');
            const tax = one(lineSettlement, NS.ram, 'ApplicableTradeTax');
            const price = path(line, NS.ram, 'SpecifiedLineTradeAgreement', 'NetPriceProductTradePrice');
            const priceBase = one(price, NS.ram, 'BasisQuantity');
            return { id: field(one(line, NS.ram, 'AssociatedDocumentLineDocument'), NS.ram, 'LineID'),
                name: field(one(line, NS.ram, 'SpecifiedTradeProduct'), NS.ram, 'Name'), quantity: value(quantity), unitCode: quantity?.getAttribute('unitCode') ?? '',
                unitPrice: field(price, NS.ram, 'ChargeAmount'), priceBaseQuantity: value(priceBase), priceBaseUnitCode: priceBase?.getAttribute('unitCode') ?? '',
                lineTotal: field(one(lineSettlement, NS.ram, 'SpecifiedTradeSettlementLineMonetarySummation'), NS.ram, 'LineTotalAmount'),
                taxCategory: field(tax, NS.ram, 'CategoryCode'), taxRate: field(tax, NS.ram, 'RateApplicablePercent') };
        }) };
}
export function parseOfficeEInvoiceXml(bytes: Uint8Array): OfficeEInvoiceXmlPreview {
    const xml = decodeXml(bytes);
    preflightXml(xml);
    const parsed = parseNativeInvoiceXml(xml);
    if (!parsed.documentElement || parsed.getElementsByTagNameNS('*', 'parsererror').length)
        throw new Error('Die XML-Datei ist nicht korrekt aufgebaut.');
    // XInclude is never processed; reject it instead of presenting an incomplete external document.
    const all = parsed.getElementsByTagName('*');
    for (let index = 0; index < all.length; index += 1) {
        const node = all[index];
        if (node.namespaceURI === 'http://www.w3.org/2001/XInclude')
            throw new Error('Externe XML-Inhalte werden nicht eingelesen.');
        if (node.attributes.length > 64)
            throw new Error('Ein XML-Element enthält zu viele Attribute.');
        for (const attribute of Array.from(node.attributes))
            if (attribute.value.length > OFFICE_EINVOICE_IMPORT_LIMITS.fieldLength)
                throw new Error('Ein XML-Attribut ist zu lang.');
    }
    const root = parsed.documentElement;
    const data = root.localName === 'Invoice' && root.namespaceURI === NS.invoice || root.localName === 'CreditNote' && root.namespaceURI === NS.credit
        ? parseUbl(root) : root.localName === 'CrossIndustryInvoice' && root.namespaceURI === NS.cii ? parseCii(root) : null;
    if (!data)
        throw new Error('Die Datei enthält keine unterstützte UBL-Rechnung, UBL-Gutschrift oder CII-Rechnung.');
    let profile = Object.hasOwn(profiles, data.profileId) ? profiles[data.profileId] : { label: data.profileId ? 'Unbekanntes Profil' : 'Profil nicht angegeben', support: 'unknown' as const };
    if (data.syntax !== 'cii' && profile.label.includes('ZUGFeRD') && profile.support === 'supported')
        profile = { label: 'Profil passt nicht zur XML-Syntax', support: 'unknown' };
    const warnings = ['Die Angaben wurden aus dem XML gelesen. Das Auslesen allein ersetzt keine Normprüfung oder sachliche Prüfung.'];
    if (profile.support === 'excluded')
        warnings.push('MINIMUM und BASIC-WL sind keine vollständigen E-Rechnungsprofile. Das Original kann zur Klärung abgelegt werden.');
    else if (profile.support === 'unknown')
        warnings.push('Das deklarierte Profil wird nicht erkannt. Die Datei darf nicht als formatgeprüfte E-Rechnung behandelt werden.');
    if (!data.invoiceNumber || !data.seller.name || !data.buyer.name || !data.currency || !data.totals.payable)
        warnings.push('Wesentliche Angaben fehlen in der strukturierten Vorschau. Bitte den Absender um Prüfung bitten.');
    if (data.syntax === 'cii' && data.invoiceTypeCode && !['380', '381', '384', '389', '326'].includes(data.invoiceTypeCode))
        warnings.push('Der deklarierte Dokumenttyp ist keine übliche Rechnung oder Gutschrift. Bitte vor einer weiteren Verarbeitung prüfen.');
    if (!data.lines.length)
        warnings.push('Die Datei enthält keine auslesbaren Rechnungspositionen.');
    return { ...data, profileLabel: profile.label, profileSupport: profile.support, warnings };
}
let pendingReader: Promise<AttachmentReader> | undefined;
function attachmentReader(): Promise<AttachmentReader> { return Promise.resolve({ extractAttachments: extractNativePdfAttachments }); }
export async function officeEInvoiceSha256(bytes: Uint8Array): Promise<string> {
    if (!crypto?.subtle)
        throw new Error('Die sichere Dateiprüfung ist in diesem Browser nicht verfügbar.');
    const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes));
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
function safeFileName(name: string, fallback: string): string {
    return name.split(/[\\/]/).pop()?.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 240) || fallback;
}
function isPdf(bytes: Uint8Array): boolean { return new TextDecoder('ascii').decode(bytes.subarray(0, 1024)).includes('%PDF-'); }
function looksLikeXml(bytes: Uint8Array): boolean {
    if (bytes[0] === 0xff && bytes[1] === 0xfe || bytes[0] === 0xfe && bytes[1] === 0xff || bytes[0] === 0 && bytes[1] === 0x3c || bytes[0] === 0x3c && bytes[1] === 0)
        return true;
    return new TextDecoder().decode(bytes.subarray(0, 1024)).trimStart().startsWith('<');
}
/** The returned bytes are exact copies. No upload, accounting entry, execution or PDF rendering occurs. */
export async function inspectOfficeEInvoiceImport(file: OfficeEInvoiceImportFile): Promise<OfficeEInvoiceImportInspection> {
    if (!Number.isSafeInteger(file.size) || file.size <= 0 || file.size > OFFICE_EINVOICE_IMPORT_LIMITS.originalBytes)
        throw new Error('Bitte eine XML-Datei bis 5 MB oder eine PDF-Datei bis 10 MB auswählen.');
    const originalBytes = new Uint8Array(await file.arrayBuffer());
    if (originalBytes.length !== file.size)
        throw new Error('Die Datei wurde nicht vollständig gelesen. Bitte erneut auswählen.');
    const hybrid = isPdf(originalBytes);
    const originalFileName = safeFileName(file.name, hybrid ? 'rechnung.pdf' : 'rechnung.xml');
    let xmlBytes = originalBytes.slice();
    let xmlFileName = originalFileName;
    let attachmentName: string | null = null;
    let attachmentCount = 0;
    let preview: OfficeEInvoiceXmlPreview;
    if (hybrid) {
        // PDF.js may transfer/detach the buffer. Give it a separate copy, never the original.
        const attachments = await (await attachmentReader()).extractAttachments(originalBytes.slice());
        attachmentCount = attachments.length;
        if (attachmentCount > OFFICE_EINVOICE_IMPORT_LIMITS.attachments || attachments.reduce((sum, item) => sum + item.bytes.length, 0) > OFFICE_EINVOICE_IMPORT_LIMITS.attachmentBytes)
            throw new Error('Die PDF enthält zu viele oder zu große eingebettete Dateien.');
        const candidates: Array<{
            name: string;
            bytes: Uint8Array;
            preview: OfficeEInvoiceXmlPreview;
        }> = [];
        for (const item of attachments) {
            if (!/\.xml$/i.test(item.name) && !looksLikeXml(item.bytes))
                continue;
            try {
                candidates.push({ ...item, preview: parseOfficeEInvoiceXml(item.bytes) });
            }
            catch (error) {
                // An unrelated, well-formed XML attachment is harmless, but do not silently choose
                // one invoice when another potential invoice is malformed or unsafe.
                if (error instanceof Error && error.message === 'Die Datei enthält keine unterstützte UBL-Rechnung, UBL-Gutschrift oder CII-Rechnung.')
                    continue;
                throw new Error(`Eine eingebettete XML-Datei kann nicht sicher gelesen werden: ${error instanceof Error ? error.message : 'Unbekannter Fehler.'}`);
            }
        }
        if (!candidates.length)
            throw new Error('Die PDF enthält keine auslesbare Rechnungs-XML. Eine gewöhnliche PDF ist keine strukturierte E-Rechnung.');
        if (candidates.length !== 1)
            throw new Error('Die PDF enthält mehrere Rechnungs-XML-Dateien. Eine eindeutige Zuordnung ist nicht möglich. Bitte den Absender um eine eindeutige Datei bitten.');
        const candidate = candidates[0];
        xmlBytes = candidate.bytes.slice();
        xmlFileName = safeFileName(candidate.name, 'rechnung.xml');
        attachmentName = candidate.name;
        preview = candidate.preview;
    }
    else {
        if (!looksLikeXml(originalBytes))
            throw new Error('Bitte eine XML-Rechnung oder eine PDF mit eingebetteter Rechnungs-XML auswählen.');
        preview = parseOfficeEInvoiceXml(xmlBytes);
    }
    const [originalSha256, xmlSha256] = await Promise.all([officeEInvoiceSha256(originalBytes), officeEInvoiceSha256(xmlBytes)]);
    const warnings = [...preview.warnings];
    if (hybrid)
        warnings.push('PDF und eingebettetes XML bleiben unverändert erhalten. PDF/A, ZUGFeRD-Metadaten, elektronische Signaturen und die Übereinstimmung der PDF-Darstellung sind noch nicht geprüft.');
    return { originalBytes, xmlBytes, originalSha256, xmlSha256, sourceKind: hybrid ? 'hybrid_pdf' : 'xml', originalFileName, xmlFileName, preview, warnings,
        extractionProvenance: { method: hybrid ? 'pdfbox_embedded_attachment' : 'direct_xml', attachmentName, attachmentCount, originalPreserved: true, containerConformityChecked: false } };
}
