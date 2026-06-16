/** Standard-Textbausteine für Dokumentvorlagen */
export type DocumentTextSnippetKey =
  | 'payment_terms'
  | 'tax_notice'
  | 'privacy'
  | 'confidentiality'
  | 'termination'
  | 'liability'
  | 'service_description'
  | 'emergency_notice'
  | 'cost_carrier_notice';

export type DocumentTextSnippet = {
  key: DocumentTextSnippetKey;
  label: string;
  html: string;
};

export const DOCUMENT_TEXT_SNIPPETS: DocumentTextSnippet[] = [
  {
    key: 'payment_terms',
    label: 'Zahlungsbedingungen',
    html: '<p>Zahlbar innerhalb von {{invoice.due_date}} ohne Abzug auf das unten genannte Konto.</p>',
  },
  {
    key: 'tax_notice',
    label: 'Steuerhinweis',
    html: '<p>{{invoice.tax_notice}}</p>',
  },
  {
    key: 'privacy',
    label: 'Datenschutz',
    html: '<p>{{contract.privacy_clause}}</p>',
  },
  {
    key: 'confidentiality',
    label: 'Schweigepflicht',
    html: '<p>Es gilt die gesetzliche Schweigepflicht gemäß § 203 StGB.</p>',
  },
  {
    key: 'termination',
    label: 'Kündigung',
    html: '<p>Kündigungsfrist: {{contract.notice_period}}</p>',
  },
  {
    key: 'liability',
    label: 'Haftung',
    html: '<p>Haftungsbeschränkungen gemäß gesetzlichen Vorgaben und Vertrag.</p>',
  },
  {
    key: 'service_description',
    label: 'Leistungsbeschreibung',
    html: '<p>{{contract.service_description}}</p>',
  },
  {
    key: 'emergency_notice',
    label: 'Notfallhinweis',
    html: '<p>Im Notfall wenden Sie sich an den diensthabenden Notdienst oder 112.</p>',
  },
  {
    key: 'cost_carrier_notice',
    label: 'Kostenträgerhinweis',
    html: '<p>Abrechnung über: {{cost_carrier.name}} (IK: {{cost_carrier.ik_number}})</p>',
  },
];

export function getDocumentTextSnippet(key: DocumentTextSnippetKey): DocumentTextSnippet | undefined {
  return DOCUMENT_TEXT_SNIPPETS.find((s) => s.key === key);
}

export function insertSnippetIntoHtml(html: string, snippetHtml: string): string {
  return `${html.trim()}\n${snippetHtml}`;
}
