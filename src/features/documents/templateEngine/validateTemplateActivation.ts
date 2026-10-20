import type {
  DocumentContext,
  DocumentTemplateTypeKey,
  TemplateValidationResult,
  TemplateVersionInput,
} from './types';
import type { TenantDocumentSettings } from '@/types/documents/tenantDocumentSettings';
import { extractPlaceholders } from './extractPlaceholders';
import { validateTemplateForFinalization } from './finalizeDocument';
import { validateKnownPlaceholders, validateTemplateHtmlSafety } from './validateTemplate';
import { mergeValidationResults } from './validateRequiredFields';

/** PDF-Engine — vorbereitet, noch nicht produktiv. */
export function isPdfEngineAvailable(): boolean {
  return false;
}

export function getPdfEngineStatus(): { available: boolean; message: string } {
  return {
    available: false,
    message: 'PDF-Engine vorbereitet — HTML-Live-Vorschau verfügbar, PDF-Export folgt.',
  };
}

export function validateTemplateForActivation(input: {
  documentType: DocumentTemplateTypeKey;
  context: DocumentContext;
  templateVersion: TemplateVersionInput;
  tenantDocumentSettings?: TenantDocumentSettings | null;
  hasLivePreview: boolean;
}): TemplateValidationResult {
  const placeholders = extractPlaceholders(input.templateVersion.htmlTemplate);

  const validation = mergeValidationResults(
    validateKnownPlaceholders(placeholders),
    validateTemplateHtmlSafety(input.templateVersion.htmlTemplate),
    validateTemplateForFinalization({
      documentType: input.documentType,
      context: input.context,
      templateVersion: input.templateVersion,
      tenantDocumentSettings: input.tenantDocumentSettings,
    }),
  );

  if (!input.hasLivePreview) {
    return mergeValidationResults(validation, {
      status: 'error',
      issues: [
        {
          code: 'preview_required',
          message: 'Live-Vorschau erforderlich — bitte Vorschau ausführen.',
          severity: 'error',
        },
      ],
    });
  }

  if (!isPdfEngineAvailable()) {
    return mergeValidationResults(validation, {
      status: 'warning',
      issues: [
        {
          code: 'pdf_engine_prepared',
          message: getPdfEngineStatus().message,
          severity: 'warning',
        },
      ],
    });
  }

  return validation;
}

export function assertCanActivateTemplateVersion(input: {
  documentType: DocumentTemplateTypeKey;
  context: DocumentContext;
  templateVersion: TemplateVersionInput;
  tenantDocumentSettings?: TenantDocumentSettings | null;
  hasLivePreview: boolean;
  versionStatus: string;
}): { allowed: boolean; validation: TemplateValidationResult; reason?: string } {
  if (input.versionStatus === 'archived') {
    return {
      allowed: false,
      validation: {
        status: 'error',
        issues: [{ code: 'archived', message: 'Archivierte Version kann nicht aktiviert werden.', severity: 'error' }],
      },
      reason: 'Archivierte Version.',
    };
  }

  const validation = validateTemplateForActivation(input);
  if (validation.status === 'error') {
    return {
      allowed: false,
      validation,
      reason: validation.issues.find((i) => i.severity === 'error')?.message,
    };
  }
  return { allowed: true, validation };
}

export function assertCanFinalizeDocumentWithPreview(input: {
  documentType: DocumentTemplateTypeKey;
  context: DocumentContext;
  templateVersion: TemplateVersionInput;
  tenantDocumentSettings?: TenantDocumentSettings | null;
  hasLivePreview: boolean;
}): { allowed: boolean; validation: TemplateValidationResult; reason?: string } {
  const activation = assertCanActivateTemplateVersion({
    ...input,
    versionStatus: 'draft',
  });
  return activation;
}
