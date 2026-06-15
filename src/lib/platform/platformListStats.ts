import type { AiJobListItem, OcrJobListItem } from '@/types/modules/platform';
import { legacyColorsFromPalette, type ColorMode } from '@/design/tokens/themeBridge';

export type PlatformListKpi = {
  id: string;
  label: string;
  value: string;
  subValue?: string;
  icon?: string;
  accentColor?: string;
};

export function buildOcrJobsListKpis(items: OcrJobListItem[], mode: ColorMode = 'dark'): PlatformListKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  const completed = items.filter((j) => j.status === 'abgeschlossen').length;
  const inProgress = items.filter((j) => j.status === 'in_bearbeitung').length;
  const failed = items.filter((j) => j.status === 'fehlerhaft').length;
  const avgConfidence =
    items.filter((j) => j.confidence != null).reduce((sum, j) => sum + (j.confidence ?? 0), 0) /
      Math.max(1, items.filter((j) => j.confidence != null).length) || 0;

  return [
    {
      id: 'total',
      label: 'OCR-Jobs',
      value: String(items.length),
      icon: '📄',
      accentColor: colors.cyan,
    },
    {
      id: 'completed',
      label: 'Abgeschlossen',
      value: String(completed),
      subValue: inProgress > 0 ? `${inProgress} in Bearbeitung` : undefined,
      icon: '✅',
      accentColor: colors.success,
    },
    {
      id: 'confidence',
      label: 'Ø Konfidenz',
      value: avgConfidence > 0 ? `${Math.round(avgConfidence * 100)}%` : '—',
      subValue: failed > 0 ? `${failed} fehlerhaft` : undefined,
      icon: '🎯',
      accentColor: failed > 0 ? colors.danger : colors.violet,
    },
  ];
}

export function buildAiJobsListKpis(items: AiJobListItem[], mode: ColorMode = 'dark'): PlatformListKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  const completed = items.filter((j) => j.status === 'abgeschlossen').length;
  const inProgress = items.filter((j) => j.status === 'in_bearbeitung').length;
  const withResult = items.filter((j) => j.resultSummary).length;

  return [
    {
      id: 'total',
      label: 'KI-Jobs',
      value: String(items.length),
      icon: '🤖',
      accentColor: colors.violet,
    },
    {
      id: 'completed',
      label: 'Abgeschlossen',
      value: String(completed),
      subValue: inProgress > 0 ? `${inProgress} in Bearbeitung` : undefined,
      icon: '✅',
      accentColor: colors.success,
    },
    {
      id: 'results',
      label: 'Mit Ergebnis',
      value: String(withResult),
      subValue: withResult < items.length ? `${items.length - withResult} ausstehend` : 'Alle fertig',
      icon: '💡',
      accentColor: colors.primary,
    },
  ];
}
