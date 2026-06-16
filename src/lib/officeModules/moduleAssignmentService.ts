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
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { clientRecordRoute } from '@/lib/navigation/clientRoutes';
import {
  loadClientModuleAssignmentsLive,
  loadEmployeeModuleAssignmentsLive,
  loadModuleAssignmentSectionCountLive,
  loadModuleBillingSourcesLive,
  loadModuleDocumentVisibilityLive,
  loadModulePermissionProfilesLive,
  loadModuleServiceCatalogLive,
  loadModuleTemplateAssignmentsLive,
} from '@/lib/officeModules/moduleAssignmentLiveLoader';

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
  return guardServiceTenant(tenantId);
}

function toListItems(
  section: ModuleAssignmentSection,
  moduleFilter?: ProductKey | null,
  search?: string,
  source?: {
    clients?: ClientModuleAssignment[];
    employees?: EmployeeModuleAssignment[];
    services?: ModuleServiceCatalogEntry[];
    billing?: ModuleBillingSource[];
    documents?: ModuleDocumentVisibility[];
    templates?: ModuleTemplateAssignment[];
    permissions?: ModulePermissionProfile[];
  },
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
      items = (source?.clients ?? officeCoreDemoRepository.listClientModuleAssignments()).map(mapClient);
      break;
    case 'employees':
      items = (source?.employees ?? officeCoreDemoRepository.listEmployeeModuleAssignments()).map(mapEmployee);
      break;
    case 'services':
      items = (source?.services ?? officeCoreDemoRepository.listModuleServiceCatalog()).map(mapService);
      break;
    case 'billing':
      items = (source?.billing ?? officeCoreDemoRepository.listModuleBillingSources()).map(mapBilling);
      break;
    case 'documents':
      items = (source?.documents ?? officeCoreDemoRepository.listModuleDocumentVisibility()).map(mapDocument);
      break;
    case 'templates':
      items = (source?.templates ?? officeCoreDemoRepository.listModuleTemplateAssignments()).map(mapTemplate);
      break;
    case 'permissions':
      items = (source?.permissions ?? officeCoreDemoRepository.listModulePermissionProfiles()).map(mapPermission);
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

async function loadSectionSource(
  tenantId: string,
  section: ModuleAssignmentSection,
): Promise<ServiceResult<Parameters<typeof toListItems>[3]>> {
  switch (section) {
    case 'clients': {
      const result = await loadClientModuleAssignmentsLive(tenantId);
      return result.ok ? { ok: true, data: { clients: result.data } } : result;
    }
    case 'employees': {
      const result = await loadEmployeeModuleAssignmentsLive(tenantId);
      return result.ok ? { ok: true, data: { employees: result.data } } : result;
    }
    case 'services': {
      const result = await loadModuleServiceCatalogLive(tenantId);
      return result.ok ? { ok: true, data: { services: result.data } } : result;
    }
    case 'billing': {
      const result = await loadModuleBillingSourcesLive(tenantId);
      return result.ok ? { ok: true, data: { billing: result.data } } : result;
    }
    case 'documents': {
      const result = await loadModuleDocumentVisibilityLive(tenantId);
      return result.ok ? { ok: true, data: { documents: result.data } } : result;
    }
    case 'templates': {
      const result = await loadModuleTemplateAssignmentsLive(tenantId);
      return result.ok ? { ok: true, data: { templates: result.data } } : result;
    }
    case 'permissions': {
      const result = await loadModulePermissionProfilesLive(tenantId);
      return result.ok ? { ok: true, data: { permissions: result.data } } : result;
    }
  }
}

export async function fetchModuleAssignmentList(
  tenantId: string,
  section: ModuleAssignmentSection,
  actorRoleKey?: RoleKey | null,
  options?: { moduleKey?: ProductKey | null; search?: string },
): Promise<ServiceResult<ModuleAssignmentListItem[]>> {
  const blocked = guardModuleAssignments<ModuleAssignmentListItem[]>(tenantId, actorRoleKey);
  if (blocked) return blocked;

  if (getServiceMode() === 'supabase') {
    const source = await loadSectionSource(tenantId, section);
    if (!source.ok) return source;
    return {
      ok: true,
      data: toListItems(section, options?.moduleKey, options?.search, source.data),
    };
  }

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

  if (getServiceMode() === 'supabase') {
    const result = await loadClientModuleAssignmentsLive(tenantId);
    if (!result.ok) return result;
    const data = moduleKey ? result.data.filter((a) => a.moduleKey === moduleKey) : result.data;
    return { ok: true, data };
  }

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

  if (getServiceMode() === 'supabase') {
    const result = await loadEmployeeModuleAssignmentsLive(tenantId);
    if (!result.ok) return result;
    const data = moduleKey ? result.data.filter((a) => a.moduleKey === moduleKey) : result.data;
    return { ok: true, data };
  }

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

const HUB_SECTIONS: Omit<ModuleAssignmentHubSection, 'count'>[] = [
  {
    key: 'clients',
    label: 'Klient:innen-Zuordnung',
    icon: '👥',
    route: '/business/office/modules/clients',
  },
  {
    key: 'employees',
    label: 'Mitarbeitende-Zuordnung',
    icon: '👤',
    route: '/business/office/modules/employees',
  },
  {
    key: 'services',
    label: 'Leistungskatalog',
    icon: '📋',
    route: '/business/office/modules/services',
  },
  {
    key: 'documents',
    label: 'Dokument-Sichtbarkeit',
    icon: '📄',
    route: '/business/office/modules/documents',
  },
  {
    key: 'templates',
    label: 'Vorlagen-Zuordnung',
    icon: '📝',
    route: '/business/office/modules/templates',
  },
  {
    key: 'permissions',
    label: 'Berechtigungsprofile',
    icon: '🔐',
    route: '/business/office/modules/permissions',
  },
  {
    key: 'billing',
    label: 'Abrechnungsquellen',
    icon: '🧾',
    route: '/business/office/modules/billing',
  },
];

export async function fetchModuleAssignmentHub(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<ModuleAssignmentHubSection[]>> {
  const blocked = guardModuleAssignments<ModuleAssignmentHubSection[]>(tenantId, actorRoleKey);
  if (blocked) return blocked;

  if (getServiceMode() === 'supabase') {
    const counts = await Promise.all(
      HUB_SECTIONS.map((section) => loadModuleAssignmentSectionCountLive(tenantId, section.key)),
    );
    const failed = counts.find((result) => !result.ok);
    if (failed && !failed.ok) return failed;

    return {
      ok: true,
      data: HUB_SECTIONS.map((section, index) => ({
        ...section,
        count: counts[index].ok ? counts[index].data : 0,
      })),
    };
  }

  await delay(180);
  const sections: ModuleAssignmentHubSection[] = [
    {
      ...HUB_SECTIONS[0],
      count: officeCoreDemoRepository.listClientModuleAssignments().length,
    },
    {
      ...HUB_SECTIONS[1],
      count: officeCoreDemoRepository.listEmployeeModuleAssignments().length,
    },
    {
      ...HUB_SECTIONS[2],
      count: officeCoreDemoRepository.listModuleServiceCatalog().length,
    },
    {
      ...HUB_SECTIONS[3],
      count: officeCoreDemoRepository.listModuleDocumentVisibility().length,
    },
    {
      ...HUB_SECTIONS[4],
      count: officeCoreDemoRepository.listModuleTemplateAssignments().length,
    },
    {
      ...HUB_SECTIONS[5],
      count: officeCoreDemoRepository.listModulePermissionProfiles().length,
    },
    {
      ...HUB_SECTIONS[6],
      count: officeCoreDemoRepository.listModuleBillingSources().length,
    },
  ];
  return { ok: true, data: sections };
}
