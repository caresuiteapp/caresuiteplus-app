import type {
  AssignmentMasterDataInput,
  ClientMasterDataInput,
  DataQualityAuditEvent,
  DataQualityOverview,
  EmployeeMasterDataInput,
  InvoiceMasterDataInput,
  ServiceRecordMasterDataInput,
  TenantMasterDataInput,
} from '@/types/admin/dataQuality';
import { demoTenant, demoTenantAddress, demoTenantContact, DEMO_TENANT_ID } from '@/data/demo/tenant';

type TenantDataQualityStore = {
  tenantProfile: TenantMasterDataInput;
  clients: ClientMasterDataInput[];
  employees: EmployeeMasterDataInput[];
  assignments: AssignmentMasterDataInput[];
  serviceRecords: ServiceRecordMasterDataInput[];
  invoices: InvoiceMasterDataInput[];
  auditEvents: DataQualityAuditEvent[];
  lastOverview: DataQualityOverview | null;
};

const stores = new Map<string, TenantDataQualityStore>();

function defaultTenantProfile(tenantId: string): TenantMasterDataInput {
  if (tenantId === DEMO_TENANT_ID) {
    return {
      tenantId,
      name: demoTenant.name,
      legalForm: demoTenant.legalForm,
      street: demoTenantAddress.street,
      zip: demoTenantAddress.zip,
      city: demoTenantAddress.city,
      phone: demoTenant.phone,
      email: demoTenant.email,
      managementName: `${demoTenantContact.firstName} ${demoTenantContact.lastName}`,
      registerNumber: 'HRB 123456',
      taxId: '27/123/45678',
      vatId: 'DE123456789',
      ikNumber: '123456789',
      bankName: 'Demo Bank AG',
      iban: 'DE89370400440532013000',
      paymentTermsDays: 14,
      taxStatus: 'kleinunternehmer',
      statutoryBillingActive: true,
      invoicesEnabled: true,
    };
  }
  return {
    tenantId,
    name: null,
    legalForm: null,
    street: null,
    zip: null,
    city: null,
    phone: null,
    email: null,
    managementName: null,
    registerNumber: null,
    taxId: null,
    vatId: null,
    ikNumber: null,
    bankName: null,
    iban: null,
    paymentTermsDays: null,
    taxStatus: null,
    statutoryBillingActive: false,
    invoicesEnabled: false,
  };
}

function emptyStore(tenantId: string): TenantDataQualityStore {
  return {
    tenantProfile: defaultTenantProfile(tenantId),
    clients: [],
    employees: [],
    assignments: [],
    serviceRecords: [],
    invoices: [],
    auditEvents: [],
    lastOverview: null,
  };
}

function getStore(tenantId: string): TenantDataQualityStore {
  let store = stores.get(tenantId);
  if (!store) {
    store = emptyStore(tenantId);
    stores.set(tenantId, store);
  }
  return store;
}

export function resetDataQualityStore(tenantId?: string): void {
  if (tenantId) {
    stores.delete(tenantId);
    return;
  }
  stores.clear();
}

export function getDataQualityStoreSnapshot(tenantId: string): Readonly<TenantDataQualityStore> {
  return getStore(tenantId);
}

export function upsertTenantMasterDataProfile(
  tenantId: string,
  profile: Partial<TenantMasterDataInput>,
): TenantMasterDataInput {
  const store = getStore(tenantId);
  store.tenantProfile = { ...store.tenantProfile, ...profile, tenantId };
  return store.tenantProfile;
}

export function upsertClientMasterData(
  tenantId: string,
  client: ClientMasterDataInput,
): ClientMasterDataInput {
  const store = getStore(tenantId);
  const index = store.clients.findIndex((c) => c.clientId === client.clientId);
  const record = { ...client, tenantId };
  if (index >= 0) store.clients[index] = record;
  else store.clients.push(record);
  return record;
}

export function upsertEmployeeMasterData(
  tenantId: string,
  employee: EmployeeMasterDataInput,
): EmployeeMasterDataInput {
  const store = getStore(tenantId);
  const index = store.employees.findIndex((e) => e.employeeId === employee.employeeId);
  const record = { ...employee, tenantId };
  if (index >= 0) store.employees[index] = record;
  else store.employees.push(record);
  return record;
}

export function upsertAssignmentMasterData(
  tenantId: string,
  assignment: AssignmentMasterDataInput,
): AssignmentMasterDataInput {
  const store = getStore(tenantId);
  const index = store.assignments.findIndex((a) => a.assignmentId === assignment.assignmentId);
  const record = { ...assignment, tenantId };
  if (index >= 0) store.assignments[index] = record;
  else store.assignments.push(record);
  return record;
}

export function upsertServiceRecordMasterData(
  tenantId: string,
  record: ServiceRecordMasterDataInput,
): ServiceRecordMasterDataInput {
  const store = getStore(tenantId);
  const index = store.serviceRecords.findIndex((r) => r.serviceRecordId === record.serviceRecordId);
  const next = { ...record, tenantId };
  if (index >= 0) store.serviceRecords[index] = next;
  else store.serviceRecords.push(next);
  return next;
}

export function upsertInvoiceMasterData(
  tenantId: string,
  invoice: InvoiceMasterDataInput,
): InvoiceMasterDataInput {
  const store = getStore(tenantId);
  const index = store.invoices.findIndex((i) => i.invoiceId === invoice.invoiceId);
  const record = { ...invoice, tenantId };
  if (index >= 0) store.invoices[index] = record;
  else store.invoices.push(record);
  return record;
}

export function appendDataQualityAuditEvent(
  tenantId: string,
  event: Omit<DataQualityAuditEvent, 'id' | 'tenantId' | 'createdAt'>,
): DataQualityAuditEvent {
  const entry: DataQualityAuditEvent = {
    id: `dqa-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    tenantId,
    createdAt: new Date().toISOString(),
    ...event,
  };
  getStore(tenantId).auditEvents.push(entry);
  return entry;
}

export function saveDataQualityOverview(tenantId: string, overview: DataQualityOverview): void {
  getStore(tenantId).lastOverview = overview;
}

export function readTenantMasterDataProfile(tenantId: string): TenantMasterDataInput {
  return getStore(tenantId).tenantProfile;
}

export function listClientMasterData(tenantId: string): ClientMasterDataInput[] {
  return [...getStore(tenantId).clients];
}

export function listEmployeeMasterData(tenantId: string): EmployeeMasterDataInput[] {
  return [...getStore(tenantId).employees];
}

export function listAssignmentMasterData(tenantId: string): AssignmentMasterDataInput[] {
  return [...getStore(tenantId).assignments];
}

export function listServiceRecordMasterData(tenantId: string): ServiceRecordMasterDataInput[] {
  return [...getStore(tenantId).serviceRecords];
}

export function listInvoiceMasterData(tenantId: string): InvoiceMasterDataInput[] {
  return [...getStore(tenantId).invoices];
}

export function listDataQualityAuditEvents(tenantId: string): DataQualityAuditEvent[] {
  return [...getStore(tenantId).auditEvents];
}

export function readDataQualityOverview(tenantId: string): DataQualityOverview | null {
  return getStore(tenantId).lastOverview;
}
