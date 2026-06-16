import type {
  DocumentContext,
  DocumentTemplateTypeKey,
  TemplateValidationResult,
  TemplateVersionInput,
} from './types';
import type { TenantDocumentSettings } from '@/types/documents/tenantDocumentSettings';
import { validateDocumentTypeRequiredFields } from './documentTypeRequiredRules';
import { extractPlaceholders } from './extractPlaceholders';
import { validateKnownPlaceholders } from './validateTemplate';
import { mergeValidationResults, validateRequiredFields } from './validateRequiredFields';
import { DEFAULT_PLACEHOLDER_REGISTRY } from './placeholderRegistryService';
import { validateCiRequirements, validateDocumentTypeDisclosures } from './validateCiRequirements';

/** Dokumenttyp-spezifische Validierung über zentrale Pflichtfeldregeln. */
export function validateDocumentByType(
  documentType: DocumentTemplateTypeKey,
  context: DocumentContext,
): TemplateValidationResult {
  return validateDocumentTypeRequiredFields(documentType, context);
}

export function validateTemplateForFinalization(input: {
  documentType: DocumentTemplateTypeKey;
  context: DocumentContext;
  templateVersion: TemplateVersionInput;
  tenantDocumentSettings?: TenantDocumentSettings | null;
}): TemplateValidationResult {
  const placeholders = extractPlaceholders(input.templateVersion.htmlTemplate);

  return mergeValidationResults(
    validateKnownPlaceholders(placeholders, DEFAULT_PLACEHOLDER_REGISTRY),
    validateRequiredFields(input.templateVersion, input.context),
    validateDocumentTypeRequiredFields(input.documentType, input.context),
    validateDocumentTypeDisclosures(input.documentType, input.context),
    validateCiRequirements(input.tenantDocumentSettings, input.documentType),
  );
}

export function assertCanFinalizeDocument(input: {
  documentType: DocumentTemplateTypeKey;
  context: DocumentContext;
  templateVersion: TemplateVersionInput;
  tenantDocumentSettings?: TenantDocumentSettings | null;
}): { allowed: boolean; validation: TemplateValidationResult; reason?: string } {
  const validation = validateTemplateForFinalization(input);
  if (validation.status === 'error') {
    return {
      allowed: false,
      validation,
      reason: validation.issues[0]?.message ?? 'Pflichtfeldprüfung fehlgeschlagen.',
    };
  }
  return { allowed: true, validation };
}
