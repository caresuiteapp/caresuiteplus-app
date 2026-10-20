/** Wiederverwendbare HTML-Blöcke für den Vorlageneditor (Drag-and-Drop vorbereitet). */
export type DocumentEditorBlockKey =
  | 'table'
  | 'signature'
  | 'logo'
  | 'footer'
  | 'info'
  | 'qr_code'
  | 'page_break';

export type DocumentEditorBlock = {
  key: DocumentEditorBlockKey;
  label: string;
  description: string;
  html: string;
  dragDropReady: boolean;
};

export const DOCUMENT_EDITOR_BLOCKS: DocumentEditorBlock[] = [
  {
    key: 'table',
    label: 'Tabellenblock',
    description: 'Positionstabelle für Rechnungen/Leistungen',
    dragDropReady: true,
    html: `<table class="cs-block-table" data-block="table">
<thead><tr><th>Pos.</th><th>Leistung</th><th>Menge</th><th>Betrag</th></tr></thead>
<tbody><tr><td>1</td><td>{{visit.service_type}}</td><td>1</td><td>{{invoice.gross_total}}</td></tr></tbody>
</table>`,
  },
  {
    key: 'signature',
    label: 'Signaturfeld',
    description: 'Unterschriftsbereich mit Name und Datum',
    dragDropReady: true,
    html: `<div class="cs-block-signature" data-block="signature" data-layout-area="signature_area">
<p>Unterschrift:</p>
<p>{{signature.name}}</p>
<p>Datum: {{signature.date}} · {{signature.time}}</p>
</div>`,
  },
  {
    key: 'logo',
    label: 'Logo-Block',
    description: 'Logo-Platzhalter (CI über Mandanteneinstellungen)',
    dragDropReady: true,
    html: `<div class="cs-block-logo" data-block="logo" data-layout-area="page_header">
<!-- Logo wird über CI-Layout eingefügt -->
<p>{{company.name}}</p>
</div>`,
  },
  {
    key: 'footer',
    label: 'Footer-Block',
    description: 'Fußzeile mit Pflichtangaben',
    dragDropReady: true,
    html: `<div class="cs-block-footer" data-block="footer" data-layout-area="footer">
<p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
<p>Bank: {{company.bank_name}} · IBAN: {{company.iban}}</p>
</div>`,
  },
  {
    key: 'info',
    label: 'Infoblock',
    description: 'Informationsblock für Metadaten',
    dragDropReady: true,
    html: `<div class="cs-block-info" data-block="info" data-layout-area="info_block">
<p>Datum: {{invoice.date}}</p>
<p>Nummer: {{invoice.number}}</p>
<p>Klient:in: {{client.full_name}}</p>
</div>`,
  },
  {
    key: 'qr_code',
    label: 'QR-Code-Block',
    description: 'Vorbereitet — QR-Inhalt folgt mit PDF-Engine',
    dragDropReady: false,
    html: `<div class="cs-block-qr" data-block="qr_code" data-prepared="true">
<p>[QR-Code vorbereitet: {{invoice.payment_reference}}]</p>
</div>`,
  },
  {
    key: 'page_break',
    label: 'Seitenumbruch',
    description: 'Expliziter Seitenumbruch für Druck',
    dragDropReady: true,
    html: `<div class="cs-block-page-break" data-block="page_break" data-layout-area="page_break_control" style="page-break-after:always;"></div>`,
  },
];

export function getDocumentEditorBlock(key: DocumentEditorBlockKey): DocumentEditorBlock | undefined {
  return DOCUMENT_EDITOR_BLOCKS.find((b) => b.key === key);
}

export function insertBlockIntoHtml(html: string, blockHtml: string): string {
  return `${html.trim()}\n${blockHtml}`;
}
