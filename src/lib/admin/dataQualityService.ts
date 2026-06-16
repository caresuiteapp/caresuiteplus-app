import type {
  AssignmentMasterDataInput,
  BillingReadinessInput,
  ClientMasterDataInput,
  DataQualityAreaKey,
  DataQualityAreaSummary,
  DataQualityOverview,
  DataQualityResult,
  DataQualityStatus,
  DocumentReadinessInput,
  EmployeeMasterDataInput,
  InvoiceMasterDataInput,
  PortalAccessInput,
  ServiceRecordMasterDataInput,
  TenantMasterDataInput,
} from '@/types/admin/dataQuality';
import { createManagementTask } from '@/lib/assist/managementTaskService';
import {
  appendDataQualityAuditEvent,
  listAssignmentMasterData,
  listClientMasterData,
  listEmployeeMasterData,
  listInvoiceMasterData,
  listServiceRecordMasterData,
  readDataQualityOverview,
  readTenantMasterDataProfile,
  saveDataQualityOverview,
  upsertTenantMasterDataProfile,
} from './dataQualityStore';
import {
  isBlockingResult,
  validateAssignmentData,
  validateBillingReadiness,
  validateClientMasterData,
  validateDocumentReadiness,
  validateEmployeeMasterData,
  validateInvoiceMasterData,
  validatePortalAccess,
  validateServiceRecordData,
  validateTenantMasterData,
} from './dataQualityValidation';

export const DATA_QUALITY_AREA_ROUTES: Record<DataQualityAreaKey, string> = {
  overview: '/business/office/admin/data-quality',
  tenant: '/business/office/admin/data-quality/tenant',
  clients: '/business/office/admin/data-quality/clients',
  employees: '/business/office/admin/data-quality/employees',
  assignments: '/business/office/admin/data-quality/assignments',
  service_records: '/business/office/admin/data-quality/service-records',
  invoices: '/business/office/admin/data-quality/invoices',
  documents: '/business/office/admin/data-quality/documents',
  portals: '/business/office/admin/data-quality/portals',
};

export const DATA_QUALITY_AREA_LABELS: Record<DataQualityAreaKey, string> = {
  overview: 'Übersicht',
  tenant: 'Mandant / Firma',
  clients: 'Klient:innen',
  employees: 'Mitarbeitende',
  assignments: 'Einsätze',
  service_records: 'Leistungsnachweise',
  invoices: 'Rechnungen',
  documents: 'Dokumente & Vorlagen',
  portals: 'Portale',
};

export const DATA_QUALITY_PREPARED_MESSAGE =
  'Datenqualität nutzt mandantenspezifische Stammdaten — Live-Persistenz über vorbereitete Migration.';

export function isDataQualityLiveReady(): boolean {
  return false;
}

function worstStatus(statuses: DataQualityStatus[]): DataQualityStatus {
  const order: DataQualityStatus[] = [
    'blocked',
    'invalid',
    'incomplete',
    'needs_review',
    'warning',
    'complete',
  ];
  for (const status of order) {
    if (statuses.includes(status)) return status;
  }
  return 'complete';
}

function summarizeArea(
  areaKey: DataQualityAreaKey,
  results: DataQualityResult[],
): DataQualityAreaSummary {
  const blockingCount = results.reduce((sum, r) => sum + r.blockingIssues.length, 0);
  const issueCount = results.reduce((sum, r) => sum + r.errors.length + r.warnings.length, 0);
  return {
    areaKey,
    label: DATA_QUALITY_AREA_LABELS[areaKey],
    status: worstStatus(results.map((r) => r.status)),
    issueCount,
    blockingCount,
    entityCount: results.length,
    route: DATA_QUALITY_AREA_ROUTES[areaKey],
  };
}

function auditValidation(
  tenantId: string,
  result: DataQualityResult,
  action: 'validate' | 'revalidate' = 'validate',
): void {
  appendDataQualityAuditEvent(tenantId, {
    entityType: result.relatedEntityType,
    entityId: result.relatedEntityId,
    action,
    status: result.status,
    issueCount: result.errors.length + result.warnings.length,
  });
}

