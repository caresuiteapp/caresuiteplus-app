export {
  fetchPortalMessages,
  fetchOfficeMessages,
  fetchUnreadMessageCount,
  fetchPortalMessageDetail,
  replyToPortalMessage,
  replyToOfficeMessage,
} from './messageService';
export {
  fetchPortalDocuments,
  fetchOfficeDocuments,
  fetchPortalDocumentDetail,
  downloadPortalDocument,
  formatFileSize,
} from './documentService';
export {
  fetchPortalAppointments,
  fetchPortalAppointmentDetail,
  fetchPortalClientAppointmentDetail,
  requestPortalAppointmentChange,
  type PortalAppointmentItem,
} from './appointmentService';
export {
  fetchEmployeePortalProfile,
  fetchEmployeeTimesheet,
} from './employeeProfileService';
export {
  fetchEmployeePortalOverview,
  fetchEmployeePortalAssignmentDetail,
  transitionEmployeePortalAssignment,
  updateEmployeePortalTask,
  submitEmployeePortalDocumentation,
  captureEmployeePortalAssignmentSignature,
  completeEmployeePortalAssignment,
  buildEmployeePortalRoute,
  getEmployeePortalExecutionAuditTrail,
  resetEmployeePortalExecutionStore,
} from './employeePortalExecutionService';
export {
  captureEmployeePortalSignature,
  listEmployeePortalSignatures,
  hasRequiredSignature,
  lockEmployeePortalSignatures,
  resetEmployeePortalSignatureStore,
} from './employeePortalSignatureService';
export {
  resolveEnabledExecutionModules,
  canCaptureGps,
  canUseLiveTracking,
  canViewAccessHints,
  canViewEmergencyContact,
} from './employeePortalModuleAccess';
export {
  fetchClientPortalProfile,
  fetchClientCarePlanSummaries,
} from './clientProfileService';
export {
  resolveClientPortalContext,
  fetchClientPortalDashboard as fetchClientPortalDomainDashboard,
  fetchClientPlannedAssignments,
  fetchClientCompletedAssignments,
  fetchClientDigitalFile,
  getClientPortalAssignmentDetail,
  stripInternalAssignmentFields,
  assertClientPortalProductionSafe,
} from './clientPortalDomainService';
export {
  sendClientPortalMessage,
  listClientPortalMessages,
  countOpenClientPortalMessages,
  getClientPortalAuditTrail,
  buildClientPortalContext,
  resetClientMessagePortalStore,
} from './clientMessagePortalService';
export {
  signClientDocument,
  listReleasedDocumentsForClient,
  countDocumentsToSign,
  isDocumentReleasedForPortal,
  getClientDocumentSignatures,
  resetClientDocumentSignatureStore,
} from './clientDocumentSignatureService';
export { fetchClientPortalDashboard } from './clientPortalService';
export {
  canViewPortalEntity,
  filterPortalEntities,
  getPortalProfileLink,
  resolvePortalScope,
  DEMO_PORTAL_LINKS,
  type PortalProfileLink,
} from './portalVisibility';
