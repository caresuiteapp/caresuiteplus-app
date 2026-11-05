import { pflegeNav } from '@/lib/navigation/moduleNav/pflegeNav';
import { canShowDesktopCatalogRoute, type DesktopCatalogAccess } from './appsWidgetsCatalogModel.shared';

export type PflegeWorkspaceLink = Readonly<{ id: string; label: string; route: string; description?: string }>;
export type PflegeWorkspaceGroup = Readonly<{ title: string; links: readonly PflegeWorkspaceLink[] }>;

const descriptions: Readonly<Record<string, string>> = {
  '/pflege/klienten': 'Pflegeakten und zugeordnete Versorgung',
  '/pflege/versorgungsuebersicht': 'Aktuelle Versorgung und nächste Schritte',
  '/pflege/plans': 'Gespeicherte Pflegepläne und Fassungen',
  '/pflege/planung': 'Maßnahmen planen und fortschreiben',
  '/pflege/dokumentation': 'Durchführung und Verlauf dokumentieren',
  '/pflege/sis': 'Informationssammlung und Assessments',
  '/pflege/vitalwerte': 'Messungen, Verläufe und Grenzwerte',
  '/pflege/medikation': 'Medikationsplan, Gaben und Abweichungen',
  '/pflege/wunddokumentation': 'Wundfälle und Verlauf',
  '/pflege/behandlungspflege': 'Verordnete Behandlung und Nachweise',
  '/pflege/uebergaben': 'Informationen im Team weitergeben',
  '/pflege/leistungsnachweise': 'Erfasste Leistungen und Unterschriften',
  '/pflege/md-pruefbereitschaft': 'Vorhandene Nachweise je Pflegefall prüfen',
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

/** Measure content space, including an open sidebar; larger text reduces columns. */
export function pflegeWorkspaceColumnCount(width: number, fontScale = 1): number {
  if (!Number.isFinite(width) || width <= 0) return 1;
  const scale = Number.isFinite(fontScale) ? Math.max(1, fontScale) : 1;
  return Math.max(1, Math.min(3, Math.floor((width + 16) / (280 * scale + 16))));
}
