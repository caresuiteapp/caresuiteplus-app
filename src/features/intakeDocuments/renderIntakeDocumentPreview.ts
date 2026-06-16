import type { IntakeDocumentSignature, IntakeDocumentTemplate } from './intakeDocumentTypes';
import type { IntakePlaceholderContext } from './buildIntakeDocumentContext';

const PLACEHOLDER_PATTERN = /\{\{([a-z0-9_.]+)\}\}/gi;

export type IntakePreviewResult = {
  html: string;
  missingPlaceholders: string[];
  unresolvedKeys: string[];
};

function signatureHtml(sig: IntakeDocumentSignature | undefined, placeholder: string): string {
  if (!sig?.dataUrl) {
    return `<span class="missing">[Unterschrift ausstehend: ${placeholder}]</span>`;
  }
  return `<img class="sig-img" src="${sig.dataUrl}" alt="Unterschrift" /><br/><small>${new Date(sig.signedAt).toLocaleString('de-DE')}</small>`;
}

export function renderIntakeDocumentHtml(
  template: IntakeDocumentTemplate,
  context: IntakePlaceholderContext,
  signatures: Partial<Record<'client' | 'employee' | 'legal_representative', IntakeDocumentSignature>> = {},
  options?: { markMissing?: boolean; lockSignatures?: boolean },
): IntakePreviewResult {
  const markMissing = options?.markMissing ?? true;
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

  const html = template.htmlContent.replace(PLACEHOLDER_PATTERN, (_match, key: string) => {
    const normalized = key.toLowerCase();
    const value = enriched[normalized];
    if (value === undefined || value === '') {
      unresolvedKeys.push(normalized);
      if (markMissing) {
        return `<span class="missing">[${normalized}]</span>`;
      }
      return '';
    }
    return value;
  });

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

  const lockedNotice = `<p style="margin-top:24px;font-size:0.85rem;color:#666;">Dokument abgeschlossen am ${new Date().toLocaleString('de-DE')} — Änderungen gesperrt.</p>`;
  return {
    ...preview,
    html: `${preview.html}${lockedNotice}`,
  };
}
