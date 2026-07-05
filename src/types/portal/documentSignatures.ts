/** Document types that Office can send for signature. */
export type PortalSignatureDocumentType =
  | 'arbeitsvertrag'
  | 'zusatzvereinbarung'
  | 'belehrung'
  | 'datenschutz'
  | 'schweigepflicht'
  | 'dienstanweisung'
  | 'empfangsbestaetigung'
  | 'schulungsnachweis'
  | 'einwilligung'
  | 'leistungsnachweis'
  | 'pflegeunterlage'
  | 'kostentraegerformular'
  | 'sonstiges';

export const PORTAL_SIGNATURE_DOCUMENT_TYPE_LABELS: Record<
  PortalSignatureDocumentType,
  string
> = {
  arbeitsvertrag: 'Arbeitsvertrag',
  zusatzvereinbarung: 'Zusatzvereinbarung',
  belehrung: 'Belehrung',
  datenschutz: 'Datenschutz',
  schweigepflicht: 'Schweigepflicht',
  dienstanweisung: 'Dienstanweisung',
  empfangsbestaetigung: 'Empfangsbestätigung',
  schulungsnachweis: 'Schulungsnachweis',
  einwilligung: 'Einwilligung',
  leistungsnachweis: 'Leistungsnachweis',
  pflegeunterlage: 'Pflegeunterlage',
  kostentraegerformular: 'Kostenträgerformular',
  sonstiges: 'Sonstiges',
};

export type PortalSignatureRecipientType = 'employee' | 'client';

export type PortalSignatureRequirement = 'employee' | 'client' | 'both_sequential';

export type PortalSignaturePriority = 'low' | 'normal' | 'high' | 'urgent';

export const PORTAL_SIGNATURE_PRIORITY_LABELS: Record<PortalSignaturePriority, string> = {
  low: 'Niedrig',
  normal: 'Normal',
  high: 'Hoch',
  urgent: 'Dringend',
};

export type PortalSignatureDocumentStatus =
  | 'new'
  | 'open'
  | 'in_progress'
  | 'partially_signed'
  | 'fully_signed'
  | 'completed'
  | 'withdrawn'
  | 'expired';

export const PORTAL_SIGNATURE_STATUS_LABELS: Record<PortalSignatureDocumentStatus, string> = {
  new: 'Neu',
  open: 'Offen',
  in_progress: 'In Bearbeitung',
  partially_signed: 'Teilweise unterschrieben',
  fully_signed: 'Vollständig unterschrieben',
  completed: 'Abgeschlossen',
  withdrawn: 'Zurückgezogen',
  expired: 'Abgelaufen',
};

export type PortalSignatureFilterTab = 'open' | 'due_today' | 'overdue' | 'completed';

export const PORTAL_SIGNATURE_FILTER_TAB_LABELS: Record<PortalSignatureFilterTab, string> = {
  open: 'Offen',
  due_today: 'Heute fällig',
  overdue: 'Überfällig',
  completed: 'Erledigt',
};

export type PortalSignatureSignerRole = 'employee' | 'client';

export type PortalSignatureDocumentSourceType = 'template' | 'pdf_upload' | 'office_write';

export type PortalSignatureField = {
  id: string;
  role: PortalSignatureSignerRole;
  label: string;
  order: number;
  required: boolean;
};

export type PortalSignatureDocument = {
  id: string;
  tenantId: string;
  title: string;
  documentType: PortalSignatureDocumentType;
  recipientType: PortalSignatureRecipientType;
  employeeId: string | null;
  clientId: string | null;
  clientName: string | null;
  signatureRequirement: PortalSignatureRequirement;
  dueDate: string | null;
  priority: PortalSignaturePriority;
  requiredBeforeAssignment: boolean;
  assignmentId: string | null;
  status: PortalSignatureDocumentStatus;
  creatorName: string;
  createdAt: string;
  sentAt: string | null;
  completedAt: string | null;
  allowDownload: boolean;
  previewHtml: string | null;
  previewPdfUrl: string | null;
  storagePath: string | null;
  sourceDocumentId: string | null;
  documentSourceType: PortalSignatureDocumentSourceType;
  signatureFields: PortalSignatureField[];
  versionNumber: number;
  employeeSigned: boolean;
  clientSigned: boolean;
  nextSignerRole: PortalSignatureSignerRole | null;
};

export type PortalSignatureCapture = {
  id: string;
  documentId: string;
  tenantId: string;
  signerRole: PortalSignatureSignerRole;
  signerName: string;
  signedAt: string;
  signatureHash: string;
  auditId: string;
  deviceInfo: string | null;
  browser: string | null;
  capturedIp: string | null;
  storagePath: string | null;
};

export type PortalSignatureAuditEvent = {
  id: string;
  tenantId: string;
  documentId: string;
  eventType: string;
  summary: string;
  actorName: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type PortalSignatureDocumentDetail = PortalSignatureDocument & {
  captures: PortalSignatureCapture[];
  auditTrail: PortalSignatureAuditEvent[];
};

export type PortalSignatureDashboardCounts = {
  openCount: number;
  overdueCount: number;
  dueTodayCount: number;
};

export type OfficeCreateSignatureDocumentInput = {
  tenantId: string;
  title: string;
  documentType: PortalSignatureDocumentType;
  recipientType: PortalSignatureRecipientType;
  employeeId?: string | null;
  clientId?: string | null;
  clientName?: string | null;
  signatureRequirement: PortalSignatureRequirement;
  dueDate?: string | null;
  priority?: PortalSignaturePriority;
  requiredBeforeAssignment?: boolean;
  assignmentId?: string | null;
  allowDownload?: boolean;
  previewHtml?: string | null;
  storagePath?: string | null;
  sourceDocumentId?: string | null;
  documentSourceType?: PortalSignatureDocumentSourceType;
  signatureFields?: PortalSignatureField[];
  documentId?: string;
  creatorName: string;
  creatorProfileId?: string | null;
};

export type PortalSignDocumentInput = {
  tenantId: string;
  documentId: string;
  employeeId: string;
  signerRole: PortalSignatureSignerRole;
  signerName: string;
  signatureDataUrl: string;
  deviceInfo?: string | null;
  browser?: string | null;
  capturedIp?: string | null;
};
