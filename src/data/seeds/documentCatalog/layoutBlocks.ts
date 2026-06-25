import { STANDARD_SYSTEM_TEMPLATE_CSS } from '@/lib/documents/systemTemplateSeeds';

export const PREMIUM_DOCUMENT_CSS = `
${STANDARD_SYSTEM_TEMPLATE_CSS}
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }
`.trim();

export function wrapPremiumDocument(input: {
  title: string;
  subtitle?: string;
  bodyHtml: string;
  layoutKind?: 'premium' | 'din5008';
}): string {
  const header = `
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">${input.title}</h1>
  ${input.subtitle ? `<p class="cs-doc-subtitle">${input.subtitle}</p>` : ''}
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div>`;

  const addressBlock =
    input.layoutKind === 'din5008'
      ? `<div class="cs-din5008-address">
<p>{{recipient.full_name}}</p>
<p>{{recipient.address}}</p>
</div>
<div class="cs-din5008-date">{{company.city}}, {{document.created_at}}</div>`
      : '';

  const footer = `
<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>`;

  return `${header}${addressBlock}${input.bodyHtml}${footer}`;
}

export function clientMetaBlock(): string {
  return `<dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>`;
}

export function signatureBlock(): string {
  return `<div class="cs-signature-block">
<p>Ort, Datum: _________________________</p>
<p>Unterschrift Klient:in / Vertretung: _________________________</p>
<p>Unterschrift Mitarbeitende:r: {{employee.full_name}} · {{employee.handzeichen}}</p>
</div>`;
}
