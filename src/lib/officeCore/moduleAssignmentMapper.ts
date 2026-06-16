import type { ProductKey, WorkflowStatus } from '@/types';
import type {
  ClientModuleAssignment,
  EmployeeModuleAssignment,
  ModuleBillingSource,
  ModuleDocumentVisibility,
  ModulePermissionProfile,
  ModuleServiceCatalogEntry,
  ModuleTemplateAssignment,
} from '@/lib/officeCore/types';

const PRODUCT_KEYS = new Set<ProductKey>([
  'assist',
  'pflege',
  'beratung',
  'stationaer',
  'akademie',
  'office',
]);

function asProductKey(value: unknown): ProductKey {
  const key = String(value ?? 'office');
  return PRODUCT_KEYS.has(key as ProductKey) ? (key as ProductKey) : 'office';
}

function asWorkflowStatus(value: unknown): WorkflowStatus {
  const status = String(value ?? 'in_bearbeitung');
  if (status === 'prepared') return 'in_bearbeitung';
  if (
    status === 'entwurf' ||
    status === 'aktiv' ||
    status === 'in_bearbeitung' ||
    status === 'abgeschlossen' ||
    status === 'archiviert' ||
    status === 'fehlerhaft' ||
    status === 'gesperrt'
  ) {
    return status;
  }
  return 'in_bearbeitung';
}

function baseFields(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function mapClientModuleAssignmentRow(
  row: Record<string, unknown>,
  clientName: string,
  primaryEmployeeName?: string,
): ClientModuleAssignment {
  return {
    ...baseFields(row),
    clientId: String(row.client_id),
    clientName,
    moduleKey: asProductKey(row.module_key),
    assignedAt: String(row.assigned_at ?? row.created_at),
    status: asWorkflowStatus(row.status),
    primaryEmployeeId: row.primary_employee_id ? String(row.primary_employee_id) : undefined,
    primaryEmployeeName,
    notes: row.notes ? String(row.notes) : undefined,
  };
}

export function mapEmployeeModuleAssignmentRow(
  row: Record<string, unknown>,
  employeeName: string,
): EmployeeModuleAssignment {
  return {
    ...baseFields(row),
    employeeId: String(row.employee_id),
    employeeName,
    moduleKey: asProductKey(row.module_key),
    roleInModule: String(row.role_in_module ?? ''),
    assignedAt: String(row.assigned_at ?? row.created_at),
    status: asWorkflowStatus(row.status),
  };
}

export function mapModuleServiceCatalogRow(row: Record<string, unknown>): ModuleServiceCatalogEntry {
  return {
    ...baseFields(row),
    moduleKey: asProductKey(row.module_key),
    serviceCode: String(row.service_code ?? ''),
    serviceName: String(row.service_name ?? ''),
    billingCategory: String(row.billing_category ?? ''),
    unitPriceCents: Number(row.unit_price_cents ?? 0),
    status: asWorkflowStatus(row.status),
  };
}

export function mapModuleBillingSourceRow(row: Record<string, unknown>): ModuleBillingSource {
  const sourceType = String(row.source_type ?? 'office_invoice');
  return {
    ...baseFields(row),
    moduleKey: asProductKey(row.module_key),
    sourceLabel: String(row.source_label ?? ''),
    sourceType:
      sourceType === 'module_export' || sourceType === 'external'
        ? sourceType
        : 'office_invoice',
    linkedInvoiceId: row.linked_invoice_id ? String(row.linked_invoice_id) : undefined,
    status: asWorkflowStatus(row.status),
  };
}

export function mapModuleDocumentVisibilityRow(row: Record<string, unknown>): ModuleDocumentVisibility {
  const visibility = String(row.visibility ?? 'module_only');
  return {
    ...baseFields(row),
    moduleKey: asProductKey(row.module_key),
    documentId: String(row.document_id),
    documentTitle: String(row.document_title ?? ''),
    visibility:
      visibility === 'office_and_module' || visibility === 'portal'
        ? visibility
        : 'module_only',
    status: asWorkflowStatus(row.status),
  };
}

export function mapModuleTemplateAssignmentRow(row: Record<string, unknown>): ModuleTemplateAssignment {
  return {
    ...baseFields(row),
    moduleKey: asProductKey(row.module_key),
    templateId: String(row.template_id),
    templateName: String(row.template_name ?? ''),
    templateCategory: String(row.template_category ?? ''),
    status: asWorkflowStatus(row.status),
  };
}

export function mapModulePermissionProfileRow(row: Record<string, unknown>): ModulePermissionProfile {
  return {
    ...baseFields(row),
    moduleKey: asProductKey(row.module_key),
    profileName: String(row.profile_name ?? ''),
    roleKey: String(row.role_key ?? ''),
    canView: Boolean(row.can_view),
    canEdit: Boolean(row.can_edit),
    canExport: Boolean(row.can_export),
    status: asWorkflowStatus(row.status),
  };
}
