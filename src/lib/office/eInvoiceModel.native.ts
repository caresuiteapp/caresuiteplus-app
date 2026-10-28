// Generated native presentation from src/lib/office/eInvoiceModel.web.ts. Update through scripts/port-native-workspaces.mjs.
import { calculateOfficeInvoiceLines, isOfficeInvoiceDate } from "./invoiceWorkspaceTypes.native.ts";
import type { OfficeEInvoiceAnswer, OfficeEInvoiceAssessment, OfficeEInvoiceDraftLine, OfficeEInvoiceLineTax, OfficeEInvoiceMetadata, OfficeEInvoiceTaxGroup } from "./eInvoiceTypes.native.ts";
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const answer = (value: unknown): OfficeEInvoiceAnswer => value === 'yes' || value === 'no' ? value : 'unknown';
const integerOrNull = (value: unknown): number | null => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
export function createEmptyOfficeEInvoiceMetadata(): OfficeEInvoiceMetadata {
    return { version: 1, format: 'pdf', buyer: { name: '', street: '', houseNumber: '', postalCode: '', city: '', country: '', email: '' }, buyerConfirmed: false,
        buyerCountryCode: '', buyerVatId: '', buyerLegalRegistrationId: '', buyerReference: '', buyerEndpoint: { schemeId: '', value: '' }, sellerIdentifier: '', sellerCountryCode: '',
        sellerEndpoint: { schemeId: '', value: '' }, sellerContact: { name: '', phone: '', email: '' },
        legal: { recipientKind: 'unknown', buyerBusinessUse: 'unknown', sellerDomestic: 'unknown', buyerDomestic: 'unknown', sellerSmallBusiness: 'unknown',
            smallAmountRuleEligible: 'unknown', passengerTicket: 'unknown', transmissionDate: '', priorYearRevenueCents: null, priorYearRevenueYear: null, pdfConsent: 'unknown' } };
}
export function createEmptyOfficeEInvoiceLineTax(): OfficeEInvoiceLineTax {
    return { category: '', unitCode: '', exemptionReason: '', exemptionReasonCode: '', legalBasis: 'unknown' };
}
/** Only known fields are accepted; unsupported versions/formats must not silently become PDF. */
export function normalizeOfficeEInvoiceMetadata(value: unknown): OfficeEInvoiceMetadata {
    const input = record(value);
    if (input.version != null && input.version !== 1)
        throw new Error('Diese Version der E-Rechnungsdaten wird noch nicht unterstützt.');
    if (input.format != null && input.format !== 'pdf' && input.format !== 'xrechnung')
        throw new Error('Das gespeicherte Rechnungsformat wird nicht unterstützt.');
    const buyer = record(input.buyer), legal = record(input.legal), sellerContact = record(input.sellerContact);
    const endpoint = (entry: unknown) => ({ schemeId: text(record(entry).schemeId), value: text(record(entry).value) });
    return { version: 1, format: input.format === 'xrechnung' ? 'xrechnung' : 'pdf',
        buyer: { name: text(buyer.name), street: text(buyer.street), houseNumber: text(buyer.houseNumber), postalCode: text(buyer.postalCode), city: text(buyer.city), country: text(buyer.country), email: text(buyer.email) },
        buyerConfirmed: input.buyerConfirmed === true, buyerCountryCode: text(input.buyerCountryCode), buyerVatId: text(input.buyerVatId), buyerLegalRegistrationId: text(input.buyerLegalRegistrationId), buyerReference: text(input.buyerReference),
        buyerEndpoint: endpoint(input.buyerEndpoint), sellerIdentifier: text(input.sellerIdentifier), sellerCountryCode: text(input.sellerCountryCode), sellerEndpoint: endpoint(input.sellerEndpoint),
        sellerContact: { name: text(sellerContact.name), phone: text(sellerContact.phone), email: text(sellerContact.email) },
        legal: { recipientKind: legal.recipientKind === 'b2b' || legal.recipientKind === 'b2c' || legal.recipientKind === 'b2g' ? legal.recipientKind : 'unknown',
            buyerBusinessUse: answer(legal.buyerBusinessUse), sellerDomestic: answer(legal.sellerDomestic), buyerDomestic: answer(legal.buyerDomestic), sellerSmallBusiness: answer(legal.sellerSmallBusiness),
            smallAmountRuleEligible: answer(legal.smallAmountRuleEligible), passengerTicket: answer(legal.passengerTicket), transmissionDate: text(legal.transmissionDate),
            priorYearRevenueCents: integerOrNull(legal.priorYearRevenueCents), priorYearRevenueYear: integerOrNull(legal.priorYearRevenueYear), pdfConsent: answer(legal.pdfConsent) } };
}
export function normalizeOfficeEInvoiceLineTax(value: unknown): OfficeEInvoiceLineTax {
    const input = record(value);
    return { category: ['S', 'Z', 'E', 'AE', 'O'].includes(String(input.category)) ? input.category as OfficeEInvoiceLineTax['category'] : '',
        unitCode: text(input.unitCode), exemptionReason: text(input.exemptionReason), exemptionReasonCode: text(input.exemptionReasonCode),
        legalBasis: ['none', 'ustg_4_8_29', 'ustg_19', 'other'].includes(String(input.legalBasis)) ? input.legalBasis as OfficeEInvoiceLineTax['legalBasis'] : 'unknown' };
}
export const OFFICE_EINVOICE_UNITS = [
    { code: 'HUR', label: 'Stunde' }, { code: 'MIN', label: 'Minute' }, { code: 'C62', label: 'Stück / Leistung' }, { code: 'KMT', label: 'Kilometer' },
    { code: 'DAY', label: 'Tag' }, { code: 'WEE', label: 'Woche' }, { code: 'MON', label: 'Monat' }, { code: 'ANN', label: 'Jahr' },
] as const;
export type OfficeEInvoiceAssessmentInput = {
    invoiceDate: string;
    servicePeriodStart: string | null;
    servicePeriodEnd: string | null;
    totalCents: number | null;
    lines: OfficeEInvoiceDraftLine[];
};
/** A conservative indication from explicit facts. Payer, client module and 0% never classify a transaction. */
export function assessOfficeEInvoiceRequirement(metadata: OfficeEInvoiceMetadata, invoice: OfficeEInvoiceAssessmentInput): OfficeEInvoiceAssessment {
    const legal = metadata.legal;
    const review = (...reasons: string[]): OfficeEInvoiceAssessment => ({ status: 'review', label: 'Einordnung prüfen', reasons, pdfPermitted: null, consentMissing: false });
    const optional = (status: 'not_required' | 'transition', reason: string): OfficeEInvoiceAssessment => ({ status,
        label: status === 'transition' ? 'Übergangsregel anwendbar' : 'Keine allgemeine B2B-Ausstellungspflicht', reasons: [reason, ...(legal.pdfConsent !== 'yes' ? ['Die Zustimmung zur elektronischen PDF-Übermittlung fehlt. Papier ist davon getrennt zu beurteilen.'] : [])],
        pdfPermitted: legal.pdfConsent === 'yes', consentMissing: legal.pdfConsent !== 'yes' });
    if (!metadata.buyerConfirmed || legal.recipientKind === 'unknown')
        return review('Den tatsächlichen Leistungsempfänger und dessen Rolle bestätigen. Der Kostenträger allein entscheidet die Einordnung nicht.');
    if (legal.recipientKind === 'b2g')
        return review('Für öffentliche Auftraggeber die anwendbaren B2G-Vorgaben, Vertragsbedingungen und den Übermittlungsweg gesondert prüfen.');
    if (legal.recipientKind === 'b2c') {
        if (legal.buyerBusinessUse === 'yes')
            return review('Privatkunde und unternehmerischer Leistungsbezug widersprechen sich.');
        return optional('not_required', 'Die Leistung ist ausdrücklich einem privaten Empfänger zugeordnet. Die allgemeine inländische B2B-Ausstellungspflicht greift nicht.');
    }
    if (legal.buyerBusinessUse === 'unknown')
        return review('Bitte bestätigen, ob der Empfänger die Leistung für sein Unternehmen bezieht.');
    if (legal.buyerBusinessUse === 'no')
        return optional('not_required', 'Der Empfänger bezieht die Leistung ausdrücklich außerhalb seines Unternehmens.');
    if (legal.sellerDomestic === 'unknown' || legal.buyerDomestic === 'unknown')
        return review('Die inländische Ansässigkeit von Aussteller und tatsächlichem Leistungsempfänger ist noch offen.');
    if (legal.sellerDomestic === 'no' || legal.buyerDomestic === 'no')
        return review('Der Umsatz fällt nicht ohne Weiteres unter die inländische B2B-Regel. Grenzüberschreitende Rechnungs- und Steuerregeln gesondert prüfen.');
    if (legal.passengerTicket === 'yes')
        return optional('not_required', 'Die Einordnung als Fahrausweis wurde ausdrücklich bestätigt.');
    if (legal.sellerSmallBusiness === 'yes') {
        if (invoice.lines.some(line => line.taxRatePercent > 0 || (line.eInvoiceTax?.legalBasis !== 'ustg_19' && line.eInvoiceTax?.legalBasis !== 'unknown' && line.eInvoiceTax != null)))
            return review('Die Kleinunternehmerangabe passt nicht zu den Steuerangaben der Positionen.');
        return optional('not_required', 'Die Anwendung der Kleinunternehmerregelung wurde für diese Rechnung ausdrücklich bestätigt.');
    }
    if (invoice.lines.length && invoice.lines.every(line => line.eInvoiceTax?.category === 'E' && line.eInvoiceTax.legalBasis === 'ustg_4_8_29' && line.taxRatePercent === 0 && !!line.eInvoiceTax.exemptionReason.trim())) {
        return optional('not_required', 'Sämtliche Positionen wurden ausdrücklich als steuerfrei nach § 4 Nr. 8 bis 29 UStG eingeordnet.');
    }
    if (invoice.totalCents != null && invoice.totalCents > 0 && invoice.totalCents <= 25000 && legal.smallAmountRuleEligible === 'yes') {
        if (invoice.lines.some(line => line.eInvoiceTax?.category === 'AE' || line.eInvoiceTax?.category === 'O'))
            return review('Die Kleinbetragsregel darf bei diesen Steuerkategorien nicht pauschal angewendet werden.');
        return optional('not_required', 'Der Bruttobetrag liegt höchstens bei 250 Euro; die Anwendbarkeit der Kleinbetragsregel wurde ausdrücklich bestätigt.');
    }
    if (legal.sellerSmallBusiness === 'unknown' || legal.passengerTicket === 'unknown' || (invoice.totalCents != null && invoice.totalCents <= 25000 && legal.smallAmountRuleEligible === 'unknown'))
        return review('Mögliche Ausnahmen sind noch nicht vollständig eingeordnet.');
    if (!invoice.lines.length || invoice.lines.some(line => !line.eInvoiceTax?.category || line.eInvoiceTax.legalBasis === 'unknown'))
        return review('Die steuerliche Einordnung sämtlicher Rechnungspositionen fehlt noch.');
    const start = invoice.servicePeriodStart || '', end = invoice.servicePeriodEnd || '', sent = legal.transmissionDate;
    if (![start, end, sent, invoice.invoiceDate].every(isOfficeInvoiceDate) || start > end || sent < invoice.invoiceDate)
        return review('Leistungszeitraum und geplantes Übermittlungsdatum vollständig und widerspruchsfrei angeben.');
    if (end < '2025-01-01')
        return optional('not_required', 'Der bestätigte Leistungszeitraum liegt vollständig vor Einführung der neuen B2B-Regelung.');
    if (start < '2025-01-01' || start.slice(0, 4) !== end.slice(0, 4))
        return review('Der Leistungszeitraum umfasst unterschiedliche gesetzliche Zeitabschnitte. Die zugrunde liegenden Umsätze einzeln prüfen.');
    if (start >= '2025-01-01' && end <= '2026-12-31' && sent <= '2026-12-31')
        return optional('transition', 'Leistungszeitraum und Übermittlung liegen innerhalb der allgemeinen Übergangsregel bis 31. Dezember 2026.');
    if (start >= '2027-01-01' && end <= '2027-12-31' && sent <= '2027-12-31') {
        if (legal.priorYearRevenueYear !== 2026 || legal.priorYearRevenueCents == null)
            return review('Für die Übergangsregel 2027 fehlt der bestätigte Gesamtumsatz des Kalenderjahres 2026.');
        if (legal.priorYearRevenueCents <= 80000000)
            return optional('transition', 'Der bestätigte Gesamtumsatz 2026 beträgt höchstens 800.000 Euro; Leistung und Übermittlung liegen in 2027.');
    }
    return { status: 'required', label: 'Strukturierte E-Rechnung erforderlich', reasons: ['Nach den bestätigten Angaben greift keine erfasste Ausnahme oder PDF-Übergangsregel. Eine normale PDF genügt für diesen Vorgang nicht.', 'Gesonderte EDI-Vereinbarungen sind in dieser Prüfung nicht berücksichtigt.'], pdfPermitted: false, consentMissing: false };
}
/** Current PDF amounts remain authoritative; do not silently alter totals to fit an XML tax breakdown. */
export function calculateOfficeEInvoiceTaxGroups(lines: OfficeEInvoiceDraftLine[]): {
    groups: OfficeEInvoiceTaxGroup[];
    netCents: number;
    taxCents: number;
    totalCents: number;
} {
    const calculated = calculateOfficeInvoiceLines(lines);
    const groups = new Map<string, OfficeEInvoiceTaxGroup>();
    for (const line of calculated.lines) {
        const tax = line.eInvoiceTax;
        if (!tax?.category)
            throw new Error('Jede Position benötigt eine ausdrücklich gewählte Steuerkategorie.');
        const rate = tax.category === 'O' ? null : line.taxRatePercent;
        const key = `${tax.category}:${rate}`;
        const existing = groups.get(key);
        if (existing && (existing.exemptionReason !== tax.exemptionReason.trim() || existing.exemptionReasonCode !== tax.exemptionReasonCode.trim()))
            throw new Error('Positionen derselben Steuergruppe benötigen eine einheitliche Begründung.');
        const group = existing || { category: tax.category, ratePercent: rate, exemptionReason: tax.exemptionReason.trim(), exemptionReasonCode: tax.exemptionReasonCode.trim(), netCents: 0, taxCents: 0 };
        group.netCents += line.netCents;
        group.taxCents += line.taxCents;
        groups.set(key, group);
    }
    for (const group of groups.values()) {
        const taxByGroup = group.ratePercent == null ? 0 : Number((BigInt(group.netCents) * BigInt(Math.round(group.ratePercent * 100)) + BigInt(5000)) / BigInt(10000));
        if (taxByGroup !== group.taxCents)
            throw new Error('Die Umsatzsteuer der gespeicherten Positionen weicht durch Rundung von der Steuergruppensumme ab. Eine XML-Ausgabe mit abweichenden PDF-Beträgen ist gesperrt. Bitte die Positionen fachlich prüfen.');
    }
    return { groups: [...groups.values()], netCents: calculated.netCents, taxCents: calculated.taxCents, totalCents: calculated.totalCents };
}
export function validateOfficeEInvoiceMetadata(metadata: OfficeEInvoiceMetadata, lines: OfficeEInvoiceDraftLine[]): import("./eInvoiceTypes.native.ts").OfficeEInvoiceFinding[] {
    const findings: import("./eInvoiceTypes.native.ts").OfficeEInvoiceFinding[] = [];
    const add = (condition: boolean, code: string, message: string, field?: string) => { if (!condition)
        findings.push({ code, message, field }); };
    const email = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    add(metadata.buyerConfirmed, 'BUYER_CONFIRMATION', 'Den tatsächlichen Leistungsempfänger ausdrücklich bestätigen.', 'buyerConfirmed');
    for (const [field, label] of [['name', 'Name'], ['street', 'Straße'], ['postalCode', 'Postleitzahl'], ['city', 'Ort']] as const)
        add(!!metadata.buyer[field].trim(), 'BUYER_ADDRESS', `Leistungsempfänger: ${label} fehlt.`, `buyer.${field}`);
    add(/^[A-Z]{2}$/.test(metadata.buyerCountryCode), 'BUYER_COUNTRY', 'Das zweistellige Länderkürzel des Leistungsempfängers fehlt.', 'buyerCountryCode');
    const buyerCountry = knownOfficeEInvoiceCountryCode(metadata.buyer.country);
    if (buyerCountry)
        add(buyerCountry === metadata.buyerCountryCode, 'BUYER_COUNTRY_MISMATCH', 'Ländername und Länderkürzel des Leistungsempfängers widersprechen sich.', 'buyerCountryCode');
    add(/^[A-Z]{2}$/.test(metadata.sellerCountryCode), 'SELLER_COUNTRY', 'Das zweistellige Länderkürzel des Ausstellers fehlt.', 'sellerCountryCode');
    add(!!metadata.buyerReference.trim(), 'BUYER_REFERENCE', 'Die vom Empfänger vorgegebene Käuferreferenz oder Leitweg-ID fehlt.', 'buyerReference');
    for (const [field, label] of [['buyerEndpoint', 'Leistungsempfänger'], ['sellerEndpoint', 'Aussteller']] as const) {
        const endpoint = metadata[field];
        add(!!endpoint.value.trim(), 'ENDPOINT_VALUE', `${label}: Die elektronische Adresse fehlt.`, `${field}.value`);
        add(/^(?:EM|\d{4})$/.test(endpoint.schemeId), 'ENDPOINT_SCHEME', `${label}: Die Kennzeichnung der elektronischen Adresse fehlt oder ist ungültig.`, `${field}.schemeId`);
        if (endpoint.schemeId === 'EM')
            add(email(endpoint.value), 'ENDPOINT_EMAIL', `${label}: Die elektronische E-Mail-Adresse ist ungültig.`, `${field}.value`);
    }
    add(!!metadata.sellerContact.name.trim(), 'SELLER_CONTACT', 'Der Ansprechpartner beim Aussteller fehlt.', 'sellerContact.name');
    add(!!metadata.sellerContact.phone.trim(), 'SELLER_PHONE', 'Die Telefonnummer des Ansprechpartners fehlt.', 'sellerContact.phone');
    add(email(metadata.sellerContact.email), 'SELLER_EMAIL', 'Die E-Mail-Adresse des Ansprechpartners fehlt oder ist ungültig.', 'sellerContact.email');
    add(lines.length > 0 && lines.length <= 500, 'LINE_COUNT', 'Die Rechnung benötigt zwischen einer und 500 Positionen.', 'lines');
    for (const [index, line] of lines.entries()) {
        const tax = line.eInvoiceTax, prefix = `Position ${index + 1}`;
        add(!!tax?.category, 'TAX_CATEGORY', `${prefix}: Die Steuerkategorie fehlt.`, `lines.${index}.eInvoiceTax.category`);
        add(!!tax?.unitCode && OFFICE_EINVOICE_UNITS.some(unit => unit.code === tax.unitCode), 'UNIT_CODE', `${prefix}: Eine unterstützte strukturierte Einheit auswählen.`, `lines.${index}.eInvoiceTax.unitCode`);
        if (!tax?.category)
            continue;
        const expectedUnit = officeEInvoiceUnitForLabel(line.unit);
        if (expectedUnit)
            add(tax.unitCode === expectedUnit, 'UNIT_MISMATCH', `${prefix}: Die strukturierte Einheit stimmt nicht mit der Einheit der Rechnung überein.`, `lines.${index}.eInvoiceTax.unitCode`);
        add(tax.legalBasis !== 'unknown', 'LEGAL_BASIS', `${prefix}: Die steuerliche Einordnung ist noch offen.`, `lines.${index}.eInvoiceTax.legalBasis`);
        add(tax.category === 'S' ? line.taxRatePercent > 0 : line.taxRatePercent === 0, 'TAX_RATE_CATEGORY', `${prefix}: Steuersatz und Steuerkategorie widersprechen sich.`, `lines.${index}.taxRatePercent`);
        if (tax.category === 'E' || tax.category === 'AE' || tax.category === 'O') {
            add(!!tax.exemptionReason.trim() || !!tax.exemptionReasonCode.trim(), 'TAX_EXEMPTION', `${prefix}: Die Begründung oder der Befreiungscode fehlt.`, `lines.${index}.eInvoiceTax.exemptionReason`);
            add(tax.legalBasis !== 'none', 'TAX_EXEMPTION_BASIS', `${prefix}: Die Rechtsgrundlage der abweichenden Steuerbehandlung fehlt.`, `lines.${index}.eInvoiceTax.legalBasis`);
        }
        else {
            add(!tax.exemptionReason.trim() && !tax.exemptionReasonCode.trim(), 'TAX_REASON_NOT_ALLOWED', `${prefix}: Für diese Steuerkategorie darf kein Befreiungsgrund eingetragen sein.`, `lines.${index}.eInvoiceTax.exemptionReason`);
            add(tax.legalBasis === 'none', 'TAX_BASIS_CONTRADICTION', `${prefix}: Die ausgewählte Steuerbefreiung passt nicht zur Steuerkategorie.`, `lines.${index}.eInvoiceTax.legalBasis`);
        }
        if (tax.legalBasis === 'ustg_4_8_29' || tax.legalBasis === 'ustg_19')
            add(tax.category === 'E', 'TAX_EXEMPTION_CATEGORY', `${prefix}: Die bestätigte Steuerbefreiung benötigt Kategorie E.`, `lines.${index}.eInvoiceTax.category`);
        if (tax.legalBasis === 'ustg_19')
            add(metadata.legal.sellerSmallBusiness === 'yes', 'SMALL_BUSINESS_CONTRADICTION', `${prefix}: Die Kleinunternehmerregelung wurde für den Aussteller nicht bestätigt.`, 'legal.sellerSmallBusiness');
        if (tax.exemptionReasonCode)
            add(/^VATEX-[A-Z0-9-]+$/.test(tax.exemptionReasonCode), 'EXEMPTION_CODE', `${prefix}: Der Befreiungscode muss aus der VATEX-Codeliste stammen.`, `lines.${index}.eInvoiceTax.exemptionReasonCode`);
    }
    if (lines.some(line => line.eInvoiceTax?.category === 'O'))
        add(lines.every(line => line.eInvoiceTax?.category === 'O'), 'OUTSIDE_SCOPE_MIX', 'Nicht steuerbare Positionen der Kategorie O dürfen in dieser Ausgabe nicht mit anderen Steuerkategorien kombiniert werden.', 'lines');
    if (lines.some(line => line.eInvoiceTax?.category === 'AE'))
        add(!!metadata.buyerVatId.trim() || !!metadata.buyerLegalRegistrationId.trim(), 'REVERSE_CHARGE_BUYER_ID', 'Für Reverse Charge fehlt die Umsatzsteuer-ID oder rechtliche Kennung des Leistungsempfängers.', 'buyerVatId');
    const strings = (value: unknown): string[] => typeof value === 'string' ? [value] : Array.isArray(value) ? value.flatMap(strings) : value && typeof value === 'object' ? Object.values(value).flatMap(strings) : [];
    add(strings(metadata).every(value => value.length <= 1000), 'METADATA_LENGTH', 'Ein E-Rechnungsfeld überschreitet 1.000 Zeichen.');
    add(lines.every(line => !line.eInvoiceTax || strings(line.eInvoiceTax).every(value => value.length <= 1000)), 'TAX_LENGTH', 'Ein Steuerfeld überschreitet 1.000 Zeichen.');
    return findings;
}
/** Recognized existing labels must agree with the explicitly chosen structured unit. */
export function officeEInvoiceUnitForLabel(value: string): string | null {
    const label = value.trim().toLowerCase().replace(/[.]/g, '');
    const labels: Record<string, string> = { hour: 'HUR', hours: 'HUR', h: 'HUR', std: 'HUR', stunde: 'HUR', stunden: 'HUR', minute: 'MIN', minutes: 'MIN', min: 'MIN', minuten: 'MIN',
        visit: 'C62', flat: 'C62', piece: 'C62', pieces: 'C62', stück: 'C62', stueck: 'C62', stk: 'C62', leistung: 'C62', leistungen: 'C62', einheit: 'C62', pauschale: 'C62', einsatz: 'C62', besuch: 'C62',
        km: 'KMT', kilometer: 'KMT', day: 'DAY', days: 'DAY', tag: 'DAY', tage: 'DAY', week: 'WEE', weeks: 'WEE', woche: 'WEE', wochen: 'WEE', month: 'MON', months: 'MON', monat: 'MON', monate: 'MON', year: 'ANN', years: 'ANN', jahr: 'ANN', jahre: 'ANN' };
    return labels[label] || null;
}
/** Resolve only recognized explicit values; an unknown country never becomes Germany. */
export function knownOfficeEInvoiceCountryCode(value: string): string | null {
    const country = value.trim().toLowerCase();
    if (/^[a-z]{2}$/.test(country))
        return country.toUpperCase();
    return ({ deutschland: 'DE', germany: 'DE', österreich: 'AT', oesterreich: 'AT', austria: 'AT', schweiz: 'CH', switzerland: 'CH', suisse: 'CH', svizzera: 'CH' } as Record<string, string>)[country] || null;
}
