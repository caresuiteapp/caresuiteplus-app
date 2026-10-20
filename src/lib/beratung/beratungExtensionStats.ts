import { legacyColorsFromPalette, type ColorMode } from '@/design/tokens/themeBridge';
import type {
  BeratungModuleSettings,
  BeratungReportStats,
  FollowUp,
  Protocol,
} from '@/types/modules/beratung';

export type BeratungListKpi = {
  id: string;
  label: string;
  value: string;
  subValue?: string;
  icon?: string;
  accentColor?: string;
};

export function buildProtocolListKpis(
  items: (Protocol & { caseSubject: string })[],
  mode: ColorMode = 'dark',
): BeratungListKpi[] {
  const colors = legacyColorsFromPalette(mode);
  const thisMonth = items.filter((item) => {
    const diff = Date.now() - new Date(item.recordedAt).getTime();
    return diff >= 0 && diff <= 30 * 24 * 60 * 60 * 1000;
  }).length;

  return [
    {
      id: 'total',
      label: 'Protokolle',
      value: String(items.length),
      subValue: `${thisMonth} diesen Monat`,
      icon: '📄',
      accentColor: colors.cyan,
    },
    {
      id: 'active',
      label: 'Aktiv',
      value: String(items.filter((item) => item.status === 'aktiv').length),
      subValue: 'Fallbezug',
      icon: '✅',
      accentColor: colors.success,
    },
    {
      id: 'cases',
      label: 'Fälle',
      value: String(new Set(items.map((item) => item.caseId)).size),
      subValue: 'Mit Protokoll',
      icon: '📋',
      accentColor: colors.violet,
    },
  ];
}

export function buildFollowUpListKpis(items: FollowUp[], mode: ColorMode = 'dark'): BeratungListKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  const now = Date.now();
  const dueSoon = items.filter((item) => {
    const diff = new Date(item.dueAt).getTime() - now;
    return diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000;
  }).length;

  return [
    {
      id: 'open',
      label: 'Offen',
      value: String(items.length),
      subValue: `${dueSoon} in 7 Tagen`,
      icon: '🔔',
      accentColor: colors.warning,
    },
    {
      id: 'active',
      label: 'Aktiv',
      value: String(items.filter((item) => item.status === 'aktiv').length),
      subValue: 'Wiedervorlagen',
      icon: '📅',
      accentColor: colors.cyan,
    },
    {
      id: 'cases',
      label: 'Fälle',
      value: String(new Set(items.map((item) => item.caseId)).size),
      subValue: 'Mit Frist',
      icon: '📋',
      accentColor: colors.violet,
    },
  ];
}

export function buildBeratungReportsKpis(stats: BeratungReportStats, mode: ColorMode = 'dark'): BeratungListKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  return [
    {
      id: 'open',
      label: 'Offene Fälle',
      value: String(stats.openCases),
      subValue: `${stats.followUpsDue} Wiedervorlagen fällig`,
      icon: '📋',
      accentColor: colors.cyan,
    },
    {
      id: 'protocols',
      label: 'Protokolle',
      value: String(stats.protocolsThisMonth),
      subValue: 'Dieser Monat',
      icon: '📄',
      accentColor: colors.success,
    },
    {
      id: 'duration',
      label: 'Ø Dauer',
      value: `${stats.avgCaseDurationDays} Tage`,
      subValue: `${stats.closedThisMonth} abgeschlossen`,
      icon: '📊',
      accentColor: colors.violet,
    },
  ];
}

export function buildBeratungSettingsKpis(settings: BeratungModuleSettings, mode: ColorMode = 'dark'): BeratungListKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  const enabled = Object.values(settings).filter(Boolean).length;
  const total = Object.keys(settings).length;

  return [
    {
      id: 'enabled',
      label: 'Aktiv',
      value: String(enabled),
      subValue: `von ${total} Optionen`,
      icon: '✅',
      accentColor: colors.success,
    },
    {
      id: 'protocols',
      label: 'Protokoll Pflicht',
      value: settings.protocolsRequired ? 'An' : 'Aus',
      subValue: 'Dokumentation',
      icon: '📄',
      accentColor: colors.cyan,
    },
    {
      id: 'reminders',
      label: 'Erinnerungen',
      value: settings.followUpReminders ? 'An' : 'Aus',
      subValue: 'Wiedervorlagen',
      icon: '🔔',
      accentColor: colors.warning,
    },
  ];
}
