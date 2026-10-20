import type { DocumentContext, DocumentTemplateTypeKey, TemplateValidationIssue, TemplateValidationResult } from './types';
import type { TenantDocumentSettings } from '@/types/documents/tenantDocumentSettings';
import { buildMandatoryDisclosureLines } from './documentLayout';

const BUSINESS_LETTER_REQUIRED: { fieldKey: string; label: string; check: (ctx: DocumentContext) => boolean }[] = [
  { fieldKey: 'company.legal_name', label: 'Vollständige Firma', check: (c) => has(c, 'company.legal_name') || has(c, 'company.name') },
  { fieldKey: 'company.city', label: 'Sitz der Gesellschaft', check: (c) => has(c, 'company.city') },
  { fieldKey: 'company.street', label: 'Ladungsfähige Anschrift', check: (c) => has(c, 'company.street') },
  { fieldKey: 'company.register_court', label: 'Registergericht', check: (c) => has(c, 'company.register_court') },
  { fieldKey: 'company.register_number', label: 'Handelsregisternummer', check: (c) => has(c, 'company.register_number') },
  { fieldKey: 'company.managing_director', label: 'Geschäftsführung', check: (c) => has(c, 'company.managing_director') },
  { fieldKey: 'company.phone', label: 'Kontakt Telefon', check: (c) => has(c, 'company.phone') || has(c, 'company.email') },
];

function has(context: DocumentContext, path: string): boolean {
  const [group, ...rest] = path.split('.');
  const section = context[group as keyof DocumentContext];
  if (!section || typeof section !== 'object') return false;
  const value = (section as Record<string, unknown>)[rest.join('.')];
  return typeof value === 'string' ? value.trim().length > 0 : Boolean(value);
}

/** Prüft Geschäftsbrief-Pflichtangaben — keine rechtliche Vollständigkeitsgarantie. */
export function validateBusinessLetterDisclosures(context: DocumentContext): TemplateValidationResult {
  const issues: TemplateValidationIssue[] = [];

  for (const rule of BUSINESS_LETTER_REQUIRED) {
    if (!rule.check(context)) {
      issues.push({
        code: 'business_letter_disclosure_missing',
        message: `Geschäftsbrief: ${rule.label} fehlt.`,
        fieldKey: rule.fieldKey,
        severity: 'error',
      });
    }
  }

  const disclosureLines = buildMandatoryDisclosureLines(context);
  if (disclosureLines.length < 5) {
    issues.push({
      code: 'business_letter_disclosure_incomplete',
      message: 'Geschäftsbrief: Pflichtangaben im Footer unvollständig.',
      severity: 'error',
    });
  }

  return { status: issues.length > 0 ? 'error' : 'valid', issues };
}

export function validateCiRequirements(
  settings: TenantDocumentSettings | null | undefined,
  documentType: DocumentTemplateTypeKey,
): TemplateValidationResult {
  if (!settings?.ciEnforcementEnabled) {
    return { status: 'valid', issues: [] };
  }

  const issues: TemplateValidationIssue[] = [];

  if (!settings.primaryColor?.trim()) {
    issues.push({ code: 'ci_primary_missing', message: 'CI-Pflicht: Primärfarbe fehlt.', fieldKey: 'primaryColor', severity: 'error' });
  }
  if (!settings.fontFamily?.trim()) {
    issues.push({ code: 'ci_font_missing', message: 'CI-Pflicht: Schriftart fehlt.', fieldKey: 'fontFamily', severity: 'error' });
  }
  if (!settings.logoUrl?.trim()) {
    issues.push({
      code: 'ci_logo_missing',
      message: 'CI-Pflicht: Logo fehlt (Textlogo-Fallback möglich, Logo empfohlen).',
      fieldKey: 'logoUrl',
      severity: 'warning',
    });
  }

  const footerConfig = settings.footerLayout.byDocumentType[documentType];
  if (footerConfig?.bankRequired) {
    if (!settings.bankName?.trim() || !settings.iban?.trim()) {
      issues.push({
        code: 'ci_bank_missing',
        message: 'Bankverbindung fehlt — für diesen Dokumenttyp erforderlich.',
        fieldKey: 'company.iban',
        severity: 'error',
      });
    }
  }

  if (documentType === 'invoice' && footerConfig?.bankRequired !== false) {
    const invoiceFooter = settings.footerLayout.byDocumentType.invoice;
    if (invoiceFooter?.bankRequired !== false && (!settings.bankName?.trim() || !settings.iban?.trim())) {
      issues.push({
        code: 'invoice_bank_missing',
        message: 'Rechnung: Bankverbindung fehlt.',
        fieldKey: 'company.iban',
        severity: 'error',
      });
    }
  }

  const status = issues.some((i) => i.severity === 'error') ? 'error' : issues.length > 0 ? 'warning' : 'valid';
  return { status, issues };
}

export function validateDocumentTypeDisclosures(
  documentType: DocumentTemplateTypeKey,
  context: DocumentContext,
): TemplateValidationResult {
  if (documentType === 'business_letter') {
    return validateBusinessLetterDisclosures(context);
  }
  return { status: 'valid', issues: [] };
}
