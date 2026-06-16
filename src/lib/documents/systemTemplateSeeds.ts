import type { TemplateRequiredFieldInput } from '@/features/documents/templateEngine/types';
import type {
  SystemDocumentCategory,
  SystemDocumentTemplate,
  SystemDocumentTemplateStatus,
  SystemTemplateExampleContext,
} from '@/types/documents/systemDocumentTemplate';
import type { DocumentTemplateTypeKey } from '@/features/documents/templateEngine/types';

export const STANDARD_SYSTEM_TEMPLATE_CSS = `
.cs-document-root { font-family: 'Segoe UI', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
`.trim();

const HEADER = `<div class="cs-block-logo">{{company.name}}</div>
<div class="cs-sender-line">{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</div>`;

const RECIPIENT = `<div class="cs-address-field">
<p>{{recipient.full_name}}</p>
<p>{{recipient.address}}</p>
<p>Kundennummer: {{client.customer_number}}</p>
</div>`;

const INVOICE_INFO = `<div class="cs-block-info">
<p>Rechnungsnummer: {{invoice.number}}</p>
<p>Rechnungsdatum: {{invoice.date}}</p>
<p>Leistungszeitraum: {{invoice.service_period}}</p>
<p>Fällig: {{invoice.due_date}}</p>
</div>`;

const INVOICE_TABLE = `<table class="cs-block-table">
<thead><tr><th>Pos.</th><th>Leistung</th><th>Netto</th><th>Brutto</th></tr></thead>
<tbody><tr><td>1</td><td>Leistung gem. Vereinbarung</td><td>{{invoice.net_total}}</td><td>{{invoice.gross_total}}</td></tr></tbody>
</table>`;

const INVOICE_TOTALS = `<p>Netto: {{invoice.net_total}} · Steuer: {{invoice.tax_total}} · Brutto: {{invoice.gross_total}}</p>
<p>{{invoice.tax_notice}}</p>`;

const INVOICE_FOOTER = `<div class="cs-block-footer">
<p>Bank: {{company.bank_name}} · IBAN: {{company.iban}} · BIC: {{company.bic}}</p>
<p>Verwendungszweck: {{invoice.payment_reference}}</p>
<p>{{company.legal_name}} · Steuernr.: {{company.tax_id}} · IK: {{company.ik_number}}</p>
</div>`;

const SIGNATURE_BLOCK = `<div class="cs-signature-block">
<p>Ort, Datum: {{signature.date}}</p>
<p>Unterschrift: {{signature.name}}</p>
</div>`;

const LEGAL_NOTICE = `<p class="cs-legal-notice">Hinweis: Diese Vorlage ist nicht rechtlich geprüft.</p>`;

function req(fieldKey: string, label: string, errorMessage?: string): TemplateRequiredFieldInput {
  return { fieldKey, label, dataPath: fieldKey, isRequired: true, errorMessage };
}

