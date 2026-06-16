export {
  assertDocumentWritable,
  assertGobdArchiveClaimAllowed,
  assertHealthDataOcrAllowed,
  assertOcrAllowed,
  assertPdfManipulationAllowed,
  assertSigningAllowed,
  assertTenantScope,
  validateOcrProviderReady,
  validateSigningProviderReady,
  containsDocumentSecretLiteral,
  isExternalOcrProviderKey,
  isSignatureProviderKey,
  maskDocumentCredentialReference,
  sanitizeDocumentProviderConfigForUser,
} from './connectDocumentGuard';

export {
  getArchiveStatus,
  attemptOverwriteArchivedDocument,
  prepareArchiveDocument,
  prepareDocumentCorrection,
  getConnectArchiveDemoEntries,
  resetConnectArchiveDemoEntries,
  type ArchiveStatusSnapshot,
} from './connectDocumentArchiveService';

export {
  prepareGenerateContract,
  prepareGenerateInvoice,
  prepareGenerateLeistungsnachweis,
  preparePdfAConversion,
  prepareDocumentClassification,
  getConnectDocumentDemoStore,
  resetConnectDocumentDemoStore,
} from './connectDocumentGenerationService';

export {
  prepareSigningRequest,
  registerPreparedSigningRequest,
  sendSigningRequestToProvider,
} from './connectDocumentSigningService';

export {
  prepareOcrJob,
  registerPreparedOcrJob,
  triggerExternalOcrTransfer,
} from './connectDocumentOcrService';

export {
  appendDocumentAuditEvent,
  createDocumentVersion,
  createGeneratedDocument,
  createInMemoryDocumentStore,
  getDocumentAuditTrail,
  getDocumentsForTenant,
  markDocumentGenerated,
  seedDocumentTemplate,
  type InMemoryDocumentStore,
} from './connectDocumentVersionService';

export type {
  ArchiveStatus,
  DocumentArchiveEntry,
  DocumentAuditEvent,
  DocumentExecutionContext,
  DocumentGuardCode,
  DocumentGuardResult,
  DocumentOcrJob,
  DocumentProviderConfig,
  DocumentProviderKey,
  DocumentSigningRequest,
  DocumentTemplate,
  DocumentVersion,
  GeneratedDocument,
  GeneratedDocumentStatus,
  OcrProviderKey,
  SignatureProviderKey,
} from '@/types/documents/connect';

export {
  DOCUMENT_PROVIDER_LABELS,
  DOCUMENT_TEMPLATE_TYPE_LABELS,
  EXTERNAL_OCR_PROVIDER_KEYS,
  GENERATED_DOCUMENT_STATUS_LABELS,
  GOBD_ARCHIVE_DISCLAIMER,
  OCR_EXTERNAL_APPROVAL_REQUIRED,
  OCR_PROVIDER_KEYS,
  SIGNATURE_PROVIDER_KEYS,
} from '@/types/documents/connect';
