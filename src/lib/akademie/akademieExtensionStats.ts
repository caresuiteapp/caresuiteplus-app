import { legacyColorsFromPalette, type ColorMode } from '@/design/tokens/themeBridge';
import type {
  AkademieModuleSettings,
  AkademieReportStats,
  CertificateListItem,
  EnrollmentListItem,
} from '@/types/modules/akademie';

export type AkademieListKpi = {
  id: string;
  label: string;
  value: string;
  subValue?: string;
  icon?: string;
  accentColor?: string;
};

export function buildEnrollmentListKpis(items: EnrollmentListItem[], mode: ColorMode = 'dark'): AkademieListKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  const inProgress = items.filter((item) => item.progressPercent > 0 && item.progressPercent < 100).length;
  const completed = items.filter((item) => item.progressPercent >= 100).length;

  return [
    {
      id: 'total',
      label: 'Teilnahmen',
      value: String(items.length),
      subValue: `${inProgress} in Bearbeitung`,
      icon: '👥',
      accentColor: '#FFD166',
    },
    {
      id: 'completed',
      label: 'Abgeschlossen',
      value: String(completed),
      subValue: '100 % Fortschritt',
      icon: '✅',
      accentColor: colors.success,
    },
    {
      id: 'avg-progress',
      label: 'Ø Fortschritt',
      value:
        items.length > 0
          ? `${Math.round(items.reduce((sum, item) => sum + item.progressPercent, 0) / items.length)} %`
          : '—',
      subValue: 'Alle Teilnahmen',
      icon: '📊',
      accentColor: colors.cyan,
    },
  ];
}

export function buildCertificateListKpis(items: CertificateListItem[], mode: ColorMode = 'dark'): AkademieListKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  const now = Date.now();
  const expiringSoon = items.filter((item) => {
    if (!item.expiresAt) return false;
    const diff = new Date(item.expiresAt).getTime() - now;
    return diff > 0 && diff <= 90 * 24 * 60 * 60 * 1000;
  }).length;

  return [
    {
      id: 'total',
      label: 'Zertifikate',
      value: String(items.length),
      subValue: `${expiringSoon} laufen bald ab`,
      icon: '🏅',
      accentColor: colors.success,
    },
    {
      id: 'active',
      label: 'Gültig',
      value: String(items.filter((item) => item.status === 'aktiv').length),
      subValue: 'Aktive Nachweise',
      icon: '✅',
      accentColor: colors.cyan,
    },
    {
      id: 'issued-month',
      label: 'Ausgestellt',
      value: String(
        items.filter((item) => {
          const diff = now - new Date(item.issuedAt).getTime();
          return diff >= 0 && diff <= 30 * 24 * 60 * 60 * 1000;
        }).length,
      ),
      subValue: 'Letzte 30 Tage',
      icon: '📅',
      accentColor: '#FFD166',
    },
  ];
}

export function buildAkademieReportsKpis(stats: AkademieReportStats, mode: ColorMode = 'dark'): AkademieListKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  return [
    {
      id: 'courses',
      label: 'Aktive Kurse',
      value: String(stats.activeCourses),
      subValue: `${stats.enrollmentsOpen} offene Teilnahmen`,
      icon: '🎓',
      accentColor: '#FFD166',
    },
    {
      id: 'completions',
      label: 'Abschlüsse',
      value: String(stats.completionsThisMonth),
      subValue: 'Dieser Monat',
      icon: '✅',
      accentColor: colors.success,
    },
    {
      id: 'compliance',
      label: 'Pflicht-Compliance',
      value: `${stats.mandatoryCompliancePercent} %`,
      subValue: `${stats.certificatesExpiring} Zert. ablaufend`,
      icon: '📊',
      accentColor: colors.violet,
    },
  ];
}

export function buildAkademieSettingsKpis(settings: AkademieModuleSettings, mode: ColorMode = 'dark'): AkademieListKpi[]  {
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
      id: 'mandatory',
      label: 'Pflicht-Erinnerung',
      value: settings.mandatoryReminders ? 'An' : 'Aus',
      subValue: 'Schulungen',
      icon: '🔔',
      accentColor: '#FFD166',
    },
    {
      id: 'certificates',
      label: 'Auto-Zertifikat',
      value: settings.certificateAutoIssue ? 'An' : 'Aus',
      subValue: 'Ausstellung',
      icon: '🏅',
      accentColor: colors.cyan,
    },
  ];
}
