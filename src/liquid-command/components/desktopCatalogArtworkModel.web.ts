import type { ImageSourcePropType } from 'react-native';
import { WIDGETS, type WidgetDefinition } from '../screens/administrationDesktopCatalog';
import { canonicalDesktopCatalogRoute } from '../navigation/appsWidgetsCatalogModel.web';
import { desktopCatalogIconName, type DesktopCatalogIconName } from './desktopCatalogIconModel.web';

export type DesktopCatalogArtworkImages = NonNullable<WidgetDefinition['images']>;

// Reuse the original three-dimensional desktop artwork for related destinations.
// Keep this resolver web-only: native widgets retain their existing catalogue.
const FAMILY_ARTWORK_NAMES = {
  apps: 'command', home: 'command', company: 'company', clients: 'clients',
  people: 'people', profile: 'people', clock: 'time', payroll: 'salary',
  invoice: 'billing', wallet: 'budgets', folder: 'documents', document: 'proofs',
  templates: 'document-catalog', catalog: 'document-catalog', signature: 'proofs',
  notes: 'proofs', calendar: 'calendar', messages: 'messages', mail: 'messages',
  video: 'portals', table: 'salary', presentation: 'salary', tasks: 'assignments',
  route: 'logbook', car: 'logbook', activity: 'live', audit: 'audit', chart: 'salary',
  inventory: 'inventory', key: 'access', shield: 'audit', settings: 'settings',
  palette: 'settings', plug: 'portals', help: 'messages', robot: 'inventory',
  handover: 'messages', medical: 'assist', bed: 'company', learning: 'documents',
  flag: 'command',
} satisfies Record<DesktopCatalogIconName, string>;

function isInlineSvg(source: ImageSourcePropType | undefined): boolean {
  return typeof source === 'object' && source !== null && !Array.isArray(source) &&
    'uri' in source && typeof source.uri === 'string' && source.uri.startsWith('data:image/svg+xml');
}

function artworkRoute(route: string): string {
  const canonical = canonicalDesktopCatalogRoute(route).split('#', 1)[0];
  const queryStart = canonical.indexOf('?');
  if (queryStart < 0) return canonical;
  const path = canonical.slice(0, queryStart);
  const query = new URLSearchParams(canonical.slice(queryStart + 1));
  // These queries identify different pages; unrelated tracking/return queries do not.
  if (path === '/business/connect/google-workspace' && query.has('service')) {
    return `${path}?service=${query.get('service')}`;
  }
  if (['/', '/Desktop', '/office', '/assist', '/robotics', '/settings'].includes(path) && query.has('area')) {
    return `${path}?area=${query.get('area')}`;
  }
  return path;
}

const artworkByName = new Map<string, DesktopCatalogArtworkImages>();
const artworkNameByRoute = new Map<string, string>();
for (const widget of WIDGETS) {
  // The previous Notes illustration is a flat inline SVG. Notes now uses the
  // existing 3D clipboard, while all existing premium widget images stay intact.
  if (!widget.images || isInlineSvg(widget.images.small)) continue;
  artworkByName.set(widget.id, widget.images);
  artworkNameByRoute.set(artworkRoute(widget.route), widget.id);
}

// A future catalogue entry must still receive a real picture if its family or
// original widget is removed. Static requires remain visible to the Expo bundler.
const FALLBACK_ARTWORK: DesktopCatalogArtworkImages = {
  small: require('../../../assets/healthos/widgets-premium/compact/18-command-center.png'),
  medium: require('../../../assets/healthos/widgets-premium/medium/18-command-center.png'),
  large: require('../../../assets/healthos/widgets-premium/large/18-command-center.png'),
};

/** Stable picture identity for aliases, workflow destinations and Workspace tabs. */
export function desktopCatalogArtworkName(route: string): string {
  return artworkNameByRoute.get(artworkRoute(route)) ?? FAMILY_ARTWORK_NAMES[desktopCatalogIconName(route)];
}

/** Every web launcher card receives artwork, including entries without widget images. */
export function desktopCatalogArtwork(
  route: string,
  preferred?: WidgetDefinition['images'],
): DesktopCatalogArtworkImages {
  if (preferred && !(desktopCatalogIconName(route) === 'notes' && isInlineSvg(preferred.small))) return preferred;
  return artworkByName.get(desktopCatalogArtworkName(route)) ?? FALLBACK_ARTWORK;
}
