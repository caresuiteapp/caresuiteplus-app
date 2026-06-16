import type { PageLayoutConfig } from '@/types/documents/tenantDocumentSettings';

/** DIN A4 Hochformat — Standard für Geschäftsdokumente */
export const A4_PAGE_LAYOUT: PageLayoutConfig = {
  format: 'A4',
  orientation: 'portrait',
  widthMm: 210,
  heightMm: 297,
  marginLeftMm: 25,
  marginRightMm: 20,
  marginTopMm: 20,
  marginBottomMm: 20,
  baseFontSizePt: 10.5,
  headingFontSizePt: 14,
  lineHeight: 1.2,
  fontFamily: 'Arial, Helvetica, system-ui, sans-serif',
};

export const DOCUMENT_LAYOUT_AREAS = [
  'page_header',
  'sender_line',
  'address_field',
  'info_block',
  'subject_line',
  'document_body',
  'table_area',
  'legal_notice_area',
  'signature_area',
  'attachments_area',
  'footer',
  'page_break_control',
] as const;

export const DOCUMENT_LAYOUT_AREA_LABELS: Record<(typeof DOCUMENT_LAYOUT_AREAS)[number], string> = {
  page_header: 'Seitenkopf',
  sender_line: 'Absenderzeile',
  address_field: 'Anschriftfeld',
  info_block: 'Informationsblock',
  subject_line: 'Betreffzeile',
  document_body: 'Dokumentkörper',
  table_area: 'Tabellenbereich',
  legal_notice_area: 'Hinweis-/Rechtsbereich',
  signature_area: 'Signaturbereich',
  attachments_area: 'Anlagenbereich',
  footer: 'Fußzeile',
  page_break_control: 'Seitenumbruchsteuerung',
};
