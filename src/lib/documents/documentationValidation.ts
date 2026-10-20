import type { DocumentationRecord } from '@/types/documents/documentation';
import {
  DOCUMENTATION_PREPARED_TYPES,
  DOCUMENTATION_TYPES_REQUIRING_OCCASION,
} from '@/types/documents/documentation';
import type { TemplateValidationIssue, TemplateValidationResult } from '@/features/documents/templateEngine/types';

function hasText(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

export function validateDocumentationRecord(doc: DocumentationRecord): TemplateValidationResult {
  const issues: TemplateValidationIssue[] = [];

  if (DOCUMENTATION_PREPARED_TYPES.includes(doc.documentationType)) {
    issues.push({
      code: 'template_prepared_only',
      message: `${doc.documentationType}: Vorlage vorbereitet — Finalisierung noch nicht produktiv.`,
      severity: 'warning',
    });
  }

  if (!doc.clientName?.trim()) {
    issues.push({
      code: 'client_missing',
      message: 'Klient:in fehlt.',
      fieldKey: 'client.full_name',
      severity: 'error',
    });
  }

  if (!doc.employeeName?.trim()) {
    issues.push({
      code: 'employee_missing',
      message: 'Mitarbeitende:r fehlt.',
      fieldKey: 'visit.employee_name',
      severity: 'error',
    });
  }

  if (!hasText(doc.contentText) && !hasText(doc.observation) && !hasText(doc.measure)) {
    issues.push({
      code: 'documentation_text_missing',
      message: 'Dokumentationstext fehlt.',
      fieldKey: 'document.content',
      severity: 'error',
    });
  }

  if (DOCUMENTATION_TYPES_REQUIRING_OCCASION.includes(doc.documentationType)) {
    if (!hasText(doc.occasion)) {
      issues.push({
        code: 'occasion_missing',
        message: 'Anlass fehlt.',
        fieldKey: 'document.occasion',
        severity: 'error',
      });
    }
    if (!hasText(doc.observation) && !hasText(doc.contentText)) {
      issues.push({
        code: 'description_missing',
        message: 'Beschreibung/Beobachtung fehlt.',
        fieldKey: 'document.observation',
        severity: 'error',
      });
    }
  }

  if (doc.referralRequired && !hasText(doc.referralRecipient)) {
    issues.push({
      code: 'referral_recipient_missing',
      message: 'Überweisungsempfänger fehlt.',
      fieldKey: 'document.referral_recipient',
      severity: 'error',
    });
  }

  if (!doc.previewConfirmed) {
    issues.push({
      code: 'preview_required',
      message: 'Vorschau muss bestätigt sein.',
      severity: 'error',
    });
  }

  return {
    status: issues.some((i) => i.severity === 'error') ? 'error' : 'valid',
    issues,
  };
}

export function documentationToDocumentContext(doc: DocumentationRecord) {
  return {
    client: { full_name: doc.clientName },
    visit: {
      date: doc.documentDate,
      start_time: doc.documentTime,
      employee_name: doc.employeeName,
      documentation: doc.contentText,
    },
    document: {
      number: doc.documentNumber ?? '',
      title: doc.documentationType,
      content: doc.contentText,
      occasion: doc.occasion,
      observation: doc.observation,
      measure: doc.measure,
      result: doc.result,
      special_notes: doc.specialNotes,
      risks: doc.risks,
      referral_required: doc.referralRequired ? 'Ja' : 'Nein',
      referral_recipient: doc.referralRecipient,
      version: String(doc.version),
      audit_status: doc.auditStatus,
      created_at: doc.documentDate,
    },
    signature: {
      name: doc.digitalSignature ?? '',
      date: doc.signedAt ?? '',
      time: doc.documentTime,
    },
  };
}

export const STANDARD_DOCUMENTATION_HTML_TEMPLATE = `<div class="cs-documentation" data-doc-type="care_documentation">
<h1>{{document.title}} — {{document.number}}</h1>
<p>Datum: {{visit.date}} · Uhrzeit: {{visit.start_time}} · Version: {{document.version}}</p>
<p>Klient:in: {{client.full_name}} · Mitarbeitende:r: {{visit.employee_name}}</p>
<p>Anlass: {{document.occasion}}</p>
<section>
<h2>Beobachtung</h2>
<p>{{document.observation}}</p>
<h2>Maßnahme</h2>
<p>{{document.measure}}</p>
<h2>Ergebnis</h2>
<p>{{document.result}}</p>
<p>{{document.content}}</p>
</section>
<p>Besonderheiten: {{document.special_notes}}</p>
<p>Risiken: {{document.risks}}</p>
<p>Überweisung erforderlich: {{document.referral_required}} · Empfänger: {{document.referral_recipient}}</p>
<p>Audit-Status: {{document.audit_status}}</p>
<p>Signatur: {{signature.name}} · {{signature.date}}</p>
</div>`;

export function getDocumentationTemplateVersionId(docType: DocumentationRecord['documentationType']): string {
  return `dtplv-documentation-${docType}`;
}

/** Nur registrierte Platzhalter — für Lifecycle-Finalisierung */
export const FINALIZE_DOCUMENTATION_HTML_TEMPLATE = `<h1>{{document.title}}</h1>
<p>{{client.full_name}} · {{visit.employee_name}}</p>
<p>{{visit.date}} · {{visit.start_time}}</p>
<p>{{document.content}}</p>
<p>{{signature.name}} · {{signature.date}}</p>`;
