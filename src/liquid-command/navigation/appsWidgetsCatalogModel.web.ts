import type { ProductKey } from '@/types';
import type { PermissionKey } from '@/types/permissions';
import { isUnreleasedModuleRoute } from '@/lib/modules/constants';
import { canonicalDocumentsWorkspaceHref } from '@/lib/navigation/documentsWorkspaceRoutes';
import { canonicalCompanyInventoryHref } from '@/lib/navigation/companyInventoryRoute';
import { getRouteByPath } from '@/lib/navigation/routes';
import { desktopAreaForRoute, type DesktopAreaKey } from './desktopAreas';

export type DesktopCatalogAccess = {
  can: (permission: PermissionKey) => boolean;
  hasModuleGate: (module: ProductKey) => boolean;
  roleKey?: string | null;
};

export function canonicalDesktopCatalogRoute(route: string): string {
  const canonical = canonicalDocumentsWorkspaceHref(route) ?? canonicalCompanyInventoryHref(route) ?? route;
  const rawPath = canonical.split(/[?#]/, 1)[0];
  const path = rawPath.replace(/\/+$/, '');
  const aliases: Record<string, string> = {
    '/assist/einsaetze': '/assist/assignments', '/assist/kalender': '/assist/calendar',
    '/business/office/portals': '/business/office/access',
    '/business/qm': '/office/qm', '/business/office/qm': '/office/qm',
    '/business/office/reporting': '/office/reporting',
  };
  return `${aliases[path] ?? path}${canonical.slice(rawPath.length)}`;
}

function catalogPath(route: string): string {
  return canonicalDesktopCatalogRoute(route).split(/[?#]/, 1)[0];
}

const SETTINGS_DESTINATIONS = new Set([
  '/business/office/permissions', '/business/integrations',
  '/business/templates/documents-hub', '/business/templates/tenant',
  '/business/templates/message-templates', '/business/templates/text-blocks',
  '/business/templates/ci-layout', '/business/templates/document-templates-html',
  '/business/templates/placeholders', '/business/templates/settings',
  '/business/templates/catalogs', '/business/templates/categories',
  '/business/templates/create', '/support',
]);

/** Web-only placement; a destination's existing access checks remain authoritative. */
export function desktopCatalogAreaForRoute(route: string): DesktopAreaKey | null {
  const path = catalogPath(route);
  if (SETTINGS_DESTINATIONS.has(path)) return 'settings';
  if (path === '/business/connect' || path === '/business/reporting') return 'office';
  return desktopAreaForRoute(path);
}

type CatalogRule = {
  all?: readonly PermissionKey[];
  any?: readonly PermissionKey[];
  roles?: readonly string[];
  module?: ProductKey;
};

const OFFICE: CatalogRule = { module: 'office' };
const COMPANY: CatalogRule = { module: 'office', all: ['business.tenant.manage'] };
const CATALOG: CatalogRule = { module: 'office', all: ['office.catalogs.view'] };
const RECORDS: CatalogRule = { module: 'assist', all: ['assist.records.view'] };
const ASSIGNMENTS: CatalogRule = { module: 'assist', all: ['assist.assignments.view'] };
const WORKSPACE: CatalogRule = { module: 'office', roles: ['business_admin', 'business_manager'] };
const ACADEMY: CatalogRule = { module: 'akademie', all: ['akademie.courses.view'] };
const ACADEMY_AUTHORING: CatalogRule = { module: 'akademie', all: ['akademie.courses.view', 'akademie.courses.manage'] };

// Only actual launcher destinations are listed. A newly added or unknown deep
// link must be reviewed rather than inherit a broad module-level permission.
const RULES: Readonly<Record<string, CatalogRule>> = {
  '/akademie': ACADEMY,
  '/akademie/kurse': ACADEMY, '/akademie/kurse/new': ACADEMY_AUTHORING,
  '/akademie/vorlagen': ACADEMY_AUTHORING, '/akademie/mediathek': ACADEMY,
  '/akademie/schulungsplan': ACADEMY, '/akademie/pflichtschulungen': ACADEMY,
  '/akademie/teilnehmer': ACADEMY, '/akademie/zertifikate': ACADEMY,
  '/akademie/auswertungen': ACADEMY,
  '/akademie/pruefungen': { module: 'akademie', all: ['akademie.courses.view', 'akademie.enrollments.review'] },
  '/beratung': { module: 'beratung', all: ['beratung.cases.view', 'office.clients.view_sensitive'] },
  '/beratung/arbeitsplatz': { module: 'beratung', all: ['beratung.cases.view', 'office.clients.view_sensitive'] },
  '/settings': {}, '/settings/profile': {}, '/settings/appearance': {},
  '/settings/data-request': {}, '/settings/account-deletion': {}, '/support': {},
  '/settings/tenant': COMPANY, '/settings/tenant/notifications': COMPANY,
  '/business/office/permissions': OFFICE,
  '/business/integrations': { module: 'office', all: ['integrations.view'] },
  '/business/templates/documents-hub': { module: 'office', any: ['settings.templates.view', 'office.catalogs.view'] },
  '/business/templates/tenant': CATALOG, '/business/templates/message-templates': CATALOG,
  '/business/templates/text-blocks': CATALOG, '/business/templates/ci-layout': CATALOG,
  '/business/templates/document-templates-html': CATALOG, '/business/templates/placeholders': CATALOG,
  '/business/templates/settings': CATALOG, '/business/templates/catalogs': CATALOG,
  '/business/templates/categories': CATALOG,
  '/business/templates/create': { module: 'office', all: ['office.catalogs.edit'] },
  '/business/subscription': { module: 'office', all: ['business.subscription.view'] },
  '/office': OFFICE, '/unternehmen': OFFICE, '/business/office/dashboard': OFFICE,
  '/office/notizen': OFFICE,
  '/business/office/clients': { module: 'office', all: ['office.clients.view'] },
  '/office/clients': { module: 'office', all: ['office.clients.view'] },
  '/business/office/clients/new': { module: 'office', all: ['office.clients.create'] },
  '/business/office/employees': { module: 'office', all: ['office.employees.view'] },
  '/office/employees': { module: 'office', all: ['office.employees.view'] },
  '/business/office/fahrtenbuch': { module: 'office', all: ['office.employees.view'] },
  '/business/office/time-tracking': { module: 'office', all: ['time.tracking.team.view'] },
  '/business/office/time-tracking/live': { module: 'office', all: ['time.tracking.team.view'] },
  '/business/office/payroll': { module: 'office', all: ['office.employees.view', 'time.tracking.team.view'] },
  '/business/office/invoices': { module: 'office', all: ['office.invoices.view'] },
  '/office/invoices': { module: 'office', all: ['office.invoices.view'] },
  '/business/office/document-catalog': { module: 'office', all: ['office.documents.view'] },
  '/business/office/documents': { module: 'office', all: ['office.documents.view'] },
  '/business/office/documents/signatures': { module: 'office', all: ['office.documents.view'] },
  '/office/catalogs': CATALOG,
  '/business/messages': { module: 'office', all: ['office.messages.view'] },
  '/office/messages': { module: 'office', all: ['office.messages.view'] },
  '/office/messages/templates': { module: 'office', all: ['office.messages.view'] },
  '/office/messages/settings': { module: 'office', all: ['office.messages.view', 'communication.manage_settings'] },
  '/business/office/access': OFFICE, '/business/office/modules': OFFICE,
  '/unternehmen/inventar': { module: 'office', all: ['inventory.view'] },
  '/business/office/audit-log': OFFICE,
  '/office/qm': { module: 'office', all: ['qm.view'] },
  '/office/reporting': OFFICE,
  '/business/connect': { module: 'office', all: ['connect.view'] },
  '/business/reporting': { module: 'office', all: ['business.reporting.view'] },
  '/business/connect/google-workspace': WORKSPACE,
  // The desktop already has this independent capability check. Keep it intact;
  // selecting the Roboter area must not grant the capability.
  '/robotics': { all: ['robotics.access' as PermissionKey] },
  '/assist': { module: 'assist', all: ['office.clients.view'] },
  '/assist/assignments': ASSIGNMENTS, '/assist/calendar': ASSIGNMENTS,
  '/assist/live-status': ASSIGNMENTS, '/assist/touren': ASSIGNMENTS,
  '/assist/tourenplanung': ASSIGNMENTS, '/assist/aufgaben': ASSIGNMENTS,
  '/assist/zugeordnete-klienten': { module: 'assist', all: ['office.clients.view'] },
  '/assist/abrechnungsquellen': { module: 'assist', all: ['office.clients.view'] },
  '/assist/nachweise': RECORDS, '/assist/qualitaet': RECORDS,
  '/assist/durchfuehrung': { module: 'assist', all: ['assist.execution.view'] },
  '/assist/fahrten': { module: 'assist', any: ['assist.trips.view', 'assist.tracking.view'] },
  '/assist/portale': { module: 'assist', all: ['office.clients.view'] }, '/assist/einstellungen': { module: 'assist' },
};

/** Launcher visibility only. Opening a card never grants data or module access. */
export function canShowDesktopCatalogRoute(route: string, access: DesktopCatalogAccess): boolean {
  if (!access.roleKey || ['employee_portal', 'client_portal', 'family_portal'].includes(access.roleKey)) return false;
  if (!route.startsWith('/') || route.startsWith('//') || isUnreleasedModuleRoute(route)) return false;
  const path = catalogPath(route);
  const rule = RULES[path];
  if (!rule || !access.can('office.access')) return false;
  const allowedRoles = getRouteByPath(path)?.allowedRoles;
  if (allowedRoles?.length && !allowedRoles.some(role => role === access.roleKey)) return false;
  if (rule.module && (!access.hasModuleGate(rule.module) || !access.can(`${rule.module}.access` as PermissionKey))) return false;
  if (rule.roles && !rule.roles.includes(access.roleKey)) return false;
  if (rule.all && !rule.all.every(permission => access.can(permission))) return false;
  if (rule.any && !rule.any.some(permission => access.can(permission))) return false;
  return true;
}

export function filterDesktopCatalogEntries<T extends { route: string; permission?: PermissionKey }>(
  entries: readonly T[], area: DesktopAreaKey, access: DesktopCatalogAccess,
): T[] {
  return entries.filter(entry => desktopCatalogAreaForRoute(entry.route) === area &&
    canShowDesktopCatalogRoute(entry.route, access) && (!entry.permission || access.can(entry.permission)));
}
