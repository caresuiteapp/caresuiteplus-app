import type { BreadcrumbTrail } from '@/types/navigation/breadcrumbs';

const OFFICE_MODULE_ASSIGNMENTS_ROUTE = '/business/office/modules';

const SECTION_TITLES: Readonly<Record<string, string>> = {
  clients: 'Klient:innen-Zuordnung',
  employees: 'Mitarbeitende-Zuordnung',
  services: 'Leistungskatalog',
  documents: 'Dokument-Sichtbarkeit',
  templates: 'Vorlagen-Zuordnung',
  permissions: 'Berechtigungsprofile',
  billing: 'Abrechnungsquellen',
};

function assignmentPath(pathname: string): string {
  return pathname.split(/[?#]/, 1)[0].replace(/\/+$/, '');
}

/** Keep Office assignments distinct from the separate platform/module overview. */
export function officeModuleAssignmentRouteTitle(pathname: string): string | null {
  const path = assignmentPath(pathname);
  if (path === OFFICE_MODULE_ASSIGNMENTS_ROUTE) return 'Modulzuordnungen';
  if (!path.startsWith(`${OFFICE_MODULE_ASSIGNMENTS_ROUTE}/`)) return null;
  const section = path.slice(OFFICE_MODULE_ASSIGNMENTS_ROUTE.length + 1);
  return Object.hasOwn(SECTION_TITLES, section) ? SECTION_TITLES[section] : null;
}

/** Web-only trail uses the real Office destination instead of technical parents. */
export function officeModuleAssignmentBreadcrumbs(pathname: string): BreadcrumbTrail | null {
  const title = officeModuleAssignmentRouteTitle(pathname);
  if (!title) return null;
  const path = assignmentPath(pathname);
  const isHub = path === OFFICE_MODULE_ASSIGNMENTS_ROUTE;
  return [
    { path: '/Desktop', label: 'Desktop' },
    { path: '/office', label: 'Office' },
    { path: OFFICE_MODULE_ASSIGNMENTS_ROUTE, label: 'Modulzuordnungen', isCurrent: isHub },
    ...(!isHub ? [{ path, label: title, isCurrent: true }] : []),
  ];
}
