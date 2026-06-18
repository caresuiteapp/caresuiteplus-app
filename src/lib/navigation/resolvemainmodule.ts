import type { AppShellArea } from '@/types/navigation/shell';
import type { MainModuleKey } from '@/types/navigation/platform';

/** Resolve the active main-module rail entry from the current route. */
export function resolveMainModuleFromPath(pathname: string): MainModuleKey {
  const path = pathname.split('?')[0].replace(/\/$/, '') || '/';

  if (path.startsWith('/settings') || path.startsWith('/business/admin') || path.startsWith('/admin')) {
    return 'admin';
  }
  if (path.startsWith('/zentrale')) {
    return 'zentrale';
  }
  if (path.startsWith('/office') || path.startsWith('/business/office')) {
    return 'office';
  }
  if (path.startsWith('/assist')) {
    return 'assist';
  }
  if (path.startsWith('/pflege')) {
    return 'pflege';
  }
  if (path.startsWith('/stationaer')) {
    return 'stationaer';
  }
  if (path.startsWith('/beratung')) {
    return 'beratung';
  }
  if (path.startsWith('/akademie')) {
    return 'akademie';
  }
  if (path.startsWith('/business') || path.startsWith('/insight')) {
    return 'zentrale';
  }

  return 'zentrale';
}

/** Map main-module key to legacy AppShellArea for existing hooks and access checks. */
export function mainModuleToAppShellArea(moduleKey: MainModuleKey): AppShellArea {
  switch (moduleKey) {
    case 'office':
      return 'office';
    case 'assist':
      return 'assist';
    case 'pflege':
      return 'pflege';
    case 'stationaer':
      return 'stationaer';
    case 'beratung':
      return 'beratung';
    case 'akademie':
      return 'akademie';
    case 'admin':
    case 'zentrale':
    default:
      return 'business';
  }
}
