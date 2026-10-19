export type DesktopCatalogIconName =
  | 'apps' | 'home' | 'company' | 'clients' | 'people' | 'profile'
  | 'clock' | 'payroll' | 'invoice' | 'wallet' | 'folder' | 'document'
  | 'templates' | 'catalog' | 'signature' | 'notes' | 'calendar' | 'messages'
  | 'mail' | 'video' | 'table' | 'presentation' | 'tasks' | 'route' | 'car'
  | 'activity' | 'audit' | 'chart' | 'inventory' | 'key' | 'shield'
  | 'settings' | 'palette' | 'plug' | 'help' | 'robot' | 'handover'
  | 'medical' | 'bed' | 'learning' | 'flag';

const workspaceIcons: Readonly<Record<string, DesktopCatalogIconName>> = {
  overview: 'plug', gmail: 'mail', calendar: 'calendar', meet: 'video',
  drive: 'folder', docs: 'document', sheets: 'table', slides: 'presentation',
  tasks: 'tasks', contacts: 'people', chat: 'messages', activity: 'audit',
};

const areaIcons: Readonly<Record<string, DesktopCatalogIconName>> = {
  company: 'company', organization: 'company', clients: 'clients', people: 'people',
  timekeeping: 'clock', payroll: 'payroll', billing: 'invoice', documents: 'folder',
  communication: 'messages', portals: 'key', inventory: 'inventory', audit: 'audit',
  assignments: 'tasks', planning: 'calendar', live: 'activity', proofs: 'signature',
  budgets: 'wallet', roles: 'shield', integrations: 'plug', privacy: 'shield',
  templates: 'templates', branding: 'palette', devices: 'robot', tasks: 'tasks',
  telemetry: 'activity', maintenance: 'settings', zones: 'shield', handover: 'handover',
  decisions: 'tasks', situation: 'home',
};

/** Shared by Apps, widgets and workflow shortcuts, including routes with query tabs. */
export function desktopCatalogIconName(route: string): DesktopCatalogIconName {
  const [pathAndQuery] = route.trim().split('#', 1);
  const queryStart = pathAndQuery.indexOf('?');
  const path = (queryStart < 0 ? pathAndQuery : pathAndQuery.slice(0, queryStart))
    .replace(/\/+$/, '').toLowerCase() || '/';
  const query = new URLSearchParams(queryStart < 0 ? '' : pathAndQuery.slice(queryStart + 1));
  if (path === '/business/connect/google-workspace') {
    return workspaceIcons[query.get('service') ?? 'overview'] ?? 'plug';
  }
  // Legacy module landing pages expose distinct work areas through this query.
  if (['/', '/desktop', '/office', '/assist', '/robotics', '/settings'].includes(path)) {
    const area = query.get('area');
    if (area && areaIcons[area]) return areaIcons[area];
  }
  const has = (segment: string) => new RegExp(`/(?:${segment})(?:/|$)`).test(path);

  // Specific destinations precede broader document, employee and settings sections.
  if (has('permissions|security|privacy|data-request|consents|risiken|risks')) return 'shield';
  if (has('profile|profil|account')) return 'profile';
  if (has('appearance|branding|backgrounds|darstellung')) return 'palette';
  if (has('signatures|nachweise|leistungsnachweise|leistungsnachweis-new|proofs|zertifikate')) return 'signature';
  if (has('document-catalog|templates|vorlagen|documents-hub')) return 'templates';
  if (has('catalogs|kataloge')) return 'catalog';
  if (has('settings|einstellungen') && path !== '/settings/tenant') return 'settings';
  if (has('access|portals|portale|employee-portal|client-portal')) return 'key';
  if (has('notizen|notes')) return 'notes';
  if (has('fahrtenbuch|logbook')) return 'car';
  if (has('time-tracking|timekeeping|arbeitszeit|wiedervorlagen')) return 'clock';
  if (has('payroll|salary|gehaltsstatistik')) return 'payroll';
  if (has('budgets|budget|abrechnungsquellen')) return 'wallet';
  if (has('invoices|invoice|billing|abrechnung|rechnungsgrundlagen|rechnungsgrundlage-new|subscription|plans')) return 'invoice';
  if (has('touren|tourenplanung|tours|routes')) return 'route';
  if (has('fahrten|fuhrpark|fleet|tracking')) return 'car';
  if (has('calendar|kalender|dienstplaene|bewohnerplanung|planung|planning')) return 'calendar';
  if (has('live-status|ops|vitalwerte')) return 'activity';
  if (has('audit|audit-log|activity')) return 'audit';
  if (has('reporting|reports|insight|qualitaet|qm|quality|evaluation|gesamtabnahme|md-pruefbereitschaft')) return 'chart';
  if (has('employees|personal|staff|people|contacts')) return 'people';
  if (has('clients|klienten|zugeordnete-klienten|bewohner|residents|faelle')) return 'clients';
  if (has('messages|chat|communication|erstgespraech|support-tickets')) return 'messages';
  if (has('documents|dokumente|drive')) return 'folder';
  if (has('sis|berichte|protokolle|verordnungen')) return 'document';
  if (has('inventory|inventar')) return 'inventory';
  if (has('connect|integrations')) return 'plug';
  if (has('help|hilfe|support')) return 'help';
  if (has('uebergabe|uebergaben|handover')) return 'handover';
  if (has('medikation|diagnosen|wunden|wunddokumentation|behandlungspflege|visiten')) return 'medical';
  if (has('aufgaben|assignments|einsaetze|durchfuehrung|massnahmen|pruefungen|abweichungen|abweichung-new|tagesstruktur')) return 'tasks';
  if (has('wohnbereiche|belegung')) return 'bed';
  if (has('schulungsplan|kurse|pflichtschulungen|akademie')) return 'learning';
  if (has('feature-flags|releases')) return 'flag';
  if (path === '/settings/tenant' || has('unternehmen|tenants') || path === '/business/office/dashboard' || path === '/office') return 'company';
  if (path === '/robotics') return 'robot';
  if (path === '/pflege' || path === '/beratung') return 'medical';
  if (path === '/stationaer') return 'bed';
  if (['/', '/desktop', '/assist', '/business', '/business/home', '/business/office'].includes(path)) return 'home';
  return 'apps';
}
