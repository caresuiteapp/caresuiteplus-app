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
  fetchClientPortalProfile,
  fetchClientCarePlanSummaries,
} from './clientProfileService';
export {
  canViewPortalEntity,
  filterPortalEntities,
  getPortalProfileLink,
  resolvePortalScope,
  DEMO_PORTAL_LINKS,
  type PortalProfileLink,
} from './portalVisibility';