export function validateTenantMasterDataForTenant(
  tenantId: string,
  overrides?: Partial<TenantMasterDataInput>,
): DataQualityResult {
  const profile = { ...readTenantMasterDataProfile(tenantId), ...overrides, tenantId };
  const result = validateTenantMasterData(profile);
  auditValidation(tenantId, result);
  return result;
}

export function validateClientMasterDataRecord(input: ClientMasterDataInput): DataQualityResult {
  const result = validateClientMasterData(input);
  auditValidation(input.tenantId, result);
  return result;
}

export function validateEmployeeMasterDataRecord(input: EmployeeMasterDataInput): DataQualityResult {
  const result = validateEmployeeMasterData(input);
  auditValidation(input.tenantId, result);
  return result;
}

export function validateAssignmentDataRecord(input: AssignmentMasterDataInput): DataQualityResult {
  const result = validateAssignmentData(input);
  auditValidation(input.tenantId, result);
  return result;
}

export function validateServiceRecordDataRecord(
  input: ServiceRecordMasterDataInput,
): DataQualityResult {
  const result = validateServiceRecordData(input);
  auditValidation(input.tenantId, result);
  return result;
}

export function validateBillingReadinessRecord(input: BillingReadinessInput): DataQualityResult {
  const result = validateBillingReadiness(input);
  auditValidation(input.tenantId, result);
  return result;
}

export function validateDocumentReadinessRecord(input: DocumentReadinessInput): DataQualityResult {
  const result = validateDocumentReadiness(input);
  auditValidation(input.tenantId, result);
  return result;
}

export function validatePortalAccessRecord(input: PortalAccessInput): DataQualityResult {
  const result = validatePortalAccess(input);
  auditValidation(input.tenantId, result);
  return result;
}

export function validateInvoiceMasterDataRecord(input: InvoiceMasterDataInput): DataQualityResult {
  const result = validateInvoiceMasterData(input);
  auditValidation(input.tenantId, result);
  return result;
}

export function revalidateEntity(
  tenantId: string,
  entityType: DataQualityResult['relatedEntityType'],
  entityId: string,
): DataQualityResult | null {
  let result: DataQualityResult | null = null;

  if (entityType === 'tenant') {
    result = validateTenantMasterDataForTenant(tenantId);
  } else if (entityType === 'client') {
    const client = listClientMasterData(tenantId).find((c) => c.clientId === entityId);
    if (client) result = validateClientMasterDataRecord(client);
  } else if (entityType === 'employee') {
    const employee = listEmployeeMasterData(tenantId).find((e) => e.employeeId === entityId);
    if (employee) result = validateEmployeeMasterDataRecord(employee);
  } else if (entityType === 'assignment') {
    const assignment = listAssignmentMasterData(tenantId).find((a) => a.assignmentId === entityId);
    if (assignment) result = validateAssignmentDataRecord(assignment);
  } else if (entityType === 'service_record') {
    const record = listServiceRecordMasterData(tenantId).find((r) => r.serviceRecordId === entityId);
    if (record) result = validateServiceRecordDataRecord(record);
  } else if (entityType === 'invoice') {
    const invoice = listInvoiceMasterData(tenantId).find((i) => i.invoiceId === entityId);
    if (invoice) result = validateInvoiceMasterDataRecord(invoice);
  }

  if (result) {
    appendDataQualityAuditEvent(tenantId, {
      entityType: result.relatedEntityType,
      entityId: result.relatedEntityId,
      action: 'revalidate',
      status: result.status,
      issueCount: result.errors.length + result.warnings.length,
    });
  }
  return result;
}

