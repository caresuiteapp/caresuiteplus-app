export {
  fetchAssignmentList,
  fetchAssistDashboardStats,
  fetchClientAssignments,
  fetchTodayAssignments,
} from './assignmentListService';
export {
  EMPTY_ASSIST_DASHBOARD_STATS,
  fetchAssistDashboardBundle,
  pickNextAssignment,
  pickRunningAssignment,
} from './assistDashboardService';
export type { AssistDashboardBundle } from './assistDashboardService';
export {
  ASSIST_VISIT_LIFECYCLE_LABELS,
  applyAssistVisitTransition,
  getAssistVisitAllowedTransitions,
  isAssistVisitBillingHandoffReady,
  mapAssignmentStatusToLifecycle,
  validateAssistVisitTransition,
} from './assistVisitStateMachine';
export type { AssistVisitLifecycleStatus } from './assistVisitStateMachine';
export { fetchExecutionList } from './executionListService';
export { fetchAssignmentDetail, updateAssignmentStatus } from './assignmentDetailService';
export {
  fetchActiveExecutions,
  fetchAssignmentExecution,
  checkInAssignment,
  startAssignmentWork,
  checkOutAssignment,
} from './executionService';
export {
  fetchCareRecordList,
  fetchCareRecordDetail,
  createCareRecordFromExecution,
  signCareRecord,
  exportCareRecordPdf,
} from './careRecordService';
export {
  fetchVisitDispositionList,
  fetchVisitDispositionDetail,
  updateVisitDispositionStatus,
  deleteVisitDisposition,
  createVisitFromWizard,
  updateVisitFromWizard,
  buildVisitDispositionKpis,
  fetchVisitStatusHistory,
} from './visitService';
export type { VisitStatusHistoryEntry } from './visitService';
export {
  updateVisitTaskStatus,
  updateVisitDocumentation,
  validateVisitCloseReadiness,
} from './visitExecutionService';
export { buildAssistSetupHints } from './assistSetupHints';
export type { AssistSetupHint } from './assistSetupHints';
export { buildVisitProofPreview } from './visitProofPreviewService';
export type { VisitProofPreview } from './visitProofPreviewService';
export {
  getVisitSignature,
  saveVisitSignature,
  clearVisitSignature,
  hasVisitSignature,
} from './visitSignatureSessionStore';
export type { VisitSignatureCapture } from './visitSignatureSessionStore';
export {
  isAssistExecutionPersistenceReady,
  fetchValidVisitSignature,
} from './assistExecutionPersistenceService';
export {
  fetchLatestVisitProof,
  fetchVisitProofById,
  listVisitProofs,
  persistVisitProof,
} from './assistVisitProofPersistenceService';
export {
  submitProofForReview,
  approveAssistProof,
  approveAndReleaseAssistProof,
  rejectAssistProof,
  releaseAssistProofToPortal,
  revokeAssistProofPortalRelease,
} from './assistProofApprovalService';
export {
  buildVisitProofPreviewFromProof,
  enrichVisitProofForPreview,
  proofHasClientSignature,
} from './visitProofSnapshotPreviewService';
export {
  ASSIST_PROOF_STATUS_LABELS,
  ASSIST_PROOF_PORTAL_RELEASE_LABELS,
} from './assistProofLabels';
export {
  buildAssistProofPdfPayload,
  stripGpsKeysFromSnapshot,
} from './assistProofPdfPayload';
export {
  generateAssistProofPdf,
  downloadAssistProofPdfInBrowser,
  resolveAssistProofPdfPreviewUrl,
  renderAssistProofPdfBytes,
  renderHtmlToPdfBytes,
} from './assistProofPdfService';
export {
  upsertAssistProofClientPortalDocument,
  revokeAssistProofClientPortalDocument,
} from './assistProofPortalDocumentService';
export {
  fetchActiveTrackingSession,
  fetchLatestLocationPointForVisit,
  fetchTimeEventsForVisit,
  startTrackingSession,
  appendLocationPoint,
  recordTimeEvent,
  recordGeofenceEvent,
  appendDrivingLogEntry,
} from './assistTrackingPersistenceService';
export {
  saveVisitSignaturePersistent,
  computeVisitSignaturePayloadHash,
} from './assistVisitSignaturePersistenceService';
export type {
  AssistVisitSignatureRow,
  AssistVisitProofRow,
  AssistTrackingSessionRow,
} from '@/types/assistExecutionPersistence';
export {
  fetchTripLogList,
  fetchTripDetail,
  fetchTrackingDashboard,
  completeTrip,
  PURPOSE_LABELS,
} from './tripLogService';
