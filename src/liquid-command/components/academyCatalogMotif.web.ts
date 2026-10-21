export type AcademyCatalogMotif =
  | 'overview' | 'courses' | 'templates' | 'participants' | 'schedule'
  | 'mandatory' | 'reviews' | 'certificates' | 'library' | 'reports';

const SECTION_MOTIFS: Readonly<Record<string, AcademyCatalogMotif>> = {
  overview: 'overview', courses: 'courses', templates: 'templates',
  assignments: 'participants', planning: 'schedule', reviews: 'reviews',
  certificates: 'certificates', library: 'library', reports: 'reports',
};

const PAGE_MOTIFS: Readonly<Record<string, AcademyCatalogMotif>> = {
  kurse: 'courses', courses: 'courses', lektionen: 'courses', dozenten: 'courses',
  vorlagen: 'templates', teilnehmer: 'participants', teilnehmende: 'participants',
  fortschritt: 'participants', schulungsplan: 'schedule', kalender: 'schedule',
  calendar: 'schedule', pflichtschulungen: 'mandatory', pruefungen: 'reviews',
  zertifikate: 'certificates', mediathek: 'library', auswertungen: 'reports',
  reports: 'reports', 'portal-preview': 'overview',
};

function knownMotif(map: Readonly<Record<string, AcademyCatalogMotif>>, key: string): AcademyCatalogMotif | null {
  return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : null;
}

/** Presentation only: matching an illustration never grants access to a route. */
export function academyCatalogMotif(route: string): AcademyCatalogMotif | null {
  const [pathAndQuery] = route.trim().split('#', 1);
  const queryStart = pathAndQuery.indexOf('?');
  const path = (queryStart < 0 ? pathAndQuery : pathAndQuery.slice(0, queryStart))
    .replace(/\/+$/, '').toLowerCase();

  if (path === '/akademie') {
    const query = new URLSearchParams(queryStart < 0 ? '' : pathAndQuery.slice(queryStart + 1));
    return knownMotif(SECTION_MOTIFS, query.get('section') ?? 'overview') ?? 'overview';
  }
  if (!path.startsWith('/akademie/')) return null;

  const [page, record, action] = path.slice('/akademie/'.length).split('/');
  if (page === 'kurse' || page === 'courses') {
    // Course details and learning players keep the course image. Only an
    // explicit creation/editor destination uses the authoring illustration.
    if (record === 'new' || (record && ['edit', 'editor', 'bearbeiten'].includes(action))) return 'templates';
    return 'courses';
  }
  return knownMotif(PAGE_MOTIFS, page);
}
