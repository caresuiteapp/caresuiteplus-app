import type { RoleKey } from '../core/auth';
import type { ClientVisitRequestStatus, ClientVisitRequestType } from '../modules/assignmentWorkflow';

/** Portal-Rollen laut Prompt 59 */
export type ClientPortalRole = 'client' | 'representative' | 'family_contact' | 'legal_guardian';

export type ClientMessageRecipient =
  | 'administration'
  | 'billing'
  | 'planning'
  | 'general_support';

export type ClientMessageType =
  | 'general'
  | 'appointment_question'
  | 'cancel'
  | 'reschedule'
  | 'complaint'
  | 'callback'
  | 'document_submit'
  | 'invoice_question'
  | 'service_proof_question';

export type ClientMessageStatus =
  | 'draft'
  | 'sent'
  | 'received'
  | 'read'
  | 'answered'
  | 'archived'
  | 'escalated';

export type ClientPortalMessage = {
  id: string;
  tenantId: string;
  clientId: string;
  threadId: string;
  recipient: ClientMessageRecipient;
  messageType: ClientMessageType;
  status: ClientMessageStatus;
  subject: string;
  body: string;
  sentByProfileId: string;
  assignmentId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ClientVisibleDocument = {
  id: string;
  tenantId: string;
  clientId: string;
  documentId: string;
  title: string;
  category: string;
  releasedAt: string | null;
  requiresSignature: boolean;
  signatureRequired: boolean;
  locked: boolean;
  processActive: boolean;
};

export type ClientDocumentSignature = {
  id: string;
  tenantId: string;
  clientId: string;
  documentId: string;
  signerName: string;
  signerRole: ClientPortalRole;
  signedAt: string;
  deviceSession: string;
  signatureHash: string;
  capturedIp: string | null;
};

export type ClientPortalAuditEvent = {
  id: string;
  tenantId: string;
  clientId: string;
  action: string;
  actorProfileId: string | null;
  summary: string;
  metadata?: Record<string, string>;
  createdAt: string;
};

export type ClientPortalContext = {
  tenantId: string;
  clientId: string;
  profileId: string;
  roleKey: RoleKey;
  portalRole: ClientPortalRole;
  sharedClientIds: string[];
};

export type ClientPortalVisitRequestSummary = {
  id: string;
  assignmentId: string;
  requestType: ClientVisitRequestType;
  status: ClientVisitRequestStatus;
  reason: string;
  requestedAt: string;
};

export type ClientPortalDashboard = {
  nextPlannedAssignment: ClientPortalPlannedAssignment | null;
  upcomingAssignments: ClientPortalPlannedAssignment[];
  recentCompleted: ClientPortalCompletedAssignment[];
  openMessageCount: number;
  documentsToSign: number;
  visitRequestStatuses: ClientPortalVisitRequestSummary[];
  adminNotices: string[];
  importantContacts: Array<{ label: string; phone: string | null }>;
};

export type ClientPortalPlannedAssignment = {
  id: string;
  assignmentId: string;
  date: string;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  serviceType: string;
  status: string;
  employeeName: string | null;
  notes: string | null;
  canRequestCancel: boolean;
  canRequestReschedule: boolean;
};

export type ClientPortalCompletedAssignment = {
  id: string;
  assignmentId: string;
  date: string;
  actualDurationMinutes: number | null;
  serviceType: string;
  status: string;
  serviceProofReleased: boolean;
  shortReport: string | null;
  releasedDocumentIds: string[];
};

export type ClientPortalDigitalFile = {
  masterData: {
    displayName: string;
    city: string | null;
    zip: string | null;
    careLevel: string | null;
  };
  contracts: ClientVisibleDocument[];
  consents: ClientVisibleDocument[];
  plannedAssignments: ClientPortalPlannedAssignment[];
  completedAssignments: ClientPortalCompletedAssignment[];
  releasedDocuments: ClientVisibleDocument[];
  messages: ClientPortalMessage[];
  visitRequests: ClientPortalVisitRequestSummary[];
};
