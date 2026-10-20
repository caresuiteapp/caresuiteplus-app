import type { WorkflowStatus } from '@/types';

export type CsDocumentEmployeeRecipient = {
  id: string;
  fullName: string;
  email: string | null;
  jobTitle: string | null;
  status: WorkflowStatus;
  statusLabel: string;
  portalActive: boolean;
  portalLabel: string;
  lastLoginAt: string | null;
};

export type CsDocumentClientRecipient = {
  id: string;
  fullName: string;
  locationLabel: string | null;
  careLevel: string | null;
  payorName: string | null;
  representativeName: string | null;
  status: WorkflowStatus;
  statusLabel: string;
  portalActive: boolean;
  portalLabel: string;
};

export type CsAssignmentBlockingDocument = {
  requestId: string;
  title: string;
  status: string;
  requiredSignatures: string[];
  missingSignatures: string[];
};

export type CsAssignmentBlockingResult = {
  hasBlockingDocuments: boolean;
  blockingRequests: CsAssignmentBlockingDocument[];
  reason: string | null;
};
