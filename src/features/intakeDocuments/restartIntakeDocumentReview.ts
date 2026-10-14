import type { ClientIntakeFormData } from '@/types/forms/clientIntakeForm';
import type { IntakeDocumentState } from './intakeDocumentTypes';

export function hasCollectedIntakeOriginal(document: IntakeDocumentState): boolean {
  return document.status === 'finalized' || Boolean(document.finalizedHtml || document.finalizedAt)
    || Object.values(document.signatures).some((signature) => Boolean(signature?.dataUrl));
}

/** Keep the complete previous original in the full draft before starting anew. */
export function restartIntakeDocumentReview(form: ClientIntakeFormData, templateKey: string): ClientIntakeFormData {
  const original = form.intakeDocuments.find((document) => document.templateKey === templateKey);
  if (!original || !hasCollectedIntakeOriginal(original) || (form.intakeDocumentHistory?.length ?? 0) >= 64) return form;
  const next = form.intakeDocuments.map((document): IntakeDocumentState => document !== original ? document : {
    ...document, status: 'not_started', signatures: {}, previewHtml: null, finalizedHtml: null, renderedPdfPath: null,
    previewOpenedAt: null, finalizedAt: null, renderedAt: undefined, renderVersion: undefined, missingPlaceholders: [], unresolvedKeys: [],
  });
  return { ...form, intakeDocumentHistory: [...(form.intakeDocumentHistory ?? []), structuredClone(original)], intakeDocuments: next,
    consentDatenschutz: next.some((document) => document.documentType === 'privacy_consent' && document.status === 'finalized'),
    consentVertrag: next.some((document) => document.documentType === 'client_contract' && document.status === 'finalized') };
}
