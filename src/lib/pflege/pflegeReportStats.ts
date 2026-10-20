import type { PflegeReportStats } from '@/types/modules/pflege';
import { legacyColorsFromPalette, type ColorMode } from '@/design/tokens/themeBridge';

export type PflegeReportKpi = {
  id: string;
  label: string;
  value: string;
  subValue?: string;
  icon?: string;
  accentColor?: string;
};

export function buildPflegeReportKpis(stats: PflegeReportStats, mode: ColorMode = 'dark'): PflegeReportKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  return [
    {
      id: 'active-plans',
      label: 'Aktive Pläne',
      value: String(stats.activePlans),
      icon: '📋',
      accentColor: colors.success,
    },
    {
      id: 'sis-due',
      label: 'SIS fällig',
      value: String(stats.sisAssessmentsDue),
      subValue: stats.sisAssessmentsDue > 0 ? 'Prüfung offen' : 'Keine fällig',
      icon: '📊',
      accentColor: stats.sisAssessmentsDue > 0 ? colors.orange : colors.textMuted,
    },
    {
      id: 'vitals-week',
      label: 'Vitalwerte (Woche)',
      value: String(stats.vitalsDocumentedThisWeek),
      subValue: 'Dokumentiert',
      icon: '❤️',
      accentColor: colors.cyan,
    },
    {
      id: 'wounds',
      label: 'Offene Wunden',
      value: String(stats.woundCasesOpen),
      icon: '🩹',
      accentColor: stats.woundCasesOpen > 0 ? colors.danger : colors.textMuted,
    },
    {
      id: 'mdk',
      label: 'MDK-bereit',
      value: String(stats.mdkReadyCount),
      subValue: 'Export vorbereitet',
      icon: '📤',
      accentColor: colors.violet,
    },
  ];
}
