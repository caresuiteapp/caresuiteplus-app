import type { DesktopAreaKey } from './desktopAreas';

const CLIENTS = '/business/office/clients';
const PEOPLE = '/business/office/employees';
const NOTES = '/office/notizen';
const DOCUMENTS = '/business/office/documents';
const TEMPLATES = '/business/office/document-catalog';
const MESSAGES = '/business/messages';
const CALENDAR = '/business/connect/google-workspace?service=calendar';

// These are ordering hints, never a source of widgets or access. In particular,
// prepared Pflege/Stationär pages only qualify after the caller's release checks.
const OWN_ROUTE_PRIORITY: Readonly<Record<DesktopAreaKey, readonly string[]>> = {
  office: [CLIENTS, NOTES, TEMPLATES, MESSAGES, PEOPLE, CALENDAR, DOCUMENTS,
    '/business/office/invoices', '/business/office/time-tracking', '/unternehmen'],
  assist: ['/assist/assignments', '/assist/calendar', '/assist/live-status',
    '/assist/zugeordnete-klienten', '/assist/nachweise', '/assist/tourenplanung',
    '/assist/abrechnungsquellen', '/assist/fahrten'],
  pflege: ['/pflege/klienten', '/pflege/tourenplanung', '/pflege/dienstplaene',
    '/pflege/uebergaben', '/pflege/berichte', '/pflege/leistungsnachweise'],
  stationaer: ['/stationaer/bewohner', '/stationaer/uebergabe',
    '/stationaer/bewohnerplanung', '/stationaer/wohnbereiche',
    '/stationaer/tagesstruktur', '/stationaer/belegung'],
  beratung: ['/beratung/arbeitsplatz'],
  akademie: ['/akademie/kurse', '/akademie/schulungsplan', '/akademie/pflichtschulungen',
    '/akademie/teilnehmer', '/akademie/zertifikate', '/akademie/mediathek',
    '/akademie/vorlagen', '/akademie/pruefungen', '/akademie/auswertungen', '/akademie'],
  robotics: ['/robotics?area=devices', '/robotics?area=tasks', '/robotics?area=maintenance',
    '/robotics?area=telemetry', '/robotics?area=zones', '/robotics?area=handover', '/robotics'],
  premium: ['/business/subscription'],
  settings: ['/settings/profile', '/settings/appearance', '/settings/tenant',
    '/business/office/permissions', '/business/integrations', '/settings/data-request',
    '/business/templates/documents-hub', '/support', '/settings'],
};

const SHARED_OFFICE_PRIORITY: Readonly<Record<DesktopAreaKey, readonly string[]>> = {
  office: [],
  assist: [CLIENTS, NOTES, MESSAGES, TEMPLATES, DOCUMENTS, CALENDAR],
  pflege: [CLIENTS, TEMPLATES, DOCUMENTS, NOTES, MESSAGES, PEOPLE, CALENDAR],
  stationaer: [CLIENTS, PEOPLE, NOTES, MESSAGES, TEMPLATES, DOCUMENTS, CALENDAR],
  beratung: [CLIENTS, CALENDAR, TEMPLATES, NOTES, MESSAGES, DOCUMENTS],
  akademie: [PEOPLE, CALENDAR, DOCUMENTS, NOTES, MESSAGES, TEMPLATES],
  robotics: ['/unternehmen/inventar', NOTES, MESSAGES, DOCUMENTS, PEOPLE, CALENDAR],
  premium: ['/unternehmen', '/business/office/invoices', NOTES, DOCUMENTS, MESSAGES, TEMPLATES],
  settings: ['/unternehmen', PEOPLE, TEMPLATES, DOCUMENTS, NOTES, MESSAGES],
};

/**
 * Select suggestions from the current desktop's already authorized catalog.
 * Routes must be canonicalized by the caller, as they are for pinned widgets.
 * The result contains the original records and never changes the saved selection.
 */
export function suggestDesktopWidgets<T extends { id: string; route: string }>(
  availableWidgets: readonly T[],
  pinnedIds: readonly string[],
  selectedArea: DesktopAreaKey,
  sourceAreaForRoute: (route: string) => DesktopAreaKey | null,
  limit = 6,
): T[] {
  const count = Number.isFinite(limit) ? Math.min(6, Math.max(0, Math.floor(limit))) : 0;
  if (count === 0) return [];

  const pinned = new Set(pinnedIds);
  const pinnedRoutes = new Set(availableWidgets.filter(widget => pinned.has(widget.id)).map(widget => widget.route));
  const ownPriority = OWN_ROUTE_PRIORITY[selectedArea];
  const sharedPriority = SHARED_OFFICE_PRIORITY[selectedArea];
  const candidates = availableWidgets.flatMap((widget, index) => {
    if (pinned.has(widget.id) || pinnedRoutes.has(widget.route) ||
        widget.route.split(/[?#]/, 1)[0] === '/settings/account-deletion') return [];
    const source = sourceAreaForRoute(widget.route);
    if (source === selectedArea) {
      const priority = ownPriority.indexOf(widget.route);
      return [{ widget, group: 0, priority: priority < 0 ? ownPriority.length : priority, index }];
    }
    const priority = sharedPriority.indexOf(widget.route);
    return source === 'office' && priority >= 0 ? [{ widget, group: 1, priority, index }] : [];
  });

  candidates.sort((left, right) => left.group - right.group || left.priority - right.priority || left.index - right.index);
  const seenIds = new Set<string>();
  const seenRoutes = new Set<string>();
  const suggestions: T[] = [];
  for (const { widget } of candidates) {
    if (seenIds.has(widget.id) || seenRoutes.has(widget.route)) continue;
    seenIds.add(widget.id);
    seenRoutes.add(widget.route);
    suggestions.push(widget);
    if (suggestions.length === count) break;
  }
  return suggestions;
}