export function buildStandardExampleContext(): SystemTemplateExampleContext {
  return {
    company: {
      name: 'CareSuite Demo Pflegedienst GmbH',
      legal_name: 'CareSuite Demo Pflegedienst GmbH',
      street: 'Musterstraße 1',
      zip: '10115',
      city: 'Berlin',
      phone: '+49 30 123456',
      email: 'info@demo-pflege.de',
      tax_id: '27/123/45678',
      vat_id: 'DE123456789',
      register_court: 'Amtsgericht Berlin',
      register_number: 'HRB 123456',
      bank_name: 'Sparkasse Berlin',
      iban: 'DE89370400440532013000',
      bic: 'COBADEFFXXX',
      ik_number: '123456789',
      managing_director: 'Max Mustermann',
    },
    client: {
      customer_number: 'K-10042',
      full_name: 'Helga Schneider',
      salutation: 'Frau',
      birth_date: '15.03.1948',
      street: 'Beispielweg 5',
      zip: '10115',
      city: 'Berlin',
      phone: '+49 30 987654',
      care_level: 'PG 2',
    },
    representative: {
      full_name: 'Maria Schneider',
      role: 'Tochter / gesetzl. Betreuerin',
      street: 'Nebenstraße 2',
      zip: '10115',
      city: 'Berlin',
    },
    cost_carrier: {
      name: 'AOK Nordost',
      department: 'Pflegekasse',
      street: 'Kassenstraße 1',
      zip: '10557',
      city: 'Berlin',
      ik_number: '109999999',
    },
    recipient: {
      full_name: 'Helga Schneider',
      address: 'Beispielweg 5, 10115 Berlin',
    },
    invoice: {
      number: 'RE-2026-0042',
      date: '15.06.2026',
      due_date: '29.06.2026',
      service_period: '01.06.–15.06.2026',
      net_total: '323,11',
      tax_total: '61,39',
      gross_total: '384,50',
      payment_reference: 'RE-2026-0042',
      tax_notice: 'Gemäß §19 UStG wird keine Umsatzsteuer ausgewiesen.',
      line_items: '[{"description":"Grundpflege","amount":"384,50"}]',
    },
    visit: {
      date: '15.06.2026',
      start_time: '09:00',
      end_time: '10:30',
      duration: '90 Min.',
      service_type: 'Grundpflege',
      employee_name: 'Anna Pflege',
      documentation: 'Grundpflege durchgeführt, Klient:in wach und orientiert.',
      budget_reference: 'SGB XI — Entlastungsleistung',
    },
    contract: {
      number: 'V-2026-001',
      date: '01.01.2026',
      party_a: 'CareSuite Demo Pflegedienst GmbH',
      party_b: 'Helga Schneider',
      start_date: '01.01.2026',
      end_date: '31.12.2026',
      hourly_rate: '38,00',
      notice_period: '4 Wochen zum Monatsende',
      service_description: 'Ambulante Pflege nach vereinbarter Leistung',
      privacy_clause: 'Verarbeitung personenbezogener Daten gemäß DSGVO.',
    },
    signature: {
      name: 'Helga Schneider',
      date: '15.06.2026',
      time: '10:35',
      device: 'CareSuite App',
    },
    document: {
      title: 'Pflegedokumentation',
      content: 'Klient:in wirkte wach und orientiert. Körperpflege durchgeführt.',
      created_at: '15.06.2026 10:00',
      created_by: 'Anna Pflege',
      version: '1',
    },
    page: { number: '1', total: '1' },
  };
}

type TemplateSeedInput = {
  id: string;
  templateName: string;
  templateType: DocumentTemplateTypeKey;
  documentCategory: SystemDocumentCategory;
  templateStatus: SystemDocumentTemplateStatus;
  htmlTemplate: string;
  requiredFields: TemplateRequiredFieldInput[];
  exampleContext?: Partial<SystemTemplateExampleContext>;
};

function buildTemplate(input: TemplateSeedInput): SystemDocumentTemplate {
  const baseContext = buildStandardExampleContext();
  const exampleContext: SystemTemplateExampleContext = {
    ...baseContext,
    ...input.exampleContext,
    company: { ...baseContext.company, ...input.exampleContext?.company },
    client: { ...baseContext.client, ...input.exampleContext?.client },
    representative: { ...baseContext.representative, ...input.exampleContext?.representative },
    cost_carrier: { ...baseContext.cost_carrier, ...input.exampleContext?.cost_carrier },
    recipient: { ...baseContext.recipient, ...input.exampleContext?.recipient },
    invoice: { ...baseContext.invoice, ...input.exampleContext?.invoice },
    visit: { ...baseContext.visit, ...input.exampleContext?.visit },
    contract: { ...baseContext.contract, ...input.exampleContext?.contract },
    signature: { ...baseContext.signature, ...input.exampleContext?.signature },
    document: { ...baseContext.document, ...input.exampleContext?.document },
    page: { ...baseContext.page, ...input.exampleContext?.page },
  };

  return {
    id: input.id,
    templateName: input.templateName,
    templateType: input.templateType,
    documentCategory: input.documentCategory,
    templateStatus: input.templateStatus,
    htmlTemplate: input.htmlTemplate,
    cssTemplate: STANDARD_SYSTEM_TEMPLATE_CSS,
    placeholderSchema: {},
    requiredFields: input.requiredFields,
    layoutSettings: { maxWidth: '210mm', margin: '20mm' },
    headerSettings: { showLogo: true, showSenderLine: true },
    footerSettings: { showPageNumbers: true },
    signatureSettings: { showSignatureBlock: true },
    exampleContext,
    validationRules: { disallowAutoFinalize: true, requiresManualReview: true },
    isSystemTemplate: true,
  };
}

