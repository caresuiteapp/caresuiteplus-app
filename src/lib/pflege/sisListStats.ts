import type { SisAssessment } from '@/types/modules/pflege';
import { legacyColorsFromPalette, type ColorMode } from '@/design/tokens/themeBridge';

export type SisListKpi = {
  id: string;
  label: string;
  value: string;
  subValue?: string;
  icon?: string;
  accentColor?: string;
};

function countDueReviews(items: SisAssessment[]): number {
  const in14Days = Date.now() + 14 * 86_400_000;
  return items.filter(
    (item) => item.nextReviewAt && new Date(item.nextReviewAt).getTime() <= in14Days,
  ).length;
}

export function buildSisListKpis(items: SisAssessment[], mode: ColorMode = 'dark'): SisListKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  const active = items.filter((item) => item.status === 'aktiv').length;
  const inProgress = items.filter((item) => item.status === 'in_bearbeitung').length;
  const due = countDueReviews(items);
  const avgScore =
    items.length > 0
      ? Math.round(items.reduce((sum, item) => sum + item.overallScore, 0) / items.length)
      : 0;

  return [
    {
      id: 'total',
      label: 'Assessments',
      value: String(items.length),
      subValue: items.length === 1 ? 'Eintrag' : 'Einträge',
      icon: '📊',
      accentColor: colors.violet,
    },
    {
      id: 'active',
      label: 'Aktiv',
      value: String(active),
      subValue: inProgress > 0 ? `${inProgress} in Prüfung` : 'Keine in Prüfung',
      icon: '✅',
      accentColor: colors.success,
    },
    {
      id: 'due',
      label: 'Prüfung fällig',
      value: String(due),
      subValue: due > 0 ? 'Innerhalb 14 Tage' : 'Keine fällig',
      icon: '📅',
      accentColor: due > 0 ? colors.orange : colors.textMuted,
    },
    {
      id: 'avg-score',
      label: 'Ø Score',
      value: items.length > 0 ? String(avgScore) : '—',
      subValue: 'Punkte',
      icon: '🎯',
      accentColor: colors.cyan,
    },
  ];
}
