import type { RoleKey, ServiceResult } from '@/types';
import type { ProductKey } from '@/types';
import type {
  ClientModuleAssignment,
  EmployeeModuleAssignment,
  ModuleAssignmentListItem,
  ModuleAssignmentSection,
  ModuleBillingSource,
  ModuleDocumentVisibility,
  ModulePermissionProfile,
  ModuleServiceCatalogEntry,
  ModuleTemplateAssignment,
} from '@/lib/officeCore/types';
import { officeCoreDemoRepository } from '@/lib/officeCore/demoRepository';
import { PRODUCT_LABELS } from '@/data/demo/products';
import { enforcePermission } from '@/lib/permissions';
import { guardLiveDemoFeature } from '@/lib/services/liveServiceGuard';
import { clientRecordRoute } from '@/lib/navigation/clientRoutes';

const LOAD_DELAY_MS = 220;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function guardModuleAssignments<T>(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): ServiceResult<T> | null {
  const denied = enforcePermission<T>(actorRoleKey, 'office.access' as never);
  if (denied) return denied;
  return guardLiveDemoFeature<T>(tenantId, 'Modulzuordnungen');
}

function toListItems(
  section: ModuleAssignmentSection,
  moduleFilter?: ProductKey | null,
  search?: string,
): ModuleAssignmentListItem[] {
  const q = search?.trim().toLowerCase() ?? '';

  const mapClient = (a: ClientModuleAssignment): ModuleAssignmentListItem => ({
    id: a.id,
    title: a.clientName,
    subtitle: `${PRODUCT_LABELS[a.moduleKey]} · zugeordnet ${new Date(a.assignedAt).toLocaleDateString('de-DE')}`,
    moduleKey: a.moduleKey,
    status: a.status,
    meta: a.primaryEmployeeName ?? undefined,
    officeLink: clientRecordRoute(a.clientId),
  });

  const mapEmployee = (a: EmployeeModuleAssignment): ModuleAssignmentListItem => ({
    id: a.id,
    title: a.employeeName,
    subtitle: `${a.roleInModule} · ${PRODUCT_LABELS[a.moduleKey]}`,
    moduleKey: a.moduleKey,
    status: a.status,
    officeLink: `/office/employees/${a.employeeId}`,
  });

  const mapService = (a: ModuleServiceCatalogEntry): ModuleAssignmentListItem => ({
    id: a.id,
    title: a.serviceName,
    subtitle: `${a.serviceCode} · ${a.billingCategory}`,
    moduleKey: a.moduleKey,
    status: a.status,
    meta: `${(a.unitPriceCents / 100).toFixed(2)} €`,
  });

  const mapBilling = (a: ModuleBillingSource): ModuleAssignmentListItem => ({
    id: a.id,
    title: a.sourceLabel,
    subtitle: a.sourceType.replace('_', ' '),
    moduleKey: a.moduleKey,
    status: a.status,
    officeLink: a.linkedInvoiceId ? `/office/invoices/${a.linkedInvoiceId}` : undefined,
  });

  const mapDocument = (a: ModuleDocumentVisibility): ModuleAssignmentListItem => ({
    id: a.id,
    title: a.documentTitle,
    subtitle: `Sichtbarkeit: ${a.visibility.replace(/_/g, ' ')}`,
    moduleKey: a.moduleKey,
    status: a.status,
    officeLink: '/office/documents',
  });

  const mapTemplate = (a: ModuleTemplateAssignment): ModuleAssignmentListItem => ({
    id: a.id,
    title: a.templateName,
    subtitle: a.templateCategory,
    moduleKey: a.moduleKey,
    status: a.status,
    officeLink: '/business/templates',
  });

  const mapPermission = (a: ModulePermissionProfile): ModuleAssignmentListItem => ({
    id: a.id,
    title: a.profileName,
    subtitle: `Rolle: ${a.roleKey}`,
    moduleKey: a.moduleKey,
    status: a.status,
    meta: [a.canView && 'Lesen', a.canEdit && 'Bearbeiten', a.canExport && 'Export']
      .filter(Boolean)
      .join(' · '),
    officeLink: '/business/office/access/module-permissions',
  });

  let items: ModuleAssignmentListItem[] = [];

  switch (section) {
    case 'clients':
      items = officeCoreDemoRepository.listClientModuleAssignments().map(mapClient);
      break;
    case 'employees':
      items = officeCoreDemoRepository.listEmployeeModuleAssignments().map(mapEmployee);
      break;
    case 'services':
      items = officeCoreDemoRepository.listModuleServiceCatalog().map(mapService);
      break;
    case 'billing':
      items = officeCoreDemoRepository.listModuleBillingSources().map(mapBilling);
      break;
    case 'documents':
      items = officeCoreDemoRepository.listModuleDocumentVisibility().map(mapDocument);
      break;
    case 'templates':
      items = officeCoreDemoRepository.listModuleTemplateAssignments().map(mapTemplate);
      break;
    case 'permissions':
      items = officeCoreDemoRepository.listModulePermissionProfiles().map(mapPermission);
      break;
  }

  if (moduleFilter) {
    items = items.filter((i) => i.moduleKey === moduleFilter);
  }
  if (q) {
    items = items.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        i.subtitle.toLowerCase().includes(q) ||
        (i.meta?.toLowerCase().includes(q) ?? false),
    );
  }
  return items;
}

