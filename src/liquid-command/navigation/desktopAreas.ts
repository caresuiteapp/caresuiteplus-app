export const DESKTOP_AREAS = [
  { key: 'office', label: 'Office' }, { key: 'assist', label: 'Assist' },
  { key: 'pflege', label: 'Pflege' }, { key: 'stationaer', label: 'Stationär' },
  { key: 'beratung', label: 'Beratung' }, { key: 'robotics', label: 'Roboter' },
  { key: 'premium', label: 'Premium' }, { key: 'settings', label: 'Einstellungen' },
] as const;
export type DesktopAreaKey = typeof DESKTOP_AREAS[number]['key'];

export function desktopAreaForRoute(route: string): DesktopAreaKey | null {
  const path = route.split(/[?#]/, 1)[0];
  if (path === '/business/subscription') return 'premium';
  if (path === '/settings' || path.startsWith('/settings/') || path === '/business/settings') return 'settings';
  for (const area of DESKTOP_AREAS) {
    if (path === `/${area.key}` || path.startsWith(`/${area.key}/`)) return area.key;
  }
  if (path === '/business/office' || path.startsWith('/business/office/') ||
      path === '/business/messages' || path.startsWith('/business/messages/') ||
      path.startsWith('/business/connect/') || path === '/business/integrations' ||
      path === '/business/templates' || path.startsWith('/business/templates/')) return 'office';
  return null;
}

export function desktopAreaStorageKey(tenant: string, user: string, area: DesktopAreaKey) {
  return `caresuite.healthos.area-desktop.v1.${encodeURIComponent(JSON.stringify([tenant, user, area]))}`;
}
