export type PortalUploadStatus = 'hochgeladen' | 'wird_geprueft' | 'freigegeben' | 'abgelehnt';

export type PortalUpload = {
  id: string;
  tenantId: string;
  clientId: string;
  portalUserId: string | null;
  portalRequestId: string | null;
  storagePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number | null;
  category: string | null;
  message: string | null;
  status: PortalUploadStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  clientDocumentId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PortalDocumentUploadInput = {
  tenantId: string;
  clientId: string;
  portalUserId?: string | null;
  moduleKey?: string;
  fileName: string;
  mimeType: string;
  sizeBytes?: number;
  contentBase64: string;
  message?: string | null;
  category?: string | null;
};

export type ApprovePortalUploadInput = {
  tenantId: string;
  uploadId: string;
  reviewedBy: string | null;
  title?: string;
  category?: string;
  portalVisible?: boolean;
};

export type RejectPortalUploadInput = {
  tenantId: string;
  uploadId: string;
  reviewedBy: string | null;
  reviewNote?: string | null;
};

export const PORTAL_UPLOAD_STATUS_LABELS: Record<PortalUploadStatus, string> = {
  hochgeladen: 'Hochgeladen',
  wird_geprueft: 'Wird geprüft',
  freigegeben: 'Freigegeben',
  abgelehnt: 'Abgelehnt',
};
