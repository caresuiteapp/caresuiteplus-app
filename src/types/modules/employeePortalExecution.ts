import type { AssignmentStatus } from './assignmentStatus';
import type { CanonicalAssignmentStatus } from './assignmentWorkflow';
import type { ExtendedAssignmentTaskStatus } from './assignmentWorkflow';

export type EmployeePortalExecutionModule =
  | 'sis'
  | 'vitals'
  | 'body_map'
  | 'medication'
  | 'care_report'
  | 'photos';

export type EmployeePortalAssignmentListItem = {
  assignmentId: string;
  title: string;
  clientName: string;
  clientId: string;
  plannedStartAt: string;
  plannedEndAt: string;
  locationAddress: string;
  status: AssignmentStatus;
  canonicalStatus: CanonicalAssignmentStatus;
  documentationPending: boolean;
  signaturePending: boolean;
  isLocked: boolean;
};

export type EmployeePortalOverview = {
  todayAssignments: EmployeePortalAssignmentListItem[];
  nextAssignments: EmployeePortalAssignmentListItem[];
  weeklyPlan: EmployeePortalAssignmentListItem[];
  openDocumentations: number;
  missingSignatures: number;
  adminMessageCount: number;
  canReportProblem: boolean;
};

export type EmployeePortalStatusHistoryEntry = {
  id: string;
  fromStatus: AssignmentStatus | null;
  toStatus: AssignmentStatus;
  note: string | null;
  actorId: string | null;
  createdAt: string;
};

export type EmployeePortalPauseEvent = {
  id: string;
  pausedAt: string;
  resumedAt: string | null;
  reason: string | null;
};

export type EmployeePortalAssignmentDetail = {
  assignmentId: string;
  tenantId: string;
  title: string;
  clientId: string;
  clientName: string;
  locationAddress: string;
  plannedStartAt: string;
  plannedEndAt: string;
  actualStartAt: string | null;
  actualEndAt: string | null;
  onTheWayAt: string | null;
  arrivedAt: string | null;
  status: AssignmentStatus;
  canonicalStatus: CanonicalAssignmentStatus;
  notesForEmployee: string;
  accessHints: string | null;
  emergencyContact: string | null;
  tasks: EmployeePortalTaskItem[];
  statusHistory: EmployeePortalStatusHistoryEntry[];
  pauseEvents: EmployeePortalPauseEvent[];
  documentationStatus: 'none' | 'draft' | 'submitted' | 'locked';
  signatureStatus: 'none' | 'pending' | 'captured' | 'impossible_justified' | 'locked';
  requiresSignature: boolean;
  requiresDocumentation: boolean;
  requiresRoute: boolean;
  canStartExecution: boolean;
  canOpenRoute: boolean;
  canCaptureGps: boolean;
  allowedTransitions: AssignmentStatus[];
  isLocked: boolean;
  enabledModules: EmployeePortalExecutionModule[];
};

export type EmployeePortalTaskItem = {
  id: string;
  title: string;
  description: string;
  required: boolean;
  status: ExtendedAssignmentTaskStatus;
  completionNote: string | null;
  requiresNote: boolean;
};

export type EmployeePortalDocumentationInput = {
  shortDescription: string;
  specialNotes?: string;
  deviations?: string;
  deviationJustification?: string;
  referralRequired: boolean;
  emergencyOrProblem: boolean;
  sisNotes?: string;
  vitalsSummary?: string;
  bodyMapNotes?: string;
  medicationNotes?: string;
  careReportNotes?: string;
  photoReferences?: string[];
};

export type EmployeePortalDocumentationRecord = EmployeePortalDocumentationInput & {
  assignmentId: string;
  tenantId: string;
  submittedAt: string;
  submittedBy: string;
  locked: boolean;
};

export type EmployeePortalSignatureType =
  | 'assignment'
  | 'service_proof'
  | 'document'
  | 'contract';

export type EmployeePortalSignatureCaptureInput = {
  signatureType: EmployeePortalSignatureType;
  signerName: string;
  signatureDataUrl: string;
  relatedDocumentId?: string | null;
  signatureImpossibleReason?: string | null;
  deviceSessionId?: string | null;
};

export type EmployeePortalSignatureRecord = {
  id: string;
  tenantId: string;
  assignmentId: string;
  clientId: string;
  signatureType: EmployeePortalSignatureType;
  signerName: string;
  signedAt: string;
  signedTimeLocal: string;
  deviceSessionId: string;
  contentHash: string;
  relatedDocumentId: string | null;
  capturedBy: string;
  signatureDataUrl: string;
  locked: boolean;
};

export type EmployeePortalRouteAction = {
  mapUrl: string;
  internalMapAvailable: boolean;
};

export type EmployeePortalCompletionResult = {
  assignmentId: string;
  status: AssignmentStatus;
  lockedAt: string;
  serviceProofJobId: string | null;
  auditEventId: string;
};
