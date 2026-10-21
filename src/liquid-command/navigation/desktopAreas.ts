export const DESKTOP_AREAS = [
  { key: 'office', label: 'Office' }, { key: 'assist', label: 'Assist' },
  { key: 'pflege', label: 'Pflege' }, { key: 'stationaer', label: 'Stationär' },
  { key: 'beratung', label: 'Beratung' }, { key: 'akademie', label: 'Akademie' },
  { key: 'robotics', label: 'Roboter' },
  { key: 'premium', label: 'Premium' }, { key: 'settings', label: 'Einstellungen' },
] as const;
export type DesktopAreaKey = typeof DESKTOP_AREAS[number]['key'];

export function desktopAreaForRoute(route: string): DesktopAreaKey | null {
  const path = route.split(/[?#]/, 1)[0];
  if (path === '/unternehmen' || path.startsWith('/unternehmen/')) return 'office';
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

/** Introduce the Office catalogue once without dropping or reordering existing widgets. */
export function introduceOfficeDocumentCatalogWidget(ids: readonly string[], availableIds: readonly string[], introduced: boolean): string[] {
  const catalogId = 'document-catalog';
  if (introduced || !availableIds.includes(catalogId) || ids.includes(catalogId)) return [...ids];
  return [catalogId, ...ids];
}

/** Add Notes once at the end, preserving every saved placement and an empty desktop. */
export function introduceOfficeNotesWidget(ids: readonly string[], availableIds: readonly string[], introduced: boolean): string[] {
  if (introduced || ids.length === 0 || !availableIds.includes('notes') || ids.includes('notes')) return [...ids];
  return [...ids, 'notes'];
}
