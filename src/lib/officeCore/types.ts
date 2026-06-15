import type { ISODateTime, TenantScopedEntity, WorkflowStatus } from '@/types';
import type { ProductKey } from '@/types';

/** OfficeCore — zentrale Plattform-Kennzahlen. */
export type OfficeCoreStats = {
  clientCount: number;
  activeClientCount: number;
  employeeCount: number;
  activeEmployeeCount: number;
  documentCount: number;
  invoiceCount: number;
  openInvoiceCount: number;
  moduleAssignmentCount: number;
  activeModuleCount: number;
};

export type ClientModuleAssignment = TenantScopedEntity & {
  clientId: string;
  clientName: string;
  moduleKey: ProductKey;
  assignedAt: ISODateTime;
  status: WorkflowStatus;
  primaryEmployeeId?: string;
  primaryEmployeeName?: string;
  notes?: string;
};

export type EmployeeModuleAssignment = TenantScopedEntity & {
  employeeId: string;
  employeeName: string;
  moduleKey: ProductKey;
  roleInModule: string;
  assignedAt: ISODateTime;
  status: WorkflowStatus;
};

export type ModuleServiceCatalogEntry = TenantScopedEntity & {
  moduleKey: ProductKey;
  serviceCode: string;
  serviceName: string;
  billingCategory: string;
  unitPriceCents: number;
  status: WorkflowStatus;
};

export type ModuleBillingSource = TenantScopedEntity & {
  moduleKey: ProductKey;
  sourceLabel: string;
  sourceType: 'office_invoice' | 'module_export' | 'external';
  linkedInvoiceId?: string;
  status: WorkflowStatus;
};

export type ModuleDocumentVisibility = TenantScopedEntity & {
  moduleKey: ProductKey;
  documentId: string;
  documentTitle: string;
  visibility: 'module_only' | 'office_and_module' | 'portal';
  status: WorkflowStatus;
};

export type ModuleTemplateAssignment = TenantScopedEntity & {
  moduleKey: ProductKey;
  templateId: string;
  templateName: string;
  templateCategory: string;
  status: WorkflowStatus;
};

export type ModulePermissionProfile = TenantScopedEntity & {
  moduleKey: ProductKey;
  profileName: string;
  roleKey: string;
  canView: boolean;
  canEdit: boolean;
  canExport: boolean;
  status: WorkflowStatus;
};

export type ModuleAssignmentSection =
  | 'clients'
  | 'employees'
  | 'services'
  | 'documents'
  | 'templates'
  | 'permissions'
  | 'billing';

export type ModuleAssignmentListItem = {
  id: string;
  title: string;
  subtitle: string;
  moduleKey: ProductKey;
  status: WorkflowStatus;
  meta?: string;
  officeLink?: string;
};