export function createManagementTaskForBlockingIssue(
  tenantId: string,
  result: DataQualityResult,
): void {
  if (!isBlockingResult(result)) return;

  const assignmentId = `dq:${result.relatedEntityType}:${result.relatedEntityId}`;
  const description =
    result.blockingIssues.map((i) => i.message).join(' · ') ||
    result.recommendedActions.join(' · ');

  createManagementTask({
    tenantId,
    assignmentId,
    taskType: 'master_data_review',
    description: description || 'Stammdatenqualität — Blocker prüfen',
    priority: result.status === 'blocked' ? 'critical' : 'high',
  });

  appendDataQualityAuditEvent(tenantId, {
    entityType: result.relatedEntityType,
    entityId: result.relatedEntityId,
    action: 'management_task_created',
    status: result.status,
    issueCount: result.blockingIssues.length,
  });
}

export function buildDataQualityOverview(tenantId: string): DataQualityOverview {
  const tenantResult = validateTenantMasterDataForTenant(tenantId);
  const clientResults = listClientMasterData(tenantId).map(validateClientMasterDataRecord);
  const employeeResults = listEmployeeMasterData(tenantId).map(validateEmployeeMasterDataRecord);
  const assignmentResults = listAssignmentMasterData(tenantId).map(validateAssignmentDataRecord);
  const serviceRecordResults = listServiceRecordMasterData(tenantId).map(
    validateServiceRecordDataRecord,
  );
  const invoiceResults = listInvoiceMasterData(tenantId).map(validateInvoiceMasterDataRecord);

  const areas: DataQualityAreaSummary[] = [
    summarizeArea('tenant', [tenantResult]),
    summarizeArea('clients', clientResults),
    summarizeArea('employees', employeeResults),
    summarizeArea('assignments', assignmentResults),
    summarizeArea('service_records', serviceRecordResults),
    summarizeArea('invoices', invoiceResults),
    {
      areaKey: 'documents',
      label: DATA_QUALITY_AREA_LABELS.documents,
      status: 'needs_review',
      issueCount: 0,
      blockingCount: 0,
      entityCount: 0,
      route: DATA_QUALITY_AREA_ROUTES.documents,
    },
    {
      areaKey: 'portals',
      label: DATA_QUALITY_AREA_LABELS.portals,
      status: 'warning',
      issueCount: 0,
      blockingCount: 0,
      entityCount: 0,
      route: DATA_QUALITY_AREA_ROUTES.portals,
    },
  ];

  const allResults = [
    tenantResult,
    ...clientResults,
    ...employeeResults,
    ...assignmentResults,
    ...serviceRecordResults,
    ...invoiceResults,
  ];

  for (const result of allResults) {
    if (isBlockingResult(result)) {
      createManagementTaskForBlockingIssue(tenantId, result);
    }
  }

  const overview: DataQualityOverview = {
    tenantId,
    overallStatus: worstStatus(areas.map((a) => a.status)),
    areas,
    totalBlocking: allResults.reduce((sum, r) => sum + r.blockingIssues.length, 0),
    totalWarnings: allResults.reduce((sum, r) => sum + r.warnings.length, 0),
    lastValidatedAt: new Date().toISOString(),
  };

  saveDataQualityOverview(tenantId, overview);
  return overview;
}

export function fetchDataQualityOverview(tenantId: string): DataQualityOverview {
  return readDataQualityOverview(tenantId) ?? buildDataQualityOverview(tenantId);
}

export function saveTenantProfileFromOnboarding(
  tenantId: string,
  profile: Partial<TenantMasterDataInput>,
): DataQualityResult {
  upsertTenantMasterDataProfile(tenantId, profile);
  return validateTenantMasterDataForTenant(tenantId);
}

export {
  validateTenantMasterData,
  validateClientMasterData,
  validateEmployeeMasterData,
  validateAssignmentData,
  validateServiceRecordData,
  validateBillingReadiness,
  validateDocumentReadiness,
  validatePortalAccess,
  validateInvoiceMasterData,
  isBlockingResult,
} from './dataQualityValidation';

export {
  resetDataQualityStore,
  upsertClientMasterData,
  upsertEmployeeMasterData,
  upsertAssignmentMasterData,
  upsertServiceRecordMasterData,
  upsertInvoiceMasterData,
  upsertTenantMasterDataProfile,
  listDataQualityAuditEvents,
} from './dataQualityStore';
