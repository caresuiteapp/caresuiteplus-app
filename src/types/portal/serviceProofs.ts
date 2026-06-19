export type PortalServiceProofStatus = 'offen' | 'unterschrieben' | 'abgerechnet';

export type PortalServiceProof = {
  id: string;
  tenantId: string;
  clientId: string;
  title: string;
  periodLabel: string;
  status: PortalServiceProofStatus;
  fileName: string;
  mimeType: string;
  storagePath: string | null;
  signatureRequired: boolean;
  signedAt: string | null;
  createdAt: string;
  serviceRecordId: string | null;
};
