export {
  fetchTenantDocumentSettings,
  mergeTenantSettingsIntoContext,
  resetTenantDocumentSettingsStore,
  saveTenantDocumentSettings,
  seedTenantDocumentSettingsForTest,
} from './tenantDocumentSettingsService';

export {
  DOCUMENT_EDITOR_BLOCKS,
  getDocumentEditorBlock,
  insertBlockIntoHtml,
  type DocumentEditorBlock,
  type DocumentEditorBlockKey,
} from './documentEditorBlocks';

export {
  DOCUMENT_TEXT_SNIPPETS,
  getDocumentTextSnippet,
  insertSnippetIntoHtml,
  type DocumentTextSnippet,
  type DocumentTextSnippetKey,
} from './documentTextSnippets';

export {
  PREVIEW_SAMPLE_OPTIONS,
  activateDocumentTemplateVersion,
  archiveDocumentTemplate,
  createDocumentTemplateVersion,
  getDocumentTemplateDetail,
  getPdfEngineStatus,
  isPdfEngineAvailable,
  listDocumentTemplates,
  resetDocumentTemplateStore,
  runLivePreview,
  seedDocumentTemplateForTest,
  updateDocumentTemplateVersion,
} from './documentTemplateService';

export { formatDocumentAddress, isAddressComplete } from './formatDocumentAddress';

export {
  applyRecipientToContext,
  resolveInvoiceRecipient,
  type ResolvedRecipient,
} from './resolveDocumentRecipientAddress';

export { computeDocumentContentHash, computeDocumentPackageHash } from './documentHashService';

export {
  buildEdgeFunctionPdfPayload,
  executePdfRenderJob,
  getPdfEngineInfo,
  isPdfProductionAvailable,
  resetPdfRenderJobs,
} from './pdfRenderJobService';

export {
  attemptDirectDocumentEdit,
  confirmDocumentPreview,
  createDocumentCancellation,
  createDocumentCorrection,
  createLifecycleDocument,
  finalizeLifecycleDocument,
  getLifecycleAuditTrail,
  getLifecycleDocument,
  getLifecycleDocumentVersions,
  resetLifecycleDocumentStore,
  validateLifecycleDocument,
} from './documentLifecycleService';

export {
  attemptEditInvoice,
  checkElectronicInvoice,
  confirmInvoicePreview,
  createInvoiceCancellation,
  createInvoiceCorrection,
  createInvoiceDraft,
  finalizeInvoice,
  getEInvoiceUiState,
  getElectronicInvoiceData,
  getInvoice,
  getInvoiceAuditTrail,
  isInvoiceNumberUsed,
  resetInvoiceDocumentStore,
  patchInvoiceForTest,
  tryExportInvoiceXml,
  validateInvoiceForFinalization,
  EINVOICE_ENGINE_INFO as INVOICE_EINVOICE_ENGINE_INFO,
} from './invoiceDocumentService';

export {
  calculateInvoiceTax,
  formatCents,
  getTaxNotice,
  validateTaxLogicConsistency,
} from './invoiceTaxLogic';

export {
  allocateInvoiceNumber,
  resetInvoiceNumberRegistry,
  reserveInvoiceNumber,
  seedInvoiceNumber,
} from './invoiceNumberService';

export {
  STANDARD_INVOICE_HTML_TEMPLATE,
  invoiceToDocumentContext,
  renderLineItemsTableHtml,
  validateInvoiceRecord,
} from './invoiceValidation';

export {
  SYSTEM_TEMPLATE_SEEDS,
  SYSTEM_TEMPLATE_IDS,
  STANDARD_SYSTEM_TEMPLATE_CSS,
  buildStandardExampleContext,
} from './systemTemplateSeeds';

export {
  SYSTEM_TEMPLATE_COPY_NOTICE,
  SYSTEM_TEMPLATE_LEGAL_DISCLAIMER,
} from './systemTemplateLegal';

