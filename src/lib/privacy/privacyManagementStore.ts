import type {
  PrivacyAuditEvent,
  PrivacyConsentRecord,
  PrivacyDataExportJob,
  PrivacyDataSubjectRequest,
  PrivacyDeletionRequest,
  PrivacyDpaRecord,
  PrivacyIncidentReport,
  PrivacyProcessingActivity,
  PrivacyRetentionRule,
  PrivacyTomRecord,
} from '@/types/modules/privacyManagement';

export type PrivacyManagementStoreState = {
  processingActivities: PrivacyProcessingActivity[];
  tomRecords: PrivacyTomRecord[];
  dpaRecords: PrivacyDpaRecord[];
  dataSubjectRequests: PrivacyDataSubjectRequest[];
  exportJobs: PrivacyDataExportJob[];
  deletionRequests: PrivacyDeletionRequest[];
  consentRecords: PrivacyConsentRecord[];
  retentionRules: PrivacyRetentionRule[];
  incidentReports: PrivacyIncidentReport[];
  auditEvents: PrivacyAuditEvent[];
};

export const PRIVACY_MANAGEMENT_STORE: PrivacyManagementStoreState = {
  processingActivities: [],
  tomRecords: [],
  dpaRecords: [],
  dataSubjectRequests: [],
  exportJobs: [],
  deletionRequests: [],
  consentRecords: [],
  retentionRules: [],
  incidentReports: [],
  auditEvents: [],
};

let activityCounter = 0;
let tomCounter = 0;
let dpaCounter = 0;
let requestCounter = 0;
let exportCounter = 0;
let deletionCounter = 0;
let consentCounter = 0;
let retentionCounter = 0;
let incidentCounter = 0;
let auditCounter = 0;

export function nextPrivacyActivityId(): string {
  activityCounter += 1;
  return `priv-act-${activityCounter}`;
}

export function nextPrivacyTomId(): string {
  tomCounter += 1;
  return `priv-tom-${tomCounter}`;
}

export function nextPrivacyDpaId(): string {
  dpaCounter += 1;
  return `priv-dpa-${dpaCounter}`;
}

export function nextPrivacyRequestId(): string {
  requestCounter += 1;
  return `priv-dsr-${requestCounter}`;
}

export function nextPrivacyExportJobId(): string {
  exportCounter += 1;
  return `priv-export-${exportCounter}`;
}

export function nextPrivacyDeletionId(): string {
  deletionCounter += 1;
  return `priv-del-${deletionCounter}`;
}

export function nextPrivacyConsentId(): string {
  consentCounter += 1;
  return `priv-consent-${consentCounter}`;
}

export function nextPrivacyRetentionId(): string {
  retentionCounter += 1;
  return `priv-ret-${retentionCounter}`;
}

export function nextPrivacyIncidentId(): string {
  incidentCounter += 1;
  return `priv-inc-${incidentCounter}`;
}

export function nextPrivacyAuditId(): string {
  auditCounter += 1;
  return `priv-audit-${auditCounter}`;
}

export function filterPrivacyByTenant<T extends { tenantId: string }>(rows: T[], tenantId: string): T[] {
  return rows.filter((row) => row.tenantId === tenantId);
}

export function getPrivacyRequestById(
  tenantId: string,
  requestId: string,
): PrivacyDataSubjectRequest | null {
  return PRIVACY_MANAGEMENT_STORE.dataSubjectRequests.find(
    (row) => row.tenantId === tenantId && row.id === requestId,
  ) ?? null;
}

export function getPrivacyDeletionByRequestId(
  tenantId: string,
  requestId: string,
): PrivacyDeletionRequest | null {
  return PRIVACY_MANAGEMENT_STORE.deletionRequests.find(
    (row) => row.tenantId === tenantId && row.requestId === requestId,
  ) ?? null;
}

export function listPrivacyRetentionRules(tenantId: string): PrivacyRetentionRule[] {
  return filterPrivacyByTenant(PRIVACY_MANAGEMENT_STORE.retentionRules, tenantId).filter(
    (row) => row.status === 'active',
  );
}

export function resetPrivacyManagementStore(): void {
  PRIVACY_MANAGEMENT_STORE.processingActivities.length = 0;
  PRIVACY_MANAGEMENT_STORE.tomRecords.length = 0;
  PRIVACY_MANAGEMENT_STORE.dpaRecords.length = 0;
  PRIVACY_MANAGEMENT_STORE.dataSubjectRequests.length = 0;
  PRIVACY_MANAGEMENT_STORE.exportJobs.length = 0;
  PRIVACY_MANAGEMENT_STORE.deletionRequests.length = 0;
  PRIVACY_MANAGEMENT_STORE.consentRecords.length = 0;
  PRIVACY_MANAGEMENT_STORE.retentionRules.length = 0;
  PRIVACY_MANAGEMENT_STORE.incidentReports.length = 0;
  PRIVACY_MANAGEMENT_STORE.auditEvents.length = 0;
  activityCounter = 0;
  tomCounter = 0;
  dpaCounter = 0;
  requestCounter = 0;
  exportCounter = 0;
  deletionCounter = 0;
  consentCounter = 0;
  retentionCounter = 0;
  incidentCounter = 0;
  auditCounter = 0;
}

export function seedDefaultPrivacyRetentionRules(tenantId: string): void {
  if (listPrivacyRetentionRules(tenantId).length > 0) return;
  const now = new Date().toISOString();
  const defaults: Omit<PrivacyRetentionRule, 'id' | 'createdAt' | 'updatedAt'>[] = [
    {
      tenantId,
      entityType: 'client_care_record',
      label: 'Pflegedokumentation',
      retentionDays: 3650,
      legalReference: '§ 630f BGB',
      blockDeletionUntil: true,
      status: 'active',
    },
    {
      tenantId,
      entityType: 'invoice',
      label: 'Rechnungsunterlagen',
      retentionDays: 3650,
      legalReference: '§ 147 AO',
      blockDeletionUntil: true,
      status: 'active',
    },
    {
      tenantId,
      entityType: 'applicant',
      label: 'Bewerberunterlagen',
      retentionDays: 180,
      legalReference: 'DSGVO Art. 5 Abs. 1 lit. e',
      blockDeletionUntil: true,
      status: 'active',
    },
  ];
  for (const row of defaults) {
    PRIVACY_MANAGEMENT_STORE.retentionRules.push({
      id: nextPrivacyRetentionId(),
      createdAt: now,
      updatedAt: now,
      ...row,
    });
  }
}

export function seedPreparedPrivacyIncidents(tenantId: string): void {
  if (filterPrivacyByTenant(PRIVACY_MANAGEMENT_STORE.incidentReports, tenantId).length > 0) return;
  const now = new Date().toISOString();
  PRIVACY_MANAGEMENT_STORE.incidentReports.push({
    id: nextPrivacyIncidentId(),
    tenantId,
    title: 'Datenschutzvorfall-Management',
    description: 'Meldeprozess und Dokumentation vorbereitet — noch nicht produktiv.',
    severity: 'medium',
    status: 'prepared',
    reportedAt: null,
    preparedOnly: true,
    createdAt: now,
    updatedAt: now,
  });
}
