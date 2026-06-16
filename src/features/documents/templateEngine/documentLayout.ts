import type { DocumentContext } from './types';
import type { DocumentTemplateTypeKey } from './types';
import type { TenantDocumentSettings } from '@/types/documents/tenantDocumentSettings';
import { buildLogoHtml } from './logoRendering';

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildDocumentCiCss(settings: TenantDocumentSettings): string {
  const p = settings.pageLayout;
  return `
:root {
  --cs-primary: ${settings.primaryColor};
  --cs-secondary: ${settings.secondaryColor};
  --cs-accent: ${settings.accentColor};
  --cs-font: ${settings.fontFamily};
  --cs-base-pt: ${p.baseFontSizePt}pt;
  --cs-heading-pt: ${p.headingFontSizePt}pt;
  --cs-line-height: ${p.lineHeight};
}
@page {
  size: ${p.widthMm}mm ${p.heightMm}mm;
  margin: ${p.marginTopMm}mm ${p.marginRightMm}mm ${p.marginBottomMm}mm ${p.marginLeftMm}mm;
}
.cs-document-root {
  font-family: var(--cs-font);
  font-size: var(--cs-base-pt);
  line-height: var(--cs-line-height);
  color: var(--cs-secondary);
  max-width: ${p.widthMm - p.marginLeftMm - p.marginRightMm}mm;
}
.cs-document-root h1, .cs-document-root h2, .cs-document-root h3 {
  color: var(--cs-primary);
  font-size: var(--cs-heading-pt);
  line-height: 1.25;
}
.cs-layout-area { margin-bottom: 4mm; }
.cs-page-header { border-bottom: 1px solid var(--cs-accent); padding-bottom: 3mm; }
.cs-accent-line { height: 2px; background: var(--cs-accent); margin: 2mm 0; }
.cs-footer { border-top: 1px solid var(--cs-accent); padding-top: 3mm; font-size: 9pt; color: var(--cs-secondary); }
.cs-logo-text { color: var(--cs-primary); }
.cs-placeholder-unresolved { background: #fef3c7; color: #92400e; padding: 0 2px; }
`.trim();
}

export function buildDocumentHeaderHtml(input: {
  settings: TenantDocumentSettings;
  context: DocumentContext;
  documentType?: DocumentTemplateTypeKey;
}): string {
  const { settings, context } = input;
  const h = settings.headerLayout;
  const companyName = String(context.company.name ?? context.company.legal_name ?? '');
  const align = h.logoPosition === 'center' ? 'center' : h.logoPosition === 'right' ? 'flex-end' : 'flex-start';

  const logo = buildLogoHtml({
    logoUrl: settings.logoUrl,
    companyName,
    widthMm: settings.logoWidthMm,
    naturalWidthPx: settings.logoNaturalWidthPx,
    naturalHeightPx: settings.logoNaturalHeightPx,
  });

  const parts: string[] = [
    `<div class="cs-layout-area cs-page-header" data-layout-area="page_header" style="display:flex;flex-direction:column;align-items:${align};">`,
    logo,
  ];

  if (h.showCompanyName && companyName) parts.push(`<div class="cs-company-name">${esc(companyName)}</div>`);
  if (h.showBrandLine && context.company.legal_name) {
    parts.push(`<div class="cs-brand-line">${esc(String(context.company.legal_name))}</div>`);
  }
  if (h.showSlogan && context.company.website) {
    parts.push(`<div class="cs-slogan">${esc(String(context.company.website))}</div>`);
  }
  if (h.showDocumentType && input.documentType) {
    parts.push(`<div class="cs-doc-type">${esc(input.documentType)}</div>`);
  }
  if (h.showAccentLine) parts.push('<div class="cs-accent-line"></div>');
  if (h.showDocumentNumber && context.invoice.number) {
    parts.push(`<div class="cs-doc-number">Nr. ${esc(String(context.invoice.number))}</div>`);
  }
  if (h.contactPersonName) {
    parts.push(
      `<div class="cs-contact">${esc(h.contactPersonName)}${h.contactPersonPhone ? ` · ${esc(h.contactPersonPhone)}` : ''}${h.contactPersonEmail ? ` · ${esc(h.contactPersonEmail)}` : ''}</div>`,
    );
  }
  if (h.showPageNumber) {
    parts.push(`<div class="cs-page-num">Seite ${esc(String(context.page.number ?? '1'))}</div>`);
  }
  parts.push('</div>');
  return parts.join('\n');
}

