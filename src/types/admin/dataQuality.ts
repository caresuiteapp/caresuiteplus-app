import type { EntityId, ISODateTime } from '@/types/core/base';

/** Aggregierter Qualitätsstatus je Stammdatenbereich */
export type DataQualityStatus =
  | 'complete'
  | 'warning'
  | 'incomplete'
  | 'invalid'
  | 'blocked'
  | 'needs_review';

export type DataQualityErrorType =
  | 'missing_required_field'
  | 'invalid_format'
  | 'conflicting_data'
  | 'missing_permission'
  | 'missing_consent'
  | 'missing_recipient'
  | 'missing_signature'
  | 'missing_documentation'
  | 'missing_billing_data'
  | 'missing_budget'
  | 'missing_tax_logic'
  | 'missing_ik_data'
  | 'missing_bank_account'
  | 'missing_template_data'
  | 'cross_tenant_risk';

export type MasterDataEntityType =
  | 'tenant'
  | 'client'
  | 'employee'
  | 'assignment'
  | 'service_record'
  | 'invoice'
  | 'document'
  | 'portal';

export type DataQualityIssue = {
  type: DataQualityErrorType;
  fieldKey: string;
  message: string;
  severity: 'error' | 'warning';
};

export type DataQualityResult = {
  status: DataQualityStatus;
  errors: DataQualityIssue[];
  warnings: DataQualityIssue[];
  blockingIssues: DataQualityIssue[];
  recommendedActions: string[];
  relatedEntityType: MasterDataEntityType;
  relatedEntityId: EntityId;
  validatedAt: ISODateTime;
};

export type DataQualityAreaKey =
  | 'tenant'
  | 'clients'
  | 'employees'
  | 'assignments'
  | 'service_records'
  | 'invoices'
  | 'documents'
  | 'portals'
  | 'overview';

export type DataQualityAreaSummary = {
  areaKey: DataQualityAreaKey;
  label: string;
  status: DataQualityStatus;
  issueCount: number;
  blockingCount: number;
  entityCount: number;
  route: string;
};

export type DataQualityOverview = {
  tenantId: EntityId;
  overallStatus: DataQualityStatus;
  areas: DataQualityAreaSummary[];
  totalBlocking: number;
  totalWarnings: number;
  lastValidatedAt: ISODateTime | null;
};

export type TenantMasterDataInput = {
  tenantId: EntityId;
  name?: string | null;
  legalForm?: string | null;
  street?: string | null;
  zip?: string | null;
  city?: string | null;
  phone?: string | null;
  email?: string | null;
  managementName?: string | null;
  registerNumber?: string | null;
  taxId?: string | null;
  vatId?: string | null;
  ikNumber?: string | null;
  bankName?: string | null;
  iban?: string | null;
  paymentTermsDays?: number | null;
  taxStatus?: string | null;
  statutoryBillingActive?: boolean;
  invoicesEnabled?: boolean;
};

export type ClientMasterDataInput = {
  tenantId: EntityId;
  clientId: EntityId;
  firstName?: string | null;
  lastName?: string | null;
  status?: string | null;
  street?: string | null;
  zip?: string | null;
  city?: string | null;
  careLevel?: number | null;
  costCarrierId?: string | null;
  selfPayer?: boolean;
  invoiceRecipientName?: string | null;
  hasConsents?: boolean;
  portalAccessConfigured?: boolean;
  requiresOnSiteAddress?: boolean;
  requiresBudget?: boolean;
  contextTenantId?: string | null;
};

export type EmployeeMasterDataInput = {
  tenantId: EntityId;
  employeeId: EntityId;
  firstName?: string | null;
  lastName?: string | null;
  roleKey?: string | null;
  status?: string | null;
  email?: string | null;
  phone?: string | null;
  qualification?: string | null;
  requiresCareQualification?: boolean;
  portalAccessConfigured?: boolean;
};

export type AssignmentMasterDataInput = {
  tenantId: EntityId;
  assignmentId: EntityId;
  clientId?: string | null;
  employeeId?: string | null;
  assignmentDate?: string | null;
  plannedStartTime?: string | null;
  plannedEndTime?: string | null;
  serviceType?: string | null;
  tasks?: string[];
  street?: string | null;
  zip?: string | null;
  city?: string | null;
  isOpen?: boolean;
  signatureRequired?: boolean;
  signatureStatus?: 'ok' | 'missing' | 'na';
  docStatus?: 'ok' | 'missing' | 'na';
  billingReady?: boolean;
  contextTenantId?: string | null;
};

export type ServiceRecordMasterDataInput = {
  tenantId: EntityId;
  serviceRecordId: EntityId;
  assignmentId?: string | null;
  clientId?: string | null;
  employeeId?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  durationMinutes?: number | null;
  serviceType?: string | null;
  tasksCompleted?: boolean;
  documentationStatus?: 'ok' | 'missing' | 'na';
  signatureStatus?: 'ok' | 'missing' | 'exception';
  budgetChecked?: boolean;
  reviewStatus?: string | null;
  contextTenantId?: string | null;
};

export type BillingReadinessInput = {
  tenantId: EntityId;
  billingCaseId: EntityId;
  pflegegrad?: number | null;
  hasLeistungsnachweis?: boolean;
  hasUnterschrift?: boolean;
  costCarrierId?: string | null;
  tenantIkNumber?: string | null;
  budgetAvailableCents?: number | null;
  amountCents?: number | null;
  statutoryBillingActive?: boolean;
  contextTenantId?: string | null;
};

export type DocumentReadinessInput = {
  tenantId: EntityId;
  documentId: EntityId;
  templateActive?: boolean;
  requiredFieldsFilled?: boolean;
  previewConfirmed?: boolean;
  pdfGenerated?: boolean;
  hashPresent?: boolean;
  archived?: boolean;
  contextTenantId?: string | null;
};

export type PortalAccessInput = {
  tenantId: EntityId;
  portalId: EntityId;
  portalType?: 'employee' | 'client' | 'relative';
  accessAssigned?: boolean;
  privacyCheckDone?: boolean;
  roleAuthorized?: boolean;
  contextTenantId?: string | null;
};

export type InvoiceMasterDataInput = {
  tenantId: EntityId;
  invoiceId: EntityId;
  invoiceNumber?: string | null;
  recipientName?: string | null;
  recipientStreet?: string | null;
  recipientCity?: string | null;
  invoiceDate?: string | null;
  servicePeriod?: string | null;
  lineItemCount?: number;
  netTotalCents?: number | null;
  grossTotalCents?: number | null;
  taxNote?: string | null;
  paymentTermsDays?: number | null;
  bankName?: string | null;
  iban?: string | null;
  footerPresent?: boolean;
  status?: string | null;
  pdfRef?: string | null;
  taxLogicValid?: boolean;
  contextTenantId?: string | null;
};

export type DataQualityAuditEvent = {
  id: string;
  tenantId: EntityId;
  entityType: MasterDataEntityType;
  entityId: EntityId;
  action: 'validate' | 'revalidate' | 'management_task_created';
  status: DataQualityStatus;
  issueCount: number;
  createdAt: ISODateTime;
};
