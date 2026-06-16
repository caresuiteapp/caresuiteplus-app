import type {
  DocumentContext,
  DocumentTemplateTypeKey,
  TemplateValidationIssue,
  TemplateValidationResult,
} from './types';

export type DocumentTypeRequiredRule = {
  fieldKey: string;
  dataPath: string;
  label: string;
  message: string;
  /** Alternative Pfade — mindestens einer muss gesetzt sein */
  alternativePaths?: string[];
};

export const DOCUMENT_TYPE_REQUIRED_RULES: Record<DocumentTemplateTypeKey, DocumentTypeRequiredRule[]> = {
  invoice: [
    { fieldKey: 'recipient.full_name', dataPath: 'recipient.full_name', label: 'Empfänger', message: 'Empfängername fehlt.', alternativePaths: ['client.full_name'] },
    { fieldKey: 'recipient.address', dataPath: 'recipient.address', label: 'Empfängeradresse', message: 'Empfängeradresse fehlt.', alternativePaths: ['client.street', 'client.city'] },
    { fieldKey: 'invoice.number', dataPath: 'invoice.number', label: 'Rechnungsnummer', message: 'Rechnungsnummer fehlt.' },
    { fieldKey: 'invoice.date', dataPath: 'invoice.date', label: 'Rechnungsdatum', message: 'Rechnungsdatum fehlt.' },
    { fieldKey: 'invoice.service_period', dataPath: 'invoice.service_period', label: 'Leistungszeitraum', message: 'Leistungszeitraum fehlt.', alternativePaths: ['invoice.period'] },
    { fieldKey: 'invoice.line_items', dataPath: 'invoice.line_items', label: 'Positionen', message: 'Rechnungspositionen fehlen.', alternativePaths: ['invoice.net_total'] },
    { fieldKey: 'invoice.net_total', dataPath: 'invoice.net_total', label: 'Nettosumme', message: 'Nettosumme fehlt.', alternativePaths: ['invoice.amount_net'] },
    { fieldKey: 'invoice.gross_total', dataPath: 'invoice.gross_total', label: 'Bruttosumme', message: 'Bruttosumme fehlt.', alternativePaths: ['invoice.amount_gross', 'invoice.amount'] },
    { fieldKey: 'invoice.tax_total', dataPath: 'invoice.tax_total', label: 'Steuerbetrag', message: 'Steuerbetrag oder Steuerhinweis fehlt.', alternativePaths: ['invoice.tax_notice'] },
    { fieldKey: 'invoice.due_date', dataPath: 'invoice.due_date', label: 'Zahlungsziel', message: 'Fälligkeitsdatum fehlt.' },
    { fieldKey: 'company.bank_name', dataPath: 'company.bank_name', label: 'Bank', message: 'Bankverbindung (Bankname) fehlt.' },
    { fieldKey: 'company.iban', dataPath: 'company.iban', label: 'IBAN', message: 'IBAN fehlt.' },
    { fieldKey: 'company.legal_name', dataPath: 'company.legal_name', label: 'Firma (Footer)', message: 'Rechtlicher Firmenname für Footer fehlt.', alternativePaths: ['company.name'] },
    { fieldKey: 'company.tax_id', dataPath: 'company.tax_id', label: 'Steuernummer', message: 'Steuernummer für Footer fehlt.' },
  ],
  credit_note: [
    { fieldKey: 'invoice.number', dataPath: 'invoice.number', label: 'Gutschriftnummer', message: 'Gutschriftnummer fehlt.' },
    { fieldKey: 'invoice.date', dataPath: 'invoice.date', label: 'Datum', message: 'Datum fehlt.' },
  ],
  cancellation_invoice: [
    { fieldKey: 'invoice.number', dataPath: 'invoice.number', label: 'Stornonummer', message: 'Stornonummer fehlt.' },
    { fieldKey: 'invoice.date', dataPath: 'invoice.date', label: 'Datum', message: 'Datum fehlt.' },
  ],
  contract: [
    { fieldKey: 'contract.party_a', dataPath: 'contract.party_a', label: 'Vertragspartei A', message: 'Vertragspartei A fehlt.', alternativePaths: ['company.name', 'company.legal_name'] },
    { fieldKey: 'contract.party_b', dataPath: 'contract.party_b', label: 'Vertragspartei B', message: 'Vertragspartei B fehlt.', alternativePaths: ['client.full_name'] },
    { fieldKey: 'contract.start_date', dataPath: 'contract.start_date', label: 'Vertragsbeginn', message: 'Vertragsbeginn fehlt.' },
    { fieldKey: 'contract.service_description', dataPath: 'contract.service_description', label: 'Leistung', message: 'Leistungsbeschreibung fehlt.', alternativePaths: ['contract.hourly_rate', 'visit.service_type'] },
    { fieldKey: 'contract.hourly_rate', dataPath: 'contract.hourly_rate', label: 'Vergütung', message: 'Vergütung/Stundensatz fehlt.' },
    { fieldKey: 'contract.notice_period', dataPath: 'contract.notice_period', label: 'Kündigungsfrist', message: 'Kündigungsfrist fehlt.' },
    { fieldKey: 'contract.privacy_clause', dataPath: 'contract.privacy_clause', label: 'Datenschutz', message: 'Datenschutzabschnitt fehlt.' },
    { fieldKey: 'signature.name', dataPath: 'signature.name', label: 'Unterschrift', message: 'Unterschriftsfeld fehlt.', alternativePaths: ['signature.date'] },
  ],
  service_record: [
    { fieldKey: 'client.full_name', dataPath: 'client.full_name', label: 'Klient:in', message: 'Klient:in fehlt.' },
    { fieldKey: 'visit.employee_name', dataPath: 'visit.employee_name', label: 'Mitarbeitende:r', message: 'Mitarbeitende:r fehlt.' },
    { fieldKey: 'visit.date', dataPath: 'visit.date', label: 'Datum', message: 'Einsatzdatum fehlt.' },
    { fieldKey: 'visit.start_time', dataPath: 'visit.start_time', label: 'Beginn', message: 'Startzeit fehlt.' },
    { fieldKey: 'visit.end_time', dataPath: 'visit.end_time', label: 'Ende', message: 'Endzeit fehlt.' },
    { fieldKey: 'visit.duration', dataPath: 'visit.duration', label: 'Dauer', message: 'Dauer fehlt.', alternativePaths: ['visit.duration_minutes'] },
    { fieldKey: 'visit.service_type', dataPath: 'visit.service_type', label: 'Leistung', message: 'Leistungsart fehlt.' },
    { fieldKey: 'signature.name', dataPath: 'signature.name', label: 'Signatur', message: 'Signatur fehlt.', alternativePaths: ['signature.date'] },
    { fieldKey: 'visit.budget_reference', dataPath: 'visit.budget_reference', label: 'Budget', message: 'Budgetzuordnung fehlt.' },
  ],
  care_documentation: [
    { fieldKey: 'client.full_name', dataPath: 'client.full_name', label: 'Klient:in', message: 'Klient:in fehlt.' },
    { fieldKey: 'visit.employee_name', dataPath: 'visit.employee_name', label: 'Mitarbeitende:r', message: 'Mitarbeitende:r fehlt.' },
    { fieldKey: 'visit.date', dataPath: 'visit.date', label: 'Datum', message: 'Datum fehlt.', alternativePaths: ['document.created_at'] },
    { fieldKey: 'visit.start_time', dataPath: 'visit.start_time', label: 'Uhrzeit', message: 'Uhrzeit fehlt.', alternativePaths: ['signature.time'] },
    { fieldKey: 'document.content', dataPath: 'document.content', label: 'Dokumentationstext', message: 'Dokumentationstext fehlt.', alternativePaths: ['visit.documentation'] },
  ],
  dunning_letter: [
    { fieldKey: 'invoice.number', dataPath: 'invoice.number', label: 'Rechnungsnummer', message: 'Rechnungsnummer fehlt.' },
    { fieldKey: 'invoice.gross_total', dataPath: 'invoice.gross_total', label: 'Betrag', message: 'Offener Betrag fehlt.', alternativePaths: ['invoice.amount'] },
    { fieldKey: 'invoice.due_date', dataPath: 'invoice.due_date', label: 'Fälligkeit', message: 'Fälligkeitsdatum fehlt.' },
  ],
  payment_reminder: [
    { fieldKey: 'invoice.number', dataPath: 'invoice.number', label: 'Rechnungsnummer', message: 'Rechnungsnummer fehlt.' },
    { fieldKey: 'invoice.gross_total', dataPath: 'invoice.gross_total', label: 'Betrag', message: 'Betrag fehlt.', alternativePaths: ['invoice.amount'] },
  ],
  business_letter: [],
  offer: [],
  generic: [],
};

