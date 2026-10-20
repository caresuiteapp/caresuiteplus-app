import type { WorkflowStatus } from '@/types';
import type { DemoSeedSummary, DemoStatusCoverage } from '@/types/demo/seed';
import { demoAppointments } from './appointments';
import { demoBudgets } from './budgets';
import { demoPortalDocuments } from './documents';
import { demoPortalMessages } from './messages';
import { demoClients } from './clients';
import { demoEmployees } from './employees';
import { demoInvoices } from './invoices';
import { demoProfiles } from './profiles';
import { demoTenantProducts } from './products';
import { demoTenant, DEMO_TENANT_ID } from './tenant';

function countByStatus<T extends { status: WorkflowStatus }>(
  items: T[],
): Partial<Record<WorkflowStatus, number>> {
  return items.reduce<Partial<Record<WorkflowStatus, number>>>((acc, item) => {
    acc[item.status] = (acc[item.status] ?? 0) + 1;
    return acc;
  }, {});
}

function buildCoverage(
  entity: string,
  label: string,
  items: { status: WorkflowStatus }[],
): DemoStatusCoverage {
  const counts = countByStatus(items);
  return { entity, label, counts, total: items.length };
}

export function getDemoSeedSummary(): DemoSeedSummary {
  const activeModules = demoTenantProducts.filter((tp) => tp.isActive);

  return {
    tenantId: DEMO_TENANT_ID,
    tenantName: demoTenant.name,
    profileCount: demoProfiles.length,
    roleKeys: demoProfiles.map((p) => p.roleKey!),
    clientCount: demoClients.length,
    employeeCount: demoEmployees.length,
    appointmentCount: demoAppointments.length,
    invoiceCount: demoInvoices.length,
    messageCount: demoPortalMessages.length,
    documentCount: demoPortalDocuments.length,
    budgetCount: demoBudgets.length,
    moduleCount: demoTenantProducts.length,
    activeModuleCount: activeModules.length,
    statusCoverage: [
      buildCoverage('clients', 'Klient:innen', demoClients),
      buildCoverage('employees', 'Mitarbeitende', demoEmployees),
      buildCoverage('appointments', 'Termine', demoAppointments),
      buildCoverage('invoices', 'Rechnungen', demoInvoices),
    ],
  };
}

export { demoAppointments, demoEmployees, demoInvoices };
export { demoPortalMessages } from './messages';
export { demoPortalDocuments } from './documents';
export { demoBudgets } from './budgets';
