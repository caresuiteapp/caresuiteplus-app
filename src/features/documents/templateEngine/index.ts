export type {
  DocumentContext,
  DocumentContextLoadResult,
  DocumentEntityType,
  DocumentTemplateTypeKey,
  FinalizeDocumentResult,
  PlaceholderGroup,
  PlaceholderRegistry,
  PlaceholderRegistryEntry,
  PlaceholderSearchFilters,
  RenderTemplateResult,
  SanitizeHtmlResult,
  TemplateRequiredFieldInput,
  TemplateValidationIssue,
  TemplateValidationResult,
  TemplateValidationStatus,
  TemplateVersionInput,
} from './types';

export {
  buildDocumentContext,
  createEmptyDocumentContext,
  registerDocumentContextRepository,
  resetDocumentContextRepository,
  type DocumentContextRepository,
} from './documentContext';

export { extractPlaceholders, replacePlaceholderTokens } from './extractPlaceholders';

export {
  DOCUMENT_TYPE_REQUIRED_RULES,
  getRequiredDocumentTypesForField,
  getRequiredFieldLabel,
  getRequiredRulesForDocumentType,
  validateDocumentTypeRequiredFields,
  type DocumentTypeRequiredRule,
} from './documentTypeRequiredRules';

export {
  assertCanFinalizeDocument,
  validateDocumentByType,
  validateTemplateForFinalization,
} from './finalizeDocument';

export {
  DEFAULT_PLACEHOLDER_REGISTRY,
  buildSystemPlaceholderRegistry,
  formatPlaceholderToken,
  getPlaceholderEntry,
  getPlaceholdersByGroup,
  insertPlaceholderIntoContent,
  isKnownPlaceholder,
  listPlaceholderEntries,
  mergePlaceholderRegistries,
  searchPlaceholders,
} from './placeholderRegistryService';

export { A4_PAGE_LAYOUT, DOCUMENT_LAYOUT_AREAS, DOCUMENT_LAYOUT_AREA_LABELS } from './a4LayoutDefaults';

export {
  buildDocumentCiCss,
  buildDocumentFooterHtml,
  buildDocumentHeaderHtml,
  buildMandatoryDisclosureLines,
  wrapDocumentBodyWithLayoutAreas,
} from './documentLayout';

export { buildLogoHtml, calculateLogoDimensions, clampLogoWidth } from './logoRendering';

export {
  validateBusinessLetterDisclosures,
  validateCiRequirements,
  validateDocumentTypeDisclosures,
} from './validateCiRequirements';

export { PLACEHOLDER_GROUP_LABELS, SYSTEM_PLACEHOLDER_SEEDS } from './systemPlaceholderSeeds';

export {
  formatPlaceholderValue,
  resolvePlaceholder,
  resolvePlaceholderAsString,
} from './resolvePlaceholder';

export { renderTemplate, type RenderTemplateOptions } from './renderTemplate';

export { buildDocumentPreview, type DocumentPreviewInput, type DocumentPreviewOutput } from './documentPreviewRenderer';

export {
  assertCanActivateTemplateVersion,
  assertCanFinalizeDocumentWithPreview,
  getPdfEngineStatus,
  isPdfEngineAvailable,
  validateTemplateForActivation,
} from './validateTemplateActivation';

export { buildDraftWatermarkCss, buildPreviewViewModeCss, wrapHtmlWithDraftWatermark } from './watermark';

export { sanitizeTemplateHtml } from './sanitizeTemplateHtml';

export {
  mergeValidationResults,
  validateRequiredFields,
} from './validateRequiredFields';

export {
  validateKnownPlaceholders,
  validateTemplate,
  validateTemplateHtmlSafety,
} from './validateTemplate';
