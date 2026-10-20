import type { RoleKey } from '../core/auth';
import type { WorkflowStatus } from '../core/base';

export type DemoStatusCoverage = {
  entity: string;
  label: string;
  counts: Partial<Record<WorkflowStatus, number>>;
  total: number;
};

export type DemoSeedSummary = {
  tenantId: string;
  tenantName: string;
  profileCount: number;
  roleKeys: RoleKey[];
  clientCount: number;
  employeeCount: number;
  appointmentCount: number;
  invoiceCount: number;
  messageCount: number;
  documentCount: number;
  budgetCount: number;
  statusCoverage: DemoStatusCoverage[];
  moduleCount: number;
  activeModuleCount: number;
};
