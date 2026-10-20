import type { ShellTabConfig } from '@/types/navigation/shell';
import { resolveActiveTabKey } from '@/lib/navigation/shellConfig';

export type OfficeTimeTrackingTabKey =
  | 'live'
  | 'zeitkonten'
  | 'pruefqueue'
  | 'abwesenheiten'
  | 'nachtraege'
  | 'fahrzeitregeln'
  | 'team-meetings'
  | 'historie'
  | 'export'
  | 'einstellungen';

export const OFFICE_TIME_TRACKING_BASE = '/business/office/time-tracking';

export const OFFICE_TIME_TRACKING_OWN_HREF = `${OFFICE_TIME_TRACKING_BASE}/eigene-erfassung`;

export const OFFICE_TIME_TRACKING_TABS: ShellTabConfig[] = [
  { key: 'live', label: 'Live', icon: '🟢', href: `${OFFICE_TIME_TRACKING_BASE}/live` },
  { key: 'zeitkonten', label: 'Zeitkonten', icon: '⏱️', href: `${OFFICE_TIME_TRACKING_BASE}/zeitkonten` },
  { key: 'pruefqueue', label: 'Offene Prüfungen', icon: '🔍', href: `${OFFICE_TIME_TRACKING_BASE}/pruefqueue` },
  { key: 'abwesenheiten', label: 'Abwesenheiten', icon: '🏖️', href: `${OFFICE_TIME_TRACKING_BASE}/abwesenheiten` },
  { key: 'nachtraege', label: 'Nachträge', icon: '✏️', href: `${OFFICE_TIME_TRACKING_BASE}/nachtraege` },
  { key: 'fahrzeitregeln', label: 'Fahrzeitregeln', icon: '🚗', href: `${OFFICE_TIME_TRACKING_BASE}/fahrzeitregeln` },
  { key: 'team-meetings', label: 'Team-Meetings', icon: '👥', href: `${OFFICE_TIME_TRACKING_BASE}/team-meetings` },
  { key: 'historie', label: 'Historie', icon: '📋', href: `${OFFICE_TIME_TRACKING_BASE}/historie` },
  { key: 'export', label: 'Export', icon: '📤', href: `${OFFICE_TIME_TRACKING_BASE}/export` },
  { key: 'einstellungen', label: 'Einstellungen', icon: '⚙️', href: `${OFFICE_TIME_TRACKING_BASE}/einstellungen` },
];

const LEGACY_TAB_ALIASES: Record<string, OfficeTimeTrackingTabKey> = {
  team: 'zeitkonten',
  requests: 'abwesenheiten',
  audit: 'historie',
};

export function resolveOfficeTimeTrackingTabKey(pathname: string): OfficeTimeTrackingTabKey {
  const normalized = pathname.split('?')[0].replace(/\/$/, '') || '/';
  const segment = normalized.split('/').pop() ?? '';
  const alias = LEGACY_TAB_ALIASES[segment];
  if (alias) return alias;
  if (normalized.includes('/live-map')) return 'live';
  return resolveActiveTabKey(pathname, OFFICE_TIME_TRACKING_TABS) as OfficeTimeTrackingTabKey;
}

export function isOfficeTimeTrackingOwnCaptureRoute(pathname: string): boolean {
  return pathname.split('?')[0].replace(/\/$/, '').endsWith('/eigene-erfassung');
}
