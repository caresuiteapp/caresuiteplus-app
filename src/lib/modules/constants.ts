import type { ProductKey } from '@/types';
import { Platform } from 'react-native';
import { isConsultationWorkspaceEnabled } from '@/lib/beratung/workspaceRelease';

const consultationWebReleased = Platform.OS === 'web' && isConsultationWorkspaceEnabled();
const academyWebReleased = Platform.OS === 'web';

// Only routes migrated to the published AcademyWorkspace have a web release.
// Native screens and future/unknown destinations remain protected.
const ACADEMY_WORKSPACE_WEB_ROUTES = new Set([
  '/akademie', '/akademie/courses', '/akademie/kurse', '/akademie/kurse/new',
  '/akademie/vorlagen', '/akademie/teilnehmer', '/akademie/zertifikate',
  '/akademie/calendar', '/akademie/kalender', '/akademie/schulungsplan',
  '/akademie/pflichtschulungen', '/akademie/pruefungen', '/akademie/mediathek',
  '/akademie/auswertungen', '/akademie/reports', '/akademie/fortschritt',
  '/akademie/lektionen', '/akademie/teilnehmende', '/akademie/dozenten',
  '/akademie/settings', '/akademie/einstellungen', '/akademie/portal-preview',
]);

export const OFFICE_MODULE_KEY: ProductKey = 'office';

/** Fachmodule — aktiviert Office automatisch als Basisverwaltung. */
export const SPECIALTY_MODULE_KEYS: ProductKey[] = [
  'assist',
  'pflege',
  'stationaer',
  'beratung',
  'akademie',
];

export const ALL_PRODUCT_KEYS: ProductKey[] = [OFFICE_MODULE_KEY, ...SPECIALTY_MODULE_KEYS];

/**
 * Noch nicht produktionsreife Fachmodule. Diese Sperre gilt mandantenübergreifend
 * und kann weder durch alte tenant_products-Daten noch durch eine Plattform-
 * Freigabe umgangen werden.
 */
export const UNRELEASED_MODULE_KEYS: readonly ProductKey[] = [
  'pflege',
  'stationaer',
  ...(!consultationWebReleased ? ['beratung' as const] : []),
  ...(!academyWebReleased ? ['akademie' as const] : []),
];

export function isUnreleasedModuleKey(productKey: string): productKey is ProductKey {
  return UNRELEASED_MODULE_KEYS.includes(productKey as ProductKey);
}

/** Workspace releases do not release service pricing or billing catalogues. */
export function isUnreleasedCatalogModuleKey(productKey: string): boolean {
  return productKey === 'beratung' || productKey === 'akademie' || isUnreleasedModuleKey(productKey);
}

/** Returns the globally locked product for one of its root or deep-link routes. */
export function getUnreleasedModuleKeyFromPath(path: string): ProductKey | null {
  const pathname = (path.split(/[?#]/, 1)[0]?.toLocaleLowerCase('de-DE') ?? '').replace(/\/+$/, '');
  if (pathname === '/beratung' || pathname.startsWith('/beratung/')) {
    // Release only the shared web workplace. Legacy screens stay protected.
    const workplace = pathname === '/beratung' || /^\/beratung\/arbeitsplatz(?:\/[^/]+)?$/.test(pathname);
    return consultationWebReleased && workplace ? null : 'beratung';
  }
  if (pathname === '/akademie' || pathname.startsWith('/akademie/')) {
    const workspace = ACADEMY_WORKSPACE_WEB_ROUTES.has(pathname) ||
      /^\/akademie\/(?:courses|kurse|teilnehmer|zertifikate)\/[^/]+$/.test(pathname);
    return academyWebReleased && workspace ? null : 'akademie';
  }
  return (
    UNRELEASED_MODULE_KEYS.find(
      (productKey) => pathname === `/${productKey}` || pathname.startsWith(`/${productKey}/`),
    ) ?? null
  );
}

export function isUnreleasedModuleRoute(path: string): boolean {
  return getUnreleasedModuleKeyFromPath(path) !== null;
}

export function isSpecialtyModuleKey(productKey: ProductKey): boolean {
  return SPECIALTY_MODULE_KEYS.includes(productKey);
}

export function isPurchasedAccessSource(
  source: import('@/types').ModuleAccessSource,
): boolean {
  return (
    source === 'purchased' ||
    source === 'trial' ||
    source === 'admin_granted' ||
    source === 'demo' ||
    source === 'free_active'
  );
}
