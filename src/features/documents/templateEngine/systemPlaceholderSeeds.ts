import type { PlaceholderGroup, PlaceholderRegistryEntry } from './types';

type SeedInput = Omit<PlaceholderRegistryEntry, 'isSystem' | 'scope'> & {
  isSystem?: boolean;
};

function seed(input: SeedInput): PlaceholderRegistryEntry {
  return {
    ...input,
    isSystem: input.isSystem ?? true,
    scope: input.isSystem === false ? 'tenant' : 'system',
  };
}

/** Systemplatzhalter — zentrale Quelle, nicht im UI verstreut. */
export const SYSTEM_PLACEHOLDER_SEEDS: PlaceholderRegistryEntry[] = [
  // Unternehmen
  seed({ key: 'company.name', group: 'company', label: 'Firmenname', description: 'Anzeigename des Mandanten', exampleValue: 'CareSuite Pflegedienst GmbH', dataSource: 'tenant_document_settings / tenant', dataPath: 'company.name' }),
  seed({ key: 'company.legal_name', group: 'company', label: 'Rechtlicher Name', description: 'Vollständiger Firmenname', exampleValue: 'CareSuite Pflegedienst GmbH', dataSource: 'tenant', dataPath: 'company.legal_name' }),
  seed({ key: 'company.street', group: 'company', label: 'Straße', exampleValue: 'Musterstraße 1', dataSource: 'tenant', dataPath: 'company.street' }),
  seed({ key: 'company.zip', group: 'company', label: 'PLZ', exampleValue: '10115', dataSource: 'tenant', dataPath: 'company.zip' }),
  seed({ key: 'company.city', group: 'company', label: 'Ort', exampleValue: 'Berlin', dataSource: 'tenant', dataPath: 'company.city' }),
  seed({ key: 'company.phone', group: 'company', label: 'Telefon', exampleValue: '+49 30 123456', dataSource: 'tenant', dataPath: 'company.phone' }),
  seed({ key: 'company.fax', group: 'company', label: 'Fax', exampleValue: '+49 30 123457', dataSource: 'tenant', dataPath: 'company.fax' }),
  seed({ key: 'company.email', group: 'company', label: 'E-Mail', exampleValue: 'info@pflegedienst.de', dataSource: 'tenant', dataPath: 'company.email' }),
  seed({ key: 'company.website', group: 'company', label: 'Website', exampleValue: 'https://pflegedienst.de', dataSource: 'tenant', dataPath: 'company.website' }),
  seed({ key: 'company.register_court', group: 'company', label: 'Registergericht', exampleValue: 'Amtsgericht Berlin', dataSource: 'tenant', dataPath: 'company.register_court' }),
  seed({ key: 'company.register_number', group: 'company', label: 'Handelsregisternummer', exampleValue: 'HRB 123456', dataSource: 'tenant', dataPath: 'company.register_number' }),
  seed({ key: 'company.tax_id', group: 'company', label: 'Steuernummer', exampleValue: '27/123/45678', dataSource: 'tenant', dataPath: 'company.tax_id', isSensitive: true }),
  seed({ key: 'company.vat_id', group: 'company', label: 'USt-IdNr.', exampleValue: 'DE123456789', dataSource: 'tenant', dataPath: 'company.vat_id' }),
  seed({ key: 'company.ik_number', group: 'company', label: 'IK-Nummer', exampleValue: '123456789', dataSource: 'tenant_ik_profiles', dataPath: 'company.ik_number' }),
  seed({ key: 'company.managing_director', group: 'company', label: 'Geschäftsführung', exampleValue: 'Max Mustermann', dataSource: 'tenant', dataPath: 'company.managing_director' }),
  seed({ key: 'company.bank_name', group: 'company', label: 'Bank', exampleValue: 'Sparkasse Berlin', dataSource: 'tenant_document_settings', dataPath: 'company.bank_name' }),
  seed({ key: 'company.iban', group: 'company', label: 'IBAN', exampleValue: 'DE89370400440532013000', dataSource: 'tenant_document_settings', dataPath: 'company.iban', isSensitive: true }),
  seed({ key: 'company.bic', group: 'company', label: 'BIC', exampleValue: 'COBADEFFXXX', dataSource: 'tenant_document_settings', dataPath: 'company.bic' }),

  // Klient:in
  seed({ key: 'client.customer_number', group: 'client', label: 'Kundennummer', exampleValue: 'K-10042', dataSource: 'clients', dataPath: 'client.customer_number', isSensitive: true }),
  seed({ key: 'client.full_name', group: 'client', label: 'Name (vollständig)', exampleValue: 'Helga Schneider', dataSource: 'clients', dataPath: 'client.full_name', isSensitive: true }),
  seed({ key: 'client.salutation', group: 'client', label: 'Anrede', exampleValue: 'Frau', dataSource: 'clients', dataPath: 'client.salutation', isSensitive: true }),
  seed({ key: 'client.birth_date', group: 'client', label: 'Geburtsdatum', exampleValue: '15.03.1948', dataSource: 'clients', dataPath: 'client.birth_date', isSensitive: true }),
  seed({ key: 'client.street', group: 'client', label: 'Straße', exampleValue: 'Beispielweg 5', dataSource: 'clients', dataPath: 'client.street', isSensitive: true }),
  seed({ key: 'client.zip', group: 'client', label: 'PLZ', exampleValue: '10115', dataSource: 'clients', dataPath: 'client.zip', isSensitive: true }),
  seed({ key: 'client.city', group: 'client', label: 'Ort', exampleValue: 'Berlin', dataSource: 'clients', dataPath: 'client.city', isSensitive: true }),
  seed({ key: 'client.phone', group: 'client', label: 'Telefon', exampleValue: '+49 30 987654', dataSource: 'clients', dataPath: 'client.phone', isSensitive: true }),
  seed({ key: 'client.email', group: 'client', label: 'E-Mail', exampleValue: 'kontakt@example.de', dataSource: 'clients', dataPath: 'client.email', isSensitive: true }),
  seed({ key: 'client.care_level', group: 'client', label: 'Pflegegrad', exampleValue: 'PG 2', dataSource: 'clients', dataPath: 'client.care_level' }),

  // Vertretung
  seed({ key: 'representative.full_name', group: 'representative', label: 'Name Vertretung', exampleValue: 'Maria Schneider', dataSource: 'client_contacts', dataPath: 'representative.full_name', isSensitive: true }),
  seed({ key: 'representative.role', group: 'representative', label: 'Rolle', exampleValue: 'Tochter / gesetzl. Betreuerin', dataSource: 'client_contacts', dataPath: 'representative.role' }),
  seed({ key: 'representative.street', group: 'representative', label: 'Straße', exampleValue: 'Nebenstraße 2', dataSource: 'client_contacts', dataPath: 'representative.street', isSensitive: true }),
  seed({ key: 'representative.zip', group: 'representative', label: 'PLZ', exampleValue: '10115', dataSource: 'client_contacts', dataPath: 'representative.zip', isSensitive: true }),
  seed({ key: 'representative.city', group: 'representative', label: 'Ort', exampleValue: 'Berlin', dataSource: 'client_contacts', dataPath: 'representative.city', isSensitive: true }),

  // Kostenträger
  seed({ key: 'cost_carrier.name', group: 'cost_carrier', label: 'Kostenträger', exampleValue: 'AOK Nordost', dataSource: 'cost_carriers', dataPath: 'cost_carrier.name' }),
  seed({ key: 'cost_carrier.department', group: 'cost_carrier', label: 'Abteilung', exampleValue: 'Pflegekasse', dataSource: 'cost_carriers', dataPath: 'cost_carrier.department' }),
  seed({ key: 'cost_carrier.street', group: 'cost_carrier', label: 'Straße', exampleValue: 'Kassenstraße 1', dataSource: 'cost_carriers', dataPath: 'cost_carrier.street' }),
  seed({ key: 'cost_carrier.zip', group: 'cost_carrier', label: 'PLZ', exampleValue: '10557', dataSource: 'cost_carriers', dataPath: 'cost_carrier.zip' }),
  seed({ key: 'cost_carrier.city', group: 'cost_carrier', label: 'Ort', exampleValue: 'Berlin', dataSource: 'cost_carriers', dataPath: 'cost_carrier.city' }),
  seed({ key: 'cost_carrier.ik_number', group: 'cost_carrier', label: 'IK-Nummer', exampleValue: '109999999', dataSource: 'cost_carriers', dataPath: 'cost_carrier.ik_number' }),

  // Empfänger (Rechnung)
  seed({ key: 'recipient.full_name', group: 'recipient', label: 'Empfänger', exampleValue: 'Helga Schneider', dataSource: 'clients / cost_carriers', dataPath: 'recipient.full_name', isSensitive: true }),
  seed({ key: 'recipient.address', group: 'recipient', label: 'Empfängeradresse', exampleValue: 'Beispielweg 5, 10115 Berlin', dataSource: 'clients', dataPath: 'recipient.address', isSensitive: true }),

  // Rechnung
  seed({ key: 'invoice.number', group: 'invoice', label: 'Rechnungsnummer', exampleValue: 'RE-2026-0042', dataSource: 'invoices', dataPath: 'invoice.number' }),
  seed({ key: 'invoice.date', group: 'invoice', label: 'Rechnungsdatum', exampleValue: '15.06.2026', dataSource: 'invoices', dataPath: 'invoice.date' }),
  seed({ key: 'invoice.service_period', group: 'invoice', label: 'Leistungszeitraum', exampleValue: '01.06.–15.06.2026', dataSource: 'invoices', dataPath: 'invoice.service_period' }),
  seed({ key: 'invoice.due_date', group: 'invoice', label: 'Fälligkeitsdatum', exampleValue: '29.06.2026', dataSource: 'invoices', dataPath: 'invoice.due_date' }),
  seed({ key: 'invoice.net_total', group: 'invoice', label: 'Nettosumme', exampleValue: '323,11', dataSource: 'invoices', dataPath: 'invoice.net_total' }),
  seed({ key: 'invoice.tax_total', group: 'invoice', label: 'Steuerbetrag', exampleValue: '61,39', dataSource: 'invoices', dataPath: 'invoice.tax_total' }),
  seed({ key: 'invoice.gross_total', group: 'invoice', label: 'Bruttosumme', exampleValue: '384,50', dataSource: 'invoices', dataPath: 'invoice.gross_total' }),
  seed({ key: 'invoice.payment_reference', group: 'invoice', label: 'Verwendungszweck', exampleValue: 'RE-2026-0042', dataSource: 'invoices', dataPath: 'invoice.payment_reference' }),
  seed({ key: 'invoice.tax_notice', group: 'invoice', label: 'Steuerhinweis', exampleValue: 'Gemäß §19 UStG wird keine Umsatzsteuer ausgewiesen.', dataSource: 'tenant_document_settings', dataPath: 'invoice.tax_notice' }),
  seed({ key: 'invoice.line_items', group: 'invoice', label: 'Positionen (JSON)', description: 'Rechnungspositionen als strukturierte Daten', exampleValue: '[{...}]', dataSource: 'invoices', dataPath: 'invoice.line_items' }),

  // Einsatz / Leistungsnachweis
  seed({ key: 'visit.date', group: 'visit', label: 'Einsatzdatum', exampleValue: '15.06.2026', dataSource: 'assignments / service_records', dataPath: 'visit.date' }),
  seed({ key: 'visit.start_time', group: 'visit', label: 'Beginn', exampleValue: '09:00', dataSource: 'service_records', dataPath: 'visit.start_time' }),
  seed({ key: 'visit.end_time', group: 'visit', label: 'Ende', exampleValue: '10:30', dataSource: 'service_records', dataPath: 'visit.end_time' }),
  seed({ key: 'visit.duration', group: 'visit', label: 'Dauer', exampleValue: '90 Min.', dataSource: 'service_records', dataPath: 'visit.duration' }),
  seed({ key: 'visit.employee_name', group: 'visit', label: 'Mitarbeitende:r', exampleValue: 'Anna Pflege', dataSource: 'employees', dataPath: 'visit.employee_name' }),
  seed({ key: 'visit.documentation', group: 'visit', label: 'Einsatzdokumentation', exampleValue: 'Grundpflege durchgeführt.', dataSource: 'service_records', dataPath: 'visit.documentation' }),
  seed({ key: 'visit.service_type', group: 'visit', label: 'Leistungsart', exampleValue: 'Grundpflege', dataSource: 'service_records', dataPath: 'visit.service_type' }),
  seed({ key: 'visit.budget_reference', group: 'visit', label: 'Budgetzuordnung', exampleValue: 'SGB XI — Entlastungsleistung', dataSource: 'budget_transactions', dataPath: 'visit.budget_reference' }),

  // Vertrag
  seed({ key: 'contract.number', group: 'contract', label: 'Vertragsnummer', exampleValue: 'V-2026-001', dataSource: 'client_contracts', dataPath: 'contract.number' }),
  seed({ key: 'contract.date', group: 'contract', label: 'Vertragsdatum', exampleValue: '01.01.2026', dataSource: 'client_contracts', dataPath: 'contract.date' }),
  seed({ key: 'contract.start_date', group: 'contract', label: 'Vertragsbeginn', exampleValue: '01.01.2026', dataSource: 'client_contracts', dataPath: 'contract.start_date' }),
  seed({ key: 'contract.end_date', group: 'contract', label: 'Vertragsende', exampleValue: '31.12.2026', dataSource: 'client_contracts', dataPath: 'contract.end_date' }),
  seed({ key: 'contract.hourly_rate', group: 'contract', label: 'Stundensatz', exampleValue: '38,00', dataSource: 'client_contracts', dataPath: 'contract.hourly_rate' }),
  seed({ key: 'contract.notice_period', group: 'contract', label: 'Kündigungsfrist', exampleValue: '4 Wochen zum Monatsende', dataSource: 'client_contracts', dataPath: 'contract.notice_period' }),
  seed({ key: 'contract.party_a', group: 'contract', label: 'Vertragspartei A', exampleValue: 'CareSuite Pflegedienst GmbH', dataSource: 'tenant', dataPath: 'contract.party_a' }),
  seed({ key: 'contract.party_b', group: 'contract', label: 'Vertragspartei B', exampleValue: 'Helga Schneider', dataSource: 'clients', dataPath: 'contract.party_b' }),
  seed({ key: 'contract.service_description', group: 'contract', label: 'Leistungsbeschreibung', exampleValue: 'Ambulante Pflege nach vereinbarter Leistung', dataSource: 'client_contracts', dataPath: 'contract.service_description' }),
  seed({ key: 'contract.privacy_clause', group: 'contract', label: 'Datenschutzabschnitt', exampleValue: 'Verarbeitung gemäß DSGVO …', dataSource: 'document_templates', dataPath: 'contract.privacy_clause' }),

  // Signatur
  seed({ key: 'signature.name', group: 'signature', label: 'Unterschrift Name', exampleValue: 'Helga Schneider', dataSource: 'service_records / signing', dataPath: 'signature.name', isSensitive: true }),
  seed({ key: 'signature.date', group: 'signature', label: 'Unterschriftsdatum', exampleValue: '15.06.2026', dataSource: 'service_records', dataPath: 'signature.date' }),
  seed({ key: 'signature.time', group: 'signature', label: 'Unterschriftszeit', exampleValue: '10:35', dataSource: 'service_records', dataPath: 'signature.time' }),
  seed({ key: 'signature.device', group: 'signature', label: 'Gerät', exampleValue: 'CareSuite App', dataSource: 'service_records', dataPath: 'signature.device' }),
  seed({ key: 'signature.hash', group: 'signature', label: 'Signatur-Hash', exampleValue: 'sha256:…', dataSource: 'service_records', dataPath: 'signature.hash' }),

  // System / Dokument
  seed({ key: 'document.created_at', group: 'document', label: 'Erstellt am', exampleValue: '15.06.2026 10:00', dataSource: 'generated_documents', dataPath: 'document.created_at' }),
  seed({ key: 'document.created_by', group: 'document', label: 'Erstellt von', exampleValue: 'Anna Pflege', dataSource: 'profiles', dataPath: 'document.created_by' }),
  seed({ key: 'document.version', group: 'document', label: 'Version', exampleValue: '1', dataSource: 'generated_documents', dataPath: 'document.version' }),
  seed({ key: 'document.hash', group: 'document', label: 'Dokument-Hash', exampleValue: 'sha256:…', dataSource: 'generated_documents', dataPath: 'document.hash' }),
  seed({ key: 'document.content', group: 'document', label: 'Dokumentationstext', exampleValue: 'Pflegeeinsatz dokumentiert …', dataSource: 'care_documentation', dataPath: 'document.content' }),
  seed({ key: 'document.title', group: 'document', label: 'Dokumenttitel', exampleValue: 'Pflegedokumentation', dataSource: 'generated_documents', dataPath: 'document.title' }),
  seed({ key: 'page.number', group: 'page', label: 'Seitennummer', exampleValue: '1', dataSource: 'system', dataPath: 'page.number' }),
  seed({ key: 'page.total', group: 'page', label: 'Seiten gesamt', exampleValue: '1', dataSource: 'system', dataPath: 'page.total' }),
];

export const PLACEHOLDER_GROUP_LABELS: Record<PlaceholderGroup, string> = {
  company: 'Unternehmen',
  client: 'Klient:in',
  representative: 'Vertretung',
  cost_carrier: 'Kostenträger',
  recipient: 'Empfänger',
  invoice: 'Rechnung',
  visit: 'Einsatz',
  contract: 'Vertrag',
  signature: 'Signatur',
  document: 'System / Dokument',
  page: 'Seite',
};