export function buildMandatoryDisclosureLines(context: DocumentContext): string[] {
  const lines: string[] = [];
  const push = (label: string, value: unknown) => {
    const v = String(value ?? '').trim();
    if (v) lines.push(`${label}: ${v}`);
  };

  push('Firma', context.company.legal_name ?? context.company.name);
  push('Sitz', [context.company.zip, context.company.city].filter(Boolean).join(' '));
  push('Registergericht', context.company.register_court);
  push('HRB', context.company.register_number);
  push('Geschäftsführung', context.company.managing_director);
  push('Anschrift', [context.company.street, context.company.zip, context.company.city].filter(Boolean).join(', '));
  push('Tel.', context.company.phone);
  push('E-Mail', context.company.email);
  push('USt-IdNr.', context.company.vat_id);
  push('Steuernummer', context.company.tax_id);
  push('IK', context.company.ik_number);

  return lines;
}

export function buildDocumentFooterHtml(input: {
  settings: TenantDocumentSettings;
  context: DocumentContext;
  documentType: DocumentTemplateTypeKey;
}): string {
  const { settings, context, documentType } = input;
  const typeConfig = settings.footerLayout.byDocumentType[documentType];
  const showDisclosures = typeConfig?.showMandatoryDisclosures ?? settings.footerLayout.showMandatoryDisclosures;
  const showBank = typeConfig?.showBankDetails ?? false;

  const parts: string[] = ['<div class="cs-layout-area cs-footer" data-layout-area="footer">'];

  if (typeConfig?.customText) {
    parts.push(`<div class="cs-footer-custom">${esc(typeConfig.customText)}</div>`);
  }

  if (showDisclosures) {
    const disclosure = buildMandatoryDisclosureLines(context).join(' · ');
    if (disclosure) parts.push(`<div class="cs-footer-disclosures">${esc(disclosure)}</div>`);
  }

  if (showBank && (context.company.bank_name || context.company.iban)) {
    parts.push(
      `<div class="cs-footer-bank">Bank: ${esc(String(context.company.bank_name ?? ''))} · IBAN: ${esc(String(context.company.iban ?? ''))}${context.company.bic ? ` · BIC: ${esc(String(context.company.bic))}` : ''}</div>`,
    );
  }

  if (settings.footerLayout.showPageNumber) {
    parts.push(`<div class="cs-footer-page">Seite ${esc(String(context.page.number ?? '1'))} / ${esc(String(context.page.total ?? '1'))}</div>`);
  }

  parts.push('</div>');
  return parts.join('\n');
}

export function wrapDocumentBodyWithLayoutAreas(bodyHtml: string): string {
  return [
    '<div class="cs-layout-area cs-sender-line" data-layout-area="sender_line"></div>',
    '<div class="cs-layout-area cs-address-field" data-layout-area="address_field"></div>',
    '<div class="cs-layout-area cs-info-block" data-layout-area="info_block"></div>',
    '<div class="cs-layout-area cs-subject-line" data-layout-area="subject_line"></div>',
    `<div class="cs-layout-area cs-document-body" data-layout-area="document_body">${bodyHtml}</div>`,
    '<div class="cs-layout-area cs-table-area" data-layout-area="table_area"></div>',
    '<div class="cs-layout-area cs-legal-notice" data-layout-area="legal_notice_area"></div>',
    '<div class="cs-layout-area cs-signature-area" data-layout-area="signature_area"></div>',
    '<div class="cs-layout-area cs-attachments-area" data-layout-area="attachments_area"></div>',
    '<div class="cs-layout-area cs-page-break" data-layout-area="page_break_control" style="page-break-after:always;"></div>',
  ].join('\n');
}
