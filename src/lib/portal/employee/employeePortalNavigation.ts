import { Platform } from 'react-native';
import { isConsultationWorkspaceEnabled } from '@/lib/beratung/workspaceRelease';
import { releasedLiquidPortalNavigation, type LiquidPortalNavigationItem } from '@/liquid-command/navigation/portalCatalog';

/** One released menu for the frame, home shortcuts and the all-areas dialog. */
export function employeePortalNavigation(): readonly LiquidPortalNavigationItem[] {
  const items = releasedLiquidPortalNavigation('employee');
  const tasks: LiquidPortalNavigationItem = { id: 'tasks', label: 'Aufgaben & Notizen', glyph: '✓', route: '/portal/employee/tasks', group: 'work' };
  const consultation: LiquidPortalNavigationItem[] = Platform.OS === 'web' && isConsultationWorkspaceEnabled()
    ? [{ id: 'consultation', label: 'Beratung & Schulungen', glyph: '◎', route: '/portal/employee/beratung', group: 'work' }] : [];
  return [items[0], tasks, ...consultation, ...items.slice(1)];
}
