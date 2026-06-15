import type { ISODateTime, TenantScopedEntity } from '../../core/base';

/** Verbindungsstatus der Telematikinfrastruktur */
export type TIConnectionStatus =
  | 'not_configured'
  | 'provider_configured'
  | 'provider_connected'
  | 'ti_verified'
  | 'kim_active'
  | 'partially_available'
  | 'blocked_missing_permission'
  | 'blocked_missing_consent'
  | 'provider_error'
  | 'disabled';

export type TIConsentStatus = 'pending' | 'granted' | 'revoked' | 'expired';

export type KIMMessageStatus = 'unread' | 'read' | 'archived' | 'error';

export type TIProviderKind = 'kim' | 'egk' | 'epa' | 'emp' | 'erezept' | 'connector';

export type TIProvider = TenantScopedEntity & {
  name: string;
  kind: TIProviderKind;
  connectionStatus: TIConnectionStatus;
  /** Nur Vault-Referenz — niemals Klartext-Secrets im Client */
  secretReference: string | null;
  endpointUrl: string | null;
  lastCheckAt: ISODateTime | null;
  lastError: string | null;
  isActive: boolean;
};

export type KIMMailbox = TenantScopedEntity & {
  address: string;
  displayName: string;
  providerId: string;
  unreadCount: number;
  lastSyncAt: ISODateTime | null;
  syncStatus: 'idle' | 'syncing' | 'error';
};

export type KIMMessage = TenantScopedEntity & {
  mailboxId: string;
  sender: string;
  senderName: string | null;
  subject: string;
  preview: string;
  body: string;
  status: KIMMessageStatus;
  receivedAt: ISODateTime;
  hasAttachments: boolean;
  isMedical: boolean;
};

export type KIMAttachment = TenantScopedEntity & {
  messageId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  /** Import nur nach manueller Bestätigung */
  importStatus: 'pending' | 'confirmed' | 'imported' | 'rejected';
  suggestedAssignment: string | null;
};

export type TIDocumentAssignment = TenantScopedEntity & {
  sourceMessageId: string | null;
  sourceAttachmentId: string | null;
  clientId: string | null;
  documentType: string;
  status: 'suggested' | 'confirmed' | 'assigned' | 'rejected';
  confirmedBy: string | null;
  confirmedAt: ISODateTime | null;
};

export type EGKInsuranceDataDraft = TenantScopedEntity & {
  clientId: string | null;
  insuranceNumber: string | null;
  insurerName: string | null;
  validFrom: ISODateTime | null;
  validTo: ISODateTime | null;
  rawDataRef: string | null;
  status: 'draft' | 'verified' | 'expired';
};

export type EPAConnection = TenantScopedEntity & {
  clientId: string | null;
  epaId: string | null;
  connectionStatus: TIConnectionStatus;
  lastAccessAt: ISODateTime | null;
};

export type EMPMedicationPlan = TenantScopedEntity & {
  clientId: string | null;
  planVersion: string;
  validFrom: ISODateTime;
  validTo: ISODateTime | null;
  status: 'draft' | 'active' | 'superseded';
};

export type EMPMedicationItem = TenantScopedEntity & {
  planId: string;
  substance: string;
  dosage: string;
  frequency: string;
  pzn: string | null;
};

export type ERezeptItem = TenantScopedEntity & {
  clientId: string | null;
  prescriptionId: string;
  medication: string;
  status: 'pending' | 'dispensed' | 'cancelled';
  issuedAt: ISODateTime;
};

export type TIConsent = TenantScopedEntity & {
  scope: 'kim' | 'egk' | 'epa' | 'emp' | 'erezept' | 'ti_general';
  status: TIConsentStatus;
  version: number;
  grantedAt: ISODateTime | null;
  revokedAt: ISODateTime | null;
  expiresAt: ISODateTime | null;
  grantedBy: string | null;
  legalBasis: string;
  description: string;
};

export type TIAuditAction =
  | 'consent_granted'
  | 'consent_revoked'
  | 'message_opened'
  | 'message_status_changed'
  | 'attachment_import_requested'
  | 'attachment_import_confirmed'
  | 'provider_check'
  | 'provider_configured'
  | 'audit_export'
  | 'permission_denied';

