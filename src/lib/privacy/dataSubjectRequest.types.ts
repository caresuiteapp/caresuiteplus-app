export type DataRequestType =
  | 'access'
  | 'export'
  | 'correction'
  | 'deletion'
  | 'restriction'
  | 'objection'
  | 'portability'
  | 'consent_withdrawal'
  | 'other';

export type DataSubjectRequestStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export type DataSubjectRequest = {
  id: string;
  tenantId: string;
  profileId: string | null;
  requestType: DataRequestType;
  status: DataSubjectRequestStatus;
  requesterName: string | null;
  requesterEmail: string | null;
  verificationNotes: string | null;
  requestNumber: string | null;
  receivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SubmitDataSubjectRequestInput = {
  requestType: DataRequestType;
  requesterName: string;
  requesterEmail: string;
  verificationNotes?: string;
  profileId?: string | null;
};
