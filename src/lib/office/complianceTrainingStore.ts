import type {
  CompliancePolicyDocument,
  ComplianceTrainingAcknowledgement,
  ComplianceTrainingAssignment,
  ComplianceTrainingAuditEvent,
  ComplianceTrainingItem,
  EmployeePolicyAcknowledgement,
} from '@/types/modules/complianceTraining';

export type ComplianceTrainingStoreState = {
  items: ComplianceTrainingItem[];
  assignments: ComplianceTrainingAssignment[];
  acknowledgements: ComplianceTrainingAcknowledgement[];
  policyDocuments: CompliancePolicyDocument[];
  policyAcknowledgements: EmployeePolicyAcknowledgement[];
  auditEvents: ComplianceTrainingAuditEvent[];
};

export const COMPLIANCE_TRAINING_STORE: ComplianceTrainingStoreState = {
  items: [],
  assignments: [],
  acknowledgements: [],
  policyDocuments: [],
  policyAcknowledgements: [],
  auditEvents: [],
};

let itemCounter = 0;
let assignmentCounter = 0;
let acknowledgementCounter = 0;
let policyDocCounter = 0;
let policyAckCounter = 0;
let auditCounter = 0;

export function nextComplianceItemId(): string {
  itemCounter += 1;
  return `ct-item-${itemCounter}`;
}

export function nextComplianceAssignmentId(): string {
  assignmentCounter += 1;
  return `ct-assign-${assignmentCounter}`;
}

export function nextComplianceAcknowledgementId(): string {
  acknowledgementCounter += 1;
  return `ct-ack-${acknowledgementCounter}`;
}

export function nextCompliancePolicyDocId(): string {
  policyDocCounter += 1;
  return `ct-policy-${policyDocCounter}`;
}

export function nextCompliancePolicyAckId(): string {
  policyAckCounter += 1;
  return `ct-policy-ack-${policyAckCounter}`;
}

export function nextComplianceAuditId(): string {
  auditCounter += 1;
  return `ct-audit-${auditCounter}`;
}

export function filterByTenant<T extends { tenantId: string }>(rows: T[], tenantId: string): T[] {
  return rows.filter((row) => row.tenantId === tenantId);
}

export function listComplianceItemsForTenant(tenantId: string): ComplianceTrainingItem[] {
  return filterByTenant(COMPLIANCE_TRAINING_STORE.items, tenantId);
}

export function listComplianceAssignmentsForTenant(
  tenantId: string,
  employeeId?: string,
): ComplianceTrainingAssignment[] {
  const rows = filterByTenant(COMPLIANCE_TRAINING_STORE.assignments, tenantId);
  if (!employeeId) return rows;
  return rows.filter((row) => row.employeeId === employeeId);
}

export function getComplianceAssignmentById(
  tenantId: string,
  assignmentId: string,
): ComplianceTrainingAssignment | null {
  return COMPLIANCE_TRAINING_STORE.assignments.find(
    (row) => row.tenantId === tenantId && row.id === assignmentId,
  ) ?? null;
}

export function getComplianceItemById(
  tenantId: string,
  itemId: string,
): ComplianceTrainingItem | null {
  return COMPLIANCE_TRAINING_STORE.items.find(
    (row) => row.tenantId === tenantId && row.id === itemId,
  ) ?? null;
}

export function resetComplianceTrainingStore(): void {
  COMPLIANCE_TRAINING_STORE.items = [];
  COMPLIANCE_TRAINING_STORE.assignments = [];
  COMPLIANCE_TRAINING_STORE.acknowledgements = [];
  COMPLIANCE_TRAINING_STORE.policyDocuments = [];
  COMPLIANCE_TRAINING_STORE.policyAcknowledgements = [];
  COMPLIANCE_TRAINING_STORE.auditEvents = [];
  itemCounter = 0;
  assignmentCounter = 0;
  acknowledgementCounter = 0;
  policyDocCounter = 0;
  policyAckCounter = 0;
  auditCounter = 0;
}
