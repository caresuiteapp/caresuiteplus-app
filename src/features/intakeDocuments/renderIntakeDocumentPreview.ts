import type { IntakeDocumentSignature, IntakeDocumentTemplate } from './intakeDocumentTypes';
import type { IntakePlaceholderContext } from './buildIntakeDocumentContext';

const PLACEHOLDER_PATTERN = /\{\{([a-z0-9_.]+)\}\}/gi;

export const INTAKE_DOCUMENT_CSS = `
  @page { size: A4; margin: 25mm 20mm 20mm 25mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: "Times New Roman", Georgia, "DejaVu Serif", serif;
    font-size: 11pt;
    line-height: 1.45;
    color: #1a1a1a;
    background: #e8e8e8;
  }
  .document-legal {
    max-width: 210mm;
    min-height: 297mm;
    margin: 16px auto;
    padding: 25mm 20mm 20mm 25mm;
    background: #fff;
    box-shadow: 0 2px 12px rgba(0,0,0,0.12);
  }
  .document-header { margin-bottom: 24px; border-bottom: 2px solid #1a1a1a; padding-bottom: 12px; }
  .document-header h1 { font-size: 14pt; font-weight: 700; margin: 0 0 4px; letter-spacing: 0.02em; }
  .document-header .subtitle { font-size: 10pt; color: #444; margin: 0; }
  .document-parties { margin: 20px 0 28px; }
  .document-parties table { width: 100%; border-collapse: collapse; }
  .document-parties td { vertical-align: top; padding: 4px 8px 4px 0; font-size: 10.5pt; }
  .document-parties .label { font-weight: 600; width: 140px; }
  .document-meta { margin: 16px 0 24px; font-size: 10.5pt; }
  .document-section { margin: 20px 0; }
  .document-section h2 {
    font-size: 11pt;
    font-weight: 700;
    margin: 0 0 8px;
    padding-bottom: 2px;
    border-bottom: 1px solid #ccc;
  }
  .document-paragraph { margin: 6px 0 10px; text-align: justify; hyphens: auto; }
  .document-paragraph ol, .document-paragraph ul { margin: 6px 0; padding-left: 20px; }
  .document-paragraph li { margin: 4px 0; }
  .document-signature-block {
    margin-top: 36px;
    page-break-inside: avoid;
  }
  .document-signature-block .sig-row {
    display: flex;
    flex-wrap: wrap;
    gap: 32px;
    margin-top: 24px;
  }
  .document-signature-block .sig-field {
    flex: 1;
    min-width: 200px;
  }
  .document-signature-block .sig-line {
    border-bottom: 1px solid #1a1a1a;
    min-height: 48px;
    margin-top: 8px;
    padding-bottom: 4px;
  }
  .document-signature-block .sig-label { font-size: 9.5pt; color: #444; margin-top: 4px; }
  .sig-img { max-height: 56px; max-width: 220px; }
  .missing {
    background: #fff3cd;
    color: #856404;
    padding: 1px 4px;
    border-radius: 2px;
    font-style: italic;
    font-size: 10pt;
  }
  .document-footer-note {
    margin-top: 32px;
    font-size: 9pt;
    color: #666;
    border-top: 1px solid #ddd;
    padding-top: 8px;
  }
`;

export type IntakePreviewResult = {
  html: string;
  missingPlaceholders: string[];
  unresolvedKeys: string[];
};

export function wrapIntakeDocumentHtml(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Intake-Dokument</title>
  <style>${INTAKE_DOCUMENT_CSS}</style>
</head>
<body>
  <div class="document-legal">${bodyHtml}</div>
</body>
</html>`;
}

function signatureHtml(sig: IntakeDocumentSignature | undefined, placeholder: string): string {
  if (!sig?.dataUrl) {
    return `<span class="missing">[Unterschrift ausstehend: ${placeholder}]</span>`;
  }
  return `<img class="sig-img" src="${sig.dataUrl}" alt="Unterschrift"/><br/><small>${new Date(sig.signedAt).toLocaleString('de-DE')}</small>`;
}

function missingLabel(key: string, template: IntakeDocumentTemplate): string {
  const schema = template.placeholderSchema[key];
  return schema?.label ?? key;
}

export function renderIntakeDocumentHtml(
  template: IntakeDocumentTemplate,
  context: IntakePlaceholderContext,
  signatures: Partial<Record<'client' | 'employee' | 'legal_representative', IntakeDocumentSignature>> = {},
  options?: { markMissing?: boolean; lockSignatures?: boolean; wrapDocument?: boolean },
): IntakePreviewResult {
  const markMissing = options?.markMissing ?? true;
  const wrapDocument = options?.wrapDocument ?? true;
  const missingPlaceholders: string[] = [];
  const unresolvedKeys: string[] = [];

  const enriched: IntakePlaceholderContext = {
    ...context,
    'signature.client': signatureHtml(signatures.client, 'Klient:in'),
    'signature.employee': signatureHtml(signatures.employee, 'Mitarbeitende:r'),
    'signature.legal_representative': signatureHtml(signatures.legal_representative, 'Vertretung'),
  };

  for (const [key, meta] of Object.entries(template.placeholderSchema)) {
    if (!meta.required) continue;
    const value = enriched[key]?.trim();
    if (!value || value.startsWith('[')) {
      missingPlaceholders.push(meta.label || key);
    }
  }

  const bodyHtml = template.htmlContent.replace(PLACEHOLDER_PATTERN, (_match, key: string) => {
    const normalized = key.toLowerCase();
    const value = enriched[normalized];
    if (value === undefined || value === '') {
      unresolvedKeys.push(normalized);
      if (markMissing) {
        const label = missingLabel(normalized, template);
        return `<span class="missing">[fehlend: ${label}]</span>`;
      }
      return '';
    }
    return value;
  });

  const html = wrapDocument ? wrapIntakeDocumentHtml(bodyHtml) : bodyHtml;

  return { html, missingPlaceholders, unresolvedKeys };
}

export function finalizeIntakeDocumentHtml(
  template: IntakeDocumentTemplate,
  context: IntakePlaceholderContext,
  signatures: Partial<Record<'client' | 'employee' | 'legal_representative', IntakeDocumentSignature>>,
): IntakePreviewResult {
  const preview = renderIntakeDocumentHtml(template, context, signatures, {
    markMissing: false,
    lockSignatures: true,
  });

  const lockedNotice = `<p class="document-footer-note">Dokument abgeschlossen am ${new Date().toLocaleString('de-DE')} — Änderungen gesperrt.</p>`;
  const html = preview.html.replace('</div>\n</body>', `${lockedNotice}</div>\n</body>`);
  return {
    ...preview,
    html,
  };
}
