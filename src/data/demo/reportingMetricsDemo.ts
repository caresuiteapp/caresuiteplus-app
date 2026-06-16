import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import type { ReportingMetricsRawBundle } from '@/types/reporting/metrics';
import type { ReportingDateRange } from '@/types/reporting/metrics';

export type DemoServiceRecord = {
  id: string;
  tenantId: string;
  assignmentId: string;
  clientId: string;
  employeeId: string;
  status: 'draft' | 'signed' | 'review_pending' | 'approved' | 'rejected' | 'corrected' | 'billing_ready';
  totalAmountCents: number;
  serviceDate: string;
  payerType: 'self' | 'carrier';
};

export type DemoBillableItem = {
  id: string;
  tenantId: string;
  serviceRecordId: string;
  status: 'prepared' | 'blocked' | 'invoiced' | 'non_billable';
  amountCents: number;
  preparedAt: string;
};

export type DemoAssignmentDocState = {
  assignmentId: string;
  tenantId: string;
  documentationStatus: 'complete' | 'missing' | 'incomplete';
  signatureStatus: 'complete' | 'missing' | 'exception';
  hasCorrection: boolean;
};

const DEMO_SERVICE_RECORDS: DemoServiceRecord[] = [
  {
    id: 'sr-001',
    tenantId: DEMO_TENANT_ID,
    assignmentId: 'assign-003',
    clientId: 'client-005',
    employeeId: 'employee-003',
    status: 'billing_ready',
    totalAmountCents: 45_000,
    serviceDate: '2026-06-01',
    payerType: 'carrier',
  },
  {
    id: 'sr-002',
    tenantId: DEMO_TENANT_ID,
    assignmentId: 'assign-001',
    clientId: 'client-001',
    employeeId: 'employee-001',
    status: 'review_pending',
    totalAmountCents: 32_500,
    serviceDate: '2026-06-02',
    payerType: 'self',
  },
  {
    id: 'sr-003',
    tenantId: DEMO_TENANT_ID,
    assignmentId: 'assign-004',
    clientId: 'client-010',
    employeeId: 'employee-001',
    status: 'approved',
    totalAmountCents: 28_000,
    serviceDate: '2026-05-28',
    payerType: 'carrier',
  },
];

const DEMO_BILLABLE_ITEMS: DemoBillableItem[] = [
  {
    id: 'bi-001',
    tenantId: DEMO_TENANT_ID,
    serviceRecordId: 'sr-001',
    status: 'prepared',
    amountCents: 45_000,
    preparedAt: '2026-06-01T10:00:00.000Z',
  },
  {
    id: 'bi-002',
    tenantId: DEMO_TENANT_ID,
    serviceRecordId: 'sr-002',
    status: 'blocked',
    amountCents: 32_500,
    preparedAt: '2026-06-02T09:00:00.000Z',
  },
  {
    id: 'bi-003',
    tenantId: DEMO_TENANT_ID,
    serviceRecordId: 'sr-003',
    status: 'invoiced',
    amountCents: 28_000,
    preparedAt: '2026-05-28T14:00:00.000Z',
  },
];

const DEMO_DOC_STATES: DemoAssignmentDocState[] = [
  { assignmentId: 'assign-001', tenantId: DEMO_TENANT_ID, documentationStatus: 'complete', signatureStatus: 'complete', hasCorrection: false },
  { assignmentId: 'assign-002', tenantId: DEMO_TENANT_ID, documentationStatus: 'missing', signatureStatus: 'missing', hasCorrection: false },
  { assignmentId: 'assign-003', tenantId: DEMO_TENANT_ID, documentationStatus: 'complete', signatureStatus: 'complete', hasCorrection: false },
  { assignmentId: 'assign-004', tenantId: DEMO_TENANT_ID, documentationStatus: 'incomplete', signatureStatus: 'missing', hasCorrection: true },
  { assignmentId: 'assign-005', tenantId: DEMO_TENANT_ID, documentationStatus: 'missing', signatureStatus: 'exception', hasCorrection: false },
];

/** Demo-only tables — not persisted; used when assignment_documentation / billable_items migrations fehlen */
export function getDemoServiceRecords(tenantId: string): DemoServiceRecord[] {
  return DEMO_SERVICE_RECORDS.filter((r) => r.tenantId === tenantId);
}

export function getDemoBillableItems(tenantId: string): DemoBillableItem[] {
  return DEMO_BILLABLE_ITEMS.filter((r) => r.tenantId === tenantId);
}

export function getDemoAssignmentDocStates(tenantId: string): DemoAssignmentDocState[] {
  return DEMO_DOC_STATES.filter((r) => r.tenantId === tenantId);
}

export const DEMO_TABLE_AVAILABILITY: ReportingMetricsRawBundle['tableAvailability'] = {
  assignments: true,
  assignment_tasks: true,
  assignment_status_events: true,
  assignment_documentation: true,
  assignment_signatures: true,
  service_records: true,
  billable_items: true,
  invoice_drafts: false,
  invoices: true,
  payments: false,
  client_budgets: true,
  budget_transactions: true,
  management_tasks: true,
  problem_reports: true,
  emergency_reports: true,
  clients: true,
  employees: true,
  messages: true,
  generated_documents: false,
  connect_integrations: true,
};