export async function fetchModuleAssignmentList(
  tenantId: string,
  section: ModuleAssignmentSection,
  actorRoleKey?: RoleKey | null,
  options?: { moduleKey?: ProductKey | null; search?: string },
): Promise<ServiceResult<ModuleAssignmentListItem[]>> {
  const blocked = guardModuleAssignments<ModuleAssignmentListItem[]>(tenantId, actorRoleKey);
  if (blocked) return blocked;

  await delay(LOAD_DELAY_MS);
  return {
    ok: true,
    data: toListItems(section, options?.moduleKey, options?.search),
  };
}

export async function fetchClientModuleAssignments(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
  moduleKey?: ProductKey,
): Promise<ServiceResult<ClientModuleAssignment[]>> {
  const blocked = guardModuleAssignments<ClientModuleAssignment[]>(tenantId, actorRoleKey);
  if (blocked) return blocked;

  await delay(LOAD_DELAY_MS);
  let data = officeCoreDemoRepository.listClientModuleAssignments();
  if (moduleKey) data = data.filter((a) => a.moduleKey === moduleKey);
  return { ok: true, data };
}

export async function fetchEmployeeModuleAssignments(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
  moduleKey?: ProductKey,
): Promise<ServiceResult<EmployeeModuleAssignment[]>> {
  const blocked = guardModuleAssignments<EmployeeModuleAssignment[]>(tenantId, actorRoleKey);
  if (blocked) return blocked;

  await delay(LOAD_DELAY_MS);
  let data = officeCoreDemoRepository.listEmployeeModuleAssignments();
  if (moduleKey) data = data.filter((a) => a.moduleKey === moduleKey);
  return { ok: true, data };
}

export type ModuleAssignmentHubSection = {
  key: ModuleAssignmentSection;
  label: string;
  icon: string;
  route: string;
  count: number;
};

export async function fetchModuleAssignmentHub(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<ModuleAssignmentHubSection[]>> {
  const blocked = guardModuleAssignments<ModuleAssignmentHubSection[]>(tenantId, actorRoleKey);
  if (blocked) return blocked;

  await delay(180);
  const sections: ModuleAssignmentHubSection[] = [
    {
      key: 'clients',
      label: 'Klient:innen-Zuordnung',
      icon: '👥',
      route: '/business/office/modules/clients',
      count: officeCoreDemoRepository.listClientModuleAssignments().length,
    },
    {
      key: 'employees',
      label: 'Mitarbeitende-Zuordnung',
      icon: '👤',
      route: '/business/office/modules/employees',
      count: officeCoreDemoRepository.listEmployeeModuleAssignments().length,
    },
    {
      key: 'services',
      label: 'Leistungskatalog',
      icon: '📋',
      route: '/business/office/modules/services',
      count: officeCoreDemoRepository.listModuleServiceCatalog().length,
    },
    {
      key: 'documents',
      label: 'Dokument-Sichtbarkeit',
      icon: '📄',
      route: '/business/office/modules/documents',
      count: officeCoreDemoRepository.listModuleDocumentVisibility().length,
    },
    {
      key: 'templates',
      label: 'Vorlagen-Zuordnung',
      icon: '📝',
      route: '/business/office/modules/templates',
      count: officeCoreDemoRepository.listModuleTemplateAssignments().length,
    },
    {
      key: 'permissions',
      label: 'Berechtigungsprofile',
      icon: '🔐',
      route: '/business/office/modules/permissions',
      count: officeCoreDemoRepository.listModulePermissionProfiles().length,
    },
    {
      key: 'billing',
      label: 'Abrechnungsquellen',
      icon: '🧾',
      route: '/business/office/modules/billing',
      count: officeCoreDemoRepository.listModuleBillingSources().length,
    },
  ];
  return { ok: true, data: sections };
}
