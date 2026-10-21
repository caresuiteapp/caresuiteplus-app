import type { ImageSourcePropType } from 'react-native';
import { WIDGETS, type WidgetDefinition } from '../screens/administrationDesktopCatalog';
import { canonicalDesktopCatalogRoute } from '../navigation/appsWidgetsCatalogModel.web';
import { desktopCatalogIconName, type DesktopCatalogIconName } from './desktopCatalogIconModel.web';
import { academyCatalogMotif, type AcademyCatalogMotif } from './academyCatalogMotif.web';

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
  'academy-overview': 'academy-overview', 'academy-courses': 'academy-courses',
  'academy-templates': 'academy-templates', 'academy-participants': 'academy-participants',
  'academy-schedule': 'academy-schedule', 'academy-mandatory': 'academy-mandatory',
  'academy-reviews': 'academy-reviews', 'academy-certificates': 'academy-certificates',
  'academy-library': 'academy-library', 'academy-reports': 'academy-reports',
} satisfies Record<DesktopCatalogIconName, string>;

// Static requires let Expo package every size. The route resolver is shared
// with outline icons, so a launcher and its navigation entry keep one meaning.
const ACADEMY_ARTWORK: Record<AcademyCatalogMotif, DesktopCatalogArtworkImages> = {
  overview: {
    small: require('../../../assets/healthos/widgets-premium/academy/overview-compact.png'),
    medium: require('../../../assets/healthos/widgets-premium/academy/overview-medium.png'),
    large: require('../../../assets/healthos/widgets-premium/academy/overview-large.png'),
  },
  courses: {
    small: require('../../../assets/healthos/widgets-premium/academy/courses-compact.png'),
    medium: require('../../../assets/healthos/widgets-premium/academy/courses-medium.png'),
    large: require('../../../assets/healthos/widgets-premium/academy/courses-large.png'),
  },
  templates: {
    small: require('../../../assets/healthos/widgets-premium/academy/templates-compact.png'),
    medium: require('../../../assets/healthos/widgets-premium/academy/templates-medium.png'),
    large: require('../../../assets/healthos/widgets-premium/academy/templates-large.png'),
  },
  participants: {
    small: require('../../../assets/healthos/widgets-premium/academy/participants-compact.png'),
    medium: require('../../../assets/healthos/widgets-premium/academy/participants-medium.png'),
    large: require('../../../assets/healthos/widgets-premium/academy/participants-large.png'),
  },
  schedule: {
    small: require('../../../assets/healthos/widgets-premium/academy/schedule-compact.png'),
    medium: require('../../../assets/healthos/widgets-premium/academy/schedule-medium.png'),
    large: require('../../../assets/healthos/widgets-premium/academy/schedule-large.png'),
  },
  mandatory: {
    small: require('../../../assets/healthos/widgets-premium/academy/mandatory-compact.png'),
    medium: require('../../../assets/healthos/widgets-premium/academy/mandatory-medium.png'),
    large: require('../../../assets/healthos/widgets-premium/academy/mandatory-large.png'),
  },
  reviews: {
    small: require('../../../assets/healthos/widgets-premium/academy/reviews-compact.png'),
    medium: require('../../../assets/healthos/widgets-premium/academy/reviews-medium.png'),
    large: require('../../../assets/healthos/widgets-premium/academy/reviews-large.png'),
  },
  certificates: {
    small: require('../../../assets/healthos/widgets-premium/academy/certificates-compact.png'),
    medium: require('../../../assets/healthos/widgets-premium/academy/certificates-medium.png'),
    large: require('../../../assets/healthos/widgets-premium/academy/certificates-large.png'),
  },
  library: {
    small: require('../../../assets/healthos/widgets-premium/academy/library-compact.png'),
    medium: require('../../../assets/healthos/widgets-premium/academy/library-medium.png'),
    large: require('../../../assets/healthos/widgets-premium/academy/library-large.png'),
  },
  reports: {
    small: require('../../../assets/healthos/widgets-premium/academy/reports-compact.png'),
    medium: require('../../../assets/healthos/widgets-premium/academy/reports-medium.png'),
    large: require('../../../assets/healthos/widgets-premium/academy/reports-large.png'),
  },
};

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
  const academyMotif = academyCatalogMotif(route);
  if (academyMotif) return `academy-${academyMotif}`;
  return artworkNameByRoute.get(artworkRoute(route)) ?? FAMILY_ARTWORK_NAMES[desktopCatalogIconName(route)];
}

/** Every web launcher card receives artwork, including entries without widget images. */
export function desktopCatalogArtwork(
  route: string,
  preferred?: WidgetDefinition['images'],
): DesktopCatalogArtworkImages {
  const academyMotif = academyCatalogMotif(route);
  // A generic inherited widget image must not override the same Academy
  // destination's illustration in navigation, Apps, widgets or workflows.
  if (academyMotif) return ACADEMY_ARTWORK[academyMotif];
  if (preferred && !(desktopCatalogIconName(route) === 'notes' && isInlineSvg(preferred.small))) return preferred;
  return artworkByName.get(desktopCatalogArtworkName(route)) ?? FALLBACK_ARTWORK;
}
