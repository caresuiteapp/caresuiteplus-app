import { releasedLiquidPortalNavigation, type LiquidPortalNavigationItem } from '@/liquid-command/navigation/portalCatalog';
import { employeePortalWorkspaceReleased, type EmployeePortalWorkspace } from './employeePortalWorkspaces';

const home = '/portal/employee';
const workItems: readonly LiquidPortalNavigationItem[] = [
  { id: 'tasks', label: 'Aufgaben & Notizen', glyph: '✓', route: `${home}/tasks`, group: 'work' },
  { id: 'care-tours', label: 'Meine Pflegetouren', glyph: '◇', route: `${home}/pflegetouren`, group: 'work' },
  { id: 'consultation', label: 'Beratung & Schulungen', glyph: '◎', route: `${home}/beratung`, group: 'work' },
  { id: 'academy', label: 'Meine Akademie', glyph: '△', route: `${home}/akademie`, group: 'work' },
];

const workspaceItems: Record<EmployeePortalWorkspace, readonly string[]> = {
  assist: ['assignments', 'open-assignments', 'documentation', 'clients', 'calendar', 'tasks'],
  pflege: ['care-tours'],
  beratung: ['consultation'],
  // Personal course access is determined by enrollment, across all workspaces.
  akademie: [],
  office: [],
};

const catalog = releasedLiquidPortalNavigation('employee');
const items = [catalog[0], ...workItems, ...catalog.slice(1).filter(item => item.id !== 'academy')];
const dedicatedIds = new Set(Object.values(workspaceItems).flat());

/** One menu for the rail, widgets, shortcuts and the all-areas dialog. */
export function employeePortalNavigation(workspace: EmployeePortalWorkspace | null = 'assist'): readonly LiquidPortalNavigationItem[] {
  const visible = workspace && employeePortalWorkspaceReleased(workspace) ? workspaceItems[workspace] : [];
  return items.filter(item => !dedicatedIds.has(item.id) || visible.includes(item.id));
}

export function employeePortalWorkspaceForPath(pathname: string): EmployeePortalWorkspace | null {
  const path = pathname.replace(/\/+$/, '');
  const matches = (root: string) => path === root || path.startsWith(`${root}/`);
  if (matches(`${home}/schedule`) || matches(`${home}/execution`)) return 'assist';
  const route = items.find(item => dedicatedIds.has(item.id) && matches(item.route));
  return route
    ? (Object.keys(workspaceItems) as EmployeePortalWorkspace[]).find(key => workspaceItems[key].includes(route.id)) ?? null
    : null;
}
