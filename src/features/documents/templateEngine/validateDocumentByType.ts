import { validateDocumentTypeRequiredFields } from './documentTypeRequiredRules';
import type { DocumentContext, DocumentTemplateTypeKey, TemplateValidationResult } from './types';

/** @deprecated Nutze validateDocumentTypeRequiredFields — Alias für Abwärtskompatibilität */
export function validateDocumentByTypeLegacy(
  documentType: DocumentTemplateTypeKey,
  context: DocumentContext,
): TemplateValidationResult {
  return validateDocumentTypeRequiredFields(documentType, context);
}

export { validateDocumentByType } from './finalizeDocument';
