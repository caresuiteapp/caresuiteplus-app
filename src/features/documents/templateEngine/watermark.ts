/** Entwurfswasserzeichen — nur für Vorschau, nicht für finalisierte Dokumente. */
export function buildDraftWatermarkCss(): string {
  return `
.cs-draft-watermark {
  position: relative;
}
.cs-draft-watermark::before {
  content: 'ENTWURF — NICHT FINAL';
  position: fixed;
  top: 45%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(-35deg);
  font-size: 48pt;
  color: rgba(220, 38, 38, 0.12);
  font-weight: 700;
  letter-spacing: 4px;
  pointer-events: none;
  z-index: 9999;
  white-space: nowrap;
}
`.trim();
}

export function wrapHtmlWithDraftWatermark(html: string): string {
  if (!html.includes('cs-draft-watermark')) {
    return html.replace(
      'class="cs-document-root"',
      'class="cs-document-root cs-draft-watermark"',
    );
  }
  return html;
}

export function buildPreviewViewModeCss(viewMode: 'mobile' | 'desktop' | 'print'): string {
  if (viewMode === 'mobile') {
    return '.cs-document-root { max-width: 390px; margin: 0 auto; font-size: 9pt; }';
  }
  if (viewMode === 'print') {
    return '@media print { .cs-document-root { max-width: 100%; } }';
  }
  return '.cs-document-root { max-width: 210mm; margin: 0 auto; }';
}