export const SYSTEM_TEMPLATE_SEEDS: SystemDocumentTemplate[] = [
  buildTemplate({
    id: 'sys-dtpl-001',
    templateName: 'Rechnung Standard',
    templateType: 'invoice',
    documentCategory: 'billing',
    templateStatus: 'active',
    htmlTemplate: `${HEADER}${RECIPIENT}${INVOICE_INFO}<h1>Rechnung {{invoice.number}}</h1>${INVOICE_TABLE}${INVOICE_TOTALS}${INVOICE_FOOTER}${LEGAL_NOTICE}`,
    requiredFields: [
      req('invoice.number', 'Rechnungsnummer'),
      req('invoice.date', 'Rechnungsdatum'),
      req('recipient.full_name', 'Empfänger'),
      req('invoice.gross_total', 'Bruttosumme'),
      req('company.iban', 'IBAN'),
    ],
  }),
  buildTemplate({
    id: 'sys-dtpl-002',
    templateName: 'Rechnung steuerfrei § 4 Nr. 16 UStG',
    templateType: 'invoice',
    documentCategory: 'billing',
    templateStatus: 'active',
    htmlTemplate: `${HEADER}${RECIPIENT}${INVOICE_INFO}<h1>Rechnung {{invoice.number}}</h1><p>Steuerfreie Leistung gemäß § 4 Nr. 16 UStG.</p>${INVOICE_TABLE}${INVOICE_TOTALS}${INVOICE_FOOTER}${LEGAL_NOTICE}`,
    requiredFields: [
      req('invoice.number', 'Rechnungsnummer'),
      req('invoice.tax_notice', 'Steuerhinweis'),
      req('recipient.full_name', 'Empfänger'),
      req('invoice.gross_total', 'Bruttosumme'),
    ],
    exampleContext: {
      invoice: {
        tax_notice: 'Steuerfreie Leistung gemäß § 4 Nr. 16 UStG — Umsatzsteuer wird nicht ausgewiesen.',
        tax_total: '0,00',
      },
    },
  }),
  buildTemplate({
    id: 'sys-dtpl-003',
    templateName: 'Selbstzahlerrechnung 19 %',
    templateType: 'invoice',
    documentCategory: 'billing',
    templateStatus: 'active',
    htmlTemplate: `${HEADER}${RECIPIENT}${INVOICE_INFO}<h1>Selbstzahlerrechnung {{invoice.number}}</h1><p>Umsatzsteuer 19 %.</p>${INVOICE_TABLE}${INVOICE_TOTALS}${INVOICE_FOOTER}${LEGAL_NOTICE}`,
    requiredFields: [
      req('invoice.number', 'Rechnungsnummer'),
      req('invoice.tax_total', 'Steuerbetrag'),
      req('invoice.gross_total', 'Bruttosumme'),
      req('recipient.full_name', 'Empfänger'),
    ],
    exampleContext: {
      invoice: {
        tax_notice: 'Es wird Umsatzsteuer in Höhe von 19 % ausgewiesen.',
        tax_total: '61,39',
      },
    },
  }),
  buildTemplate({
    id: 'sys-dtpl-004',
    templateName: 'Stornorechnung',
    templateType: 'cancellation_invoice',
    documentCategory: 'billing',
    templateStatus: 'active',
    htmlTemplate: `${HEADER}${RECIPIENT}<div class="cs-block-info"><p>Stornonummer: {{invoice.number}}</p><p>Datum: {{invoice.date}}</p><p>Bezug: {{invoice.payment_reference}}</p></div><h1>Stornorechnung {{invoice.number}}</h1><p>Hiermit wird die Rechnung {{invoice.payment_reference}} storniert.</p><p>Betrag: {{invoice.gross_total}}</p>${INVOICE_FOOTER}${LEGAL_NOTICE}`,
    requiredFields: [
      req('invoice.number', 'Stornonummer'),
      req('invoice.date', 'Datum'),
      req('invoice.payment_reference', 'Bezugsrechnung'),
      req('invoice.gross_total', 'Betrag'),
    ],
    exampleContext: {
      invoice: { number: 'ST-2026-0003', payment_reference: 'RE-2026-0042' },
    },
  }),
  buildTemplate({
    id: 'sys-dtpl-005',
    templateName: 'Korrekturrechnung',
    templateType: 'credit_note',
    documentCategory: 'billing',
    templateStatus: 'active',
    htmlTemplate: `${HEADER}${RECIPIENT}<div class="cs-block-info"><p>Korrektur-Nr.: {{invoice.number}}</p><p>Datum: {{invoice.date}}</p></div><h1>Korrekturrechnung {{invoice.number}}</h1><p>Korrektur zur Rechnung {{invoice.payment_reference}}.</p><p>Korrekturbetrag: {{invoice.gross_total}}</p>${LEGAL_NOTICE}`,
    requiredFields: [
      req('invoice.number', 'Korrekturnummer'),
      req('invoice.date', 'Datum'),
      req('invoice.gross_total', 'Korrekturbetrag'),
    ],
    exampleContext: {
      invoice: { number: 'KO-2026-0001', gross_total: '-50,00' },
    },
  }),
  buildTemplate({
    id: 'sys-dtpl-006',
    templateName: 'Angebot',
    templateType: 'offer',
    documentCategory: 'billing',
    templateStatus: 'active',
    htmlTemplate: `${HEADER}${RECIPIENT}<div class="cs-block-info"><p>Angebotsdatum: {{invoice.date}}</p><p>Gültig bis: {{invoice.due_date}}</p></div><h1>Angebot für {{client.full_name}}</h1><p>Leistung: {{contract.service_description}}</p><p>Stundensatz: {{contract.hourly_rate}} EUR</p><p>Gesamtbetrag (geschätzt): {{invoice.gross_total}}</p>${SIGNATURE_BLOCK}${LEGAL_NOTICE}`,
    requiredFields: [
      req('client.full_name', 'Klient:in'),
      req('contract.service_description', 'Leistungsbeschreibung'),
      req('contract.hourly_rate', 'Stundensatz'),
      req('invoice.date', 'Angebotsdatum'),
    ],
  }),
  buildTemplate({
    id: 'sys-dtpl-007',
    templateName: 'Kundenvertrag Alltagsbegleitung',
    templateType: 'contract',
    documentCategory: 'contracts',
    templateStatus: 'active',
    htmlTemplate: `${HEADER}<h1>Kundenvertrag Alltagsbegleitung</h1><p>Vertragsnummer: {{contract.number}}</p><p>zwischen {{contract.party_a}} und {{contract.party_b}}</p><div class="cs-block-info"><p>Beginn: {{contract.start_date}}</p><p>Ende: {{contract.end_date}}</p><p>Stundensatz: {{contract.hourly_rate}} EUR</p><p>Kündigungsfrist: {{contract.notice_period}}</p></div><h2>Leistungsbeschreibung</h2><p>{{contract.service_description}}</p><h2>Datenschutz</h2><p>{{contract.privacy_clause}}</p>${SIGNATURE_BLOCK}${LEGAL_NOTICE}`,
    requiredFields: [
      req('contract.party_a', 'Vertragspartei A'),
      req('contract.party_b', 'Vertragspartei B'),
      req('contract.start_date', 'Vertragsbeginn'),
      req('contract.service_description', 'Leistungsbeschreibung'),
      req('contract.hourly_rate', 'Stundensatz'),
      req('contract.notice_period', 'Kündigungsfrist'),
    ],
    exampleContext: {
      contract: {
        service_description: 'Alltagsbegleitung und haushaltsnahe Unterstützung nach Vereinbarung.',
      },
    },
  }),
  buildTemplate({
    id: 'sys-dtpl-008',
    templateName: 'Abtretungserklärung',
    templateType: 'generic',
    documentCategory: 'legal',
    templateStatus: 'draft',
    htmlTemplate: `${HEADER}<h1>Abtretungserklärung</h1><p>Ich, {{client.full_name}}, geb. {{client.birth_date}}, wohne in {{client.street}}, {{client.zip}} {{client.city}}.</p><p>trete hiermit Ansprüche gegenüber {{cost_carrier.name}} (IK: {{cost_carrier.ik_number}}) an {{company.legal_name}} ab.</p><p>Vertretung: {{representative.full_name}} ({{representative.role}})</p>${SIGNATURE_BLOCK}${LEGAL_NOTICE}`,
    requiredFields: [
      req('client.full_name', 'Klient:in'),
      req('cost_carrier.name', 'Kostenträger'),
      req('company.legal_name', 'Abtretungsempfänger'),
    ],
  }),
  buildTemplate({
    id: 'sys-dtpl-009',
    templateName: 'Datenschutz-Einwilligung',
    templateType: 'generic',
    documentCategory: 'legal',
    templateStatus: 'draft',
    htmlTemplate: `${HEADER}<h1>Einwilligung zur Datenverarbeitung</h1><p>{{client.salutation}} {{client.full_name}}</p><p>Ich willige ein, dass {{company.legal_name}} meine personenbezogenen Daten zum Zweck der Pflege- und Betreuungsleistung verarbeitet.</p><p>{{contract.privacy_clause}}</p>${SIGNATURE_BLOCK}${LEGAL_NOTICE}`,
    requiredFields: [
      req('client.full_name', 'Klient:in'),
      req('company.legal_name', 'Verantwortliche Stelle'),
      req('contract.privacy_clause', 'Datenschutzhinweis'),
    ],
  }),
  buildTemplate({
    id: 'sys-dtpl-010',
    templateName: 'Schweigepflichtentbindung',
    templateType: 'generic',
    documentCategory: 'legal',
    templateStatus: 'draft',
    htmlTemplate: `${HEADER}<h1>Schweigepflichtentbindung</h1><p>{{client.full_name}} entbindet {{company.legal_name}} von der Schweigepflicht gegenüber:</p><p>{{representative.full_name}} — {{representative.role}}</p><p>Anschrift: {{representative.street}}, {{representative.zip}} {{representative.city}}</p>${SIGNATURE_BLOCK}${LEGAL_NOTICE}`,
    requiredFields: [
      req('client.full_name', 'Klient:in'),
      req('representative.full_name', 'Entbindungsempfänger'),
      req('company.legal_name', 'Pflegedienst'),
    ],
  }),
  buildTemplate({
    id: 'sys-dtpl-011',
    templateName: 'Leistungsnachweis Einzeleinsatz',
    templateType: 'service_record',
    documentCategory: 'care',
    templateStatus: 'active',
    htmlTemplate: `${HEADER}<h1>Leistungsnachweis Einzeleinsatz</h1><div class="cs-block-info"><p>Klient:in: {{client.full_name}}</p><p>Datum: {{visit.date}}</p><p>Zeit: {{visit.start_time}} – {{visit.end_time}} ({{visit.duration}})</p><p>Mitarbeitende:r: {{visit.employee_name}}</p><p>Leistung: {{visit.service_type}}</p><p>Budget: {{visit.budget_reference}}</p></div><h2>Dokumentation</h2><p>{{visit.documentation}}</p>${SIGNATURE_BLOCK}${LEGAL_NOTICE}`,
    requiredFields: [
      req('client.full_name', 'Klient:in'),
      req('visit.date', 'Einsatzdatum'),
      req('visit.start_time', 'Beginn'),
      req('visit.end_time', 'Ende'),
      req('visit.employee_name', 'Mitarbeitende:r'),
      req('visit.service_type', 'Leistungsart'),
    ],
  }),
  buildTemplate({
    id: 'sys-dtpl-012',
    templateName: 'Leistungsnachweis Monat',
    templateType: 'service_record',
    documentCategory: 'care',
    templateStatus: 'active',
    htmlTemplate: `${HEADER}<h1>Leistungsnachweis Monat</h1><p>Klient:in: {{client.full_name}} · Kundennr.: {{client.customer_number}}</p><p>Leistungszeitraum: {{invoice.service_period}}</p><p>Kostenträger: {{cost_carrier.name}} (IK {{cost_carrier.ik_number}})</p><div class="cs-block-info"><p>Gesamtdauer: {{visit.duration}}</p><p>Leistungsart: {{visit.service_type}}</p><p>Budget: {{visit.budget_reference}}</p></div><p>{{visit.documentation}}</p>${SIGNATURE_BLOCK}${LEGAL_NOTICE}`,
    requiredFields: [
      req('client.full_name', 'Klient:in'),
      req('invoice.service_period', 'Leistungszeitraum'),
      req('visit.duration', 'Gesamtdauer'),
      req('visit.service_type', 'Leistungsart'),
      req('cost_carrier.name', 'Kostenträger'),
    ],
  }),
  buildTemplate({
    id: 'sys-dtpl-013',
    templateName: 'Einsatzdokumentation',
    templateType: 'care_documentation',
    documentCategory: 'care',
    templateStatus: 'active',
    htmlTemplate: `${HEADER}<h1>{{document.title}}</h1><div class="cs-block-info"><p>Klient:in: {{client.full_name}}</p><p>Datum: {{visit.date}}</p><p>Uhrzeit: {{visit.start_time}} – {{visit.end_time}}</p><p>Mitarbeitende:r: {{visit.employee_name}}</p></div><h2>Dokumentation</h2><p>{{document.content}}</p><p>{{visit.documentation}}</p><p>Erstellt: {{document.created_at}} von {{document.created_by}}</p>${LEGAL_NOTICE}`,
    requiredFields: [
      req('client.full_name', 'Klient:in'),
      req('visit.date', 'Datum'),
      req('document.content', 'Dokumentationstext'),
      req('visit.employee_name', 'Mitarbeitende:r'),
    ],
  }),
  buildTemplate({
    id: 'sys-dtpl-014',
    templateName: 'Erstaufnahmebogen',
    templateType: 'generic',
    documentCategory: 'care',
    templateStatus: 'draft',
    htmlTemplate: `${HEADER}<h1>Erstaufnahmebogen</h1><h2>Stammdaten</h2><p>Name: {{client.full_name}}</p><p>Geburtsdatum: {{client.birth_date}}</p><p>Adresse: {{client.street}}, {{client.zip}} {{client.city}}</p><p>Telefon: {{client.phone}}</p><p>Pflegegrad: {{client.care_level}}</p><h2>Vertretung</h2><p>{{representative.full_name}} — {{representative.role}}</p><h2>Anmerkungen</h2><p>{{document.content}}</p>${SIGNATURE_BLOCK}${LEGAL_NOTICE}`,
    requiredFields: [
      req('client.full_name', 'Klient:in'),
      req('client.birth_date', 'Geburtsdatum'),
      req('client.street', 'Straße'),
      req('client.care_level', 'Pflegegrad'),
    ],
    exampleContext: {
      document: { content: 'Erstgespräch geführt, Pflegebedarf erhoben.' },
    },
  }),
  buildTemplate({
    id: 'sys-dtpl-015',
    templateName: 'Beratungsprotokoll',
    templateType: 'generic',
    documentCategory: 'care',
    templateStatus: 'draft',
    htmlTemplate: `${HEADER}<h1>Beratungsprotokoll</h1><p>Datum: {{visit.date}}</p><p>Klient:in: {{client.full_name}}</p><p>Beratung durch: {{visit.employee_name}}</p><h2>Inhalt</h2><p>{{document.content}}</p>${SIGNATURE_BLOCK}${LEGAL_NOTICE}`,
    requiredFields: [
      req('visit.date', 'Datum'),
      req('client.full_name', 'Klient:in'),
      req('document.content', 'Beratungsinhalt'),
    ],
    exampleContext: {
      document: { content: 'Beratung zu Entlastungsleistungen und Pflegegrad.' },
    },
  }),
  buildTemplate({
    id: 'sys-dtpl-016',
    templateName: 'Notfallprotokoll',
    templateType: 'generic',
    documentCategory: 'care',
    templateStatus: 'draft',
    htmlTemplate: `${HEADER}<h1>Notfallprotokoll</h1><div class="cs-block-info"><p>Datum/Uhrzeit: {{visit.date}} {{visit.start_time}}</p><p>Klient:in: {{client.full_name}}</p><p>Mitarbeitende:r: {{visit.employee_name}}</p></div><h2>Sachverhalt</h2><p>{{document.content}}</p><h2>Maßnahmen</h2><p>{{visit.documentation}}</p>${SIGNATURE_BLOCK}${LEGAL_NOTICE}`,
    requiredFields: [
      req('visit.date', 'Datum'),
      req('client.full_name', 'Klient:in'),
      req('document.content', 'Sachverhalt'),
      req('visit.documentation', 'Maßnahmen'),
    ],
    exampleContext: {
      document: { content: 'Sturz im Wohnzimmer festgestellt.' },
      visit: { documentation: 'Erste Hilfe geleistet, Arzt informiert.' },
    },
  }),
  buildTemplate({
    id: 'sys-dtpl-017',
    templateName: 'Beschwerdeprotokoll',
    templateType: 'generic',
    documentCategory: 'communication',
    templateStatus: 'draft',
    htmlTemplate: `${HEADER}<h1>Beschwerdeprotokoll</h1><p>Datum: {{document.created_at}}</p><p>Eingang von: {{client.full_name}}</p><p>Bearbeitung: {{document.created_by}}</p><h2>Beschwerde</h2><p>{{document.content}}</p><h2>Maßnahmen</h2><p>{{visit.documentation}}</p>${LEGAL_NOTICE}`,
    requiredFields: [
      req('client.full_name', 'Beschwerdeführer'),
      req('document.content', 'Beschwerdetext'),
      req('document.created_at', 'Eingangsdatum'),
    ],
    exampleContext: {
      document: {
        content: 'Terminverschiebung ohne vorherige Information.',
        created_at: '16.06.2026 14:30',
        created_by: 'Büro CareSuite',
      },
    },
  }),
  buildTemplate({
    id: 'sys-dtpl-018',
    templateName: 'Zahlungserinnerung',
    templateType: 'payment_reminder',
    documentCategory: 'billing',
    templateStatus: 'active',
    htmlTemplate: `${HEADER}${RECIPIENT}<h1>Zahlungserinnerung</h1><p>Rechnung {{invoice.number}} vom {{invoice.date}} über {{invoice.gross_total}} EUR ist noch offen.</p><p>Bitte überweisen Sie bis zum {{invoice.due_date}} unter Angabe des Verwendungszwecks {{invoice.payment_reference}}.</p><p>Bank: {{company.bank_name}} · IBAN: {{company.iban}}</p>${LEGAL_NOTICE}`,
    requiredFields: [
      req('invoice.number', 'Rechnungsnummer'),
      req('invoice.gross_total', 'Betrag'),
      req('recipient.full_name', 'Empfänger'),
    ],
  }),
  buildTemplate({
    id: 'sys-dtpl-019',
    templateName: '1. Mahnung',
    templateType: 'dunning_letter',
    documentCategory: 'billing',
    templateStatus: 'active',
    htmlTemplate: `${HEADER}${RECIPIENT}<h1>1. Mahnung</h1><p>Rechnung {{invoice.number}} vom {{invoice.date}} — offener Betrag: {{invoice.gross_total}} EUR.</p><p>Fällig seit: {{invoice.due_date}}. Bitte begleichen Sie den Betrag umgehend.</p><p>Verwendungszweck: {{invoice.payment_reference}}</p>${LEGAL_NOTICE}`,
    requiredFields: [
      req('invoice.number', 'Rechnungsnummer'),
      req('invoice.gross_total', 'Betrag'),
      req('invoice.due_date', 'Fälligkeitsdatum'),
      req('recipient.full_name', 'Empfänger'),
    ],
  }),
  buildTemplate({
    id: 'sys-dtpl-020',
    templateName: 'Letzte außergerichtliche Mahnung',
    templateType: 'dunning_letter',
    documentCategory: 'billing',
    templateStatus: 'active',
    htmlTemplate: `${HEADER}${RECIPIENT}<h1>Letzte außergerichtliche Mahnung</h1><p>Rechnung {{invoice.number}} — Betrag: {{invoice.gross_total}} EUR, fällig seit {{invoice.due_date}}.</p><p>Wir fordern Sie letztmalig auf, den Betrag innerhalb von 7 Tagen zu begleichen, andernfalls behalten wir uns weitere Schritte vor.</p>${LEGAL_NOTICE}`,
    requiredFields: [
      req('invoice.number', 'Rechnungsnummer'),
      req('invoice.gross_total', 'Betrag'),
      req('invoice.due_date', 'Fälligkeitsdatum'),
      req('recipient.full_name', 'Empfänger'),
    ],
  }),
  buildTemplate({
    id: 'sys-dtpl-021',
    templateName: 'Mitarbeiter-Arbeitsvertrag',
    templateType: 'contract',
    documentCategory: 'hr',
    templateStatus: 'draft',
    htmlTemplate: `${HEADER}<h1>Arbeitsvertrag</h1><p>zwischen {{company.legal_name}} ({{company.street}}, {{company.city}}) und {{visit.employee_name}}</p><div class="cs-block-info"><p>Beginn: {{contract.start_date}}</p><p>Vergütung: {{contract.hourly_rate}} EUR/Stunde</p><p>Kündigungsfrist: {{contract.notice_period}}</p></div><h2>Tätigkeitsbeschreibung</h2><p>{{contract.service_description}}</p>${SIGNATURE_BLOCK}${LEGAL_NOTICE}`,
    requiredFields: [
      req('company.legal_name', 'Arbeitgeber'),
      req('visit.employee_name', 'Mitarbeitende:r'),
      req('contract.start_date', 'Beginn'),
      req('contract.hourly_rate', 'Vergütung'),
    ],
    exampleContext: {
      contract: { service_description: 'Ambulante Pflegefachkraft — Tätigkeit nach Dienstanweisung.' },
    },
  }),
  buildTemplate({
    id: 'sys-dtpl-022',
    templateName: 'Kündigungsschreiben',
    templateType: 'business_letter',
    documentCategory: 'hr',
    templateStatus: 'draft',
    htmlTemplate: `${HEADER}<p>{{visit.employee_name}}</p><h1>Kündigung des Arbeitsverhältnisses</h1><p>hiermit kündigen wir das Arbeitsverhältnis zum {{contract.end_date}} unter Einhaltung der Kündigungsfrist {{contract.notice_period}}.</p><p>{{company.legal_name}}</p><p>{{company.managing_director}}</p>${LEGAL_NOTICE}`,
    requiredFields: [
      req('visit.employee_name', 'Mitarbeitende:r'),
      req('contract.end_date', 'Kündigungstermin'),
      req('contract.notice_period', 'Kündigungsfrist'),
      req('company.legal_name', 'Arbeitgeber'),
    ],
  }),
  buildTemplate({
    id: 'sys-dtpl-023',
    templateName: 'Abmahnung',
    templateType: 'business_letter',
    documentCategory: 'hr',
    templateStatus: 'draft',
    htmlTemplate: `${HEADER}<p>{{visit.employee_name}}</p><h1>Abmahnung</h1><p>Datum: {{document.created_at}}</p><p>wegen: {{document.content}}</p><p>Wir weisen Sie darauf hin, dass bei Wiederholung arbeitsrechtliche Konsequenzen drohen.</p><p>{{company.legal_name}}</p>${SIGNATURE_BLOCK}${LEGAL_NOTICE}`,
    requiredFields: [
      req('visit.employee_name', 'Mitarbeitende:r'),
      req('document.content', 'Abmahnungsgrund'),
      req('document.created_at', 'Datum'),
    ],
    exampleContext: {
      document: { content: 'Unentschuldigtes Fehlen am 10.06.2026.' },
    },
  }),
  buildTemplate({
    id: 'sys-dtpl-024',
    templateName: 'interne Dienstanweisung',
    templateType: 'generic',
    documentCategory: 'internal',
    templateStatus: 'draft',
    htmlTemplate: `${HEADER}<h1>Dienstanweisung</h1><p>{{document.title}}</p><p>Version {{document.version}} — {{document.created_at}}</p><p>Erstellt von: {{document.created_by}}</p><h2>Inhalt</h2><p>{{document.content}}</p><p>Gültig für: {{company.name}}</p>${LEGAL_NOTICE}`,
    requiredFields: [
      req('document.title', 'Titel'),
      req('document.content', 'Inhalt'),
      req('document.created_by', 'Erstellt von'),
    ],
    exampleContext: {
      document: {
        title: 'Hygiene bei Pflegeeinsätzen',
        content: 'Händedesinfektion vor und nach jedem Einsatz. PSA gemäß Hygieneplan tragen.',
      },
    },
  }),
  buildTemplate({
    id: 'sys-dtpl-025',
    templateName: 'Übergabeprotokoll Firmeneigentum',
    templateType: 'generic',
    documentCategory: 'internal',
    templateStatus: 'draft',
    htmlTemplate: `${HEADER}<h1>Übergabeprotokoll Firmeneigentum</h1><p>Mitarbeitende:r: {{visit.employee_name}}</p><p>Datum: {{visit.date}}</p><h2>Übergebenes Eigentum</h2><p>{{document.content}}</p><p>Empfangen von: {{signature.name}} am {{signature.date}}</p><p>{{company.name}} — {{company.managing_director}}</p>${SIGNATURE_BLOCK}${LEGAL_NOTICE}`,
    requiredFields: [
      req('visit.employee_name', 'Mitarbeitende:r'),
      req('visit.date', 'Übergabedatum'),
      req('document.content', 'Gegenstand'),
      req('signature.name', 'Empfangsbestätigung'),
    ],
    exampleContext: {
      document: { content: 'Dienstkleidung (2 Sets), Schlüssel Büro, Diensthandy IMEI …' },
    },
  }),
];

export const SYSTEM_TEMPLATE_IDS = SYSTEM_TEMPLATE_SEEDS.map((t) => t.id);
