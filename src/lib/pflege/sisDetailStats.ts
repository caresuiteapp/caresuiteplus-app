import type { SisAssessment } from '@/types/modules/pflege';
import { legacyColorsFromPalette, type ColorMode } from '@/design/tokens/themeBridge';

export type SisDetailKpi = {
  id: string;
  label: string;
  value: string;
  subValue?: string;
  icon?: string;
  accentColor?: string;
};

export function buildSisDetailKpis(assessment: SisAssessment, mode: ColorMode = 'dark'): SisDetailKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  const reviewLabel = assessment.nextReviewAt
    ? new Date(assessment.nextReviewAt).toLocaleDateString('de-DE')
    : '—';

  return [
    {
      id: 'score',
      label: 'Gesamtscore',
      value: `${assessment.overallScore}`,
      subValue: 'Punkte',
      icon: '🎯',
      accentColor: colors.cyan,
    },
    {
      id: 'assessed',
      label: 'Bewertet am',
      value: new Date(assessment.assessedAt).toLocaleDateString('de-DE'),
      subValue: assessment.assessorName,
      icon: '📋',
      accentColor: colors.violet,
    },
    {
      id: 'review',
      label: 'Nächste Prüfung',
      value: reviewLabel,
      subValue: assessment.nextReviewAt ? 'Prüffrist' : 'Noch nicht geplant',
      icon: '📅',
      accentColor: assessment.nextReviewAt ? colors.orange : colors.textMuted,
    },
  ];
}