export {
  assertSystemTemplateNotEditable,
  buildSystemTemplateRenderContext,
  copySystemTemplateForTenant,
  getSystemTemplate,
  getSystemTemplateLegalDisclaimer,
  getSystemTemplateSeedCount,
  isSystemTemplateProtected,
  listSystemTemplates,
  resetAllDocumentTemplateStores,
  resetSystemTemplateStore,
  seedSystemTemplates,
  validateSystemTemplatePlaceholders,
  validateSystemTemplateRender,
  validateSystemTemplateRequiredFields,
} from './systemTemplateService';

export {
  createTenantTemplateFromSystem,
  isTenantOwnedTemplate,
} from './documentTemplateService';

export {
  buildElectronicInvoiceData,
  canExportElectronicInvoice,
  canGeneratePdfPlusXml,
  canGenerateXml,
  exportElectronicInvoice,
  isEInvoiceEngineAvailable,
  isEInvoiceValidatorAvailable,
  validateElectronicInvoiceData,
  EINVOICE_ENGINE_INFO,
} from './eInvoiceService';

export {
  createContractDraft,
  finalizeContract,
  confirmContractPreview,
  validateContractForFinalization,
  attemptEditContract,
  createContractCorrection,
  getContract,
  getContractAuditTrail,
  patchContractForTest,
  resetContractDocumentStore,
  CONTRACT_TYPE_LABELS,
} from './contractDocumentService';

export {
  STANDARD_CONTRACT_HTML_TEMPLATE,
  FINALIZE_CONTRACT_HTML_TEMPLATE,
  contractToDocumentContext,
  getContractTemplateVersionId,
  validateContractRecord,
} from './contractValidation';

export {
  createServiceProofDraft,
  addServiceProofDeployment,
  recalculateMonthlyProofTotals,
  confirmServiceProofPreview,
  signAndFinalizeServiceProof,
  validateServiceProofForFinalization,
  attemptEditServiceProof,
  createServiceProofCorrection,
  getServiceProof,
  getServiceProofAuditTrail,
  getServiceProofPdfState,
  renderServiceProofDocumentHtml,
  buildServiceProofDocumentHtml,
  patchServiceProofForTest,
  resetServiceProofDocumentStore,
  SERVICE_PROOF_TYPE_LABELS,
} from './serviceProofDocumentService';

export {
  STANDARD_SERVICE_PROOF_HTML_TEMPLATE,
  FINALIZE_SERVICE_PROOF_HTML_TEMPLATE,
  getServiceProofTemplateVersionId,
  renderDeploymentsTableHtml,
  serviceProofToDocumentContext,
  validateServiceProofForSignature,
  validateServiceProofRecord,
  sumDeploymentHours,
  computeDurationMinutes,
} from './serviceProofValidation';

export {
  createDocumentationDraft,
  confirmDocumentationPreview,
  finalizeDocumentation,
  validateDocumentationForFinalization,
  attemptEditDocumentation,
  createDocumentationCorrection,
  getDocumentation,
  getDocumentationAuditTrail,
  patchDocumentationForTest,
  resetDocumentationDocumentStore,
  DOCUMENTATION_TYPE_LABELS,
} from './documentationDocumentService';

export {
  STANDARD_DOCUMENTATION_HTML_TEMPLATE,
  FINALIZE_DOCUMENTATION_HTML_TEMPLATE,
  documentationToDocumentContext,
  getDocumentationTemplateVersionId,
  validateDocumentationRecord,
} from './documentationValidation';

export { bootstrapDocumentEngine, resetDocumentEngineBootstrap } from './documentEngineBootstrap';
export { buildGeneratedDocumentFileName } from './documentFileNameService';

export {
  assertDocumentActionAllowed,
  buildDocumentActionGateContext,
  buildDocumentActionGateContextForRole,
  isServiceProofLocked,
} from './documentActionGate';
