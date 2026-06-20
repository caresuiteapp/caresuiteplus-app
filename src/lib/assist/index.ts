export {
  fetchAssignmentList,
  fetchAssistDashboardStats,
  fetchClientAssignments,
  fetchTodayAssignments,
} from './assignmentListService';
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
  createVisitFromWizard,
  buildVisitDispositionKpis,
} from './visitService';
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
} from './assistVisitProofPersistenceService';
export {
  fetchActiveTrackingSession,
} from './assistTrackingPersistenceService';
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