export type TIAuditEvent = TenantScopedEntity & {
  action: TIAuditAction;
  actorId: string | null;
  actorName: string;
  resourceType: string;
  resourceId: string | null;
  details: string | null;
  ipAddress: string | null;
};

export type TIPermission =
  | 'ti.view'
  | 'ti.admin'
  | 'ti.kim.view'
  | 'ti.kim.manage'
  | 'ti.consent.manage'
  | 'ti.audit.view'
  | 'ti.provider.manage'
  | 'ti.egk.view'
  | 'ti.epa.view'
  | 'ti.emp.view'
  | 'ti.erezept.view';

/** DTOs */
export type TIProviderListItem = Pick<
  TIProvider,
  | 'id'
  | 'tenantId'
  | 'name'
  | 'kind'
  | 'connectionStatus'
  | 'secretReference'
  | 'endpointUrl'
  | 'lastCheckAt'
  | 'lastError'
  | 'isActive'
  | 'updatedAt'
>;

export type KIMMessageListItem = Pick<
  KIMMessage,
  | 'id'
  | 'tenantId'
  | 'mailboxId'
  | 'sender'
  | 'senderName'
  | 'subject'
  | 'preview'
  | 'status'
  | 'receivedAt'
  | 'hasAttachments'
  | 'isMedical'
>;

export type KIMMessageDetail = KIMMessage & {
  attachments: KIMAttachment[];
};

export type KIMMailboxQuery = {
  mailboxId?: string;
  status?: KIMMessageStatus | 'all';
  search?: string;
  page?: number;
  pageSize?: number;
  sortDirection?: 'asc' | 'desc';
};

export type KIMMailboxResult = {
  items: KIMMessageListItem[];
  totalCount: number;
  filteredCount: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
};

export type TIDashboardSnapshot = {
  connectionStatus: TIConnectionStatus;
  kpis: { id: string; label: string; value: number | string; subValue?: string }[];
  moduleStatus: { module: string; status: TIConnectionStatus; label: string }[];
  unreadKimCount: number;
  pendingConsents: number;
  lastAuditAt: ISODateTime | null;
  syncStatus: 'idle' | 'syncing' | 'error';
};

export type TIAuditLogQuery = {
  action?: TIAuditAction | 'all';
  search?: string;
  page?: number;
  pageSize?: number;
};

export type TIAuditLogResult = {
  items: TIAuditEvent[];
  totalCount: number;
  filteredCount: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
};

export type TIConsentCheckResult = {
  hasConsent: boolean;
  missingScopes: TIConsent['scope'][];
  blockedReason: string | null;
};

export type TIProviderCheckResult = {
  providerId: string;
  status: TIConnectionStatus;
  checkedAt: ISODateTime;
  message: string;
};

export type KIMAttachmentImportRequest = {
  attachmentId: string;
  confirmed: boolean;
  assignToClientId?: string;
};

export const TI_CONNECTION_STATUS_LABELS: Record<TIConnectionStatus, string> = {
  not_configured: 'Nicht konfiguriert',
  provider_configured: 'Provider konfiguriert',
  provider_connected: 'Verbunden',
  ti_verified: 'TI verifiziert',
  kim_active: 'KIM aktiv',
  partially_available: 'Teilweise verfügbar',
  blocked_missing_permission: 'Berechtigung fehlt',
  blocked_missing_consent: 'Einwilligung fehlt',
  provider_error: 'Provider-Fehler',
  disabled: 'Deaktiviert',
};

export const KIM_MESSAGE_STATUS_LABELS: Record<KIMMessageStatus, string> = {
  unread: 'Ungelesen',
  read: 'Gelesen',
  archived: 'Archiviert',
  error: 'Fehlerhaft',
};

export const TI_CONSENT_STATUS_LABELS: Record<TIConsentStatus, string> = {
  pending: 'Ausstehend',
  granted: 'Erteilt',
  revoked: 'Widerrufen',
  expired: 'Abgelaufen',
};

export const TI_CONSENT_SCOPE_LABELS: Record<TIConsent['scope'], string> = {
  kim: 'KIM-Nachrichten',
  egk: 'eGK-Versicherungsdaten',
  epa: 'ePA-Zugriff',
  emp: 'eMP-Medikationsplan',
  erezept: 'E-Rezept',
  ti_general: 'Telematikinfrastruktur allgemein',
};
