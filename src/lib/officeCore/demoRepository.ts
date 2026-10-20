import type {
  ClientModuleAssignment,
  EmployeeModuleAssignment,
  ModuleBillingSource,
  ModuleDocumentVisibility,
  ModulePermissionProfile,
  ModuleServiceCatalogEntry,
  ModuleTemplateAssignment,
  OfficeCoreStats,
} from '@/lib/officeCore/types';
import {
  demoClientModuleAssignments,
  demoEmployeeModuleAssignments,
  demoModuleBillingSources,
  demoModuleDocumentVisibility,
  demoModulePermissionProfiles,
  demoModuleServiceCatalog,
  demoModuleTemplateAssignments,
} from '@/data/demo/officeCoreAssignments';
import { demoClients } from '@/data/demo/clients';
import { demoEmployees } from '@/data/demo/employees';
import { demoInvoices } from '@/data/demo/invoices';
import { demoPortalDocuments } from '@/data/demo/documents';
import { demoTenantProducts } from '@/data/demo/products';

/** Demo-Repository für OfficeCore-Stammdaten und Modulzuordnungen. */
export const officeCoreDemoRepository = {
  getStats(): OfficeCoreStats {
    return {
      clientCount: demoClients.length,
      activeClientCount: demoClients.filter((c) => c.status === 'aktiv').length,
      employeeCount: demoEmployees.length,
      activeEmployeeCount: demoEmployees.filter((e) => e.status === 'aktiv').length,
      documentCount: demoPortalDocuments.length,
      invoiceCount: demoInvoices.length,
      openInvoiceCount: demoInvoices.filter(
        (i) => i.status === 'aktiv' || i.status === 'in_bearbeitung',
      ).length,
      moduleAssignmentCount:
        demoClientModuleAssignments.length + demoEmployeeModuleAssignments.length,
      activeModuleCount: demoTenantProducts.filter((p) => p.isActive).length,
    };
  },

  listClientModuleAssignments(): ClientModuleAssignment[] {
    return [...demoClientModuleAssignments];
  },

  listEmployeeModuleAssignments(): EmployeeModuleAssignment[] {
    return [...demoEmployeeModuleAssignments];
  },

  listModuleServiceCatalog(): ModuleServiceCatalogEntry[] {
    return [...demoModuleServiceCatalog];
  },

  listModuleBillingSources(): ModuleBillingSource[] {
    return [...demoModuleBillingSources];
  },

  listModuleDocumentVisibility(): ModuleDocumentVisibility[] {
    return [...demoModuleDocumentVisibility];
  },

  listModuleTemplateAssignments(): ModuleTemplateAssignment[] {
    return [...demoModuleTemplateAssignments];
  },

  listModulePermissionProfiles(): ModulePermissionProfile[] {
    return [...demoModulePermissionProfiles];
  },
};
