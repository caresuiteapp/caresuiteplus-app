import { pflegeNav } from '@/lib/navigation/moduleNav/pflegeNav';
import { canShowDesktopCatalogRoute, type DesktopCatalogAccess } from './appsWidgetsCatalogModel.shared';

export type PflegeWorkspaceLink = Readonly<{ id: string; label: string; route: string; description?: string }>;
export type PflegeWorkspaceGroup = Readonly<{ title: string; links: readonly PflegeWorkspaceLink[] }>;

const everydayRoutes = [
  '/pflege/klienten', '/pflege/versorgungsuebersicht', '/pflege/tourenplanung', '/pflege/dokumentation',
  '/pflege/medikation', '/pflege/uebergaben',
] as const;

const descriptions: Readonly<Record<string, string>> = {
  '/pflege/klienten': 'Pflegeakten und zugeordnete Versorgung',
  '/pflege/versorgungsuebersicht': 'Aktuelle Versorgung und nächste Schritte',
  '/pflege/plans': 'Gespeicherte Pflegepläne und Fassungen',
  '/pflege/tourenplanung': 'Touren, Besuche und Einsätze planen',
  '/pflege/planung': 'Maßnahmen planen und fortschreiben',
  '/pflege/dokumentation': 'Durchführung und Verlauf dokumentieren',
  '/pflege/sis': 'Informationssammlung und Assessments',
  '/pflege/vitalwerte': 'Messungen, Verläufe und Grenzwerte',
  '/pflege/medikation': 'Medikationsplan und BMP-Import, Gaben und Abweichungen',
  '/pflege/wunddokumentation': 'Wundfälle und Verlauf',
  '/pflege/behandlungspflege': 'Verordnete Behandlung und Nachweise',
  '/pflege/uebergaben': 'Informationen im Team weitergeben',
  '/pflege/leistungsnachweise': 'Erfasste Leistungen und Unterschriften',
  '/pflege/md-pruefbereitschaft': 'Vorhandene Nachweise je Pflegefall prüfen',
};

const searchAliases: Readonly<Record<string, string>> = {
  '/pflege/klienten': 'Klientenakte Klientenakten Patientenakte Pflegefall',
  '/pflege/medikation': 'Mediplan Arzneimittel Medikamente Präparate PZN Arztverzeichnis',
  '/pflege/sis': 'Strukturierte Informationssammlung Erstgespräch',
  '/pflege/wunddokumentation': 'Wunden Wundversorgung',
  '/pflege/versorgungsuebersicht': 'Pflegefall Fallübersicht Prozessstand',
};

/** Navigation is independent of dashboard reads; destinations retain their own access checks. */
export function buildPflegeWorkspaceGroups(access: DesktopCatalogAccess): PflegeWorkspaceGroup[] {
  return pflegeNav.groups.flatMap(group => {
    const links = group.items.flatMap(item => item.href === '/pflege' ||
      !canShowDesktopCatalogRoute(item.href, access) ? [] : [{
        id: item.key, label: item.label, route: item.href, description: descriptions[item.href],
      }]);
    return links.length ? [{ title: group.title, links }] : [];
  });
}

/** Reuse only already available destinations, ordered by the everyday workflow. */
export function pflegeEverydayLinks(groups: readonly PflegeWorkspaceGroup[]): PflegeWorkspaceLink[] {
  const byRoute = new Map(groups.flatMap(group => group.links.map(link => [link.route, link] as const)));
  return everydayRoutes.flatMap(route => {
    const link = byRoute.get(route);
    return link ? [link] : [];
  });
}

const normalizeFinderText = (value: string) => value.normalize('NFC').toLocaleLowerCase('de-DE')
  .replaceAll('ä', 'ae').replaceAll('ö', 'oe').replaceAll('ü', 'ue').replaceAll('ß', 'ss')
  .normalize('NFD').replace(/\p{M}/gu, '');
const searchTerms = (query: string) => normalizeFinderText(query).split(/[^a-z0-9]+/).filter(Boolean);

export const hasPflegeWorkspaceSearch = (query: string) => searchTerms(query).length > 0;

/** Search only the supplied, already permission-filtered launchers. */
export function searchPflegeWorkspaceGroups(groups: readonly PflegeWorkspaceGroup[], query: string): readonly PflegeWorkspaceGroup[] {
  const terms = searchTerms(query);
  if (!terms.length) return groups;
  return groups.flatMap(group => {
    const links = group.links.filter(link => {
      const text = normalizeFinderText([link.label, link.description, group.title, searchAliases[link.route]].filter(Boolean).join(' '));
      return terms.every(term => text.includes(term));
    });
    return links.length ? [{ title: group.title, links }] : [];
  });
}

/** Measure content space, including an open sidebar; larger text reduces columns. */
export function pflegeWorkspaceColumnCount(width: number, fontScale = 1): number {
  if (!Number.isFinite(width) || width <= 0) return 1;
  const scale = Number.isFinite(fontScale) ? Math.max(1, fontScale) : 1;
  return Math.max(1, Math.min(3, Math.floor((width + 16) / (280 * scale + 16))));
}