function hasValue(context: DocumentContext, path: string): boolean {
  const [group, ...rest] = path.split('.');
  const section = context[group as keyof DocumentContext];
  if (!section || typeof section !== 'object') return false;
  const value = (section as Record<string, unknown>)[rest.join('.')];
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
}

function ruleSatisfied(context: DocumentContext, rule: DocumentTypeRequiredRule): boolean {
  if (hasValue(context, rule.dataPath)) return true;
  for (const alt of rule.alternativePaths ?? []) {
    if (hasValue(context, alt)) return true;
  }
  return false;
}

export function validateDocumentTypeRequiredFields(
  documentType: DocumentTemplateTypeKey,
  context: DocumentContext,
): TemplateValidationResult {
  const rules = DOCUMENT_TYPE_REQUIRED_RULES[documentType] ?? [];
  const issues: TemplateValidationIssue[] = [];

  for (const rule of rules) {
    if (!ruleSatisfied(context, rule)) {
      issues.push({
        code: 'required_field_missing',
        message: rule.message,
        fieldKey: rule.fieldKey,
        severity: 'error',
      });
    }
  }

  return {
    status: issues.length > 0 ? 'error' : 'valid',
    issues,
  };
}

export function getRequiredRulesForDocumentType(
  documentType: DocumentTemplateTypeKey,
): DocumentTypeRequiredRule[] {
  return DOCUMENT_TYPE_REQUIRED_RULES[documentType] ?? [];
}

const DOCUMENT_TYPE_LABELS: Partial<Record<DocumentTemplateTypeKey, string>> = {
  invoice: 'Rechnung',
  contract: 'Vertrag',
  service_record: 'Leistungsnachweis',
  care_documentation: 'Dokumentation',
  dunning_letter: 'Mahnung',
};

export function getRequiredDocumentTypesForField(fieldKey: string): DocumentTemplateTypeKey[] {
  const types: DocumentTemplateTypeKey[] = [];
  for (const [docType, rules] of Object.entries(DOCUMENT_TYPE_REQUIRED_RULES) as [
    DocumentTemplateTypeKey,
    DocumentTypeRequiredRule[],
  ][]) {
    if (rules.some((r) => r.fieldKey === fieldKey || r.dataPath === fieldKey)) {
      types.push(docType);
    }
  }
  return types;
}

export function getRequiredFieldLabel(docType: DocumentTemplateTypeKey): string {
  return DOCUMENT_TYPE_LABELS[docType] ?? docType;
}
